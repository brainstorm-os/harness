# 29 — Credentials storage

This doc covers how Brainstorm stores **sensitive credentials** — sovereign identity private keys, vault master keys, AI provider API keys, sync transport tokens, and app-private secrets — across the three target platforms (macOS, Windows, Linux).

It builds on [16-identity-orgs-encryption.md](16-identity-orgs-encryption.md) (the identity model), [09-security-and-sandbox.md](09-security-and-sandbox.md) (capability surface), [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md) (vault layout), and [22-ai-foundations.md](../platform/22-ai-foundations.md) (BYO AI keys).

## What gets stored

| Secret kind                                | Scope                | Threat if leaked                                               |
|--------------------------------------------|----------------------|----------------------------------------------------------------|
| Sovereign identity private key (Ed25519)   | Per-vault            | Impersonation; full access to user's data and shared spaces.    |
| Vault master key (at-rest encryption key)  | Per-vault            | Decryption of `entities.db`, `search.db`, `ledger.db`, Yjs files. |
| Cloud AI provider API keys                  | Per-vault            | Cost / quota burn; possible content exposure.                  |
| Sync transport tokens (relay auth)          | Per-vault            | Connect to user's relay endpoint as their device.              |
| App-private secrets (OAuth tokens, app-stored API keys) | Per-app, per-vault | App-scoped; bounded by capability surface.            |
| Org keys (v2)                               | Per-org-membership   | Impersonate org member.                                        |
| Recovery passphrase (if user enables one)   | Per-vault            | Unlock vault on a new device or after OS-key loss.             |

> **Decision:** all these flow through one host service — the **credential store** — exposed in the SDK as `brainstorm.services.credentials.*`. Apps never call platform keystore APIs directly. Platform abstraction lives in one place.

## Two storage tiers

> **Decision:** Brainstorm uses **two storage tiers** for credentials, picked per-secret based on threat profile:
>
> - **Tier 1 (real OS keystore items)** — for primary key material (sovereign identity private key, vault master key, recovery key wraps). Each is a distinct entry in the platform's keystore: macOS Keychain Services, Windows Credential Manager (DPAPI-protected), Linux Secret Service via D-Bus. Accessed via the `@napi-rs/keyring` Node addon or equivalent platform binding.
> - **Tier 2 (encrypted blobs in `credentials.db`)** — for secondary secrets (AI API keys, sync tokens, app-private credentials). Encrypted under the vault master key (which is itself in Tier 1) and stored as rows in a SQLite file inside the vault.

This split exists because:

- **Tier 1 protects the vault root of trust.** A real keystore item is bound to the OS user's authenticated session, has platform-level ACLs (macOS can require user auth per-access), and is harder for malware to silently exfiltrate than an encrypted blob in a file.
- **Tier 2 keeps the keystore uncluttered.** A power user with 5 vaults × 50 app-private credentials each = 250 keystore items is unwieldy; one-master-key-decrypts-the-rest is a standard practice (the same model Bitwarden, 1Password, etc. use internally).
- **Tier 2's blob is useless without Tier 1's master key.** Loss of `credentials.db` is recoverable (apps re-prompt for missing creds); loss of the master key is recoverable only via passphrase-based backup or another paired device.

> **Note:** earlier drafts of this doc proposed using Electron's `safeStorage` as the primary backend. **That was wrong.** `safeStorage` is an encryption primitive over a buffer the app stores in a regular file; the encrypted blob can be deleted, copied, or tampered with like any file. It does not provide real OS keystore item storage. The correct primitive for primary key material is `@napi-rs/keyring` (or platform APIs directly). `safeStorage` may still be used internally for *session-scoped* short-lived secrets where regenerating is cheap; it is not used for keys.

> **Note on the addon choice:** earlier drafts mentioned `keytar`. That library was archived by GitHub in 2023 and is no longer maintained. **`@napi-rs/keyring`** is the actively-maintained successor — a Rust-backed Node addon over the `keyring` Rust crate, with the same Keychain Services / DPAPI / Secret Service guarantees. This is part of a broader strategic move toward Rust libraries for CPU-heavy and security-critical paths (see [13-frontend-stack.md](../shell/13-frontend-stack.md) "Rust libraries via Node addons" section).

## Per-platform mechanism

### macOS — Keychain Services

- **Tier 1 storage:** items in the user's login keychain via `@napi-rs/keyring` → Keychain Services API.
- Keychain unlocks at OS login; subsequent access is silent unless the user has set per-item ACL requiring re-authentication (we use this for the identity private key by default).
- Survives OS user-password change (keychain re-encrypts).
- Backup: included in Time Machine and iCloud Keychain (subject to user OS settings).

### Windows — Credential Manager / DPAPI

- **Tier 1 storage:** items in Windows Credential Manager via `@napi-rs/keyring` → `CredWrite` / `CredRead`. DPAPI underneath, keyed to the OS login.
- Per-user; not shared across users on the same machine.
- DPAPI items can become unreadable if the user's login password is reset by an admin (loss of the prior password). Recovery via Microsoft account preserves DPAPI; admin-forced resets do not.
- Backup: tied to user-profile backups; not separately exportable without user-credential authentication.

### Linux — Secret Service via D-Bus

- **Tier 1 storage:** items in the Secret Service collection via `@napi-rs/keyring` → `libsecret`. Backed by GNOME Keyring or KWallet.
- Items live in a "default collection"; unlocked by user password at login.
- **Caveat:** not universal. Headless Linux, server distros, minimal window managers may have neither GNOME Keyring nor KWallet. We require a fallback (passphrase-based, see below).

## Fallback chain

When `@napi-rs/keyring` reports no OS keystore is available (some Linux configurations, headless deployments, CI), the credential store falls back through:

1. **`@napi-rs/keyring`** with OS keystore — preferred.
2. **Passphrase-encrypted master key.** The vault master key is held only in memory; on vault-open the user enters a passphrase, an Argon2id-derived key decrypts the master key from a vault-stored ciphertext. The master key is held in memory until vault close.
3. **Plaintext (developer mode only)** — refuse in production; allow only when an explicit env var like `BRAINSTORM_DEV_INSECURE_CREDENTIALS=1` is set, with a giant red banner. Used for headless test runners.

> **Decision:** the fallback level is detected at vault create / first-open and **recorded in `vault.json`** so the shell behaves consistently. Upgrading from passphrase to OS-keystore (e.g., user installed GNOME Keyring) is a one-shot migration the shell offers.

> **Decision:** the user is **explicitly informed** of which backend is in use. The settings panel shows "Credentials backend: macOS Keychain" / "Linux Secret Service (GNOME Keyring)" / "Passphrase-only" / "Plaintext (dev-mode)".

## Storage layout

Inside the vault:

```
shell/
├── identity/
│   └── pubkey                       (the vault's public key — non-secret, in plaintext)
└── credentials.db                   (SQLite, encrypted under vault master key)
    └── credentials table:
        - key:     TEXT primary key  ("ai:provider:anthropic", "app:io.example/oauth.token", ...)
        - app:     TEXT              (the app id that owns it; "shell" for shell-owned)
        - cipher:  BLOB              (XChaCha20-Poly1305 ciphertext under vault master key)
        - nonce:   BLOB              (96-bit nonce, fresh per-secret, fresh per-write)
        - created_at, updated_at: INTEGER
```

OS keystore items (per vault):

| Keystore key                         | Value                                                 |
|--------------------------------------|-------------------------------------------------------|
| `brainstorm.<vault-id>.identity`     | Sovereign identity Ed25519 private key (raw 32 bytes) |
| `brainstorm.<vault-id>.master`       | Vault master key (32 bytes, used to encrypt `credentials.db`) |
| `brainstorm.<vault-id>.recovery`     | (Optional) passphrase-derived key for cross-device recovery (v2) |

> **Decision:** **at most three OS keystore items per vault**: identity, master, and (optional) recovery. Everything else is in Tier 2 — an app with 50 OAuth tokens contributes 0 keystore items. A user with 5 vaults sees 10–15 keystore items, not hundreds.

## SDK surface

```ts
// Available to apps via the brainstorm global
brainstorm.services.credentials.set(key: string, value: string): Promise<void>
brainstorm.services.credentials.get(key: string): Promise<string | null>
brainstorm.services.credentials.delete(key: string): Promise<void>
brainstorm.services.credentials.list(): Promise<string[]>          // returns keys, not values
```

Capability gating:

- `credentials.read:<scope>` — read keys in scope.
- `credentials.write:<scope>` — write keys in scope.

Where `<scope>` is:
- `self` (default-minimum) — the calling app's own keyspace.
- `shell` — only the shell holds this; apps can't request.
- A specific named scope an app declares in its manifest.

> **Decision:** apps receive `credentials.read:self` and `credentials.write:self` as part of default-minimum capabilities (per [09-security-and-sandbox.md](09-security-and-sandbox.md)). Cross-app credential access is **not allowed** — every app has its own isolated keyspace under Tier 2.

> **Decision:** the SDK never exposes raw keystore APIs. Apps cannot call into `@napi-rs/keyring`, Keychain Services, or DPAPI directly; the credential store is the only path. Platform abstraction stays in one place; every access is auditable.

## Specific secrets — concrete handling

### Sovereign identity private key

- **Stored as Tier 1**, keystore key `brainstorm.<vault-id>.identity`.
- Generated at vault creation (per [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md)).
- Used by the shell to sign Yjs updates, authenticate to relays, sign access grants.
- **Never exposed to apps.** Apps requesting signing call `brainstorm.services.identity.signPayload(payload)` — the shell signs server-side with the key never crossing the IPC boundary.
- Recovery (if device lost): no path in v1 unless the user enabled the recovery passphrase or has another paired device. v2 consumer accounts add cloud-encrypted backup (per [16-identity-orgs-encryption.md](16-identity-orgs-encryption.md)).

### Vault master key

- **Stored as Tier 1**, keystore key `brainstorm.<vault-id>.master`.
- Generated at vault creation; 32 bytes random.
- Used to encrypt `credentials.db` and the at-rest databases (`entities.db`, `search.db`, `ledger.db`, Yjs files — per [18-storage-and-search.md](../data/18-storage-and-search.md)).
- Loaded into memory on vault open; cleared on vault close.

### AI provider API keys

- **Stored as Tier 2**, key `ai:provider:<id>` (e.g. `ai:provider:anthropic`).
- Owner: `"shell"` — held by the AI broker, not by individual apps.
- Configured via the Settings → AI panel.
- Apps **never see** the API key. They invoke `brainstorm.services.ai.*`; the broker uses the key on their behalf.
- Per-key audit: every AI call records which provider key was used.

### Sync transport tokens

- **Stored as Tier 2**, key `sync:relay:<endpoint-host>`, owner `"shell"`.
- Configured at relay-pairing time or from a consumer account (v2).
- Used only by the sync transport in the storage worker; not exposed to apps.

### App-private secrets

- **Stored as Tier 2**, keys under the app's own scope.
- Other apps cannot read.
- Uninstalling the app deletes all its credentials.

### Recovery passphrase

- Optional. User opt-in for protection beyond the OS keystore.
- When set, an Argon2id-derived key wraps the vault master key; the wrapped form is stored in the vault directory itself (NOT in `credentials.db` — needs to be readable when the master key isn't yet available).
- "Forgot passphrase" = data loss if the OS keystore is also unavailable. Warned clearly at setup.
- v2 consumer accounts may store a passphrase-encrypted backup of the master key in the cloud.

> **Note:** [51-account-recovery-and-web-auth.md](51-account-recovery-and-web-auth.md) promotes this passphrase from a no-keyring *fallback* to a **first-class optional unlock on every platform** (the "password people actually wanted"), and folds OQ-114 into OQ-AR-3. The wrap mechanics described here are unchanged; only its product role is elevated.

## Headless / CLI scenarios

`brainstorm-cli` (per [14-app-store.md](../apps/14-app-store.md), [26-shell-as-framework.md](../apps/26-shell-as-framework.md)) needs credential access for:
- Signing app bundles (publisher keys).
- Connecting to a relay to pull/publish.
- Running app integration tests.

> **Decision:** the CLI uses the same credential store as the shell. On a headless system without an OS keystore, the CLI accepts a passphrase prompt or `BRAINSTORM_PASSPHRASE` env var (one-time at process start; never written to disk). Publisher keys CLI manages are stored in a CLI-specific scope (`cli:publisher:<key-id>`) so they don't pollute vault credentials.

> **Decision:** the CLI **refuses** to run with `BRAINSTORM_DEV_INSECURE_CREDENTIALS=1` against a non-dev-mode vault. Dev-mode is a per-vault attribute, not a global escape hatch.

## OS-login change scenarios

| Scenario                                          | Behavior                                                     |
|---------------------------------------------------|--------------------------------------------------------------|
| macOS: user changes login password                 | Keychain re-encrypts; access continues.                       |
| macOS: keychain reset (forgot password recovery)  | Tier 1 items gone. Vault unopenable without recovery passphrase or backup. |
| Windows: user changes login password (self)        | DPAPI re-keys; access continues.                              |
| Windows: admin-force resets user password         | DPAPI items unreadable. Vault unopenable without recovery passphrase or backup. |
| Linux: user changes login password                 | Keyring re-encrypts; access continues.                       |
| Linux: keyring deleted / corrupted                 | Same as keychain reset — Tier 1 gone; need passphrase or backup. |

> **Decision:** the shell warns the user at vault-creation time that **OS-keystore-only protection is tied to the OS login**. A recovery passphrase is offered as opt-in; users skipping it accept the risk.

## Cross-vault implications

Per [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md), each vault has its own identity and credential store. Two vaults on the same machine have:

- Two distinct sovereign identity keys (two Tier 1 items).
- Two distinct vault master keys (two more Tier 1 items).
- Two distinct `credentials.db` files (Tier 2 isolation).

> **Decision:** there is no cross-vault credential sharing in v1. v2's cross-vault identity linking (OQ-109) may permit shared credentials, with the user explicitly opting in per credential.

## Threat model

What this protects against (per [09-security-and-sandbox.md](09-security-and-sandbox.md)):

- **Disk-image theft (locked device):** OS keystore + at-rest encryption protect everything.
- **Other-user-on-same-machine access:** OS-level user separation keeps Tier 1 items isolated.
- **Malicious app on the same machine:** app sandbox + scoped Tier 2 prevent cross-app credential leaks.
- **Network interception:** transport TLS + identity signing prevent relay-level attacks.

What it does **not** protect against:

- **Local malware running as the same user with full OS access.** OS keystore raises the bar (per-item ACL on macOS adds friction); does not eliminate.
- **Compromised OS keystore.** Out of scope; we trust the platform's keystore implementation.
- **User who clicks through every prompt.** Same caveat as elsewhere.
- **Cloud AI provider abuse with stolen keys.** Per-key quota limits in the AI broker reduce blast radius (per [22-ai-foundations.md](../platform/22-ai-foundations.md)).

## Cross-doc cross-references

- [16-identity-orgs-encryption.md](16-identity-orgs-encryption.md) — identity model the keys belong to.
- [09-security-and-sandbox.md](09-security-and-sandbox.md) — capability matrix for `credentials.*`.
- [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md) — when credentials are generated.
- [22-ai-foundations.md](../platform/22-ai-foundations.md) — AI provider key flow.
- [13-frontend-stack.md](../shell/13-frontend-stack.md) — `@napi-rs/keyring`, `@noble/ciphers`.
- [14-app-store.md](../apps/14-app-store.md) and [26-shell-as-framework.md](../apps/26-shell-as-framework.md) — CLI publisher-key flow.

## Phasing

| Capability                                       | v1   | v2  |
|--------------------------------------------------|------|-----|
| Tier 1 (`@napi-rs/keyring`) for identity + master key      | ✓    | ✓   |
| Tier 2 (`credentials.db` encrypted under master) | ✓    | ✓   |
| macOS Keychain backend                           | ✓    | ✓   |
| Windows Credential Manager backend                | ✓    | ✓   |
| Linux Secret Service backend                     | ✓    | ✓   |
| Passphrase fallback (no OS keystore)             | ✓    | ✓   |
| Per-app-scoped Tier 2 keyspace                   | ✓    | ✓   |
| Audit log of credential reads/writes             | ✓    | ✓   |
| Per-item ACL (require user auth) on macOS for identity | ✓ | ✓ |
| Settings panel showing active backend             | ✓    | ✓   |
| OS-keystore migration on backend upgrade         | ✓    | ✓   |
| `BRAINSTORM_DEV_INSECURE_CREDENTIALS` (dev only) | ✓    | ✓   |
| Cloud-encrypted backup of master key             | —    | ✓ (consumer accounts) |
| Cross-vault credential sharing                   | —    | ✓ (with explicit opt-in, post-OQ-109) |

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-113** — `@napi-rs/keyring` vs platform-native bindings — `@napi-rs/keyring` is unmaintained-ish; alternatives include `@napi-rs/keyring` (Rust-backed, actively maintained). Pick one.
- **OQ-114** — passphrase strength requirements (Argon2id parameters; minimum entropy guidance).
- **OQ-115** — what happens when the OS keystore is *intermittently* unavailable (Linux keyring daemon crashes mid-session)? Re-prompt for passphrase, fail, or queue?
- **OQ-116** — should the credential store enforce a maximum credential value size (against an app stuffing entire databases into "credentials")?
- **OQ-123** — should the identity private key require user authentication on every signing operation (macOS per-item ACL), or only at vault open? Trade-off: phishing-resistance vs. UX friction.

## Summary

- Brainstorm holds several kinds of secrets routed through one host service — the **credential store**.
- **Two storage tiers**: Tier 1 = real OS keystore items (`@napi-rs/keyring` → Keychain / DPAPI / Secret Service) for identity private key and vault master key; Tier 2 = SQLite blob encrypted under the master key, for everything else.
- **Maximum three Tier 1 items per vault** keeps the OS keystore uncluttered.
- `safeStorage` is **not** used for primary credentials — it's an encryption primitive over a buffer-in-a-file, not a real keystore. Earlier-draft mistake corrected.
- Per-app keyspace isolation in Tier 2; apps never see raw platform APIs; cross-app credential access is forbidden.
- Headless / CLI uses the same store; passphrase or env-var entry; CLI keys in a separate scope.
- OS-login changes preserve credentials normally; admin-forced resets or keychain corruption fall back to recovery passphrase.
- Threat model and v2 phasing align with [09-security-and-sandbox.md](09-security-and-sandbox.md) and [16-identity-orgs-encryption.md](16-identity-orgs-encryption.md).
