# 28 — Vault and onboarding

This doc covers two tightly-coupled concepts: the **vault** (a self-contained directory holding one user's data) and the **onboarding flow** (what happens when the user opens Brainstorm for the first time, or adds a new vault). The vault is the foundational unit of "where my data lives"; onboarding is how a vault comes into existence.

It builds on [12-shell-architecture.md](../shell/12-shell-architecture.md) (persistence layout), [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (identity initialization and recovery), [18-storage-and-search.md](../data/18-storage-and-search.md) (database seeding), and [14-app-store.md](../apps/14-app-store.md) (bundled-app install).

## What a vault is

A **vault** is a single directory on disk that holds one user's data: identity keys, entity database, Yjs documents, attachments, app-private storage, capability ledger, registry, session state, and the dashboard. The whole thing is portable, self-contained, and inspectable.

> **Decision:** the term "vault" follows the conventional usage in local-first knowledge tools. A vault is **the** data root for one user-facing context. Multiple vaults are supported (different vaults for personal/work, different vaults per identity); only one vault is open per shell window.

A vault's directory layout (matches [12-shell-architecture.md](../shell/12-shell-architecture.md)'s persistence layout, framed here as "the vault"):

```
my-vault/                              ← the vault directory; user-chosen path
├── shell/
│   ├── settings.json
│   ├── identity/                      ← sovereign keypair, OS-keychain-backed
│   ├── capabilities.db                (SQLite)
│   ├── registry.db                    (SQLite)
│   ├── session.json                   ← last running apps + window placement
│   └── audit.log
├── apps/                              ← installed apps for THIS vault
│   └── io.example.text-editor/
├── data/
│   ├── ledger.db                      (SQLite, encrypted)
│   ├── registry.db
│   ├── entities.db
│   ├── search.db                      (FTS5 + vector index)
│   ├── docs/                          ← Yjs snapshot+tail files
│   ├── attachments/                   ← content-addressed blobs
│   └── app-private/<app-id>/kv.db
├── logs/
└── vault.json                         ← vault-level metadata (version, name, color, identity-link)
```

> **Decision:** the vault directory is **self-contained**. Everything one user-facing context needs is inside one directory. A backup is `tar`/`zip` of the directory. A restore is extract-and-add-to-registry. A move-between-machines is the same.

> **Decision:** identity is **per-vault** by default. Two vaults on the same machine have two distinct sovereign identities. Linking vaults to a shared identity is an explicit user action (post-v1), useful for "facets of one person" semantics; the default keeps separation strict.

## The vault registry

The **vault registry** is a small file outside any vault, in OS-standard app-config locations:

- macOS: `~/Library/Application Support/Brainstorm/registry.json`
- Windows: `%APPDATA%\Brainstorm\registry.json`
- Linux: `$XDG_CONFIG_HOME/brainstorm/registry.json` (or `~/.config/brainstorm/`)

It records:

```jsonc
{
  "version": 1,
  "vaults": [
    {
      "id": "vlt_01HXK...",                  // local ULID
      "name": "Personal",
      "color": "#7c3aed",
      "icon": "vault",
      "path": "/Users/me/Documents/Brainstorm/Personal",
      "identityFingerprint": "ed25519:abc...",   // for display only
      "lastOpenedAt": 1700000000000,
      "format": "1.0"                        // vault format version
    },
    {
      "id": "vlt_01HXM...",
      "name": "Work",
      "color": "#0ea5e9",
      "path": "/Users/me/Documents/Brainstorm/Work",
      "identityFingerprint": "ed25519:def...",
      "lastOpenedAt": 1699000000000,
      "format": "1.0"
    }
  ],
  "defaultVaultId": "vlt_01HXK..."
}
```

> **Decision:** the registry holds **paths and metadata**, not content. It is recreatable from a scan of likely vault locations if lost. It is the only Brainstorm state that lives outside any vault.

> **Decision:** vault metadata in the registry is duplicated from `vault.json` inside the vault. The registry's copy is for fast enumeration without opening every vault; the in-vault copy is authoritative.

## First-launch flow

When the user opens Brainstorm and the vault registry is empty:

```
   Welcome to Brainstorm
   ─────────────────────────────────────
     ◯  Create a new vault                    ← default
     ◯  Open an existing vault folder
     ◯  Add a vault from another device      (post-v1; covered in 16's pairing flow)
     ◯  Import from another tool             (Markdown / common third-party tools — see Import note below)
   ─────────────────────────────────────
                                  [Continue]
```

### Path A — Create a new vault

1. **Pick a name and location.**
   - Default offered: `~/Documents/Brainstorm/<name>` on each platform.
   - User can pick any directory (file picker), or accept the default.
   - Validation: directory must be writable; if non-empty, must be confirmed.
2. **Initialize the vault directory.** The shell creates the layout above; runs SQLite migrations to current schema; seeds empty `entities.db`, `registry.db`, etc.
3. **Generate identity.** Per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md): generate Ed25519 sovereign identity keypair; store private key in OS keychain (with passphrase fallback per OQ-34); store public key + fingerprint in `vault.json`.
4. **Install bundled apps.** Shell-bundled apps (Text Editor, Code Editor, File Manager, Form Designer, Theme Editor) installed into `apps/`. Capabilities pre-granted at default minimum (per [09-security-and-sandbox.md](../security/09-security-and-sandbox.md)). User is *not* prompted per app on first launch — the shell vouches for its own bundle.
5. **Set defaults.** Theme = Default Light or Default Dark following OS preference; icon pack = Lucide; locale = system default; sync transport = local-only.
6. **Register the vault** in the vault registry; mark as default.
7. **Land on the dashboard.** The wallpaper, an empty icon grid, and a launcher hotkey hint. A first-run welcome card on the dashboard offers a tour and a "Create first note / first folder" affordance.

> **Decision:** first-launch ships **a working, populated vault** — the user can immediately create a note or open the launcher. There is no "now go install some apps" empty state.

### Path B — Open an existing vault folder

1. User picks a directory.
2. Shell reads `vault.json` to determine vault format and identity fingerprint.
3. Validates the format is openable (current shell ≥ vault format).
4. Adds to vault registry; opens.

### Path C — Add a vault from another device

Defers to [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) device-pairing flow (QR code or 6-digit code). Pairing produces a fresh vault on this device that bootstraps from a peer.

### Path D — Import from another tool

Out of scope for v1; tracked separately. Per-tool importers (Markdown folder, page-database zip export, object-graph export) ship as opt-in apps, registered as `intent.import` handlers (per [17-interoperability.md](../platform/17-interoperability.md)).

## Multi-vault behavior

> **Decision:** one vault is open per shell window. Opening another vault = new shell window. Vaults are isolation boundaries: settings, themes, identities, installed apps are per-vault.

Surfaces:

- **Vault switcher** in the shell's main menu / settings: list all registered vaults; click to open. Visually distinguishable by name, color, and icon (registry-stored).
- **Launcher** (`⌘ Space`) shows current-vault content; a search prefix `vault:` lists known vaults to switch to.
- **Each vault has its own "currently open" state** — closing a vault preserves session for next-open.

> **Decision:** a vault cannot be open in two shell windows simultaneously. Locking is per-vault: opening a vault that's already open in another window prompts "switch to that window or open read-only?" — never two writers concurrently.

> **Open:** read-only vault opening — useful for "look at the work vault from my personal session without committing"? Adds complexity; defer to v2 unless real demand. Tracked as OQ-107.

## Vault portability

> **Decision:** vaults are designed to be **portable as a directory**. Brainstorm does not maintain hidden state outside the vault directory and the vault registry; both are recoverable.

What works:
- **Backup**: `tar -czf my-vault.tar.gz my-vault/` is a complete backup.
- **Move between machines**: copy the directory; on the new machine, "Open existing vault" → pick the path.
- **External drive**: vault on a USB drive works; performance bound by drive speed.

What doesn't work cleanly:
- **File-level cloud sync** (Dropbox, iCloud Drive, OneDrive, Google Drive). Yjs binary snapshot+tail files and SQLite WAL files do not survive the kind of partial-file conflict-resolution these services apply. **The shell warns at vault-creation time if the chosen path looks like a synced cloud directory** and recommends Brainstorm's own sync transport instead.

> **Decision:** the warn-on-cloud-sync logic is a UX guard, not a hard block — power users can override after acknowledging the risk. Brainstorm doesn't inspect cloud-sync metadata; the heuristic is path-based (known directory prefixes).

> **Open:** should we ship a "package vault" command that produces a single signed `.brainstorm-vault` archive (different from a raw directory tar) for easier sharing/backup? Tracked as OQ-108.

## Recovery scenarios

| Scenario                                        | Behavior                                                                                              |
|-------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Empty vault (just initialized)                   | Nothing to recover; runs the default-state seeding above.                                              |
| Corrupted SQLite file                            | Storage worker recovery pass: rebuild from Yjs sources where possible (entities, search). Ledger/registry corruption is irrecoverable; user prompted to restore from backup or re-init. |
| Corrupted Yjs file                               | Per-update checksums (per [18-storage-and-search.md](../data/18-storage-and-search.md)) load up to last good update; user warned about possible recent edit loss.                                       |
| Outdated vault (older format than current shell) | Shell runs forward migrations on open; one-shot, irreversible (with backup recommendation prompt before migrating).                                            |
| Newer vault than the shell                       | Refuse to open: "This vault was last opened by a newer Brainstorm. Please update."                    |
| Lost identity (vault directory gone)             | Default vault has identity inside it; gone with the directory. If the user has a consumer account (v2), identity is recoverable from cloud encrypted-backup. v1 = no recovery without backup. |
| Vault registry corrupted                         | Rebuild by scanning standard locations + offering "Add vault" for any known paths. Vaults themselves are intact.                                  |

> **Decision:** recovery operations always **prompt before mutating**. The shell never silently overwrites. If recovery would lose data (e.g., abandoning unflushed Yjs updates), the user sees what's at stake.

> **Note:** the "Lost identity" row above is the failure class that crippled prior sovereign-key products. [51-account-recovery-and-web-auth.md](../security/51-account-recovery-and-web-auth.md) redesigns first-run (non-skippable, risk-acknowledged "Secure your vault"; Recovery Kit instead of a bare phrase) and adds a continuous Recovery Health system so a single-device, no-backup vault is a surfaced alarm rather than a silent default.

## Identity and vault

Each vault has its own sovereign identity by default (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)). Two consequences:

1. **Privacy separation between vaults.** Personal-vault entities and work-vault entities have different DEK keyspaces; even if both use the same hosted relay (when available in v2), the relay cannot correlate them.
2. **Cross-vault sharing requires explicit pubkey exchange** — same model as cross-user sharing in v2. From the encryption layer's perspective, a user's two vaults are two users.

> **Open:** **vault linking** — a user with two vaults wants their identity recognized as "the same person" across both (e.g. for shared contacts list across personal and work). Designed in v2; tracked as OQ-109. v1 keeps vaults strictly independent.

## Vault format versioning

> **Decision:** the vault stores `format: "<major>.<minor>"` in `vault.json`. Forward-only migrations: a newer shell can open an older vault and migrate; an older shell refuses a newer vault. **Same-major future-minor opens via preserve-and-ignore** (`1.5` against a `1.0` reader): the parsed JSON retains its unknown future-minor fields verbatim, the shell ignores what it doesn't understand, the next write keeps the forward-compat keys intact. Only a major bump is wire-incompatible.

Migration is one-shot at open time, with explicit user confirmation. The shell offers "back up before migration?" as an opt-in; default is yes. **Pre-freeze vaults (`< 1.0`)** are refused with `VaultFormatPreFreezeError` — there is no migration path back to 0.x. The undocumented test-only env var `BRAINSTORM_ALLOW_PRE_FREEZE_VAULTS=1` (OQ-215) downgrades the throw to a warn so QA branches with long-lived pre-freeze test vaults stay openable.

> **Open:** how aggressively can the format break across major versions? Tentative leaning: a vault format upgrade is rare (every 1-2 years), the migration always works for the next major, and vaults more than two majors old refuse to open and direct the user to a migration tool. Tracked as OQ-110.

## Freeze surface inventory at 10.8

The 1.0 contract enumerates every persisted shape a future migration is responsible for. Each row is owned by a single code path (column "Owner"); migrations live in `packages/shell/src/main/vault/vault-migrations.ts` and run forward-only at open time.

### 1. `vault.json` fields (v1.0 frozen shape)

The complete set of fields at format 1.0. Required fields: `id`, `name`, `color`, `format`, `createdAt`. The structural validator (`isVaultJson` in `packages/shell/src/main/vault/vault.ts`) accepts the shape below + skips unknown keys (preserve-and-ignore).

### `vault.json` fields (frozen at 10.8)

The full set of fields currently defined on `vault.json`. Format-1.0 freezes this shape at iteration 10.8; new fields between now and 10.8 should be added as optional + tested against `isVaultJson`.

| Field | Type | Since | Required? | Meaning |
|---|---|---|---|---|
| `id` | `string` | 1 | ✓ | Local ULID `vlt_…` |
| `name` | `string` | 1 | ✓ | Human label |
| `color` | `string` | 1 | ✓ | Accent hex |
| `icon` | `string` | 1 | optional | Icon id / emoji |
| `format` | `string` | 1 | ✓ | `<major>.<minor>` |
| `createdAt` | `number` | 1 | ✓ | unix-ms |
| `identityPublicKey` | `string` | 2 | optional | base64 Ed25519 pubkey |
| `identityFingerprint` | `string` | 2 | optional | `ed25519:<16-hex>` |
| `credentialsBackend` | `string` | 2 | optional | `keyring` / `passphrase` / `insecure-dev` |
| `atRestMode` | `string` | 3b | optional | `plaintext` / `encrypted`; stamped on create from driver probe; reconciled on open |
| `syncRelay` | `{url: string, addedAt: number}` | 10.4 | optional | Sync transport target. **Absent ⇒ local-only** (no relay activity, the LoopbackRelayPort is the only implementation that runs). When present, the wire path opens a `WebSocketRelayPort` against `url`; `addedAt` is the unix-ms timestamp recorded when the user paired this vault to the relay. 10.4 only ships the persisted shape — 10.5 (pairing UX) wires it into the active session. The validator rejects empty `url` or non-finite `addedAt`. |

**Indent + newline convention**: `vault.json` is written `JSON.stringify(_, null, 2)` + a trailing `\n`. Atomic mutators (`setSyncRelayConfig`, `rewriteVaultJsonAtRestMode`, the migration runner) preserve unknown forward-compat keys verbatim by parse-mutate-stringify, never field-by-field rewrite.

### 2. SQLite databases — per-DB `_schema_version`

Four domain DBs at `<vault>/data/<name>.db`, each with its own migration list applied inside a transaction by `runMigrations`:

| DB | Path | Schema source | Current version |
|---|---|---|---|
| capabilities | `<vault>/data/ledger.db` | `packages/shell/src/main/storage/ledger-schema.ts` | per its `_schema_version` |
| registry | `<vault>/data/registry.db` | `packages/shell/src/main/storage/registry-schema.ts` | per its `_schema_version` |
| entities | `<vault>/data/entities.db` | `packages/shell/src/main/storage/entities-schema.ts` (`entities`, `links`, `change_log`, `entity_deks`) | per its `_schema_version` |
| search | `<vault>/data/search.db` | `packages/shell/src/main/storage/search-schema.ts` (FTS5) | per its `_schema_version` |

A per-DB schema bump is **not** a vault.json format bump (per OQ-211 — `componentVersions` snapshot manifest rejected as churn-prone; the live DB headers are authoritative).

### 3. Yjs binary files — snapshot+tail with CRC32

Layout `<vault>/data/docs/<3-char-prefix>/<id>.ydoc` (sharded by id prefix). File format owned by `packages/shell/src/main/storage/ydoc-store.ts`:

```
'YDOC' (4B) || u32-LE version=1 || u32-LE snap_len || snapshot
            || (u32-LE update_len, update_bytes, u32-LE crc32(update))*
```

Truncated final tail entry is tolerated on read (`truncatedTail` flag); compaction merges the tail into a fresh snapshot at the 256 KiB threshold.

### 4. Vault-level Y.Docs (fixed ids)

Two reserved doc ids share the same on-disk format as entity docs but are never registered in `entities.db`:

- `brainstorm-Dashboard` — appearance + icons + widgets + handlers; owned by `packages/shell/src/main/dashboard/dashboard-store.ts`.
- `brainstorm-VaultProperties` — `meta.devices` Y.Array of signed add-device records + future vault-level meta; owned by `packages/shell/src/main/vault/vault-properties-store.ts`.

The validate runner's orphan check exempts both ids by filename.

### 5. Sync seq state — `<vault>/sync/seq.json`

Per-`(sender, entityId)` replay-window state owned by `packages/shell/src/main/sync/seq-tracker.ts`:

```jsonc
{
  "version": 1,
  "receive": { "<base64(senderPub)>::<entityId>": { "highest": 42, "bitmapHex": "ff..." } },
  "send":    { "<base64(senderPub)>::<entityId>": 41 }
}
```

Absent file = empty tracker. Malformed JSON = log + empty (the wire path stays available; at worst one window's worth of frames re-replay).

### 6. Attachments

Content-addressed under `<vault>/data/attachments/`. The full content-addressing scheme is owned by Stage 9.10 (Files host service); the freeze references that contract, doesn't redefine it.

### 7. App-private KV

Per-app paths under `<vault>/data/app-private/<app-id>/` (typically `kv.db`). Per **OQ-213** the freeze covers only the path scheme + isolation invariants (one dir per app id; no cross-app KV reads); the per-app KV schema evolves at the app's own pace, not the vault format's.

### 8. Identity + device keypair shapes in the OS keystore

Four account names per vault, all written by `packages/shell/src/main/credentials/` only:

| Account | Bytes | Purpose |
|---|---|---|
| `identity` | 32 (Ed25519 secret) | Sovereign user identity; signs add-device records. |
| `master` | 32 | Vault master key; HKDF parent for at-rest DB keys + entity DEK wraps. |
| `device-x25519` | 32 (X25519 secret) | HPKE wrap recipient for cross-device entity-DEK delivery. |
| `device-ed25519` | 32 (Ed25519 secret) | Per-device signing key (orthogonal to user identity). |

Account naming on the keystore is `<vaultId>::<account>`. Private keys never cross IPC.

### 9. Canonical-JSON ordering (signed add-device records)

`packages/shell/src/main/pairing/devices-store.ts` `canonicalAddDeviceBytes` sorts keys alphabetically + omits `sig` + omits `revokedAt` when absent. Verifiers reconstruct the same byte sequence; a tampered record fails the ed25519 check. `revoke()` does NOT re-sign — the signature proves provenance, revocation is a separate append-only state flag.

### 10. Out of vault-format scope (cross-referenced, not owned)

- **Relay-server audit log** (`packages/relay-server/src/audit-log.ts` → JSONL) — separate process, owned by Stage 10.4 / 10.9 not the vault format.
- **`apps/<app-id>/` bundle layout** — per **OQ-216** owned by Stage 5's `AppInstaller`; the vault freeze references the path scheme, doesn't own a bundle format bump.

## What the vault is **not**

- **Not a workspace** in the cloud-tool sense. It carries no domain meaning. The shell does not know "this is a work vault" beyond the user-set name/color metadata.
- **Not a sync unit.** Sync (per [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md)) is per-entity Yjs docs through transports. The vault is a local container.
- **Not multi-user.** One vault = one user. Multi-user collaboration is per-entity sharing within a vault, or v2's organizations (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)).
- **Not synced via file-level cloud sync.** Use Brainstorm's own transport.

## v1 → v2 phasing

| Capability                                            | v1   | v2  |
|-------------------------------------------------------|------|-----|
| Single-vault default                                  | ✓    | ✓   |
| Multi-vault registry                                  | ✓    | ✓   |
| Per-vault sovereign identity                          | ✓    | ✓   |
| Vault switcher in shell + launcher                    | ✓    | ✓   |
| Vault portability (directory backup/move)             | ✓    | ✓   |
| Cloud-sync-path warning                               | ✓    | ✓   |
| Forward migrations                                    | ✓    | ✓   |
| Vault recovery (corrupted indexes / Yjs files)        | ✓    | ✓   |
| Cross-vault identity linking                          | —    | OQ-109 |
| Read-only vault opening                                | —    | OQ-107 |
| Packaged single-file vault (`.brainstorm-vault`)      | —    | OQ-108 |
| Cloud-mediated vault recovery (consumer account)      | —    | ✓   |
| Org-shared vaults                                     | —    | ✓   |

## Cross-doc references

- **[12-shell-architecture.md](../shell/12-shell-architecture.md)** — the persistence-layout this doc frames as "the vault".
- **[16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)** — identity initialization, device pairing, recovery.
- **[18-storage-and-search.md](../data/18-storage-and-search.md)** — SQLite seeding, schema migrations, search-index init.
- **[14-app-store.md](../apps/14-app-store.md)** — bundled-app install on vault create.
- **[13-frontend-stack.md](../shell/13-frontend-stack.md)** — default theme / icon pack / typography on vault create.
- **[09-security-and-sandbox.md](../security/09-security-and-sandbox.md)** — capability-ledger schema; default-minimum capabilities for bundled apps.
- **File-manager (task #42, future)** — the file manager opens at the vault's root Folder.
- **Linking (task #40, future)** — links resolve within a vault; cross-vault links require pubkey-aware addressing.

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-107** — read-only vault opening for "look at another vault without committing".
- **OQ-108** — packaged single-file vault format for sharing/backup.
- **OQ-109** — cross-vault identity linking (one user, multiple vaults, recognized as same).
- **OQ-110** — vault format break-cadence and migration tool for old vaults.
- **OQ-111** — default vault location per platform (Documents/Brainstorm vs ApplicationSupport vs ~/Brainstorm).
- **OQ-112** — what does "Add vault" enumerate as candidates — scan for existing `vault.json` files in standard locations, or always require manual pick?

## Summary

- A **vault** is a self-contained directory holding one user's data: identity, databases, Yjs docs, attachments, installed apps, settings, audit log.
- Vaults are **portable**: tar/zip = backup; copy = move between machines.
- A small **vault registry** outside any vault tracks known vaults' paths and metadata.
- **First-launch** offers Create / Open / Pair / Import. Create initializes a working vault with bundled apps and lands on a populated dashboard.
- **One vault per shell window**; multi-vault via the registry and a vault switcher.
- **Per-vault sovereign identity by default**; cross-vault linking is v2.
- **No file-level cloud sync** — warn at create time; use Brainstorm's transport instead.
- **Forward-only format migrations**, prompted with backup recommendation.
- v1 ships single-vault default + multi-vault registry + portability + recovery; v2 adds cross-vault linking, packaged vault format, cloud-mediated recovery, org-shared vaults.
