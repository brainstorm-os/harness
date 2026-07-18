# 76 — Mobile companion

**Status: design only.** No development starts on this doc — it exists so that when the mobile track begins, the shape is already decided, the reusable seams are named, and the genuinely open choices are on the ledger (OQ-MOB-1..7). The plan rungs are `MOB-0`–`MOB-8` in [implementation-plan.md §Mobile companion](../implementation-plan.md); nothing in this doc reorders any existing stage.

## What it is (and is not)

[01 §Non-goals](../foundations/01-vision.md) rules out **mobile parity**, and this doc does not walk that back. The mobile product is a **companion**: the desktop shell remains the authoring environment, the app platform, and the place where the vault lives its full life. The companion is the vault **in your pocket** — capture into it, find things in it, act on the small surface of it that is time-sensitive.

Four pillars, in priority order:

1. **Capture** — the reason a companion exists at all. OS share sheet → `Bookmark/v1` (the [58](../apps/58-readable-content-extraction.md) one-captured-page object); quick note; quick task; photo → sealed asset; voice memo → asset. Capture must work in under three seconds, offline, and (see §Capture outbox) without unlocking the vault.
2. **Triage & reference** — search the whole vault ([18 §FTS](../data/18-storage-and-search.md) rebuilt locally over synced entities), open any object read-only, browse collections, check tasks/calendar/journal.
3. **Reminders** — the [39](../apps/39-automations-and-workflows.md) `Reminder/v1` entities firing as local notifications on the device that is actually with the user. This is the single biggest everyday utility gap of desktop-only.
4. **Lightweight editing** — check off a task, edit properties, append to a note, write a journal entry. Full rich-text block editing is deliberately last (§Editor).

**Non-goals for the companion (any version):**

- **The app platform.** No sandboxed third-party apps, no window manager, no dashboard, no capability-brokered renderer fleet. The companion ships first-party surfaces only. (If third-party surfaces ever come to mobile, the [15](../editing/15-embedding-and-composition.md) iframe embed model has a WebView analogue — but that is post-v2 speculation and deliberately not designed here.)
- **Authoring parity.** Graph/Whiteboard/Form-designer stay desktop; on mobile they render as read-only previews at most.
- **A new sync protocol or any server-side change.** The companion is *another paired device* — see §Sync. If a design idea for mobile requires the relay or the durable node to learn something new, the idea is wrong (the one candidate exception, content-free push, is OQ-MOB-4).

## The load-bearing fact: the core is already portable

Everything below the desktop shell's chrome is portable TypeScript with no Electron dependency in its logic:

| Layer | What it is | Mobile fitness |
|---|---|---|
| CRDT | Yjs, doc-per-entity, snapshot+tail ([06](../editing/06-collaboration-yjs.md), [20](../data/20-database-growth-and-sync.md)) | Pure JS. Runs on Hermes as-is. |
| Crypto | `@noble/curves` / `@noble/ciphers` / `@noble/hashes` — Ed25519 identity, X25519/HPKE wraps, per-entity DEKs, versioned member wraps ([16](../security/16-identity-orgs-encryption.md), [73](../security/73-rotate-on-revoke.md)) | Pure JS, audited, zero native deps. Runs anywhere. JSI-native acceleration is the mobile analogue of the desktop NAPI-RS track, later and optional. |
| Wire | The Stage-10 envelope + routing header (`wire.ts`) — already the cross-repo contract `brainstorm-sync` speaks | Deliberately copy-able by design. |
| Sync engine | Pairing protocol, sealed-identity transfer, `LiveSyncEngine`, wrap inboxes, pending-rotation drain | TypeScript over the layers above. |
| Entities | Codecs, property schemas ([19](../data/19-properties-and-schemas.md)), query store, derived-SQLite projection ([20](../data/20-database-growth-and-sync.md) two-layer model) | TypeScript + SQLite. |
| Storage | Runtime-agnostic `sqlite.ts` already picks `bun:sqlite` vs `better-sqlite3` | The pattern extends to a third driver (`op-sqlite`/`expo-sqlite`). |
| Tokens | `@brainstorm/tokens` semantic tokens + themes | Platform-neutral by construction. |

The consequence is the central architecture decision:

> **Decision:** The mobile companion **reuses the vault core, not the shell**. A new extraction seam — working name **`@brainstorm/vault-core`** — packages identity + crypto + wire + sync engine + entity codecs + query store behind three platform adapter interfaces: `SqliteDriver` (third driver beside bun/better-sqlite3), `KeystoreBackend` (beside keyring/passphrase/insecure-dev: iOS Keychain, Android Keystore), and `SocketTransport`. The desktop shell becomes the first consumer of the extracted package; the mobile app is the second. **The extraction lands in the product monorepo and is a prerequisite rung (`MOB-1`), not a mobile-repo copy** — a forked crypto/sync core is a security bug factory.

And its corollary for the client framework:

> **Decision (tentative — OQ-MOB-1 confirms via the `MOB-0` spike):** **React Native + Expo (Hermes).** Fully native Swift/Kotlin would mean reimplementing Yjs and the DEK/wrap crypto per platform, or embedding a JS runtime anyway — both worse than starting from one. A PWA/Capacitor shell is rejected outright: capture needs real share extensions, keystore access, SQLite, and background execution. React (not parity with the desktop React codebase, but the same idiom, tokens, and much shared non-DOM logic) keeps one team able to work both clients.

`MOB-0` is the [10.0-style](../implementation-plan.md) de-risk spike: prove Yjs + `@noble` + the wire protocol on Hermes by pairing a bare RN scaffold against a real desktop shell over the dev relay and syncing a real vault's entities. If Hermes chokes on the crypto or CRDT load, OQ-MOB-1 reopens *before* any product code exists.

## Sync: the companion is device N+1

The entire Stage 10 + `brainstorm-sync` plane is reused unchanged:

- **Pairing.** The desktop side already ships both halves of the 10.5 UX (QR display *and* camera scan). The mobile flow is the natural one: phone scans the QR on the desktop's Settings → Devices screen, SAS confirm on both, sealed identity transfer per 10.5c. The phone appears in the device roster like any other device and is **revocable like any other device** — device-loss response is the existing revoke path plus [73 rotate-on-revoke](../security/73-rotate-on-revoke.md) semantics, nothing new.
- **Transport & durability.** Blind relay + durable node (`SYNC-0`–`SYNC-5`) as-is: the node stores ciphertext, replays `snapshot ++ tail` on subscribe, and neither knows nor cares that a subscriber is a phone.
- **Selective sync is where mobile differs.** A phone should not hold 460 MB of vault. The [20 §selective/incremental sync](../data/20-database-growth-and-sync.md) design becomes load-bearing here rather than optional: the companion syncs **all entity metadata + properties** (search, browse, triage need the full graph) but fetches **bodies lazily on open** and pins a bounded recent/starred working set for offline. Asset bytes are already lazy-by-design in [70](../data/70-encrypted-attachment-sync.md) (chunked, content-addressed, fetch-on-access) — the companion is the client that design was waiting for. Defaults and knobs are OQ-MOB-3.
- **Version skew is a requirement, not an accident.** Store-distributed builds can't be force-updated in lockstep with desktop auto-update. The wire envelope's `v` field and the versioned member-wrap format ([73](../security/73-rotate-on-revoke.md) AAD ordinal) already anticipate this; the companion pins a supported wire-version range and degrades to read-only + "update required" outside it.

## Security model deltas

The [09](../security/09-security-and-sandbox.md)/[16](../security/16-identity-orgs-encryption.md)/[29](../security/29-credentials-storage.md) model carries over; mobile changes the *platform* half:

- **Keystore.** `KeystoreBackend` implementations over iOS Keychain (Secure-Enclave-backed, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` — the key must never ride iCloud keychain sync; the pairing protocol is the only way a device gets identity) and Android Keystore (StrongBox where present). Master key + device Ed25519 key live there; everything else is the existing encrypted-blob tier.
- **Biometrics gate, never custody.** FaceID/fingerprint is a *local authorization gate* in front of the platform keystore — a convenience unlock in the [51 Key Custody Ladder](../security/51-account-recovery-and-web-auth.md) sense. Losing biometrics must degrade to the vault passphrase; biometrics never become a recovery path.
- **App-lock parity.** The 13.8 lock surface maps to mobile idioms: lock on background, blur the app-switcher snapshot, `FLAG_SECURE`-equivalent screenshot policy as a setting.
- **No app sandbox to enforce.** With first-party surfaces only, there is no capability broker on-device in v1 — the companion process is trusted the way the desktop *shell* (not an app) is trusted. The moment third-party anything appears, this clause is void and the broker comes with it. The `vault-core` API surface should still be shaped like the service layer (methods, not raw DB handles) so that a future broker slots in front of it rather than requiring a rewrite.

### Capture outbox (write-without-unlock)

Share-sheet capture must not require passphrase/biometric unlock — friction kills capture. But extensions also must not hold the master key.

> **Decision (tentative — OQ-MOB-7):** captures from a locked context are sealed **write-only** into an **outbox**: the payload is HPKE-sealed to a vault-scoped X25519 public key (derivable/storable without the master key), queued on disk, and drained into real entities the next time the app runs unlocked. The extension can write and never read — losing the phone leaks no outbox plaintext, and the extension binary needs no keystore entitlement beyond the public key.

## Notifications

**v1 is local-only and offline-correct:** `Reminder/v1` entities sync to the device like everything else; a portable port of the shell-side scheduler core (incl. the 0.3.1 `onMissed: FireOnce` watermark semantics) computes and registers **local** notifications. No server knows a reminder exists. iOS/Android background-execution limits mean a long-dead app can miss re-registration windows — acceptable for v1 and honest about it.

**Push is deliberately deferred (OQ-MOB-4).** The only design compatible with the zero-knowledge plane is a **content-free sync tickle** ("something changed for account X — wake and sync") emitted by the durable node through APNs/FCM. Even that leaks activity timing/frequency to Apple/Google and adds the first mobile-specific server surface, so it waits until local-only demonstrably isn't enough.

## UI

The companion is **not** the desktop OS metaphor shrunk. No windows, no dashboard, no launcher. It is a native-idiom mobile app:

- **Scaffold:** tab bar — Home (recents + pinned + today's tasks/events), Search, Capture (center action), Inbox (reminders/notifications/shared-with-me later), Vault (browse by collection/type).
- **Object screen:** one stacked-layout ([27 §stacked](../shell/27-layouts.md)) scroll: cover ([50](../foundations/50-object-covers.md)) → icon+title ([39](../foundations/39-universal-icons.md)) → properties → body (read-only rendering first, §Editor) → backlinks. One screen renders *every* entity type — the mobile expression of "apps are collection views" ([21](../data/21-objects-and-collections.md)): type-specific surfaces (Tasks list, Journal timeline, Calendar agenda) are curated collection views over the same object screen, not per-type codebases.
- **Theming:** `@brainstorm/tokens` themes as-is; the user's theme choice syncs (it's an entity).
- **i18n:** the FormatJS/ICU catalog pipeline from 12.1 reuses; mobile strings are one more catalog.

### Editor (OQ-MOB-2)

Lexical is DOM-bound; there is no native Lexical. Options: **(a)** WebView hosting the real `@brainstorm/editor` bound to the same Y.Doc — full fidelity, one editor codebase, but a WebView bridge with keyboard/scroll/IME seams; **(b)** native **read-only** block renderer (blocks → native views) + append-only capture composer — fast, robust, no editing parity; **(c)** a native rich editor — rejected, it re-implements the block model and forks document semantics forever.

> **Tentative leaning:** **(b) ships first** (read-only bodies + append/quick-edit covers pillars 1–3), **(a) follows behind it** for full block editing (`MOB-7`). CRDT convergence makes the split safe — appends from mobile and edits from desktop merge without conflict, and "the phone renders read-only" is honest UX while WebView editing hardens.

## Repo & team shape (OQ-MOB-5)

> **Tentative leaning:** the **portable core lives in the product monorepo** (`packages/vault-core` next to `tokens`/`sdk` — it must move in lockstep with the shell that writes the data, and its tests run against the same fixtures); the **mobile app is a sibling repo** (`brainstorm-mobile`, like `../brainstorm-sync`) with its own RN/Expo toolchain — Metro/Xcode/Gradle must not enter the shell workspace (the root-deps layering rule, applied at repo scale). The app consumes `vault-core` pinned by commit/version; skew between them is caught by `MOB-0`'s pairing test run in the mobile repo's CI against a shell build.

This also makes the mobile track **organizationally parallel**: it has its own owner, its own serial spine (`MOB-0 → MOB-3`), and does not consume a Phase-2 app slot or violate the serial-ordering policy — the only coupling into the product repo is the `MOB-1` core extraction (which needs an integrator-reviewed shell PR) and any bug it flushes out of the shared core.

## Distribution

App Store + Play Store: standard signing, review, and the usual crypto-export self-classification (mass-market exemption). Beta via TestFlight / Play internal track. Two consequences worth designing for now: **review latency** means the companion must tolerate being weeks behind desktop (see version-skew above), and **store policy** means no self-update and no dynamic code delivery beyond what Expo OTA updates legitimately allow for JS.

## Open questions

Mirrored in [11-open-questions.md §Mobile companion](../reference/11-open-questions.md):

- **OQ-MOB-1** — client framework: confirm RN/Expo/Hermes via the `MOB-0` spike (blocks everything).
- **OQ-MOB-2** — editor strategy: native read-only + append vs WebView Lexical ordering (blocks `MOB-4`/`MOB-7`).
- **OQ-MOB-3** — selective-sync defaults: what syncs eagerly, what pins, what evicts.
- **OQ-MOB-4** — push plane: local-only until when; content-free tickle design if ever.
- **OQ-MOB-5** — repo home + core-extraction mechanics.
- **OQ-MOB-6** — store/compliance constraints that could bite the crypto or OTA-update story.
- **OQ-MOB-7** — capture-outbox sealing details (key derivation, extension storage, drain semantics).
