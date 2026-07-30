# 11 — Open questions

Unresolved design points called out inline in the other docs. Each entry is one decision to make; many are blocking enough that we should have a position on them before any implementation phase.

Format:
- **OQ-N** — short title.
  - **Where it appears:** which docs raise it.
  - **Question:** the choice to make.
  - **Options & trade-offs:** what we have to weigh.
  - **Tentative leaning (if any):** non-binding.
  - **Blocking?:** whether it must be answered before implementation.

---

### Vision

#### OQ-1 — Multi-user collaboration in v1?  *[RESOLVED in 16]*
- **Where:** [01-vision.md](../foundations/01-vision.md) (non-goals).
- **Resolution:** (a) — sovereign + multi-device only in v1; multi-user / consumer-account / org features in v2. Designed in [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) phasing table. The encryption + identity architecture is in place to enable v2 without rework.

---

### App model

#### OQ-2 — Inline schema vs. URL reference for entity types in manifests  *[RESOLVED in implementation-plan Stage 5]*
- **Where:** [03-app-model.md](../apps/03-app-model.md), [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).
- **Question:** Does an app's manifest carry the JSON Schema for the entity types it introduces, or only their URLs (resolved later)?
- **Resolution (v1):** **(c) hybrid**. Manifests reference the entity-type schema by canonical URL (Block-Protocol-style versioned URL — the identity) and **may inline** the schema as a convenience for offline install. The URL is authoritative; inline is a copy. The `registry.db.entity_types` row carries both fields (`schema_url` required, `schema_inline` optional) so the resolver consults the inline copy first and only network-fetches when missing. This preserves BP alignment while keeping install offline-friendly.

#### OQ-3 — Orphaned entity-type registrations after uninstall  *[RESOLVED in implementation-plan Stage 5]*
- **Where:** [03-app-model.md](../apps/03-app-model.md).
- **Question:** When the only app that registered entity type T is uninstalled, what happens to T?
- **Resolution (v1):** **(a) orphaned-but-resolvable**. On uninstall, the `entity_types` row's `orphaned` column flips to `1` (the column already exists in the Stage 3.4 schema). Existing entities of that type keep rendering via the fallback renderer (using the inline schema where available). Re-installing the same app id flips `orphaned` back to `0` and re-claims the type, with all linked entities intact. Cross-app type re-claims (a different app id introducing the same type URL) are NOT permitted in v1 — that's a Stage 5b OQ if it comes up in practice.

#### OQ-4 — One renderer process per window or per app  *[RESOLVED in implementation-plan Stage 5]*
- **Where:** [03-app-model.md](../apps/03-app-model.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** When an app has multiple windows, do they share one renderer process or each get their own?
- **Resolution (v1):** **(b) per-app shared renderer**. All windows of the same app share one renderer process; cross-app isolation is the security boundary. The renderer-identity registry maps `WebContents.id → appId` per window, so multiple WebContents-es for one app all resolve to the same identity at the broker. Revisit with profiling if intra-app contention shows up in real workloads.

---

### Shell

#### OQ-5 — Native vs. custom window chrome  *[RESOLVED in implementation-plan Stage 6]*
- **Where:** [04-shell.md](../shell/04-shell.md).
- **Question:** Does Brainstorm draw its own titlebar/window chrome (consistent across apps) or use platform-native chrome?
- **Resolution (v1):** **(c) native default, opt-in custom**. The shell uses platform-native chrome by default via Electron's per-platform `titleBarStyle`: `hiddenInset` on macOS (traffic lights stay native; we draw inside the inset), `hidden + titleBarOverlay` on Windows/Linux (window controls stay native). Apps may opt into fully custom chrome in v2 via a future `chromeMode` manifest field. The current behavior shipped in Stage 0 (`packages/shell/src/main/index.ts` → `chromeOptions()`) already implements this.

#### OQ-6 — Widget process model  *[RESOLVED in implementation-plan Stage 7.3]*
- **Where:** [04-shell.md](../shell/04-shell.md).
- **Question:** Are widgets the same renderer as the parent app (in widget-mode), or a separate lighter renderer?
- **Options:**
  - (a) Same renderer — fast launch, simpler state sharing with the parent app.
  - (b) Separate widget renderers — better isolation; pause/resume cleanly via process suspension.
- **Resolution (v1): (a)** — a widget reuses its parent **app's own bundle**, rendered in *widget-mode* (launch reason `widget`, the SDK `@brainstorm/sdk/widget` bootstrap picks which registered widget to mount). Each placed widget is its **own broker-scoped `WebContentsView`** overlaid on the dashboard window — NOT a shared WebContents (so one widget crashing can't take siblings down) and NOT a DOM iframe in the privileged dashboard renderer (that would breach cross-app isolation). Because the surface is a native view, not DOM, **pause is host-driven**: the dashboard renderer computes which widget rects are within the scrolled viewport and the main-process host toggles `setVisible(false)` + sends a `widget:visibility` pause signal — there is no DOM `IntersectionObserver` on a native view. Separate-process-per-widget suspension (option b) is deferred; v1's host-driven pause is sufficient.
- **Blocking?:** No.

---

### Data & Block Protocol

#### OQ-7 — URL resolution for entity types  *[RESOLVED in implementation-plan Stage 9.3]*
- **Where:** [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).
- **Question:** How do entity-type URLs (e.g. `io.example/Note/v1`) actually resolve? They aren't fetchable URLs by default.
- **Options:**
  - (a) Reverse-DNS-only naming, schemas always come from app bundles. Never fetched.
  - (b) `https://`-prefixed URLs that *are* fetchable, cached locally on first reference.
  - (c) A registry service hosted by Brainstorm that indexes well-known types.
- **Resolution:** **(a) — reverse-DNS-only type ids; schemas come from app bundles, never fetched.** Confirmed at the tentative leaning when the entities service landed (9.3.1). This is already the codebase's de-facto model: entity-type ids are opaque reverse-DNS strings (`io.brainstorm.notes/Note/v1`, `brainstorm/Task/v1`), the `entity_types` registry row stores `schema_url` (canonical id, **never dereferenced**) plus an optional inlined `schema_inline` from the app manifest (per OQ-2 hybrid), and the entities service treats `type` as an opaque capability-scope + index key — it does no network resolution and no schema validation against a fetched document. `https://`-fetchable types (option b) remain a post-v1 cross-organisation-interop consideration; a hosted registry (c) is out of scope. The entities service stores and queries `type` as a plain string and never resolves it.
- **Blocking?:** Was yes — blocked Stage 9.3 (entities service: how `type` is interpreted by the registry + capability scoping). Resolved at the tentative leaning during 9.3.1.

#### OQ-8 — Block frame embedding host  *[RESOLVED in 15]*
- **Where:** [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).
- **Question:** When app A embeds a block from app B, does the block frame live in A's renderer (iframe) or in B's renderer (frame mounted by the shell)?
- **Resolution:** (a) — iframe inside A's renderer pointing at B's block bundle. Cross-origin sandbox preserves the security boundary; layout and focus stay simple. Decision recorded in [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md).

---

### Yjs / collaboration

#### OQ-9 — Renderer-side replica fullness  *[RESOLVED in 06]*
- **Where:** [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).
- **Resolution:** (a) — full Y.Doc replica per renderer. Standard Yjs model; small per doc; reliable offline-from-canonical behavior if IPC stalls. Recorded as a Decision in 06.

#### OQ-10 — Device pairing UX  *[RESOLVED in implementation-plan Stage 10.0]*
- **Where:** [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).
- **Resolution (2026-05-20, forced by 10.0 spike):** **(a) QR primary, (b) numeric-code SAS fallback. No recovery without user-held offline backup or a v2 consumer account.** The QR payload carries `(userEd25519PubKey, userEd25519Secret, relayURL, newDeviceChallenge)` from already-paired → new and `(newDevicePub, newDeviceX25519Pub)` back; the spike's `ClientOptions.userEd25519` slot is that payload. The 6-digit code path cannot carry 32 bytes of entropy, so it's an authenticated DH with SAS — both devices display matching 6 digits derived from the channel transcript, user confirms before the user key crosses. Loss of the user-Ed25519 secret = no more new devices = ultimately data loss as old devices die; surfaced in onboarding, not pretended away.

---

### Editing / Lexical

#### OQ-11 — `brainstorm-editor` shipping mode
- **Where:** [07-editing-lexical.md](../editing/07-editing-lexical.md).
- **Question:** Is the shared editor library bundled per-app, or loaded from the shell at runtime?
- **Options:**
  - (a) Per-app bundle. Each app pins a version; no surprise upgrades.
  - (b) Shell-provided. Single point of upgrade; one bug fixes everywhere.
  - (c) Hybrid: shell provides default; apps may bundle their own pinned version if they need to.
- **Tentative leaning:** (a) — simplest, predictable. Revisit when a real upgrade pain emerges.
- **Blocking?:** No — can be changed later.

#### OQ-12 — One registry or two: blocks vs. custom Lexical nodes  *[RESOLVED in 15]*
- **Where:** [07-editing-lexical.md](../editing/07-editing-lexical.md).
- **Question:** Are custom Lexical nodes (e.g. an `EntityChipNode`) a separate registry from Block Protocol blocks, or unified?
- **Resolution:** (a) — two registries. Different rendering, serialization, and lifecycle expectations. The bridge between the two layers is `BlockEmbedNode`. Decision recorded in [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md).

---

### SDK

#### OQ-13 — Typed npm package alongside the runtime global
- **Where:** [08-app-sdk.md](../apps/08-app-sdk.md).
- **Question:** Do we publish a typed-only npm package (`@brainstorm/sdk-types`) for app developers' DX?
- **Options:**
  - (a) Yes — types in npm, runtime injected at preload.
  - (b) No — types embedded with the shell; developers `.d.ts`-include from the shell distribution.
- **Tentative leaning:** (a). Standard DX expectation.
- **Blocking?:** No — packaging detail.

---

### Security

#### OQ-14 — Auto-update vs. always-prompt
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** Are app updates auto-installed (subject to constraints) or always user-prompted?
- **Options:**
  - (a) Always prompted. Trust-root principle holds maximally.
  - (b) Auto-update for capability-stable updates; prompt only on capability changes.
  - (c) User-configurable per app.
- **Tentative leaning:** (b) with (c) overrides.
- **Blocking?:** No — initial behavior can be (a), with (b)/(c) added later.

#### OQ-15 — End-to-end encryption in v1  *[RESOLVED in 16]*
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Resolution:** (a) — full E2E in v1. Per-entity DEKs, member key wraps, blind relay. Designed in [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md). The wire format is final and ships from v1.

#### OQ-16 — Folder-watch capability
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** Do we expose a "watch this folder for changes" capability beyond per-file handles?
- **Options:**
  - (a) Yes, behind a high-prompt capability. Required for things like a "recent screenshots" widget.
  - (b) No. Apps can ask the user to grant individual files; no folder-level introspection.
- **Tentative leaning:** (a) but heavily prompted; alternatively a shell-mediated "drop folder" the user explicitly maintains.
- **Blocking?:** No.

#### OQ-17 — Sync endpoint configuration scope  *[RESOLVED in 16]*
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Resolution:** (b) — per-pairing-set / per-account. Consumer accounts and orgs hold relay endpoints; pairing propagates the configuration. Recorded in [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

---

### Shell architecture (added in 12)

#### OQ-18 — Canonical Yjs runtime location  *[RESOLVED in implementation-plan Stage 3]*
- **Where:** [12-shell-architecture.md](../shell/12-shell-architecture.md).
- **Question:** Does the canonical Y.Doc for each open entity live in the **main process** or in a dedicated **yjs worker process**?
- **Resolution (v1):** **(b) — dedicated `yjs` worker process.** The shell's perf budgets (per [12 §Performance budgets](../shell/12-shell-architecture.md)) demand the main loop stay free under heavy concurrent editing. Yjs CRDT operations + Lexical sync are CPU-bound and grow linearly with active document count; isolating them in a `utilityProcess` keeps the IPC broker, capability ledger, and window manager responsive. The worker is spawned alongside the storage worker by `startWorkers()` in Stage 3.

---

### Front-end stack (added in 13)

#### OQ-19 — Framework choice revisit trigger
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Under what conditions do we revisit the React-everywhere decision?
- **Options:**
  - (a) Revisit if shell renderer's React runtime is the dominant cost in measurable cold-start or idle-CPU profiles.
  - (b) Revisit on a fixed cadence (e.g. yearly).
  - (c) Don't revisit; commit to React.
- **Tentative leaning:** (a). Data-driven trigger.
- **Blocking?:** No.

#### OQ-20 — Dev vs. prod build distribution
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Does the shell ship separate development and production builds, or always production-built (with sourcemaps for debug)?
- **Options:**
  - (a) Production-only with detached sourcemaps. Simplest distribution.
  - (b) Separate dev build for testers/contributors with extra debugging affordances.
- **Tentative leaning:** (a) for v1.
- **Blocking?:** No.

#### OQ-21 — Internationalization timeline  *[RESOLVED in 21]*
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Resolution:** (a) — v1 ships the full localization architecture (stable ids, required context, ICU MessageFormat, FormatJS, per-app catalogs, RTL-ready layout) with **en-US only**. Other locales arrive as community/commercial translations land without retrofit cost. Decision recorded in [21-localization.md](../platform/21-localization.md).
- **Update (2026-06-06, settings-overhaul — product-owner call):** the "English-only at launch" stance is **lifted**. v1 ships a **runtime language switch** (Settings → Language & Region) backed by a locale-pack loader (`applyLocalePack` + the shared fallback chain) and a **`LocaleGate`** that remounts the shell subtree on change, with **machine-translated seed packs (es, de)** proving the pipeline end-to-end (untranslated keys fall back to English). The per-vault chosen language syncs across devices. **Remaining rollout (next iteration):** app-side propagation (a `services.i18n` read seam so app renderers translate + format), per-app translated catalogs, and the documented pre-vault limitation (vault picker / lock screen stay on the last applied language).

---

### App store (added in 14)

#### OQ-22 — Native modules in app bundles
- **Where:** [14-app-store.md](../apps/14-app-store.md).
- **Question:** Does the package format ever permit compiled native modules (e.g. `.node` addons), or is it pure JS/asset bundle forever?
- **Options:**
  - (a) Pure JS/asset bundle, full stop. Wasm allowed for CPU-heavy work.
  - (b) Native modules permitted with extra signing requirements and platform-specific bundles.
  - (c) v1 = (a); v2 reconsiders for performance-critical apps.
- **Tentative leaning:** (a) indefinitely. Wasm covers the CPU case without the platform/signing complexity.
- **Blocking?:** No.

#### OQ-23 — Key rotation in v1?
- **Where:** [14-app-store.md](../apps/14-app-store.md).
- **Question:** Is signing-key rotation a v1 feature, or deferred to v2?
- **Options:**
  - (a) Design and ship rotation in v1.
  - (b) v1 has signing but no rotation; rotation arrives in v2.
- **Tentative leaning:** (a) for design (so the verification chain is forward-compatible) but (b) for runtime (we don't need to ship rotation tooling in v1).
- **Blocking?:** Soft yes for the verification format.

#### OQ-24 — Third-party discovery surfaces
- **Where:** [14-app-store.md](../apps/14-app-store.md).
- **Question:** Can third-party apps register additional discovery surfaces (e.g. a "research apps" custom storefront app)?
- **Options:**
  - (a) Yes, with a special capability and visual attribution that the surface is third-party.
  - (b) No — discovery is a shell-only concern; third parties can publish catalogs but not custom UIs.
- **Tentative leaning:** (b) for v1 (avoid phishing surface); reconsider in v2.
- **Blocking?:** No.

---

### Identity, organizations, encryption (added in 16)

#### OQ-25 — Cipher selection  *[RESOLVED in implementation-plan Stage 2]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).
- **Question:** AES-GCM-256 or XChaCha20-Poly1305 for entity DEK content encryption?
- **Resolution (v1):** **XChaCha20-Poly1305** via `@noble/ciphers`. 192-bit nonces eliminate practical nonce-reuse risk; pure-JS audited; no native-accel dependency; matches the cipher already stated in [29-credentials-storage.md §Storage layout](../security/29-credentials-storage.md).

#### OQ-26 — Device pairing UX details  *[RESOLVED in implementation-plan Stage 10.0]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md). (Refines OQ-10.)
- **Resolution (2026-05-20, forced by 10.0 spike):** **QR-only primary path; numeric code is a cryptographic-fallback (SAS over authenticated DH), not a UX duplicate.** The spike forced the realisation that the QR payload carries a 32-byte secret directly; a code cannot. So the v1 implementation is: QR ships the secret in the payload; code mode does an authenticated DH and shows a 6-digit SAS the user matches on both screens before the user key crosses. **No recovery from lost-all-devices without an offline backup of the user-Ed25519 secret (or a v2 consumer account holding an encrypted backup).** The UI/onboarding flow says so plainly.

#### OQ-27 — Server-readable space key rotation  *[RESOLVED in implementation-plan Stage 10.0]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).
- **Resolution (2026-05-20, forced by 10.0 spike):** **Yes — key rotation is structurally decoupled from access change.** The spike's `kind=rotation` envelope shape (a signed rotation record + one fresh `kind=wrap` per remaining member) is identical whether the trigger is membership change OR a compliance policy (quarterly / on-event / on-suspicion). Therefore v1 ships the rotation envelope shape and verification path; v2 wires the periodic / compliance-driven rotation policy at the org layer. No protocol surgery between v1 and v2 — the substrate is the same.

#### OQ-28 — Org-controlled relay enforcement  *[RESOLVED in implementation-plan Stage 10.0]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).
- **Resolution (2026-05-20, forced by 10.0 spike):** **Only org spaces are routed through the org relay. Personal entities stay on the user's chosen relay.** The spike's routing model is `entityId → subscribed device labels`; the relay does not know an entity's space, so it has no enforcement surface for "force personal entities onto the org relay" — and shouldn't, per the account-less floor. **The decision the spike forced into the open:** the client's per-entity relay-routing table is identity-level state that must be backed up alongside the user-Ed25519 key. Lose that table = devices forget which relay to talk to per entity, a silent partial-loss worse than crypto loss. Recorded as a 10.5 sub-requirement (pairing payload includes the relay URL; relay-routing table is part of the v1 vault format frozen at 10.8).

#### OQ-29 — Audit visibility of revoked members  *[RESOLVED in implementation-plan Stage 10.0]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).
- **Resolution (2026-05-20, forced by 10.0 spike):** **Permanently visible in `root.meta.access` (append-only). Revocation = setting `revokedAt`, not deletion.** The spike's `root.meta.devices` Y.Array (signed `add-device` records verified under the user-Ed25519 key) is exactly this shape; membership follows the same pattern as `root.meta.access = Y.Array<{member, role, addedBy, addedAt, revokedAt}>`. Append-only gives audit a stable history and makes the "this person had access between dates X and Y" question structurally answerable on every device. **Important implication:** the access record lives **inside** the entity's Yjs doc, so it's encrypted-at-rest under the per-entity DEK and only visible to current+past members — it is *not* something an org admin can introspect across all entities without holding each entity's DEK. v2 server-readable spaces are how that gets aggregated, by design. v1 ships the audit *shape*; v2 ships the cross-entity aggregation surface.

#### OQ-191 — Nonce strategy for the encrypted Yjs envelope  *[RESOLVED in implementation-plan Stage 10.3a]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md); pinned by `packages/shell/src/main/sync/envelope-seal.ts` at 10.3a.
- **Question:** Per-envelope random 24-byte XChaCha nonce, or per-doc monotonic counter persisted alongside the doc?
- **Resolution (2026-05-23, position taken before 10.3a code lands):** **Random 24-byte XChaCha nonce, minted fresh per envelope via `randomBytes(24)`.** XChaCha's 192-bit extended nonce is birthday-safe at any realistic edit volume (collision probability ≪ 2⁻⁶⁴ at ~10¹⁰ envelopes — orders of magnitude beyond a v1 vault's lifetime emission). The monotonic-counter alternative would tighten the bound on paper but introduces a load-bearing persisted-state failure mode: a crash between `counter++` and snapshot fsync risks counter rollback, and rollback under the same key is catastrophic nonce reuse — exactly the failure mode XChaCha's extended-nonce design exists to avoid. Random is also what the 10.0 spike used and what the matched ChaCha20-Poly1305 wrap in 10.2's HPKE suite uses (RFC 9180 §5.1's per-base-context nonce is a counter inside a single context, not across contexts). Revisit only on measured side-channel or compliance ask (neither expected in v1).

#### OQ-192 — At-rest snapshot encryption: in 10.3, or later iteration?  *[RESOLVED in implementation-plan Stage 10.3a]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md); [editing/06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).
- **Question:** Does 10.3 encrypt the on-disk Y.Doc snapshot file (`<vault>/data/.../entity-<id>.ydoc`) under the entity DEK, or only the wire envelopes?
- **Resolution (2026-05-23):** **Wire-only in 10.3.** The on-disk snapshot stays plaintext-in-`ydoc-store` for now; the 3b SQLCipher at-rest flip already encrypts the SQLite domain DBs that index every entity, and the snapshot+tail files sit alongside those inside the vault directory. Snapshot-file-format encryption is its own iteration in the 10.x tail (separate review: file-format byte change + recovery semantics + truncation-tolerance interaction with per-block AEAD + how compaction at 256 KiB tail composes with re-encryption). The relay invariant ("blind relay sees ciphertext only") is fully load-bearing for 10.3 and is **not** weakened by deferring at-rest snapshot encryption: the relay never touches the disk file. Filed as a non-blocking follow-up (10.x at-rest snapshot) on the same shelf as 10.10/10.11. Reopens if a threat-model revisit at G3 says otherwise.

#### OQ-193 — Update batching cadence for envelope emission  *[RESOLVED in implementation-plan Stage 10.3a]*
- **Where:** `packages/shell/src/main/sync/envelope-pipeline.ts` at 10.3a; revisit hook at 10.7.
- **Question:** Should the wire path emit one envelope per Y.Doc transact, or coalesce sub-window edits into batched envelopes?
- **Resolution (2026-05-23):** **One envelope per Yjs transact for v1.** This matches Yjs's own native edit-grouping boundary, so a multi-character paste / multi-cell edit / format change that's already coalesced inside one `doc.transact(...)` produces one envelope; finer-grained keystroke edits each produce one envelope, which is what the spike measured as acceptable. No debounce / flush-window code at 10.3a — keeps the wire path minimal and observable. 10.7 (sync-status surface) is the natural revisit point if measured envelope-per-second under real edit volume motivates coalescing; OQ-193 reopens then with numbers.

#### OQ-194 — Seq-tracker persistence granularity  *[RESOLVED in implementation-plan Stage 10.3b]*
- **Where:** `packages/shell/src/main/sync/seq-tracker.ts` (10.3b); surfaced in 10.7's sync-status panel.
- **Question:** Per-(sender,entityId) seq state lives in vault KV — for a 10k-entity vault paired with 3 devices that's ~30k KV rows. Acceptable, problematic, or rethought?
- **Resolution (2026-05-23):** **Acceptable for v1.** SQLite handles 30k–100k KV rows trivially (the registry.db / entities.db queries already operate at that scale). Per-(sender,entityId) granularity is the smallest replay-window unit that gives a correct one-shot dup-drop without coupling unrelated entities' replay state. Callout: 10.7's sync-status surface should be able to list the seq state's footprint as a diagnostic; not a blocker. Re-evaluate only if a 100k-entity / 10-device scaling pass at G(GA) flags the table size.

#### OQ-195 — Relay connection-establishment auth: device-key challenge vs trust-and-verify-per-frame  *[RESOLVED in implementation-plan Stage 10.4]*
- **Where:** `packages/relay-server/src/server.ts` (10.4); revisit hook at 10.7 / 10.9.
- **Question:** Should the relay perform a device-Ed25519 challenge at WebSocket-open time so an unknown device cannot even establish a connection, or is per-frame Ed25519 signature verification (by the recipient) the only auth?
- **Resolution (2026-05-23):** **Trust + verify-per-frame at v1.** Every envelope already carries an Ed25519 signature over `canonicalHeaderBytes || ciphertext` that the recipient verifies (10.3a). Adding a connection-establishment challenge would require the relay to know per-vault ACLs (a v2 org-relay concern, not a personal-relay v1 one) and would gain nothing structural — a recipient that already drops every unsigned-or-forged frame is the load-bearing defence. The relay's only contract is "ciphertext bytes pass through unchanged"; making it an additional gatekeeper conflates the blind-relay role with an ACL role we explicitly don't want at v1 (see OQ-28). v2 org spaces re-open this with a per-org ACL surface; v1 personal relay stays open-by-default.

#### OQ-196 — WebSocket heartbeat / zombie-detection cadence  *[RESOLVED in implementation-plan Stage 10.4]*
- **Where:** `packages/shell/src/main/sync/websocket-relay-port.ts` (10.4); revisit when 10.5 / 10.7 land soak data.
- **Question:** Add a ping/pong heartbeat to detect zombie WebSockets (TCP-alive but app-silent), and at what cadence?
- **Resolution (2026-05-23):** **Defer until soak signals need.** The browser WebSocket auto-pings the underlying TCP socket; on Bun the runtime's `Bun.serve` ws handler does similar at the OS layer. Adding an app-layer heartbeat is the kind of detail whose right cadence is a *measurement* — too-aggressive wastes battery + bandwidth on mobile clients, too-lazy lets a zombie linger for minutes. We ship 10.4 without a heartbeat; if 10.5 (pairing UX) or 10.7 (sync-status) surface "stale ws" reports during dogfood, OQ-196 reopens with a target detection window in numbers, not opinion.

#### OQ-197 — Routing-token rotation on top of stable entityId  *[RESOLVED in implementation-plan 10.11 (2026-07-04, shell PR #100 + sync PR #4)]*
- **Where:** `packages/relay-server/src/router.ts` (10.4); forward iteration `10.11`.
- **Question:** The relay routes on `entityId` (the canonical-header field). For an org space, the entityId is recognisable across re-pairings, which leaks "device X is still subscribed to entity Y" to the relay. Should v1 rotate a *routing token* per (entity, subscriber) so the entityId never crosses the wire as the routing key?
- **Resolution (2026-05-23, surfaced for forward work — non-blocking 10.4):** **Not in v1; tracked as `10.11`** alongside the de-risk-spike's `10.10` (wrap+snapshot bundling). The trade-off: routing-token rotation strictly improves the relay-blind story (entityId never appears on the wire), but adds (a) a per-(entity, device) token table on both ends, (b) a rotation envelope shape, (c) a sync-status surface to display rotation state. v1 ships with entityId as the routing key — the relay still cannot decrypt the body, and the entityId leak is the same kind already disclosed by `root.meta.access` records (per OQ-29). Org-grade deployments at v2 turn `10.11` on; personal v1 deployments hold the simpler shape.
- **Final resolution (2026-07-04, `10.11` implemented):** the routing key becomes a pseudonymous token `HKDF-SHA256(ikm = entity DEK, salt = "brainstorm/v1/routing-token", info = entityId, 16B)` — derived client-side (every member/device already holds the DEK via HPKE wraps; no new key distribution), riding the existing opaque `entityId` wire slot (zero frame-format change). **Rotation is on ACCESS CHANGE only** (DEK rotation per OQ-27); time/epoch rotation was explicitly rejected — the durable node keys snapshot+tail storage and the SYNC-4a catalog by the routing id, so epochs either fragment restore or require an old→new migration the node can link, making periodic rotation against a storing node privacy theater. Re-home is client-driven and fail-closed: intent persisted → `rotate {from,to}` → node migrates storage torn-state-free + dual-token grace alias + catalog update → ack; the client flips emission only on ack (denial/timeout/pre-10.11 node ⇒ old token stays fully live, test-pinned). Documented non-goals: the node links from→to at rotation (inherent to storage continuity); per-pseudonym traffic patterns remain visible (inherent to pub/sub). Token mode is opt-in at the pipeline this iteration; tokens-by-default wiring into live-sync/restore is the follow-up rung `10.11b`.

#### OQ-198 — User-Ed25519 secret transport over the pairing channel  *[RESOLVED in implementation-plan Stage 10.5a]*
- **Where:** `packages/shell/src/main/credentials/identity-export.ts`; `packages/shell/src/main/pairing/pairing-handshake.ts`.
- **Question:** The sovereign user-Ed25519 secret has to reach the new device so it can sign `add-device` records, but the plaintext secret must NOT cross IPC and must NOT live anywhere a renderer can read it. What's the transport shape?
- **Resolution (2026-05-23):** **AEAD-sealed under a fresh per-pairing `pairingSecret`, sealed + opened inside the main process, replay-guarded one-shot per pairingSecret.** Source-side `exportSecretSealed(identitySecret, pairingSecret)` runs entirely in the main process (called by `PairingService.startAddDevice` reading from `VaultSession.identitySecret` by reference — never copied through IPC). Domain-separated AAD `brainstorm/v1/pair/identity-export` binds the ciphertext to this purpose so a sealed blob can't be replayed against any other AEAD consumer. Target-side `importSecretSealed(sealed, pairingSecret)` runs in the main process, validates against `PairingChannelGuard` (a process-local Set of consumed pairingSecrets — second open with the same secret throws `Invalid`), and installs into the keystore via `KeystoreBackend.setSecret("identity", ...)`. The renderer holds the sealed blob only; the plaintext secret never appears in a renderer log.

#### OQ-199 — `meta.devices` storage: which Y.Doc?  *[RESOLVED in implementation-plan Stage 10.5a]*
- **Where:** `packages/shell/src/main/vault/vault-properties-store.ts`; `packages/shell/src/main/pairing/devices-store.ts`.
- **Question:** Signed `add-device` records live on a Yjs doc the user owns. Extend the existing `brainstorm-Dashboard` Y.Doc, or open a sibling vault-properties doc?
- **Resolution (2026-05-23):** **Sibling vault-properties Y.Doc** (id `brainstorm-VaultProperties`). Three reasons: (a) The dashboard doc broadcasts every mutation to renderers subscribed to dashboard snapshots; a `meta.devices` append would notify everyone (none of whom read it) and a `dashboard.read`-capability holder would observe device-set churn timing. (b) The dashboard doc is mid-migration to `brainstorm/Dashboard/v1` in Stage 9; keeping pairing state out lets that promotion happen without touching the pairing schema. (c) Their on-wire futures diverge — the dashboard stays vault-local-only, the vault-properties doc replicates across paired devices via the same sync transport every entity doc uses (10.4 relay).

#### OQ-200 — SAS derivation: 6 digits, HKDF info string  *[RESOLVED in implementation-plan Stage 10.5a]*
- **Where:** `packages/shell/src/main/pairing/sas.ts`.
- **Question:** What primitive + width + domain separator does the Short Authentication String the user reads off both screens use?
- **Resolution (2026-05-23):** **HKDF-SHA256 with a domain-separated `info` string, 4 output bytes projected to decimal modulo 1,000,000, zero-padded to 6 digits.** Two info constants live in `sas.ts`: `"brainstorm/v1/pair/sas"` (the SAS-mode SAS, derived from the ECDH-shared secret) and `"brainstorm/v1/pair/qr-sas"` (the courtesy SAS shown alongside a QR payload, derived from the `pairingSecret`). 4 output bytes is intentional — the 6-digit projection carries ~19.93 bits, well under 32 bits of HKDF entropy; the user reads the projected number, not the raw bytes, so the security budget is the projection-space (10⁶), not the HKDF output width. The fixed length keeps the UI legible; the zero-pad is mandatory (a 5-digit "12345" would be visually indistinguishable from "012345" on a screen).

#### OQ-201 — Pairing-payload expiry default  *[RESOLVED in implementation-plan Stage 10.5a]*
- **Where:** `packages/shell/src/main/pairing/pairing-payload.ts`.
- **Question:** How long should a freshly-generated QR / paste-payload remain valid before the target device refuses it as `Expired`?
- **Resolution (2026-05-23):** **120 seconds default** (`PAIRING_DEFAULT_TTL_SECONDS`), per-call override via `startQrHandshakeOnSource({ttlSeconds})`. Two minutes is short enough that a captured QR from a shoulder-glance is unusable by the time the attacker walks out of camera range, and long enough that an unhurried user can scan + confirm without the source re-rolling. The TTL is enforced at decode time (`isPairingPayloadExpired(payload, nowSeconds)`) — the target refuses the join, the source's state machine times out via `expire()`. Pre-confirmed SAS sessions can extend the window with a non-default `ttlSeconds` if a UX path emerges that needs it; v1 starts at the conservative end.

#### OQ-202 — QR scan implementation  *[RESOLVED in implementation-plan Stage 10.5b]*
- **Where:** `packages/shell/src/renderer/settings/devices-join-flow.tsx` (10.5b).
- **Question:** Pure-JS `@zxing/browser` (~200kb gzip) vs native `BarcodeDetector` API + paste-fallback?
- **Resolution (2026-05-23):** **Native `BarcodeDetector` + paste fallback.** Chromium 83+ (every Electron version supported here) exposes the API. Falls back to a paste-the-payload textarea when camera/API unavailable. Zero new deps; pure render-side; QR payload is < 200 chars (pasteable). Pulls in `@zxing/browser` only as a `10.x` follow-up if real-world Linux Chromium proves spotty. The renderer-bundle budget at 270 KB has only ~1.6% headroom — declining the dep keeps the budget honest.

#### OQ-203 — Revocation propagation semantics  *[RESOLVED in implementation-plan Stage 10.5c]*
- **Where:** `packages/shell/src/main/pairing/devices-store.ts` (10.5a/c) + `packages/shell/src/main/sync/envelope-pipeline.ts` verifier (10.5c).
- **Question:** When the user revokes device B on device A, what changes structurally?
- **Resolution (2026-05-23):** **Both.** Append a `revoke-device` record signed under the user-Ed25519 key to `meta.devices` (sets `revokedAt`; append-only, mirrors OQ-29's access-record discipline). Two downstream effects: (a) envelope-pipeline verifier path drops every envelope signed by the revoked `deviceEd25519Pub` (the verify gate already knows the device pubkey via the routing header — extend it to check a "revoked devices" set), (b) new HPKE wraps (10.2 member-wraps) skip revoked devices. v1 does NOT re-wrap existing entity DEKs to exclude the revoked device — that's a `10.10`-style rotation operation (decoupled from access change per OQ-27); revoked B can decrypt envelopes minted before its `revokedAt`, but everything after that point is dark to it.

#### OQ-204 — Awareness debounce default  *[RESOLVED in implementation-plan Stage 10.6]*
- **Where:** `packages/shell/src/main/sync/awareness-broadcaster.ts` (10.6).
- **Question:** What's the outbound debounce window for awareness updates (cursor moves can fire at 60 Hz)?
- **Resolution (2026-05-23):** **50 ms trailing debounce** for user-driven updates (~20 Hz outbound), ~15 s heartbeat-only refresh rate (matches Yjs `outdatedTimeout = 30000 / 2`). Implementation lives in a new sender-side wrapper that subscribes to `awareness.on('update', …)`, batches `(added, updated)` ids within the debounce window, calls `encodeAwarenessUpdate` once, emits one envelope. **Do NOT** throttle inside `setLocalState` itself — that breaks Yjs's clock invariant. Always set state immediately on the local `Awareness`; throttle only outbound envelope emission. Revisit in 10.7 if dogfood shows jitter.

#### OQ-205 — Future `entities.read.noPresence:<type>` capability  *[RESOLVED in implementation-plan Stage 10.6 — surfaced for forward work]*
- **Where:** capability ledger; revisit if guest/read-only sharing in Stage 11 introduces a coherent use case.
- **Question:** Should awareness data require a separate capability (`sync.awareness:<type>`) or piggyback on `entities.read:<type>`?
- **Resolution (2026-05-23):** **Piggyback on `entities.read:<type>` at v1.** Awareness is metadata *about* an entity (who's looking, where their cursor is); if an app already gets the plaintext entity bytes, awareness state is strictly less sensitive. A separate `sync.awareness:<type>` capability would force every Notes/Tasks/etc. manifest to declare a redundant cap and create incoherent product states ("app has read but not awareness"). The `entities.read` check the shell already does for the entity body covers awareness. If a v2 "awareness-blind viewer app" cap proves coherent, revisit then; do NOT block 10.6.

#### OQ-206 — Apps-side `sync.status:read` capability  *[RESOLVED in implementation-plan Stage 10.7 — surfaced for forward work]*
- **Where:** capability ledger; revisit when an app surfaces a coherent need.
- **Question:** Should apps see sync state inline (e.g. for a "Syncing…" footer in Notes)?
- **Resolution (2026-05-23):** **Defer to v2.** Apps see sync indirectly through `entities` reads (the local SQLite state is either current or stale-from-a-CRDT-merge-perspective; the row's `updated_at` is the right signal for "is my data fresh"). A `sync.status:read` cap commits to an API shape before any app has asked for it. Revisit when a concrete app use case surfaces.

#### OQ-207 — Per-entity sync drilldown  *[RESOLVED in implementation-plan Stage 10.7 — surfaced for forward work]*
- **Where:** Settings → Sync section drilldown.
- **Resolution (2026-05-23):** **Aggregate-only at v1, drilldown deferred to post-G2.** At v1 the orchestrator is single-vault → single transport → all entities ride the same connection state; per-entity divergence ("entity A is synced, B is stale") can't happen because all entities share the wire path. The only per-entity signal we *can* show is "last sync of THIS entity's seq state" — interesting for debugging but not for end-user state. Revisit if users ask post-G2.

#### OQ-208 — Stale threshold value (`STALE_AFTER_MS`)  *[RESOLVED in implementation-plan Stage 10.7]*
- **Where:** `packages/shell/src/main/sync/sync-status-store.ts` (10.7).
- **Resolution (2026-05-23):** **Lock 30 seconds for the iteration; leave the constant configurable** (`STALE_AFTER_MS = 30_000`). Tune from soak data at 10.9; revisit in the soak report.

#### OQ-209 — `error` state visibility cadence  *[RESOLVED in implementation-plan Stage 10.7]*
- **Where:** `packages/shell/src/main/sync/sync-status-store.ts` derivation (10.7).
- **Question:** The WebSocket transport flips through `Error` for one tick before `Reconnecting` — should the surface ever paint `Error`, or roll it into `offline`?
- **Resolution (2026-05-23):** **Paint `Error` only if it sticks > 1 second; otherwise fold into `offline`.** Transient reconnect noise looks alarmist when surfaced as `Error`; users care about "stable failure" vs "blip". The 500 ms debounce on traffic-tick broadcasts already provides one layer; the 1-second `Error` linger threshold is the second.

#### OQ-210 — Status chip visibility in `local-only`  *[RESOLVED in implementation-plan Stage 10.7]*
- **Where:** `packages/shell/src/renderer/dashboard/sync-status-chip.tsx` (10.7).
- **Question:** Hide the chip entirely for single-device users (no `syncRelay` configured), or show a quiet "Local only" pill?
- **Resolution (2026-05-23):** **Show, quiet.** A "Local only" pill is discoverability for users who later pair a device — they need to see the surface before they need to use it. Quiet = subtle styling (dim icon, no badge), not a hidden state.

#### OQ-211 — `vault.json.componentVersions` snapshot manifest  *[RESOLVED in implementation-plan Stage 10.8]*
- **Where:** `vault.json` schema; `docs/foundations/28-vault-and-onboarding.md`.
- **Question:** Should `vault.json` carry a `componentVersions: {entitiesDb, registryDb, ledgerDb, searchDb, ydoc, seq}` self-describing manifest at freeze time?
- **Resolution (2026-05-23):** **No.** Adds churn on every per-DB migration (touch one field → also bump the manifest); the live DB headers + Y.Doc binary version are authoritative. Tooling that needs a component summary opens the DBs. Keeps the freeze surface minimal.

#### OQ-212 — Vault-validate failure semantics  *[RESOLVED in implementation-plan Stage 10.8]*
- **Where:** `packages/shell/src/main/vault/vault-validate.ts` (10.8).
- **Question:** Should `validateVault` failures be fatal (refuse to open), warn-only (log + continue), or user-prompted (repair / ignore / refuse)?
- **Resolution (2026-05-23):** **Warn-only at v1.** Validation failures log via the standard audit log + the boot-time consistency check fires fire-and-forget AFTER `openVault` succeeds. User-prompted "repair / ignore" is post-beta UX. v1's job is to surface the diagnostic, not to make the user re-decide on every boot.

#### OQ-213 — Per-app KV schema freeze  *[RESOLVED in implementation-plan Stage 10.8]*
- **Where:** `data/app-private/<app-id>/kv.db` schemas.
- **Question:** Does the 1.0 freeze cover per-app KV schemas, or are those forever per-app contracts?
- **Resolution (2026-05-23):** **Per-app contract; the freeze covers only the path scheme + isolation invariants.** Apps own their KV schema; the vault freezes that (a) `data/app-private/<app-id>/kv.db` is the path, (b) per-app isolation is structural (each app sees only its own dir), (c) no cross-app KV reads. App schemas evolve at the app's own pace.

#### OQ-214 — Backup-on-migrate UX  *[RESOLVED in implementation-plan Stage 10.8]*
- **Where:** `packages/shell/src/main/vault/vault-migrations.ts` (10.8).
- **Question:** Ship a "back up before migration" UX affordance at 10.8 even though `VAULT_MIGRATIONS` is empty?
- **Resolution (2026-05-23):** **Yes — land the prompt + tarball helper at 10.8.** The first real 1.0→1.1 migration shouldn't have to design its own UX. Stub the prompt as a no-op (`if (migrations.length === 0) return`) at 10.8; when migrations land, the prompt activates with the existing affordance.

#### OQ-215 — Pre-freeze override env var visibility  *[RESOLVED in implementation-plan Stage 10.8]*
- **Where:** `packages/shell/src/main/vault/vault.ts` (10.8).
- **Question:** Publish `BRAINSTORM_ALLOW_PRE_FREEZE_VAULTS` publicly or keep it test-only undocumented?
- **Resolution (2026-05-23):** **Test-only undocumented.** The override exists so QA / dev branches with long-lived test vaults from before the freeze land don't have to recreate. Public documentation invites users to bypass the safety check; the env var is intentionally fingers-only.

#### OQ-216 — App-bundle directory layout freeze scope  *[RESOLVED in implementation-plan Stage 10.8 — out of scope]*
- **Where:** `apps/<app-id>/` bundle directory; Stage 5's app-install contract.
- **Question:** Does the vault format freeze cover the `apps/<app-id>/` directory layout?
- **Resolution (2026-05-23):** **No — app-install's contract, cross-referenced only.** Stage 5's `AppInstaller` owns the bundle layout; the vault freeze references it but doesn't own it. Bumping the bundle layout is an app-install version bump, not a vault format bump.

#### OQ-217 — `vault-validate` IPC vs CLI surface  *[RESOLVED in implementation-plan Stage 10.8]*
- **Where:** `packages/shell/scripts/vault-validate.ts` (10.8) + potential Settings → Diagnostics surface (forward).
- **Question:** Should `vault-validate` ship as a privileged IPC method (`shell.vault.validate`) for a future Settings → Diagnostics pane, or stay CLI-only?
- **Resolution (2026-05-23):** **CLI-only at 10.8.** Settings → Diagnostics is a forward iteration (no concrete UX need today). CLI lets ops + power-users run validations against a vault without booting Electron; it's the right surface for the freeze gate. The IPC method lands when the Diagnostics pane is designed.

#### OQ-227 — `OsHandoffPromptHost` cap + timeout values  *[RESOLVED in implementation-plan OpenRes-1c slice 4]*
- **Where:** `packages/shell/src/main/ipc/os-handoff-prompt.ts` (OpenRes-1c slice 4 hardening of CR-2).
- **Question:** What are the production values for `MAX_PENDING` (concurrent in-flight OS-handoff prompts) and `PROMPT_TIMEOUT_MS` (per-request ceiling before the host gives up on the dashboard)?
- **Resolution (2026-05-23):** **`PROMPT_TIMEOUT_MS = 60_000` + `MAX_PENDING = 16` + newest-rejected on overflow.** A 60-second ceiling is long enough that a deliberating user never hits it, short enough that a wedged dashboard renderer frees memory on the same scale as a tab reload. 16 pending is comfortably above any realistic concurrent open burst (the launcher rate-limit is far tighter) and bounded so a misbehaving caller can't OOM the resolver. Newest-rejected (not oldest-evicted) preserves the in-flight modal the user is actually looking at — evicting the visible one would lose user attention. Timeout decision = `Cancel` (NOT `Deny`) so consent stays first-use (next attempt re-prompts), preserving slice-1's "Cancel doesn't persist" invariant. Tune from soak data if the prompt becomes a hot path.

#### OQ-228 — Soak 15-min mode: PR-gate or nightly-only?  *[RESOLVED in implementation-plan Stage 10.9a]*
- **Where:** `playwright.soak.config.ts` + `package.json` `soak` script + future CI workflow that wires `bun run soak` (filed before that workflow lands).
- **Question:** Does the 15-min soak mode (`BS_SOAK_MIN=15`) run on every PR or only on a nightly job?
- **Resolution (2026-05-23):** **Nightly + PR-gate-blocking on G2-spine PRs only.** The 15-min mode is bounded enough to live on a nightly CI job for every Stage-10+ branch; it gates PR merges only when the PR touches `packages/shell/src/main/sync/**` or `packages/relay-server/**` (the spine surfaces the ciphertext-only proof actually protects). The 30-min extended mode runs nightly without PR gating. The 8 h endurance mode (`BS_SOAK_MIN=480`) runs on the release-candidate cut + before any Stage-10 stability audit and is **release-blocking** — Phase-1 exit gate per [`docs/implementation-plan.md` Phase 1](../implementation-plan.md#execution-model).

#### OQ-229 — Canary-search robustness against Yjs framing  *[RESOLVED in implementation-plan Stage 10.9a]*
- **Where:** `tests/soak/lib/canary-search.ts`.
- **Question:** Could Yjs's internal framing (varint length prefixes, structure stream IDs) cause a planted-canary plaintext byte sequence to be re-encoded into a form `indexOfBytes` misses, producing a false negative?
- **Resolution (2026-05-23):** **No, and the canary design encodes the answer.** The relay audit log records `{ts, fromConnId, toConnId, entityId, kind, bytes}` — never frame body bytes (the relay-server type-fence enforces this at compile time per Stage 10.4). Therefore the only way a canary string lands in the audit log is if the relay-server source is patched to record payload-shaped data; the canary-search runs against the file the relay actually wrote, so any byte-encoded representation (raw, hex, base64, varint-wrapped) of the canary string would show up unless the patch *also* re-encodes the canary into a form the scanner doesn't see. The scanner operates on raw `Uint8Array` (no string decode) so multibyte UTF-8 canaries match byte-for-byte; the unit test `multibyte canary` proves this. If the patch hex-encoded payload bytes, the canary string itself wouldn't match its hex form — that class of leak is caught by the orthogonal "audit log shape" type-fence, which is what we'd be regressing in the first place. Three layers of defense (type-fence + canary-grep + no-noble-probe) on three independent failure modes.

#### OQ-230 — Passive observer necessity  *[RESOLVED in implementation-plan Stage 10.9a]*
- **Where:** `tests/soak/lib/launch-relay.ts` + `packages/relay-server/src/audit-log.ts`.
- **Question:** Do we need a separate passive WebSocket observer (a third client that subscribes to every routing key and dumps every frame) to back up the audit-log-based ciphertext-only proof?
- **Resolution (2026-05-23):** **No at v1 — the existing audit log is the observer.** The relay's `AuditLog` already records per-frame routing metadata to an NDJSON file at `--audit-log-path`; the ciphertext-only proof reads that file. A separate observer would buy us "we also captured the raw frame bytes" — but the relay-blind invariant says the relay never opens the body, and the wire is opaque to a passive eavesdropper unless they have the DEK. The proof we need is "no plaintext byte sequence the harness controls (canary) survives the relay's audit log", which the audit log + canary-grep already provide. If a future iteration needs frame-bytes archival (e.g. for forensic replay), add a `--frame-archive-path` flag to `bin/relay.ts` and keep the type-fence against payload bytes intact via a deliberate per-line review note.

#### OQ-231 — RSS slope threshold calibration  *[RESOLVED in implementation-plan Stage 10.9a]*
- **Where:** `tests/soak/specs/10.9-ciphertext-only.spec.ts` (`MEM_SLOPE_MB_PER_MIN`).
- **Question:** What's the right slope threshold for the memory-leak gate — too tight produces flakes, too loose hides leaks?
- **Resolution (2026-05-23):** **`1.0 MB/min` at landing, calibrated from 15-min mode + re-evaluated after the 8 h run.** 1.0 MB/min is generous enough that a healthy steady-state (which floats around the JIT's working set + Yjs doc growth) clears the bar; tight enough that a real leak (one slow-growing Map / unreleased Y.Doc) shows up over the 8 h window as ~480 MB which is unmissable. The 10.9b 8 h run captures the actual slope; if the steady-state median lands at <0.2 MB/min we can tighten to 0.5 MB/min for the PR-gate (15-min) mode in a follow-on iteration without re-doing the harness.

#### OQ-232 — `vault.json` patch trick vs dev IPC  *[RESOLVED in implementation-plan Stage 10.9a]*
- **Where:** `tests/soak/specs/10.9-ciphertext-only.spec.ts` (relay URL wiring).
- **Question:** Should the harness write `vault.json.syncRelay` directly via the file system before launching the shell, or use a dev IPC (`dev.setSyncRelay`)?
- **Resolution (2026-05-23):** **Dev IPC.** Writing `vault.json` directly bypasses the `ActiveRelayOrchestrator`'s session-change-driven rebuild, leaving a window where the shell is running with a loopback transport even though the file says websocket — the harness would have to also kick the orchestrator separately to reconfigure. The dev IPC `dev.setSyncRelay` calls `setSyncRelayConfig` which already triggers the orchestrator's `reconfigure()` atomically. Both paths persist to the same file, so a soak that crashes mid-run leaves the same on-disk state either way. The IPC path is more honest to production code; the file-patch path is a debugging hack that papers over a race.

#### OQ-233 — `BRAINSTORM_DEV_INSECURE_CREDENTIALS=1` in soak  *[RESOLVED in implementation-plan Stage 10.9a]*
- **Where:** `tests/perf/lib/launch-shell.ts` (reused by the soak harness; the same env var is already set unconditionally for perf).
- **Question:** Does the soak harness require the OS keychain backend, or is the perf harness's `BRAINSTORM_DEV_INSECURE_CREDENTIALS=1` (file-backed `insecure-dev` master key) acceptable?
- **Resolution (2026-05-23):** **`insecure-dev` is fine for soak.** The ciphertext-only proof targets the *wire* (the relay must see ciphertext). Where the master key lives at rest is orthogonal — the AEAD path uses the same XChaCha20-Poly1305 seal regardless of keystore backend. The dev keystore eliminates a class of CI-environment flakes (no OS-keyring access in headless runners) and matches the perf harness, so the soak inherits the same env via the shared `launchShell`. Production CI never sees this env var because the soak script `bun run soak` is opt-in and never runs in release-cut workflows.

---

### Interoperability (added in 17)

#### OQ-30 — Intent verb namespace: curated or open?  *[RESOLVED in 17]*
- **Where:** [17-interoperability.md](../platform/17-interoperability.md).
- **Resolution:** (a) — curated. Apps use shell-defined verbs only (`open`, `insert`, `share`, `convert`, `export`, `import`, `process`, `compose`, `quick-look`, `print`); new verbs added in shell releases. Decision recorded in 17.

---

### Menus (added in 13 update)

#### OQ-32 — fancy-menus version pinning across SDK and apps  *[RESOLVED in 13]*
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Resolution:** (a) — SDK pins exact version; apps see whatever the shell SDK ships. Single source of truth, matches the rest of the SDK.

#### OQ-33 — fancy-menus subset for v1  *[RESOLVED in implementation-plan Stage 8.8 (2026-06-01): swap-in landed]*
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** While `fancy-menus` is pre-release, which body/row/panel kinds does the shell rely on for v1?
- **Resolution:** the published `@react-fancy-menus/core@0.1.0` ships the full surface, so the v1 subset is what the migrated surfaces actually use: **list** + **composed** bodies; **item / section / divider** rows; **searchInput** + **emptyState** panels (cheatsheet, launcher); the shared cursor-anchored context menu (item rows, destructive styling) behind every object / context menu, the graph export menu, and the database column-adder. The stretch kinds (grid body, participant row) are available in the dep but unused at v1 — adopt as the emoji/color picker and member pickers migrate. Minimum subset shipped; stretch deferred as planned.
- **Blocking?:** No.

---

### Storage and search (added in 18)

#### OQ-34 — At-rest encryption library  *[RESOLVED in implementation-plan Stage 3b (2026-05-22): on-disk flip landed]*
> **3b update (2026-05-17):** Decision made — ship `better-sqlite3-multiple-ciphers` (synchronous SQLCipher drop-in matching the one-file-swap contract); `@libsql/client` evaluated live and **rejected** (async-only API would force an async rewrite of the whole synchronous storage stack). The full at-rest implementation (HKDF per-DB key derivation, `PRAGMA key`, transparent atomic idempotent plaintext→encrypted migration, fail-closed on wrong/absent key) is **code-complete and fully tested** (via an injected synchronous SQLCipher-shaped fake) behind an `isSqlcipherAvailable()` gate.
>
> **3b flip (2026-05-22):** `better-sqlite3-multiple-ciphers@12.9.0` declared as a dep; `@electron/rebuild@4.0.4` added as devDep + native addon rebuilt against Electron 41 (`NODE_MODULE_VERSION 145`). The original block (the dev box's Python 3.14 / libexpat `pyexpat` ABI) was on the *from-source* compile path — `prebuild-install` resolved the matching prebuilt cleanly, so source compile was never needed. New `main/storage/at-rest-mode.ts` adds the boot-time probe + observability + `vault.json` mode flag with fail-closed `reconcileAtRestMode` (refuses a recorded-encrypted vault opening into a plaintext environment, the silent-data-loss scenario). +16 tests; 5311/5311 workspace green; `bun run verify` 192/192. See implementation-log §"Stage 3b flip".
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md).
- **Question:** Which SQLite encryption library do we ship?
- **Options considered:**
  - (a) SQLCipher upstream — most mature; community edition is BSD-licensed.
  - (b) libsql with built-in encryption — MIT-licensed, less battle-tested.
  - (c) libsodium-based page-level layer we maintain — maximum control, maintenance cost.
  - (d) `better-sqlite3-multiple-ciphers` — MIT drop-in for `better-sqlite3` with SQLCipher built-in.
- **Stage 3 reality:** intended to land on (d), but it requires a from-source native build, and Bun cannot currently consume the standard `better-sqlite3`-shaped native module without prebuilt binaries that match Bun's ABI. (See <https://github.com/oven-sh/bun/issues/4290>.) On the dev machine `better-sqlite3-multiple-ciphers` failed to build from source because of a Python 3.14 / libexpat ABI mismatch (system-level, not a Brainstorm bug).
- **Stage 3 resolution (interim):** the storage layer is wrapped behind a thin **runtime-agnostic SQLite abstraction** (`packages/shell/src/main/storage/sqlite.ts`) that picks `bun:sqlite` under Bun (tests) and `better-sqlite3` under Electron (production). Neither path encrypts at rest yet. Schemas, migrations, and all query code are written against the abstraction and will not need to change when the encrypted driver lands.
- **Stage 3b (committed):** before v1 ships we **swap the driver to a SQLCipher-capable variant** — either `better-sqlite3-multiple-ciphers` once the build environment is consistent, or `@libsql/client` (MIT, encryption via key option). The swap is one-file (`sqlite.ts`) plus a `PRAGMA key` issued on open. Per-DB encryption key derived from the vault master key via HKDF (`@noble/hashes/hkdf.js`) with a per-DB info string. Stage 3b also wires the unencrypted-vs-encrypted bit into `vault.json` so the open path knows which mode to use.

#### OQ-35 — Language-aware tokenization
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md).
- **Question:** Do we use a stemmer / ICU tokenizer for FTS5, and how do we handle multilingual users?
- **Options:**
  - (a) `unicode61` only (current default). Simple; OK for many languages; bad for stemming-heavy ones (German, Russian).
  - (b) Snowball stemmers per detected language; per-row tokenizer choice.
  - (c) ICU tokenizer plus language detection at index time.
- **Tentative leaning:** (a) for v1; (b) when user feedback demands.
- **Blocking?:** No.

#### OQ-36 — Vector / semantic search  *[RESOLVED in 22 — promoted to v1]*
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md).
- **Resolution:** **(a) — yes, in v1.** Brainstorm ships local vector indexing alongside FTS5 from day one (sqlite-vec/sqlite-vss + a bundled local embedding model). Earlier "defer" leaning reversed by [22-ai-foundations.md](../platform/22-ai-foundations.md), which makes AI foundational rather than opt-in. The vector index unlocks semantic search and is the substrate for AI features that reference user data.

#### OQ-37 — File search depth and freshness
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md).
- **Question:** How deep does file search go, and how is the index kept fresh?
- **Options:**
  - (a) Filename + path only; indexed on grant, refreshed on demand.
  - (b) Filename + content excerpt for known formats (txt, md, pdf via an importer); indexed on grant + on file-system events when a watch capability is granted.
  - (c) Full content for all formats; importer apps register MIME-handlers that produce searchable text.
- **Tentative leaning:** (b). Useful by default; full-content indexing is opt-in via importer apps.
- **Blocking?:** No.

---

### Properties and schemas (added in 19)

#### OQ-38 — Collection scope in v1?  *[RESOLVED in 30]*
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Resolution:** Folders ARE collections. `scope: { kind: "collection", target: <folder-id> }` works against the canonical `brainstorm/Folder/v1` type designed in [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md). Collection scope ships in v1 along with the file manager.

#### OQ-39 — Conflict-resolution strictness for layered properties
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** Can a higher layer (e.g. user-scope) display-rename a canonical property (e.g. show "topics" instead of "tags"), without changing the underlying name?
- **Options:**
  - (a) No — names are global; renames create confusion across apps.
  - (b) Yes for display only — the property name in the data is unchanged, only the label rendered to the user differs.
  - (c) Yes — overlays can rename keys; the entities service maintains a bidirectional map.
- **Tentative leaning:** (b). Cosmetic flexibility without breaking the data layer.
- **Blocking?:** No.

#### OQ-40 — Formulas and rollups  *[RESOLVED-in-practice — shipped pre-1.0 in the Database app]*
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** When do computed properties (formulas, rollups) ship?
- **Options:**
  - (a) v2 alongside organizations and multi-user.
  - (b) Post-v2; never first-class — let an app provide them.
  - (c) v1 minimal (single-entity formulas only, no cross-entity rollups).
- **Tentative leaning (superseded):** (a) for formulas, post-v2 for rollups (rollups need the link traversal story to be very solid first).
- **Resolution (2026-07-18):** both shipped **pre-1.0**, well ahead of the leaning — as Database-app computed *view columns* rather than first-class vault properties, i.e. option (b)'s "an app provides them" shape delivered early instead of never. The formula + rollup engines and both column kinds landed under implementation-plan `9.12.17` (rollup engine 2026-06-05 on DT-3's typed relations; rollup column + three-step creation picker 2026-06-06; formula engine + column + authoring 2026-06-09/10), and shell **PR #183** (DT-4, 2026-07-18; CI green, merge pending the required owner review) completed the surface — the shared read-only computed cells now render on every card view (board / gallery / list) with full-vault relation wiring, not just the grid. Cross-entity rollups reuse the aggregation-footer reducers (`computeRollup` → `computeAggregation`), so the link-traversal soundness the leaning worried about is the same evaluated-membership machinery the views already trust. Promotion to first-class computed *properties* (visible outside Database, e.g. in other apps' inspectors) remains a v2 consideration.
- **Blocking?:** No.

#### OQ-41 — Vocabulary promotion suggestions
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** When the user creates a select property whose name matches an existing shared vocabulary, do we suggest using the existing one?
- **Options:**
  - (a) Yes, prominent suggestion ("Use existing 'Status'?").
  - (b) Yes but unobtrusive (in a "see related" pane).
  - (c) No — keep creation simple; promotion happens explicitly later.
- **Tentative leaning:** (b). Visible if relevant, never forced.
- **Blocking?:** No.

#### OQ-42 — Property migration tooling
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** What's the minimum-viable property migration flow for v1 (rename, change vocabulary, retype, multiplicity flip)?
- **Options:**
  - (a) Rename only (display label edit). v1.
  - (b) Rename + add/remove vocab values + delete + multiplicity-up (single → multiple). v1.
  - (c) Full migration: rename, retype, vocabulary swap, value remap, multiplicity-down (with explicit value picking). v2.
- **Tentative leaning:** (b) for v1, (c) for v2.
- **Blocking?:** No.

#### OQ-43 — Attachment GC visibility
- **Where:** [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).
- **Question:** When orphaned attachments are garbage-collected, is the reclamation silent or surfaced to the user?
- **Options:**
  - (a) Silent — GC is an implementation detail; no UI.
  - (b) Surfaced — a storage panel shows reclaimed space / pending GC.
- **Tentative leaning:** (a) for v1; revisit if storage pressure becomes a support issue.
- **Blocking?:** No (sync-era; not gating any current stage).

#### OQ-44 — Entity-id as routing token
- **Where:** [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).
- **Question:** Does the relay route per raw entity id, or per opaque hashed token so the relay never sees entity ids?
- **Options:**
  - (a) Raw entity id — simpler routing, relay sees ids.
  - (b) Hashed/opaque routing token — relay sees only tokens; aligns with per-entity permission revocation.
- **Tentative leaning:** (b) — entity ids can be sensitive; opaque tokens preserve relay-blindness.
- **Blocking?:** No (sync-era).

#### OQ-45 — Relay shard model for v2 hosted scale
- **Where:** [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).
- **Question:** What is the relay sharding model when the hosted sync service reaches v2 scale?
- **Options:**
  - (a) Shard by vault.
  - (b) Shard by routing-token hash range.
  - (c) Defer — single relay until scale demands otherwise.
- **Tentative leaning:** (c) for v1; (b) when hosted scale arrives.
- **Blocking?:** No (v2 hosted).

#### OQ-46 — Y.Doc tail-prune policy default
- **Where:** [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).
- **Question:** Is the 90-day Y.Doc update-tail retention default correct? Should it be longer, or configurable per-entity?
- **Options:**
  - (a) Fixed 90-day default.
  - (b) Configurable per-vault.
  - (c) Configurable per-entity.
- **Tentative leaning:** (a) for v1, with (b) as the first extension.
- **Blocking?:** No.

#### OQ-47 — "Leave a copy here" UX for selective sync
- **Where:** [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).
- **Question:** How is pinned-vs-evicted state for selective sync made discoverable ("leave a copy on this device")?
- **Options:**
  - (a) Per-entity pin affordance + a sync status indicator.
  - (b) Folder-level pin only.
- **Tentative leaning:** (a); aligns with selective-sync subscribe-a-subset model.
- **Blocking?:** No (sync-era).

#### OQ-48 — Label uniqueness in multi-value properties
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** Can the same label appear on multiple values in one property's value list (e.g. two "Home" phones)?
- **Options:**
  - (a) Yes — labels are non-unique. Two Home phones is fine.
  - (b) No — labels must be unique within a value list. Adding a second Home replaces the first.
  - (c) Configurable per PropertySchema.
- **Tentative leaning:** (a). Real-world data has duplicates; we shouldn't silently overwrite.
- **Blocking?:** No.

#### OQ-49 — Display options ↔ fancy-menus row mapping
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** Should display options for `entityRef` and `multiple text` map directly to fancy-menus row kinds (chip, item, etc.) so the same vocabulary works across menus and inline rendering?
- **Tentative leaning:** Yes — formalize the mapping so a "chip" display in one place looks the same in a menu.
- **Blocking?:** No.

#### OQ-50 — Derived-property expression language
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** Which expression language for derived properties?
- **Options:**
  - (a) JsonLogic — JSON-shaped, well-specified, several runtimes.
  - (b) CEL (Common Expression Language) — Google's, mature, type-safe.
  - (c) Custom DSL — full control, full maintenance burden.
- **Tentative leaning:** (b) CEL — type safety matches our typed property system; multiple runtimes available.
- **Blocking?:** No (v2 concern; pick when designing v2).

#### OQ-51 — Inverse cardinality-conflict UX
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** When setting an inverse property would violate cardinality (e.g. setting B.parent = A when B already has parent D, with `inverse.multiple: false`), what's the UX?
- **Options:**
  - (a) Prompt: "Replace D with A? (will remove B from D's children)". Explicit user choice.
  - (b) Silent fixup — replace D with A automatically.
  - (c) Fail — the user must explicitly remove from D first.
- **Tentative leaning:** (a). The user is in control; no surprise mutations.
- **Blocking?:** No.

---

### Layouts (added in 27)

#### OQ-85 — Layout-mode rules per context
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Question:** Are layout-mode rules **per-context** (e.g. `whiteboard` context forces `freeform`; `row` forces `stacked`), or free per layout?
- **Tentative leaning:** Per-context as a default with the option to override on the layout.
- **Blocking?:** No.

#### OQ-86 — Cell overlap in `freeform` mode
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Question:** Can cells overlap freely in freeform mode (z-ordering)?
- **Tentative leaning:** Yes with explicit z-index. Selection semantics: top cell wins; alt-click cycles through stack.
- **Blocking?:** No (v2 detail).

#### OQ-87 — Computed properties in layouts
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Question:** Can a Layout's `property` cell reference a derived (computed) property, or only stored properties?
- **Tentative leaning:** Yes when derived properties land in v2; cell rendering is read-only either way.
- **Blocking?:** No.

#### OQ-88 — Cross-app layout block cells
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Question:** Can a Layout's `block` cell point at a block from any installed app, or only the originating app's blocks?
- **Tentative leaning:** Any installed app, gated by the user's normal capability prompts on first encounter.
- **Blocking?:** No.

#### OQ-89 — Layout templates in the catalog
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Question:** Are user-authored layouts shareable as installable templates via the catalog?
- **Tentative leaning:** Yes in v2 — extends [14-app-store.md](../apps/14-app-store.md) with a "Layout pack" content kind.
- **Blocking?:** No.

#### OQ-90 — Canonical chrome-cell registry *[RESOLVED in implementation-plan Stage 8.4]*
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Question:** What is the canonical set of `chrome.kind` values, and is the set open (apps register their own chrome kinds) or curated (shell-defined only)?
- **Options:**
  - (a) Curated. Shell ships `actionBar`, `breadcrumb`, `meta`, `windowControls`, `entityHeader`, `tabs`. New ones added in shell releases.
  - (b) Open. Apps register chrome kinds (e.g. `io.example.tasks/burndown-bar`). Risk of namespace bloat.
- **Resolution: (a) — shell-curated and closed.** The six kinds `ChromeKind` froze in 8.1 are the whole set; an app cannot register a seventh. A chrome cell is *shell-rendered by definition* — it draws with the active theme, opens menus through the shared runtime, and carries the shell's a11y semantics; a kind an app defined would have none of that. An open set would also make a layout's portability depend on which apps happen to be installed, which defeats "layouts are data you can move". The escape hatch already exists and is honest about what it is: a `block` cell the app renders itself, with no pretence of being shell chrome. Enforced structurally — `renderChromeCell` (`@brainstorm-os/sdk/layout-chrome`) is exhaustive over `ChromeKind`, so a new kind is a compile error until it has a renderer.
- **Blocking?:** Was blocking for the chrome-cell rendering pipeline; resolved before 8.4 landed.

---

### Authoring / shell-as-framework (added in 26)

#### OQ-80 — Managed payments service *[RESOLVED in 43-monetisation-strategy.md]*
- **Where:** [26-shell-as-framework.md](../apps/26-shell-as-framework.md); resolution in [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md).
- **Question:** Does Brainstorm offer an optional "managed payments" service that bundles Stripe Connect for developers who don't want to set it up themselves?
- **Resolution:** **Yes, but post-v2.** "Brainstorm Commerce" ships as an opt-in managed-payments service after v2's catalog matures. Surcharge is processor-passthrough (2.9% + $0.30 per transaction, plus an optional 1% for MoR-style tax remittance) on top of the standard 15% / 0%-under-$10k platform fee. Self-managed developers remain first-class; the catalog never preferentially ranks Commerce-using apps.

#### OQ-81 — Platform fee rate *[RESOLVED in 43-monetisation-strategy.md]*
- **Where:** [26-shell-as-framework.md](../apps/26-shell-as-framework.md); resolution in [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md) and concrete schedule in [44-pricing.md §Catalog economics](../platform/44-pricing.md).
- **Question:** What % does the official catalog take on mediated purchases?
- **Resolution:** **0% under $10k/year of catalog revenue per developer, 15% above** (applies only to revenue above the threshold, not retroactively). Sideload installs incur 0% always. Threshold is per Ed25519 publisher key, rolling 12 months, computed on gross revenue at end-of-month billing close. No 30% tier ever; rate changes require board-level review.

#### OQ-82 — Review pipeline transparency
- **Where:** [26-shell-as-framework.md](../apps/26-shell-as-framework.md).
- **Question:** How transparent is the review process to developers? Should they see all flags or only blocking issues?
- **Tentative leaning:** Full transparency — all flags visible, with severity levels. Developers fix or appeal.
- **Blocking?:** No.

#### OQ-83 — Dev signing key vs published app signing key
- **Where:** [26-shell-as-framework.md](../apps/26-shell-as-framework.md).
- **Question:** When a project graduates from dev mode to a published app, is its signing key the same key, or does publishing constitute a key-rotation event?
- **Tentative leaning:** Same key (continuity for users who shared early via link); rotation explicit if developer wants.
- **Blocking?:** No.

#### OQ-84 — AI assistant in Code Editor
- **Where:** [26-shell-as-framework.md](../apps/26-shell-as-framework.md).
- **Question:** Does the Code Editor app embed an AI assistant from v1?
- **Tentative leaning:** Yes — natural fit; the AI broker exists; assists with scaffolding, code completion, prompt-injection-aware code review.
- **Blocking?:** No.

#### OQ-234 — Agent-authored apps: the agent's tool palette includes "build me an app"
- **Where:** [26-shell-as-framework.md](../apps/26-shell-as-framework.md), [55-agent-app.md](../apps/55-agent-app.md), [47-marketplace.md](../apps/47-marketplace.md), [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** Can the Agent app's tool palette extend over the **Code Editor + Files + AppInstaller** surface so users can build personal apps conversationally — *"build me an app that pulls my Tasks and weekly Journal into a Friday review"* → working draft → install through the standard capability-grant flow — and if so, what's the trust / build / tier shape?
- **Why it surfaces now:** the building blocks are already either landed or scheduled. AppInstaller + capability ledger landed in Stage 5; AppProject entity type is specified in doc 26; Code Editor app is on the Stage-26 roadmap; the Agent app + agent loop (doc 55) lands gated on Stage 11 (AI broker) + 11b (agent-loop). Marketplace MVP (14.17/18) already ships the install surface. The novel combination is **dispatching `apps.scaffold` / `files.write` / `apps.installFromProject` as intents from the agent loop**, against an `AppProject/v1` entity — the same loop that drives Mailbox / Database / Browser in doc 55. This is distinct from OQ-84 (which is *AI assists a human writing code in the editor*); here the agent is the author.
- **Trust loop (the non-negotiable):** the agent **never grants capabilities** — it proposes a manifest, and the proposed cap set is reviewed by the user at install time on the **same `AppInstaller` surface** as any marketplace app. This preserves [09 §Fail-closed](../security/09-security-and-sandbox.md): the cap ledger is still the single grant authority; the agent is just a (privileged-but-not-trusted) source of `.brainstorm` bundles. Concretely the agent dispatches into a sandbox project that has *no* runtime caps until the user clicks install — a malicious / prompt-injected agent can write source code but cannot make it run with privileges the user didn't approve.
- **Two candidate tiers — pick one or both:**
  1. **Full apps** (= same as today's `apps/*`): manifest, built bundle, capability declarations, signed, full sandboxed renderer. Heavy. The right fit when the user wants to keep, version, or share. Goes through the existing `AppInstaller` + (optionally) the marketplace publish flow.
  2. **User scripts / interpreted apps**: a no-build, interpreted TSX surface running in a sandbox renderer with a tightly bounded default cap set (e.g. `entities.read.scope:Personal` + `intents.dispatch:open` and nothing else). Lives as a sibling-of-AppProject entity, hot-reloads from Files, never needs a bundler. The right fit when the user said *"just give me this view for today"* and won't ever publish it.

  Shipping only (1) is honest but raises the floor — every conversational app pays for a build step. Shipping only (2) is cheap but creates a second app trust class the user has to reason about. **Tentative leaning:** ship (2) first as the "conversational app" tier and treat (1) as the existing developer path (doc 26 unchanged); a "graduate to a full app" action distills tier-(2) into tier-(1), mirroring doc 55's "save chat as automation" pattern.
- **Open sub-questions to resolve before this lands:**
  - **OQ-234a — Build pipeline location.** Interpreted runtime in-shell (esbuild-WASM stays out; transform-at-load); esbuild bundled into the shell main; or agent shells out to a packaged CLI? Tier-(2) probably means interpreted; tier-(1) needs a real bundler. Bundler-in-shell adds ~5–8 MB to the shell binary — measure against Stage-12 startup / size budgets before committing.
  - **OQ-234b — Capability-proposal UX.** Does the agent generate a manifest and *explain* each cap to the user inline ("this app wants `entities.write:Note` because you asked it to add a daily summary note"), or does the user write the cap list themselves? The former is the point of conversational authoring; the latter is the doc-26 status quo. The "explain" path is also a prompt-injection surface — a malicious agent can write a justification the user trusts. Mitigation: the cap-grant prompt always shows the *raw* cap list independent of the agent's narration.
  - **OQ-234c — Surface ownership.** Does this live in the Agent app, the Code Editor app, or both? Likely both: the Agent app is the conversational seam ("build me X"); the Code Editor app is where the user inspects / edits what the agent produced. They share the `AppProject/v1` entity; the agent's edits show up live in the Code Editor.
  - **OQ-234d — Marketplace path for agent-authored apps.** Can a tier-(1) app authored by the agent be published? Signing-key ownership lands on the user (OQ-83 already covers dev→published key continuity); the open piece is whether the catalog flags "agent-authored" provenance, since the AI-assisted-review path in doc 26 may need to weight those bundles differently. Tentative: yes-but-flagged; review pipeline already has hooks.
  - **OQ-234e — Memory & quota model.** Agent-authored sessions burn AI broker tokens; tier-(2) apps that hot-reload on save may re-invoke the agent on every edit cycle. The per-app cost cap in `Conversation/v1` already exists; this OQ just confirms it covers app-authoring conversations the same way it covers normal chats.
- **Blocking?:** No. **Out of scope until Stage 11 + 14 land** (AI broker + marketplace + Code Editor app). Recorded now because the architecture has to leave room for it — specifically, the `AppInstaller` cap-grant prompt and the `AppProject/v1` entity type are the load-bearing primitives, and both should be designed so an agent-driven caller is just another consumer of them, not a new code path. If `AppInstaller` grows agent-specific branches, this OQ has been answered wrong.

---

### Localization (added in 21)

#### OQ-52 — Screenshot context for translators
- **Where:** [21-localization.md](../platform/21-localization.md).
- **Question:** Required, recommended, or optional in v1?
- **Tentative leaning:** Optional in v1; recommended in v2.
- **Blocking?:** No.

#### OQ-53 — RTL test coverage strategy  *[RESOLVED in implementation-plan Stage 12.5 shell-half (2026-05-24)]*
- **Where:** [21-localization.md](../platform/21-localization.md).
- **Question:** Visual-regression diffs (snapshots in both LTR/RTL) or runtime checks?
- **Position taken:** Playwright shell-smoke set under `tests/visual/specs/rtl-shell-smoke.spec.ts` — flips `<html dir="rtl">` on the real shell, asserts geometric mirroring (panel/sidebar rects) + computed-transform on a stamped SVG + structural survival (Settings still renders end-to-end). No per-app visual regression at v1 — app authors do manual testing per the tentative leaning. The 12.5b apps sweep can extend the same spec or add per-app variants if a regression slips.
- **Blocking?:** No.

#### OQ-54 — Translation-service integration
- **Where:** [21-localization.md](../platform/21-localization.md).
- **Question:** Bundle a specific service (Crowdin / Lokalise / Weblate) into the workflow, or stay service-agnostic?
- **Tentative leaning:** Stay agnostic; document recipes for several.
- **Blocking?:** No.

#### OQ-55 — Plural-rule coverage
- **Where:** [21-localization.md](../platform/21-localization.md).
- **Question:** Confirm FormatJS / `Intl.PluralRules` cover the languages we plan to support (Welsh: 6 forms; Russian: 4; Arabic: 6).
- **Tentative leaning:** Yes — FormatJS uses CLDR rules; coverage is comprehensive.
- **Blocking?:** No (validation, not design).

---

### AI foundations (added in 22)

#### OQ-56 — Third-party provider plugins
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** Can third parties plug in new AI providers (e.g. an enterprise's internal LLM gateway)?
- **Tentative leaning:** No in v1; yes in v2 via org-managed provider config.
- **Blocking?:** No.

#### OQ-57 — Default local model and disk budget
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** Which local model ships, and at what disk-size budget?
- **Options:** Llama 3.2 1B (~700MB), 3B (~2GB), platform-native (macOS Foundation Models / Phi Silica), or no default with download-on-first-use.
- **Tentative leaning:** download-on-first-use of a small (~1B) model so initial install stays light; user can swap.
- **Blocking?:** Yes for shell installer size.

#### OQ-58 — Offline fallback policy
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** When cloud providers are unreachable, do features fall back to local, fail explicitly, or queue?
- **Tentative leaning:** Per-feature: search and classification fall back silently; generation surfaces "offline; switch to local model?" and user decides.
- **Blocking?:** No.

#### OQ-59 — Prompt-injection filtering aggressiveness
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** Default behavior on detected injection patterns: warn / block / pass?
- **Tentative leaning:** Warn by default; user can configure block or pass.
- **Blocking?:** No.

#### OQ-60 — Platform-managed AI brokering
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** Does Brainstorm offer pay-as-you-go AI brokering for users who don't want to manage keys, or stay strict BYO-only?
- **Tentative leaning:** v2 offers it as opt-in; v1 is BYO-only.
- **Blocking?:** No.

#### OQ-61 — Vector extension choice  *[RESOLVED in implementation-plan Stage 11.1 — 2026-05-28]*
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** `sqlite-vec` (newer, simpler) or `sqlite-vss` (more mature)?
- **Tentative leaning:** `sqlite-vec` — actively maintained, native syntax integration.
- **Resolution (11.1):** **`sqlite-vec`.** This is an ecosystem/maintenance call, not a perf-benched one — the 11.0 spike landed only its FTS5 (lexical) half; the vector half was deferred, so there are no comparative vector numbers yet. The decision is taken now to unblock **11.2** (vector index alongside lexical): `sqlite-vss` is effectively superseded and no longer actively maintained, while `sqlite-vec` is the author's current, actively-developed successor with native SQL-syntax integration and a far simpler build/load story (single loadable extension, no faiss dependency) — exactly the integration profile that keeps the v1 build pipeline lean (consistent with the OQ-128 FTS5-for-v1 posture: stay inside SQLite, add native binaries only when measured need justifies them). Vector query latency + recall get measured in-context during **11.2** against the same `BenchEngine`-style harness; if `sqlite-vec` misses a budget there, that's an 11.2 finding, not a reason to pre-adopt the unmaintained alternative.
- **Blocking?:** No longer — `sqlite-vec` is the committed v1 vector extension; 11.2 builds on it.

#### OQ-62 — Local embedding model choice  *[RESOLVED in implementation-plan 11.3, 2026-07-03 — `bge-small-en-v1.5`, first-run download]*
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** Which embedding model bundles with the shell?
- **Options:** `bge-small` (~130MB, English-strong), `all-MiniLM-L6-v2` (~80MB, English), `multilingual-e5-small` (~470MB, multilingual), platform-native.
- **Resolution:** **`bge-small-en-v1.5`** (~130MB, 384-d, English) via a custom napi-rs/`fastembed-rs` addon — user-chosen (2026-07-03). `multilingual-e5-small` (470MB) was rejected as too heavy for the download; MiniLM/bge/e5 are **all 384-d**, so switching among them is a one-line change to the `EmbeddingModel` variant with **no vec0-table migration** — multilingual is a later swap once the product goes past English. **Not bundled** — weights are downloaded on first run into `userData/models` (keeps the installer small; the offline-first story is the deferred first-run-download UX + OQ-58). This also settles the OQ-57 disk-budget concern for embeddings: nothing ships in the installer.
- **Blocking?:** Was yes (installer / first-launch UX). Resolved.

#### OQ-65 — Biome's TypeScript rule coverage gap
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Biome covers most lint needs but is still catching up to typescript-eslint for advanced rules. How do we handle the gap?
- **Options:**
  - (a) Run Biome + a minimal typescript-eslint config for missing rules; accept the slowdown on those checks.
  - (b) Wait for Biome parity before enforcing those rules.
  - (c) Implement gap rules as standalone lightweight checks in `brainstorm-cli`.
- **Tentative leaning:** (c) for must-have rules (no-hardcoded-strings is essential), (b) for nice-to-haves.
- **Blocking?:** No.

### Output (added in 23)

#### OQ-67 — App-shipped themes
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Can apps ship custom themes (or theme components — token sets, icon packs, typography)? Trust scope?
- **Partial resolution (in 40):** Standalone theme distribution is now spec'd in [40-theme-store.md](../apps/40-theme-store.md) — themes (and their components) install through the same store/manifest/signing infrastructure as apps. The remaining open question is **app-bundled themes**: can an app package include a theme payload that applies app-focused only (not shell-wide)?
- **Tentative leaning:** Yes for app-focused use (apply when this app is focused, requires explicit user accept); shell-wide adoption requires the theme to be installed as a standalone theme entity via [40](../apps/40-theme-store.md).
- **Blocking?:** No.

#### OQ-71 — Default icon pack  *[RESOLVED in 13]*
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Resolution:** **Phosphor**, installed via the [shadcn icon registry](https://www.shadcn.io/icons/ph). Six weight variants (thin / light / regular / bold / fill / duotone), ~1,200 icons under MIT. Shadcn registry path means individual icons land in the source tree on demand rather than as a single fat dependency — tree-shaking is automatic since each icon is its own component.

#### OQ-72 — Raster fallbacks for icons at small sizes
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Do icon packs need pre-rendered raster fallbacks for sub-16px sizes where SVG hinting is poor?
- **Tentative leaning:** No for v1; SVG is fine at the sizes the shell uses. Revisit if antialiasing surfaces a problem.
- **Blocking?:** No.

#### OQ-68 — PDF/A archival mode
- **Where:** [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md).
- **Question:** Do we support PDF/A (1, 2, 3) archival output?
- **Tentative leaning:** v2 — driven by org-compliance demand.
- **Blocking?:** No.

#### OQ-69 — Header / footer themability
- **Where:** [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md).
- **Question:** Can orgs (in v2) override the default header/footer template, or is it shell-default with a small slot for user customization?
- **Tentative leaning:** Shell-default for v1, configurable slot in v2 with org-defined defaults.
- **Blocking?:** No.

#### OQ-70 — Tagged-PDF source semantics
- **Where:** [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md).
- **Question:** How does a custom Lexical node declare its structural role (heading? list item? figure?) for tagged-PDF output?
- **Tentative leaning:** Custom nodes declare a `pdfRole` attribute; the print driver maps it.
- **Blocking?:** No.

### Shortcuts (added in 24)

#### OQ-73 — Modal sequences (chord-of-chords)
- **Where:** [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md).
- **Question:** Does v1 support modal sequences (e.g. VS Code's `⌘K ⌘S` to open keybindings)?
- **Tentative leaning:** Post-v1; ship single-chord bindings only at first.
- **Blocking?:** No.

#### OQ-74 — Default-rebinding handling on app update
- **Where:** [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md).
- **Question:** When an app update changes a default chord, what happens to existing user customizations?
- **Options:** (a) preserve user override always; (b) preserve only if user had explicitly customized this binding; (c) prompt on update.
- **Tentative leaning:** (a). Updates should never overwrite user customizations.
- **Blocking?:** No.

#### OQ-75 — Cheatsheet contextual filtering
- **Where:** [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md).
- **Question:** Does the cheatsheet show ALL bindings or only those reachable from the current context (focused element / app / window)?
- **Tentative leaning:** Show all, with the active-context bindings ranked first and visually emphasized.
- **Blocking?:** No.

#### OQ-235 — Page-lock chord vs `shell/appearance.toggle` *[RESOLVED in implementation-plan B11.6]*
- **Where:** [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md); implementation-plan `B10` (appearance modes) and `B11.6` (editor parity ladder, Notes 9.6).
- **Question:** A common reference binding for page-lock is `Ctrl+Shift+L`, which on a Mac normalises to `Cmd+Shift+L` — but our `B10` (2026-05-23) already bound `Cmd+Shift+L` to `shell/appearance.toggle` (light/dark mode). Where does page-lock land?
- **Options:**
  - (a) **Keep `Cmd+Shift+L` on `appearance.toggle`; pick a different chord for page-lock** (candidates: `Cmd+Alt+L`, `Cmd+Shift+P`, dedicated unmodified F-key). Mac users learn the deviation from common reference bindings; muscle-memory cost is low.
  - (b) **Move `appearance.toggle` to a different chord; give page-lock `Cmd+Shift+L`**. Costs B10 users a re-learn; benefits a small population (sysadmins / muscle-memory parity).
  - (c) **Make page-lock platform-asymmetric**: `Ctrl+Shift+L` literally on every OS (not Mac-normalised). Reads as "the system-wide lock chord" from Windows/Linux; on Mac it's an unusual chord and doesn't collide. The shortcut registry already supports raw-modifier-key bindings.
- **Tentative leaning:** (a). The appearance toggle is invoked far more often than page-lock; OS-flip is a daily action while page-lock is rare-and-deliberate. Page-lock takes `Cmd+Alt+L` (`L` for "lock", `Alt` to telegraph "intentional state change").
- **Blocking?:** No — but gates `B11.6` (Notes shortcut-coverage rung). Resolve in the same turn `B11.6` starts.
- **Resolved (2026-06-08, B11.6):** (a). `ActionId.ToggleNoteLock` binds `Mod+Alt+l`; `Mod+Shift+L` stays on `shell/appearance.toggle`. The notes shortcut matcher (`use-shortcut.ts`) gained an Alt+letter `event.code` fallback (`Option+L` emits a dead `key` on macOS but `code` stays `KeyL`), generalising the existing Alt+digit handling. The chord toggles the existing per-note page-lock (B11.11).

---

### Keyboard accessibility (added in 61)

#### OQ-KBN-1 — Roving `tabindex` vs `aria-activedescendant` as the default
- **Where:** [61-keyboard-accessibility.md](../shell/61-keyboard-accessibility.md); implementation-plan `KBN-1`.
- **Question:** Which focus model is the default for composite listboxes / grids / trees in `useCompositeKeyboard`?
- **Options:**
  - (a) **Roving `tabindex`** — the active item has `tabindex="0"`, the rest have `tabindex="-1"`. Real DOM focus moves. Predictable for `:focus-visible`, screen readers, and scroll-into-view. Breaks down when items aren't in the DOM (virtualization).
  - (b) **`aria-activedescendant`** — DOM focus stays on the container, the "active" item is named by id on the container. Works with virtualization. Less predictable for `:focus-visible`; needs JS twin (`useFocusVisible`).
  - (c) **Roving `tabindex` default, `aria-activedescendant` opt-in** for virtualized composites (launcher results, Files / Database grids, find-bar result counter).
- **Tentative leaning:** (c). Pure-DOM composites are 90% of the surface; the 10% that virtualize opt in.
- **Blocking?:** No (a leaning lets `KBN-1a` ship); resolve when first virtualized composite adopts.

#### OQ-KBN-2 — Region-navigation key
- **Where:** [61-keyboard-accessibility.md](../shell/61-keyboard-accessibility.md); implementation-plan `KBN-1` + `KBN-S-settings`.
- **Question:** Which key cycles between major regions (`F6` is the Windows / VS Code convention; macs map it to `fn+6` which is awkward)?
- **Options:**
  - (a) **`F6` / `Shift+F6` everywhere** — matches Windows / web / VS Code; macOS users learn the function-row deviation.
  - (b) **`F6` on Windows/Linux, `Ctrl+F6` on macOS** — platform-asymmetric, like `Cmd+,` for preferences. Costs are: harder docs, two chords in the cheatsheet.
  - (c) **`Ctrl+F6` / `Ctrl+Shift+F6` everywhere** — uniform, no platform branch, but unfamiliar.
- **Tentative leaning:** (a). The chord registry already supports user-rebinding per [24]; macOS users who want a friendlier chord can rebind locally.
- **Blocking?:** No.

#### OQ-KBN-3 — `Escape` stack delivery layer *[RESOLVED in implementation-plan KBN-2]*
- **Where:** [61-keyboard-accessibility.md](../shell/61-keyboard-accessibility.md); implementation-plan `KBN-2`.
- **Question:** Is the overlay-closer stack a renderer-only data structure, or a main-process broker?
- **Options:**
  - (a) **Renderer-only** — every overlay opens / closes in the same renderer; the stack is a module-level singleton. Per-window scope is what users expect. No IPC round-trip; `Escape` latency is identical to today.
  - (b) **Main-process broker** — cross-window stack semantics (a popover in window A blocks `Escape` in window B). Users do not expect this; introduces cross-window coupling.
- **Resolution:** (a) — renderer-only, per-window scope, no main-process round-trip. `getEscapeStack()` is a module-scope singleton in `@brainstorm/sdk/a11y`; one instance per renderer means the shell and each sandboxed app each own a private stack. `installEscapeHandler` wires a single document-level `keydown` capture listener (mounted by the shell in `dashboard.tsx`); when the stack is empty the event is left to propagate so the existing chord-registry `Escape` bindings — including the eventual app-side `app/escape` — keep working unchanged. No IPC, no cross-window coupling, no measurable latency change.
- **Blocking?:** No.

#### OQ-KBN-4 — `:focus-visible` polyfill
- **Where:** [61-keyboard-accessibility.md](../shell/61-keyboard-accessibility.md); implementation-plan `KBN-1b` + `KBN-1c`.
- **Question:** Does v1 need a `:focus-visible` polyfill to support older Electron / Chromium versions?
- **Options:**
  - (a) **No polyfill** — Electron 41 / Chromium 122+ supports `:focus-visible` natively on every v1 target.
  - (b) **Polyfill anyway** — costs ~2 KB; defensive against an Electron downgrade for performance reasons.
- **Tentative leaning:** (a). The minimum-Electron contract is forward-locked by other primitives (`unsafe-eval` per [[feedback_pixi_unsafe_eval_in_sandbox]], `before-input-event` per [24]).
- **Blocking?:** No.

#### OQ-KBN-5 — Single-key chord vs composite type-ahead collision
- **Where:** [61-keyboard-accessibility.md](../shell/61-keyboard-accessibility.md); [24-keyboard-shortcuts.md §Single-key suppression](../shell/24-keyboard-shortcuts.md#single-key-suppression-in-input-contexts).
- **Question:** A single-key chord (`?`, `j`, `k`, `/`) collides with type-ahead inside a focused composite list (the launcher, the cheatsheet, a database list view). Who wins?
- **Options:**
  - (a) **Composite type-ahead wins** when a composite is the focused element (extension of [24]'s text-input suppression to composites).
  - (b) **Chord wins everywhere** — type-ahead requires a modifier.
  - (c) **Composite type-ahead wins only on alphabetic single-keys**; semantic keys (`?`) always fire the chord.
- **Tentative leaning:** (a). Matches the [24] precedent and what users expect when they're typing into a list.
- **Blocking?:** No.

#### OQ-KBN-6 — Default-on region nav vs opt-in
- **Where:** [61-keyboard-accessibility.md](../shell/61-keyboard-accessibility.md); implementation-plan `KBN-1` + per-app `KBN-A-*`.
- **Question:** Does every app window get F6 region nav by default, or is it opt-in per app?
- **Options:**
  - (a) **Default-on** with the four-region shell template (`app-header`, `app-nav-sidebar`, `app-main`, `app-inspector`); apps with a different shape register their own regions; apps with only one region are F6-no-op.
  - (b) **Opt-in** — every app must call `useRegionNavigation` itself.
- **Tentative leaning:** (a). The four-region shape is universal across Notes / Files / Database / Tasks / Calendar / Whiteboard / Bookmarks; default-on means no app has to remember.
- **Blocking?:** No.

---

### Settings (added in 25)

#### OQ-76 — Per-device vs per-user default boundary
- **Where:** [25-settings.md](../shell/25-settings.md).
- **Question:** When a setting is structurally ambiguous (e.g. "sound on/off"), should it default to per-device or per-user?
- **Tentative leaning:** Per-user unless inherently device-bound (sync transport endpoints, selective-sync policy, local-model paths).
- **Blocking?:** No.

#### OQ-77 — Settings cleanup on org leave
- **Where:** [25-settings.md](../shell/25-settings.md).
- **Question:** When a user leaves an org, what happens to org-scoped settings overrides they were observing?
- **Tentative leaning:** Org-overlay simply disappears from layered resolution; user's personal overrides remain unaffected. No prompt needed.
- **Blocking?:** No.

#### OQ-78 — Settings export/import
- **Where:** [25-settings.md](../shell/25-settings.md).
- **Question:** Can users export their settings to a file and import elsewhere (manual backup / migration)?
- **Tentative leaning:** Post-v1 nice-to-have; v1 ships sync-only.
- **Blocking?:** No.

#### OQ-79 — Settings search ranking
- **Where:** [25-settings.md](../shell/25-settings.md).
- **Question:** Does the settings search match descriptions (full text), not just labels? Likely yes; affects ranking.
- **Tentative leaning:** Yes, hybrid lexical + label-priority.
- **Blocking?:** No.

---

#### OQ-66 — Prior-art library audit  *[RESOLVED in 13]*
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Resolution:** audit completed against a comparable local-first knowledge product's production dependencies; 12 library categories added in 13's "Domain-specific libraries" section (HTML sanitization, whiteboard/excalidraw, KaTeX, d3, libphonenumber-js, file-type, image processing, animation, filename sanitization, disk-space, pako, diff). Non-adoptions documented (MobX, telemetry, react-virtualized, prismjs, sha1, electron-remote/store/window-state). Camera / scanning / OCR / audio recording remain per-app concerns; not v1-blocking.

#### OQ-64 — File entity sub-types
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** Do we ship sub-types like `brainstorm/Image/v1`, `brainstorm/Video/v1`, `brainstorm/Audio/v1` that extend `brainstorm/File/v1` with tighter constraints, or stay with one File type and let `entityFilter`/`mimeType` narrow as needed?
- **Options:**
  - (a) One File type; everything is a `File`. `mimeType` distinguishes. Simpler.
  - (b) Sub-types for common kinds. Better display defaults; richer schema (Image gets `width`/`height` properties for free).
  - (c) Hybrid: `File` is canonical; sub-types extend it where there's a meaningful schema gain.
- **Tentative leaning:** (c). Image and Video are common enough to deserve dedicated schemas with intrinsic properties; rare formats stay as plain Files.
- **Blocking?:** No (can add sub-types later without breaking existing data).

#### OQ-63 — AI quota granularity
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** How granular are user-set quotas — per-app, per-feature within an app, per-time-window?
- **Tentative leaning:** Per-app + monthly window in v1; per-feature in v2.
- **Blocking?:** No.

---

#### OQ-31 — Clipboard history
- **Where:** [17-interoperability.md](../platform/17-interoperability.md).
- **Question:** Does the shell maintain a clipboard history surface (paste from N items ago)?
- **Options:**
  - (a) Yes, with a privacy mode that excludes specific apps.
  - (b) No — clipboard is ephemeral as the OS provides it.
  - (c) An app can publish a clipboard-history widget; the shell does not host it.
- **Tentative leaning:** (c). Useful but a privacy concern; let an app own it with explicit capability.
- **Blocking?:** No.

---

### Architectural pressure points (added 2026-05-10 review)

#### OQ-91 — Chrome cell capability gating
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Question:** Chrome cells render shell-provided structural elements inside the host app's renderer; their *contents* (intent buttons, parent breadcrumbs, provenance) reach across data the host may not have read access to. A user-scoped Layout authored by a layout-editor app can drop chrome cells on entities the layout author has no business inspecting.
- **Tentative leaning:** Per-context capability for `chrome.kind` rendering; chrome contents redacted per the *host app's* capabilities (not the layout author's).
- **Blocking?:** Yes — defines the layout-as-data trust model.

#### OQ-92 — Layout cell with missing referent
- **Where:** [27-layouts.md](../shell/27-layouts.md), [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Tentative leaning:** Render fallback marker; flag in audit log; validation is render-time, not save-time.
- **Blocking?:** Yes for the layout resolver.

#### OQ-93 — AI broker capability subject and trust boundary
- **Where:** [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Tentative leaning:** Dedicated AI worker process with its own audit log; broker reads recorded distinctly from app reads.
- **Blocking?:** Yes for the AI subsystem design.

#### OQ-94 — Concurrent key rotation vs. in-flight Yjs updates
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md), [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).
- **Tentative leaning:** Accept and re-encrypt: late update under retired DEK is decrypted with retained key, applied, re-encrypted under new DEK for outbound.
- **Blocking?:** Yes for encryption + sync interaction.

#### OQ-95 — Concurrent overlay creation with different value types
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Tentative leaning:** Effective-schema validation is read-time when overlay arrives after a write; surface mismatches rather than coerce.
- **Blocking?:** No.

#### OQ-96 — Bottom-out layouts for layout/schema/vocab/theme entities
- **Where:** [27-layouts.md](../shell/27-layouts.md).
- **Tentative leaning:** Shell ships hardcoded React components for editing meta-types.
- **Blocking?:** No.

#### OQ-97 — `schema.read:<type>` capability distinct from `entities.read:<type>`
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Tentative leaning:** Yes — separate capability so layout editors / AI broker can read schemas without instance access.
- **Blocking?:** Yes for capability matrix.

#### OQ-98 — Vector index nondeterminism across devices
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md).
- **Tentative leaning:** Document as accepted property of the system.
- **Blocking?:** No.

#### OQ-99 — Corrupt-overlay cascade prevention
- **Where:** [19-properties-and-schemas.md](../data/19-properties-and-schemas.md), [27-layouts.md](../shell/27-layouts.md).
- **Tentative leaning:** Drop to next-most-specific layer if any overlay fails; surface in audit log; never error to the user.
- **Blocking?:** Yes for resolver implementations.

#### OQ-100 — `mock-shell-dock` isolation model
- **Where:** [26-shell-as-framework.md](../apps/26-shell-as-framework.md).
- **Tentative leaning:** Separate sandbox by default.
- **Blocking?:** No.

---

### Performance budget revisions (added 2026-05-10 review)

#### OQ-101 — Cold-start budget split
- **Where:** [12-shell-architecture.md](../shell/12-shell-architecture.md).
- **Tentative leaning:** Split into "Shell ready" (300ms warm-cache) vs "Dashboard interactive" (500-800ms cold).
- **Dogfood evidence (2026-06-27, weak):** the app-sweep `012-all-apps-smoke` opened all 20 apps back-to-back and **5 of the heavier apps (ThemeEditor / Agent / Automations / Mailbox / FormDesigner) exceeded a 20s open-wait** while opening fine one-at-a-time (`021`/`022`/`024`) — see [friction-log](../dogfood/friction-log.md) **F-293**. This is a **confounded** signal, not a clean measurement: the smoke holds all prior renderers open (no teardown), so it's cold-open *under a 10–20-renderer pile-up*, not steady-state cold-start. The takeaway worth keeping: per-app *cold-window-open* latency (distinct from dashboard-interactive) is the missing third budget, and the *heavier* apps dominate it under memory pressure. A clean number needs a close-between-opens harness (relates to OQ-150 V8 snapshots). Not beta-blocking.
- **Blocking?:** No.

#### OQ-102 — `entities.getMany` / `subscribeMany` for v1 SDK
- **Where:** [08-app-sdk.md](../apps/08-app-sdk.md), [12-shell-architecture.md](../shell/12-shell-architecture.md).
- **Tentative leaning:** Yes — required for any list-shaped UI.
- **Blocking?:** Yes for v1 SDK.

#### OQ-103 — Per-renderer RAM budget revision
- **Where:** [12-shell-architecture.md](../shell/12-shell-architecture.md).
- **Tentative leaning:** Revise <80MB to 120-200MB.
- **Blocking?:** No.

#### OQ-104 — Shell bundle size with shared platform libraries
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Tentative leaning:** Shell-specific code <80KB gz; shared platform libs as a separate baseline (~250KB) loaded once and reused across apps.
- **Blocking?:** No.

#### OQ-105 — Vector index lag at write rate
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md), [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Tentative leaning:** Embedding-batching; "bulk import" mode that defers indexing.
- **Blocking?:** No.

#### OQ-106 — Shared platform-library version negotiation
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Tentative leaning:** SDK-major pins exact platform-lib versions; apps may bundle own React as escape hatch.
- **Blocking?:** No.

---

### Vault and onboarding (added in 28)

#### OQ-107 — Read-only vault opening
- **Where:** [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).
- **Question:** Allow opening a vault read-only (look without committing) so a user can browse another vault from their current session?
- **Tentative leaning:** v2; defer unless real demand.
- **Blocking?:** No.

#### OQ-108 — Packaged single-file vault format
- **Where:** [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).
- **Question:** Ship a "package vault" command producing a single signed `.brainstorm-vault` archive (vs. raw directory tar)?
- **Tentative leaning:** v2 — useful for sharing / backup but not v1-essential.
- **Blocking?:** No.

#### OQ-109 — Cross-vault identity linking
- **Where:** [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).
- **Question:** A user with two vaults wants their identity recognized as "the same person" across both. Mechanism?
- **Tentative leaning:** v2 — ties into consumer accounts and org membership.
- **Blocking?:** No (v1 keeps vaults strictly independent).

#### OQ-110 — Vault format break-cadence
- **Where:** [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).
- **Question:** How often can vault format break across major versions, and when do we ship a separate migration tool for very old vaults?
- **Tentative leaning:** Rare format breaks (every 1-2 years); migrate one major forward; refuse vaults more than two majors old and point to migration tool.
- **Blocking?:** No.

#### OQ-111 — Default vault location per platform
- **Where:** [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).
- **Question:** Where do we default vaults? `~/Documents/Brainstorm/` (visible, user-friendly) vs `~/Library/Application Support/Brainstorm/` (hidden, system-conventional) vs `~/Brainstorm/` (top-level).
- **Tentative leaning:** `~/Documents/Brainstorm/<name>` on macOS/Windows; `~/Brainstorm/<name>` on Linux. User can pick anywhere.
- **Blocking?:** No.

#### OQ-112 — Vault discovery on "Add vault"
- **Where:** [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).
- **Question:** Does the shell scan likely paths for `vault.json` files when adding a vault, or always require manual directory pick?
- **Tentative leaning:** Manual pick by default; an opt-in "Scan for vaults" affordance for users who lost their registry.
- **Blocking?:** No.

---

### File manager and Folders (added in 30)

#### OQ-117 — Folder direct-membership cap
- **Where:** [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).
- **Question:** The `members` count cap (50 per direct write, from [19](../data/19-properties-and-schemas.md)) is a deliberate friction signaling "use smart folders for larger collections." Should it be a fixed limit or per-vault configurable?
- **Tentative leaning:** Fixed at 50 in v1; revisit if user feedback demands.
- **Blocking?:** No.

#### OQ-118 — Smart-folder refresh model
- **Where:** [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).
- **Question:** When does a smart-folder query re-resolve — every render, on-write-affecting-query (reverse-dependency tracking), polled?
- **Options:**
  - (a) Every render — simplest; expensive when the user is just looking.
  - (b) Subscribe to entity-write events that touch the query's types; re-resolve on those.
  - (c) Polled (e.g. every 30s).
- **Tentative leaning:** (b). Reuses entity-subscription mechanism; cheap when nothing changes; reactive when it does.
- **Blocking?:** No.

#### OQ-119 — Collection-scope overlay conflict on multi-membership
- **Where:** [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md), [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** When an entity is in two folders that both define the same property at collection scope, which wins?
- **Options:**
  - (a) First-folder-by-membership-order. User implicitly orders folders.
  - (b) Most-recently-added-membership. Surfaces user's latest intent.
  - (c) Surface conflict — show both values; user picks per-entity.
- **Tentative leaning:** (a). Predictable; user controls via reordering memberships.
- **Blocking?:** No.

#### OQ-120 — Multi-folder breadcrumb without nav context
- **Where:** [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).
- **Question:** When an entity is in multiple folders and no nav context exists, render multiple breadcrumb chains or pick one?
- **Tentative leaning:** Pick one (alphabetical first by folder name); a "show all locations" affordance opens a popover.
- **Blocking?:** No.

#### OQ-121 — `intent.move` capability requirements
- **Where:** [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md), [17-interoperability.md](../platform/17-interoperability.md).
- **Question:** Does `intent.move` need its own capability, or does `entities.write:Folder/v1` suffice (since moving = editing source and destination Folders' `members`)?
- **Tentative leaning:** `entities.write:Folder/v1` suffices.
- **Blocking?:** No.

#### OQ-122 — Vault root folder deletability
- **Where:** [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md), [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).
- **Question:** Can the user delete the vault root folder?
- **Tentative leaning:** No — pinned by the shell; deletion through normal flows is refused. Rename / reconfigure freely.
- **Blocking?:** No.

---

### Credentials storage (added in 29)

#### OQ-113 — Keystore Node addon choice  *[RESOLVED in 29]*
- **Where:** [29-credentials-storage.md](../security/29-credentials-storage.md).
- **Resolution:** **`@napi-rs/keyring`** — Rust-backed Node addon over the actively-maintained `keyring` Rust crate. `keytar` was archived by GitHub in 2023 and is unsuitable. Decision recorded in 29.

#### OQ-114 — Passphrase strength requirements  *[RESOLVED in implementation-plan Stage 2]*
- **Where:** [29-credentials-storage.md](../security/29-credentials-storage.md).
- **Question:** Argon2id parameters and minimum-entropy guidance for recovery passphrases.
- **Resolution (v1):** Argon2id with `m=65536 KiB (64 MiB), t=3, p=4` — OWASP 2024 first-recommended profile for interactive use via `@noble/hashes/argon2`. Minimum entropy ~70 bits surfaced as "weak / fair / strong" feedback rather than enforced. Parameters are tunable later if perf demands; the on-disk wrapped-master-key blob records the parameters used so old vaults stay openable.

#### OQ-115 — Intermittent OS-keystore unavailability  *[RESOLVED in implementation-plan Stage 4]*
- **Where:** [29-credentials-storage.md](../security/29-credentials-storage.md).
- **Question:** Linux keyring daemon crashes mid-session; what happens to in-flight credential reads?
- **Resolution (v1):** the `VaultSession` already holds the vault master key + identity secret in memory for the duration of the session (Stage 2). If the OS keystore daemon vanishes mid-session, in-flight credential reads keep working against the cached secrets — only re-opening the vault (next launch, vault switch) requires the keystore to be available again. The re-open path already refuses cleanly if neither keystore nor passphrase wrap is available (Stage 2 §2.7). Future v2 work may add a UI signal when the keystore daemon goes away mid-session; v1 keeps silent because the user-visible behavior is correct.

#### OQ-116 — Maximum credential value size
- **Where:** [29-credentials-storage.md](../security/29-credentials-storage.md).
- **Question:** Should the credential store enforce a max value size (against apps stuffing data into "credentials")?
- **Tentative leaning:** Yes — 64KB per value, hard cap. Larger data goes through `storage.kv` (per [08-app-sdk.md](../apps/08-app-sdk.md)).
- **Blocking?:** No.

#### OQ-123 — Per-signing-operation authentication on macOS  *[RESOLVED in implementation-plan Stage 2]*
- **Where:** [29-credentials-storage.md](../security/29-credentials-storage.md).
- **Question:** Should the identity private key's macOS Keychain item have a per-item ACL requiring user authentication (Touch ID / password) on every signing operation, or only at vault open?
- **Options:**
  - (a) Per-signing — phishing-resistant; UX friction for high-frequency signs.
  - (b) Per-vault-open — easier UX; window of vulnerability if process is compromised.
  - (c) User-configurable per vault; default (b).
- **Resolution (v1):** **(b) — per-vault-open, no per-item ACL.** `@napi-rs/keyring`'s API does not expose Apple-specific ACL flags; the default keychain ACL (silent access while keychain is unlocked) is acceptable for sovereign-identity v1 because identity keys never cross the IPC boundary (apps that need signing call `identity.signPayload`; main process signs locally). (c) — user-toggleable per-vault — moves to v2 with the security-conscious-defaults review.

---

### Linking protocol (added in 31)

#### OQ-124 — Anchor token format across Yjs major versions
- **Where:** [31-linking-protocol.md](../platform/31-linking-protocol.md).
- **Question:** Yjs `RelativePosition` encoding may change across Yjs major versions. Migration policy?
- **Tentative leaning:** Pin Yjs version per shell major; on Yjs-major-upgrade, run a migration that re-encodes anchors. Anchors that fail to resolve fall back to "(near)" position via `findClosestPosition`.
- **Blocking?:** No (only relevant at Yjs-major-upgrades).

#### OQ-125 — Cross-vault link resolution
- **Where:** [31-linking-protocol.md](../platform/31-linking-protocol.md).
- **Question:** Cross-vault navigation today requires opening the other vault (one open per shell window per [28](../foundations/28-vault-and-onboarding.md)). v2 may unify cross-vault links.
- **Tentative leaning:** v2 — when consumer accounts and cross-vault identity linking (OQ-109) land, cross-vault URIs auto-prompt opening the other vault.
- **Blocking?:** No (v2 work).

#### OQ-126 — `LinkAnnotation` overlay participation
- **Where:** [31-linking-protocol.md](../platform/31-linking-protocol.md).
- **Question:** Does a `LinkAnnotation` entity participate in the property/layout overlay system (per [19](../data/19-properties-and-schemas.md), [27](../shell/27-layouts.md))?
- **Tentative leaning:** Yes — same machinery as any entity. Users can add tags, custom display, etc.
- **Blocking?:** No.

#### OQ-127 — Passive link integrity index
- **Where:** [31-linking-protocol.md](../platform/31-linking-protocol.md).
- **Question:** Should the shell maintain a passive index tracking link integrity (broken-link surface)?
- **Options:** (a) Yes — adds storage but useful for "find dead links" workflows. (b) No — broken links surface only when followed. (c) Per-vault opt-in.
- **Tentative leaning:** (c) — opt-in, defaults off. Power-users enable; casual users avoid the storage cost.
- **Blocking?:** No.

---

### Rust integration (added 2026-05-10)

#### OQ-128 — Tantivy vs SQLite FTS5 for full-text search  *[RESOLVED in implementation-plan Stage 11.1 — 2026-05-28]*
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md), [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Does Brainstorm v1 ship **Tantivy** (Rust, faster, better tokenization, native vector) replacing SQLite FTS5, or stay with FTS5?
- **Options:**
  - (a) **Tantivy replaces FTS5.** One engine for lexical + vector. ~3MB extra native binary; better quality; scales past 1M docs cleanly. Aligns with "AI is foundational."
  - (b) Keep FTS5; add Tantivy only if needed later. Simpler v1 build pipeline.
  - (c) Both — FTS5 for simple, Tantivy for advanced. Most complex.
- **Partial resolution (11.0 baseline landed):** **Lean shifted from (a) to (b)** based on FTS5 numbers measured against the doc-18 budget — see [docs/\_review/2026-05-28-stage-11-fts5-bench.md](../_review/2026-05-28-stage-11-fts5-bench.md). FTS5 hits all four budgets at ≤50k entities, misses the **common-term median budget at 100k** (~87 ms vs <50 ms target — 1.7× over) but stays under the p99 budget (~91 ms vs <100 ms). At 50k entities (the common-case vault size for the foreseeable user base) FTS5 is within budget on every metric. The Tantivy comparison half is **deferred to 11.0b** (needs the NAPI binding; the bench harness is already `BenchEngine`-shaped so the swap is one adapter when the binding lands). Near-term path: ship FTS5 in v1, investigate the type-filter join cost + `bm25(k1, b)` tuning as cheap FTS5 wins, file **OQ-128b** (tighten the doc-18 100k median budget based on the bench reality), schedule the Tantivy comparison post-beta.
- **Resolution (11.1):** **(b) — v1 ships SQLite FTS5; Tantivy is a post-beta quality follow-up, not a v1 dependency.** The 11.0 evidence settles it: FTS5 meets every doc-18 budget at ≤50k entities (the realistic vault size for the foreseeable user base) and stays under the p99 ceiling even at 100k; the only miss is the common-term *median* at 100k (~87 ms vs the 50 ms design number — see OQ-128b for the budget recalibration). Adopting Tantivy in v1 would buy headroom we don't yet need at the cost of a ~3 MB native binary + a NAPI build-pipeline dependency on the critical path to beta. The `BenchEngine` harness from 11.0 keeps the door open at zero design cost: **11.0b** drops in a Tantivy adapter and re-benches the same 100k corpus post-beta, and **OQ-128** can be revisited if those numbers (or real-vault growth past 100k) justify the swap. Option (c) (both engines) is rejected for v1 — two index code paths is the most complexity for the least near-term value.
- **Blocking?:** No longer — FTS5 is the committed v1 lexical engine. The Tantivy comparison is a performance-quality follow-up (11.0b), not a search-worker design blocker.

#### OQ-128b — 100k-entity FTS5 query-median budget calibration  *[NEW — 2026-05-28, filed by 11.0]*
- **Where:** [18-storage-and-search.md](../data/18-storage-and-search.md) §Performance budgets table.
- **Question:** The 11.0 bench (above) shows FTS5 common-term median at 100k entities is 86.5 ms vs the documented <50 ms target. Two responses: (i) tune FTS5 (`bm25(k1, b)` defaults, type-filter sidecar join) to close the gap; (ii) relax the 100k budget to ~90 ms median based on the measured reality. Which?
- **Options:**
  - (a) **Tune first, relax only if necessary.** Try `bm25(1.2, 0.75)` + a covering index on the sidecar join; re-bench; if median crosses 50 ms at 100k, leave budget as-is.
  - (b) **Relax the budget now to 90 ms median / 100 ms p99 at 100k.** The doc was authored before measurement; the measurement says ~87 ms is the FTS5 reality.
  - (c) **Both — relax + commit to the Tantivy comparison.** Adopt 90 ms as the FTS5-realistic v1 target; reopen OQ-128 when Tantivy numbers land.
- **Tentative leaning:** (c). 50 ms was a design number, not measured — the bench reality is what users see. Relaxing to 90 ms doesn't change the user experience (queries still feel snappy under 100 ms) and frees us from a wild-goose-chase FTS5 tune at the wrong layer. The Tantivy comparison is the right inflection.
- **Blocking?:** No — this is a doc number, not code. Relaxation can happen in the same PR that records the 11.0b numbers.

#### OQ-129 — Separate Rust binaries (workers) in v2
- **Where:** [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** v1 keeps Rust as Node-addon library code. v2 may split heavy work into separate Rust binaries (sync worker, indexer worker) communicating via stdin/stdout JSON or shared memory. Worth doing?
- **Tentative leaning:** Defer until v2 implementation reveals where the bottleneck is. Possible candidates: sync transport, large-Yjs-doc compaction (via `yrs`), bulk vector indexing.
- **Blocking?:** No.

---

### Store verification (added in 32)

#### OQ-130 — Catalog-advertised hash mismatch
- **Where:** [32-store-verification.md](../apps/32-store-verification.md).
- **Question:** When the local download hash mismatches the catalog-advertised hash, refuse only or refuse + report-to-catalog?
- **Tentative leaning:** Refuse always; opt-in report-to-catalog (helps catalog-side anomaly detection without forcing telemetry).
- **Blocking?:** No.

#### OQ-131 — Surface ignored flagged apps prominently
- **Where:** [32-store-verification.md](../apps/32-store-verification.md).
- **Question:** Users can "ignore" a flagged app. Should the settings panel surface ignored apps prominently to avoid forgotten ignores?
- **Tentative leaning:** Yes — a "you are running N risk-acknowledged apps" reminder weekly.
- **Blocking?:** No.

#### OQ-132 — Fuzzy-name app-impersonation algorithm
- **Where:** [32-store-verification.md](../apps/32-store-verification.md).
- **Question:** What algorithm for detecting app-name impersonation at install time?
- **Options:** (a) Levenshtein distance on names, (b) n-gram similarity, (c) embedding similarity (uses the local AI broker's embeddings).
- **Tentative leaning:** Start with (a) Levenshtein for simplicity; (c) embedding similarity if false-positive rate matters.
- **Blocking?:** No.

#### OQ-133 — Telemetry first-run prompt
- **Where:** [32-store-verification.md](../apps/32-store-verification.md).
- **Question:** Behavioral telemetry is default-off. Should the first-run flow ask the user, or is that pushy?
- **Tentative leaning:** Don't ask at first run (privacy posture is "no" by default); surface it in settings for users who care.
- **Blocking?:** No.

---

### Cross-device non-CRDT merging

#### OQ-134 — Merge semantics for non-CRDT state across devices
- **Where:** future v2 work.
- **Question:** Brainstorm has CRDT (Yjs) for entity state but non-CRDT pieces (capability ledger snapshots, registry, some settings overlays) are per-device. When v2 cross-device merging beyond Yjs becomes a real concern, what's the merge model?
- **Suggested deeper read:** versioned-filesystem literature on three-way merge with explicit conflict resolution.
- **Blocking?:** No (v2 concern).

---

### Windows and system menus (added in 33)

#### OQ-135 — Window thumbnail capture cadence
- **Where:** [33-windows-and-menus.md](../shell/33-windows-and-menus.md).
- **Question:** When does the shell capture window thumbnails for the switcher overlay and the dashboard's running-apps surface?
- **Status:** Partially resolved in [33 §Window switcher overlay](../shell/33-windows-and-menus.md): focus-change events + a slow 30s background refresh for windows visible on the dashboard. Remaining open: precise capture rate under heavy load (many windows) and whether to throttle when on battery.
- **Tentative leaning (remaining):** Cap to one capture per second across all windows; pause captures entirely when on battery + Power Saver, falling back to focus-change-only.
- **Blocking?:** No.

#### OQ-136 — Cross-app tab groups
- **Where:** [33-windows-and-menus.md](../shell/33-windows-and-menus.md).
- **Question:** v2 — should tabs span apps (a "Project X" tab group containing Notes + Database + Files windows)?
- **Tentative leaning:** v2 only — useful but the cross-app focus / state coordination is complex. Workspaces (OQ-137) cover the same use case more cleanly.
- **Blocking?:** No.

#### OQ-137 — Workspaces (multi-dashboard with own window sets)
- **Where:** [33-windows-and-menus.md](../shell/33-windows-and-menus.md).
- **Question:** Brainstorm-internal workspaces (like macOS Spaces) — multiple dashboards each with own wallpaper / icons / widgets / window set?
- **Tentative leaning:** Post-v1. The single dashboard already covers most needs; workspaces are a refinement that benefits power users only.
- **Blocking?:** No.

#### OQ-138 — `Workspace/v1` entity type for saved window arrangements
- **Where:** [33-windows-and-menus.md](../shell/33-windows-and-menus.md).
- **Question:** Saved arrangements (4 windows positioned for "finance work") as entities — different from Layouts.
- **Tentative leaning:** Post-v1; design alongside cross-device window-arrangement sync.
- **Blocking?:** No.

#### OQ-139 — Window groups: metadata or separate entity type?
- **Where:** [33-windows-and-menus.md](../shell/33-windows-and-menus.md).
- **Question:** Ad-hoc window groups (color, label) — store as metadata on the window-index entry (in-memory) or as a `WindowGroup/v1` entity (persisted)?
- **Tentative leaning:** In-memory metadata in v1; promote to entity type in v2 if cross-device persistence is wanted.
- **Blocking?:** No.

#### OQ-140 — Window-list as a chrome cell on the dashboard layout
- **Where:** [33-windows-and-menus.md](../shell/33-windows-and-menus.md).
- **Question:** Should the dashboard's window-list be a chrome cell on the dashboard layout (per [27](../shell/27-layouts.md)), so users can reposition / restyle it like any chrome?
- **Tentative leaning:** Yes — gives users layout flexibility for their dashboard. Adds a new chrome kind (`chrome.windowList`).
- **Blocking?:** No.

#### OQ-241 — Chrome-model in-window tabs + pinned tabs
- **Where:** [33-windows-and-menus.md](../shell/33-windows-and-menus.md) §Tabs as a shell feature.
- **Question:** The §Tabs decisions model a tab as a *grouped window* (macOS native tabs / merged separate OS windows under one tab bar, "the shell groups windows"). Do we instead make the **Chrome mental model canonical** — the tab is the primary unit *inside* one window, opening an object opens a new tab *in the current window's strip*, and tabs can be **pinned**? And what does pinning mean?
- **Resolution (taken):** **Yes — Chrome model is canonical.**
  - A window owns a **tab strip**; each tab is a route (per [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md)), reusing the route-based `WindowSessionState` already defined in [33](../shell/33-windows-and-menus.md) — a tab is a `WindowEntry` row in the group's `tabOrder`, not a new serialization format. Opening an object opens a **new tab in the focused window** (`Mod+Click` = new window, overriding focus-existing per [37](../shell/37-cross-app-navigation.md)). "Grouping" is just adding to this strip — it supersedes the *merge-separate-windows* framing, not the manifest `windowing.tabbing` field (`supported` / `single` / `always-tabbed` stays) nor macOS native tabs as the platform rendering of the same strip.
  - **Pinned tabs follow Chrome semantics:** icon-only, left-anchored, always ordered before unpinned tabs, no hover close affordance, and **restored on vault reopen** as part of `WindowSessionState.groups` (a `pinned: boolean` + position on the tab's session row). The shell still owns the strip — apps don't draw their own tabs (the per-app-tabs prohibition in §Tabs holds); the shell renders the strip via the `chrome.tabs` cell (per [27-layouts.md](../shell/27-layouts.md)) on Win/Linux and native tabs on macOS.
  - Tabs stay **intra-app** in v1 (cross-app tab groups remain OQ-136, v2).
- **Open (sub-questions):** (1) does pin state persist per-window or per-(app,route) globally; (2) macOS-native-tab parity for the pinned visual treatment (native tabs can't shrink to icon-only) — likely the custom `chrome.tabs` strip on all platforms for consistency, with native tabs as a fallback; (3) max pinned-tab count / overflow behavior.
- **Blocking?:** Blocks the tabs iteration (the model decision must be settled before the strip is built); not v1-beta-blocking since tabs land post-Stage-6 alongside the running-apps surface.

---

### App-side workers (added in 34)

#### OQ-141 — Streaming subscriptions through the Worker SDK shim
- **Where:** [34-app-workers.md](../shell/34-app-workers.md).
- **Question:** `entities.subscribe` with high update rates (e.g., during a bulk write) crosses two postMessage hops to reach worker code (renderer ↔ main → worker). Per-update postMessage cost may dominate at high rates.
- **Options:**
  - (a) Buffer + flush in coalesced batches (extra latency).
  - (b) Use a `MessageChannel` for the streaming path (faster than postMessage to worker).
  - (c) Worker subscribes directly to a SharedArrayBuffer-backed ring buffer the renderer writes to (fastest, complex).
- **Tentative leaning:** (a) for v1; revisit if profiling shows worker streaming as a bottleneck.
- **Blocking?:** No.

#### OQ-142 — SharedWorker behavior with per-window vs per-app renderer
- **Where:** [34-app-workers.md](../shell/34-app-workers.md), depends on [03-app-model.md](../apps/03-app-model.md) OQ-4.
- **Question:** SharedWorker scope is origin + name in the browser model. In Electron with windows-of-the-same-app possibly in separate renderers (OQ-4 outcome), does SharedWorker still share?
- **Tentative leaning:** Verify against Electron's renderer-isolation model; SharedWorker may need to be hosted in a utility process to truly share, which conflicts with the "no separate OS processes for apps" rule. May force the OQ-4 decision toward shared renderers for multi-window apps.
- **Blocking?:** Soft yes — affects multi-window app patterns.

---

### Electron features (added from 2026-05-10 Electron survey)

#### OQ-143 — Production Fuse profile validation
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** Confirm the proposed Fuse settings (`runAsNode` off, `cookieEncryption` on, `nodeOptions` off, `nodeCliInspect` off, `embeddedAsarIntegrityValidation` on, `onlyLoadAppFromAsar` on, `loadBrowserProcessSpecificV8Snapshot` on, `grantFileProtocolExtraPrivileges` off) work with our actual build pipeline.
- **Tentative leaning:** All of the above; revisit once first production build exists.
- **Blocking?:** Yes for first production build.

#### OQ-144 — Opt-in crash reporting *[RESOLVED in Feedback-2]*
- **Where:** [25-settings.md](../shell/25-settings.md), [48-admin-panel.md](../platform/48-admin-panel.md), [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Question:** Does the shell offer an opt-in crash-report toggle in settings (Sentry-style endpoint), with default off?
- **Resolution (2026-05-25):** Yes — shipped as Feedback-2. `crashReportingEnabled` defaults false, surfaced as a checkbox in Settings → Privacy → Feedback alongside the bug-report toggle ("Send anonymized crash reports"). When off, a local counter increments per capture so the Privacy UI can show "N captured locally before you opted in"; when on, full payloads enqueue under `<userData>/crash-reports/` and drain through the network broker (with the privileged `__crash__` sentinel `appId`) on a 30 s post-boot delay + every 15 min thereafter + best-effort drain on `before-quit`. Same redactor as Feedback-1: vault → `<vault>`, home → `<home>/`, credentials → `<credential>`, emails → `<email>`. Crash reports never carry a `contactEmail` field — fully anonymous always. Native Crashpad dumps stay out of scope for v1.

#### OQ-145 — Default Content Security Policy
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** What's Brainstorm's default CSP for app renderers and the dashboard renderer? `default-src 'self' 'unsafe-inline'` for app-bundle-loaded code, with `connect-src` allowed only for granted `network.connect:*` capabilities?
- **Tentative leaning:** Tight default CSP per-renderer, with `connect-src` dynamically extended per granted capability. Specifics need review.
- **Blocking?:** No.

#### OQ-146 — OS permissions ↔ Brainstorm capabilities mapping
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** When Electron raises an OS-level permission prompt (camera, mic, geolocation, notifications), does it reach the OS or get intercepted by Brainstorm's capability prompt first?
- **Tentative leaning:** Brainstorm intercepts via `setPermissionRequestHandler`; if app has the corresponding `media.camera` / `geolocation` / etc. capability, Brainstorm forwards to OS; otherwise refuses without prompting OS.
- **Blocking?:** Yes for media-using apps.

#### OQ-147 — Shell auto-update mechanism  *[RESOLVED 2026-06-29 — in-app auto-update (electron-updater) shipped against GitHub Releases; ON by default, disable in Settings → Updates]*
- **Where:** [14-app-store.md](../apps/14-app-store.md).
- **Question:** Does the shell update via Squirrel + Brainstorm-hosted update server, or via platform stores (Mac App Store, Microsoft Store)?
- **Options:**
  - (a) Squirrel-managed; full control, immediate-issue patching, but we run the update server.
  - (b) Platform store; offload distribution but slower turnaround for security patches.
  - (c) Both — primary distribution via Squirrel for users who download direct; platform store as a secondary channel.
- **Tentative leaning:** (c). Direct download is the primary; platform stores as additional reach.
- **Resolution (2026-06-29):** direct-download path (a-flavored) shipped for public beta v0.1.5 — `electron-updater` checks GitHub Releases (`latest*.yml`) → downloads → installs on relaunch. ON by default (disable in Settings → Updates), no longer a v2 exclusion. Platform-store channel (c) stays a later option.
- **Blocking?:** No (v1 distribution detail).

#### OQ-148 — Extended notification model  *[RESOLVED — pulled forward 2026-06-06]*
- **Where:** [04-shell.md](../shell/04-shell.md).
- **Question:** Beyond Electron's `Notification` class, design DND / quiet hours / cross-platform consistent notification history.
- **Tentative leaning:** v2 — v1 uses bare Electron Notification + per-app permission gating per OQ-146.
- **Resolution (2026-06-06, settings-overhaul — product-owner call):** pulled into v1. The notify host (`UiNotifyHost`) now: raises **OS-native** notifications (Electron `Notification`, focus-gated, via the injected `os-notification-host`) in addition to the in-app toast; enforces a **do-not-disturb window** + **per-app mute** (suppress presentation, always record); and persists a capped **notification center history** (per-vault, synced) surfaced by a header bell + center + a Settings → Notifications page. All host enforcement is unit-tested (`notify-host.test.ts`). The `osNative` toggle, DND, and mutes live in the dashboard doc's `notifications` map.
- **Blocking?:** No.

#### OQ-149 — Hardware capability namespace
- **Where:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** Hardware capabilities — `hardware.usb:<filter>`, `hardware.hid`, `hardware.serial`, `hardware.midi`, `hardware.bluetooth`, `geolocation`, `media.camera`, `media.microphone`. Filter expressions for per-device gating?
- **Tentative leaning:** Yes — add to capability matrix; filter expressions are vendor/product/usage tuples per the underlying web spec.
- **Blocking?:** Yes for any app that needs hardware access (rare in v1).

#### OQ-150 — Custom V8 snapshots for cold-start
- **Where:** [12-shell-architecture.md](../shell/12-shell-architecture.md).
- **Question:** Beyond `loadBrowserProcessSpecificV8Snapshot` Fuse, build custom V8 snapshots with pre-warmed shell JS state for faster cold-start? Addresses OQ-101 (cold start <300ms unrealistic).
- **Tentative leaning:** Investigate post-v1 ship if cold-start budget remains a concern. Custom snapshots add build complexity.
- **Blocking?:** No.

---

### Code conventions (added in 35)

#### OQ-151 — Bun workspaces vs pnpm workspaces
- **Where:** [35-code-conventions.md](../foundations/35-code-conventions.md), [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Bun's workspace support has historically had rough edges. pnpm is more battle-tested.
- **Tentative leaning:** Try Bun first (matches our Bun-as-runtime choice in 13); fall back to pnpm if real issues hit.
- **Blocking?:** No (mechanical change either way).

#### OQ-152 — Import-cycle detection coverage in Biome
- **Where:** [35-code-conventions.md](../foundations/35-code-conventions.md).
- **Question:** Does Biome's lint rules cover import-cycle detection adequately, or do we ship `madge` as a separate CI check?
- **Tentative leaning:** Run both during the gap (per OQ-65); drop `madge` once Biome covers.
- **Blocking?:** No.

#### OQ-153 — JSDoc requirements for SDK exports
- **Where:** [35-code-conventions.md](../foundations/35-code-conventions.md).
- **Question:** Are name + types sufficient for SDK exports, or do we require full `@param` / `@returns` / `@example`?
- **Tentative leaning:** Name + types (TypeScript signatures already document); `@example` strongly recommended for non-trivial APIs; `@deprecated` mandatory when used.
- **Blocking?:** No.

---

### Design system (added in 36)

#### OQ-154 — Density dimension on themes
- **Where:** [36-design-system.md](../shell/36-design-system.md).
- **Question:** Does a `density` theme dimension shrink all space tokens by a factor (compact 0.75×, comfortable 1.25×)?
- **Tentative leaning:** Yes in v1 — power users want compact for dense data views; comfortable for reading.
- **Blocking?:** No.

#### OQ-155 — Theme transition animation
- **Where:** [36-design-system.md](../shell/36-design-system.md).
- **Question:** When user switches theme, do we animate the token values (smooth transition) or instant swap?
- **Options:** (a) Instant swap — simplest, no glitches. (b) Cross-fade over `motion.duration.normal`. (c) Token-by-token transition with appropriate easing.
- **Tentative leaning:** (a) for v1; revisit if it feels jarring.
- **Blocking?:** No.

#### OQ-156 — Theme persistence scope *[partially RESOLVED in implementation-plan B10]*
- **Where:** [36-design-system.md](../shell/36-design-system.md) (§Appearance modes & pair slots), [25-settings.md](../shell/25-settings.md).
- **Question:** Where does the user's active-theme choice live? Per-vault (syncs across devices) vs per-device (so dark-mode laptop and light-mode desktop look right) vs hybrid?
- **Resolution:** Hybrid, in three pieces:
  - **Pair slots** (`appearance.light` = theme + wallpaper; `appearance.dark` = theme + wallpaper) — **per-vault** (lives in the dashboard doc; landed in B10).
  - **Global appearance bits** (icon pack, typography, density, StylePack, accessibility overlays) — **per-vault**, scheme-neutral by design.
  - **Mode** (`light` / `dark` / `auto`) — **target = per-device** (dark laptop + light desktop is the canonical case). Lives per-vault in B10 because the per-device settings store doesn't exist yet; revisit when one lands and migrate without changing the pair-slot half.
- **Blocking?:** No (per-device mode split is non-blocking polish).

---

### Network and proxy (added in 38)

#### OQ-163 — Privacy-strict vault detection for link-preview default *[RESOLVED in Net-1e]*
- **Where:** [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Question:** Which vault attributes default link previews to off? Path pattern (`~/Private`), vault-name flag, or an explicit "Privacy mode" toggle at vault creation?
- **Resolution (Net-1e, 2026-05-25):** Both — `isPrivacyStrictPath(vaultPath)` in `packages/shell/src/main/network/privacy-config.ts` flips the default to Off when the path contains a `Private` / `Privacy` / `Secure` / `Confidential` segment, or matches `*-secure*` / `*-private*`, or sits under `~/Private/` / `~/Documents/Private/`. The user can still flip the per-vault toggle in Settings (Net-1f). Pattern-matching is a sensible first-touch default; the explicit toggle is the override.
- **Blocking?:** No.

#### OQ-164 — Embed default: click-to-load vs auto-load
- **Where:** [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Question:** Do embeds (YouTube, Vimeo, etc.) auto-load on render, or wait for an explicit user click?
- **Tentative leaning:** Click-to-load. Most embeds the user inserts aren't watched immediately; loading them on render leaks per-page-render to the provider.
- **Blocking?:** No.

#### OQ-165 — Proxy auth credential prompt UX
- **Where:** [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Question:** On the first 407 Proxy Authentication Required, do we show a native modal, or only surface in Settings → Network?
- **Tentative leaning:** Native modal once per session with "remember for this vault" checkbox.
- **Blocking?:** No.

#### OQ-166 — Cert pinning for shell-owned endpoints
- **Where:** [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Question:** Should the shell's update / opt-in telemetry endpoints pin certificates (defeating corporate MITM proxies)?
- **Tentative leaning:** No pinning in v1 (corporate operability); add an opt-in "strict cert" mode in v2 for high-threat users.
- **Blocking?:** No.

#### OQ-167 — Network log retention window
- **Where:** [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Question:** How long do we keep per-request network logs (host-only, no path)?
- **Tentative leaning:** 7 days rolling, capped at 50 MB; per-app counters retain 90 days.
- **Blocking?:** No.

#### OQ-168 — Per-app CSP configurability
- **Where:** [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Question:** Can an app loosen its renderer CSP (e.g., a browser-style app that wants `connect-src *`)?
- **Tentative leaning:** No — such apps go through the `network.connect:*` capability + broker, not via CSP relaxation. Keeps the renderer enforcement uniform.
- **Blocking?:** No.

---

### Cross-app navigation (added in 37)

#### OQ-157 — Ephemeral query allowlist for route canonicalization
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md).
- **Question:** Which query parameters are stripped during route canonicalization (so `?from=launcher` doesn't prevent focus-existing matches)? Shell-curated list, or apps can declare per-route?
- **Tentative leaning:** Shell-curated for v1 — `from`, `via`, `referrer`. Apps with internal non-identity-bearing parameters can fold them into the fragment or omit them from the published route.
- **Blocking?:** No — gates focus-existing UX, not its implementation.

#### OQ-158 — Panel-creation gesture
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md).
- **Question:** How does a user create a panel group by direct manipulation? Alt+drag onto another window? Drag onto a screen-edge zone? Dedicated affordance in `chrome.windowControls`? Combination?
- **Tentative leaning:** Start with `mode: "new-panel"` from links + a right-click "Add as side panel" on window-list entries. Revisit drag gestures once the layout system lands (Stage 8).
- **Blocking?:** No.

#### OQ-159 — Vertical panel split (rows)
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md).
- **Question:** Support vertical row splitting in addition to Arc-style column panels?
- **Tentative leaning:** Columns-only in v1; vertical split tied to OQ-138 (Workspace entity).
- **Blocking?:** No.

#### OQ-160 — Panel width bounds
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md).
- **Question:** Minimum and maximum panel widths.
- **Tentative leaning:** Min 280px; max unbounded (drag a panel to fill the screen; others scroll horizontally).
- **Blocking?:** No.

#### OQ-161 — Back-stack depth per tab
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md).
- **Question:** How many entries to keep in each tab's `navStack`?
- **Tentative leaning:** 100 entries, oldest evicted; user-configurable.
- **Blocking?:** No.

#### OQ-162 — Cross-vault focus-existing
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md).
- **Question:** Does focus-existing match across vaults, or only within the active vault?
- **Tentative leaning:** Per-vault window-sets; vault switch hides the old set, restores the new (matches "one vault per shell window" per [foundations/28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md)). Focus-existing is intra-vault only by construction.
- **Blocking?:** No.

#### OQ-189 — Main-process safety net for escaped `brainstorm://entity/*` navigations
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md), [57-open-resolution.md](../platform/57-open-resolution.md); shell `main/index.ts` `registerBrainstormProtocol` + the (absent) `will-navigate` handler.
- **Question:** Today the *only* thing that turns a `brainstorm://entity/<id>` link into in-app navigation is each renderer surface's click interceptor. If any surface forgets to intercept (the original bug: backlinks rendered outside the Lexical root), the click escapes to a real protocol GET, which the `protocol.handle("brainstorm", …)` handler terminates as a hard `404` — "clicked a link and got to nowhere". Should the main process own a fail-safe so an escaped entity navigation is *never* a 404: a `will-navigate` (+ `setWindowOpenHandler`) interceptor on app `webContents` that cancels the navigation and routes the id through the same `OpenResolver` / `intent.open` path? This makes the OpenResolver the genuine terminating floor (per [57](../platform/57-open-resolution.md)) rather than relying on every renderer surface being correct. Open sub-questions: (a) how the handler attributes the navigation to a source app identity (the renderer is sandboxed; reuse the `RendererIdentityRegistry`?), (b) whether a no-resolver-type `intent.open { entityId }` path is acceptable from this fallback (link-markup already dispatches id-only), (c) whether to also cancel + no-op (vs. route) for malformed ids so a stray nav can never blank the renderer.
- **Tentative leaning:** Add the `will-navigate` net as defense-in-depth in a hardening iteration (security-sensitive — touches navigation gating, wants its own review), keeping the per-surface interceptors as the primary path. Not a blocker: the renderer fix (every in-app surface routes through the shared `dispatchOpenEntity`) fully closes the reported bug; this is belt-and-suspenders for future surfaces.
- **Blocking?:** No.

#### OQ-190 — Shell-owned route survival across refresh / relaunch / restart
- **Where:** [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md) (`WindowEntry.route` / `ui.windows.setRoute` / focus-existing), [33 §Window manager](../shell/33-windows-and-menus.md) (`SessionWindow`, `session.json`); `main/window/window-manager.ts` `lastSessionTargets`/`planRestore` (exist, **uncalled**).
- **Question:** The user reports apps lose their open object on refresh/relaunch. Today `route` is documented but unimplemented: apps have no `ui.windows.setRoute()`, `SessionWindow` persists only window placement (no route/entity id), and `session.json` restore (`lastSessionTargets`/`planRestore`) is never invoked — no app windows are re-launched with their last route. Three layers to settle for v1: (a) **renderer refresh** (Cmd+R) — handled per-app as a stopgap (B6.12 persists Notes' last-open to localStorage); is per-app localStorage acceptable interim everywhere, or should the preload re-issue the original `launch` on reload so *every* app gets it for free? (b) **shell restart** — wire `lastSessionTargets`/`planRestore` and extend `SessionWindow`/`session.json` with `route?: string` so windows re-open on their last object; (c) **the contract** — apps publish via `ui.windows.setRoute(uri)`, shell validates against the curated authority set (per [31](../platform/31-linking-protocol.md)) and is the single source of truth (replaces every per-app localStorage stopgap, incl. B6.12; also unlocks focus-existing + back-stack). Sub-question: does restore survive a **vault switch** (route ids are vault-scoped — restoring a stale id must fail soft, the way B6.12's existence-guard does)?
- **Tentative leaning:** Per-app localStorage stopgaps now (refresh is the common pain), the real shell-owned `setRoute` + session-restore as the Stage-8 window-management build; stopgaps deleted as apps adopt the contract. Restore always existence-guarded so a vault switch / deleted object degrades to the app's default, never a blank or wrong object.
- **Blocking?:** No (Stage 8).

---

### Automations & workflows (added in 39)

#### OQ-163 — Webhook ingress endpoint topology *[RESOLVED in implementation-plan 11b.8 → (a)]*
- **Where:** [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md).
- **Question:** Does the shell expose a single shared webhook endpoint with per-workflow path routing (`https://<relay>/wh/<routeId>/<secret>`), or one endpoint per workflow?
- **Options & trade-offs:**
  - (a) Single shared endpoint, path-routed, per-workflow rotating secrets — simpler to operate; one DNS / TLS setup; matches the network-broker shape from [38](../security/38-network-and-proxy.md).
  - (b) One endpoint per workflow — what n8n users expect; harder to operate; needs dynamic listener allocation.
- **Resolution (11b.8):** **(a)** — ONE endpoint, path-routed `/wh/<routeId>/<secret>`, per-workflow rotating secret (the builder mints `routeId` + `secret`; the secret rotates in place without changing the route). The same topology serves both ingress planes: a **loopback listener** (`127.0.0.1`, live now — reachable by same-machine tools / a user-run tunnel) and the **relay plane** (the relay terminates the public `https://<relay>/wh/<routeId>/<secret>` and forwards down the desktop's connection; the desktop re-verifies the secret constant-time). Gated by the `network.ingress` capability (runtime grant, Settings → Privacy → Network — not a static manifest cap). The relay is UNTRUSTED for auth and holds no vault keys.
- **Blocking?:** No — was resolved as the `Webhook` trigger landed (11b.8).

#### OQ-164 — Automation-host failover across devices
- **Where:** [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md).
- **Question:** If the designated automation-host device is unreachable, do other devices auto-promote, or just warn the user?
- **Options & trade-offs:**
  - (a) Auto-promote after N minutes (with a coordination protocol over the sync transport) — automations keep firing; risk of split-brain double-fires if the original device comes back online.
  - (b) Warn-only — simple; user explicitly picks a new host; risk of missed reminders during user-unaware outages.
- **Tentative leaning:** (b) for v1. Reconsider once usage data shows how often hosts go dark.
- **Blocking?:** No.

#### OQ-165 — Cron expression dialect *[RESOLVED in implementation-plan Stage 11b.2]*
- **Where:** [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md).
- **Question:** Standard 5-field POSIX cron, 6-field cron with seconds, or RFC 5545 RRULE only?
- **Resolution (2026-06-06):** Neither a cron dialect nor a parallel RRULE store — time triggers store the **structured `@brainstorm/sdk-types` `Recurrence`** already used by Tasks + Calendar, whose `Custom { rrule }` arm holds a raw RFC-5545 string for the long tail. The `SchedulerService` reuses the 9.15.5 `nextOccurrence` engine wholesale (no second recurrence implementation to keep in sync). A future builder may accept cron text as a UI convenience and translate to `Recurrence` on save. One representation across all three apps; supersedes the tentative "RRULE-only storage" leaning on reuse + consistency grounds.
- **Blocking?:** No — was a pre-Stage-11b decision; resolved at 11b.2.

#### OQ-166 — Step-output binding model *[RESOLVED in implementation-plan 11b.11]*
- **Where:** [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md).
- **Question:** How do later steps reference earlier-step outputs? Yjs `RelativePosition` anchors per [31-linking-protocol.md](../platform/31-linking-protocol.md) is the proposal — does that survive copy/paste of step blocks across workflows?
- **Tentative leaning:** RelativePosition anchors plus per-step stable ids (uuid); copy/paste rewrites both. Cross-workflow paste reseats inputs to `<unbound>` and surfaces a validation error.
- **Resolved (2026-06-14) → stable per-step uuid id references, NOT Yjs `RelativePosition` anchors.** The v1 builder is **linear** (no visual graph) and the engine spine already binds outputs by stable step id — the 11b.4 runner threads `ctx.input` = the prior step's output and `runChildren(steps, seed?)` reseeds it, and the 11b.9 `code-expression` grammar resolves a bare/whole-string step id against the `outputs` map. RelativePosition anchoring buys nothing for a linear list (there is no rich in-text cursor to anchor to) and is materially heavier to maintain; defer it to a post-v1 rich-binding follow-on **only if** a visual-graph / in-prose-binding builder ever lands. Copy/paste of a step mints a fresh uuid; any input referencing a now-absent step id resolves to `<unbound>`, and the **save-time validation pass that already computes the capability sheet** surfaces it as a binding error. The builder's binding affordance is therefore: pick a prior step → reference its output by id (and, via the resolved `Code`/expression grammar of OQ-167, member-access into that output).
- **Blocking?:** ~~Yes for Stage 11b~~ Resolved — unblocks 11b.11.

#### OQ-167 — `Code` step in v1 *[RESOLVED in implementation-plan 11b.9]*
- **Where:** [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md).
- **Question:** Ship the sandboxed-expression `Code` step in v1, or defer entirely?
- **Options & trade-offs:**
  - (a) Ship — small surface (no `import`, no I/O), covers obvious gaps like "format a number with units" / regex extraction.
  - (b) Defer — even sandboxed code is an audit liability; users can compose around it with `Intent`+`HTTP`.
- **Tentative leaning:** (a) ship, with a strict whitelist (Date, Math, JSON, RegExp, string methods, prior-step locals only).
- **Resolved (2026-06-13) → (a) ship, as a NON-JavaScript expression language.** The audit-liability worry behind (b) is the JS-sandbox escape surface; we sidestep it entirely — `code-expression.ts` is a tokenizer→parser→AST evaluator with **no `eval`/`Function`, no host globals, no I/O, no assignment, no statements, no prototype access** — so the audit surface is exactly the published grammar. The whitelist is realized as curated pure built-ins (`len/upper/lower/trim/contains/replace/split/join/round/min/max/number/string/coalesce/now/…`) over the workflow's prior-step outputs + `input`. **Regex is deliberately deferred** (a ReDoS surface) — a guarded follow-on, not part of the v1 audit surface.
- **Blocking?:** No — decided pre-11b.

---

### Theme store (added in 40)

#### OQ-169 — Federated ratings across catalogs
- **Where:** [40-theme-store.md](../apps/40-theme-store.md).
- **Question:** Does the platform define a standard rating-submission envelope so a user rating a theme once syndicates to all subscribed catalogs, or are ratings per-catalog only (user rates separately wherever they want their rating recorded)?
- **Options & trade-offs:**
  - (a) Per-catalog only — simplest; honest about each catalog's reputation system; matches how the rest of the catalog model works.
  - (b) Standard syndication envelope — better user UX; risk that one catalog's policies (e.g., paid-rating allowed) leak into others'; tricky to model with signed Ed25519 user identities.
- **Tentative leaning:** (a) for v1. Revisit if user feedback shows duplicate-rating fatigue.
- **Blocking?:** No.

#### OQ-170 — Live-preview window duration
- **Where:** [40-theme-store.md](../apps/40-theme-store.md).
- **Question:** When the user previews a theme (without committing), how long does the preview last before reverting?
- **Options & trade-offs:**
  - (a) 30s timeout — predictable; might cut off a deliberate evaluation.
  - (b) Until user clicks outside the preview affordance — natural; might surprise if they don't realize they're in preview.
  - (c) Indefinite with a persistent banner ("Previewing X — keep or discard") — most flexible; banner real estate cost.
- **Tentative leaning:** (c) indefinite with a banner; banner shows "Keep" / "Discard" and the previous theme name.
- **Blocking?:** No.

#### OQ-171 — User-overridable theme validation rules
- **Where:** [40-theme-store.md](../apps/40-theme-store.md).
- **Question:** Some validation rules (contrast lint, focus-ring presence) are deliberately absolute. Should any of them be **bypassable with explicit user acknowledgment** for niche use cases (e.g., deliberately ultra-low-contrast ambient-screen themes; intentionally minimal focus indicators for screenshot demos)?
- **Tentative leaning:** No — all current rules stay absolute. The accessibility regression cost is higher than the niche-use cost. Authors who want these aesthetics should ship them as user-modifiable token sets the user can opt into via the theme-editor (which surfaces the warnings inline).
- **Blocking?:** No.

#### OQ-172 — Cross-catalog entitlement portability for paid themes *[RESOLVED in 43-monetisation-strategy.md]*
- **Where:** [40-theme-store.md](../apps/40-theme-store.md); resolution in [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md).
- **Question:** When paid themes ship (v2, sharing infra with paid apps), does the platform define a **standard entitlement-token envelope** so a user buys a theme on catalog A and installs it from catalog B (mirroring A's listings)? Or is entitlement strictly per-catalog and non-portable?
- **Resolution:** **Per-catalog and non-portable in v2.** A cross-catalog entitlement envelope is deferred to post-v2, gated on observed demand and a separate cryptographic design. Federation in the catalog model is already a v2+ open surface (OQ-169 for ratings); we do not pre-commit infrastructure for it.

#### OQ-173 — Wallpaper packs as a distributable theme component
- **Where:** [40-theme-store.md](../apps/40-theme-store.md), [36-design-system.md](../shell/36-design-system.md).
- **Question:** Are wallpapers (and dashboard backdrops, splash imagery) first-class as a separately-distributable theme component (`brainstorm/WallpaperPack/v1`), or do they stay user-uploaded files outside the theme system?
- **Options & trade-offs:**
  - (a) First-class wallpaper packs — fits the low-poly design direction (per [36 §Aesthetic direction](../shell/36-design-system.md)); authors can ship branded wallpaper collections; consistent install/update/rating flow.
  - (b) Stay user-uploaded — keeps the theme entity-set small (TokenSet / IconPack / Typography); wallpapers are a per-user preference, not part of the visual-identity bundle.
- **Tentative leaning:** (a) in v1.5 or v2; v1 keeps wallpapers user-uploaded to avoid scope creep. The `40-theme-store.md` distribution mechanism handles them seamlessly when added — same package format, same lifecycle.
- **Blocking?:** No.

#### OQ-183 — User-supplied custom CSS as a community modding surface  *[RESOLVED in implementation-plan Stage 9.9.4 (2026-06-09) — the tentative leaning is taken: `brainstorm/StylePack/v1` is the fourth optional theme component; the bundle validator (`sanitizeStylePackCss`) + the frozen `data-bs-region` hook contract (`STYLE_HOOK_REGIONS`, stamped on dashboard / app-frame / settings / popover / lock-screen chrome) both shipped. Accessibility posture: StylePacks are NOT contrast-linted (token sets are, OQ-171); StylePack-modified chrome ships without that guarantee and the editor/installer surface that at apply time.]*
- **Where:** [40-theme-store.md](../apps/40-theme-store.md), [36-design-system.md](../shell/36-design-system.md), [13-frontend-stack.md](../shell/13-frontend-stack.md).
- **Question:** Should the shell expose a **user-authored raw CSS** surface on top of the composable-token theme model, and where does it live? Raw-CSS modding is a strong driver of community engagement / identity in neighbouring products; the current Brainstorm theme model deliberately constrains authors to token sets / icon packs / typography (passive data, no code, see [40 §Package format](../apps/40-theme-store.md)) so themes don't break under refactor and can be validated for accessibility.
- **Tentative leaning:** **Fold custom CSS into the theme system as a fourth optional component** — `brainstorm/StylePack/v1`, sitting alongside `TokenSet/v1` / `IconPack/v1` / `Typography/v1`, optionally referenced by a `Theme/v1` composite (per [40 §What's distributed](../apps/40-theme-store.md)). User rationale: easier — reuses the existing distribution / signing / install-update / rating / revocation pipeline rather than inventing a parallel "userChrome.css" surface. A theme author can ship "Solarized Dark + Phosphor + Roboto + community polish CSS" as one package; users who want only the CSS install just the StylePack.
- **What this requires before it ships:**
  - **Bundle-validator extension.** [40 §Package format](../apps/40-theme-store.md) currently rejects executable code in theme packages. CSS isn't JS, but the validator has to grow rules for it: reject `url(javascript:…)`, network `@import`, `-moz-binding`, `behavior:`, `expression(...)`, `attr()`-driven exfil patterns, and any external resource fetch outside the package. Probably also a property allowlist (no `content: url(...)` to remote URIs, etc.).
  - **A stable selector contract.** StylePacks targeting private class names break on every refactor. We need a documented `data-bs-*` hook surface on user-visible chrome (dashboard, app frame, settings, panels, popovers) that StylePack authors target instead. Without this the "easier" path becomes "constant breakage." Land the hooks in the design-system pass before opening this surface.
  - **Accessibility posture.** OQ-171 keeps contrast / focus-ring lints absolute on token sets. StylePacks can override anything visual, so we either lint StylePacks too (hard — full CSS evaluation) or accept that StylePack-modified chrome ships without the same accessibility guarantee and surface that to users at install time.
- **Alternatives considered:**
  - **Local-only `custom.css` slot in the vault.** Doesn't go through the store — user edits a file. Power-user escape hatch; not distributable; no signing problem. Could ship alongside the StylePack path for users who want to tweak without authoring a package; not a substitute.
  - **No raw CSS at all.** Stay with token sets only. Refactor-safe and lintable, but closes the "move that pixel" use case power-user communities routinely scratch.
- **Blocking?:** No — v1 ships token-set themes only. StylePack is additive; lands in v1.5 once the validator + `data-bs-*` hook contract are ready.

#### OQ-184 — Soft- vs hard-lock semantics for the app-lock / PIN screen  *[RESOLVED — position taken 2026-05-19 (promotes the 2026-05-16 user-steered leaning); unblocks plan §13.8 surface]*
- **Where:** [implementation-plan.md Stage 13.8](../implementation-plan.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md), [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md), [29-credentials-storage.md](../security/29-credentials-storage.md). Vault session at `packages/shell/src/main/vault/session.ts`.
- **Resolution (v1):** **Hybrid, backend-aware — re-protect by default where it's fast** (the 2026-05-16 leaning, now binding). (1) **Always zero key material on lock**, in every mode — the 32-byte master key + identity-secret + passphrase-wrap buffers; there is no "soft" mode that leaves the key hot. (2) **OS-keyring backend → hard-lock is the default**: drop the in-memory master key and require a keystore unwrap on unlock, gated by a light-tier Argon2id PIN verify; the lazy refcounted YDoc resolver (9.3.2) keeps unlock at key-path latency (~50 ms — Argon2id-light + keychain read + one symmetric unwrap), not O(open docs). (3) **Passphrase-only backend → auto-fall-back to soft-lock** (overlay only, key still zeroed but no cheap re-protect available); surfaced honestly in Settings → Security copy. (4) **"Unlock one window unlocks all"**: the first valid PIN triggers a single shell-side session re-open, then the `app:lock-changed` broadcast tears down every overlay. (5) **PIN is always a gate, never a KDF for the master key** — Argon2id-hashed via the credential store; the master key's real wrap is the high-entropy keystore-held secret (a 4–6 digit PIN is ~13–20 bits, offline-brute-forceable from an on-disk blob). (6) **Brute-force policy:** attempt counter with escalating cooldown; after the cap, the only escape is full-passphrase re-auth (which itself performs the keystore unwrap). The session API surface this fixes: `lock()` / `unlock(pin)` on the vault session (not overlay-only), the `app:lock-changed` broadcast contract, and the keyring-vs-passphrase branch in `session.ts`. Honest limit unchanged: this shrinks the in-RAM key-exposure window (memory inspection / crash dumps / swap); it does **not** defend against a local attacker already holding an unlocked OS user session.
- **Question:** When the app-lock engages (idle timeout, `vault.lock` shortcut, sleep/OS-screen-lock), what actually happens to the open vault session? Two ends of the spectrum:
  - **Soft lock** — the shell paints a full-window lock overlay across the dashboard + every app renderer and refuses input until the PIN clears it, but the in-memory master key, the `entities`/ydoc sessions, and loaded Y.Docs stay resident. Unlock is instant (verify PIN → broadcast `app:lock-changed` → tear down overlay). The threat model it defends: someone walking up to an unlocked machine. It does **not** defend against a memory-dumping attacker — keys are still in RAM.
  - **Hard lock** — lock calls the moral equivalent of `closeActiveVaultSession()`: zero the master key + identity-secret buffers, dispose the passphrase wrap key, tear down `entities` + ydoc worker sessions and evict loaded docs. Unlock must re-derive/re-load from the keystore or passphrase (the PIN can't itself unwrap the master key unless the master key is *also* wrapped under a PIN-derived key — a real KDF cost, and a short PIN is weak KDF input, so this needs a keystore-held high-entropy wrap with the PIN only gating access to it). Strong at-rest-while-running posture; expensive unlock (reload every open doc); interacts with in-flight sync (Stage 10) and unsaved CRDT state.
- **Sub-questions:** Does "unlock in one window unlocks all" hold under hard-lock (the first successful PIN triggers a shell-side session re-open, then broadcasts)? What is the brute-force policy (attempt cap → cooldown → fall back to full passphrase / forced hard-lock)? Is the PIN verifier ever sufficient on its own, or always just a gate in front of the keystore-held secret?
- **Performance (why hard-lock is cheaper here than the usual case):** The expensive part of a hard-lock is normally re-deriving keys and reloading state, not the zeroing. In this architecture both are bounded:
  - **Lock side is ~free** and should run in *every* mode: zeroing the 32-byte master key + identity/wrap buffers is instant; there is no reason to leave the key hot even for a "soft" lock. (Until Stage 3b/10 wire at-rest encryption, the live data path doesn't even decrypt per-op under the master key, so zero-on-lock is currently near-consequence-free.)
  - **Unlock latency = key path only, not O(open docs).** The YDoc resolver (9.3.2) is already lazy + refcounted (`async-load-into-sync-handle`): on unlock only the currently-visible window re-requests its doc; the rest rehydrate on next touch. No eager reload-everything.
  - **Key path is fast on the OS-keyring backend:** light-tier Argon2id PIN verify (tens of ms — the "lighter cost tier" the plan already specs) + keychain read (single-to-tens of ms) + one symmetric unwrap of the 32-byte key (µs) ≈ order of ~50 ms. Imperceptible. The PIN is a *gate* in front of a high-entropy keystore-held wrap, **never** the KDF for the master key (a 4–6 digit PIN is ~13–20 bits — offline-brute-forceable from an on-disk blob).
  - **Passphrase-only backend has no cheap hard-unlock** — no keystore to hold the wrap, and the PIN can't supply the passphrase's entropy. That backend stays soft (or requires full-passphrase re-auth).
  - **Honest limit:** hard-lock shrinks the in-RAM key-exposure window (memory inspection / crash dumps / swap). It does *not* defend against a local attacker who already holds an unlocked OS user session — they can read the keystore directly regardless of our PIN.
- **Decision history:** Earlier leaning was "soft for v1"; reversed 2026-05-16 (user-steered) once the lazy refcounted resolver + PIN-as-gate design removed the reload-cost and weak-KDF objections on the keyring path. Promoted from leaning to binding resolution 2026-05-19.
- **Blocking?:** **Resolved — no longer blocks Stage 13.8.** The position above fixes the session API surface (`lock()`/`unlock()`), the `app:lock-changed` broadcast contract, and the brute-force/fallback UX, so the 13.8 surface iteration can now be specced and built.

#### OQ-185 — Editor virtualization strategy + activation threshold *[RESOLVED in implementation-plan Stage 13.4a (2026-05-25)]*
- **Where:** [52-editor-virtualization.md](../editing/52-editor-virtualization.md), [07-editing-lexical.md §Large documents](../editing/07-editing-lexical.md), [implementation-plan.md Stage 13.4a](../implementation-plan.md). Budgets: [13 §Performance budgets](../shell/13-frontend-stack.md).
- **Question:** Two coupled, measurement-gated decisions for keeping the editor within the `<16ms` keystroke→paint budget on the Stage 13.4 stress document (50MB / thousands of top-level blocks):
  1. **Phase-1-suffices vs. Phase-2-required.** Does Phase 1 (`content-visibility:auto` + height-cache-accurate `contain-intrinsic-size` + offscreen unmount of heavy decorator content) alone clear the budget — keeping the whole tree in the DOM, native find/selection intact, no Lexical fork — or is Phase 2 (true reconciliation-windowing: only the visible slice of root children reconciled, offscreen runs as height-cache-sized spacer `<div>`s) required? The answer is gated on before/after measurements on the 13.4 doc.
  2. **Activation threshold.** Above what document size does virtualization engage (short docs must pay none of the cache/observer/scroll-math overhead)? Keyed on block count, estimated node count, or measured first-paint time — and what value.
- **Options & trade-offs:**
  - **Phase 1 only** — low risk, no Lexical fork, selection + collaboration cursors + (partial) native find preserved. May not hold the budget on the largest docs because the full DOM still incurs style/layout-recalc scope and memory even when offscreen blocks are skip-rendered.
  - **Phase 2** — bounds the editable DOM to the window, the strong large-doc guarantee. Costs: an extended `RichTextPlugin` content component (fork surface to maintain), selection-bearing-block pinning, collab cursors degraded to viewport-edge indicators, and the accepted loss of native Ctrl+F / cross-window drag-select (paid back by shipped in-document find + model select-all). Disqualified absolutely: any variant that mutates the Yjs-bound EditorState for windowing (violates the [07 §Yjs binding](../editing/07-editing-lexical.md) invariant — corrupts the CRDT).
  - **Threshold too low** — short/medium docs carry needless overhead. **Too high** — a doc that needs windowing renders plainly and misses the budget. Wrong key (e.g. block count when the cost is really node count for list/code-heavy docs) mis-triggers either way.
- **Tentative leaning:** Build Phase 1 first and **measure on the 13.4 doc before committing to Phase 2** — Phase 1 is expected to clear the budget for most long documents; Phase 2 is built only against demonstrated miss. Threshold initially block-count-based with a measured-first-paint backstop, value set from the same measurement pass. Non-binding until the numbers exist.
- **Measurement infrastructure landed (2026-05-20, iteration 9.3.5.N5):** the shared `LARGE_DOC_PROFILES` fixture (`dogfood` 200 / `large` 1000 / `stress` 5000 blocks) + `seedLargeDoc` + `timeSamples` + a two-layer keystroke→reconcile bench (`packages/editor/src/keystroke-paint.bench.test.tsx`) — model layer (headless) AND DOM layer (`<BrainstormEditor>` in jsdom) — are committed in `@brainstorm/editor`. **N5 baseline numbers** (M2 Pro, jsdom — note jsdom under-reports real-browser DOM cost because it has no layout engine / compositor / `content-visibility` support, so the absolute budget call still needs real-Electron measurement): model 0.09ms→0.25ms→1.18ms (200/1000/5000 blocks); DOM 0.33ms→1.24ms (200/1000). 13.4a re-runs the SAME fixture under Electron (Playwright bench) for the actual `<16ms` keystroke→paint budget assessment. The OQ-185 answer is still gated on those real-browser numbers; what N5 changes is that 13.4a's Phase-1 vs Phase-2 + threshold-value decisions now have a fixed workload to compare against, not a TBD one — that was the prerequisite the rung was waiting on. The model-layer test also doubles as a regression guard: virtualization is a DOM-only concern, so the model number shouldn't change once Phase 1 / Phase 2 land.
- 13.4a.2 real-Electron baseline (2026-05-25, darwin-arm64, M2 Pro, 50 samples/profile): **empty median=16ms p95=17ms p99=521ms max=1004ms**; **dogfood (200 blocks) median=16ms p95=17ms p99=18ms max=18ms**; **large (1000 blocks) median=16ms p95=17ms p99=17ms max=17ms**. Empty's p99/max are JIT + first-paint warmup outliers — the median is the budget gate per `tests/perf/specs/editor-keystroke.spec.ts`. The dogfood profile cleared the `<17ms` median budget (`editorKeystrokeToPaintDogfood`) with one millisecond of headroom; the large profile (5× the dogfood doc) is statistically indistinguishable from dogfood — virtualization is doing its job.
- **Verdict (2026-05-25): RESOLVED — Phase-1 alone is sufficient.** Phase-2 reconciliation-windowing is **not built** for v1. Activation threshold collapses to "always on, Phase-1 only" — every Notes document gets the keystones (block-id stamp + height cache + `content-visibility` + decorator-unmount), the per-document cost is a one-time block stamp at commit time, no per-doc threshold check. Phase 2 is reinstated as a fresh iteration if (a) Books / Code-editor workloads exceed the keystroke→paint budget under Phase-1 alone, or (b) a future regression to the Phase-1 numbers makes Phase 2 necessary. The Phase-2 design (`52-editor-virtualization.md` §Phase 2) is preserved against that contingency.
- **Mount-regression closed.** The morning 13.4a.2 attempt produced UNDETERMINED numbers because the bench timed out at `[contenteditable="true"]` mount — a fresh `perf-fixture` vault has zero notes, Notes lands on its empty-state UI, no editor mounts. New `packages/shell/src/main/dev/notes-scratch.ts` + dev IPC `dev:notes:create-and-open-scratch-note` mints an empty `Note/v1` + dispatches `intent.open` to give the bench a contenteditable in one shot. `apps/notes/src/editor/dev-bench-plugin.tsx` switched from a build-time `NODE_ENV` gate to an unconditional install (the Notes renderer is sandboxed; global is only reachable inside the Notes window).
- **Blocking?:** **No longer blocks anything.** Phase-1 has shipped; Phase 2 is a contingent future iteration, not a v1 prerequisite.

---

### File manager — UX (added in 41)

#### OQ-174 — Column-view (Finder miller columns) in v1 or v2
- **Where:** [41-file-manager-ux.md](../apps/41-file-manager-ux.md).
- **Question:** Ship Finder-style miller-column drill in v1, or defer to v2?
- **Options & trade-offs:**
  - (a) v1 — power-user familiarity; small visual win.
  - (b) v2 — column view interacts with intra-app tabs ([37](../shell/37-cross-app-navigation.md)) and nav-stack semantics; ship both mature first.
- **Tentative leaning:** (b). List + grid covers the 90%.
- **Blocking?:** No — Stage 9 ships without it.

#### OQ-175 — Unicode normalization on rename
- **Where:** [41-file-manager-ux.md](../apps/41-file-manager-ux.md).
- **Question:** Should the rename commit normalize the new name (NFC vs NFD vs none)?
- **Tentative leaning:** NFC at write time, matching the modern macOS / Linux default.
- **Blocking?:** No.

#### OQ-176 — Bookmark entity type
- **Where:** [41-file-manager-ux.md](../apps/41-file-manager-ux.md).
- **Question:** Introduce `brainstorm/Bookmark/v1` for `text/uri-list` drops, or fall through to no-handler?
- **Tentative leaning:** Defer; ship without it. Bookmarks may be best owned by a future link-preview app per [38-network-and-proxy.md](../security/38-network-and-proxy.md).
- **Blocking?:** No.

#### OQ-177 — Per-folder view-state location (Folder vs FileManagerState)
- **Where:** [41-file-manager-ux.md](../apps/41-file-manager-ux.md), [42-file-manager-implementation.md](../apps/42-file-manager-implementation.md).
- **Question:** Where do per-folder column / sort / view-mode preferences live — on the Folder entity, on the user's `FileManagerState/v1` keyed by folder id, or split?
- **Options & trade-offs:**
  - (a) On Folder — discoverable, exportable with the folder, syncs naturally.
  - (b) On FileManagerState — keeps Folder schema small; pushes the multi-user case (one Folder, two users' preferences) toward a user-scoped overlay.
- **Tentative leaning:** (a) on Folder for v1, since the user is the sole reader/writer pre-Stage 10 sharing. Revisit with multi-user collaboration.
- **Blocking?:** No.

#### OQ-178 — Quick-look fallback when no handler is registered
- **Where:** [41-file-manager-ux.md](../apps/41-file-manager-ux.md).
- **Question:** When `intent.quick-look` has no registered handler for an entity type, fall through to the entity's `preview`-context layout, or surface "No quick-look available"?
- **Tentative leaning:** Fall through to `preview` layout — every entity has one via the layout resolver's fallback chain.
- **Blocking?:** No.

#### OQ-179 — Duplicate vs Pin chord
- **Where:** [41-file-manager-ux.md](../apps/41-file-manager-ux.md).
- **Question:** Default `Mod+D` = Duplicate (Apple Finder convention) or Pin (Arc/Brave convention)?
- **Tentative leaning:** Duplicate. Pin gets `Mod+Shift+D`.
- **Blocking?:** No — both are rebindable from day one.

---

### File manager — implementation (added in 42)

#### OQ-180 — Bundled-install hook location
- **Where:** [42-file-manager-implementation.md](../apps/42-file-manager-implementation.md).
- **Question:** Does `ensureFirstPartyApps` live in `packages/shell/src/main/index.ts` or a dedicated `main/first-party-apps.ts` module?
- **Tentative leaning:** Dedicated module once the list crosses two entries (file-manager + text-editor); start in `index.ts` for the first iteration only.
- **Blocking?:** No.

#### OQ-181 — Per-folder view config: distinct properties or composite
- **Where:** [42-file-manager-implementation.md](../apps/42-file-manager-implementation.md).
- **Question:** Are `columns`, `sort`, `viewMode` distinct properties on `Folder/v1`, or one composite `viewConfig` property?
- **Tentative leaning:** Distinct properties. Doc 30 already declares `sortBy` and `view` as distinct; `columns` joins them. Greppable; matches the existing pattern.
- **Blocking?:** No.

#### OQ-182 — FileManagerState per-user vs per-device
- **Where:** [42-file-manager-implementation.md](../apps/42-file-manager-implementation.md).
- **Question:** Should `FileManagerState/v1` be a single per-user entity, or split user-stable preferences from per-device chrome (sidebar/inspector widths)?
- **Tentative leaning:** Per-user entity for stable preferences; per-device chrome state lives in `storage.kv` (the file manager's app-private keyspace) so a Retina iMac and a 13" MacBook don't fight over sidebar width.
- **Blocking?:** No.

---

### Database app (added in apps/database)

#### OQ-LD-1 — `byLink` with multiple anchors *[RESOLVED in implementation-plan Stage 9.12.22]*
- **Where:** [apps/database/01-data-model.md](../apps/database/01-data-model.md).
- **Question:** Can a `byLink` source anchor multiple entities ("members reachable from any of these N entities by this link type"), or is anchoring single-entity?
- **Options & trade-offs:**
  - (a) Single — simple shape; multi-anchor expressible with a `composite` source of N `byLink`s.
  - (b) Multi (`anchorEntityIds: string[]`) — cleaner predicate; index-friendlier (one SQL `IN` vs N unions).
- **Resolution (2026-06-06, (b) with implicit OR):** `ListSourceByLink` gains an **additive** `anchorEntityIds?: string[]` alongside the now-optional legacy `anchorEntityId?` — a reader unions both, so every persisted single-anchor source still resolves with zero migration. The in-app `evaluateSource`'s `collectByLink` ORs across the anchor set (`byLinkAnchors`); the future SQL compiler folds the N-way OR into one `IN`. Landed in 9.12.22.
- **Blocking?:** No.

#### OQ-LD-2 — Property-value retention when an entity leaves the last List that scoped it
- **Where:** [apps/database/01-data-model.md](../apps/database/01-data-model.md), interacts with [19 §Remove](../data/19-properties-and-schemas.md).
- **Question:** When entity E held a value V on a property whose PropertySchema has `scope.kind = "list"` and target L, and E later leaves L's effective membership (and is in no other List with the same property), is V kept or purged?
- **Options & trade-offs:**
  - (a) Keep — non-destructive; consistent with `scope.kind = "type"` removal behavior.
  - (b) Purge — fewer orphaned values; matches "the property no longer applies."
- **Tentative leaning:** (a) keep. Consistent with the existing PropertySchema removal rule (values become orphan, surfaced under "(removed property)" if needed).
- **Blocking?:** No.

#### OQ-LD-3 — Which built-in type-Lists ship in v1
- **Where:** [apps/database/01-data-model.md](../apps/database/01-data-model.md).
- **Question:** Which entity types get a seeded "All X" Query list by default?
- **Options & trade-offs:**
  - (a) One per shipped first-party type (`Note`, `Folder`, `File`, `List`, `Workflow`, `Reminder`).
  - (b) All registered types, including third-party.
  - (c) None — user opts in via Explorer app.
- **Tentative leaning:** (a) for v1. Explorer app's "browse all types" surface covers (b) implicitly.
- **Blocking?:** No.

#### OQ-LD-4 — UI naming: "Database" vs "List"
- **Where:** [apps/database/10-lists-sets-collections.md](../apps/database/10-lists-sets-collections.md).
- **Question:** In the launcher / window title / sidebar, do we say "Database" (familiar to most users) or "List" (accurate, shorter)?
- **Options & trade-offs:**
  - (a) "Database" — recognizable, matches the common user mental model from prior tools.
  - (b) "List" — accurate, fits the unified shape, less power-user-coded.
- **Tentative leaning:** "Database" in the launcher and window title (the app's surface name); "List" as the entity-type name in code (`brainstorm/List/v1`). Two names, distinct contexts.
- **Blocking?:** No.

#### OQ-LD-5 — Cleanup of stale `members.exclude` records
- **Where:** [apps/database/10-lists-sets-collections.md](../apps/database/10-lists-sets-collections.md).
- **Question:** When an entity is in `members.exclude` and later edited so it no longer matches the source, the exclude becomes a no-op. Auto-cleanup or leave?
- **Tentative leaning:** Auto-cleanup on next List-edit transaction (silent). The user's intent ("hide this from the list") is preserved while the entity matches; once it doesn't, the record is unnecessary.
- **Blocking?:** No.

#### OQ-LD-6 — `bySublist` as a first-class source kind
- **Where:** [apps/database/10-lists-sets-collections.md](../apps/database/10-lists-sets-collections.md).
- **Question:** Express "members of another List" as a primitive (`bySublist: { listId }`) or rely on `byLink` against the List's members array?
- **Tentative leaning:** Defer to v2 if `byLink` proves cumbersome. Don't pre-emptively grow the source vocabulary.
- **Blocking?:** No.

#### OQ-LD-7 — Nested-collections affordance
- **Where:** [apps/database/10-lists-sets-collections.md](../apps/database/10-lists-sets-collections.md).
- **Question:** Prior "Collections 2.0"-style proposals included nested collections with property inheritance. Do we ship a nesting primitive, or rely on `byLink` composition?
- **Tentative leaning:** Rely on `byLink` for v1; revisit if users build deep nesting workflows in practice.
- **Blocking?:** No.

#### OQ-LD-8 — Out-of-vocabulary values in board group-by
- **Where:** [apps/database/30-filters-sorts.md](../apps/database/30-filters-sorts.md).
- **Question:** When a board's `groupBy` is a vocabulary-typed property and entity data carries values outside the vocabulary (drift / legacy), render them in their own columns or roll into "Uncategorized"?
- **Tentative leaning:** Own columns, with a "fix value" hint surfaced on the column header. Hiding drift in "Uncategorized" makes it harder to notice.
- **Blocking?:** No.

#### OQ-LD-9 — Create-flow inheritance overridden by inline edit
- **Where:** [apps/database/40-create-flow.md](../apps/database/40-create-flow.md).
- **Question:** When the view's filter pins property P = V at create, and the user types a different V', the new entity vanishes from the view (filter no longer matches). Toast and let through, or warn before commit?
- **Tentative leaning:** Toast ("Created — not shown in this view because filter mismatch") with an Undo. Don't block.
- **Blocking?:** No.

#### OQ-LD-10 — Templates as a type
- **Where:** [apps/database/40-create-flow.md](../apps/database/40-create-flow.md); designed in [platform/66-templates.md](../platform/66-templates.md).
- **Question:** Is a template a `brainstorm/Template/v1` entity type, or a tagged regular entity flagged "isTemplate" on a property?
- **Options & trade-offs:**
  - (a) Own type — explicit, queryable, BP-clean.
  - (b) Tagged — fewer types, simpler.
- **RESOLVED 2026-06-20: (a) own type `brainstorm/Template/v1`.** Decided in [platform/66-templates.md](../platform/66-templates.md): the tagged alternative pollutes every `byType` query (every Tasks/Notes/… view would surface its own templates unless every source+filter excluded `isTemplate`); an own type keeps templates out of normal queries by construction, makes "templates for type T" a lookup, and preserves the one-type-per-object invariant (the produced type is a `targetType` *property*, not the object's identity type). Templating is a cross-app platform foundation, not Notes-internal.
- **Blocking?:** No.

#### OQ-LD-11 — Per-block view selection on embedded lists
- **Where:** [apps/database/50-embedding-and-intents.md](../apps/database/50-embedding-and-intents.md).
- **Question:** Can the `embedded-list` block persist its own choice of view (overriding `defaultViewId`) without modifying the underlying List?
- **Tentative leaning:** Yes — persist `selectedViewId` as a Lexical block prop. The List's `views` array is the menu's value space.
- **Blocking?:** No.

#### OQ-LD-12 — Predicate-based `intent.add-to-list`
- **Where:** [apps/database/50-embedding-and-intents.md](../apps/database/50-embedding-and-intents.md).
- **Question:** Does `intent.add-to-list` accept a predicate (add all entities matching X to List Y), or only explicit entity ids?
- **Tentative leaning:** Explicit ids only. Predicate-based bulk-add is what setting a source does; we don't want two ways to do that.
- **Blocking?:** No.

#### OQ-LD-14 — Event vs span z-order on timeline compact density
- **Where:** [apps/database/20-views.md §Timeline](../apps/database/20-views.md).
- **Question:** In compact density, when an event-mode item and a span-mode item start at the exact same instant, which renders on top?
- **Options & trade-offs:**
  - (a) Span on top — longer-lived item is more visually salient and more likely to need editing.
  - (b) Event on top — a tiny marker getting hidden under a long bar is a discoverability loss.
  - (c) User-configurable — lets sticklers tune; one more option to teach.
- **Tentative leaning:** (a) span on top. Markers get a small "+1" badge when occluded so the user knows something's there.
- **Blocking?:** No.

#### OQ-LD-15 — Value envelope: bare-path filter when `valueMeta` later changes
- **Where:** [data/19-properties-and-schemas.md §Value envelopes](../data/19-properties-and-schemas.md).
- **Question:** Bare-path filters on envelope-typed properties (`$eq: { "price": 99 }`) compile to `<property>.value` paths. What happens when a schema *previously* had `valueMeta` and a user wrote `$eq: { "price.currency": "EUR" }`, then the schema drops `valueMeta` — the meta path now references something that doesn't exist?
- **Options & trade-offs:**
  - (a) Silently treat as `$exists: false` (the filter never matches). Tolerant; surprises the user.
  - (b) Surface a one-time warning on the filter row, treat as `$exists: false`. Same behaviour with one-time visibility.
  - (c) Fail the whole query with a schema-drift error. Loud, but the user has to fix every consumer.
- **Tentative leaning:** (b). The query keeps running; the user can fix the filter when they notice.
- **Blocking?:** No.

#### OQ-LD-17 — Where placement / partitioning config lives on a ListView
- **Where:** [apps/database/01-data-model.md](../apps/database/01-data-model.md), [apps/database/20-views.md](../apps/database/20-views.md).
- **Question:** Today, `ListView.groupBy` is a top-level field used by Board (column property) and Calendar (date placement property). Timeline doesn't use it — its placement (`primaryDateProperty`, `endDateProperty`) and lane (`swimlaneBy`) all live inside `TimelineLayoutOptions`. Three kinds, three semantics, two of them at the top level and one of them inside layoutOptions. Should this be unified?
- **Options & trade-offs:**
  - (a) Keep as-is — document the asymmetry; `groupBy` semantics differ per kind but it's just a property reference.
  - (b) Push everything into per-kind `layoutOptions`: `BoardLayoutOptions.groupBy`, `CalendarLayoutOptions.dateProperty`, `TimelineLayoutOptions.{primaryDateProperty, endDateProperty, swimlaneBy}`. Drop top-level `groupBy` entirely.
  - (c) Unify under a top-level `placement` field — a discriminated union per kind. Drops kind-specific config out of `layoutOptions` and into its own typed slot.
- **Tentative leaning:** (b). Each kind owns its placement config; the top-level field set on ListView shrinks. Costs one migration when 9.12.5 lands — cheap if done before code depends on `groupBy`. (c) is more typed-symmetric but adds a new top-level field; not worth it for v1.
- **Blocking?:** No — does not block 9.12.1 / 9.12.2, but should be resolved before 9.12.5 (ListView life-cycle) and 9.12.8 (Board view rendering) since those iterations consume `groupBy` directly.

#### OQ-LD-16 — Per-meta-field display options
- **Where:** [data/19-properties-and-schemas.md §Value envelopes](../data/19-properties-and-schemas.md).
- **Question:** Display options (label, icon, view, view-options) currently live on the PropertySchema. With value envelopes, meta fields are tiny PropertySchemas. Do meta fields get their own display options, or does the property's display option speak for the whole envelope?
- **Tentative leaning:** Meta fields inherit the property's display by default in v1. Per-meta-field display overrides arrive in v2 once the design-system layout system can express compound rendering (a price + currency-chip combo, a number + unit-pill combo, etc.).
- **Blocking?:** No.

#### OQ-LD-13 — Drag-update via blanket `entities.write` vs per-update intent
- **Where:** [apps/database/50-embedding-and-intents.md](../apps/database/50-embedding-and-intents.md).
- **Question:** Drag-to-other-column in board / calendar / timeline writes the underlying entity. Route via a blanket `entities.write: *` capability (one prompt at install) or a curated `intent.update-property` (one prompt per drag)?
- **Options & trade-offs:**
  - (a) Blanket — friction-free; broad write surface.
  - (b) Intent-routed — tight; unbearable friction.
  - (c) Hybrid — blanket for properties in the active view's `groupBy` / sort key, intent for others.
- **Tentative leaning:** (a) for v1, with the install-time prompt spelling out the reason verbatim. Revisit with user feedback.
- **Blocking?:** No.

## Graph app — `OQ-GR-1` … `OQ-GR-9`

#### OQ-GR-1 — Pattern persistence shape on `Graph/v1` *[RESOLVED in implementation-plan 9.13.3]*
- **Where:** [apps/graph/01-data-model.md §Storage layout](../apps/graph/01-data-model.md).
- **Question:** Should `pattern` persist as (a) one `Y.Map<string, Subject>` keyed by subject name + one `Y.Array<EdgeConstraint>` for edges, or (b) a single opaque blob inside one Y.Map field?
- **Options & trade-offs:**
  - (a) Structural — two devices adding subjects / edges concurrently merge cleanly.
  - (b) Opaque blob — last-write-wins on the whole pattern. Simpler renderer code; concurrent edits clobber.
- **Resolution:** (a) Structural. The persisted shape is the already-landed `GraphPattern` (`packages/shell/src/main/entities/pattern.ts`, mirrored by `apps/graph/src/types/pattern.ts`) projected onto the `Graph/v1` entity's Y.Doc as: `subjects` → a `Y.Map<subjectName, Y.Map>` where each subject's `Y.Map` carries `kind` / `types` (a `Y.Array<string>`) / `where` (the predicate as a JSON-serialised value — predicates are edited atomically, not field-merged) / `displayName`; `edges` → a `Y.Array<Y.Map>`, one `Y.Map` per `EdgeConstraint` (`from`, `to`, `linkTypes` as a `Y.Array<string>`, `direction`, `match`, `hops` as a fixed 2-tuple `Y.Array<number>`); `primarySubject` → a top-level `Y.Text`/string field on the Graph Y.Doc root. Rationale: the pattern is small (≤16 subjects, ≤32 edges per the [01-data-model §Hard caps](../apps/graph/01-data-model.md#hard-caps)) so structural CRDT overhead is irrelevant, while subject reorders and concurrent edge additions on two devices (Stage 10 collaborative editing) must merge without clobber — exactly what the structural shape buys. The single-object-space model is unaffected: this is the `Graph/v1` entity's own Y.Doc, no schema/BP change, the compiler reads the flat decoded `GraphPattern` (the entities service's pattern query path takes the decoded value; the Y.Doc↔`GraphPattern` codec is the 9.13.6 renderer-side concern, gated by OQ-GR-2). `where` stays an opaque JSON value rather than a nested `Y.Map` because a property predicate is a small expression tree edited as a unit — structural merge of a half-edited predicate would yield an invalid tree, and predicates are not a concurrent-edit hotspot the way the subject/edge sets are.
- **Blocking?:** No (resolved — unblocked **9.13.3**, the pattern compiler wiring).

#### OQ-GR-2 — Layout coordinate storage: per-view vs per-entity  *[RESOLVED in implementation-plan Stage 9.13.6, 2026-06-11 — option (a)]*
- **Where:** [apps/graph/01-data-model.md §Storage layout](../apps/graph/01-data-model.md).
- **Question:** Does a node's `(x, y)` live (a) on the `GraphView` (per-view positions), (b) on the entity itself as a `_layoutPositions: Record<viewId, {x,y}>` property, or (c) as a separate `LayoutPosition` entity per (view, entity) pair?
- **Options & trade-offs:**
  - (a) Per-view — clean ownership; survives entity reload; matches the common prior-art pattern.
  - (b) Per-entity — moves with the entity if it goes to another vault; couples graph state to entity state.
  - (c) Separate entity — flexible but adds a per-(view,entity) entity, which scales poorly.
- **Tentative leaning:** (a). Layout is a property of the rendering, not the data.
- **Resolution (9.13.6, 2026-06-11):** **(a) per-view**, at the leaning. A node's `(x, y)` lives on the `GraphView/v1` entity's Y.Doc as a `coords` Y.Map keyed by node entity-id — one `Y.Map` per node (`{x, y, pinned}`) so concurrent drags of different nodes merge structurally and same-node drags converge per-field LWW. Two views of the same Graph hold independent layouts; coordinates survive entity reload and never couple graph state to the entity itself. (b) rejected: couples rendering state to data portability; (c) rejected: a per-(view,entity) entity scales poorly. Implemented as `apps/graph/src/logic/graph-view-yjs-codec.ts` (diff-aware single-transact encode, tolerant decode, 50k hard cap per the data-model §Hard caps) + `storage/graph-view-repository.ts` (`ensureDefaultView` / `loadViewCoords` / `saveViewCoords`); `Graph.pins` write-back for cross-view pin consistency is forward scope (the multi-view lifecycle rung).
- **Blocking?:** ~~Yes — blocks **9.13.6**.~~ Resolved.

#### OQ-GR-3 — `links.created_at` backfill for legacy data  *[RESOLVED in implementation-plan Stage 9.13.10b, 2026-05-17 — option (c)]*
- **Where:** [apps/graph/01-data-model.md §Backfill](../apps/graph/01-data-model.md) and [apps/graph/30-history-animation.md](../apps/graph/30-history-animation.md).
- **Question:** For vaults upgraded from a build before link `created_at` was reliably written, how do we render those edges on the history timeline?
- **Options & trade-offs:**
  - (a) Treat missing as "exists from the beginning" — shows at frame 0.
  - (b) Treat missing as "appeared last" — shows at the right edge.
  - (c) Backfill on first Graph-app launch: `link.created_at = MAX(link.created_at, source_entity.created_at)`. One-shot SQL UPDATE; audit-log records the row count.
- **Resolution (9.13.10b, 2026-05-17):** **(c)**. Implemented as the pure, idempotent `apps/graph/src/logic/history-backfill.ts` `backfillCreatedAt(graph)` applied once where the vault snapshot becomes the in-memory graph (`loadVaultEntities`): a link's ts = `MAX(link.createdAt, source_entity.createdAt)` (an edge can't predate its source; a missing link ts inherits the source's); an entity — or a link whose source is itself timeless / absent — with no usable ts falls back to the **minimum known timestamp** across the graph (legacy element shows near frame 0, not at the 1970 epoch which would wreck the scrubber bounds). Pure (returns a fresh graph, never mutates) + idempotent (a real ts is only ever pushed later, never rewritten on a second pass) + degenerate-safe (all-timeless graph → no-op, no NaN/throw). The pre-entities-service in-memory model has no SQL `UPDATE`/audit-log surface, so the backfill is the in-memory pass; the keystone survives the Stage 9.3 entities-service swap (the SQL one-shot + audit-log row count is the same rule applied server-side when that lands). +10 tests; **OQ-GR-3 no longer gates 9.13.10**.
- **Blocking?:** ~~Yes — blocks **9.13.10**.~~ Resolved.

#### OQ-GR-4 — Renderer pick: pixi+d3 on main, pixi+d3 in worker, or custom WebGL2 *[RESOLVED in implementation-plan Stage 9.13.1.10, 2026-05-14]*
- **Where:** [apps/graph/20-views-and-rendering.md §Rendering](../apps/graph/20-views-and-rendering.md).
- **Question:** Which renderer hits the 10k-node 60fps budget while keeping interaction latency under 50ms?
- **Options & trade-offs:**
  - (a) pixi.js + d3-force on main thread — simplest, fine to ~3k nodes.
  - (b) pixi.js + d3-force in a Worker (positions over `MessageChannel`) — keeps main responsive on large graphs.
  - (c) Custom WebGL2 with transform-feedback positions — fastest, complex maintenance.
- **Resolution:** (a) Pixi on main thread is the **first cut** (landed 2026-05-14 in 9.13.1.10): one shared circle texture + per-node `Sprite(.tint)` + single `Graphics` for edges + DOM label overlay = one GL draw call per layer, so 1k–3k nodes render at 60fps with no sim work in the main loop blocking it. The move to (b) — sim + paint in a Worker via `OffscreenCanvas` + `MessageChannel` — is the **follow-up** within the same 9.13.5 umbrella, gated on a measured-latency breach from the perf-bench harness. Option (c) stays explicitly rejected: maintenance cost on a custom WebGL2 path (texture atlases, batching, glyph rendering) doesn't beat Pixi 8's already-batched primitives.
- **Blocking?:** No (resolved).

#### OQ-GR-5 — Co-presence cursor model
- **Where:** [apps/graph/20-views-and-rendering.md](../apps/graph/20-views-and-rendering.md).
- **Question:** Does the Graph app emit awareness for layout drags (showing other devices' cursors moving nodes), or are graph layouts read-only-for-others?
- **Tentative leaning:** Read-only-for-others in v1; awareness cursors land alongside text-editor awareness in Stage 10. The Graph app reads vault data which Stage 10 makes co-editable; per-view drag state is local-only.
- **Blocking?:** No.

#### OQ-GR-6 — Compare mode (two graphs side-by-side or two history-cutoffs)
- **Where:** [apps/graph/20-views-and-rendering.md §Compare mode](../apps/graph/20-views-and-rendering.md).
- **Question:** Worth shipping in v1 or v2?
- **Tentative leaning:** v2. The base history scrubber covers most "what changed" questions; compare-mode is a heavier UX and a layout-coordination problem (two synced cameras, shared zoom).
- **Blocking?:** No.

#### OQ-GR-7 — Cluster summarization at extreme zoom-out
- **Where:** [apps/graph/20-views-and-rendering.md §Cluster summarization](../apps/graph/20-views-and-rendering.md).
- **Question:** At zoom < 0.15, do we render N individual nodes (slow + noisy) or summarize each detected cluster into a single labeled supernode?
- **Tentative leaning:** Summarize at v2; in v1 just thin to a heat-map cluster blob (alpha-blended bubble around each cluster's centroid).
- **Blocking?:** No.

#### OQ-GR-8 — "Distinct subjects" default in patterns
- **Where:** [apps/graph/10-pattern-filters.md §Compilation](../apps/graph/10-pattern-filters.md).
- **Question:** When two subjects in the same pattern share constraints (e.g. two `Person` subjects), should the SQL plan emit `A.id != B.id` by default (preventing self-binding) or allow it (matching the same entity twice)?
- **Tentative leaning:** Distinct by default; user toggles "**Allow self-binding**" when needed. The canonical "two Persons sharing a school" example expects distinctness; allowing self-binding is the unusual case.
- **Blocking?:** No.

#### OQ-GR-9 — Saved-pattern templates as a separate entity type
- **Where:** [apps/graph/10-pattern-filters.md §Pattern templates](../apps/graph/10-pattern-filters.md).
- **Question:** Is a pattern template a `brainstorm/GraphPatternTemplate/v1` entity, or just a forked Graph entity with the same pattern + a `system: true` flag?
- **Tentative leaning:** Fork. Same approach as Database app templates per OQ-LD-10.
- **Blocking?:** No.

---

## Tasks app — `OQ-TK-1` … `OQ-TK-2`

(Added 2026-05-14 with the 9.14 Tasks app planning.)

#### OQ-TK-1 — Recurrence-rule storage shape *[RESOLVED in implementation-plan Stage 9.14.1, 2026-05-14]*
- **Where:** Implementation plan §Stage 9.14; shared with OQ-CAL-1.
- **Question:** RRULE-lite string (RFC 5545 subset, opaque) vs. structured `Recurrence` discriminated union (`Daily { every }` / `Weekly { days, every }` / `Monthly { day | dayOfWeek, every }` / `Yearly { month, day }` / `Custom { rrule }`) in `@brainstorm/sdk-types`?
- **Resolution:** Structured discriminated union via `RecurrenceKind` TS enum (`Daily` / `Weekly` / `Monthly` / `Yearly` / `Custom`) lives in `@brainstorm/sdk-types`. Query-friendly, editor-friendly, `Custom { rrule: string }` is the escape hatch for full RRULE. Shared by Tasks (`Task.recurrence`) and Calendar (`Event.recurrence`) so the recurrence editor + the next-occurrence engine are written once. Weekday discriminator is a separate `Weekday` enum (`Mon..Sun`). Caps: `every >= 1` (Daily / Weekly / Monthly), `month 1..12 + day 1..31` (Yearly).
- **Blocking?:** Was yes — blocks 9.14.1 (type-level surface). Resolved at the tentative leaning during the 9.14.1 scaffold.

#### OQ-TK-2 — Project modelling — `Project/v1` vs. Note-with-`kind=project` *[RESOLVED in implementation-plan Stage 9.14.1, 2026-05-14]*
- **Where:** Implementation plan §Stage 9.14.
- **Question:** Is a Project a first-class `brainstorm/Project/v1` entity (Tasks-app-owned), or a `Note/v1` with a `kind: "project"` discriminator (Notes-app-owned, Tasks just queries it)?
- **Resolution:** First-class `brainstorm/Project/v1` entity, Tasks-app-owned. Owns project-specific properties (`status`, `milestone date`, `archivedAt`, `colorHint`) without bloating the Note schema. The Project ↔ Note relationship is a typed link (added later — see [[OQ-LD-14]] / `Org/v1` precedent). Notes' "open this project's notes" intent is dispatched via the Files/Database "open type-List" path. Tasks app registers Project/v1 in the entities service, primary opener, and the dashboard's Database "All Projects" type-List shortcut surfaces it as a pinned tile.
- **Blocking?:** Was yes — blocks 9.14.1 (type-level surface). Resolved at the tentative leaning during the 9.14.1 scaffold.

#### OQ-TK-3 — Tasks inspector side panel — width + collapse-state persistence *[PARTIALLY RESOLVED in implementation-plan Stage 9.14.6]*
- **Resolution (2026-05-29):** Width persists **per-user-globally** via `localStorage` (`tasks:inspector-width`, through the shared `applyPersistedPanelWidth` + `attachResizable` primitive) — same mechanism the Tasks sidebar already uses, simpler than a per-vault `kv` round-trip and consistent with the other Tasks panels. **Open/collapsed state is NOT persisted across reloads** in 9.14.6: a reloaded inspector pointing at a possibly-deleted task is the same staleness trap the sidebar selection tolerates, so the inspector boots closed. Re-opening to the last-inspected task on launch stays deferred (non-blocking) if anyone asks. Per-surface widths (option b) remain an unbuilt advanced affordance.
- **Where:** Implementation plan §Stage 9.14.6.
- **Question:** When the Tasks app introduces its right-side inspector for the body editor + property chips (9.14.6), where does the panel's width + open/collapsed state persist? Per-vault, per-list-surface (Today vs. Upcoming vs. a specific project), per-user-globally, or session-only?
- **Options:** (a) Per-vault single setting on the dashboard `kv` (matches how Files persists sidebar width). (b) Per-list-surface key (`tasksInspector.width:today`, `…:upcoming`, `…:project/<id>`) — gives the user different widths per context but more state surface. (c) Session-only via `sessionStorage` — no persistence across vault re-opens.
- **Tentative leaning:** **(a) Per-vault single setting** — matches Files' sidebar pattern and the user's mental model ("how wide is *my* inspector"). One key, one row, easy to clear, sized via the existing `<Resizer>` primitive. Per-surface widths are an advanced affordance we can add later if anyone asks; session-only loses the user's customization on every restart and feels broken.
- **Blocking?:** **No** — non-blocking for 9.14.6 (the panel ships with a sensible default + per-vault width; the resolution just picks the persistence key).

---

## Calendar app — `OQ-CAL-1` … `OQ-CAL-2`

(Added 2026-05-14 with the 9.15 Calendar app planning.)

#### OQ-CAL-1 — Recurrence-rule storage shape *[RESOLVED in implementation-plan Stage 9.15.1, 2026-05-14 — inherits OQ-TK-1]*
- **Where:** Implementation plan §Stage 9.15; shared with OQ-TK-1.
- **Question:** Same as OQ-TK-1, but for `Event/v1`. Must converge to a single type in `@brainstorm/sdk-types`.
- **Resolution:** Inherits OQ-TK-1's resolution — Calendar's `Event/v1.recurrence` consumes the same structured `Recurrence` discriminated union (`RecurrenceKind.Daily | Weekly | Monthly | Yearly | Custom`) that lives in `@brainstorm/sdk-types/recurrence.ts` and is already used by `Task/v1.recurrence`. Single type, single editor, single `nextOccurrence` engine across both apps.
- **Blocking?:** Was yes — blocked 9.15.1. Resolved at scaffold time by reference.

#### OQ-CAL-2 — Birthdays-as-virtual-events vs. minted Event entities *[RESOLVED in implementation-plan Stage 9.15.5]*
- **Where:** Implementation plan §Stage 9.15.4 / §9.15.5; supersedes the original OQ-LD-15 (which scoped the question to the Database calendar view).
- **Question:** Do Person birthdays surface on the Calendar app as **virtual events** computed yearly from `Person.bday` (no entity per year), or as **pinned Events** the user can edit (title, reminder) per occurrence?
- **Resolution (2026-05-18):** **Virtual by default**, via the *shared `Recurrence` union* — a birthday is `start = Person.birthday` + `{ kind: Yearly, month, day }` (no per-year entities), materialized onto the visible window by the one shared `occurrencesInRange` engine (`packages/sdk-types/src/recurrence-occurrences.ts`). `yearlyRecurrenceForDate` / `birthdayOccurrencesInRange` are the concrete shared helpers Calendar, the Database 9.12.13(b) Birthdays view, and the Contacts surface all call so the day-of-year (incl. the Feb-29 → Feb-28 non-leap clamp) is identical everywhere. A user-pinned `Event` on the same day still overrides the virtual one for that year (Calendar already merges its own `Event/v1` rows after the projection). This is the single model OQ-CT-3 requires; resolving this resolves OQ-LD-15.
- **Blocking?:** Was — blocked the seeded `Birthdays` view in 9.12.13 and cross-app birthday surfacing. The shared engine (the gating keystone) landed at 9.15.5; per-surface wiring is the tracked follow-up.

---

## Journal app — `OQ-JR-1`

(Added 2026-05-14 with the 9.16 Journal app planning.)

#### OQ-JR-1 — Journal templates
- **Where:** Implementation plan §Stage 9.16.
- **Question:** What's the template shape — per-day fixed template, per-weekday set, or user-saved templates picked at journal-open time?
- **Tentative leaning (refined 2026-06-20):** a journal template is a `brainstorm/Template/v1 { targetType: Note/v1 }` owned by the Journal collection (per-vault default via the collection's `defaultTemplate`) — an application of the cross-app templates foundation ([platform/66-templates.md](../platform/66-templates.md)), **not** a bespoke `kind=journal-template` flag. Mon-Fri / weekend split stays a user concern. Dynamic `{{today}}` tokens tracked as OQ-TPL-3 (v2).
- **Blocking?:** No — 9.16.1/9.16.2 can ship with no template support; resolve before 9.16.3 polish iteration.

---

## Whiteboard app — `OQ-WB-1` … `OQ-WB-4`

(Added 2026-05-14 with the 9.17 Whiteboard app planning.)

#### OQ-WB-1 — Edge data model — separate entity vs. inline on Whiteboard *[RESOLVED in implementation-plan Stage 9.17.1, 2026-05-14]*
- **Where:** Implementation plan §Stage 9.17.
- **Question:** Are whiteboard arrows stored as **separate `brainstorm/WhiteboardEdge/v1` entities** (query-friendly, multi-board reuse, surfaces in the entities service like everything else) or **inline on `Whiteboard.edges[]`** (simpler, per-board only, no separate index)?
- **Resolution:** Separate `brainstorm/WhiteboardEdge/v1` entity. Each edge carries a `whiteboardId` foreign key, `sourceNodeId` / `sourceHandle` / `destNodeId` / `destHandle` endpoints, `pathKind` (Bezier / Step / Straight), `arrowHead` (None / Arrow / Dot / Box / Diamond), optional label + colorHint. Matches the Graph-app modelling instinct (edges as first-class so they're queryable + carry properties); enables future cross-board edge index. Nodes stay **inline** on `Whiteboard.nodes[]` (per-board layout, no reuse).
- **Blocking?:** Was yes — blocked 9.17.1. Resolved at scaffold time.

#### OQ-WB-2 — Handle addressability *[RESOLVED in implementation-plan Stage 9.17.1, 2026-05-14]*
- **Where:** Implementation plan §Stage 9.17.
- **Question:** Fixed compass handles per node (N / E / S / W + optional NE/SE/SW/NW), or arbitrary user-placed handles (react-flow's `Handle` model — positionable anywhere on the node border)?
- **Resolution:** Four-compass model in v1 (`HandleSide.Top` / `Right` / `Bottom` / `Left`). Covers ~95% of UX with simpler routing math, smaller per-edge payload, predictable arrowhead positioning. Arbitrary handles become an opt-in v2 toggle (advanced board mode) — the enum can grow a `Custom { offset: number }` variant later without breaking v1 wire format.
- **Blocking?:** Was yes — blocked 9.17.1. Resolved at scaffold time.

#### OQ-WB-3 — Whiteboard arrows in the Graph app's edge index
- **Where:** Implementation plan §Stage 9.17.
- **Question:** Do whiteboard arrows ever participate in the Graph app's semantic edge index (e.g. an "all arrows pointing at this entity across every whiteboard" Graph view), or are they purely visual and invisible to Graph?
- **Tentative leaning:** Default no — whiteboard arrows are visual connectors, not typed links. Crossing the boundary muddies what the Graph app means. A user who wants a typed link writes one via the Notes mention / Mod+K / inspector flow instead.
- **Blocking?:** No — non-blocking for 9.17.1; revisit after 9.17.4 (embedded-entity nodes) once we see real usage.

#### OQ-WB-4 — Frame drag semantics *[RESOLVED in implementation-plan Stage 9.17.3, 2026-05-17]*
- **Where:** Implementation plan §Stage 9.17.3.
- **Question:** When the user drags a Frame, does it move only itself (a static label/region) or translate the nodes spatially inside it? (The `node.ts` header comment said "doesn't move its children"; the implementation-plan ladder text implied frame+group containment with no detail.)
- **Resolution:** A Frame **translates its spatially-contained nodes** (FigJam/Figma behaviour, matches user mental model). Membership is spatial + dynamic (a node is "in" a frame when fully inside its content region) with **capture-at-drag-start** (not continuous re-evaluation, avoids fall-out/snap jank); no stored `parentId` so the wire contract is unchanged. A Group, distinctly, drags its explicit `memberIds` together (stored, stable, not spatial). Pure helpers in `apps/whiteboard/src/logic/containment.ts` (`frameMoveDelta` / `resolveDragSet` / `nodesWithinFrame`), renderer-agnostic so they survive the 9.17.5 Pixi swap. Nested groups deferred to v2 (flat: a node is in at most one group).
- **Blocking?:** Was yes — blocked 9.17.3. Resolved at implementation time.

#### OQ-WB-5 — Canvas renderer approach (DOM vs. Pixi vs. hybrid)  *[RESOLVED in implementation-plan 9.17.20 — optimized-HTML, then a static-layer canvas hybrid only if measured]*
- **Where:** Implementation plan §Stage 9.17.20 (canvas renderer perf).
- **Question:** The whiteboard paints nodes/edges as per-node DOM (`render/node-dom.ts`). To hold frame-time at scale, migrate to (a) **Pixi canvas** (max ceiling; reuse Graph's `pixi-renderer.ts` scaffolding) — but Pixi can't host `contentEditable`/a11y/CSS-theme nodes, forcing a DOM-overlay split + re-implementing rich sticky/text content on the canvas; (b) **optimized HTML** — keep the rich-DOM node model but fix the perf (single GPU-composited transform layer, viewport culling/virtualization, per-node incremental repaint); or (c) a **hybrid** (HTML near/interactive layer + canvas for bulk static nodes/edges).
- **Resolution:** **(b) optimized-HTML first**, with **(c) a static-layer canvas hybrid only if a measured regression demands it**. Rationale: 9.17.21 already landed the **camera-paint split** (`paintCamera` transforms a single layer on pan/zoom — no per-frame `replaceChildren`), so the cheapest, highest-leverage half of (b) is *done*; the remaining bottleneck is the per-node DOM **count** at scale, addressed by **viewport culling** (only mount nodes whose world-rect intersects the padded viewport) + **per-node incremental repaint** (diff a node, patch its element, never rebuild the layer). This preserves the load-bearing rich-DOM model — native `contentEditable` sticky/shape text (`ui/text-edit.ts`), CSS theme tokens, a11y, the inline-edit + selection chrome — that a Pixi rewrite would have to re-implement behind a DOM-overlay split (the exact complexity Pixi's "max ceiling" buys, unjustified until a real board exceeds the HTML ceiling). The model + `logic/*` (align/snap/connector/containment) are renderer-agnostic and untouched either way. The first migration rung is the pure viewport-culling selector (`logic/`), wired into the existing paint; before/after frame-time numbers (doc-13 budget) gate any further escalation to the canvas hybrid.
- **Blocking?:** Was yes — 9.17.20 says "resolve the approach as an OQ before code." Now resolved; the culling rung can land.

---

## Bookmarks app — `OQ-BM-1`

(Added 2026-05-14 with the 9.18 Bookmarks app planning.)

#### OQ-BM-1 — Offline reader-view scope
- **Where:** Implementation plan §Stage 9.18.
- **Question:** What does "save a bookmark" persist beyond the URL — a Readability.js snapshot (clean reader text), the raw HTML cache (faithful but heavy), or URL + metadata only (lightest, but useless offline)?
- **Tentative leaning:** Phase the answer. v1 (9.18.2 manual paste): URL + user-supplied metadata only. Post-v1: a per-bookmark **"download page content"** flag — off = OpenGraph/metadata only; on = cleaned page body. **The *how* is now designed — [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md): per user directive 2026-05-19 a captured bookmark is an ordinary editable block object — page content → **Lexical blocks in the Bookmark's own universal body** (OQ-DM-1; no separate `WebPage/v1`), OG/metadata → **entity properties** (existing `Bookmark/v1` typed fields become property-backed), filled by a shared shell extraction core via the static `network.readable` feeder (9.18.5); the metadata half is `network.preview` (9.18.6). The raw-HTML-cache sub-question folds into OQ-RX-4 / OQ-WV-3.**
- **Blocking?:** Blocks 9.18.6 (automated metadata scrape). Non-blocking for 9.18.1–9.18.4 v1 surfaces.

---

## Readable content extraction — `OQ-RX-1` … `OQ-RX-7`

(Added 2026-05-19 with [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md) — clean page-content capture for Bookmarks.)

#### OQ-RX-1 — Standalone static reader service vs. wait for the browser  *[RESOLVED 2026-05-29 — Net-2 gate]*
- **Where:** [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md), [apps/54-web-browser.md](../apps/54-web-browser.md), implementation plan §Network broker & readable extraction.
- **Question:** Ship the static `services.network.readable` feeder standalone (Net-2, unblocks Bookmarks now), or fold readable capture entirely into `web.capture` and make Bookmarks wait for the whole Web Browser app (Browser-1)?
- **Options:**
  - (a) Standalone static service; the Web Browser app later adds a second feeder onto the same shared extraction core.
  - (b) Single path through `web.capture`; Bookmarks gains content only when Browser-1 lands.
- **Resolution:** **(a) — standalone static `network.readable` feeder (Net-2).** It reuses 100% of the `network.preview` machinery, unblocks the actual user need years before Browser-1, and is zero-rework when the live-DOM feeder is added (one core, two feeders). Doc 58 is built entirely on this decision (it *is* "the static feeder doc"); the live-DOM (Net-3) + clipper (Clip-1) feeders are additive later channels onto the identical core + `Bookmark/v1`. Clears the Net-2 / 9.18.5 gate.
- **Blocking?:** ~~Yes~~ resolved.

#### OQ-RX-2 — Extraction profile: stock Readability vs. site-class profiles  *[RESOLVED 2026-05-29 — v1 position]*
- **Where:** [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md).
- **Question:** Stock Mozilla Readability defaults for every site, or a small set of site-class profiles (MediaWiki, docs-site) layered on for pages Readability scores poorly?
- **Resolution:** **Stock `@mozilla/readability` v1.** Site-class profiles are a later quality iteration, added only behind measured extraction-quality misses, each a pure data hint into the same core.
- **Blocking?:** No.

#### OQ-RX-3 — Extraction locus: broker main process vs. utility worker  *[RESOLVED 2026-05-29 — v1 position]*
- **Where:** [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md).
- **Question:** Run the parse + Readability + sanitize pass on the network-broker main process, or in a utility worker?
- **Resolution:** **Utility worker** (the `main/workers.ts` storage/ydoc pattern) — a 3 MB parse must not stall the broker event loop; main only orchestrates fetch + cache + cap. (The *pure* `extractReadable` core stays runtime-agnostic + testable in-process; the worker is only its execution locus.)
- **Blocking?:** No.

#### OQ-RX-4 — Captured-body storage ceiling and truncation UX  *[RESOLVED 2026-05-29 — v1 position]*
- **Where:** [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md), [apps/54-web-browser.md](../apps/54-web-browser.md) (OQ-WV-3).
- **Question:** Hard ~1 MB `textContent` cap on the Bookmark's body with a visible truncation marker + "open original", or spill very long pages to a separate raw-HTML file entity?
- **Resolution:** **~1 MB `textContent` cap + visible truncation marker** ("captured content truncated — open original for the full page") v1. Raw-HTML spill is post-v1, opt-in, shared with OQ-WV-3.
- **Blocking?:** No.

#### OQ-RX-5 — Does the Web Browser clip also collapse onto Bookmark+body?  *[RESOLVED — user directive 2026-05-19]*
- **Where:** [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md), [apps/54-web-browser.md](../apps/54-web-browser.md).
- **Question:** Should the Web Browser app's clip drop `WebPage/v1` and create a content-bearing Bookmark — one captured-page model — or keep `WebPage/v1` distinct?
- **Resolution:** **(a) — one model.** There is one captured-page object, `brainstorm/Bookmark/v1`, everywhere (Bookmarks app, Database/Graph/collections, Notes block, in-app browser clip, and the later web clipper). `WebPage/v1` is **retired**; the browser's richer extras (screenshot, raw-DOM snapshot) become optional properties / file-attachments on the same Bookmark. `BrowsingSession/v1` is unaffected. Doc-54 supersede is recorded; the doc-54 edit lands at Browser-1.
- **Blocking?:** No — resolved; the doc-54 reconciliation tracks at Browser-1.

#### OQ-RX-6 — HTML→Lexical conversion fidelity & reuse  *[RESOLVED 2026-05-29 — v1 position]*
- **Where:** [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md), [apps/notes/20-blocks/](../apps/notes/20-blocks/).
- **Question:** The captured page is converted to the Block-Protocol/Lexical block tree every object's body uses. Confirm it reuses **Notes' HTML-import path** (not a parallel converter), the sanitizer allowlist is exactly that importer's 1:1-mappable tag set, and edge cases (figure+figcaption, nested tables, `pre`/`code` language inference, footnotes/`sup`) degrade predictably.
- **Resolution:** **Reuse the Notes HTML-import path** (no parallel converter); freeze the allowlist↔block-set equivalence in a shared constant; golden-test the edge cases. **Sequencing note:** the pure `extractReadable` core emits the neutral `ReadableArticle` (`meta` + `blocks: BlockNode[]` + `textContent`) and is buildable independently; the `BlockNode[] → Yjs body` write step (which is where the Notes importer is reused) lands with the Bookmarks integration (9.18.5), so the core does not couple to the editor package.
- **Blocking?:** No.

#### OQ-RX-7 — Web-clipper transport, trust & browser matrix *[RETIRED — clipper dropped 2026-07-21]*
- **Status:** The external-browser web clipper is **dropped** (user directive 2026-07-21) — **superseded by in-app clipping in the Web Browser** (`Net-3` live-DOM capture → same Net-2 core → same `Bookmark/v1`), so a separate browser extension is not needed. This OQ is **retired** and gates no work. The design + leaning below are preserved only for the historical record; revisit only if an external-browser clipper is ever re-scoped.
- **Where:** [apps/58-readable-content-extraction.md](../apps/58-readable-content-extraction.md) (§Web clipper), [apps/54-web-browser.md](../apps/54-web-browser.md), [platform/57-open-resolution.md](../platform/57-open-resolution.md).
- **Question:** The external-browser web clipper (highly used; reinstated 2026-05-19, scoped post-v1 as Clip-1) is a third *feeder* onto the same extraction core + `Bookmark/v1` — not a new type. How does it reach the shell, and which browsers ship?
- **Options:**
  - (a) Loopback HTTP receiver bound to a user-paired bearer token.
  - (b) Native-messaging host.
  - (c) `brainstorm://clip?…` deep-link through the open-resolution OS-handoff ([57](../platform/57-open-resolution.md)).
- **Tentative leaning:** (b)/(c) over (a) — avoid an always-listening socket; extension submits URL + optional selection/rendered-DOM; the shell **always re-sanitizes + extracts** via the same core (extension treated as untrusted hostile-origin HTML); pairing explicit + revocable in Settings → Privacy → Network; Chromium + Firefox first, Safari follows. The extension artifact is built and store-reviewed separately from the app bundle.
- **Blocking?:** Blocks Clip-1 only. Non-blocking for Net-1/2/3, 9.18.5/.6, Browser-1.

---

## Find & replace in text — `OQ-FR-1` … `OQ-FR-4`

(Added 2026-05-19 with [editing/59-find-and-replace.md](../editing/59-find-and-replace.md) — the shared in-document find/replace primitive; the OQ-185 virtualization payback.)

#### OQ-FR-1 — Regex (and capture-group replace) in v1 or v2?
- **Where:** [editing/59-find-and-replace.md](../editing/59-find-and-replace.md).
- **Question:** Does the v1 find bar support regular-expression search + `$1` capture-group replace, or substring-only?
- **Tentative leaning:** v2. v1 = substring + case-sensitive + whole-word + in-selection (enough to pay back OQ-185); regex over a CRDT rope plus templated replace is the expensive, edge-case-heavy part and not needed for the virtualization trade.
- **Blocking?:** No — v1 ships substring; regex is an additive later toggle.

#### OQ-FR-2 — Code-editor: wrap CodeMirror search vs. keep its native panel  *[RESOLVED — user directive 2026-05-19]*
- **Where:** [editing/59-find-and-replace.md](../editing/59-find-and-replace.md), `apps/code-editor`.
- **Question:** Should Code-editor wrap `@codemirror/search` behind the shared `TextSearchProvider` (one identical find bar product-wide), or keep CodeMirror's native search panel?
- **Resolution:** **Consistent interface everywhere.** Code-editor wraps `@codemirror/search` strictly as the matching/replace *engine* behind the shared `<FindBar>` + controller; CodeMirror's native search panel is **not** surfaced. No app exposes a native or bespoke find UI — the `TextSearchProvider` seam lets the engine differ while the interface never does. Recorded as the §Architecture *consistent interface* Decision in doc 59.
- **Blocking?:** No — resolved; B9.3 builds to this.

#### OQ-FR-3 — Find across non-document text surfaces (grid cells, canvas text)?
- **Where:** [editing/59-find-and-replace.md](../editing/59-find-and-replace.md).
- **Question:** Do Database/Tasks inline cells and Whiteboard sticky text get "find across the view", or is find document-only in v1?
- **Tentative leaning:** Out of v1 — that is view-model search (closer to global search scoped to a view); the `TextSearchProvider` seam can host it later with no API change. Flagged so it isn't designed twice.
- **Blocking?:** No.

#### OQ-FR-4 — Seed the query from the current selection?  *[RESOLVED in implementation-plan B11.15, 2026-05-31]*
- **Where:** [editing/59-find-and-replace.md](../editing/59-find-and-replace.md).
- **Question:** Does `editor/find` prefill the term from the active selection unconditionally (editor-classic) or only for short single-block selections?
- **Tentative leaning:** Seed when the selection is non-empty and within one block; otherwise open empty.
- **Resolution:** Per the leaning — **seed only a non-empty, single-block, bounded (`FIND_SEED_MAX_LEN`=200) selection**, otherwise open with the previous/persisted term. Implemented as an optional `TextSearchProvider.seedTerm()` the controller reads on the open transition (dom provider = single-line in-root `getSelection()`; Notes provider = single-text-node ranged selection). A larger / multi-line / cross-block selection reads as "search within a region", not a term, so it doesn't seed.
- **Blocking?:** No — polish.

---

## Spellchecking in text — `OQ-SP-1` … `OQ-SP-3`

(Added 2026-06-13 with the editor-capability gap check — the inline-spellcheck + custom-dictionary editor primitive, implementation-plan B11.16/B11.17; the cross-app counterpart to the B9 find/replace seam. Design doc to write: [editing/60-spellcheck.md](../editing/60-spellcheck.md).)

#### OQ-SP-1 — Spellcheck engine: Electron-native session vs. in-renderer JS?  *[RESOLVED in implementation-plan B11.16a — Electron-native]*
- **Where:** implementation plan B11.16a; `packages/shell/src/main/web/spellcheck.ts` (per-app session, enabled from `runtime/launch-setup.ts`).
- **Question:** Does spellchecking run as Chromium's built-in spellchecker on each sandboxed app's `WebContentsView` session (squiggles + OS/hunspell dictionaries for free, ~zero bundle, but the misspelled word + suggestions surface in the **main** process so the suggestion menu must cross the sandbox boundary), or as an in-renderer JS checker (nspell / hunspell-asm bundled per app — sandbox-pure, but heavyweight and must paint its own squiggles)?
- **Resolution:** Electron-native, enabled by the shell per app session at window-create via `enableSessionSpellcheck` (apps declare nothing, mirroring the shell-injected `bs-find-bar` / `.header-nav` chrome). Languages = OS preference order ∩ available dictionaries, `en-US` fallback; macOS auto-detects (no list set). The in-renderer path was rejected — it re-implements a per-app dictionary download + a squiggle renderer the platform already provides. Design + the engine/menu/dictionary architecture: [editing/60-spellcheck.md](../editing/60-spellcheck.md).
- **Blocking?:** Was yes for B11.16 — decides the engine lives in the main-process session and B11.16c needs the `editor.spellcheck.*` IPC bridge (OQ-SP-3).

#### OQ-SP-2 — Custom-dictionary custody: vault-scoped (syncs) vs. per-OS-user (native list)?  *[RESOLVED in implementation-plan B11.17a — vault-scoped store]*
- **Where:** implementation plan B11.17a; `main/vault/vault-spellcheck-dictionary-store.ts`.
- **Question:** Where do user-added words live — a vault-resident store that syncs across devices/users with the vault, or the per-OS-user Electron/OS-native custom word list (`session.addWordToSpellCheckerDictionary`, no sync)? Note this is the **linguistic** spell dictionary, deliberately separate from the `dictionaryStore` select-property vocabularies (B5.1–B5.9).
- **Resolution:** Vault-scoped store is the source of truth — `<vault>/shell/spellcheck-dictionary.json` (the `shell/` config convention; travels with a vault copy/export), hydrated into the shared renderer session via `addWordToSpellCheckerDictionary` on session config. The native OS list alone strands words per-machine. Note: true cross-device CRDT sync (the Stage-10 engine syncs entities/Y.Docs, not shell config) + vault-switch re-hydration are documented follow-ups; vault-resident is the v1 contract. Design: [editing/60-spellcheck.md](../editing/60-spellcheck.md).
- **Blocking?:** Was yes for B11.17 — set the storage model (vault-path JSON, not an entity) + the `editor.spellcheck.*` capability surface.

#### OQ-SP-3 — Suggestion menu + add-to-dictionary across the sandbox boundary  *[RESOLVED in implementation-plan B11.16c — push channels, not a broker capability]*
- **Where:** implementation plan B11.16c; `main/web/spellcheck.ts` + `main/ipc/spellcheck-handlers.ts` + `@brainstorm/sdk/spellcheck-menu`.
- **Question:** With the Electron-native engine (OQ-SP-1), the misspelled word + `dictionarySuggestions` arrive on the **main-process** `context-menu` event, but the menu must render in the **sandboxed app** through the fancy-menus runtime (the consistent-interface rule, OQ-FR-2). What capability/IPC carries `{misspelledWord, suggestions}` out and the chosen replacement / add-word back?
- **Resolution:** **Two non-broker channels**, no capability — the suggestion data is the app's *own editable content returning to itself*, so no new authority crosses the boundary. (1) Read: the shell pushes `{word, suggestions, x, y}` to the firing renderer over `app:spellcheck-context` (the `app:files-watch` push pattern), surfaced as `runtime.spellcheck.onContext`. (2) Apply: the chosen replacement returns on `app:spellcheck-apply` and the shell calls `event.sender.replaceMisspelling` — scoped to the *calling* renderer's own selection (a renderer can only rewrite its own selected word). Suggestions render via `@brainstorm/sdk/spellcheck-menu` (`buildSpellMenuItems` + `mountSpellcheckMenu`); Chromium has no native menu to suppress. The privileged op — adding a word to the shared/vault dictionary — is the only part gated by a capability, landing with B11.17a (`editor.spellcheck.*`). Design: [editing/60-spellcheck.md](../editing/60-spellcheck.md).
- **Blocking?:** Was yes for B11.16c. The remaining `editor.spellcheck.*` capability surface (dictionary add/remove) lands + gets its security review with B11.17a.

---

## Bin (Trash, shell-internal) — `OQ-BIN-1` … `OQ-BIN-2`

(Added 2026-05-14 with the 9.19 Bin planning.)

#### OQ-BIN-1 — Read-only bin capability for apps
- **Where:** Implementation plan §Stage 9.19.
- **Question:** The bin verbs are shell-only by design (restore writes back into the owning app's data space, which a sandboxed app cannot do). But should there be a read-only `entities.bin.read:own` per-app capability so an app can show its own recently-deleted items (e.g. Notes' "Recently deleted" filter)?
- **Tentative leaning:** Yes — read-only `entities.bin.read:own` scoped to the requesting app's own entities. Write paths (restore / purge) stay shell-only.
- **Blocking?:** No — non-blocking for 9.19.1; revisit when an app first asks for the surface.

#### OQ-BIN-2 — Purge semantics for entities with linked files
- **Where:** Implementation plan §Stage 9.19.3.
- **Question:** When a Note that referenced `brainstorm://app-file/<id>` is purged from the bin, what happens to the file blob? (a) bin them together (cascade); (b) orphan the file, GC later; (c) defer to a separate file-bin surface.
- **Tentative leaning:** (a) cascade — purging a note's bin entry also drops any files referenced *only* by that note. Files referenced by other live entities stay. A background "orphan-file sweep" runs once at startup as belt-and-braces (b)-style insurance.
- **Blocking?:** Yes — blocks 9.19.3 (retention sweep) since the sweep must know what to do.

---

## Dashboard object-pinning — `OQ-DASH-1`

(Added 2026-05-16 with the 7.13 "pin any object to the dashboard" planning.)

#### OQ-DASH-1 — Open-dedup + dangling-pin semantics for pinned objects *[RESOLVED in implementation-plan Stage 7.13]*
- **Where:** Implementation plan §Stage 7.13.
- **Question:** Two coupled behaviours: (1) Activating a pinned-object icon when a window already shows that object — focus the existing window or always dispatch a fresh `intent.open`? (2) Unpinning an object that is still referenced elsewhere (e.g. a seeded built-in List like Contacts, or the Bin surface) — does the tile vanish entirely, or revert to that object's default surfacing? And the inverse: an object that is deleted/binned while pinned — tombstone tile vs. silent auto-removal.
- **Tentative leaning:** (1) Focus-existing by default (matches app-icon behaviour via the window index from 7.12); a modifier (Mod-click) forces a new window. (2) Unpin is pure dashboard-state — it removes the icon only; built-in Lists keep their default surfacing (they were never *only* reachable via the pin). Deleted/binned target → greyed tombstone tile with an explicit "remove pin" (never silent removal, so a restore from Bin re-lights the pin).
- **Blocking?:** No — 7.13(a)/(b)/(c) can land with the leaning above; revisit only if the focus-existing default tests poorly.
- **Resolution (2026-05-18, adopts the tentative leaning):**
  1. **Activation = focus-existing by default.** A pinned-object icon dispatches the same `intent.open` the launcher row uses (`{ verb: "open", payload: { entityId } }`); the `IntentsBus` already focuses an existing window for that opener app (the 7.12 window index) rather than spawning a duplicate. No new dedup path — the pin is a thin caller of the one open path, never a parallel one (consistent with [[open-resolution]]). A `Mod`-click forcing a brand-new window is deferred to the Stage 8 navigation-modes work (`<Link>` modes) — the pin inherits it for free then; v1 ships focus-existing only and does not hand-roll a second mode.
  2. **Unpin is pure dashboard state.** `services.dashboard.unpin` (and the tile's "Remove from dashboard") deletes the `IconRecord` only. It never deletes, hides, or re-surfaces the underlying object; a seeded built-in List keeps its default surfacing because it was never *only* reachable via the pin. Deleting the object is a separate, explicitly-confirmed action (the object-menu "Remove" item → `entities.delete`), never a side effect of unpinning.
  3. **Deleted/binned target → tombstone, never silent removal.** The shell-side pin resolver flags a pin whose target no longer resolves as `missing: true`; the tile renders greyed with the stored label and an explicit "Remove pin" affordance. The icon is **not** auto-removed, so a restore-from-Bin re-lights the original pin in place (position preserved). Resolution is live (recomputed every snapshot read + on every `vault-entities` change), so rename / re-icon / delete / restore are all reflected without the user touching the pin.
- **Landed:** 7.13 — `main/dashboard/pin-resolver.ts` (live resolution + tombstone), `main/dashboard/dashboard-service.ts` (`pin`/`unpin`/`isPinned`, capability `dashboard.pin`), composite object-icon + opener-app-badge tile in `renderer/dashboard/icons-layer.tsx`, and the shared `@brainstorm/sdk/object-menu` convention (Open / Pin·Unpin / Remove).

---

## Universal object covers — `OQ-COV-1`

(Added 2026-05-17 with the B7 "universal object covers" planning — [foundations/50-object-covers.md](../foundations/50-object-covers.md).)

#### OQ-COV-1 — Cover storage model, per-view override precedence, and theme-awareness *[RESOLVED in implementation-plan Stage 9 — B7 ladder]*
- **Where:** Implementation plan §Stage 9 B7 ladder; [foundations/50-object-covers.md](../foundations/50-object-covers.md).
- **Question:** Three coupled sub-decisions. (1) **Storage** — is `cover` a reserved universal property (`properties.cover`, sibling to `properties.icon` and the universal `body` per [OQ-DM-1](#oq-dm-1)), a layout chrome cell only ([shell/27-layouts.md](../shell/27-layouts.md)), or both (data here, placement in layout)? (2) **Per-view override precedence** — the Database gallery's existing `coverProperty` view knob vs. the object's universal `properties.cover`: confirm `view.coverProperty → properties.cover → id-seeded gradient`, and what a view-level "no cover" choice means (suppress vs. fall through). (3) **Theme-awareness** — does `CoverKind.Color` (and the gradient set) store a theme **token reference** so covers follow the active theme, or a frozen literal? Tokenised follows theme but a user-picked brand colour may want to be absolute.
- **Tentative leaning:** (1) Both — `properties.cover` is the data (reserved universal property, parallel to icon/body, zero BP/schema change since it's just another property key); the `cover` chrome cell is its layout-driven placement. (2) `view.coverProperty → properties.cover → seeded gradient`; an explicit view "none" suppresses the band entirely for that view only. (3) Token reference by default (theme-aware, consistent with the no-hardcoded-colour conventions), with an escape hatch for an absolute literal when the user explicitly picks a raw colour — same split the wallpaper/colour pickers already navigate.
- **Blocking?:** No for B7.1 (the `Cover` shape + renderer + seeded-gradient fallback are correct under every leaning — `properties.cover` read is forward-compatible). Resolve before B7.2 (picker writes the persisted shape) and B7.3 (per-view override precedence is observable cross-app).
- **Resolution (2026-05-17, adopts the tentative leaning):**
  1. **Storage — both.** `properties.cover` is the canonical data: a reserved universal property, sibling to `properties.icon` and the universal `body` (zero BP / schema / Yjs change — just another property key, per [OQ-DM-1](#oq-dm-1)). The `cover` chrome cell ([shell/27-layouts.md](../shell/27-layouts.md)) is its *layout-driven placement* under the same layered-overlay precedence as PropertySchema (`entity > collection > type > user > org > app-default`). Data lives here; *where it sits* is layout's call.
  2. **Per-view precedence — `view.coverProperty → properties.cover → id-seeded gradient`.** A view may point its cards at a specific cover property; absent that, the object's universal `properties.cover`; absent that, the deterministic id-seeded gradient (never a broken-image square). An explicit view-level **"none"** (the view sets `coverProperty` to the no-cover sentinel) **suppresses the band entirely for that view only** — it does *not* fall through to the seeded gradient ("none" means the user said no cover *here*); other surfaces still show the object's own cover.
  3. **Theme-awareness — token reference by default, literal escape hatch.** `CoverKind.Color.value` is a CSS custom-property reference by default — stored as `var(--token)` (the `--token` shorthand is accepted and normalised to `var(--token)`), so the cover follows the active theme. An absolute literal (hex / `rgb()` / `hsl()` / `oklch()` / a named keyword) is the explicit escape hatch for a user-picked raw colour (`themed: false`). A `Color` value is validated to be a **single** token reference *or* a **single** literal colour shape — never multiple tokens, a `var(--x, …)` fallback, or arbitrary CSS — because it is interpolated into an inline `style`; anything else degrades to the id-seeded gradient (closes the inline-style injection vector). The curated **gradient set** (`CoverKind.Gradient`) stays a theme-neutral curated *key* (the COCO pastels are deliberately constant, like `app-icon-palette.ts` — content, not chrome; consistent with [[feedback-vocabulary-colors-arent-tokens]]); it is intentionally *not* tokenised.
- **Landed:** B7.1 shipped the forward-compatible shape + renderer + seeded fallback. The pure decision-(3) keystone — `normalizeCoverColor` in `@brainstorm/sdk/entity-cover` + `resolveCoverBackground`'s `Color` branch routed through it (token-vs-literal + injection guard) — landed 2026-05-17 alongside this resolution. B7.2 (picker writes the persisted shape) and B7.3 (per-view precedence) are now unblocked.

---

## Preview app — `OQ-PV-1` … `OQ-PV-4`

(Added 2026-05-14 with the 9.20 Preview app planning.)

#### OQ-PV-1 — Renderer architecture — single sandboxed app vs. plugin-per-format BP blocks *[RESOLVED in implementation-plan Stage 9.20.1]*
- **Where:** Implementation plan §Stage 9.20.
- **Question:** Does Preview ship as **one sandboxed app** with lazy-loaded per-format renderer modules (image / video / audio / PDF / md / code / text), or as **a thin host** that delegates each format to a Block Protocol block (so third parties can register, e.g., 3D-model or RAW-image viewers via the marketplace)?
- **Resolution (2026-05-14):** Thin sandboxed *shell* (file-handle plumbing, multi-file navigation, fullscreen, slideshow, metadata inspector) whose render-pane embeds a per-MIME renderer behind the `PreviewModule` contract. The contract is renderer-agnostic — v1 wires plain ES modules; 9.4/9.5 brings the BP block-frame infra online, at which point per-kind modules become BP `preview-<kind>` blocks (image / video / audio / markdown / text / code / PDF first-party; 3D / RAW / Office third-party via the marketplace). 9.20.1 ships the manifest + the contract + the lazy-loader registry (empty) so the renderer iterations (9.20.2 → 9.20.5) plug in without re-shaping the shell.
- **Blocking?:** Yes — blocks 9.20.1 (manifest + type-level surface). **Resolved.**

#### OQ-PV-2 — PDF.js bundle budget (~3 MB)
- **Where:** Implementation plan §Stage 9.20.6.
- **Question:** PDF.js is the canonical browser PDF renderer and weighs ~3 MB minified. Inside a sandboxed Preview app (or a `preview-pdf` BP block), that's a hard bundle hit. Options: (a) ship PDF in v1 and bump Preview's size budget; (b) defer PDF to post-v1 and surface only image / video / audio / text / md / code at launch; (c) ship a stripped PDF.js with text-only / first-page-only and offer "Open in system viewer" for full inspection.
- **Tentative leaning:** (a) ship in v1, lazy-load PDF.js only when a PDF is opened (zero impact on launch). Per-renderer size budgets enforced in `size-limit` config.
- **Blocking?:** No — blocks 9.20.6 (PDF iteration) only.

#### OQ-PV-3 — Multi-file navigation context *[RESOLVED in implementation-plan Stage 9.20.6]*
- **Where:** Implementation plan §Stage 9.20.6.
- **Question:** When the user presses Space on a file in Files (Finder convention), Preview opens. Arrow-key navigation should walk siblings. Does **Files pass a sorted file-handle list** as part of the `intent.open` payload, or does **Preview re-query the parent folder** via `files.list`?
- **Resolution (2026-05-18):** **Files passes the list.** The `intent.open` / `intent.quick-look` payload carries an optional `siblings: PreviewSibling[]` field built from Files' **current visible rows** (sort + filter + search already applied), so Preview reproduces exactly what the user saw without mirroring Files' view state or re-querying. Preview falls back to single-file mode when `siblings` is absent or ≤1. The ordering contract lives in the pure `apps/files/src/logic/preview-siblings.ts` keystone; Preview never re-sorts (it only locates the opened `entityId` by id). Re-query was rejected: it would force Preview to duplicate Files' sort/filter/search state and re-implement `files.list`, and breaks the moment the two drift.
- **Blocking?:** No — blocked 9.20.6 (multi-file navigation) only.

#### OQ-PV-4 — Annotations / edits in Preview
- **Where:** Implementation plan §Stage 9.20.
- **Question:** Is Preview strictly **read-only** in v1, or does it support light annotation (PDF highlights, image markup, audio clips)? Annotations cross the Files-service handle boundary and need a write capability.
- **Tentative leaning:** Strictly read-only in v1 — keeps the capability surface tight (`files.read` only). Annotation flows go through opening the file in its primary editor (PDFs → future PDF editor; images → future image editor). A read-only Preview also clarifies the contract vs. Books (9.21), which IS the annotation-rich reader for long-form content.
- **Blocking?:** No — sets the v1 scope, not a hard gate.

---

## Books app — `OQ-BK-1` … `OQ-BK-4`

(Added 2026-05-14 with the 9.21 Books app planning.)

#### OQ-BK-1 — EPUB renderer choice  *[RESOLVED in implementation-plan 9.21.2 — hybrid (c)]*
- **Where:** Implementation plan §Stage 9.21.2 (EPUB reader).
- **Question:** EPUB rendering options: (a) **epub.js** (the de-facto JS library — ~200 KB, mature, CFI support, but ships its own iframe rendering model that conflicts with our sandbox); (b) **custom paginator** over the raw EPUB XHTML (more work, full control, fits the sandbox cleanly); (c) **hybrid** — use epub.js's parsing + spine traversal, write our own pagination + theming layer.
- **Resolution:** **(c) hybrid.** Use epub.js **only as the parser** — open the EPUB blob, resolve the spine + per-section XHTML + the manifest/metadata — and feed the extracted, sanitised section HTML into the app's **existing reflow paginator** (the 9.21.1.5 pagination/locator model, with 9.21.3 typography + 9.21.4 highlights reused unchanged). epub.js's iframe `Rendition` is **not** used (it conflicts with the per-app sandbox CSP). The parse step is unit-testable against an EPUB fixture; the live render is real-Electron residue. Implementation: 9.21.2.
- **Blocking?:** Was yes — gated 9.21.2's pagination/parse seam; now resolved.

#### OQ-BK-2 — PDF books: share renderer with Preview vs. dedicated Books-PDF
- **Where:** Implementation plan §Stage 9.21.
- **Question:** PDF-as-book wants reading-mode polish (page chrome, two-page spread, typography overrides for resolution + zoom, persisted reading-position). Preview's PDF (OQ-PV-2) is a quick-look — different UX. Share the same PDF.js underneath via a shared `preview-pdf` block with config flags, or roll a Books-specific PDF reader?
- **Tentative leaning:** Share the renderer (PDF.js bundle), separate UX shell. Books composes the `preview-pdf` block in a different chrome (its own toolbar, persisted reading-state, two-page spread). Single PDF.js bundle, zero duplication.
- **Blocking?:** No — blocks the PDF-book sub-iteration only.

#### OQ-BK-3 — Highlights as entities vs. as a book property
- **Where:** Implementation plan §Stage 9.21.4.
- **Question:** When the user highlights "the book's last sentence" — does that become a **standalone `brainstorm/Highlight/v1` entity** (typed-linked back to the Book + CFI / page-range, queryable across the vault, surfaceable in Graph + Notes) or a **property on the Book entity** (simpler, less power)?
- **Tentative leaning:** Standalone entity. Matches the Graph / Tasks instinct (typed links over inline blobs). Lets a user run "show me every highlight from books linked to City=Berlin" or `@`-mention a specific highlight from a Note. The Book entity carries a count + recent-highlights summary for fast UX.
- **Blocking?:** Yes — blocks 9.21.4 (highlight iteration).

#### OQ-BK-4 — Book file storage — in-vault vs. external references
- **Where:** Implementation plan §Stage 9.21.2.
- **Question:** A typical 500-book library is ~10 GB. Options: (a) copy each book into the vault (`brainstorm://app-file/<id>`, content-addressed) — heavy but self-contained + portable; (b) reference external paths via Files-service handles — lightweight but the library breaks if the user moves the source folder; (c) hybrid — small books (<10 MB EPUB) inline, large books (PDF / audiobook) reference.
- **Tentative leaning:** (a) in-vault. Vaults are designed to be portable; an external-ref library that breaks on move / sync would be a footgun. Trade-off accepted: a 10 GB library on a small SSD needs a per-vault override to switch to reference-mode, but that's a v2 preference, not a v1 gate.
- **Blocking?:** Yes — blocks 9.21.2 (real Files-service backed library).

## Contacts app — `OQ-CT-1` … `OQ-CT-3`

(Added 2026-05-17 reserving the 9.23 Contacts-app slot. With Tasks + Bookmarks already first-party apps, a Contacts app is a natural addition; **how it works is not yet decided** — these questions are open and resolved in the design pass before code lands. Context: 9.12.13 already seeds a `Person/v1` type + property catalog + `All People` type-List, 9.12.16 a vCard/CSV import pipeline, 9.12.15 the Quick Look fact-sheet — the app's relationship to that existing work is OQ-CT-1, not pre-decided.)

#### OQ-CT-1 — Relationship to the existing `Person/v1` type-List  *[RESOLVED — position taken 2026-05-22; unblocks Stage 9.23]*
- **Where:** Implementation plan §Stage 9.23.
- **Question:** 9.12.13 already models people as `Person/v1` entities surfaced via an `All People` Database type-List + a dashboard `PinnedList` tile. Does the Contacts app reuse that entity space (becoming the `Person/v1` primary opener, the List staying as the Database-side view, both reading/writing one space through the entities service) or define its own model? How does the dashboard "Contacts" tile resolve, and how does unpinning a still-referenced seeded List behave (coupled to [[OQ-DASH-1]])?
- **Resolution (2026-05-22):** **Standalone Contacts app, sharing the existing `Person/v1` entity space.** Mirrors the Tasks pattern — Tasks is a standalone app whose UI is the convenient daily-use surface for a vault-wide entity type (`Task/v1`), while Database can still show those same entities in any view kind (gallery / board / calendar / timeline) by predicate. Contacts gets the same shape: a dedicated app for the common case, `Person/v1` shared with the entities service, the Database `All People` type-List staying as the power-user surface for ad-hoc views (gallery / kanban by tag / company groupings / etc.). **No data fork** — both Contacts and Database read/write the same `Person/v1` rows through the entities service; the 9.12.16 vCard/CSV import pipeline and Quick Look carry over to the Contacts UI without re-implementation. **Schema ownership stays with the canonical type registry**, not the app — Contacts ships the manifest's `entityTypes: [Person/v1]` (with read+write caps it owns), but the *shape* is the registry's, shared with the existing Database `Person/v1` rows and the Person seed. **Dashboard tile**: when the Contacts app is installed, an entity-type "Contacts" tile (whether app-icon-pinned or `PinnedList: All People` preset) routes Person opens through the Contacts app's `intent.open(Person)` handler — same per-type routing as any other type-owned app. Unpinning a still-referenced seeded List has no coupling to the Contacts app: the app + the List are independent surfaces over the same data (exactly like a Task is reachable from Tasks AND a Database `By Priority` board). **If a user doesn't want the Contacts app**, deleting it leaves the Database `All People` view as the surface — data + views persist; only the convenience UI is removed. The 9.23 ladder (9.23.1–9.23.5) is buildable as written: scaffold over the existing `Person/v1`, reuse `@brainstorm/sdk/property-ui`, surface curated People-List, relationship links, vCard import via 9.12.16 keystones. **OQ-CT-2** (the `Org/v1` + `Person→Org` typed-link timing) remains open as scoped — answerable independently inside the 9.23 design pass.
- **Blocking?:** Resolved — no longer blocks the 9.23 real-entities iteration.

#### OQ-CT-2 — `Org/v1` + Person→Org typed-link timing  *[RESOLVED — position taken 2026-06-07; resolved in implementation-plan Stage 9.23.1]*
- **Where:** Implementation plan §Stage 9.23. Aligns with [[OQ-LD-14]] (same question scoped to the Database Contacts surface).
- **Question:** Company affinity (group-by-company, "people at Acme", org cards) wants a `Person → Org` typed link. Does Contacts ship with free-text `Company` only and defer org grouping, or does a minimum `brainstorm/Org/v1` schema land so the link exists from the start? Resolving this resolves OQ-LD-14.
- **Resolution (2026-06-07):** **The typed link already exists — Contacts consumes it from the start.** The question is moot in the "free-text vs. new schema" framing because the graph-link-reasons work (entities.db migration **v5** + `packages/shell/src/main/entities/company-migration.ts`) already landed a real **`brainstorm/Company/v1`** entity type, and the seeded Person catalog (`dev/contact-properties.ts`) already defines `company` as a typed `EntityRef` with `allowedTypes: [COMPANY_TYPE]` — not free text. So Contacts ships group-by-company / company cards over the existing typed `Person.company → Company/v1` ref on day one; **no separate `Org/v1` schema is introduced** (the canonical name is `Company`, fixed by the graph work — `Org` is not a second type). Multi-affiliation (a person at several companies, role-per-company edges) stays a v2 extension behind the same ref, not a v1 gate. This resolves **OQ-LD-14** identically: the Database Contacts surface reads the same typed ref. Contacts declares read+write caps on `Person/v1` and read on `Company/v1`; it does **not** redeclare either type (both are canonical, owned by the registry/seed).
- **Blocking?:** ~~Blocks the group/company surfaces only, not the base app.~~ Unblocked — the typed link is present, so the company surfaces are buildable in the base 9.23 ladder.

#### OQ-CT-3 — Birthday recurrence model *[RESOLVED in implementation-plan Stage 9.15.5 — jointly with OQ-CAL-2]*
- **Where:** Implementation plan §Stage 9.23 and §Stage 9.12.13(b) (the seeded `Birthdays` view already cites "OQ-CT-3" as its gate).
- **Question:** `Person.birthday` is a single date but birthdays recur yearly. Single stored Event per person vs. a yearly-virtual projection computed from `Person.birthday` (no per-year entities)? Whatever is chosen must be shared by the Contacts birthday surface, the Database calendar view's seeded `Birthdays` view (9.12.13(b)), and the Calendar app so all three use one model.
- **Resolution (2026-05-18):** Adopts **OQ-CAL-2's resolution** — yearly-virtual projection over the shared `Recurrence` union, materialized by the single `occurrencesInRange` engine; the three surfaces share `yearlyRecurrenceForDate` / `birthdayOccurrencesInRange` (no per-year entities). (The earlier "defers to OQ-185" note was a stray cross-reference — OQ-185 is editor virtualization, unrelated; the model-singularity requirement is satisfied by sharing OQ-CAL-2's engine.)
- **Blocking?:** Was — the shared engine landed at 9.15.5; the 9.12.13(b) / Contacts wiring is the tracked follow-up.

#### OQ-188 — Large-file transfer mechanism across the IPC boundary  *[RESOLVED — position taken 2026-05-21; unblocks 9.10a]*
- **Where:** Implementation plan §Stage 9.10a.
- **Question:** A single IPC envelope can't carry a multi-GB video, and `storage.uploadFile`'s flat 25 MiB cap makes video / large attachments impossible (Notes' video block has no inline fallback). How do bytes cross app → broker → storage worker at scale: (a) **chunked envelopes** — `uploadBegin` / `uploadChunk` / `uploadCommit`, each chunk inside the existing per-envelope cap, worker streams to a `.tmp` file with incremental hashing; (b) **shared-memory / transferable `ArrayBuffer`** handoff; (c) **renderer-writes-temp-file** then hands the worker a path (worker copies into the content-addressed store).
- **Resolution (v1):** **(a) chunked envelopes.** Stays inside the audited envelope/capability path (no new transport to threat-model), preserves content-addressed dedupe + atomic-rename, gives natural progress + backpressure + cancel/GC, works identically under Bun tests and Electron. (b) is fastest but bypasses the broker's per-app accounting and is awkward across `utilityProcess`; (c) hands the renderer a filesystem write surface we deliberately don't grant. **Wire protocol:** three new methods on the existing `files`/`storage` service surface — `uploadBegin({ scope, name, mime, totalBytes? }) → { uploadToken, chunkBytes }` (broker mints a fresh per-upload token, returns the worker-imposed chunk size — typically ≤ the per-envelope cap minus headroom for envelope overhead), `uploadChunk({ uploadToken, seq, bytesBase64 }) → { ok, receivedBytes }` (idempotent per seq; worker appends to a `.tmp` file scoped to the token, fold the bytes into a running BLAKE3/SHA-256), `uploadCommit({ uploadToken, expectedHash? }) → FileRef` (worker finalises the hash, optionally cross-checks, fsyncs, atomic-renames into the content-addressed store, returns the canonical FileRef). Cancel = `uploadAbort({ uploadToken })` or token-TTL expiry (the worker GCs orphan `.tmp` files on startup + after a per-token idle timeout). Per-app outstanding-upload ceiling and per-token byte ceiling both bounded by the broker's existing capability surface. **Streaming reassembly + hashing stays in JS at the worker for v1** (a Rust native addon is a measured-optimization swap noted in the deferred work below — does NOT block landing v1). **Sub-question (worker-side compute, deferred):** the streaming reassembly + incremental hash + fsync/rename in the storage worker is CPU/IO-bound and a candidate for a Rust native addon (the repo already ships a napi-rs dependency — `@napi-rs/keyring` — so the build pattern + cross-platform prebuild story exist). A Rust `storage-io` addon would do zero-copy chunk-append + streaming BLAKE3/SHA-256 off the JS heap. Caveats to settle before adopting: it's a *new* native dependency surface (per-platform prebuilds, the `bun:sqlite`/`better-sqlite3` runtime-split precedent), and the crypto-routing convention (only `main/credentials/` imports native crypto) means a hashing addon needs an explicit carve-out or must live behind the storage worker boundary only. Transport choice (a) is independent of and does not block the Rust decision — ship chunked-JS first, swap the worker hot path to Rust as a measured optimization if the JS path misses the upload-throughput budget.
- **Blocking?:** Resolved — no longer blocks 9.10a; the iteration is now mechanically scoped (three new methods, one worker reassembler, one fixture-driven progress test).

---

## Help, feedback & changelog — `OQ-HELP-1` … `OQ-FB-1`

(Added 2026-05-19 to unblock the user-requested 2026-05-15 Help/feedback group. Resolved to v1 positions so plan iterations **Help-1 / Help-2 / Feedback-3** can be specced. The keyboard-shortcuts split is already settled — reference lives in Settings + the 6.9 cheatsheet, **not** Help; Help is docs/onboarding/changelog only. Feedback-1/2 are *not* here: they are plan §14.24a, gated on the network broker, not on a missing OQ.)

#### OQ-HELP-1 — In-app Help center content source  *[RESOLVED — position taken 2026-05-19; unblocks Help-1]*
- **Where:** Implementation plan §Help-1. Shell privileged surface (`packages/shell/src/renderer/help/`). Source docs in `docs/`.
- **Question:** Where does the searchable Help center's content come from — (a) the `docs/` tree bundled into the shell at build time and rendered offline; (b) a remote docs site fetched at runtime; (c) the self-hosting vault's Notes (one Note per doc, per SH-10)?
- **Resolution (v1):** **(a) bundled offline, curated subset.** A build step emits a small static index + rendered HTML/MD of a *user-facing curated subset* of `docs/` (user guide / getting-started / per-app help — **not** the internal design docs or this OQ ledger) into the shell bundle; the Help center renders it fully offline, searched via the same lexical index primitive as global search (9.22) over the bundled corpus. No runtime network (consistent with the offline-first, no-unaudited-egress posture) and no coupling to a vault's Notes (Help must work before any vault is open / on an empty vault). A remote "latest docs" mirror and the SH-10 Notes-as-docs view are v2/self-hosting refinements, not v1. Curation is a manifest (`docs/help-manifest.*`) listing which docs ship — keeps internal architecture docs out of the shipped product ([[project_docs_org_repo_clean]]).
- **Blocking?:** Resolved — no longer blocks Help-1.

#### OQ-HELP-2 — Contextual / F1 per-surface help mechanism  *[RESOLVED — position taken 2026-05-19; unblocks Help-2]*
- **Where:** Implementation plan §Help-2. [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md) (`?` opens contextual help). Shortcut registry.
- **Question:** How does a surface (a Settings pane, an app window, a dialog) declare *which* help topic `?` / F1 opens — a per-surface registered anchor, a route-derived key, or a single generic Help-center open?
- **Resolution (v1):** **Route-derived topic key with a generic fallback.** `?` (when no input is focused — already in the shortcut registry as a declared action, never raw `e.key`) opens the Help center deep-linked to a topic key derived from the currently-focused surface's stable route/identity (dashboard, `settings/<pane>`, `app/<id>`); if no specific topic maps, it opens the Help center home. No new per-surface registration API in v1 (surfaces already have stable route identities — reuse them; an explicit `helpTopic` override field is a v2 affordance only if a surface needs to point somewhere non-obvious). Sandboxed apps get `?`→ their own app-help page by app id; they do **not** get to inject arbitrary shell-help content (capability boundary). This keeps v1 to one mapping table, no new contract for every surface to implement.
- **Blocking?:** Resolved — no longer blocks Help-2.

#### OQ-FB-1 — "What's new" / changelog source & trigger  *[RESOLVED — position taken 2026-05-19; unblocks Feedback-3]*
- **Where:** Implementation plan §Feedback-3 (Help & feedback surface). Build/release metadata.
- **Question:** What feeds the "What's new" surface and when is it shown — (a) a bundled changelog shown once per version bump on first launch; (b) a remote feed polled at runtime; (c) manual-only (user opens it from Help)?
- **Resolution (v1):** **Bundled changelog, shown once per version bump, also manually openable.** A curated `CHANGELOG`-derived artifact ships in the bundle (same build-time pattern as OQ-HELP-1, no runtime network). On launch, if the shipped app version is newer than the last-seen version persisted per vault/profile, the "What's new" panel auto-presents once (non-blocking, dismissible, never re-shown for that version); it is also always reachable from Help → What's new. A remote release feed is a v2 add-on once the network broker (14.24a / Stage 10+) exists — explicitly not v1 (keeps the offline-first invariant and avoids a phone-home on every launch). Per-vault last-seen-version key reuses the existing settings/profile store; no new persistence subsystem.
- **Blocking?:** Resolved — no longer blocks Feedback-3.

> **v2 upgrade note (added 2026-05-23):** [OQ-HELP-1's v1 resolution stands](#oq-help-1--in-app-help-center-content-source--resolved--position-taken-2026-05-19-unblocks-help-1) — v1 ships the Help center bundled at build time. The **v2 upgrade path** is designed in [platform/60-developer-docs.md](../platform/60-developer-docs.md) and tracked as `DocsHub-1..5`: the same Markdown source becomes a signed, first-party-only `DocsPack/v1` distributed through the existing catalog (so doc fixes ship out-of-band, not gated on shell binary releases); every shell binary embeds a bootstrap `DocsPack` so offline / fresh-install / air-gapped operation is unchanged; fetched packs supersede the bootstrap, never replace it. Widens the Help corpus from "user help" to "user help + developer documentation hub + auto-generated SDK reference + capability catalogue + IPC reference." `OQ-FB-1` is unaffected — the changelog stays in the binary (version-coupled trigger has no clean equivalent on an async-updated pack); the `DocsPack` only links to the changelog topic, never carries it.

---

## Developer documentation distribution — `OQ-DOCS-1` … `OQ-DOCS-5`

(Added 2026-05-23 alongside [platform/60-developer-docs.md](../platform/60-developer-docs.md) — the v2 upgrade path for the in-shell Help center. The doc resolves the structural question; these OQs cover the remaining shape decisions for `DocsHub-1..5`. `OQ-DOCS-1` resolves up-front so the iterations have a clean perimeter; the rest are decided as each iteration lands.)

#### OQ-DOCS-1 — First-party-only vs allow third-party `DocsPack`s in v2  *[RESOLVED — position taken 2026-05-23; pins `DocsHub-1`]*
- **Where:** [platform/60-developer-docs.md §First-party-only in v2](../platform/60-developer-docs.md). Reader-side validator in `DocsHub-1`.
- **Question:** In v2, does the `DocsPack/v1` content kind accept any-publisher packs (like apps / themes / icon packs / layout packs) or restrict to a single Brainstorm-catalog-signed pack?
- **Resolution (v2):** **First-party-only.** `DocsPack/v1` reserves `publisher.key === BRAINSTORM_CATALOG_KEY`; reader rejects any other publisher at load time and falls back to the bootstrap pack. Reasons: one trust signal in the reader chrome (no "third-party docs may differ" disclaimers), one PR review path for docs (this repo), avoids the help-injection social-engineering surface. **Per-app embedded docs** (third-party apps shipping their own help inside the app bundle, surfaced under "Installed app docs") is a coherent extension — explicitly **post-v2** (`DocsHub-5`), forward-compat shape sketched in doc 60.
- **Blocking?:** Resolved — pins the `DocsHub-1` reader contract.

#### OQ-DOCS-2 — Update behaviour: silent vs prompt vs manual
- **Where:** [platform/60-developer-docs.md §Update flow](../platform/60-developer-docs.md). Decided in `DocsHub-2`.
- **Question:** When a newer `DocsPack` is available on the catalog, does the shell (a) silently fetch + atomic-swap on launch; (b) prompt the user before fetching; (c) only update when the user clicks "Check for updates"?
- **Why it matters:** v1's bundled-only model has zero per-update UI surface to maintain. Adding a runtime update path needs a position so the surface stays minimal and consistent with how apps/themes update.
- **Lean:** **(a) silent on launch.** First-party-signed, small bundle (single-digit MB), purely informational content with no behavioural change, no per-update prompt for apps/themes either. A "Check for updates" button in the Help footer and a Privacy → Network toggle to disable the auto-check give power users both manual control and an off switch. Confirm in `DocsHub-2` build; revisit only if a docs update is ever shown to confuse a user.
- **Blocking?:** Non-blocking — the silent default is straightforward to swap to a prompt later if the build surfaces a reason.

#### OQ-DOCS-3 — SDK reference generator
- **Where:** [platform/60-developer-docs.md §Scope](../platform/60-developer-docs.md). Decided in `DocsHub-3`.
- **Question:** What generates the `sdk-reference/` section of the `DocsPack` from `packages/sdk/` + `packages/sdk-types/` — (a) TypeDoc with a custom Markdown theme; (b) a hand-rolled walker over `.d.ts` emitted to the same Markdown shape; (c) JSDoc-extraction only with no cross-link resolution?
- **Why it matters:** Affects whether hand-written prose pages can link to generated reference pages with the same anchor format (consistency across the corpus), and whether the reference output is reviewable in PRs.
- **Lean:** **(a) TypeDoc with a custom Markdown theme.** TypeDoc already handles re-exports, generics, conditional types, and cross-links; a custom Markdown theme renders into the same `docs/_generated/` tree the hand-written pages link into. Hand-rolled has no upside large enough to justify the maintenance.
- **Blocking?:** Non-blocking — settled in `DocsHub-3` build.

#### OQ-DOCS-4 — Locale story for `DocsPack`
- **Where:** [platform/60-developer-docs.md §Glossary](../platform/60-developer-docs.md); [platform/21-localization.md](../platform/21-localization.md).
- **Question:** Does each locale ship as a separate `DocsPack` (`brainstorm-official-docs-<bcp47>`), as one pack with per-locale subtrees, or as locale packs layered on top of an English pack?
- **Why it matters:** Bandwidth cost (a user on a phone tether shouldn't pull every locale), update independence (a Spanish translation lag shouldn't gate the English shipping), and consistency with the existing `LocalePack` content kind (14.23).
- **Lean:** **one pack per locale**, fetched on demand based on the user's active locale (mirrors how `LocalePack` works for shell strings — locales travel independently). English ships first; non-English locales are added with whichever `DocsHub` iteration translates them. Avoid bundling-all-locales-in-one-pack — fails on bandwidth and update independence.
- **Blocking?:** Non-blocking — English-only ships in `DocsHub-1`; the per-locale shape only matters when the second locale exists.

#### OQ-DOCS-5 — Reader behaviour on `compatibleShells` mismatch
- **Where:** [platform/60-developer-docs.md §In-shell Help reader contract](../platform/60-developer-docs.md). Decided in `DocsHub-2`.
- **Question:** When the running shell version is outside the cached pack's `compatibleShells` range (e.g. user updated the shell but the docs pack hasn't caught up, or the user is on a beta build ahead of the docs release), how does the reader behave — (a) refuse to load and fall back to the bootstrap pack; (b) load everything and show a banner; (c) load only the version-insensitive sections (`user-help` + `developer-hub`) and hide the version-sensitive generated sections (`sdk-reference` / `capabilities` / `ipc-reference`) until a compatible pack is reachable?
- **Why it matters:** The generated sections are the ones where mismatch can mislead (a renamed SDK export, a changed capability scope grammar). User-help and developer-hub prose are usually still close-enough.
- **Lean:** **(c)** — render the version-insensitive sections + a quiet footer banner, hide the version-sensitive ones with a "this section is catching up to the build you're on" stub linking to the public web mirror (which renders the latest source). This degrades gracefully without serving misleading reference content.
- **Blocking?:** Non-blocking — decided in `DocsHub-2` build.

---

## Onboarding & starter content — `OQ-WC-1` … `OQ-WC-4`

(Added 2026-05-22, registering the four questions surfaced by implementation-plan §Onboarding & starter content (`Welcome-1` / `Welcome-2`). None are blocking — they're shape decisions taken before build, not architecture gates — but each needs a position before the relevant rung lands.)

#### OQ-WC-1 — Welcome-1 seed timing relative to the first-run welcome card
- **Where:** Implementation plan §Welcome-1; [foundations/28-vault-and-onboarding.md §First-launch flow](../foundations/28-vault-and-onboarding.md).
- **Question:** Does the preseeded starter set land **before** the dashboard mounts (so the welcome card opens onto a populated grid that already looks like the product) or **after the welcome card is dismissed** (so the first frame is the canonical empty dashboard the welcome card describes, and the seed lands as the user follows the tour)?
- **Why it matters:** Affects what "first-frame" feels like — populated-and-explained vs empty-and-invited. Also affects how the welcome card's copy refers to existing entities ("here's the note we made you" vs "let's create your first note").
- **Blocking?:** Non-blocking; affects copy + ordering, not the seeder itself. *[RESOLVED in implementation-plan Welcome-1, 2026-05-31]* — **seed lands before the dashboard mounts**: the starter set is written through the entities service inside vault initialization (sibling to the bundled-app install), so the first frame is a populated, cross-linked grid and Graph paints a non-empty default (consistent with OQ-WC-2's (b) lean). The welcome card copy refers to the already-created entities ("here's the note we made you").

#### OQ-WC-2 — Welcome-1 aggressiveness — graph-paintable default or minimal
- **Where:** Implementation plan §Welcome-1.
- **Question:** How dense is the preseeded set — **(a) minimal** (one Note + one Task + one Folder, Graph still sparse), **(b) graph-paintable** (one entity per bundled app, all cross-linked via `@`-mentions so Graph paints a non-trivial default subgraph), **(c) opinionated** (a representative mini-vault — a sample project with notes, tasks, files, calendar events that read as a single coherent story)?
- **Why it matters:** Trade-off between "show every app exists" (b/c demo more product) and "don't put words in the user's mouth" (a leaves more blank canvas). (c) doubles as a beginner-tier template (overlap with Welcome-2).
- **Blocking?:** Non-blocking; gate before Welcome-1 content authoring. v1 lean: **(b)** — every bundled app gets exactly one entity, cross-linked, so Graph paints and discovery is fair across apps; opinionated mini-vaults live in Welcome-2 where the user opts in.

#### OQ-WC-3 — Welcome-2 template snapshot format
- **Where:** Implementation plan §Welcome-2; [foundations/28-vault-and-onboarding.md §Vault portability](../foundations/28-vault-and-onboarding.md).
- **Question:** Are templates shipped as **(a) full portable-vault tarballs** (one directory per template under `packages/shell/templates/<id>/`, identical shape to an exported vault — the export/import path is the import path), **(b) an entities-export JSON manifest** (the import is "create these entities", smaller, easier to diff/review at build time but a parallel ingestion path), or **(c) a hybrid** (JSON manifest authored, expanded to the entities-service call shape at install time)?
- **Why it matters:** (a) is one path with vault-format coupling (a template authored against vault-format v0.7 needs a migration when the shell ships v0.8); (b) decouples but is a second ingestion path to maintain alongside Path B (open) and Path D (import); (c) gets the best of both at the cost of a build step.
- **Blocking?:** Non-blocking; gate before Welcome-2 build. *[RESOLVED 2026-05-31 (user-confirmed): **(b) entities-export JSON** — templates ship as a JSON entities manifest, imported as "create these entities" merged through the single-object-space (the same path Welcome-1's `runWelcomeSeed` already uses), version-tolerant via the List/note codecs' defensive decode. Chosen over (c) hybrid: no build-expansion step, and the entities-create ingestion path already exists post-Welcome-1. Forward-migration stays OQ-WC-4 (a) rebuild-at-release.]*

#### OQ-WC-4 — Welcome-2 versioning when the shell upgrades past a template's vault format
- **Where:** Implementation plan §Welcome-2.
- **Question:** When a bundled template was authored against vault-format `v0.7` and the shell now ships `v0.8`, how is the template forward-migrated — **(a) rebuilt at release time** (templates are part of the shell bundle, the release CI rebuilds each template against the current vault format and stamps a `templateFormatVersion`); **(b) migrated at import time** (the same forward-only migration scaffold that handles user vaults handles template imports — slower import, more code paths but one migrator); **(c) both** (rebuild for cleanliness, fall back to migrate for safety)?
- **Why it matters:** (a) keeps the import path simple but ties every template re-author to the release cadence; (b) is one less thing to gate on the release schedule but doubles the migrator's blast radius; (c) is belt-and-suspenders but doubles the work.
- **Blocking?:** Non-blocking; gate before Welcome-2 build. v1 lean: **(a) rebuild at release time** — templates are read-only build artifacts; if a future vault-format break ever requires runtime migration of an old template, fall back to (b) then.

---

## Open resolution — `OQ-OR-1` … `OQ-OR-5`

(Added 2026-05-19, registering the five questions surfaced by [platform/57-open-resolution.md §Open questions](../platform/57-open-resolution.md). All five are resolved to the design doc's v1 leaning — each is a low-risk default with a clear v2 escape — so plan iteration **OpenRes-1** is unblocked. Positions are binding for v1; the v2 column in [57 §Phasing](../platform/57-open-resolution.md) tracks the deferred half of OR-1/OR-2.)

#### OQ-OR-1 — Granularity of the OS-handoff consent memory  *[RESOLVED — position taken 2026-05-19; unblocks OpenRes-1]*
- **Where:** [platform/57-open-resolution.md §System default](../platform/57-open-resolution.md). Stored in the doc-26 per-`(open, target)` default store.
- **Question:** Is an "always open externally" choice remembered **per scheme** (`https:` blanket) or per `(scheme, registrable-domain)` (so trusting `https:` once doesn't blanket-trust every site)?
- **Resolution (v1):** **Per scheme.** The rung-2 default is keyed to the target signature (scheme / extension), matching the existing doc-26 default store with no new key shape. Domain-scoped opt-in ("always for `https://github.com`, ask for everything else") is a v2 refinement layered on the same store — not v1, because per-domain memory needs its own review/clear UX and a registrable-domain extractor that v1 doesn't yet need. The egress audit ([38 Network panel](../security/38-network-and-proxy.md)) still records every handoff per destination, so per-scheme memory is not per-destination blindness.
- **Blocking?:** Resolved — no longer blocks OpenRes-1.

#### OQ-OR-2 — Is the dangerous-scheme floor ever org-relaxable?  *[RESOLVED — position taken 2026-05-19; unblocks OpenRes-1]*
- **Where:** [platform/57-open-resolution.md §Security floor](../platform/57-open-resolution.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** Can an enterprise that genuinely needs a custom `internal-app://` ever relax the hard-blocked-scheme floor?
- **Resolution (v1):** **Never via a user toggle.** The floor (`javascript:` · `data:` · `vbscript:` · out-of-vault `file:` · null/`about:`-class) is a fixed, unconditional rung-6 block in v1 — no setting, no per-vault override (a malicious entity must not be able to social-engineer a one-click code-exec). The *only* future relaxation path is a **signed org policy in v2** (MDM-style, [57 §Phasing](../platform/57-open-resolution.md) v2 row), and even then `javascript:`/`data:`/`vbscript:` stay permanently unrelaxable — an org policy may at most widen the *allowed custom-scheme* set, never re-enable code-exec schemes.
- **Blocking?:** Resolved — no longer blocks OpenRes-1 (v1 is the simple total block).

#### OQ-OR-3 — Rung-2 default points at an uninstalled app  *[RESOLVED — position taken 2026-05-19; unblocks OpenRes-1]*
- **Where:** [platform/57-open-resolution.md §The resolution ladder](../platform/57-open-resolution.md) (rung 2), [17-interoperability.md §Default handlers](../platform/17-interoperability.md).
- **Question:** When the stored rung-2 default names an app that was since uninstalled, does the resolver silently re-resolve (drop to rung 3+) or notify the user?
- **Resolution (v1):** **Silent re-resolve.** A stale default whose app is gone is treated as absent: the ladder continues from rung 3 (registered openers → "Open with…" → universal editor / OS handoff) as if no default were set. The default entry is **not** eagerly deleted (re-installing the app restores the preference); it is simply skipped while unresolvable. The "Why did this open here?" explainer reflects it ("Your default *Foo* is not installed — opened with *Bar* instead. [Change default]"), so it is explained, not magic, and never a dead click. This keeps totality (an uninstall can never strand a target) without a modal interruption on every such open.
- **Blocking?:** Resolved — no longer blocks OpenRes-1.

#### OQ-OR-4 — Does `quick-look` get its own resolver pass?  *[RESOLVED — position taken 2026-05-19; unblocks OpenRes-1]*
- **Where:** [platform/57-open-resolution.md §The resolver is one primitive](../platform/57-open-resolution.md), [17-interoperability.md](../platform/17-interoperability.md) (`quick-look` verb), [26 cross-app navigation OQs].
- **Question:** Is the doc-26 `quick-look` verb a separate resolution ladder, or a presentation modifier on the same `open` ladder?
- **Resolution (v1):** **A modifier on the one ladder.** `quick-look` resolves through the exact same `OpenResolver.resolve(target)` — same rungs, same defaults, same floor — and differs only in *presentation*: the resolved handler is invoked in a non-launching preview surface (the existing Quick Look / Preview presentation) instead of a full window/launch. There is no second ladder, no second "Open with…", no separate default store. This preserves the doc-57 invariant that there is exactly one resolver and one answer; quick-look is "resolve, then present transiently." A handler that cannot present transiently (rare) falls back to a normal open with the explainer noting it.
- **Blocking?:** Resolved — no longer blocks OpenRes-1.

#### OQ-OR-5 — File target with no extension and ambiguous MIME  *[RESOLVED — position taken 2026-05-19; unblocks OpenRes-1]*
- **Where:** [platform/57-open-resolution.md §Openable targets](../platform/57-open-resolution.md) (`file` kind), Files app.
- **Question:** For a `file` target with no extension and an ambiguous sniffed MIME, does the resolver prompt or default somewhere?
- **Resolution (v1):** **Default to the universal viewer** (Files preview), with an inline **"Open with…"** escape. No blocking prompt: an unknown-type file opens in the universal Files preview (hex/text/binary-safe inspector) immediately, and the same shared "Open with…" surface (rung 3's menu) is one click away to route it elsewhere or set a default keyed by the *sniffed* MIME. This keeps the function total (no dead click on a mystery file), avoids a modal on a low-stakes case, and reuses the existing discoverability surface rather than inventing a disambiguation dialog. It never falls *outward* to the OS automatically for an ambiguous file — that still requires the §System-default consent gate.
- **Blocking?:** Resolved — no longer blocks OpenRes-1.

#### OQ-OR-6 — Routing for "Notes typed as Journal / Tasks / Files content" via collection overlay
- **Where:** [platform/57-open-resolution.md §Resolver ladder](../platform/57-open-resolution.md), [data/21-objects-and-collections.md §Collection-scoped overlays](../data/21-objects-and-collections.md), implementation-plan stage **9.3.5 single-object-space remodel**.
- **Question:** Under OQ-DM-1's resolved single-object-space model, a Journal entry, a checklist note, or a folder description is `Note/v1` whose discriminator is *Collection membership*, not entity type. The openers registry routes by `entityType` — so a `@`-mention click on a journal-day Note from inside the main Notes app still resolves Notes as the primary opener, never Journal. How does the open resolver consult collection membership / scope so the user reaches the **app that owns the surface they're working in** without proliferating per-purpose entity types (which the resolved OQ-DM-1 explicitly rejected)?
- **Options:** (a) Extend `OpenerTargetKind` with `CollectionScope` and let an app register itself as the primary opener for `Note/v1` *when* the entity belongs to a named collection (Journal registers `(EntityType=Note/v1, CollectionScope=journal)`); resolver picks the most specific row, falling back to the entity-type primary. (b) Keep the registry untouched and put a thin **routing overlay** in `intents-bus.dispatchOpenEntity` that consults the active collection membership *before* the openers lookup (membership → app id resolved at vault-open time). (c) Reverse the relationship: store a "preferred opener" pointer on each Collection scope and let the resolver read it as a sibling of stored defaults (Settings → Defaults gains a per-collection row).
- **Tentative leaning:** **(a) Extend `OpenerTargetKind` with `CollectionScope`** — same shape as the other target kinds (`Scheme` / `Extension` / `Mime` / `EntityType`), so the resolver stays a flat sorted lookup and `decideOpen` doesn't grow a new pre-rung. Falls cleanly out of the existing primary-vs-secondary ranking, plays nicely with the slice-6 picker (multi-candidate fork when both Notes and Journal claim the same `Note/v1` + scope), and slots into the same Settings → Defaults UI. Option (b) hides the routing in the bus where it's invisible to the user; (c) duplicates the openers contract on every Collection.
- **Blocking?:** **No** — gated on the **9.3.5 single-object-space remodel** which lands the collection model itself. Until then, `Note/v1` correctly resolves to Notes regardless of collection membership, and Journal owns the in-Journal-app editing path because that's the entry the user clicks; 9.18.7's cross-app routing fence pins this current behaviour. Once 9.3.5 lands, this OQ becomes load-bearing for the routing pass that closes it.

---

### Monetisation strategy (added in 43)

#### OQ-MS-1 — Platform-managed AI margin
- **Where:** [43-monetisation-strategy.md §AI monetisation](../platform/43-monetisation-strategy.md), [44-pricing.md §Bundled AI credits](../platform/44-pricing.md).
- **Question:** Margin over provider passthrough on platform-managed AI calls?
- **Options:** (a) 5% (just-cost-recovery). (b) 15% (modest). (c) 25% (typical SaaS resell).
- **Tentative leaning:** (b) 15% for v2 launch; reassessed annually. Surfaced transparently in Settings → AI → Usage ("provider cost $3.65; platform handling $0.55").
- **Blocking?:** No (v2 launch concern).

#### OQ-MS-2 — Annual-discount magnitude
- **Where:** [43-monetisation-strategy.md §Pricing posture](../platform/43-monetisation-strategy.md), [44-pricing.md](../platform/44-pricing.md).
- **Question:** Annual prepay discount: 16% ("2 months free"), 20% (more aggressive), or something else?
- **Tentative leaning:** 16% — clean "2 months free" marketing and protects gross margin.
- **Blocking?:** No.

#### OQ-MS-3 — Developer-side publish fee
- **Where:** [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md).
- **Question:** Should the catalog charge developers an annual publish fee (Apple-style $99/yr) in addition to the 15% revenue share?
- **Tentative leaning:** No — keep the publish surface free; the 15% / 0%-under-$10k is the only fee.
- **Blocking?:** No.

#### OQ-MS-4 — Non-profit / education plan
- **Where:** [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md), [44-pricing.md §Discounts](../platform/44-pricing.md).
- **Question:** Discount level for verified non-profits and educational institutions?
- **Tentative leaning:** 50% off annual subscriptions for both consumer (Plus/Pro) and Team. Verification annual.
- **Blocking?:** No.

#### OQ-MS-5 — Active-seat measurement (Team / Enterprise)
- **Where:** [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md), [44-pricing.md](../platform/44-pricing.md).
- **Question:** "Active seat" = last-active-within-30-days, or last-active-within-billing-period?
- **Tentative leaning:** Active-in-billing-period. Reduces punitive seat-cycle-abuse handling and is easier to explain in invoicing.
- **Blocking?:** No.

#### OQ-MS-6 — Cloud-attachment overage grace-period length
- **Where:** [43-monetisation-strategy.md §Downgrade behavior](../platform/43-monetisation-strategy.md).
- **Question:** Default grace period when a user is over the new plan's attachment quota after downgrade — currently proposed 90 days.
- **Tradeoff:** Attachment-storage cost on our side vs. user-experience friction.
- **Tentative leaning:** 90 days. Revisit after first cohort of downgrades has empirical numbers.
- **Blocking?:** No.

#### OQ-MS-7 — Transparent gross-margin disclosure (AI line)
- **Where:** [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md).
- **Question:** Publish a transparent gross-margin band on the platform-managed AI line publicly?
- **Trade-off:** Trust play vs. competitive disclosure.
- **Tentative leaning:** Per-call transparency in the product is already firm (per OQ-MS-1 resolution); a *published band* in marketing material is a separate question. Probably yes — fits brand posture. Hold for marketing review.
- **Blocking?:** No.

#### OQ-MS-8 — Lifetime / one-time-purchase plan
- **Where:** [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md), [44-pricing.md](../platform/44-pricing.md).
- **Question:** Do we ever offer a lifetime / one-time-purchase plan?
- **Tentative leaning:** No in v2 (cashflow predictability matters; lifetime deals destroy LTV signal). Revisit post-v2 if a strong reason emerges.
- **Blocking?:** No.

---

### Pricing (added in 44)

#### OQ-MS-9 — PPP-adjusted region list at launch
- **Where:** [44-pricing.md §Regional pricing](../platform/44-pricing.md).
- **Question:** Which regions get PPP-adjusted pricing at v2 launch? India, Brazil, Mexico are leaned; what about Turkey, Argentina, Egypt, Indonesia, Nigeria?
- **Trade-off:** Each adds operational complexity; some are arbitrage targets.
- **Tentative leaning:** India, Brazil, Mexico at launch; expand based on observed adoption.
- **Blocking?:** No.

#### OQ-MS-10 — Bundled-credit denomination (USD vs tokens)
- **Where:** [44-pricing.md §Bundled AI credits](../platform/44-pricing.md).
- **Question:** AI credits in USD (legible, exposes us to model-price changes) or token-denominated (tracks model market, less legible)?
- **Tentative leaning:** USD. Revisit if model market shifts a lot.
- **Blocking?:** No.

#### OQ-MS-11 — Education-discount verification mechanism
- **Where:** [44-pricing.md §Discounts](../platform/44-pricing.md).
- **Question:** SheerID/UNiDAYS-style third-party verifier, or in-house `.edu`-domain heuristic?
- **Tentative leaning:** Third-party (more accurate globally; catches non-`.edu` institutions). Adds vendor cost.
- **Blocking?:** No.

#### OQ-MS-12 — Promotional lifetime deals at launch
- **Where:** [44-pricing.md](../platform/44-pricing.md).
- **Question:** Do we run AppSumo-style lifetime promos at launch to seed adoption?
- **Tentative leaning:** No. Destroys per-customer LTV signal; cashflow worse than steady subs. Re-evaluate if launch traction is materially weak.
- **Blocking?:** No.

#### OQ-MS-13 — Pro-tier bundled AI amount
- **Where:** [44-pricing.md §Pro](../platform/44-pricing.md).
- **Question:** $5/mo bundled credits on Pro — enough to demo value, or push to $10?
- **Tentative leaning:** $5 at launch; tunable based on Pro conversion rate (if Pro signups stall, $10 bundle is a lever).
- **Blocking?:** No.

#### OQ-MS-14 — Active-seat counter semantics (concrete)
- **Where:** [44-pricing.md §Proration](../platform/44-pricing.md). Companion to OQ-MS-5 (strategy-level).
- **Question:** When a Team owner removes a seat mid-cycle, when does the prorated credit apply — next bill, or immediate refund?
- **Tentative leaning:** Next bill (no cash refund). Simpler to explain and to ops.
- **Blocking?:** No.

---

### Import / export (added in 45)

#### OQ-186 — Export as Automations workflow actions
- **Where:** [45-import-export.md](../platform/45-import-export.md), [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md).
- **Question:** Should the Automations app expose `export.vault` and `export.selection` as workflow actions, so users can build custom backup pipelines (e.g. "every Sunday, export the `Project Phoenix` folder as a bundle, write to Dropbox, post a Slack message")? This would supersede the limited scheduled-backups UI.
- **Options:**
  - (a) Yes — export verbs are first-class workflow actions; deprecate the bespoke scheduled-backup UI.
  - (b) No — keep export UI-only; workflows out of scope for v1.
- **Tentative leaning:** (a), once the Automations app lands; the scheduled-backup UI is a v1 placeholder.
- **Blocking?:** No (gated behind the Automations app).

#### OQ-187 — "Migration from product X" as an app-store category
- **Where:** [45-import-export.md](../platform/45-import-export.md), [14-app-store.md](../apps/14-app-store.md).
- **Question:** Should "migration from product X" apps be a recognised app-store category with a dedicated onboarding entry point, or just regular apps tagged "migration"?
- **Options:**
  - (a) First-class category + onboarding entry point.
  - (b) Regular apps with a "migration" tag.
- **Tentative leaning:** (b) for v1; promote to (a) if the migration-app surface grows.
- **Blocking?:** No.

#### OQ-245 — `.bsbundle` cherry-pick import mode
- **Where:** [45-import-export.md §Two scopes](../platform/45-import-export.md); implementation-plan §Import, export & migration (IE-1).
- **Question:** Should `.bsbundle` import support a *cherry-pick* mode (select entity types or a folder subtree to import) rather than all-or-nothing into a new vault?
- **Options:**
  - (a) All-or-nothing — import always creates a fresh vault that mirrors the bundle (the §Two scopes decision as written).
  - (b) Add a cherry-pick selector — pick types / a subtree; selected entities merge into the *current* vault through the single-object-space create path (the same merge IE-2 uses for migration imports).
- **Tentative leaning:** (b) for IE-1 — the single-object-space already makes a typed-subset merge well-defined; whole-vault restore stays the default.
- **Blocking?:** No (shape decision; gate before IE-1 lands). *(Registered 2026-06-12; renumbered from a stale inline "OQ-183" in doc 45 that collided with the canonical custom-CSS question.)*
- ***[RESOLVED in implementation-plan IE-1, 2026-06-16] → (b).*** The bundle format carries a `scope` field with three kinds (`whole-vault` | `types` | `subtree`); the IE-1 export engine implements all three (`BundleExportScopeKind`, `packages/shell/src/main/bundle/`). A cherry-pick *export* (a typed subset / a link-reachable subtree) is well-defined and shipped now; cherry-pick *import-merge into the current vault* reuses the IE-2 merge engine (this rung restores into a fresh vault), so the merge-conflict half lands with IE-2. Whole-vault restore stays the default.

#### OQ-246 — `.bsbundle` publisher signing
- **Where:** [45-import-export.md §Bundle format](../platform/45-import-export.md); implementation-plan §Import, export & migration (IE-1).
- **Question:** Should `.bsbundle` carry a publisher Ed25519 signature so importers can verify the bundle wasn't tampered with in transit (useful for team-distributed bundles)?
- **Options:**
  - (a) No signature for v1 — bundles are user-local takeout artifacts; trust is the filesystem.
  - (b) Optional detached signature + a verify-on-import affordance, reusing the existing vault identity Ed25519 keypair (no new key-management surface for the common case).
- **Tentative leaning:** (a) for beta (IE-1 is backup/device-move); (b) when team-distributed bundles become a real use case (overlaps marketplace signing, [32-store-verification.md](../apps/32-store-verification.md)).
- **Blocking?:** No. *(Registered 2026-06-12; renumbered from a stale inline "OQ-184" in doc 45 that collided with the canonical app-lock question.)*
- ***[RESOLVED in implementation-plan IE-1, 2026-06-16] → (a) for beta.*** No publisher signature in the v1 `.bsbundle` — bundles are user-local backup / device-move artifacts; trust is the filesystem. The outer container is versioned (`BUNDLE_CONTAINER_VERSION`) so an optional detached Ed25519 signature (option (b), reusing the vault identity keypair) can be added without a format break when team-distributed bundles become a real use case. Tracked there alongside marketplace signing.

#### OQ-247 — Migration importers in-shell vs. install-on-demand
- **Where:** [45-import-export.md §Supported import formats](../platform/45-import-export.md); implementation-plan §Import, export & migration (IE-3/IE-5/IE-6).
- **Question:** Should the heavy first-party migration importers (Notion / Obsidian / page-DB / wiki) ship *as part of the shell* (always available, zero install step on first launch) at the cost of default-download size, given migration is the single most common Stage-0 use case for new users?
- **Options:**
  - (a) Install-on-demand — the first-launch "Migrating from…" picker installs the right importer from the app store (doc 45's bundle-size decision as written).
  - (b) Bundle the top 1–2 importers (Notion + Obsidian) in-shell, install the long tail on demand.
- **Tentative leaning:** (b) — bundle the two highest-traffic switch-in sources so the most common migration is frictionless; everything else installs on demand.
- **Blocking?:** No (gate before IE-3 wires the picker). *(Registered 2026-06-12; renumbered from a stale inline "OQ-185" in doc 45 that collided with the canonical editor-virtualization question.)*

#### OQ-242 — Community format-adapter market (lightweight content-kind)
- **Where:** [45-import-export.md §Extensibility](../platform/45-import-export.md), [47-marketplace.md](../apps/47-marketplace.md).
- **Question:** Should "format adapter" be a distinct, lightweight marketplace content-kind — a pure-transform converter, versioned/updatable, possibly third-party, on a light review lane — beside the heavy first-party migration apps, to cover the unbounded per-format long tail (Todoist / Things / TaskPaper / … → `Task/v1`, and the equivalent for every other type)?
- **Options:**
  - (a) Yes — a new `FormatAdapter` content-kind with its own review lane (justified by the powerless-isolate execution model, OQ-244).
  - (b) No — only first-party generic importers + first-party migration apps; any third-party converter is a full app.
- **Tentative leaning:** (a), but deferred — don't design the content-kind until 2–3 real adapters exist to pull on the contract.
- **Blocking?:** No (post-v1; gated on the marketplace + OQ-244).

#### OQ-243 — Home for one-shot authenticated-API import (e.g. Notion) *[RESOLVED in implementation-plan IE-7 — (a)]*
- **Resolution (2026-07-23):** **(a)** — the one-shot Notion-API import is a non-file **Source** in the IE-2 import pipeline that reuses the connector OAuth / scoped-egress broker but keeps **no `SyncMapping` cursor** ("a connector without a cursor"). Confirmed as the tentative leaning: it keeps the parse→map→project→write tail shared with every other importer, so the API path adds only a Source + a format Parse adapter, not a parallel sync engine. First rung landed (shell PR #256): `notion-api-blocks.ts` renders API block trees into the exact markdown dialect the existing planting path parses, so IE-6's Map→Write is reused verbatim.
- **Where:** [45-import-export.md §Extensibility](../platform/45-import-export.md), [56-connector-framework.md](../apps/56-connector-framework.md).
- **Question:** One-shot import over the network with OAuth (import a Notion workspace via its API, run once) falls between file-import ([45](../platform/45-import-export.md), file-only) and connector sync ([56](../apps/56-connector-framework.md), continuous). Where does it live?
- **Options:**
  - (a) In 45's import flow as a pluggable non-file **Source** stage that reuses the connector OAuth/scoped-egress broker but keeps no `SyncMapping` cursor.
  - (b) As a "run-once" cadence mode of a 56 connector.
- **Tentative leaning:** (a) — keeps the parse→map→project pipeline shared; the API source is "a connector without a cursor". Gated on the connector / Net infrastructure.
- **Blocking?:** No (file-source import ships first, independent of this).

#### OQ-244 — Adapter execution sandbox (powerless isolate vs. in-app)
- **Where:** [45-import-export.md §Extensibility](../platform/45-import-export.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** Where does a (possibly third-party) format adapter's parse/map code run?
- **Options:**
  - (a) A powerless, time/memory-bounded isolate with **no host bridge** — sees only bytes/records, returns plain drafts; the host owns file I/O, network, dedupe, and entity writes. Empty capability surface → light review lane.
  - (b) Inside the consuming/owning app's renderer — simpler, but the adapter inherits that app's capabilities, so community adapters need the heavy active-code review lane.
- **Tentative leaning:** (a) — the powerless guarantee is the precondition that makes a third-party converter market (OQ-242) safe to open.
- **Blocking?:** No (post-v1).

---

### Payments architecture (added in 45)

#### OQ-PA-1 — Entitlement token expiry tuning
- **Where:** [45-payments-architecture.md §Entitlement tokens](../platform/45-payments-architecture.md).
- **Question:** Soft / hard expiry: 30 / 60 days (proposed), or shorter (7 / 14, more responsive) or longer (60 / 120, more offline-tolerant)?
- **Trade-off:** Revocation-latency vs. user-friction-on-offline. 30 / 60 split is the leaning.
- **Tentative leaning:** 30 / 60 for paid plans, 365 / 730 for Free.
- **Blocking?:** No.

#### OQ-PA-2 — Billing-edge co-location with relay
- **Where:** [45-payments-architecture.md §What the billing edge owns](../platform/45-payments-architecture.md).
- **Question:** Co-locate billing edge with relay (single ops surface) or strictly separate?
- **Tentative leaning:** Strictly separate (privacy + security boundary, double ops surface accepted).
- **Blocking?:** No.

#### OQ-PA-3 — Per-device vs. per-account quotas
- **Where:** [45-payments-architecture.md §Quota enforcement](../platform/45-payments-architecture.md).
- **Question:** Quotas attach to account (pooled across all devices) or per-device (independent meters per device)?
- **Tentative leaning:** Per-account. Per-device confuses users; per-account is the industry norm.
- **Blocking?:** No.

#### OQ-PA-4 — Invoices visible to apps
- **Where:** [45-payments-architecture.md §Capability surface](../platform/45-payments-architecture.md).
- **Question:** Should `commerce.*` SDK surface let apps read invoice history?
- **Tentative leaning:** No. Shell-only. Invoices contain sensitive billing info; apps don't need it.
- **Blocking?:** No.

#### OQ-PA-5 — Catalog-fee "opt-in-for-promotion" mechanic
- **Where:** [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md), [45-payments-architecture.md §Catalog fee collection](../platform/45-payments-architecture.md).
- **Question:** Does "give up the 0% threshold for editorial promotion" create perverse incentive for small developers?
- **Tentative leaning:** Pilot small (limit to 1 featured slot/week, max), observe.
- **Blocking?:** No.

#### OQ-PA-6 — Support-agent diagnostic access to entitlement issuance history
- **Where:** [45-payments-architecture.md §Refund flows](../platform/45-payments-architecture.md).
- **Question:** Should support agents have view-only access to entitlement-token issuance history for diagnostics?
- **Trade-off:** Privacy vs. debuggability.
- **Tentative leaning:** Yes — issuance-history only, no content. Audit-logged.
- **Blocking?:** No.

#### OQ-PA-7 — Lifetime-plan schema modeling
- **Where:** [45-payments-architecture.md §account.db](../platform/45-payments-architecture.md). Companion to OQ-MS-8 / OQ-MS-12.
- **Question:** If we ever offer a lifetime plan, how is it modeled in `subscription`? Currently the schema doesn't have a `lifetime` plan.
- **Tentative leaning:** Hold until lifetime is decided strategically; schema would gain a `lifetime` plan value + `ends_at` null + a `paid_until_at` snapshot field.
- **Blocking?:** No.

#### OQ-PA-8 — On-prem billing edge for Enterprise
- **Where:** [45-payments-architecture.md](../platform/45-payments-architecture.md).
- **Question:** Will any Enterprise customer demand on-prem billing edge (alongside on-prem relay)?
- **Tentative leaning:** Almost certainly not pre-launch; some highly-regulated customers may demand it post-v2. Design defers to that point.
- **Blocking?:** No.

### Marketplace and wallet (added in 47)

#### OQ-MK-1 — Wallet-aggregation opt-in for non-catalog developers *[RESOLVED in 47]*
- **Where:** [47-marketplace.md §Principles](../apps/47-marketplace.md).
- **Question:** ~~Should the marketplace UI surface "this developer offers wallet sync" as an opt-in badge, or should wallet aggregation be silently always-on for catalog-mediated purchases…?~~
- **Resolution:** Moot under the **single-path rule** (Principle 3 in 47): all paid distribution is catalog-mediated; aggregation is automatic and universal for every catalog-mediated purchase; selling outside the catalog (developer-side Stripe inside the app, or side-channel "buy on my website + activate via license key") is **not a permitted path**. Sideload distribution stays free-only.

#### OQ-MK-2 — Multi-publisher developer-org key model
- **Where:** [47-marketplace.md §Multi-publisher orgs](../apps/47-marketplace.md).
- **Question:** When multi-publisher developer orgs ship (post-v2 / 14.26), do they share a single publisher key (simpler, single-incident risk) or use key-per-publisher with org-signed cross-claims (more robust, more complex)?
- **Options:**
  - (a) Single shared key — simpler. Compromise of any member's machine compromises every listing.
  - (b) Key-per-publisher + org-signed cross-claims — more robust. Compromise is scoped to the affected member's listings. Mirrors how Git commit signing handles multi-author orgs.
- **Tentative leaning:** (b). The multi-victim incident risk of (a) is too large.
- **Blocking?:** Yes for 14.26 (and the schema reservation in 14.22 should anticipate (b)).

#### OQ-MK-3 — First host-app plugin extension point
- **Where:** [47-marketplace.md §Plugins as a new content kind](../apps/47-marketplace.md).
- **Question:** Which host app should ship the first plugin extension point — Notes (Lexical custom nodes), Database (custom view kinds), or Graph (custom layout algorithms)?
- **Options:**
  - (a) Notes — broadest user reach; Lexical's plugin API is mature.
  - (b) Database — most-requested extension surface in prior local-first tools (custom views); narrower but high-leverage.
  - (c) Graph — most architecturally interesting (layout algorithms); narrowest reach.
- **Tentative leaning:** (a). Notes is the broadest plugin surface and the highest-volume user need; Lexical's node-extension API is a clean target. (b) and (c) follow.
- **Blocking?:** Not for 14.25 (which only reserves the kind slot). Blocking before plugin runtime work begins.

#### OQ-MK-4 — Per-developer rate negotiation
- **Where:** [47-marketplace.md §Fee mechanics — operational detail](../apps/47-marketplace.md).
- **Question:** Should we ever offer per-developer rate negotiation (e.g., "this app is strategic, you get 5% instead of 15%")?
- **Tentative leaning:** No — the rate is published, rate-card-only, no negotiation (per [43 §Catalog economics](../platform/43-monetisation-strategy.md)). Surfaced here for explicit closure so we don't quietly drift into this anti-pattern.
- **Blocking?:** No.

#### OQ-MK-5 — Marketplace subscriptions rate
- **Where:** [47-marketplace.md §Subscriptions vs one-time purchases](../apps/47-marketplace.md).
- **Question:** When marketplace subscriptions ship post-v2 (with Brainstorm Commerce), does the same 15% rate apply, or a different rate to account for subscription-side churn handling?
- **Tentative leaning:** Same 15% rate. Churn handling is the developer's surface to manage; we provide the plumbing, not a discount for taking it.
- **Blocking?:** No (post-v2).

#### OQ-MK-6 — Multi-signature listings (cross-developer co-authoring)
- **Where:** [47-marketplace.md §What makes a *good* kind](../apps/47-marketplace.md).
- **Question:** Should the catalog support multi-signature listings — e.g. a theme co-signed by a designer and a typographer, with revenue split between them?
- **Tentative leaning:** No in v2; revisit with observed demand. Single-publisher listings simplify revenue attribution and the threshold math.
- **Blocking?:** No.

#### OQ-MK-7 — Catalog-mediated refund escalation beyond 7 days
- **Where:** [47-marketplace.md §Refunds and disputes](../apps/47-marketplace.md).
- **Question:** Beyond 7 days, refunds for catalog-mediated content are developer-controlled. Should the catalog also offer an escalation path where it refunds the user as a courtesy and absorbs the cost?
- **Tentative leaning:** No — developer-controlled. A catalog-absorbed refund is a moral-hazard surface (users complain to us to bypass developer refund policies). Developers handle their own refunds beyond the 7-day self-serve window.
- **Blocking?:** No.

#### OQ-MK-8 — Wishlist surface in the marketplace
- **Where:** [47-marketplace.md §Top-level navigation](../apps/47-marketplace.md).
- **Question:** Is a Wishlist surface ("save for later" on listings) essential for v2 or nice-to-have?
- **Tentative leaning:** Nice-to-have; ships post-14.18 if time allows. Not in the v2 critical path.
- **Blocking?:** No.

#### OQ-MK-9 — Developer-portal public API
- **Where:** [47-marketplace.md §Developer accounts](../apps/47-marketplace.md).
- **Question:** Should we ship a public developer-portal API (publish-from-CI, automate listings, query analytics programmatically) or keep the portal web-only in v2?
- **Options:**
  - (a) Web-only — simpler scope; defer API to post-v2.
  - (b) Read-only analytics + listing CRUD via API, ships in 14.22.
  - (c) Full API parity with the web portal from day one.
- **Tentative leaning:** (b). Publish-from-CI is a strong DX win for serious developers; analytics-by-API enables custom dashboards.
- **Blocking?:** Yes for 14.22.

#### OQ-MK-10 — Wallet organization (kind vs chronological)
- **Where:** [47-marketplace.md §Wallet UI](../apps/47-marketplace.md).
- **Question:** In the wallet, should purchases be grouped by kind (Apps / Themes / Plugins / …) or chronologically (most recent first)?
- **Tentative leaning:** Kind-grouped with a toggle for chronological. Most users will want to find "the icon pack I bought last month"; kind-grouping aids that. Power users keeping books prefer chronological.
- **Blocking?:** No (cosmetic). Post-v2 only.

#### OQ-MK-11 — Withdrawal-right waiver UX on AI credit top-up
- **Where:** [47-marketplace.md §The AI credit balance (post-v2)](../apps/47-marketplace.md).
- **Question:** How aggressively to surface "this is non-refundable past 14 days" copy in the AI credit top-up flow? German BGB §312g requires the right of withdrawal to be honoured for digital-content purchases unless explicitly waived in writing by the consumer after being informed.
- **Options:**
  - (a) Mandatory checkbox on the top-up confirmation: "I want to start using credits immediately and waive my 14-day withdrawal right." If unchecked, the credit balance is held but unusable for 14 days.
  - (b) Default-waived with a clearly-disclosed banner ("If you use any credits within 14 days, you forgo your withdrawal right under BGB §356 Abs. 5"). Lighter friction; arguably less protective.
  - (c) Per-jurisdiction surface: (a) in EU/DE/AT/CH; (b) elsewhere.
- **Tentative leaning:** (a) globally — applies the strictest applicable standard uniformly. Single legal model is operationally simpler than per-jurisdiction branching.
- **Blocking?:** Yes for 14.28 (post-v2).

#### OQ-MK-12 — Sequencing AI credit balance launch by jurisdiction
- **Where:** [47-marketplace.md §The AI credit balance (post-v2)](../apps/47-marketplace.md).
- **Question:** Do we ship the AI credit balance in non-EU markets first (where consumer-protection floor is looser; the PSD2 / ZAG analysis is moot) before expanding to EU, or single-jurisdiction-launch globally?
- **Tentative leaning:** Single global launch, designed to the strictest applicable standard (EU/DE). Sequencing by jurisdiction is operationally complex (gating by user country, different T&C versions, different VAT handling at top-up, different refund mechanics) and creates two surfaces to maintain.
- **Blocking?:** Yes for 14.28 (post-v2).

### App lifecycle and catalog (added in 59)

These gate the [59-app-lifecycle-and-catalog.md](../apps/59-app-lifecycle-and-catalog.md) iterations (14.29–14.35) that replace demo seeding with catalog-driven install/update.

#### OQ-LC-1 — Offline `BOOTSTRAP_SET` membership *[RESOLVED in implementation-plan 14.30]*
- **Where:** [59 §The 0→1 first-run flow](../apps/59-app-lifecycle-and-catalog.md), `packages/shell/src/main/apps/first-party.ts`.
- **Question:** Which first-party apps ship in the binary's offline bundle cache (installed on first run with no network), vs which install on demand from the catalog?
- **Resolution (2026-06-23, revised):** **all bundled first-party apps** install on first run (`BOOTSTRAP_APPS = FIRST_PARTY_APPS`). The earlier curated-five (Notes/Files/Database/Tasks/Calendar) was wrong — every first-party app is *bundled in the binary* (`extraResources`), so all install offline; a curated subset stranded the rest (`code-editor` NotInstalled in the dogfood shell) because the live catalog isn't the default source yet. The catalog is for **updates + third-party**, not for gating bundled first-party apps; a curated offline subset only makes sense once non-bundled apps are catalog-served.
- **Blocking?:** ~~Yes for 14.30~~ — resolved.

#### OQ-LC-2 — Catalog index: single document vs sharded
- **Where:** [59 §The signed catalog index](../apps/59-app-lifecycle-and-catalog.md).
- **Question:** One signed index document, or paginated/sharded once the listing count is large?
- **Tentative leaning:** Single signed document for v2 (listing count is small); shard behind a signed manifest-of-shards (sign per-shard) when it grows.
- **Blocking?:** No (single-document is fine for v2; sharding is a non-breaking later change).

#### OQ-LC-3 — Bundle-cache refresh cadence
- **Where:** [59 §The publish pipeline](../apps/59-app-lifecycle-and-catalog.md) (step 6).
- **Question:** Refresh the `extraResources` bootstrap bundles every shell release (always-recent, larger diffs) vs only on demand (smaller diffs, can drift)?
- **Tentative leaning:** Every release — the cache only needs to be recent enough that first-run isn't badly stale, and the update engine fixes staleness immediately when online.
- **Blocking?:** No.

#### OQ-LC-4 — Dev-catalog mechanism (M5)
- **Where:** [59 §Migration off seeding](../apps/59-app-lifecycle-and-catalog.md) (M5), `packages/shell/src/main/dev/seed-demo-apps.ts` (to be retired).
- **Question:** How does the dev shell get apps once the demo seeder is gone — a `file://` catalog, a `localhost` catalog server, or a `brainstorm-cli dev --watch` re-publisher?
- **Tentative leaning:** `localhost` catalog server reusing the real `CatalogClient`, so dev exercises the production verify path (signature optional in dev).
- **Blocking?:** Yes for 14.35 (M5); not for M1–M4 (dev keeps seeding until then).

#### OQ-LC-5 — App-update rollback policy
- **Where:** [59 §The update engine](../apps/59-app-lifecycle-and-catalog.md), `packages/shell/src/main/apps/installer.ts` (uninstall keeps bundle dirs on disk per-version today).
- **Question:** If a catalog app update is bad, does the shell keep the prior bundle to roll back to, and is rollback user-initiated or automatic on launch-crash detection?
- **Tentative leaning:** Keep the N-1 bundle; user-initiated rollback from the Library row in v2; crash-loop auto-rollback is post-v2.
- **Blocking?:** No (v2 can ship update without rollback).

#### OQ-LC-7 — `.brainstorm` package compression (tar+zstd vs tar+gzip) *[RESOLVED in implementation-plan 14.34]*
- **Where:** [14 §Package format](../apps/14-app-store.md), [59 §14.34](../apps/59-app-lifecycle-and-catalog.md), `main/catalog/brainstorm-package.ts`.
- **Question:** [14](../apps/14-app-store.md) specified the `.brainstorm` archive as tar+**zstd**. zstd needs a runtime the shell can't guarantee; the existing `.bsbundle` already uses tar+**gzip** via Node-core `zlib`. The packer and the client `unpack` must agree on one.
- **Resolution (2026-06-22):** **tar + gzip**, reusing the deterministic `.bsbundle` codec (`main/bundle/bundle-archive.ts` `packBundle`/`unpackBundle` — tar via `bundle-tar.ts` with the zip-slip guard, gzip via node:zlib). `main/catalog/brainstorm-package.ts` forces gzip (not the codec's zstd-preferred default) so any client runtime can decompress. Zero new deps. Landed in 14.34 (pack/unpack/sha256/sign/verify round-trip, +14 tests). Doc 14's "tar+zstd" is superseded.
- **Blocking?:** ~~Yes for 14.34~~ — resolved.

#### OQ-LC-6 — Onboarding hand-off after removing seeding
- **Where:** [59 §Open questions](../apps/59-app-lifecycle-and-catalog.md), [implementation-plan.md Welcome-2](../implementation-plan.md).
- **Question:** A fresh vault now bootstraps the core set offline; the "here are more apps to add" discovery moment now points at the catalog. Does onboarding gain a "browse the catalog" step?
- **Tentative leaning:** Yes, once online — but it's Welcome-2 scope, not 59 scope. Flagged for the Welcome-2 iteration.
- **Blocking?:** No (does not block the catalog iterations; affects onboarding polish only).

#### OQ-SR-1 — FTS5 query failure fallback (mid-typing edge cases)
- **Where:** [implementation-plan.md §9.22](../implementation-plan.md), `packages/shell/src/main/search/search-indexer.ts` (`buildMatchExpression`).
- **Question:** When an FTS5 query the indexer constructs from user input fails (because of a tokenisation edge case the escaper didn't anticipate — e.g., a query that's all-punctuation, a degenerate Unicode sequence, an internal FTS5 version mismatch after a future SQLite upgrade), what should the SearchService do?
- **Options:**
  - (a) Current behaviour — return `[]` for empty / pre-tokenised input; let FTS5 errors propagate as `Error` on real failures. Cheap, safe, but unobservable.
  - (b) Catch + log the error and return `[]` so the typeahead just looks empty. Hides bugs from callers.
  - (c) Fall back to a `LIKE '%...%'` scan against a denormalised title+body sidecar. Always returns *something* but loses BM25 ranking and is O(n).
  - (d) Surface a structured `Unavailable` error so the caller (Tasks app search bar, launcher) can show a "search is unavailable, try again" affordance.
- **Tentative leaning:** (a) for the 9.22.1 preview drop (we already return `[]` from `buildMatchExpression` for the empty-token case, which is the only known failure path); revisit at 9.22.4 (settings reindex panel) once real-world query telemetry shows what else trips it.
- **Blocking?:** No.

#### OQ-NOTIF-1 — `notifications.post` default-minimum vs. user-granted
- **Where:** [implementation-plan.md §7.7](../implementation-plan.md), `packages/shell/src/main/ui/`, `packages/shell/src/main/capabilities/default-grants.ts`, [security/09-security-and-sandbox.md §Capabilities](../security/09-security-and-sandbox.md).
- **Question:** Should `notifications.post` (the capability gating `services.ui.notify`) be a **default-minimum grant** (auto-applied at install, no prompt — parity with `search.read` / `properties.read`'s "benign, universal UX every app needs" argument) or stay **user-granted** (declared in the manifest, granted at install/runtime like any other capability, per security/09's "capabilities are granted by the user, never inferred; default set is `storage.kv`/`intents.dispatch:open`/credentials-self/own-window only")?
- **Options:**
  - (a) **User-granted (current).** Spec-faithful to the documented default-minimum set; a notification reaches the shell's trusted surface (not the app's own window), so consent is defensible. Cost: every app that wants a toast pays a prompt.
  - (b) **Default-minimum.** A transient, dismissible, shell-rendered toast is low-risk and near-universal UX; requiring a prompt for it is friction the `search.read` precedent already judged not worth paying. Cost: widens the inferred-grant set the security doc deliberately keeps minimal; a noisy app can spam the toast region (mitigated by the host's 200/1000-char clamp + the toast TTL, not by rate-limiting yet).
  - (c) **Default-minimum + a shell-side rate limit / per-app mute** so (b)'s spam vector is bounded before the grant is widened.
- **Tentative leaning:** (a) for 7.7 — ship spec-faithful, observe whether first-party apps (a future reminder/automation surface) actually find the prompt friction outweighs the consent value; revisit toward (c) if so (rate-limit is the missing safety before defaulting it on).
- **Update (2026-06-06, settings-overhaul):** stays **(a) user-granted**, but the spam mitigation half of (c) now exists: a **per-app mute** + **do-not-disturb** window enforced at the notify host (see OQ-148). A shell-side rate limit is still unbuilt; defaulting the grant on (b/c) remains the deferred half.
- **Blocking?:** No. 7.7 ships under (a); changing later is a one-line `default-grants.ts` addition + a doc note.

#### OQ-TRAY-1 — Tray rendering (OS-native vs. fancy-menus) + one-shared vs. per-app tray
- **Where:** [implementation-plan.md §7.8](../implementation-plan.md), `packages/shell/src/main/ui/tray-host.ts` + `index.ts`, [shell/33-windows-and-menus.md §Tray menu](../shell/33-windows-and-menus.md), [shell/04-shell.md §System areas](../shell/04-shell.md).
- **Question:** Doc 33 says tray menus are *app-rendered via `fancy-menus`*, not OS-native. 7.8 ships the **OS-native `Tray` + `Menu`** minimum (the `@react-fancy-menus/core` dep is Stage 8; avoid-blocking says ship the plain minimum now, rebuild on the dep). Two sub-questions to settle when that dep lands: (1) does the tray stay OS-native (simpler, fewer moving parts, OS-consistent) or move to a fancy-menus popover surface (richer, themed, but a custom window pinned to the tray icon — a known cross-platform footgun); (2) the v1 model is **one shell-owned tray composed from every publisher's section** — do we ever want **per-app tray icons** (most OSes discourage many; Windows collapses them into the overflow; macOS menubar real-estate is scarce), or is one-composed-tray the permanent answer?
- **Options:**
  - (a) Stay OS-native permanently; one shared composed tray. Simplest, most OS-consistent; loses fancy-menus theming + the doc-33 vision.
  - (b) fancy-menus popover tray when the dep lands; one shared tray. Matches doc 33; adds a pinned-popover window to maintain on 3 platforms.
  - (c) fancy-menus + allow a per-app tray icon for apps that explicitly opt in (rare). Most flexible; most surface area + the multi-icon UX problems.
- **Tentative leaning:** (b) — honour doc 33's app-rendered intent once `@react-fancy-menus/core` is available, but keep **one shared tray** (reject per-app icons; (c) is a v2 conversation at most). The pure `TrayHost` menu model is renderer-agnostic, so the OS-native → fancy-menus swap is an `index.ts`-only change — nothing in the host or the SDK contract moves.
- **Blocking?:** No. 7.8 ships OS-native under (a)'s mechanism; the doc-33 alignment is a Stage-8-gated follow-up.

#### OQ-DM-1 — Single object space + collections vs. per-app entity silos  *[RESOLVED in design — see [21-objects-and-collections.md](../data/21-objects-and-collections.md); implementation gated as plan §9.3.5]*
- **Where:** [21-objects-and-collections.md](../data/21-objects-and-collections.md) (full design); decisions mirrored into [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) §Entity types + [19-properties-and-schemas.md](../data/19-properties-and-schemas.md) §Layered scopes; `entities.db` (9.3.1), the vault-entities aggregator, every first-party app.
- **Question:** Today every app stores its own entities (per-app `kv.json` silos that the vault-entities service merely *aggregates*), and each entity has exactly one hardcoded app-owned type (`io.brainstorm.notes/Note/v1`, `brainstorm/Task/v1`, …). This is inflexible: an object can't be in two apps' worlds, types can't be user-defined, "add this note to Tasks" is impossible. Should Brainstorm move to a **single shared object space** where an object is opened/viewed *by type/collection*, an object may belong to **many collections**, and collection membership contributes that collection's property schema (inheritance on add) — a shared Relations/Types/Collections model, extended to multi-membership?
- **Options:**
  - (a) Status quo — per-app entity stores, single hardcoded type per entity.
  - (b) Single `entities.db` object space (the 9.3.1 substrate); per-app types become **seeded Collections with schemas**; apps become **views/editors over collections**; an object may join many collections (M:N); effective property set = union of its collections' schemas. Keep one *primary* type for Block Protocol `entityTypeId` interop, or go fully multi-type and bridge BP at export.
  - (c) Hybrid — single space + collections, but one privileged type per object (closest to Block Protocol's single `entityTypeId`).
- **Resolution (design landed 2026-05-15 — [21-objects-and-collections.md](../data/21-objects-and-collections.md)):** **single shared object space + Collections, with one Block-Protocol `type` per object.** The genuinely-open sub-decisions are now decided: (1) **cardinality** — one `type` per object (BP `entityTypeId` + Yjs-doc identity, the existing `entities.type` column, unchanged); multi-typing is **Collection membership**, not multiple types — option (c) reframed, zero BP divergence, zero `entities.db` schema change. (2) **Collection = `brainstorm/List/v1`** promoted product-wide (source + `members` + views; Query/Manual/Hybrid per database/10); a schema-bearing Collection owns `collection`-scoped PropertySchema overlays; "inherit on add" = the effective-schema composition the entities service already does (19). (3) **Membership** is M:N, authoritative on the Collection (per 30), reverse-indexed. (4) **Single store** — `entities.db`; per-app `kv.json` silos removed; apps become collection views; the aggregator bridges un-migrated apps then is deleted. (5) **Migration incremental + backward-compatible** — seed Collections for existing types (1:1, nothing breaks), then migrate apps off `kv.json` one per iteration (folds into each app's pending write-half), then multi-membership UX. (6) **Universal rich-text body** (user directive 2026-05-15): every object has a canonical, lazy `body` `Y.XmlFragment` (the reserved 9.3.2b `getYFragment` name) — rich text is intrinsic to *every* object, not a per-type property; apps are workflows that choose which properties to edit + whether to surface the body editor (Notes = body-primary; Tasks/Bookmarks = property-primary but the body is still there). One `entityType` unchanged; no BP/schema/migration impact (the body rides the existing 9.3.2b transport; the in-flight per-app property migrations are not reworked). See [21 §Universal rich-text body](../data/21-objects-and-collections.md). (7) **Layouts = the third dimension** (already designed — [shell/27-layouts.md](../shell/27-layouts.md) + Stage 8 form-designer): a workflow = collection × effective schema × effective layout (per context) × behaviors. Layouts are data, scoped under the *same* layered-overlay precedence as PropertySchema (`entity > collection > type > user > org > app-default`); "adjust layout per entity" = the existing `{kind:"entity"}` Layout scope; the OQ-DM-1 `collection` scope makes `{kind:"collection"}` Layouts concrete. No new machinery — see [21 §Layouts — the third dimension](../data/21-objects-and-collections.md). Sequencing: SH-8a shipped first (forward-compatible); the remodel is plan §9.3.5, behind this design.
- **Blocking?:** Was yes for the §9.3.5 remodel — **design now landed** (this resolution + the new doc + mirrored decisions in 05/19 satisfy stage-gating). Implementation may proceed against §9.3.5's ladder. Not blocking SH-8a (already shipped, forward-compatible).

---

### Account recovery & web-style authentication

Raised by [51-account-recovery-and-web-auth.md](../security/51-account-recovery-and-web-auth.md). That doc takes positions (the authentication-≠-custody reframe, the Key Custody Ladder, passphrase-as-first-class-unlock, Recovery Kit + Recovery Health) as **Decisions**; these are the sub-points left genuinely open.

#### OQ-AR-1 — Social / threshold recovery scheme
- **Where:** [51 §The Key Custody Ladder (Rung 2)](../security/51-account-recovery-and-web-auth.md).
- **Question:** Shamir secret-sharing over the master key vs. per-guardian public-key wraps + an M-of-N policy record; is the guardian set the user's own devices only, trusted contacts' pubkeys, or both; how does guardian revocation work without re-keying everything.
- **Tentative leaning:** Per-guardian wraps + signed M-of-N policy record (consistent with 16's "membership is data, no re-key" stance) rather than raw Shamir; guardians = own devices ∪ contact pubkeys.
- **Blocking?:** No for v1 (Rung 2 is v1.x); design should land in v1.

#### OQ-AR-2 — Recovery Kit file format
- **Where:** [51 §Recovery Kit instead of a bare phrase](../security/51-account-recovery-and-web-auth.md).
- **Question:** Signed `.bsbundle`-adjacent file vs. plain printable PDF+QR vs. both; does it embed the BIP39 word list verbatim or a wrapped variant; cross-tool interop expectations for the embedded phrase.
- **Blocking?:** No (v1 feature, not a stage gate).

#### OQ-AR-3 — Argon2id parameters for the vault / account passphrase
- **Where:** [51 §The passphrase people actually wanted](../security/51-account-recovery-and-web-auth.md). Merges/supersedes OQ-114.
- **Question:** Single hardness profile vs. device-class-tuned; minimum entropy guidance; the rewrap-on-parameter-upgrade flow when defaults are raised in a later release.
- **Blocking?:** No.

#### OQ-AR-4 — Passkey-PRF as a custody factor vs. authentication-only
- **Where:** [51 §Passkeys](../security/51-account-recovery-and-web-auth.md).
- **Question:** Promote WebAuthn-PRF-derived secrets to a first-class Rung-1/3 custody factor, or keep passkeys authentication-only? PRF support is uneven across authenticators/OSes; a passkey the user *believes* protects their data but cannot derive a key is a footgun.
- **Tentative leaning:** Authentication-only until PRF can be capability-detected reliably, then opt-in custody with precise disclosure.
- **Blocking?:** No (v2).

#### OQ-AR-5 — Recovery-drill cadence and intrusiveness
- **Where:** [51 §Recovery Health](../security/51-account-recovery-and-web-auth.md).
- **Question:** Fixed interval vs. post-N-sessions vs. risk-weighted by data volume/value vs. only-on-material-change. Must measurably reduce P1 without becoming dismissed-on-sight noise.
- **Blocking?:** No.

#### OQ-AR-6 — Vault passphrase: every-open vs. new-device/recovery-only
- **Where:** [51 §The passphrase people actually wanted](../security/51-account-recovery-and-web-auth.md).
- **Question:** Is a set vault passphrase required at every vault open (true "password to log in", phishing-resistant, more friction) or only on a new device / after OS-keystore loss (keystore primary, passphrase recovery)? Per-vault user choice and its default.
- **Tentative leaning:** Per-vault choice; default = keystore-primary, passphrase prompted on new device / keystore loss; "require every open" available for users who want the password feel.
- **Blocking?:** No.

#### OQ-AR-7 — Consumer-side Rung-4 escrow: offered to individuals at all?
- **Where:** [51 §The Key Custody Ladder (Rung 4)](../security/51-account-recovery-and-web-auth.md), [51 §What we explicitly refuse](../security/51-account-recovery-and-web-auth.md).
- **Question:** Do we offer escrowed/"true reset" recovery to individual consumers as an explicit opt-in at all, or restrict escrow strictly to org-managed identities? If offered to individuals: exact disclosure copy and re-confirmation cadence so it can never be a silent E2E downgrade.
- **Tentative leaning:** Org-identity-only for v2; revisit individual opt-in only with very loud, re-confirmed disclosure.
- **Blocking?:** No (v2).

#### OQ-BP-1 — `@blockprotocol/type-system` WASM in the shell-main runtime  *[RESOLVED in implementation-plan Stage 9.3.3.3]*
- **Where:** [implementation-plan §9.3.3](../implementation-plan.md) · `packages/shell/src/main/bp/type-system-smoke.test.ts`.
- **Question (at 9.3.3.1):** The package ships a Rust→WASM core loaded via an ES module bootstrap. Does the WASM instantiate in the shell-MAIN context (`Electron-main` is Node-y), or do we need to push validation into the dashboard renderer over an IPC hop?
- **Resolution:** **(a) — WASM loads in main**. The 5-test smoke at `bp/type-system-smoke.test.ts` confirms `validateVersionedUrl` / `validateBaseUrl` work under bun + vitest (the same Node-compatible runtime Electron-main hosts). The BP graph router can call the validator inline (lazy-imported per OQ-BP-1's perf concern). Decision: validator lives main-side; the renderer-worker fallback is NOT needed.

#### OQ-BP-2 — BP entity wire shape + type-id changes on update
- **Where:** [implementation-plan §9.3.3](../implementation-plan.md) · `packages/shell/src/main/bp/graph-router.ts`.
- **Question:** v1 surfaces BP entities as a minimal `{entityId, entityTypeId, properties, updatedAt}` wire shape — the BP 0.3 spec's full entity schema is a structural-graph form (`metadata.recordId.{entityId,editionId}`, `linkData`, draft state, etc.) we don't model. What does v1 BP-conformant blocks actually consume? And the related: BP `updateEntity` carries `entityTypeId`; our entities service has no type-change verb, so a differing `entityTypeId` silently no-ops the type field today. Is that the right call vs. rejecting as `INVALID_INPUT`?
- **Tentative leaning:** Keep the minimal shape for v1, ship a compatibility shim if a real-world BP block trips on it; reject `entityTypeId`-on-update mismatches with `INVALID_INPUT` once a real test case exists (defensible "no silent contract change" stance).
- **Blocking?:** No (v1 ships the minimal shape now; the OQ documents the deviation).

#### OQ-BP-3 — BP `uploadFile` + `linkData` (link entities) deferrals
- **Where:** `packages/shell/src/main/bp/graph-router.ts` (returns `NOT_IMPLEMENTED` for both).
- **Question:** Two related v1 deferrals on the BP Graph module: (a) `uploadFile` with a `file: Blob` requires a chunked-upload protocol over the 9.5.2 transport — Blobs don't structured-clone cleanly across opaque-origin sandboxes, and the 9.10a chunked-upload service is broker-only. (b) `uploadFile` with `url: string` requires the Net-1 broker (network fetch with SSRF floor). (c) `createEntity` with `linkData` requires modelling BP link-entity rows — our `links` array on the entity row is the same data, but the shape mapping isn't 1:1. When do (a)/(b)/(c) ship?
- **Tentative leaning:** (a) and (c) land alongside Notes 9.4-tail / inline-block work (a chunked-postMessage upload path is its own design; link-entities ride on the existing `links` array but need a wire-shape decision). (b) gates on Net-1. None block v1's "block can read/write entities" usefulness — they're files + edges.
- **Blocking?:** No.

#### OQ-BP-4 — BP `queryEntities` operation language + subgraph traversal
- **Where:** `packages/shell/src/main/bp/graph-router.ts`.
- **Question:** v1 honours only `{operation: {entityTypeId}}` and returns a flat-list pseudo-subgraph (`{roots, vertices: {<id>: [entity]}, edges: {}}`). BP 0.3 `operation` is a nested boolean structural query (multi-field where, multi-sort, paging cursor), and `graphResolveDepths > 0` triggers transitive link traversal. How much of BP's operation surface do we map onto our `EntityQuery` shape (which is richer than what we expose to BP), and when does subgraph traversal land?
- **Tentative leaning:** Map BP's flat where-clauses onto `EntityQuery.where` (close enough — both are AND-of-property-predicate at the leaf); `graphResolveDepths > 0` is a separate 9.3.3.4 / 9.13.x iteration (the Graph app's pattern-matcher is the natural home for the depth walk). Cursor paging rides on the existing query gate. Until then, `NOT_IMPLEMENTED` for non-trivial operations is honest.
- **Blocking?:** No.

#### OQ-BP-5 — BP Hook overlay: cross-iframe DOM + focus/IME/Escape semantics
- **Where:** `packages/shell/src/main/bp/hook-router.ts` (v1 returns `NOT_IMPLEMENTED` for any real registration).
- **Question:** BP Hook lets a block ask the embedder to paint a host-owned editor (Lexical for `text`, file-picker for `image`/`video`) into a DOM node OWNED BY THE BLOCK'S IFRAME. Cross-iframe DOM refs don't structured-clone across opaque-origin sandboxes, so the BP-spec literal `node: HTMLElement` payload can't reach the host as a working ref. Real implementation needs (a) a geometry-side-channel where the block emits node rect / size and the host paints an `<BpHookOverlayLayer>` outside the iframe at iframe-relative coordinates, (b) channel-id-gated overlay paint (only paints when the requesting `entityId` + `hookId` originate from a known transport), (c) a focus model — a host-painted Lexical over an opaque-origin iframe absorbs keyboard events, so the iframe's block sees nothing, which is right for "deferred rendering" but the focus-ring + Escape-to-exit story needs a UX call. IME path likewise.
- **Tentative leaning:** Forward iteration (post-9.3.3 polish). v1 is honest: `NOT_IMPLEMENTED` for every real `hook({node: <obj>})` so blocks fall back to their own rendering. Destroys (`node: null`) are idempotent OK. When the overlay UI ships, it's an `<BpHookOverlayLayer>` SDK primitive (mirrors `<BpBlockMount>`) consumers paint in their block-embed view.
- **Blocking?:** No.

---

## Native acceleration — `OQ-NAPI-1` … `OQ-NAPI-3`

#### OQ-NAPI-1 — Prebuilt-binary distribution policy
- **Where:** [implementation-plan §Native acceleration](../implementation-plan.md) · `packages/native/` · `13.1` electron-builder pipeline.
- **Question:** How do per-platform `.node` binaries reach end users — (a) vendored in the `@brainstorm/native` workspace package and committed to git, (b) published as GH-release artifacts and pulled by `prebuild-install` at `bun install` time, (c) hybrid (committed for the build-host triple, downloaded for cross-targets), (d) bundled at the electron-builder step and never shipped through `bun install`? The choice trades repo size + reproducibility (a) against install latency + bandwidth (b) against complexity (c/d). Affects: signed-build CI, third-party-app install path, dev-machine bootstrap.
- **Tentative leaning:** **(d) bundle at electron-builder.** The native binary is shell-internal (no third-party app reaches it directly — they go through the broker), so it never needs to be a public npm artifact. `bun install` doesn't need a `.node` for the dev path either (the dev machine runs `napi build` once). This keeps the repo small, avoids GH-release-artifact CI fragility, and the binary inherits the electron-builder code-signing pass for free.
- **Blocking?:** Yes — gates NAPI-1's prebuilt-CI step (NAPI-1b). The local foundation (current state) doesn't depend on it.

#### OQ-NAPI-2 — Bundle-size budget impact
- **Where:** [implementation-plan §Native acceleration](../implementation-plan.md) · `.size-limit.json`.
- **Question:** The Rust crate + bundled crypto libs add a per-platform `.node` binary (~1–3 MB typical for `argon2` + `ed25519-dalek` + `chacha20poly1305`). `size-limit` enforces JS-bundle budgets in `.size-limit.json` today; do we (a) add a native-binary budget category that's enforced per-platform, (b) treat it as out-of-scope for `size-limit` and track it in CI separately, (c) include it in the existing shell-bundle budget?
- **Tentative leaning:** (b) — `size-limit` is a frontend-payload tool; a native binary is installer footprint, which `electron-builder` already reports. Add a CI step that records and trends the binary size per-platform; raise a soft alert if it grows >25% in one PR.
- **Blocking?:** No.

#### OQ-NAPI-3 — `@noble/*` fallback retention after NAPI-3 *[RESOLVED in implementation-plan NAPI-3e, 2026-06-16 → (a)]*
- **Resolution:** (a) — `@noble/{hashes,ciphers,curves}` dropped from `packages/shell/package.json` on NAPI-3e land; the shell crypto suite is the Rust addon end-to-end (`grep @noble packages/shell/src` empty). `@noble` is retained only as a `packages/native` devDependency — the byte-identity parity oracle the per-primitive contract tests check against. No JS runtime fallback (a platform without a prebuilt is a platform `electron-builder` can't ship at all).
- **Where:** [implementation-plan §Native acceleration (NAPI-3)](../implementation-plan.md) · `credentials/*.ts` · `sync/envelope-seal.ts`.
- **Question:** Once NAPI-3 lands the full Rust crypto suite, do we (a) delete `@noble/{hashes,ciphers,curves}` entirely (slimmer deps, one audit boundary), or (b) keep them as a runtime fallback for platforms the prebuilt-binary matrix doesn't cover (e.g. some Linux distros, FreeBSD, Asahi nightlies pre-arm64 prebuild)? (b) means maintaining two crypto implementations that must produce byte-identical outputs forever.
- **Tentative leaning:** (a) — drop `@noble/*` on NAPI-3 land. Brainstorm is an Electron desktop app; we ship binaries through `electron-builder`, so any platform we don't have a prebuilt for is a platform we can't ship at all. A "JS-fallback" tier is a phantom requirement.
- **Blocking?:** No (decision blocks NAPI-3 close-out, not start).

---

## Repo split & source licensing — `OQ-REPO-1` … `OQ-REPO-3`

(Added 2026-05-27. Near release the single private monorepo splits in two: **`docs/` stays in the private repo** (design source of truth, planning, OQs, internal review notes), **`packages/` + `apps/` + build tooling move to a public organisation repo** that becomes source-available at some point. None blocking pre-release; positions need to be taken before the split itself executes.)

#### OQ-REPO-1 — When does the split execute, and how is `docs/` referenced from code afterwards? *[RESOLVED 2026-06-25 — split executed via the `brainstorm-os` org migration, ahead of v1 GA]*
- **Where:** [implementation-plan.md](../implementation-plan.md) Stage 13 (signed-bin shipping) / Stage 14 release readiness; [CLAUDE.md](../../CLAUDE.md) "Docs map".
- **Question:** Which release milestone triggers the split — (a) at the first public binary (Stage 13 signed-build ship); (b) at v1 GA; (c) before v1 GA but after the last `iteration-chores` cycle that touches public-surface code? And after the split, do the `docs/` links from code (`CLAUDE.md`, source-tree READMEs, doc-comments referencing `docs/...`) stay as **broken-from-public-view** relative paths (only resolvable inside the private repo) or rewrite to absolute URLs against the public-mirror site (`docs.brainstorm.app`)?
- **Why it matters:** Affects the entire public-repo onboarding experience — a contributor cloning the public code repo and reading `CLAUDE.md` will hit dead `docs/*` links unless rewritten. Also affects how `iteration-chores` reviews work post-split (the reviewer needs `docs/` access to do design review).
- **Tentative leaning:** (c) split **before** v1 GA so the public binary's first launch coincides with a fully public code repo; rewrite `docs/...` references in the public tree to absolute `docs.brainstorm.app/...` URLs at split-time via a one-shot codemod, keep the private repo's copies as-is. Reviewers continue working in the private repo (which has both halves via a git submodule or sibling clone, decided in this OQ).
- **Blocking?:** Non-blocking until ~2 weeks before the chosen release milestone; resolved as the split planning rung begins.
- **Resolution (2026-06-25):** **Timing = (c)** — the split executed well ahead of v1 GA, via a migration to the `brainstorm-os` GitHub org. **`docs/` reference handling departs from the codemod leaning:** the design `docs/` are **not** rewritten to absolute URLs and are **not** shipped publicly at all — they stay private inside the `harness` repo. Each public repo carries a **standalone public-facing README** authored with full GitHub URLs (no dead relative `docs/*` links), and `CLAUDE.md` in a public tree is a **symlink into the private harness** (so it resolves for the team, is absent for public clones — no broken-link onboarding). Reviewers keep both halves via the sibling working-tree layout. The public **docs portal** (`docs.getbrainstorm.online`, `Site-2`) is user-facing product documentation, deliberately distinct from the internal design `docs/`. Resolves with OQ-REPO-2/3.

#### OQ-REPO-2 — What exactly moves, what stays, and how do the two repos stay in sync? *[RESOLVED 2026-06-25 — fresh per-repo split; `harness`/`cloud` private, `shell`/`sync`/`site`/`docs` public]*
- **Where:** repo root layout; [CONTRIBUTING.md](../../CONTRIBUTING.md); [docs/README.md](../README.md) (if it exists post-split).
- **Question:** Confirm the split line. Initial position: **stays private** = `docs/` (all design, OQs, implementation-log, review notes), `docs/_review/`, internal seeders/scripts that reference unreleased plan rungs. **Goes public** = `packages/*`, `apps/*`, `tools/*` (minus any seeder that embeds plan-leak content), root `package.json`, `tsconfig.json`, `biome.json`, `.size-limit.json`, `CLAUDE.md` (rewritten — see OQ-REPO-1), the public `CONTRIBUTING.md`, `LICENSE`. How is sync managed — (a) public repo is the source of truth and the private repo pulls code via git subtree / submodule; (b) private repo stays the source of truth and pushes filtered subsets to public via a CI publisher; (c) hard split with manual cherry-pick at release boundaries only?
- **Why it matters:** (a) and (b) keep the two repos coupled per-commit; (c) decouples but creates a maintenance/credit-trail tax. Affects the `iteration-chores` workflow and how `git blame` resolves for public contributors.
- **Tentative leaning:** (b) — private remains source of truth; a CI publisher writes the filtered tree to the public org repo on every merge to `main` (preserving authorship + commit messages, redacting anything that grep-matches a small denylist of internal-only tokens). The public repo is read-mostly during the source-available phase (issues + PRs accepted, but merges land via the publisher round-trip). Keeps the dev experience identical for the team while giving the public a real, complete git history.
- **Blocking?:** Non-blocking; resolves alongside `OQ-REPO-1` ahead of the split.
- **Resolution (2026-06-25):** Departs from the (b) CI-publisher model in favour of a **fresh-repository split**. Six independent sibling repos now live in the `brainstorm-os` org (the local `brainstorm/` working dir holds them as siblings — dir==repo, not a nested monorepo). **Public:** `shell` + `sync` (AGPL-3.0 per OQ-REPO-3), `site` + `docs` portal (MIT). **Private:** `harness` (the design `docs/`, OQs, implementation-plan + log, `_review/`, internal seeders — the split line for "stays private" holds) and `cloud` (proprietary control plane). Each public repo is its **own repository with its own history** (not a filtered subtree of a private monorepo), so there is **no CI publisher round-trip** — the team commits in the sibling working trees directly. A pre-publish **history scrub** removed PII from the public repos before they went public. Issues/PRs accepted natively on each public repo. Resolves with OQ-REPO-1/3.

#### OQ-REPO-3 — Source-available license choice and timing of the public-source transition *[RESOLVED 2026-06-25 — AGPL-3.0-or-later]*
- **Where:** root `LICENSE` (post-split); [foundations/01-vision.md](../foundations/01-vision.md) (positioning); [platform/46-marketing-and-promotion.md](../platform/46-marketing-and-promotion.md) (audience messaging).
- **Question:** The code repo goes public **with a source-available license at some point** after the repo split. Two sub-decisions:
  1. **License choice** — (a) BUSL (Business Source License, time-delayed Apache/MIT — competitor-restrictive for N years, then converts to permissive); (b) FSL (Functional Source License, similar shape, 2-year MIT/Apache conversion, simpler than BUSL); (c) Elastic License v2 (no time conversion); (d) custom source-available terms.
  2. **Timing** — does the repo go public-as-source-available **at the same moment as the split** (one event), or is there an intermediate **public-but-no-source phase** where the code repo exists publicly but only as compiled releases until the license is finalised?
- **Why it matters:** Affects what competitors can do with the code, what contributors can do with it, how it's positioned in marketing (`46-marketing-and-promotion.md`), and how the catalog's first-party-only trust signals interact with anyone forking. Time-delayed permissive (BUSL / FSL) preserves both "you can audit and learn from it" and "you can't run a competing hosted offering for N years"; non-converting (Elastic v2) gives stronger long-term control but is less friendly to the open-source-ecosystem audience segment.
- **Tentative leaning:** (1) **FSL with a 2-year Apache-2.0 conversion** — simplest legible shape, well-understood by the audience segments we care about, time-conversion preserves the "we'll be properly open eventually" signal without giving competitors a Day-1 head start. (2) **Single event** — split and source-available announcement land together, no half-public limbo, so the marketing beat is clean.
- **Blocking?:** Non-blocking technically; the position is **announce-blocking** (no public communication of "the code is on GitHub" can go out before the license is chosen). Resolve alongside OQ-REPO-1/2.
- **Resolution (2026-06-25):** (1) **AGPL-3.0-or-later**, not FSL — a reversal of the tentative non-compete leaning. The `app` (shell) and `sync` repos ship under AGPL-3.0; `cloud` stays Proprietary, `site`/`docs-site` stay MIT. Rationale: a real OSI-approved copyleft license positions Brainstorm as genuinely open source, and AGPL's network-use clause forces any hosted fork to publish its server-side source. The trade-off accepted: no 2-year non-compete window — a competitor may run a hosted Brainstorm from day one, subject to the copyleft source-disclosure obligation. (2) Timing unchanged — single event, license lands with the split.

---

### Asset subsystem (encrypted binary files: favicon / cover / uploads)

Opened by the bookmark favicon/cover work — the first consumer of a synced, encrypted, shareable binary-asset store (`packages/shell/src/main/assets/`). Part A (encrypted local store + `brainstorm://asset` protocol + preview-sourced favicon/cover) is built; these gate Part B (sync + sharing + GC).

#### OQ-236 — Asset content-addressing vs blind-relay equality leak
- **Where:** `packages/shell/src/main/assets/asset-store.ts`, `asset-dek-store.ts`.
- **Question:** Assets use a **per-asset random DEK** (chosen) rather than convergent content-addressing. Convergent encryption (hash plaintext → derive key) would dedupe identical favicons across hundreds of bookmarks into one blob, but identical plaintext → identical ciphertext leaks *equality* to the structurally-blind sync relay, which could fingerprint *which sites* a user bookmarked from ciphertext alone. A local-only `content_hash` (plaintext sha256) is kept as a dedupe hint that never crosses the wire; the on-disk filename is the random `assetId`.
- **Why it matters:** Trades cross-reference encrypted-blob storage dedupe (a few hundred KB of duplicate favicons worst-case) for the blind-relay guarantee.
- **Tentative leaning:** Keep per-asset random keys. Revisit a "convergent-within-trust-boundary" scheme only if storage waste is measured to bite.
- **Blocking?:** No — resolved in Part A; recorded for the Part-B sync review.

#### OQ-237 — `brainstorm://asset` access enforcement on the protocol path
- **Where:** `packages/shell/src/main/assets/serve-asset.ts`; the protocol handler in `packages/shell/src/main/index.ts`.
- **Question:** Part A gates serving on "an unlocked vault session exists" (without the master key nothing decrypts) — matching the existing `cover`/`app-file` handlers that serve any vault image to any renderer. Should the fuller subsystem enforce **owner-graph reachability** (the requesting frame's app must hold `entities.read` for an entity that references the asset, via `asset_refs` + `RendererIdentityRegistry` + the `CapabilityLedger`), or mint **short-lived signed asset-URL tokens** via an `assets.read` broker call?
- **Why it matters:** Assets are shareable across members; cross-app leakage of a referenced asset is a small confidentiality gap once apps embed each other's content.
- **Tentative leaning:** Owner-graph reachability if frame→app mapping on `protocol.handle` proves reliable; signed-token fallback otherwise.
- **Blocking?:** No for Part A (matches existing posture); resolve before assets are shared cross-app.

#### OQ-238 — Does `network.preview` implicitly authorize `assets.bind`?  *[RESOLVED in implementation-plan Asset-B4, 2026-07-01 — no separate cap; binding folds into entity-write]*
- **Where:** `packages/shell/src/main/assets/` (the Part-B bind method); `apps/*/manifest.json`.
- **Question:** Binding a preview-minted asset to an arbitrary entity id is an authority the preview cap arguably shouldn't silently confer. Separate `assets.bind` cap, or folded into `network.preview`?
- **Tentative leaning:** Separate `assets.bind` cap.
- **Resolution:** **There is no bind *verb* to authorize — binding is derived, not requested.** `asset_refs` is now written implicitly by the entities service: after a committed entity create/update/delete it scans the row's properties for `brainstorm://asset/<id>` URLs and reconciles the refs (`derive-asset-refs.ts` + `reconcileAssetRefs`, shell PR #73). An app never calls a bind method — it authorizes the reference by writing the property, which the **entity-write capability it already holds** governs. So no separate `assets.bind` cap and nothing extra folded into `network.preview`. Rationale: (1) an explicit bind cap is forgeable-by-omission — an app could store the URL without ever binding, leaving `asset_refs` (which asset-DEK re-homing, GC reachability, and sync all read) silently empty; implicit derivation can't be skipped and self-heals on the next write. (2) The bind confers no authority the writer lacks — the reconciler only ever binds assets **already stored locally** (dangling/remote ids are filtered out), so it can't be used to claim or reach another app's asset. (3) It matches the existing posture where reachability is a property of the data, not a grantable verb. Cross-app *read* access to a referenced asset remains the separate concern tracked in OQ-237; orphan reap in OQ-239.
- **Blocking?:** No — gated Part B (bind + GC). Resolved.

#### OQ-239 — Orphan-asset TTL for preview-minted assets
- **Where:** `packages/shell/src/main/assets/asset-store.ts` (`reapOrphans`, `listUnboundCreatedBefore`).
- **Question:** Preview stores favicon/cover as unbound orphans before the user saves; a save will `bind` them (Part B), an unsaved preview leaves orphans. What TTL before reap, and reuse the `upload-session` idle-reap discipline?
- **Tentative leaning:** Mirror the upload-session reaper; a generous TTL (hours).
- **Blocking?:** No — Part B. Until the reaper is wired, orphans accumulate (known debt; bounded by favicon size).

#### OQ-240 — General file-store encryption gap  *[RESOLVED in implementation-plan §Media-blob at-rest, 2026-06-14]*
- **Where:** `packages/shell/src/main/files/files-service.ts`, `covers/covers-handlers.ts`, `workers/storage/upload-session.ts`.
- **Question:** The new asset store is encrypted from byte one, but the **existing** file/blob stores still write **plaintext** blobs via `node:fs.writeFile`; at-rest SQLCipher encryption today covers only the SQLite DBs. The user accepted tracking this separately rather than blocking the bookmark work.
- **Why it matters:** Self-hosted/our backup endpoints + device theft expose plaintext file blobs that aren't the new asset store.
- **Resolution:** The three content-addressed media stores (**covers `<vault>/covers/`, icons `<vault>/icons/`, wallpapers `<vault>/dashboard/wallpapers/`**) now encrypt their blobs at rest under a deterministic **media key derived from the vault master key** (HKDF, same shape as the per-DB at-rest keys) — `main/assets/vault-media-crypto.ts` seals each blob `MAGIC || nonce || ciphertext` (XChaCha20-Poly1305, AAD-bound to `<domain>:<filename>`); the `brainstorm://cover|icon|wallpaper` serve path decrypts on read (`serve-media.ts`); a one-time idempotent open-time migration re-seals legacy plaintext files (`vault-media-migrate.ts`). The URL schemes + content-addressing are unchanged (no consumer churn). Unlike the `AssetStore` (random per-asset DEKs, for blind-sync blobs) these stay local-only + content-addressed, so a single derived key is the right fit. The Files-app upload path (`files-service.ts`) already routes through the encrypted `AssetStore`; `upload-session.ts` is the remaining worker-side surface to confirm.
- **Blocking?:** No.

---

### Connector framework (added in 56)

#### OQ-CN-1 — `fieldMap` / `SyncMapping` schema flexibility  *[RESOLVED in implementation-plan Connector slice]*
- **Where:** [56-connector-framework.md](../apps/56-connector-framework.md), [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).
- **Question:** Is the external-field → property mapping a fixed connector-declared map, or a user-editable mapping UI in v1?
- **Options:**
  - (a) Connector ships a default `fieldMap`; Settings exposes overrides later.
  - (b) Full user-editable mapping UI in v1.
- **Resolution:** **(a) — the connector ships a default `fieldMap` baked into its manifest; the engine applies it verbatim.** User-editable overrides are a post-slice Settings surface. The `SyncRunner` reads `mapping.fieldMap` and applies it through a small pure `applyFieldMap`; making it user-editable later is purely additive (the same field already lives on the `SyncMapping/v1` entity).
- **Blocking?:** Was yes — gated the Connector-4 sync engine. Resolved at the leaning.

#### OQ-CN-2 — OAuth redirect mechanism  *[RESOLVED in implementation-plan Connector slice]*
- **Where:** [56-connector-framework.md](../apps/56-connector-framework.md), [29-credentials-storage.md](../security/29-credentials-storage.md).
- **Question:** Ephemeral loopback `http://127.0.0.1:<port>` (works everywhere, firewall-sensitive) vs. a registered `brainstorm://oauth/...` custom scheme (clean, OS-registration-dependent)?
- **Options:**
  - (a) Loopback primary, custom-scheme fallback.
  - (b) Custom-scheme primary.
- **Resolution:** **(a) — ephemeral loopback `http://127.0.0.1:<ephemeral>/callback` is the primary redirect; the `brainstorm://oauth/<connector>` custom scheme is a registered fallback.** Loopback works on every desktop OS without protocol registration; the shell binds `127.0.0.1:0` single-shot with a hard timeout and constant-time `state` validation, and always closes the server. The redirect provider is an interface so the custom-scheme arm can be wired without touching the broker.
- **Blocking?:** Was yes — gated the Connector-2 OAuth broker. Resolved at the leaning.

#### OQ-CN-3 — Two-way conflict UX  *[RESOLVED in implementation-plan Connector-5, 2026-06-11 — (b) LWW with a per-mapping override]*
- **Where:** [56-connector-framework.md](../apps/56-connector-framework.md).
- **Question:** When `two-way-merge` can't auto-resolve, do we queue for the user, last-writer-wins, or block the mapping?
- **Options:**
  - (a) Queue + a conflicts view in the connector app.
  - (b) Last-writer-wins.
  - (c) Block the mapping until resolved.
- **Tentative leaning:** (a) queue + conflicts view.
- **Resolution (Connector-5, 2026-06-11):** **(b) last-writer-wins with a per-mapping prefer-local / prefer-remote override** — the existing `conflictPolicy` field IS the override (`vault-wins` = prefer local, `external-wins` = prefer remote, `two-way-merge` = LWW by timestamp: remote `pull.cursorField` vs the entity's `updatedAt`; an unknown remote timestamp resolves remote). Rationale for departing from the (a) leaning: the queue-plus-conflicts-view needs a conflicts surface no connector app has yet; LWW with an explicit per-mapping preference is deterministic, ships inside the engine, and the queued-conflicts UX layers on top later **without changing the mapping contract** (richer field-level merge stays v2). Change detection is content-based (`pushedState`/`pulledState` sync-point states), not clock-based, so the LWW comparison only arbitrates genuinely both-sides-changed resources.
- **Blocking?:** ~~Gates Connector-5.~~ Resolved.

#### OQ-CN-4 — Token refresh failure / revoked-upstream handling  *[RESOLVED in implementation-plan Connector slice]*
- **Where:** [56-connector-framework.md](../apps/56-connector-framework.md), [29-credentials-storage.md](../security/29-credentials-storage.md).
- **Question:** On a failed shell-side token refresh (or upstream revocation), silent disable + notify, or block sync with a banner?
- **Options:**
  - (a) Disable the mapping, surface in Settings, notify once.
  - (b) Block + persistent banner.
- **Resolution:** **(a) — on refresh failure the broker flips the `ConnectorAccount` `authState` to `expired`, the affected mappings stop firing, the state surfaces in Settings, and the user is notified once** (no notification storm on every scheduled retry). Revoke deletes the Tier-2 token and flips `authState` to `revoked`.
- **Blocking?:** Was yes — the Connector-2 refresh path needed a defined posture. Resolved at the leaning.

#### OQ-CN-5 — Typed long-lived-socket channel for streaming connectors
- **Where:** [56-connector-framework.md](../apps/56-connector-framework.md), [53-mailbox.md](../apps/53-mailbox.md) (OQ-MB-2).
- **Question:** Should the framework expose a typed long-lived-socket channel (IMAP IDLE, Slack RTM), or is HTTP + webhook sufficient for v1?
- **Tentative leaning:** HTTP + webhook in v1; Mailbox's brokered socket is the one exception until OQ-MB-2 generalizes it.
- **Blocking?:** No — v2 question. The connector mainline this slice builds is HTTP + OAuth + `SyncMapping`; Mailbox's socket is deliberately deferred to its own slice.

#### OQ-CN-6 — Marketplace trust tier for connectors
- **Where:** [56-connector-framework.md](../apps/56-connector-framework.md), [32-store-verification.md](../apps/32-store-verification.md), [47-marketplace.md](../apps/47-marketplace.md).
- **Question:** Do connectors (high egress + token custody) require a stricter review lane than ordinary apps?
- **Tentative leaning:** Yes — a dedicated connector review tier.
- **Blocking?:** No — gates Connector-8 (starter set + Marketplace content-kind), out of this slice.

---

### Agent harness (added in 62)

#### OQ-AH-1 — App-catalog scope in the context preamble
- **Where:** [62-agent-harness.md](../platform/62-agent-harness.md) §A.2, [55-agent-app.md](../apps/55-agent-app.md).
- **Question:** Does the broker-assembled app catalog list **all** installed apps (the agent can *propose* enabling a tool — good discoverability) or **only** those whose intents the conversation has already been granted (smaller, safer prompt)?
- **Options:**
  - (a) All installed apps; ungranted ones are marked "available, not enabled".
  - (b) Granted-only; the agent never sees apps it can't currently drive.
- **Tentative leaning:** (a) — list all, mark enablement state, so the agent can offer "want me to turn on Mailbox for this?" (writes to `toolGrants`, never above the app ceiling). Cap the catalog token budget by eliding ungranted apps to name+description only.
- **Blocking?:** No — gates the context-assembly rung's prompt shape, decidable at implementation.

#### OQ-AH-2 — Skill discovery surface
- **Where:** [62-agent-harness.md](../platform/62-agent-harness.md) §Layer C, [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md).
- **Question:** Which saved `Workflow/v1`s does the agent see as callable skills — all of them (noisy), user-pinned only, or only those whose tool-set is a subset of the conversation's grants (self-limiting)?
- **Tentative leaning:** Subset-of-grants — a skill the agent cannot actually execute is never offered, so discovery never dead-ends on a permission wall.
- **Blocking?:** No — Skills layer is basic in v1; richer discovery layers on top.

#### OQ-AH-3 — Artifact type inference
- **Where:** [62-agent-harness.md](../platform/62-agent-harness.md) §Artifacts, [21-objects-and-collections.md](../data/21-objects-and-collections.md).
- **Question:** When the agent produces a durable artifact, does it **choose** the type (Note vs. List vs. Whiteboard) from the task, **offer** the user a pick, or **default** to Note and let the user convert later?
- **Tentative leaning:** Agent proposes a type with a one-tap override in the confirm step — inference for momentum, user control for correctness.
- **Blocking?:** No — defaulting to Note is a safe v1 floor; inference is additive.

#### OQ-AH-4 — Code-runner runtime, isolation, and resource caps
- **Where:** [62-agent-harness.md](../platform/62-agent-harness.md) §Code-runner, [09-security-and-sandbox.md](../security/09-security-and-sandbox.md), `packages/shell/src/main/workers.ts`.
- **Question:** What runtime executes agent-authored scripts, and under what isolation + caps?
- **Options:**
  - (a) Node-less sandboxed `WebContentsView` — reuses the app-sandbox primitive; heaviest; strongest boundary.
  - (b) Hardened `utilityProcess` worker with an SDK-only bridge — lighter, no DOM, process-isolated.
  - (c) Constrained in-process VM — lightest, weakest boundary; likely rejected for a capability-bearing surface.
- **Plus:** the resource-cap schedule (wall-clock, memory, max entity writes per run) and whether a run is deterministic/replayable for audit.
- **Tentative leaning:** (b) — process-isolated worker with an SDK-only bridge and hard caps; the boundary is a process, the surface is the granted SDK calls only.
- **Blocking?:** Yes — **blocks the code-runner rung**. Non-blocking for the v1 context/artifact loop, which ships first.

#### OQ-AH-5 — Code-runner capability mapping
- **Where:** [62-agent-harness.md](../platform/62-agent-harness.md) §Code-runner, [55-agent-app.md](../apps/55-agent-app.md) (`toolGrants`).
- **Question:** Does an agent-run script inherit the conversation's **full** tool grants, or a **narrower** explicitly-scoped budget granted per-run?
- **Tentative leaning:** Per-run narrowed budget — running arbitrary code is higher-risk than a single intent call and deserves its own, smaller consent gesture; the three-tier intersection still caps it at the app ceiling.
- **Blocking?:** Gates the code-runner rung alongside OQ-AH-4; not v1-blocking.

---

### Action surface — cross-app menu contributions (added in 63)

#### OQ-AS-1 — Verb-to-surface eligibility
- **Where:** [63-action-surface.md](../platform/63-action-surface.md), [17-interoperability.md](../platform/17-interoperability.md), [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md).
- **Question:** Which curated verbs may surface as contributed menu items on which surface (object ⋯ menu / cover menu / editor selection / block menu)? A flat "all verbs everywhere" is the junk-drawer failure mode.
- **Tentative leaning:** `process`/`convert`/`compose`/`share`/`export` on object + selection menus; `insert` on the editor selection / block menu; `open` stays on the open-resolution path ([57](../platform/57-open-resolution.md)); `quick-look` on hover/preview affordances only.
- **Blocking?:** No — gates the host-side `useContributedActions` rollout shape, decidable at implementation.

#### OQ-AS-2 — Applicability granularity
- **Where:** [63-action-surface.md](../platform/63-action-surface.md).
- **Question:** Do contributions match only on **discriminators** (`entityType`/`mime`/`format` — cheap, indexed) or also on **value-/content-level predicates** ("only Notes that contain an image", "only URLs on this domain")?
- **Tentative leaning:** Discriminators in v1; value-level predicates post-v1 — predicates cost a per-menu-open evaluation and need a safe, declarative predicate language, not arbitrary contributor code.
- **Blocking?:** No — v1 ships discriminator matching; predicates are additive.

#### OQ-AS-3 — Trust tier for third-party contributions
- **Where:** [63-action-surface.md](../platform/63-action-surface.md), [32-store-verification.md](../apps/32-store-verification.md), [14-app-store.md](../apps/14-app-store.md).
- **Question:** Do sideloaded apps' contributed actions appear inline in other apps' menus, or only under "More…" until the user promotes them? Is there per-contribution review for catalog apps?
- **Tentative leaning:** First-party + catalog-signed contributions rank inline; sideloaded contributions are quarantined under "More actions…" until promoted — a sideloaded app shouldn't silently plant an action high in every menu.
- **Blocking?:** No — basic inline-vs-More gating ships v1; richer review is post-v1.

#### OQ-AS-4 — Inline cap and grouping thresholds
- **Where:** [63-action-surface.md](../platform/63-action-surface.md).
- **Question:** The concrete UX numbers — max inline contributed items per group before collapse to "More…", and the grouping bucket thresholds.
- **Tentative leaning:** Small inline cap (≈3 per group) tuned during dogfood; everything else under "More…".
- **Blocking?:** No — a tuning constant, not an architecture decision.

#### OQ-AS-5 — A dedicated `generate` verb?
- **Where:** [63-action-surface.md](../platform/63-action-surface.md), [17-interoperability.md](../platform/17-interoperability.md), [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Question:** Generative-from-nothing actions (image/text/code with no source entity) currently ride `process` with a `kind`. Do they warrant a dedicated `generate` verb, or does `process` cover them?
- **Tentative leaning:** `process` with `kind` in v1 (keeps the namespace closed); revisit `generate` only if source-less generation becomes a common, distinct surface.
- **Blocking?:** No — namespace additions are shell releases; `process` is sufficient for v1.

#### OQ-AS-6 … OQ-AS-10 — fragment targets, return channel, proposals  *[SUPERSEDED 2026-07-29 by OQ-TOOL-1..6 below]*
- **Where:** [78-app-tools.md](../platform/78-app-tools.md) (the doc that raised them, then replaced them).
- **What they asked:** fragment-anchor durability + what a contributor may see (OQ-AS-6); who authorizes a fragment leaving the host (OQ-AS-7); whether approval is always required (OQ-AS-8); inline-toolbar restraint numbers (OQ-AS-9); shared trace substrate with [77](../platform/77-agent-observability.md) (OQ-AS-10).
- **Why superseded:** filed against the fragment-target design (plan `AS-5..AS-11`, closed ❌ the same day). Under the app-tools model a tool receives *values*, never a location, so the anchor question (OQ-AS-6) dissolves rather than being answered. The rest carry over renamed: OQ-AS-7→**OQ-TOOL-5** (authorization/friction), OQ-AS-8→**OQ-TOOL-5**, OQ-AS-9→ the `AS-4` anti-rot policy reused unchanged by `Tool-7`, OQ-AS-10→**OQ-TOOL-6** verbatim.

### App tools — installed apps as typed tool providers (added in 78)

#### OQ-TOOL-1 — Argument schema language: `PropertyDef` or JSON Schema?
- **Where:** [78-app-tools.md](../platform/78-app-tools.md), [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).
- **Question:** A tool's inputs need a type description. JSON Schema is what MCP and every LLM tool-calling API speak — but the repo has **no JSON-Schema validator** (no `ajv`); the two places inline schemas are read only *distill* them (`propertiesFromSchema`, `extractFieldsFromTypeSchema`) and nothing ever validates a value against one. `PropertyDef` is the one typed-value system with a real validator (`validatePropertyDef` / `validateValue`) that the broker already re-runs defense-in-depth.
- **Tentative leaning:** declare in `PropertyDef`, project to JSON Schema for the model. This buys argument validation **at the broker before the call reaches the provider** — which MCP's deliberately-opaque `inputSchema` cannot do — without adding a schema-validator dependency. Cost: `ValueType` is 6 types, so genuinely nested/structured arguments are not expressible in v1.
- **Blocking?:** Yes — blocks `Tool-3`. It determines the manifest wire format, which is a compatibility surface once third-party apps declare tools.

#### OQ-TOOL-2 — Do app tools subsume intent-derived agent tools, or coexist?
- **Where:** [78-app-tools.md](../platform/78-app-tools.md), [62-agent-harness.md](../platform/62-agent-harness.md), [55-agent-app.md](../apps/55-agent-app.md).
- **Question:** The harness projects granted *intents* into tools today (addressed by verb, no input schema, colliding). Once apps declare real tools, do the intent-derived ones stay as a second source forever, get deprecated onto tools, or remain only for the genuinely routing-shaped verbs (`open`, `quick-look`)?
- **Tentative leaning:** coexist in v1 (the intent tools are shipped and working, and `open` is genuinely a routing verb whose handler the caller should *not* choose); revisit deprecating the rest once a few apps have declared real tools. Two sources means two projections to keep honest, so this should not stay indefinite.
- **Blocking?:** Yes for `Tool-6` — the projection has to decide dedupe/precedence when an app exposes both an `insert` intent and an `insert` tool.

#### OQ-TOOL-3 — May a tool call launch a headless provider?
- **Where:** [78-app-tools.md](../platform/78-app-tools.md), [12-shell-architecture.md](../shell/12-shell-architecture.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).
- **Question:** Calling a tool on an app that isn't running requires starting its renderer. Does the shell launch it **invisibly** (fast, no window churn — the machinery exists: `createWidgetSurface` already mounts a real app renderer invisibly with identity registered), or must a visible window appear (honest, but a menu action that pops a window is bad UX), or does the call simply fail when the provider is cold?
- **Tentative leaning:** invisible launch, but **only for `effect: "pure"` tools** and with the run surfaced in the activity chip — an app silently executing in the background is exactly the thing the observability track ([77](../platform/77-agent-observability.md)) exists to make legible. Cold-launch cost and the current dashboard-mount-point dependency both need measuring first.
- **Blocking?:** No — v1 may require a running provider and refuse cold with a named reason; headless is the post-v1 half of `Tool-8`.

#### OQ-TOOL-4 — May a sideloaded provider's tool text reach the model at all?
- **Where:** [78-app-tools.md](../platform/78-app-tools.md), [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [32-store-verification.md](../apps/32-store-verification.md).
- **Question:** A tool's `name`/`description` is author-controlled text injected into the agent's prompt — the MCP "untrusted descriptions" vector, now from an *installed app*. `AS-3` quarantines sideloaded contributions in *menus* (under "More…"), but the model has no "More…" — a description is either in the prompt or not.
- **Tentative leaning:** a sideloaded app's tools are callable from menus (user-initiated, visible) but **excluded from the model's tool list until promoted**, because a menu quarantine has no prompt analogue. Catalog-signed and first-party project normally, still sanitized + length-capped + rug-pull-fingerprinted.
- **Blocking?:** No for `Tool-5`'s hardening work, but the answer determines what `Tool-6` projects.

#### OQ-TOOL-5 — Effect-driven auto-run, or always confirm?
- **Where:** [78-app-tools.md](../platform/78-app-tools.md), [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [55-agent-app.md](../apps/55-agent-app.md).
- **Question:** `decideToolFriction` already maps a tool to `AutoRun | Confirm`. Which declared effects may auto-run, and does the answer differ per consumer (a menu click is already a user gesture; an agent-initiated call is not)?
- **Tentative leaning:** `pure` auto-runs everywhere; `reads-vault` auto-runs from a menu (the click is the gesture) but confirms when agent-initiated; `proposes-write` always ends in a human approve gesture by construction; `external` follows the egress rules. A provider's declared effect is a friction input, never a boundary — a provider can lie, exactly as MCP's `readOnlyHint` can.
- **Blocking?:** No — v1 can confirm everything and relax with dogfood evidence.

#### OQ-TOOL-6 — Shared trace substrate with 77?
- **Where:** [78-app-tools.md](../platform/78-app-tools.md), [77-agent-observability.md](../platform/77-agent-observability.md).
- **Question:** A tool call is "app X ran Y for app Z with outcome W" — the same row shape [77](../platform/77-agent-observability.md) records for the agent. Does `agent_runs`/`agent_events` generalize to any calling principal, or does the tool layer get its own ledger?
- **Tentative leaning:** generalize rather than fork — the surfaces (activity query, denial rows, live chip) are identical, and two ledgers means two retention policies and two places to look. Likely a rename of the record's principal column from "agent" to "actor".
- **Blocking?:** No for `Tool-8`'s UX, but it should be decided **before** `Agent-12a` writes the schema — afterwards it is a migration.

#### OQ-ID-1 — Human-facing user identity for collaboration  *[RESOLVED in design — see [16-identity-orgs-encryption.md §Self-asserted display profile](../security/16-identity-orgs-encryption.md#self-asserted-display-profile-the-human-facing-identity); implementation gated as plan **Collab-C6**]*
- **Where:** [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md), Collaboration layer in [implementation-plan.md](../implementation-plan.md).
- **Question:** The vault owns a *cryptographic* identity (sovereign Ed25519 + per-device X25519) but **zero human-facing identity** — no display name, avatar, or handle. A collaborator is a 32-byte pubkey. The collaboration/communication layer (share dialogs, member lists, presence cursors, `createdBy` attribution, future messaging) needs a recognizable identity. How is one introduced without breaking the v1 "no accounts, no server" line?
- **Resolution:** A **self-asserted, Ed25519-signed display profile** `{ displayName, avatarRef?, pubkey }` stored as a synced `Profile/v1` vault entity (a singleton per identity — syncs across your own devices, *not* a per-device `localStorage` pref), with a signed snapshot distributed peer-to-peer alongside the `ShareInvite` and cached in the access record / awareness state. The **pubkey remains the sole identity** — the name is a convenience hint, not a trust claim. Each user can **locally rename** a contact (petname / Signal model); pubkey fingerprint comparison upgrades trust. The Contacts app (`Person/v1`) is the registry for pubkey + petname. Additive to the encryption model (no relay plaintext, no new wire capability); the consumer account (v2) later supplies a verified, recoverable profile.
- **Blocking?:** Blocks the in-product collaboration UX (Collab-C5/C6) — a member list can't render pubkeys. Not blocking for the crypto spine (Collab-C1…C4-live), which is keyed purely on pubkeys and is already done.
- **Sub-positions pinned at implementation (Collab-C6 slice a, 2026-06-21):** (1) the `Profile/v1` **singleton id is derived deterministically from the pubkey** (`sha256(pubkey)` hex), so a second device of the same identity edits the *same* entity — one master copy that CRDT-merges, never two racing singletons. (2) The **durable author key everywhere is the sovereign pubkey base64** — chat messages (`sender.personRef`), the access-record `member`, `Profile/v1.pubkey`, and a `PersonAttachment.ref`/comment `mentions[]` all join on this one string. This retired chat's per-device `personRef` (an older message renders via its denormalised name, just unlinked from the live roster — an accepted cosmetic seam).

---

### MCP integrations

#### OQ-MCP-1 — MCP server config scope: per-vault vs. per-device  *[RESOLVED 2026-06-29 — adopted: per-vault config record + per-device enablement; shipped with MCP-1..4]*
- **Where:** [64-mcp-integrations.md](../platform/64-mcp-integrations.md).
- **Question:** Is a connected MCP server stored as per-vault config (syncs across the user's devices, like other settings) or per-device (a stdio server's command line / local path may not exist on every device)?
- **Options & trade-offs:** Per-vault = configure once, available everywhere, but a local command may be invalid on another device. Per-device = always valid locally, but reconfigure on each device.
- **Tentative leaning:** Per-vault config *record* + per-device *enablement* — the server definition syncs; whether it's reachable/enabled is decided per device (an unreachable stdio server shows `down` rather than breaking the config).
- **Blocking?:** Yes — blocks MCP-1 (the broker's config model).

#### OQ-MCP-2 — stdio (local-process) isolation *[RESOLVED in implementation-plan Stage 11c — MCP-2, 2026-06-24]*
- **Where:** [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [62-agent-harness.md](../platform/62-agent-harness.md) (OQ-AH-4 code-runner sandbox).
- **Question:** Do local stdio MCP servers spawn as a plain child process (capable, fast, weak boundary) or inside the hardened sandbox the code-runner will use?
- **Options & trade-offs:** Plain child = full capability, simplest, but arbitrary local code at user privilege. Hardened sandbox = stronger boundary but couples to the unbuilt code-runner runtime (OQ-AH-4) and constrains legitimate servers (a filesystem server *needs* the filesystem).
- **Resolution (MCP-2):** **Plain child + explicit `mcp.spawn-local` consent** (the adopted leaning). A local stdio server spawns as a plain `child_process.spawn` with **`shell: false`** (no shell interpolation — argv is passed verbatim), gated on a **scarce, default-off `mcp.spawn-local` capability** re-checked against the live ledger in the broker (never trusting `envelope.caps`), in addition to the per-server `mcp.server:<id>` grant. The exact command line is shown for consent in Settings. Spawn is **per-RPC** (spawn → `initialize` handshake → the one method → kill) so no long-lived process lingers and there is no cross-call state leak; output is size-capped and timeout-bounded (reusing the HTTP transport's caps), killed on timeout. v1 carries `command` + `args` only — **no config-supplied env** (env is a secret-leak/attack surface; the parent env is inherited so PATH resolves). The hardened-sandbox option is deferred: when the code-runner runtime (OQ-AH-4) lands, stdio servers can converge onto it without a contract change (the `mcp.spawn-local` gate stays; only the spawn mechanism hardens).
- **Blocking?:** Blocked the stdio rung (MCP-2) — now resolved; HTTP-only first cut (MCP-1) was never blocked.

#### OQ-MCP-3 — Conversation grant granularity  *[RESOLVED 2026-06-29 — adopted: server-level grant + destructive-tool confirm gate; tool-level scopes stay post-v1]*
- **Where:** [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [55-agent-app.md](../apps/55-agent-app.md) (three-tier intersection).
- **Question:** Is a conversation grant `mcp.server:<id>` (all of a server's tools) or down to `mcp.tool:<id>/<tool>`?
- **Tentative leaning:** Server-level grant in v1, with a destructive-tool confirm gate (writes confirm regardless); tool-level scopes post-v1.
- **Blocking?:** Yes — blocks MCP-1's consent UX.

#### OQ-MCP-4 — How much to trust the `readOnlyHint`/`destructiveHint`
- **Where:** [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [22-ai-foundations.md](../platform/22-ai-foundations.md) (prompt injection).
- **Question:** A server self-declares whether a tool is read-only/destructive. How much friction reduction does that buy, given a server can lie?
- **Tentative leaning:** The hint lowers *friction* (a plausibly-safe read may auto-run under a granted scope) but is **never a security boundary** — writes confirm, every call audits, and a tool whose description/annotation changes after approval re-prompts (rug-pull defense).
- **Blocking?:** No — a friction-tuning policy; the safe default (confirm everything) ships first.

#### OQ-MCP-5 — MCP prompts + resources primitives
- **Where:** [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [62-agent-harness.md](../platform/62-agent-harness.md).
- **Question:** Beyond the `tools` primitive, MCP exposes `prompts` and `resources`. Do they map onto the harness's Skills (Layer C) and Context/retrieval (Layer A), or stay out?
- **Tentative leaning:** Resources → retrieval/context, prompts → skills; both post-v1 (v1 consumes `tools` only).
- **Blocking?:** No — v1 is tools-only.

#### OQ-MCP-6 — Brainstorm *as* an MCP server
- **Where:** [64-mcp-integrations.md](../platform/64-mcp-integrations.md), [22-ai-foundations.md](../platform/22-ai-foundations.md) (privacy/E2E boundary).
- **Question:** Should Brainstorm expose the vault graph to *external* agents over MCP (inbound), not just consume servers (outbound)?
- **Options & trade-offs:** Attractive (your knowledge graph usable from any agent) but inbound + data-exposing — a different threat model needing the E2E-boundary analysis from [22 §Privacy](../platform/22-ai-foundations.md).
- **Tentative leaning:** Out of v1; revisit as a deliberate post-v1 surface with its own threat model.
- **Blocking?:** No — explicitly deferred.

### Durable + live sync (Stage 10.12+ / `brainstorm-sync` node)

#### OQ-SYNC-1 — storage-provider default for v1 *[RESOLVED in implementation-plan §Durable sync node (`SYNC-3`, 2026-06-23) — option: local-only default + pluggable-provider seam; managed turns on once `SYNC-4` admission is ready]*
- **Where:** [implementation-plan.md](../implementation-plan.md) §Stage 10 (`10.14`) + §Durable sync node (`SYNC-3`); [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).
- **Question:** For the first shippable sync, is the default **local-only** (no remote; `.bsbundle` export is the only backup) with managed/self-hosted opt-in, or a **managed node from day one**?
- **Options & trade-offs:** Local-only-first = zero infra cost, ships now, honest "your data is local" — but **no restore-from-loss** until a node exists. Managed-from-day-one = real backup + the monetizable tier immediately, but infra cost + ops + abuse surface before there are users, and couples beta to running a node fleet.
- **Resolution:** Adopt the tentative leaning. `SYNC-3` shipped the pluggable-provider seam (`ObjectBucket` behind `SnapshotStore`/`AccountCatalog`) with three backends selected by env — **forward-only**, **local** (the default; `.bsbundle` export stays the local-only backup), and **s3** (managed bucket or self-hoster's bring-your-own R2/S3/MinIO). The client points at a node URL or nothing; no client change distinguishes them. Managed is gated on `SYNC-4` admission (now ✅), so it can turn on once billing-edge issues tokens (`14.3`).
- **Blocking?:** Was — gated `10.14` + `SYNC-3` scope; now resolved.

#### OQ-SYNC-2 — node admission model (open vs entitlement-gated) *[RESOLVED in implementation-plan Stage 10 (`10.12`) — option: open admission for the dev-gated forward node; entitlement-gate deferred to `SYNC-4`/`SYNC-2`]*
- **Where:** §Durable sync node (`SYNC-1`/`SYNC-4`); [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md); `packages/relay-server`.
- **Question:** Does the deployed node admit **any** connection at first (the receiver is the last line of defense — no key, no content) or require the `brainstorm-cloud` **entitlement token** from the start?
- **Options & trade-offs:** Open relay = simplest, safe for *confidentiality* (relay-blind), but a spam/DoS/storage-abuse surface and no per-account quota. Entitlement-gated from day one = clean quota/billing seam, but couples `SYNC-1` to token issuance (`14.3`) and adds an auth round-trip.
- **Resolution:** Adopt the tentative leaning. The `SYNC-1` online-only forward node stays **open-admission behind the dev gate**, and the `10.12` always-on client live-sync connects to exactly that node — so 10.12 ships with **no entitlement-token round-trip**. The token requirement lands with `SYNC-4` (public/managed deploy) and `SYNC-2` (durable storage), where storage/egress abuse and per-account quota actually bite; until then the relay-blind, ciphertext-only invariant is the confidentiality guarantee and the node carries no plaintext to abuse. This keeps the client wire path identical across open and gated nodes (admission is a node-side connection check, not a client protocol change).
- **Blocking?:** Yes for `SYNC-4` / public deploy; **non-blocking** for the dev-gated `SYNC-1` forward node and the `10.12` client that rides it.

#### OQ-SYNC-3 — encrypted-snapshot storage layout + compaction *[RESOLVED 2026-06-22 (pre-`SYNC-2`) — option: client-driven snapshot+tail, node stores opaque `(account, entityId, version)` blobs and never compacts content]*
- **Where:** §Durable sync node (`SYNC-2`); [18-storage-and-search.md](../data/18-storage-and-search.md) (ydoc-store snapshot+tail); [20 §Incremental sync](../data/20-database-growth-and-sync.md).
- **Question:** How are per-entity encrypted CRDT states stored on the node — append-only update log, periodic compacted snapshots, or the **snapshot+tail** format the local ydoc-store already uses — and what compacts them server-side *without a key*?
- **Options & trade-offs:** Append-only log = simplest writes, unbounded growth + slow cold fetch (replay all). Snapshot+tail (mirror the local format) = bounded, fast fetch, proven shape — but the node holds only ciphertext, so compaction must be **client-driven** (the client uploads a fresh full snapshot the node swaps in) since the node can't merge blindly. Object-storage key layout (`<account>/<entityId>/<version>`) drives fetch + catalog cost.
- **Resolution:** Adopt the tentative leaning — **client-driven snapshot+tail, mirroring the local ydoc-store format the client already produces.** The client uploads encrypted blobs the node stores **opaquely**, keyed by `(account, entityId, version)`; the node maintains a per-account catalog `(entityId → latest version)` for fetch and **never inspects or compacts content** (it holds only ciphertext — the relay-blind invariant carries to storage). Compaction is the client's job, on the **same 256 KiB-tail trigger** as the local store (`ydoc-store.ts`): when the client compacts locally it uploads a fresh full snapshot under a new version and the node swaps the catalog pointer; the prior version is GC'd by the node after a grace window (no key needed — it's blob lifecycle, not content). Update frames between snapshots ride the existing live relay path (`SYNC-1`); a reconnecting/cold client fetches `latest snapshot + tail since that version` (powers `10.14`). One format end-to-end (local disk ⇄ wire ⇄ node), so the node adds no new CRDT logic and stays auditable as ciphertext-only.
- **Blocking?:** Yes — gated `SYNC-2`; now resolved, `SYNC-2` is unblocked (its remaining inputs: object-storage provider choice rides `OQ-SYNC-1`/`SYNC-3`; admission/metering rides `SYNC-4`).

#### OQ-SYNC-4 — DEK recovery path for restore-from-zero *[RESOLVED 2026-06-22 — option: node persists `WrapBootstrap` wraps (keystore-intact restore); account recovery handles the lost-keystore subset]*
- **Where:** [implementation-plan.md](../implementation-plan.md) §Stage 10 (`10.14`) + §Durable sync node (`SYNC-2`); [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md); [51-account-recovery-and-web-auth.md](../security/51-account-recovery-and-web-auth.md).
- **Question:** A device restoring from the durable node needs the per-entity **DEK** to decrypt the backfilled snapshot+tail. On a wiped device the sealed DEKs (in `entities.db`) are gone. How does it recover them — from **node-persisted DEK wraps**, or only via **account recovery** (security/51) re-provisioning the DEK store?
- **Options & trade-offs:** Node-persisted wraps = restore is node-driven + works for the **common case** (device kept its keystore = its X25519 + master key, lost only its data) with **no account-recovery dependency**; the node holds only HPKE-sealed wraps it can't open (relay-blind intact). But it stores extra blobs + can't dedup by the sealed recipient (bounded by a retention cap). Account-recovery-only = no node wrap storage, but couples *every* restore to the heavier identity-recovery flow even when the keystore survived.
- **Resolution:** **Both, layered.** The node **persists `WrapBootstrap` frames** (`SYNC-2`, `SnapshotStore.appendWrap`, capped at `WRAP_RETENTION`) and serves them **first** in backfill, so a **keystore-intact** device unwraps the DEK with its own X25519 key *before* applying the encrypted state — restore needs no account recovery for this common case. The **fully-cold** case (lost keystore → no X25519, no master key) still requires **account recovery** (security/51) to re-establish identity + re-provision/re-wrap DEKs; that subset is `10.14`'s account-recovery gate. The wrap is HPKE-sealed per recipient device — the node can't read it (no X25519 key), so persisting it keeps the node **relay-blind**.
- **Blocking?:** Was implicit in `10.14`; node side resolved + built. The fully-cold client path still gates on account recovery (security/51).

#### OQ-SYNC-5 — cold-device entity-type recovery *[RESOLVED 2026-06-22 — option: seal `type` inside the `WrapBootstrap` HPKE ciphertext]*
- **Where:** [implementation-plan.md](../implementation-plan.md) §Stage 10 (`10.14`); `credentials/member-wraps.ts`; `data/20-database-growth-and-sync.md` §Initial sync.
- **Question:** A restoring device receives each entity's DEK (`WrapBootstrap`) + Yjs state (`Snapshot`/`Update` tail) from the node, but an entity's reverse-DNS **`type`** lives only in the `entities.db` row — it is **not** in the Yjs doc, and the relay-blind node can't see it (and the catalog reply carries only `{entityId, version}`). Without the type the device can't materialize the row (`repo.create` needs it; it drives queries + search owner-attribution). Where does `type` travel?
- **Options & trade-offs:** (a) **In the `WrapBootstrap`** — every restorable entity has exactly one wrap (its DEK carrier), served first in backfill, so the type always arrives before any state regardless of compaction; sealed inside the HPKE ciphertext it stays confidential from the blind node; needs no `brainstorm-sync` change (the node stores/replays wrap frames opaquely). Cost: a small wire-format change to the wrap plaintext + threading through the mint sites. (b) **In the encrypted `Snapshot` payload** — clean when every entity always has a snapshot, but an entity edited-but-never-compacted has only an `Update` tail and no snapshot, so it needs an added "emit initial snapshot on share" rule to guarantee the type arrives.
- **Resolution:** **(a) — seal `type` in the `WrapBootstrap`.** `wrapDekForRecipient` frames the HPKE plaintext as `[typeLen:1][typeUtf8][dek:32]` when a type is supplied (a bare 32-byte plaintext = the pre-10.14 layout; `unwrapDekAndTypeForRecipient` disambiguates by length → `type: null` for legacy). Threaded through `shareEntityWithInvite` + `installEntityWrap`. The restoring `LiveSyncEngine` recovers the type via the wiring's `installWrap`, materializes the row, and promotes the restore-tracked entity from its pending sentinel to the real type. Confidential from the node, robust regardless of compaction, zero node change.
- **Blocking?:** Was implicit in `10.14` restore-consumer; resolved + built.

---

### Object selection + cross-app drag-and-drop (added in 65)

#### OQ-DND-1 — Drag-ghost mechanism *[RESOLVED in implementation-plan DND-2 → option (a)]*
- **Where:** [65-object-selection-and-cross-app-dnd.md](../platform/65-object-selection-and-cross-app-dnd.md) §Part IV.
- **Question:** How is the cursor-following drag ghost rendered so it can paint over *every* app window during a cross-app drag?
- **Options & trade-offs:** (a) a dedicated frameless click-through always-on-top window the shell moves with the cursor — most robust over arbitrary windows, but cross-monitor/DPI + click-through reliability are platform-fiddly; (b) a dashboard-renderer overlay layer — reuses existing chrome but can't paint above other apps' native windows; (c) an OS-native drag image — limited styling, ties into `startDrag` semantics that don't carry our payload.
- **Resolution:** **Option (a)** — a single shell-owned, frameless, transparent, **click-through** (`setIgnoreMouseEvents(true)`), always-on-top (`screen-saver` level + `setVisibleOnAllWorkspaces`) `BrowserWindow` the shell repositions per cursor-move. (b) is rejected outright — a dashboard-renderer layer is clipped to the dashboard window's bounds and cannot paint over another app's native window, which is the entire requirement. (c) is rejected — `startDrag`'s OS image is unstyleable and welds the ghost to the file-drag path that can't carry our payload. The DND-2 implementation seams the window behind a `GhostOverlay` factory interface (`show/move/setEffect/hide`) so the state machine is unit-tested without a real window; the real `BrowserWindow` binding is DND-2b (real-shell verify: cross-monitor follow + reduce-motion = no inertial lerp + click-through never steals the drop).
- **Blocking?:** Was yes (gated the drag-session implementation) — now resolved.

#### OQ-DND-2 — What a target learns on hover vs. drop *[RESOLVED in implementation-plan DND-2 → drop-only payload]*
- **Where:** [65](../platform/65-object-selection-and-cross-app-dnd.md) §Part IV.
- **Question:** Is `sourceApp` (and item identity) ever revealed to a target on `drag-over`, or only on `drop`?
- **Options & trade-offs:** Revealing on hover enables richer affordances but lets a passive app fingerprint what the user is dragging across its window merely by being hovered. Drop-only is privacy-tight but the hover affordance must be type-only.
- **Resolution:** **Payload bytes + `sourceApp` + item identities reach a target ONLY on `drop`.** The `app:drag-over` notification carries `{ sessionId, payloadKind, itemTypes (deduped type-URL list), pointInWindow }` and nothing else — never which objects, never which source app. This is a hard privacy invariant baked into the wire shape (the `DragOverNotice` vs `DropDelivery` types are distinct; the over-notice structurally cannot hold items). Bounds what a passive app learns from the user merely dragging across its window to "a drag of these kinds is overhead, here."
- **Blocking?:** Was yes (privacy invariant in the protocol shape) — now resolved.

#### OQ-DND-3 — Capability to receive drag-over *[RESOLVED in implementation-plan DND-2 → ambient hover, gated drop]*
- **Where:** [65](../platform/65-object-selection-and-cross-app-dnd.md) §Part IV.
- **Question:** Does an app need a capability to be told a drag is hovering its own window, or is hover ambient (the user's pointer over the user's window) with only the drop payload capability-gated?
- **Resolution:** **Hover is ambient** — the shell sends `app:drag-over` to whichever window the cursor is over without a capability check (it is the user's own pointer over the user's own window, and the over-notice leaks only kinds+point per OQ-DND-2). The **drop** is capability-gated: starting a drag needs `dnd.drag`; receiving the payload needs `dnd.drop`, **and** the actual mutation re-checks the operation's own capability (`entities.write:<type>` for a membership/property write, etc.) fail-closed at perform time. A target that holds neither simply never receives a `drop`.
- **Blocking?:** No — defaulted as above.

#### OQ-DND-4 — Heterogeneous multi-item selection
- **Where:** [65](../platform/65-object-selection-and-cross-app-dnd.md) §Part III.
- **Question:** When a selection mixes entity types (or entities + files), does a target negotiate per-item or all-or-nothing?
- **Tentative leaning:** target declares accepted kinds; default all-or-nothing for v1.
- **Blocking?:** No.

#### OQ-DND-5 — Drag-time affordances (auto-scroll / spring-load / auto-raise)
- **Where:** [65](../platform/65-object-selection-and-cross-app-dnd.md) §Part IV.
- **Question:** Are auto-scroll, spring-loaded folders, and auto-raise-window-on-hover in scope for the first cross-app DnD, or deferred?
- **Tentative leaning:** auto-scroll yes; spring-load + auto-raise deferred to v2.
- **Blocking?:** No.

#### OQ-DND-6 — Unify intra-app DnD onto the session?
- **Where:** [65](../platform/65-object-selection-and-cross-app-dnd.md) §Part II, §Part IV.
- **Question:** Should intra-renderer drags also route through the shell drag session for uniformity, or keep native HTML5 DnD for latency?
- **Tentative leaning:** keep native HTML5 intra-renderer; expose one `useDropTarget` API over both transports so apps don't see the difference.
- **Blocking?:** No.

---

## Templates — `OQ-TPL-1` … `OQ-TPL-4`

Source: [platform/66-templates.md](../platform/66-templates.md).

#### OQ-TPL-1 — Seed icon/cover on instantiation *[RESOLVED in implementation-plan B11.10a]*
- **Question:** Does object-template instantiation copy the template's `icon`/`cover` into the new entity, or only `body` + properties?
- **Resolution:** body + prototype properties only; `name`/`icon`/`cover` describe the template in the picker and are stored as siblings of `prototype` (outside the copied bag). An opt-in `seedIcon`/`seedCover`/`seedName` is the natural extension, not built for v1. Implemented in `instantiateObjectTemplate` (`packages/sdk/src/template-entity-codec.ts`).
- **Blocking?:** No.

#### OQ-TPL-2 — References inside block snippets *[RESOLVED in implementation-plan B11.10]*
- **Question:** A `block-snippet` template containing transclusions / object-links / mentions — on insert, copy as new independent content or preserve references to the originals?
- **Resolution:** preserve references. The snippet's `root` fragment inserts through the editor's existing insert path (the same path paste uses), so reference nodes carry their `entityId` verbatim and resolve to the originals — a snippet is a reusable view of *your graph*, not a literal-text macro. A *"detach / duplicate referenced objects"* mode is a future explicit opt-in, never the default.
- **Blocking?:** No.

#### OQ-TPL-3 — Dynamic tokens *[RESOLVED in implementation-plan B11.10]*
- **Question:** Do object templates support tokens expanded at instantiation (`{{today}}`, `{{me}}`, `{{week-number}}`), or static prototypes only for v1?
- **Resolution:** static prototypes for v1 — instantiation is a pure structural deep-copy with no expansion pass (so `{{today}}` persists as literal text). A token resolver is a localized v2 addition that does not change the `Template/v1` data shape; the Journal `{{today}}` need is tracked by [OQ-JR-1](#oq-jr-1--journal-templates) and rides that v2 work.
- **Blocking?:** No.

#### OQ-TPL-4 — Template sync/share *[RESOLVED in implementation-plan B11.10]*
- **Question:** Do user-authored `Template/v1` entities sync/share like any other entity across collab + paired devices?
- **Resolution:** yes — ordinary capability-gated `entities.*` rows on the existing path, so the selective-sync policy (`10.13`) and collab share (`Collab-C5`) apply with no template-specific handling. Only Welcome-2 build-time artifacts (JSON, not entities) stay off the entity path.
- **Blocking?:** No.

---

## AI-native company north star — `OQ-AINC-1` … `OQ-AINC-4`

Source: [foundations/67-ai-native-company.md](../foundations/67-ai-native-company.md). **None of these gate any current stage** — they gate the long-horizon governed-agent surfaces, which land post-AI-broker (`11.x`).

#### OQ-AINC-1 — Agent-as-roster-member type *[RESOLVED in [platform/69-agent-teams-and-orchestration.md](../platform/69-agent-teams-and-orchestration.md)]*
- **Question:** At what stage does an explicit agent principal land — an agent profile distinct from a human `Profile/v1`, with its capability grants surfaced in Settings → Identity and a "what this agent did" audit view?
- **Resolution:** the agent principal is `brainstorm/Agent/v1` — a persona shell (persona prose + skills + traits) over a capability ceiling held in the `CapabilityLedger` (principal column generalized app → member, **no schema change**). Each agent gets its **own Ed25519 keypair generated locally at creation** (a real principal: distinct author key, distinct ledger principal, distinct audit subject, independently revocable); only cross-device sync/recovery of agent identities is deferred to the Collab identity track. Lands **post-beta** as the Agent-Teams rungs, not gated on a stage.
- **Blocking?:** No.

#### OQ-AINC-2 — Capability grant/revoke UI for agents in v1? *[position taken in [platform/69-agent-teams-and-orchestration.md](../platform/69-agent-teams-and-orchestration.md)]*
- **Question:** Does the legible grant/revoke + audit surface for agents ship in v1 Settings, or v2?
- **Resolution:** ships **with** the Team surface in the first agent-teams cut — it is the core demo of the governed-agent thesis and there is no agent-team product without it. The "what this agent did" view is free (a filter over the existing audit log keyed on the agent principal). Built from the shipped `CapabilityLedger` grant/revoke + audit sheet; no new machinery.
- **Blocking?:** No.

#### OQ-AINC-3 — Local↔cloud routing granularity
- **Question:** Per-task model selection on the local↔cloud spectrum — per-call, per-automation, per-capability, or per-vault default with overrides?
- **Tentative leaning:** per-vault default + per-automation/per-call override; gates the [22](../platform/22-ai-foundations.md) broker routing UI and must be designed in when `11.x` begins.
- **Blocking?:** No (but a design constraint on `11.x`).

#### OQ-AINC-4 — When to surface the positioning publicly
- **Question:** Is the "AI-native company" positioning surfaced at beta, or held until the governed-agent surfaces actually ship?
- **Tentative leaning:** hold the explicit positioning until the surfaces exist; beta leads with the sovereignty/local-first story ([46](../platform/46-marketing-and-promotion.md)).
- **Blocking?:** No.

---

## Agent teams and orchestration — `OQ-AT-1` … `OQ-AT-5`

Source: [platform/69-agent-teams-and-orchestration.md](../platform/69-agent-teams-and-orchestration.md). **Post-beta, deliberately iterative — none gate any current stage.** This doc resolves [OQ-AINC-1](#oq-ainc-1--agent-as-roster-member-type-resolved-in-platform69-agent-teams-and-orchestrationmd) and takes a position on [OQ-AINC-2](#oq-ainc-2--capability-grantrevoke-ui-for-agents-in-v1-position-taken-in-platform69-agent-teams-and-orchestrationmd).

#### OQ-AT-1 — Assignment exclusivity
- **Question:** Is single-`assignee` semantic ownership of a task enough, or do overlapping autonomous agents need a soft-claim (short-TTL "working on this" marker) to avoid duplicated effort before `status` flips?
- **Tentative leaning:** start with `assignee` (CRDTs merge, so no lock is needed for correctness); add a soft-claim only if real contention appears.
- **Blocking?:** No.

#### OQ-AT-2 — Agent→agent Chat actuation
- **Question:** When agent A @-mentions agent B in Chat, does B auto-run, or does an agent→agent mention require a human turn to actuate (a throttle against agent chatter / runaway cost)?
- **Tentative leaning:** human-in-the-loop by default, with an explicit per-thread "let them collaborate" grant.
- **Blocking?:** No.

#### OQ-AT-3 — Seeded starter roster
- **Question:** Which starter agents ship (Builder / Reviewer / Researcher?), is seeding opt-in at OOBE or always-on, and do they carry the dogfood persona names/themes or neutral role names?
- **Tentative leaning:** 2–3 conservative-default (`ConfirmOnWrite`, local-preferred) starters, always-on but fully editable/deletable; neutral role names.
- **Blocking?:** No.

#### OQ-AT-4 — Delegation-tree governance
- **Question:** Max delegation depth, cycle detection (A→B→A), and whether the routing cost ceiling ([OQ-AINC-3](#oq-ainc-3--localcloud-routing-granularity)) is shared across a delegated tree or per-agent.
- **Tentative leaning:** undecided; single-hop manager→worker is safe today via recursive capability intersection, but multi-hop autonomy needs depth/cycle/budget bounds set first.
- **Blocking?:** **Blocks** multi-hop autonomous delegation; non-blocking for single-hop.

#### OQ-AT-5 — Agent/team template content-kind mechanics
- **Question:** Marketplace distribution of agent + team templates ([69 §Marketplace distribution](../platform/69-agent-teams-and-orchestration.md)) needs three calls in the [47](../apps/47-marketplace.md) content-kind registry: (a) does persona prose — third-party *prompt text* prepended to a capability-holding system prompt — get a new `active-prompt` threat profile, or is it reviewed as active-code-equivalent? (b) what does prompt-level review concretely check ([32-store-verification](../apps/32-store-verification.md) lane)? (c) is a team template one bundle or a composition of `AgentTemplate` items via the descriptor's `references` mechanism?
- **Tentative leaning:** review as active-code-equivalent (behavioral review model, mandatory signature) rather than minting a new profile until a second prompt-carrying kind exists; team template as one bundle referencing `WorkflowPack` deps, since its delegation edges are meaningless split across separately-installable items.
- **Blocking?:** Blocks marketplace *distribution* of templates only; non-blocking for agent-teams v1 (seeded starters use the same `AgentTemplate` format from a bundled source).

---

## Agent observability — `OQ-AO-1` … `OQ-AO-5`

Source: [platform/77-agent-observability.md](../platform/77-agent-observability.md). Plan rungs `Agent-12a`–`Agent-12e`. Only OQ-AO-1 blocks the track's first rung; the rest are leaf-local.

#### OQ-AO-1 — Trace retention window and caps
- **Where:** [77 §The data model](../platform/77-agent-observability.md).
- **Question:** How long do `agent_runs` / `agent_events` rows live, and what are the count/size caps? The trace is an operational record, not an archive — but "what did agents do last month" is a legitimate query, and per-entity history via `agentProvenance` outlives any window.
- **Options & trade-offs:** Short window (7–30 days, aggressive prune — `AiUsageRepo.prune` shape) keeps the DB small but truncates the Settings activity view; long window (6–12 months) serves audit questions but grows `account.db` with event-per-tool-call granularity; tiered (events pruned early, run summaries kept long) adds a second shape but matches how the surfaces actually read.
- **Tentative leaning:** tiered — events ~30 days, run rows ~12 months, both count-capped; creation provenance on entities is permanent regardless (it lives on the entity, not in the trace).
- **Blocking?:** **Blocks Agent-12a** (the prune contract is part of the schema).

#### OQ-AO-2 — App-facing read surface
- **Where:** [77 §The surfaces](../platform/77-agent-observability.md).
- **Question:** May an app query runs beyond its own (e.g. a third-party dashboard app reading the whole vault's agent activity), and if so behind what capability?
- **Options & trade-offs:** Shell-surfaces-only (Settings + each app's own runs) needs no new capability and leaks nothing; a `agent.trace:read` capability enables ecosystem dashboards but hands an app a map of the user's entities and habits — high-sensitivity metadata for speculative value.
- **Tentative leaning:** shell-surfaces-only for v1; revisit if a real consumer appears.
- **Blocking?:** Blocks only Agent-12d's *app-facing* variant, which the leaning rejects anyway; non-blocking with the shell-only position.

#### OQ-AO-3 — Opt-in debug capture
- **Where:** [77 §Principles](../platform/77-agent-observability.md).
- **Question:** Does a default-off, explicit-consent, self-expiring "capture full prompts/completions for this conversation" debug mode ever exist (for diagnosing bad agent behaviour), or is metadata-only absolute?
- **Options & trade-offs:** Absolute is the cleanest privacy story and the substrate is complete without capture; a scoped debug mode materially helps "why did it do that" support cases but creates a plaintext-prompt store that must be excluded from sync/export and reliably expired.
- **Tentative leaning:** not in v1; the metadata timeline plus the existing message transcript answers most "why" questions.
- **Blocking?:** No.

#### OQ-AO-4 — Denial notification posture
- **Where:** [77 §The surfaces](../platform/77-agent-observability.md).
- **Question:** Are denials passive (timeline + badge, discovered on inspection) or active (toast / inline notice the moment a tool call is refused)? Fail-closed silence is the failure mode being fixed — but automations denying in a loop could toast-storm.
- **Options & trade-offs:** Passive never nags but repeats the "silently broken" pattern one level up; active surfaces breakage immediately but needs per-run coalescing and a quiet mode for expected denials (a narrowed conversation refusing by design).
- **Tentative leaning:** active-but-coalesced in chat (the Agent-5 escalation prompt *is* the active surface — extend it), passive badge for automations with denial-state on the run row.
- **Blocking?:** No — Agent-12b can ship the leaning and adjust.

#### OQ-AO-5 — Model-call event granularity
- **Where:** [77 §The data model](../platform/77-agent-observability.md).
- **Question:** Is `model-call` one event per provider round-trip or one per loop iteration (a multi-tool turn can make N provider calls), and does it duplicate what `ai_usage` already rows?
- **Options & trade-offs:** Per-round-trip is honest and joins `ai_usage` 1:1 but doubles rows for pure bookkeeping; per-iteration is coarser but the timeline mostly wants tool/proposal events anyway — the model-call is connective tissue.
- **Tentative leaning:** don't row `model-call` at all in v1 — add a nullable `run_id` to `ai_usage` and derive the timeline's model steps from the join; one accounting substrate, zero duplication.
- **Blocking?:** No — resolve inside Agent-12a's schema review.

---

## Mobile companion — `OQ-MOB-1` … `OQ-MOB-7`

Source: [platform/76-mobile-companion.md](../platform/76-mobile-companion.md). **Design-only track — no development scheduled; none gate any current stage.** The plan rungs are `MOB-0`–`MOB-8`.

#### OQ-MOB-1 — Client framework
- **Where:** [76 §The load-bearing fact](../platform/76-mobile-companion.md).
- **Question:** React Native + Expo (Hermes) vs fully native Swift/Kotlin vs web-wrapper (Capacitor/PWA) for the companion app.
- **Options & trade-offs:** RN/Expo reuses the portable TS vault core (Yjs + `@noble` crypto + wire + codecs) verbatim — the decisive argument; native means reimplementing or embedding that core per platform; web-wrapper can't do share extensions / keystore / background sync properly and is rejected outright.
- **Tentative leaning:** RN + Expo, **confirmed empirically by the `MOB-0` spike** (pair a bare RN scaffold with a real desktop shell over the dev relay; measure crypto + CRDT load on Hermes) — a paper decision here repeats the OQ-128 mistake.
- **Blocking?:** **Blocks all mobile work** (`MOB-1`+). Resolve via `MOB-0`, nothing else starts first.

#### OQ-MOB-2 — Editor strategy
- **Where:** [76 §Editor](../platform/76-mobile-companion.md).
- **Question:** How mobile renders/edits universal-body Lexical documents: (a) WebView hosting the real `@brainstorm/editor` on the same Y.Doc, (b) native read-only block renderer + append-only capture composer, (c) a native rich editor.
- **Options & trade-offs:** (a) full fidelity, one editor codebase, but WebView keyboard/IME/scroll seams; (b) fast and robust, no editing parity; (c) forks document semantics forever — rejected.
- **Tentative leaning:** (b) ships first, (a) follows for full editing (`MOB-7`); CRDT merge makes the append/edit split safe.
- **Blocking?:** Blocks `MOB-4` (read surfaces) and `MOB-7` (editing); the (b)-first leaning unblocks `MOB-4` on its own.

#### OQ-MOB-3 — Selective-sync defaults
- **Where:** [76 §Sync](../platform/76-mobile-companion.md); [20 §selective sync](../data/20-database-growth-and-sync.md).
- **Question:** What the companion syncs eagerly (leaning: all entity metadata + properties), what it pins for offline (recent/starred working set — how bounded?), and the body/asset eviction policy.
- **Blocking?:** Blocks `MOB-3` (sync + local store) tuning, not its architecture.

#### OQ-MOB-4 — Push-notification plane
- **Where:** [76 §Notifications](../platform/76-mobile-companion.md).
- **Question:** Local-only notifications ship in v1. If/when that proves insufficient, does the durable node emit a **content-free sync tickle** through APNs/FCM ("something changed for account X — wake and sync")?
- **Options & trade-offs:** even a content-free push leaks activity timing/frequency to Apple/Google and is the first mobile-specific server surface; the alternative (background-fetch polling) is OS-throttled and unreliable.
- **Tentative leaning:** defer until local-only demonstrably fails; if built, tickle-only, never content.
- **Blocking?:** No (post-`MOB-6`).

#### OQ-MOB-5 — Repo home + core extraction mechanics
- **Where:** [76 §Repo & team shape](../platform/76-mobile-companion.md).
- **Question:** Where the mobile app and the portable `vault-core` live, and how the app consumes the core across the boundary.
- **Tentative leaning:** core in the product monorepo (`packages/vault-core` — lockstep with the shell that writes the data); app in a sibling repo (`brainstorm-mobile`, the `../brainstorm-sync` pattern) so Metro/Xcode/Gradle never enter the shell workspace; consumption pinned by commit/version with the `MOB-0` pairing test as the skew gate in mobile CI.
- **Blocking?:** Blocks `MOB-1`/`MOB-2` scaffolding.

#### OQ-MOB-6 — Store & compliance constraints
- **Where:** [76 §Distribution](../platform/76-mobile-companion.md).
- **Question:** App Store / Play review constraints that could bite: crypto-export self-classification, Expo OTA-update policy boundaries, background-execution entitlements for sync, share-extension memory limits (iOS extensions get ~120 MB — does the sealed-outbox write path fit?).
- **Blocking?:** Blocks `MOB-8` (store beta); investigate during `MOB-2`.

#### OQ-MOB-7 — Capture-outbox sealing
- **Where:** [76 §Capture outbox](../platform/76-mobile-companion.md).
- **Question:** Exact mechanics of write-without-unlock capture: derivation/storage of the vault-scoped X25519 public key available to extensions, outbox storage location + quota, drain-into-entities semantics (dedupe, ordering, failure), and whether the outbox format is the HPKE seal used for member wraps or a dedicated envelope.
- **Tentative leaning:** reuse the existing HPKE primitives ([16](../security/16-identity-orgs-encryption.md)); extension holds public key only, write-only queue, drained on next unlocked launch.
- **Blocking?:** Blocks `MOB-5` (capture).

---

## Peer-to-peer sync: `OQ-P2P-1` to `OQ-P2P-6`

Source: [platform/79-p2p-sync.md](../platform/79-p2p-sync.md), the `P2P-0` spike report (2026-07-31). Plan rungs are `P2P-1`–`P2P-4`. `OQ-P2P-1` and `OQ-P2P-2` were named as blocking by the `P2P-0` rung and are **resolved by the spike**; they are kept here with their positions because downstream rungs lean on them. The original `OQ-P2P-3` (does peer-to-peer change the multi-user trust model, or only the transport) is **answered: only the transport**, per [79 §6](../platform/79-p2p-sync.md), and the number is reused below for a genuine unknown rather than kept alive for a settled one.

#### OQ-P2P-1: Discovery and transport *[RESOLVED in 79 §3 + §4, `P2P-0`]*
- **Where:** [79 §3 Discovery](../platform/79-p2p-sync.md), [79 §4 Transport](../platform/79-p2p-sync.md).
- **Question:** How peers find each other (mDNS vs a signaling server vs manual codes) and what carries the sealed frames (raw TCP/TLS vs QUIC vs WebRTC data channels vs the existing WebSocket relay port).
- **Resolution:** **Transport is already determined by shipped code** and was not re-decided: `ActiveRelayKind.Lan` and `ActiveRelayKind.WebSocket` are the same `WebSocketRelayPort` class with a different address and a different injected handshake (`main/index.ts`, the `makeRelayPort` branch). QUIC rejected (native/immature dependency in the packaging matrix for a workload of small frames on one logical stream, where the measured connect is 3 to 5 ms and handshake crypto is sub-millisecond warm). WebRTC rejected for the LAN (it is a NAT-traversal system with a data channel attached; on a link where both peers already see each other it is all cost and no benefit). **Discovery** is a combination in precedence order: the pairing payload's `relayUrl` for bootstrap, mDNS/DNS-SD `_brainstorm-sync._tcp` via the pure-JS `bonjour-service` for re-discovery, manual `host:port` always available. A signaling server is rejected for LAN discovery, since it reintroduces the server the feature exists to remove and would need to be reachable exactly when the internet is not.
- **Evidence:** prototype measured 228 ms cross-machine mDNS resolve on a real LAN, 13 to 22 ms discovery to admitted, and the advert visible to the native macOS `mDNSResponder` on `en0` ([79 §2](../platform/79-p2p-sync.md)).
- **Blocking?:** No longer. Was blocking `P2P-1`.

#### OQ-P2P-2: Relay fallback and the durable node's snapshot authority *[RESOLVED in 79 §7, `P2P-0`]*
- **Where:** [79 §7 Relationship to the relay](../platform/79-p2p-sync.md).
- **Question:** Does peer-to-peer replace, supplement or race the relay, what happens when both are available, and does a LAN-synced device conflict with the durable node's snapshot on reconnect?
- **Resolution:** **Supplement, exclusively.** One transport at a time, LAN preferred, relay as automatic fallback. Dual transport and racing are rejected: both would mean the relay observes exactly the timing and volume metadata that LAN mode exists to avoid, which silently falsifies the `LAN-5` "syncing on your local network, no server" status claim, and a false privacy claim is a trust failure rather than a cosmetic one. Exclusive selection is only acceptable **with** the 3 s connect deadline from `OQ-P2P-1`'s transport work, because a dial to a sleeping peer otherwise takes a measured 75,010 ms to fail, turning transport selection into a 75-second sync outage. On snapshot authority there is **no conflict to resolve**: the durable node is a store, not an arbiter (Yjs merge is commutative and idempotent, `SeqTracker` bounds replay, and the `LAN-8` state-vector diff path already exists), so reconnecting to the relay is the same operation as reconnecting to a peer. The residue is a *staleness gap*, not a conflict: two devices co-editing on LAN who never reach the relay leave the node's copy old, so a cold third device restores an old state. That is already the documented fresh-device bootstrap position in [20](../data/20-database-growth-and-sync.md) and should be surfaced to the user rather than hidden. Relay blindness does not regress, because nothing about the relay changes.
- **Blocking?:** No longer. Was blocking `P2P-1`/`P2P-2`.

#### OQ-P2P-3: Does discovery bind UDP 5353 alongside the platform responder on Windows and Linux?
- **Where:** [79 §8 Portability](../platform/79-p2p-sync.md).
- **Question:** `avahi-daemon` on most Linux desktops and the built-in responder on Windows 10+ both hold port 5353. `multicast-dns` (under `bonjour-service`) sets `SO_REUSEADDR`, which is usually enough. "Usually" is not a design position, and this was **not tested**: the `P2P-0` prototype ran on macOS only.
- **Options & trade-offs:** if it binds cleanly, one discovery implementation across all three platforms; if it does not, the fallbacks are a custom UDP multicast beacon on the affected platform, shelling out to the platform responder (native dependency, packaging-matrix cost), or dropping those platforms to bootstrap-plus-manual only.
- **Tentative leaning:** expect it to work, verify before building on it. This is the one item that could change the discovery recommendation per platform.
- **Blocking?:** Blocks the discovery item of `P2P-1` on Windows and Linux. Does not block the track, and does not block `P2P-1` items 1 to 3 (the pairing-address bootstrap, the dial flow, and the deadline/heartbeat work), which have no multicast dependency.

#### OQ-P2P-4: Is `P2P-3` worth building at all?
- **Where:** [79 §5 NAT traversal](../platform/79-p2p-sync.md).
- **Question:** Full ICE/STUN/TURN would let two of your machines connect directly across the internet. Is that worth a permanently-maintained subsystem?
- **Options & trade-offs:** the spike's argument for no: NAT traversal needs a rendezvous server anyway, so it does **not** deliver "no server"; and the relay is *already blind* (sealed ciphertext addressed by opaque routing tokens), so it does not deliver confidentiality either. The payoff is latency, bandwidth cost, and independence from relay availability and quota. Those are real but they are optimisations, not the product claim, and they do not obviously justify the maintenance. The LAN case is different and is why `P2P-1` is the hero: on a LAN there is genuinely no third party at all and it works with the internet unplugged.
- **Tentative leaning:** re-scope `P2P-3` to best-effort direct connectivity where the network already allows it (same NAT by private address, opportunistic UPnP-IGD / NAT-PMP, manual port forward), all of which reuse the shipped transport unchanged. Do not build full ICE without a user asking. **If it is ever built, the blind relay is the signaling channel** (authenticated, always reachable, content-blind), so no new server and no new trust relationship, and WebRTC arrives as a second `RelayPort` behind the existing `active-relay.ts` seam.
- **What would change this:** relay bandwidth becoming a real cost line at scale, or a user segment that cannot use a relay for policy reasons and is not co-located.
- **Blocking?:** Blocks `P2P-3` only. Forecloses nothing: choosing the WebSocket transport now does not prevent adding WebRTC later.

#### OQ-P2P-5: The discovery tag: derivation, rotation cadence, and what replaces it for multi-user
- **Where:** [79 §3.1](../platform/79-p2p-sync.md).
- **Question:** Automatic discovery introduces a leak the pairing-address world does not have. In the shipped handshake the client speaks first, and what it says is `hello{deviceAccount}`, its Ed25519 device public key, in cleartext, before the host has authenticated anything. That is sound when the only address a device ever dials came from a pairing payload it already trusts. Once a device dials whatever advertises the service, **any machine on the network can harvest stable per-device identity keys by advertising and waiting**, recognise the same laptop on a later visit, and link two of your machines by collecting both. The channel-bound handshake stops the attacker being *admitted*; it does not stop the disclosure, because the disclosure is the first message. Threat T6 in [lan-p2p-sync.md](../data/lan-p2p-sync.md) anticipated the *beacon* side of this and specified a non-linking TXT; it did not anticipate the *dial* side, which does not exist in a pairing-address world.
- **Options & trade-offs:** the spike's proposal is that the advertiser proves it belongs to your identity **before** you dial: derive a discovery secret once as `HKDF(sovereign user key, "brainstorm/lan-discovery/v1")` and put a truncated `HMAC(discovery secret, coarse time epoch)` in the mDNS TXT. Own devices recognise it instantly (they all hold the same sovereign key), a passive sniffer sees an opaque value that rotates on its own, and a rogue advertiser cannot produce one. Open sub-questions: the exact truncation length, the epoch granularity (the clock-skew tolerance versus the linkability window), whether to accept the adjacent epoch, and whether the tag should also cover the advertised port. The alternative shape is a blinded or ephemeral `hello`, which is more crypto on the hot path for the same property.
- **The part that does not generalise, deliberately:** two different users share no such secret, so **`P2P-4` cannot reuse this** and needs its own answer built on the `Collab-C5`/`C6` sharing model. That is the point of naming it: it keeps multi-user out of the `P2P-1` design instead of half-designing it, and makes "does this require admitting a *different* identity?" the test for whether a proposal is in scope.
- **Blocking?:** Blocks the discovery item of `P2P-1`. It is a security requirement of automatic discovery, not an enhancement, and should land in the same change as the mDNS work.

#### OQ-P2P-6: Mobile's transport-only position
- **Where:** [79 §8 Portability](../platform/79-p2p-sync.md), [76 mobile companion](../platform/76-mobile-companion.md).
- **Question:** Does the mobile companion inherit peer-to-peer, and how much of it?
- **Tentative leaning:** **client only, never host, discovery deferred.** It inherits the transport (a WebSocket client), the admission handshake (X25519 + Ed25519 + HPKE, all portable), the roster and the sealed envelope pipeline, all of which would live in the portable `@brainstorm/vault-core`. So a phone can be a fully-functional LAN client dialing an address supplied by pairing or handed to it by the desktop over the relay. It does **not** inherit the host role or the discovery role, for three reasons in order of difficulty: iOS requires the `com.apple.developer.networking.multicast` entitlement (an approved request to Apple) to use multicast at all; Android needs a multicast lock via `NsdManager`; and both platforms restrict background execution hard enough that a phone cannot be relied on to be listening, quite apart from whether a phone should bind an inbound socket on an untrusted network. Consequence to accept explicitly: phone-to-phone LAN sync is out of scope indefinitely.
- **What to verify:** the iOS entitlement and Android multicast-lock constraints, before any `MOB-*` work assumes otherwise.
- **Blocking?:** Blocks nothing now. Design-only, alongside the rest of the `MOB-*` track.

---

### How to use this list

- Each open question must be either **answered** (move the resolution into the source doc, drop the entry here) or **kept as known unknown** until implementation forces it.
- The cross-doc consistency review (next pass) should ensure that any "tentative leaning" used as a load-bearing assumption elsewhere is flagged.
