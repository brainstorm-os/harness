# 51 — Account recovery and web-style authentication

This doc confronts a specific, well-documented failure class from a prior local-first knowledge product (sovereign-key model, BIP39-style recovery phrase, end-to-end encryption): **users could not recover their data, repeatedly asked for a password they could log in with instead of a phrase, and management pushed for Web-2.0 authentication methods (email/password, Google/Apple/GitHub, magic links, SSO).** The pure-sovereign answer to all three was effectively "that is cryptographically impossible," which is *true* and *unshippable as a product answer*.

This doc does not relitigate end-to-end encryption (E2E). It accepts the [16-identity-orgs-encryption.md](16-identity-orgs-encryption.md) model and asks a narrower question: **given that model, how much of the Web-2.0 login/recovery experience can we honestly deliver, and how do we stop the recovery disaster?** It refines the recovery sections of [16](16-identity-orgs-encryption.md), [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md), and [29-credentials-storage.md](29-credentials-storage.md). It does **not** change 16's phasing table (v1 = sovereign + multi-device; accounts/orgs = v2).

## The three problems, named precisely

| # | What users hit | Why the sovereign model produced it |
|---|----------------|--------------------------------------|
| P1 | "I lost my recovery phrase / never really saved it / saved it wrong → my data is gone." | The phrase was the *single* lifeline, handed over once, never re-verified, with no second factor and no proactive health check. Crypto-grade key custody was delegated to non-technical users with no safety net. |
| P2 | "Just let me log in with a password like every other app." | Users conflate **a memorable secret they type to unlock** with **a server-checked credential that can be reset**. A 12/24-word seed is neither — it is the encryption root rendered as words. The product never offered the thing they were actually asking for (a passphrase) as a first-class unlock. |
| P3 | "Add Google / email / SSO sign-in." (growth + enterprise pressure) | Web-2.0 auth presumes a server that holds or can reset the credential. E2E presumes the server holds nothing decryptable. Bolting OAuth on naively either does nothing useful or silently breaks E2E. |

The root cause under all three: **the recovery phrase is overloaded.** It is simultaneously the authenticator ("who are you") and the key custodian ("the secret that decrypts content"). Every Web-2.0 expectation is about the first; E2E's hard constraint is about the second. Fixing this means *splitting the two concepts apart in the product model* — which Brainstorm's architecture already does internally (device key vs. sovereign key vs. consumer account vs. vault master key vs. recovery passphrase) but has never surfaced as a coherent user-facing model.

## The reframe: authentication ≠ key custody

> **Decision:** Brainstorm models two independent axes and never lets a UI imply they are one thing.
>
> - **Authentication** — proving who you are *to a service* (relay, hosted backup, org). Web-2.0 methods live entirely here. Authentication never, by itself, decrypts content.
> - **Key custody** — who is able to produce the secret that decrypts your E2E content. This is a ladder of explicit trade-offs, from "only you, on this device" to "a provider can reconstruct it (and therefore can read your content)."

The honesty rule that follows, and that the prior product violated by omission:

> **Decision (the honesty rule):** at every point where a user picks a recovery or sign-in method, the UI states *in plain language* both (1) whether they can self-serve recover without a remembered secret, and (2) whether any party other than them can read their content as a consequence. There is no method that gives painless reset *and* keeps content unreadable by the provider — the cryptography forbids it. We surface that trade-off; we never paper over it. A user is never left believing they have a safety net they do not have.

## The Key Custody Ladder

Every vault sits on exactly one effective rung — the *strongest* recovery path currently provisioned. Higher rungs are additive; provisioning one never removes a lower one.

| Rung | Name | Who can produce the decryption secret | Self-serve reset? | Can a non-user read content? | Default? |
|------|------|----------------------------------------|-------------------|------------------------------|----------|
| 0 | **Device-only** | This device's OS keystore, nothing else | No — lose the device, lose the data | No | The *unprovisioned* state. Never a resting place. |
| 1 | **Self-custodied factors** | You, via Recovery Kit file **or** recovery passphrase **or** another paired device | No (no third party), but multiple independent lifelines | No | **Recommended sovereign default (v1).** |
| 2 | **Social / threshold recovery** | M-of-N guardians (your other devices, trusted contacts' pubkeys, a printed shard) reconstruct it | Yes, via your guardians; survives forgetting any single factor | No (no single guardian can; threshold required) | Opt-in (v1.x). |
| 3 | **Provider-assisted (consumer account)** | You, via account passphrase, after Web-2.0 auth unlocks the *encrypted* cloud backup | Partial — only if you remember the account passphrase | No (server stores ciphertext only) | Opt-in (v2). |
| 4 | **Escrowed / managed** | A provider or organization KMS can reconstruct the key | Yes — true "forgot everything → reset" | **Yes** — that party can decrypt your content | Org-managed identities only, or a loud explicit consumer opt-in (v2). Never silent, never default. |

Rung 0 is the prior product's de-facto resting state for most users (a phrase shown once and never integrated counts as "no factor I can actually use"). **Brainstorm treats Rung 0 as an alarm state, not a configuration.**

### Why each Web-2.0 ask maps to a specific rung

- **"Password login"** → Rung 1's *recovery passphrase*, promoted (see §"The passphrase people actually wanted"). This is what P2 was really asking for.
- **"Reset my password" (self-serve, remembers nothing)** → only Rung 4. Honestly impossible below it: there is no server-held secret to reset. We say so, and offer Rung 2 (social) as the no-escrow way to survive a forgotten secret.
- **Google / Apple / GitHub / magic link** → Rung 3 *authenticators*. They unlock access to the encrypted backup blob; they do **not** decrypt it. Decryption still needs the account passphrase (or a Rung 2 factor). OAuth-alone-decrypts is exactly the silent-E2E-break we refuse.
- **Enterprise SSO / SCIM** → Rung 4, and *only* for **organization** identity, where the org is already the trust authority and server-readable spaces ([16 §Server-readable spaces](16-identity-orgs-encryption.md)) are an established, surfaced concept. SSO authenticates the human; the org KMS escrows the org keys. Acceptable because the org — not Brainstorm — holds that power, and the user is told.
- **Passkey / WebAuthn** → straddles both axes (see §"Passkeys").

## The passphrase people actually wanted (P2)

[29-credentials-storage.md](29-credentials-storage.md) already defines an Argon2id-derived key that wraps the vault master key, but frames it narrowly as a *fallback for Linux boxes with no keyring*. This doc promotes it:

> **Decision:** the **vault passphrase** is a first-class, optional unlock method on **every** platform, not a no-keyring fallback. When set, it Argon2id-derives a key that wraps the identity + master key (the wrapped form lives in the vault dir, readable before the master key is available — per 29). It is a Rung-1 custody factor *and* the daily unlock secret if the user wants "type a password to open my vault." When a v2 consumer account exists, the **same passphrase** doubles as the account passphrase that decrypts the cloud backup — one concept the user learns once, two roles.

This is the single highest-leverage fix for P2 and it ships in v1 with **no server**. It is not a login against a server; it is a local unlock. The UI says exactly that ("This passphrase unlocks this vault on this device. It is not sent anywhere and cannot be reset by us.") so users do not re-import the false "someone can reset it" mental model.

> **Open (OQ-AR-6):** is the vault passphrase, when set, *required at every vault open* (true "password to log in") or *only* on a new device / after OS-keystore loss (keystore is primary, passphrase is recovery)? Trade-off: muscle-memory familiarity + phishing-resistance vs. friction on the happy path. Likely a per-vault user choice with a sane default.

## Recovery Kit instead of a bare phrase (P1)

> **Decision:** onboarding never leads with a raw word list on screen 1. The primary recovery artifact is a **Recovery Kit**: a single downloadable/printable file containing (a) the wrapped key material, (b) a human-readable QR, (c) plain instructions, and (d) the BIP39-style word list *as one element inside it*, for transcribability and cross-tool interop — not as the headline. Power users can still export the bare phrase from Settings; it is an advanced affordance, not the gate.

The phrase as the sole, naked, copy-this-down-now artifact is the proximate cause of P1. Wrapping it in a Kit with instructions and an alternative (passphrase) changes the failure rate without abandoning the underlying standard.

## Recovery Health — the proactive system (the real P1 fix)

The prior product's deepest mistake was **passivity**: it handed over a phrase once and never asked again. Brainstorm runs a continuous evaluation.

> **Decision:** the shell computes a **Recovery Health** state for the open vault and surfaces it in the dashboard system area and in Settings → Security (per [25-settings.md](../shell/25-settings.md)):
>
> - **At risk** (Rung 0): one device, no Kit saved, no passphrase. Loud, persistent, non-dismissible-without-acknowledgement banner. This is the state the prior product left millions of users in silently.
> - **Basic** (one Rung-1 factor): a single lifeline exists.
> - **Good** (≥2 independent Rung-1 factors, e.g. Kit + passphrase, or passphrase + second device).
> - **Strong** (Rung 2+, or Rung 1 with a verified off-device Kit).
>
> The shell **nudges toward ≥2 independent factors** and periodically runs a **recovery drill** — asks the user to actually produce their Kit / re-enter their passphrase (like 2FA backup-code re-verification), so "I saved it" is tested before it is needed, not after.

> **Open (OQ-AR-5):** recovery-drill cadence and intrusiveness — fixed interval, post-N-sessions, risk-weighted by data volume/value, or only on material change (new device, factor removed)? Must reduce P1 without becoming dismissed-on-sight noise.

## Onboarding redesign

> **Decision:** the "Secure your vault" step is part of first-run, immediately after vault creation, and is **not skippable without an explicit, typed/checked risk acknowledgement** ("I understand that if I lose this device, my data cannot be recovered by anyone, including Brainstorm."). It offers the *easiest sufficient* factor first: v1 → set a vault passphrase + download the Recovery Kit; v2 → "Use a Brainstorm account" (email/OAuth) as a one-tap path to Rung 3. The scary 24-word screen is replaced by the Kit and the passphrase; the word list is inside the Kit.

This keeps the account-less floor ([16 Principle 1](16-identity-orgs-encryption.md)) — you can still acknowledge the risk and run Rung 0 — but the dangerous default now requires a deliberate, informed choice rather than being where inattentive users silently land.

## Web-2.0 authentication, concretely (v2, P3)

When consumer accounts arrive (v2 per 16), the **account service authenticates with standard Web-2.0 methods** because authentication is decoupled from custody:

- **Email + password**, **Google / Apple / GitHub OAuth**, **magic link**, **passkey** — any of these proves identity to the account service and grants access to *fetch the user's encrypted key backup blob* and use hosted relay/storage.
- The blob is sealed under the **account passphrase** (= the vault passphrase). The account server stores ciphertext and cannot decrypt it. This preserves E2E while delivering the *login experience* users asked for.
- Self-serve "I forgot everything" reset is offered **only** if the user explicitly opted into Rung 4 escrow, with the §honesty-rule disclosure shown at opt-in and re-shown in Security settings ("Brainstorm can reset your access, which means Brainstorm can read your content."). Otherwise, account-auth recovers your *access to the blob*, and a Rung-1/2 factor (passphrase or guardians) is still required to decrypt it — stated up front so no one expects an impossible reset.

### Passkeys

Passkeys (WebAuthn) are notable because they touch both axes: a passkey is an excellent *authenticator*, and via the WebAuthn **PRF extension** it can deterministically derive a stable secret usable as a *Rung-1/3 custody factor* — a phishing-resistant, hardware-backed thing the user already understands ("Face ID / security key to open my vault"). This is the closest Web-2.0-native primitive to "password login without a phrase" that does not weaken E2E.

> **Open (OQ-AR-4):** make passkey-PRF a first-class custody factor, or authentication-only? PRF support is uneven across authenticators/OSes; a passkey that authenticates but cannot derive a key is a footgun if the user believes it protects their data. Gate on PRF capability detection and disclose precisely.

### Enterprise SSO / SCIM

SSO/SCIM is **org-identity only** and inherently Rung 4: the org KMS escrows org keys; the IdP authenticates the human. This is consistent with [16 §Server-readable spaces](16-identity-orgs-encryption.md) — the org is the trust authority and the posture is surfaced. Personal sovereign identity is never SSO-gated; joining an org never escrows personal entities (per [16 §Joining an organization](16-identity-orgs-encryption.md)).

## What we explicitly refuse

- **Silent escrow.** No "sign in with Google" that quietly uploads a server-decryptable key. Rung 4 is always an explicit, disclosed choice or an org policy the user is told about.
- **Implying reset where there is none.** No "Forgot password?" link that, below Rung 4, can only ever say "we cannot help you." If a path cannot recover, the UI says so *before* the user relies on it.
- **A second, weaker crypto path for convenience.** One encryption model (16). Web-2.0 methods are authenticators and backup-access gates layered on it, never an alternate decryption route.
- **Removing the account-less floor.** Rung 0/1 with no server remains fully supported forever ([43-monetisation-strategy.md](../platform/43-monetisation-strategy.md): account never required).

## Phasing

| Capability | v1 | v2 |
|------------|----|----|
| Authentication ≠ custody model (product-facing) | ✓ | ✓ |
| Vault passphrase as first-class unlock (all platforms) | ✓ | ✓ |
| Recovery Kit (replaces bare-phrase onboarding) | ✓ | ✓ |
| Recovery Health states + nudges | ✓ | ✓ |
| Recovery drills | ✓ | ✓ |
| Non-skippable "Secure your vault" w/ risk ack | ✓ | ✓ |
| Multi-device as a Rung-1 factor | ✓ | ✓ |
| Social / threshold recovery (Rung 2) | v1.x (design in v1) | ✓ |
| Consumer account: email/password/OAuth/magic-link auth (Rung 3) | — | ✓ |
| Cloud encrypted key backup under account passphrase | — | ✓ |
| Passkey authentication | — | ✓ |
| Passkey-PRF as custody factor | — | OQ-AR-4 |
| Org SSO / SCIM (Rung 4, org identity) | — | ✓ |
| Explicit consumer escrow opt-in (Rung 4) | — | OQ-AR-7 |

v1 substantially defuses P1 and P2 **with no server at all** (passphrase + Kit + Recovery Health + onboarding). P3's Web-2.0 surface is genuinely a v2 concern and is delivered as an authentication layer over the unchanged 16 encryption model.

## Open questions

Added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-AR-1** — Social/threshold recovery scheme: Shamir over the master key vs. per-guardian wraps + M-of-N policy record; guardian set = own devices only, or trusted contacts' pubkeys, or both; how revocation of a guardian works.
- **OQ-AR-2** — Recovery Kit file format: is it a `.bsbundle`-adjacent signed file, a plain printable PDF+QR, or both; does it embed the BIP39 list verbatim or a wrapped variant; cross-tool interop expectations.
- **OQ-AR-3** — Argon2id parameters for the vault/account passphrase (supersedes/merges with OQ-114); single profile vs. device-class-tuned; rewrap-on-parameter-upgrade flow.
- **OQ-AR-4** — Passkey-PRF as a custody factor vs. authentication-only; PRF capability detection and disclosure.
- **OQ-AR-5** — Recovery-drill cadence and intrusiveness model.
- **OQ-AR-6** — Vault passphrase required every open vs. new-device/recovery-only; per-vault choice and default.
- **OQ-AR-7** — Consumer-side Rung-4 escrow: do we offer it to individuals at all, or restrict escrow strictly to org identities? If offered, the exact disclosure copy and re-confirmation cadence.

## Cross-doc references

- [16-identity-orgs-encryption.md](16-identity-orgs-encryption.md) — the encryption/identity model this layers on; phasing table unchanged.
- [29-credentials-storage.md](29-credentials-storage.md) — passphrase wrap mechanics, OS-keystore loss scenarios, the recovery-passphrase row this promotes.
- [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md) — first-run flow this redesigns; recovery-scenario table this strengthens.
- [09-security-and-sandbox.md](09-security-and-sandbox.md) — threat model the honesty rule is scoped against.
- [25-settings.md](../shell/25-settings.md) — Settings → Security surfaces (Recovery Health, factors, drills).
- [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md) — account-never-required commitment the floor protects.

## Summary

- The recovery disaster, the "give me a password" demand, and the Web-2.0 pressure are three faces of one root cause: the recovery phrase was both the **authenticator** and the **key custodian**.
- Brainstorm splits those axes in the product model. Authentication carries all Web-2.0 methods; key custody is an explicit **ladder** (device-only → self-custodied → social → provider-assisted → escrowed) with the reset/readability trade-off surfaced at every choice (the **honesty rule**).
- P2 is fixed in v1, server-free: the vault **passphrase** becomes a first-class unlock everywhere.
- P1 is fixed in v1, server-free: **Recovery Kit** replaces the bare phrase, plus a continuous **Recovery Health** system with nudges and drills, plus a non-skippable, risk-acknowledged "Secure your vault" onboarding step. Rung 0 becomes an alarm, not a silent default.
- P3 is delivered in v2 as an **authentication layer** (email/password, OAuth, magic link, passkey, org SSO/SCIM) over the *unchanged* 16 encryption model — never a second crypto path, never silent escrow, never implied reset where none exists.
