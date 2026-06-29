# 71 — Collection sharing (cascade membership to a container's children)

Status: **design — revised after adversarial review + a real-query test** (Collab-C5 extension; gates the M1 "team chats in a shared channel" milestone). Builds on [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (DEKs, access records, HPKE member-wraps, the blind relay), [21-objects-and-collections.md](21-objects-and-collections.md) (the unified Collection / `List/v1` model and `source`-query membership), and the always-on `LiveSyncEngine` (implementation-plan §10.12). It assumes the C1–C4-live crypto spine and the production `sharing` broker service already exist (they do).

> **Review revisions (2026-06-29).** The eager-copy architecture survived an adversarial review and a real-query test against `entities.db`; six corrections were folded back in and are marked **[rev]** below: (1) child enumeration is a `composite(byType ∧ byFilter)`, not a bare `byFilter` (a bare filter can't see an entity's `type`); (1b) a child-parent **property key containing dots** (Tasks' `io.brainstorm.tasks/project`) can't be addressed by `byFilter` (the path evaluator splits on `.`) — those collections enumerate via a **persisted containment link edge + `byLink`** instead, which also removes the full-vault scan; (2) the cascade's recipient set is the **signed access record** (`resolveCurrentMembers`), never the local, possibly-stale `wraps` array; (3) a member's X25519 wrapping key is carried in the **signed grant**, not as an unauthenticated field on the wrap; (4) the cascade is **capability-gated and authorization-policy-gated** (the cascade multiplies the blast radius of the deferred only-Owner-may-grant policy); (5) the cascade runs **async, batched, capped, and idempotently resumable**, not synchronously inside the IPC handler; (6) a member granted but whose X25519 hasn't yet replicated locally is handled by a **deferred re-cascade**, not silently skipped.

## The gap

Sharing today is **strictly per-entity**. `SharingEngine.share` ([`main/collab/sharing-engine.ts`](../../packages/shell/src/main/collab/sharing-engine.ts)) grants one member access to one entity, HPKE-wraps that entity's DEK to them, and emits the entity's state. `LiveSyncEngine.isShared` then keys off **that entity's own** access record (>1 active member) to start syncing it. This is correct and proven (the `collab-001`/`002`/`005` real-shell sessions).

But the things a *team* works in are **collections of many entities**:

| Collection (container) | Child entities | Child→parent link (today) |
|---|---|---|
| Chat **Channel** (`io.brainstorm.chat/Channel/v1`) | each **Message** (`brainstorm/Message/v1`) | `properties.conversation === channelId` |
| **Project** (`brainstorm/Project/v1`) | each **Task** (`brainstorm/Task/v1`) | `properties["io.brainstorm.tasks/project"] === projectId` |
| **Whiteboard** / **Note** | *(none — nodes live inside the one Y.Doc)* | — (single-entity, already syncs whole) |
| **Calendar** | events (source-keyed, **no container entity today**) | — (unresolved, see §Calendar) |

Sharing a channel today shares **only the channel entity** — none of its messages follow, and messages created *after* the share never reach the other members. A growing message stream is exactly what "a team chatting" is, so this is the blocking gap for M1. Same shape for Project→Tasks (M2).

Two facts from the codebase shape the solution:

1. **The membership-resolution engine already exists and runs server-side.** `queryListSource(source, backend)` ([`main/entities/list-source-query.ts:162`](../../packages/shell/src/main/entities/list-source-query.ts)) resolves a `ListSource` (`byType` / `byFilter` / `byLink` / `byVocabulary` / `composite`) to a member-id set **in the main process**. The Database app already uses it via the `vaultEntities.querySource` IPC.
2. **Chat and Tasks do *not* use it** — they resolve membership with a **client-side property filter** in the renderer (`channelMessages()` at [`apps/chat/src/logic/chat.ts:158`](../../apps/chat/src/logic/chat.ts), `projectSurface()` at [`apps/tasks/src/logic/compile-surface.ts`](../../apps/tasks/src/logic/compile-surface.ts)), over the full `vaultEntities.list()` snapshot. The parent→child edges are **not** persisted in the SQL `links` table (chat's `conversation` isn't even a link-producing `entityRef`; tasks' `project` edge is derived in-memory for the renderer only).

So the enumeration the cascade needs (*"given this container, what are its children?"*) is available **as a query** (`queryListSource` with a `byFilter`/`byLink` source) without first migrating Chat/Tasks onto `List/v1` — the larger, separate doc-21 track.

## Decision: eager-copy membership, driven by a containment registry

> **Decision (eager-copy, not inherited):** sharing a collection **copies** the container's membership onto each child entity — each child gets its **own** access-record grant per member and its **own** DEK HPKE-wrapped to each member. Children are not given a pointer to "ask the parent who can read me." After the cascade, every child is an ordinary shared entity, so the **entire existing sync path applies unchanged** — `LiveSyncEngine.isShared` sees >1 member on the child's own record and syncs it with zero engine changes. The cascade is a pure `SharingEngine` concern.

Rejected alternative — *inherited membership* (children carry no access record; readers resolve "can I read this?" by walking to the parent). It saves per-child grants but forces `isShared`, the DEK model, and revocation to all become collection-aware, and breaks the invariant that an entity's readability is self-contained in its own doc. Too invasive for the payoff.

> **Decision (containment registry):** a small, declarative, main-process table maps a collection type to how its children are found. One entry per collection kind:
> ```ts
> type ContainmentRule = {
>   parentType: string;        // "io.brainstorm.chat/Channel/v1"
>   childType: string;         // "brainstorm/Message/v1"
>   childParentProp: string;   // "conversation"  (property on the child holding the parent id)
> };
> ```
> From one rule the engine derives **both** directions it needs:
> - **container → children** (initial cascade) **[rev]**: a `composite(AND)` `ListSource` of `byType([childType])` **and** `byFilter({$eq: {[childParentProp]: containerId}})`, resolved by the existing `queryListSource`. The `byType` clause is required because `byFilter` alone cannot see an entity's `type` (type is a top-level column, not a property) — and `byType` takes the SQL fast path while `byFilter` runs the shared predicate evaluator; the `AND` composite intersects. *Verified working against a real `entities.db` for Chat (`conversation`).* **[rev 1b]** When `childParentProp` **contains dots** (Tasks' `io.brainstorm.tasks/project`), `byFilter` cannot address it — the predicate path evaluator splits on `.` (`readPropertyPath`), so the dotted key reads a nonexistent nested path. Those collections instead **persist a containment link edge** (`source = childId`, `dest = containerId`) at the create chokepoint and enumerate via **`byLink(anchor = containerId, direction = In)`** over the SQL reverse index — `O(children)`, not the `O(total entities)` full-vault scan `byFilter` forces. (Chat works either way today via the composite; Tasks adopts the link-edge path in M2.)
> - **child → container** (auto-share on create): read `newEntity.properties[childParentProp]`; if it names a currently-shared container of `parentType`, cascade onto the new child.
>
> Single-entity collections (Note, Whiteboard) have **no rule** → they share exactly as today (the container is the whole doc). Calendar has no rule yet (§Calendar).

This keeps the per-app data models exactly as they are. The registry is the *only* new coupling between the sharing core and app-specific shapes, and it is one line per app.

## The three flows

All three live in `SharingEngine` (session-bound, already holds the DEK store, the entities repo, and the relay).

### 1. Cascade on share — `shareCollection(containerId, type, invite, role)`
1. `share(container, …)` exactly as today (grant + wrap container DEK + emit). The container becomes shared.
2. Enumerate children: `queryListSource(childrenSourceFor(rule, containerId))`.
3. For each child: grant the invitee in the child's access record, HPKE-wrap the **child's own** DEK to the invitee's X25519 key, emit the wrap to their inbox + emit child state. (Exactly the per-entity `share` body, looped — extract the shared inner step.)
4. `LiveSyncEngine.refreshMembership(childId)` so an open child starts syncing immediately.

### 2. Auto-share on create — hook the entities-service create chokepoint
`entities.create` is a single main-process chokepoint that fires `emitChange(Create, entityId, type)` post-commit ([`main/entities/entities-service.ts:316`](../../packages/shell/src/main/entities/entities-service.ts)). A new listener:
The hook payload is identifiers-only (`{verb, entityId, type}`, a security invariant — no property values cross it), and the emitter is **synchronous fire-and-forget that catches only synchronous throws** ([`entity-change-emitter.ts`](../../packages/shell/src/main/entities/entity-change-emitter.ts)). So the listener **[rev]** must re-read the entity, run **entirely inside its own try/catch**, and own its own retry queue — a dropped promise rejection here would otherwise vanish. It:
1. Looks up a containment rule by the new entity's `type`. None → done (the overwhelming-majority path; one map lookup, no cost).
2. Reads `properties[childParentProp]` → the parent id (durable: `repo.create` commits the properties *before* `emitChange` fires). Absent → done.
3. Checks the parent is a **shared** container (its access record lists >1 active member). Not shared → done (solo collection, no fan-out — mirrors `LiveSyncEngine`'s solo-quiet rule).
4. **[rev]** Cascades to the **active members named in the parent's signed access record** (`resolveCurrentMembers(containerDoc)`) — *not* the local `wraps` array, which is a per-device, possibly-stale snapshot. For each active member: grant in the child's record, HPKE-wrap the child's DEK to the member's X25519, emit. **The member's X25519 is read from their signed grant** (see below) — authenticated, unlike a bare wrap field.
5. **[rev] Deferred re-cascade.** If an active member's X25519 is not yet known locally (their container grant hasn't replicated to this device), the child **cannot** be wrapped to them now — wrapping requires a key this device has never received. The listener enqueues a deferred cascade keyed on `(childId, member)` and retries when that member's grant arrives on the container (the `LiveSyncEngine` already observes container access-record updates). Skipping is **not** acceptable — it silently drops a member from the stream.

The creator of the child is, by construction, a member who holds the container DEK, so it has everything to perform the fan-out locally for every member whose grant it has seen.

### 3. Revoke cascade — `revokeFromCollection(containerId, member)`
Revoke the member on the container, then on every current child (same enumeration as flow 1). Append-only signed revokes, as today.

## Resolving each member's X25519 wrapping key (revised)

The access record names members by **Ed25519** user key; member-wraps are addressed to **X25519** device keys. To wrap a new child's DEK to member M the cascade needs M's X25519 — *authentically* (a wrong key wraps to an attacker; an unauthenticated key lets a malicious member misdirect the cascade).

A first draft proposed stashing the member's Ed25519 on `MemberWrapPayload`. **The review correctly rejected this:** the wrap's AEAD AAD covers only the entity id, not the payload fields, so any added field is **unauthenticated** — a member could mislabel a revoked device's wrap as an active member's. Adding it to the AAD instead would invalidate every existing v1 wrap.

> **Decision [rev]:** carry the member's **X25519 wrapping key inside the signed access-record grant**, not on the wrap. When an owner shares, they already learn the invitee's X25519 from the (signed, X25519→Ed25519-binding) `ShareInvite`; the grant entry is signed by the granter, so embedding `{member: Ed25519, x25519, role}` makes the X25519 **authenticated by the same signature that authorizes the member**. `resolveCurrentMembers` then returns each active member's X25519 directly — the cascade reads the signed truth, never the wrap array. This supersedes the `userPubB64`-on-wrap idea entirely. The grant-payload change bumps the access-record grant format (additive; signature recomputed; pre-existing single-entity grants without an X25519 fall back to the container's `wraps` lookup for that one member). Detailed in the `C5-collection-core` rung.

This also fixes the recipient-selection hole: the recipient set is `resolveCurrentMembers` (the signed grant list), so a **granted-but-wrap-not-yet-synced** member is still *seen* (they're in the record) and handled by the deferred re-cascade (flow 2 step 5), and a **revoked** member is simply absent from the active set — revoke precision falls out for free.

## Calendar (deferred to M3)

Calendar events are **source-keyed** (`calendar:event`, [`apps/calendar/src/logic/scheduled-item.ts:21`](../../apps/calendar/src/logic/scheduled-item.ts)), not children of a container entity — there is no "Calendar" entity to share. M3 resolves this first: either introduce a `brainstorm/Calendar/v1` container with an `Event.calendarId` link (then it gets an ordinary containment rule), or treat a shared calendar as a `List/v1` Collection of dated entities. This is a product-shape question, not a sharing-core question — the core above is calendar-agnostic.

## Performance

Per-child, per-member work: one HPKE wrap + one access-record grant + one relay frame. Sharing a channel of **M** messages with **K** members = `M·K` wraps in the initial cascade; steady-state, each new message = `K` wraps. Bounds:
- A demo channel is tens–hundreds of messages; `M·K` is small. **[rev]** The initial cascade does **not** run inside the `shareCollection` IPC handler — it returns the container-share result immediately and runs the child fan-out **asynchronously off the reply**, batched, with a concurrency cap and progress events. Enumeration uses `byLink` over the SQL reverse index where the link-edge path applies (`O(children)`), avoiding the `byFilter` full-vault scan.
- **[rev] Idempotent resume.** The cascade persists a per-`(child, member)` cursor so a crash/partial failure re-runs only the unfinished pairs (`grantAccess` is already idempotent; the wrap step short-circuits when a wrap for that device already exists). A repair pass reconciles any `(child, member)` the cursor shows incomplete — the create-hook fire-and-forget path depends on this, since a dropped steady-state cascade would otherwise lose one message for one member with no signal.
- Steady-state `K` wraps per message is the genuine cost of per-entity DEKs. It is bounded by team size, not history.

> **Future optimization (out of scope here): a per-collection DEK.** All children encrypted under the *container's* DEK collapses sharing a collection to **one** wrap per member and makes new children readable with no per-child wrap at all. It trades away per-entity revocation granularity and breaks the one-DEK-per-entity invariant, so it is a separate, larger crypto decision — noted, not taken.

## Security considerations

- **No new wire capability.** Every cascaded grant/wrap/emit is the existing per-entity primitive; the relay stays blind (only DEK-sealed envelopes cross it). The cascade is orchestration over proven moves.
- **Authorization [rev] — the cascade multiplies a known gap, so gate it.** The access record has **no authorization policy yet**: `resolveMembers` verifies a grant's signature against its *self-declared* `addedBy`, so today *any* member (even a Viewer) can sign a grant adding anyone. Single-entity sharing masks this behind the scarce `sharing.share` cap and an owner-initiated flow; the **cascade removes that masking** by signing grants on a hot create path for every child. Therefore: (a) `shareCollection`/`revokeFromCollection` stay behind the scarce **`sharing.share`** capability; (b) the auto-share create-hook only fans out a child the **local member was authorized to create in that container**; and (c) the **"granter's role ≥ granted role" / only-Owner-may-grant policy should land with (ideally before) the cascade** — it is acceptable to defer for the *single-entity* flow but not once one grant fans across an entire message/task stream. The trust assumption is stated explicitly: **any active member of a container is trusted to add child entities that inherit the container's membership** (that is what "being in the channel" means); it is *not* assumed that any member may change *who else* is in the collection — that stays owner-gated.
- **No infinite fan-out (verified).** A cascaded child arriving at another member applies via `LiveSyncEngine.applyRemoteUpdate` / `installWrap`, which bypass the `entities.create` verb, so receiving a child never re-triggers the create-hook cascade. Steady state is `K` wraps per message, not an echo storm.
- **Forward secrecy is unchanged (not regressed).** A revoked member retains DEKs already delivered — true for single-entity sharing today; the cascade does not make it worse. DEK rotation on revoke is a separate, pre-existing non-goal.
- **Capability surface.** No new IPC verb on the hot path; the create-hook listener is internal to the main process. Per-app `sharing.share` caps (M-series UI work) remain the gate for *initiating* a collection share.

## Test plan (in-process, multi-vault — the `collab-*` tier)

1. **Containment registry enumerates children** *(done — `containment-registry.test.ts`, green)*: `childrenSourceFor` resolves exactly a channel's messages through the real `queryVaultListSource` over a real `entities.db`; the dotted-key Tasks case is `it.todo` pending the `byLink` link-edge path.
2. **Cascade converges a pre-existing child.** Owner provisions a channel + 3 messages, shares with B; B reads all 3.
3. **Auto-share converges a child created *after* the share** (the keystone). Owner shares an empty channel with B; owner posts a message; B receives it live with no further share call. Asserted across two real `VaultSession`s over the loopback relay.
4. **Three-way** (mirrors `002`): owner + B + C; a message by B reaches C.
5. **[rev] Deferred re-cascade.** A message posted by B *before* C's container grant has replicated to B reaches C *after* the grant arrives (the deferred queue drains) — proves a granted-but-unsynced member is not silently dropped.
6. **Revoke cascade.** Revoke B on the channel; a subsequent message's recipient set (from `resolveCurrentMembers`) excludes B.
7. **Solo collection stays quiet.** Unshared channel + new message ⇒ zero relay traffic.
8. **[rev] Authorization.** A non-owner member cannot initiate a `shareCollection` (scarce-cap fail-closed); the granter-role policy rejects a grant for a role above the granter's.
9. **Blind-relay assertion** on every cascade frame (no plaintext body / DEK).
10. **[rev] Idempotent resume.** A cascade interrupted after some `(child, member)` pairs re-runs only the unfinished pairs; no duplicate grants/wraps.

## Implementation-plan rungs

Filed under Collab-C5 (the sharing-UX iteration this extends):
- **C5-collection-core** — the containment registry, `shareCollection` / `revokeFromCollection`, the create-hook auto-share listener, the `MemberWrapPayload.userPubB64` binding, and the `collab-*` multi-vault tests above.
- Per-app share UI (Chat/Tasks/Calendar/Whiteboard) and presence are separate M-series rungs that consume this core.
