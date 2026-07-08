# 73 — Rotate-on-revoke (forward-secret revocation)

Design for making **"remove access" cryptographically effective**: after an Owner revokes a member, that member must not be able to read edits made *after* the revocation. Planning doc — no code yet; this fixes the choreography, the guarantee, the failure modes, and the open questions before a line is written, because this is the **most security-critical operation in the product** and a wrong call here silently leaks a collaborator's data.

Builds on:
- [16-identity-orgs-encryption.md](16-identity-orgs-encryption.md) — the identity + per-entity DEK + HPKE member-wrap model this rotates.
- [../data/71-collection-sharing.md](../data/71-collection-sharing.md) + `Collab-C5` — the share/revoke surface (`SharingEngine.revoke`) this hooks.
- `10.11` routing-token rotation (`main/sync/routing-rotation.ts`, `main/sync/routing-token.ts`) — the **already-built, crash-safe token re-home** this design triggers.
- [../data/05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) / the envelope pipeline (`main/sync/envelope-pipeline.ts`) — the wire this protects.
- `F-286` (friction log) — the dogfood finding: after `revoke(Marcus)`, Marcus's shell kept decrypting new edits with the DEK it already held.

## The problem, precisely

Today `SharingEngine.revoke()` appends a signed `revokedAt` to the access record — a **policy** statement. But the per-entity **DEK is unchanged**, and the revoked member's device already holds it (from the original member-wrap). Every subsequent update frame is sealed under that same DEK, so the revoked device decrypts post-revocation edits exactly as before. Revocation is not cryptographically effective until the DEK **rotates** and the new DEK is re-wrapped for the *remaining* members only. This was a deliberate v1 limitation (OQ-203; the envelope pipeline notes "existing DEKs are NOT re-wrapped … a `10.10`-style rotation operation"). This doc closes it.

## The guarantee (and its honest limit)

**Guarantee:** after rotation completes, a revoked member **cannot decrypt any frame authored after the rotation**, and cannot even find the entity's traffic on the relay (the routing token is `HKDF(DEK)`, and they never receive the new DEK).

**Honest limit — forward secrecy, not clawback.** Anything the revoked member already synced and applied to their local vault is *theirs*; no protocol can un-see it. "Remove access" means **from now on**, not retroactively. The UI/notes must say this plainly (a removed collaborator keeps what they'd already synced). This is the same guarantee every honest E2E system offers on revocation.

## The load-bearing layering insight

The per-entity DEK protects **two things only**: (1) the **wire** (relay update/snapshot frames), and (2) the **member-wraps** (the DEK sealed to each member's device). It does **not** protect the local at-rest doc — that's sealed under the **vault master key** by the ydoc-store. Consequences that make this tractable:

- Rotation does **not** re-encrypt local storage. A remaining member has already *applied* history into its local doc (under the master key); it doesn't need the old DEK to keep reading what it already has.
- Rotation is therefore: **mint DEK′ → re-wrap DEK′ for remaining members → re-seal the current doc state as a fresh snapshot under DEK′ → move the wire to the new routing token.** The old DEK becomes vestigial for remaining members (needed only briefly, for in-flight old-token frames during the grace window).

## Choreography (Owner-driven, fail-closed)

Triggered by `SharingEngine.revoke(entityId, member)`. All steps are the Owner's (only an Owner may grant/revoke — the C1 policy):

1. **Revoke (policy).** Append the signed `revokedAt` to the access record (today's behavior) and persist.
2. **Mint DEK′.** `EntityDekStore` produces a fresh 32-byte DEK for the entity (new `dekId`). The old DEK is retained locally for the grace window (see §Crash-safety), not immediately destroyed.
3. **Re-wrap for the survivors.** For each **currently-active** member (from `resolveCurrentMembers`, i.e. everyone *except* the just-revoked member — and including the Owner's own other devices), HPKE-seal DEK′ to their device X25519 key (`wrapDekForRecipient`) and stage the wraps. The revoked member is, by construction, not in this set → never receives DEK′.
4. **Re-seal the snapshot.** Serialize the entity's current doc state and seal it under DEK′ as a new snapshot addressed by the **new routing token** `token′ = HKDF(DEK′, entityId)`.
5. **Re-home the wire (10.11, already built).** Call `RoutingRotationCoordinator.rotate(entityId, DEK′)` — it persists the intent, asks the node to migrate storage `token → token′` (journaled, crash-resumable, dual-token grace alias), and **flips local emission to token′ only on the node's `rotated` ack** (fail-closed: a denied/timed-out re-home leaves emission on the old token and the persisted intent retries).
6. **Publish the wraps + rotation envelope.** Emit DEK′'s member-wraps (HPKE-sealed per device) + a rotation marker so remaining members install DEK′, switch their subscription + emission to token′, and drop the old DEK after the grace window.

A remaining member's device: receives the DEK′ wrap (sealed to it), installs DEK′, re-subscribes on token′, reads the DEK′ snapshot, resumes editing. A revoked member's device: holds only the old DEK, can derive only the old token; after the node's grace alias expires the old token is dead and it sees nothing new.

## Crash-safety & the hard cases

- **Fail-closed ordering.** Emission must not flip to token′ until (a) DEK′ is durably persisted and (b) the node acked the re-home. The 10.11 coordinator already enforces (b) with persisted-intent + flip-on-ack + `resumePending` on boot/reconnect; this design must persist DEK′ (step 2) *before* calling `rotate` so a crash between them is recoverable (the DEK exists; re-drive the rotate). **Never** discard the old DEK before the new snapshot is durable — a crash there must not strand the entity.
- **Offline remaining member (the hardest case).** A member offline during rotation knows only the old token. The node's **dual-token grace alias** (`from → to`, 10.11) serves them on reconnect within the grace window, delivering the DEK′ wrap so they catch up. **Beyond** the grace window the old token is reclaimed — a long-offline member must re-discover the entity via the account **catalog** (which records the current token) and fetch the wrap. *OQ-REV-2: is catalog-based re-discovery sufficient, or does a member offline past the grace window need an explicit re-share?*
- **Multi-device Owner.** The revoking device re-wraps DEK′ for the Owner's *own* other devices (they're active members). Standard survivor handling — no special case, but the design must not forget the Owner is a member.
- **Concurrent revokes / rotations.** Owner-only + causal (the access record is a signed append-only log). Two rotations racing converge on the latest DEK (the coordinator's `resumePending` already drops a superseded hop when the DEK rotated again). *OQ-REV-3: pin the causal-order contract when two Owner devices revoke different members concurrently.*
- **Collection cascade.** Revoking on a shared container (channel/project, design 71) must rotate every child entity too (each has its own DEK). Reuse the C5 cascade walk; rotation is per-entity. *OQ-REV-4: cascade rotation cost + atomicity on a large collection (mirrors the 71 §Performance cascade note).*

## Threat model (what the design must hold against)

- **The evicted member** — the primary adversary. Post-rotation they hold the old DEK + old token only. Must NOT: decrypt any DEK′ frame, derive token′ (needs DEK′), or obtain a DEK′ wrap (never sealed to them). MAY retain: everything they synced before revocation (accepted limit). A **malicious** evicted member replaying the old token hits a dead channel after the grace alias expires.
- **The relay/node** — relay-blind throughout. Sees ciphertext keyed by opaque tokens; the `rotate {from,to}` op tells it to migrate storage but reveals only that *a* rotation happened (the pseudonymization win, not unlinkability — same posture as 10.11). Never sees a DEK or plaintext.
- **A remaining member** — trusted for the entity; gets DEK′ legitimately. Not an adversary, but the design must ensure they don't get *stuck* (offline case above) — a correctness, not confidentiality, concern.

## Open questions

- **OQ-REV-1** — old-DEK lifetime on remaining devices: drop immediately after DEK′ install, or retain for the grace window to decode in-flight old-token frames? (Lean: retain for the grace window, then zero.)
- **OQ-REV-2** — long-offline remaining member past the grace window: catalog re-discovery of token′ + wrap fetch sufficient, or require an explicit re-share? (Determines whether rotation can ever *lose* a legitimate member.)
- **OQ-REV-3** — causal-order contract for concurrent Owner-device revokes/rotations.
- **OQ-REV-4** — collection-cascade rotation: cost + atomicity + partial-failure recovery on a large shared container.
- **OQ-REV-5** — does rotation-on-revoke also imply **key rotation on any access change** (e.g., role downgrade Editor→Viewer)? A downgraded member still *reads*, so no DEK rotation is needed for a downgrade — only removal rotates. Confirm and document (rotation triggers on **removal**, not every access-record write).

## Iteration plan (proposed — the 0.3.0 headline)

- **`ROT-1` — DEK-mint + survivor re-wrap (pure core).** Given an entity + the post-revoke active-member set, mint DEK′ and produce the HPKE wraps for survivors. Pure over injected crypto; property-tested (revoked member never in the wrap set; every survivor + owner-other-device is; wrap opens only with the right device key).
- **`ROT-2` — snapshot re-seal + rotation-coordinator wiring.** Re-seal current doc state under DEK′; drive `RoutingRotationCoordinator.rotate`; persist DEK′ before the call; publish wraps + rotation marker. In-process pipeline test: revoke → rotate → a survivor reads on token′, the revoked identity's old-token/old-DEK path yields nothing new.
- **`ROT-3` — revoke path + grace/offline handling.** Hook `SharingEngine.revoke`; old-DEK grace lifetime (OQ-REV-1); offline-survivor catalog re-discovery (OQ-REV-2); collection cascade (OQ-REV-4).
- **`ROT-4` — verification.** A **dedicated `/security-review` + `/pentester` pass** on the whole path (this is the gate, not optional); a two-shell real-relay dogfood proving the F-286 scenario is closed (revoked shell cannot read a post-revoke edit); friction F-286 → ✅.

**Gate:** `ROT-4`'s adversarial review is a hard merge gate. Rides the 0.3.0 "Trustworthy collaboration" train alongside presence + the accumulated fixes.
