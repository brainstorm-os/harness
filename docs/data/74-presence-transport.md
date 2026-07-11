# 74 — Presence transport (who's-here on a shared entity)

Design for **live presence** — the avatar stack + remote cursors that show who else is looking at / editing a shared entity right now. Planning doc: fixes the transport architecture, the capability + security surface, and the iteration plan before code, because presence introduces a **new awareness channel across the app-sandbox boundary** and that boundary is the product's core security invariant.

Builds on:
- `10.6` `AwarenessBroadcaster` (`main/sync/awareness-broadcaster.ts`) — the **built-but-dormant** sender-side awareness wrapper (debounce, heartbeat, inbound routing). Constructed nowhere today.
- `@brainstorm/react-yjs` — the READ side: `useAwareness(AwarenessLike)` + `awarenessStore` (already shipped).
- `@brainstorm/sdk/presence-stack` — `<PresenceStack>` + `awarenessToPeers` / `buildLocalPresence` + the `PresencePeer` payload contract (already shipped; see [09-shared-sdk-catalog.md](../apps/09-shared-sdk-catalog.md)).
- `10.12` LiveSyncEngine + the envelope pipeline (`emitAwareness` / DEK sealing) — awareness rides the **same DEK-encrypted relay path** as doc updates.
- OQ-204 (debounce/heartbeat) + OQ-205 (no new default grant) — resolved in the 10.6 build.

## The gap (precisely)

Three of the four pieces exist; the fourth is missing entirely:
1. ✅ **Read/render** — `useAwareness` + `<PresenceStack>` + the peer mapping.
2. ✅ **Main-process wire** — `AwarenessBroadcaster.track/untrack/applyInbound` over a `PipelineContext` (emits `emitAwareness` frames on the relay, DEK-sealed; routes inbound via `applyAwarenessUpdate`).
3. ✅ **Payload contract** — `PresencePeer { id=sovereign pubkey, name, color, avatarRef? }`, published under the `presence` awareness field.
4. ❌ **Transport across the sandbox** — the app's `y-protocols` **`Awareness` lives in the sandbox renderer**; the broadcaster operates on an `Awareness` in **main**. There is **no IPC channel** connecting them (empty grep in `ipc/`, `preload/`). Whiteboard's `createLocalAwareness` is a *local, no-transport* stand-in, so presence works single-device only. Binding the renderer Awareness ↔ main broadcaster is the whole job.

## Architecture — a proxy Awareness in main, bridged by an IPC channel

Awareness is ephemeral CRDT state (a `y-protocols` Awareness doc). It syncs exactly like the entity Y.Doc, one layer over: **renderer Awareness ⇄ IPC (bytes) ⇄ main proxy Awareness ⇄ broadcaster ⇄ DEK-sealed relay frame**.

**App side (sandbox renderer), a new SDK primitive** — `@brainstorm/sdk/awareness` `createSyncedAwareness(entityId)` returns an `AwarenessLike` (satisfying react-yjs) that:
- wraps a local `y-protocols` `Awareness`,
- on local `update`, encodes the delta (`encodeAwarenessUpdate`) and **sends the bytes to main** over the awareness IPC channel (per entity),
- on **inbound** bytes from main, `applyAwarenessUpdate`s them into the local Awareness (so `useAwareness` re-renders),
- publishes `buildLocalPresence(self, clientID)` under the `presence` field on mount; clears on unmount.
It is the sanctioned replacement for `createLocalAwareness` — whiteboard's cursors light up cross-device the moment it swaps in, with no change to `logic/presence.ts` (transport-agnostic by design).

**Main side** — a per-(app-identity, entity) **proxy `Awareness`** the `AwarenessBroadcaster.track`s. Renderer→main bytes are `applyAwarenessUpdate`ed into the proxy (the broadcaster's own `update` listener then emits them on the relay). Inbound relay frames land in the proxy via `applyInbound`; the broadcaster's `awarenessByEntity` map + a main→renderer push send the merged remote state back to the app. The broadcaster is **activated** here (constructed with the LiveSyncEngine's `PipelineContext`) — the dormant `10.6` code comes online unchanged.

**IPC surface** — one new broker service (`presence`) or a slice on the existing sync route, with two verbs: `presence.publish(entityId, awarenessUpdateBytes)` (renderer→main) and a main→renderer `presence:update` push (bytes + entityId), plus `presence.untrack(entityId)`. Preload-stamped `app` identity as every envelope; the broker validates it (`RendererIdentityRegistry`) exactly like the entities route.

## Capability + security model (the review focus)

- **No new default grant (OQ-205).** Awareness piggybacks on `entities.read:<type>`: if an app already holds the entity bytes, it may see + publish presence for that entity. `presence.publish(entityId, …)` is capability-checked against the same read grant the app used to open the entity — an app can't broadcast into an entity it can't read. Fail-closed (a `checkCapability` throw → `Unavailable`), like every broker route.
- **Only awareness bytes cross.** The channel carries `y-protocols` awareness updates (opaque CRDT deltas), never DEK/identity material. On the relay they are **DEK-sealed** by `emitAwareness` — the blind relay sees ciphertext, same as doc frames.
- **Untrusted inbound.** Remote awareness state is another device's — every field is untrusted. `peerFromState` already hardens the read side (drops malformed, sanitizes name, deterministic color fallback). The main proxy applies inbound via `applyAwarenessUpdate` (y-protocols clock dedup) and never trusts a claimed `id` for authorization — presence is display-only; it grants nothing.
- **New attack surface = the sandbox IPC channel.** A malicious/compromised app renderer could spam `presence.publish` (DoS — per-app backpressure + the OQ-204 debounce bound it), or publish presence for an entity it can read but isn't "in" (cosmetic, not a capability escalation — presence confers no access). The `ROT-4`-style gate applies: a dedicated `/security-review` + `/pentester` pass on the publish→broadcast→apply path before it ships.
- **Ephemeral, no persistence.** Awareness never touches the vault DB; on disconnect the heartbeat lapse (OQ-204, ~30 s) garbage-collects a peer. Nothing to clean up, nothing to leak at rest.

## Iteration plan (the 0.4.0 headline)

- **`PRES-1` — SDK synced-awareness client (buildable now, no IPC yet).** `@brainstorm/sdk/awareness` `createSyncedAwareness(entityId, transport)` over an **injected** transport (`send(bytes)` + `onInbound(cb)`), wrapping `y-protocols` Awareness + publishing `buildLocalPresence`. Pure + unit-tested against a loopback transport (two clients converge). Extract whiteboard's `createLocalAwareness` shape into the shared primitive; whiteboard adopts it with a local transport (no behaviour change) to prove the seam.
- **`PRES-2` — awareness IPC route + broadcaster activation.** The `presence` broker service (publish/untrack + main→renderer push), the main proxy-Awareness manager, and constructing the `AwarenessBroadcaster` with the LiveSyncEngine pipeline. In-process pipeline test: two vaults over the loopback relay see each other's presence.
- **`PRES-3` — fleet header mount.** `<PresenceStack>` in every shared-entity app header (reading `awarenessToPeers` over `createSyncedAwareness`), + whiteboard/graph remote cursors on the real transport. Per the app-header conventions (⋯ last, shared chrome).
- **`PRES-4` — verification (gate).** A dedicated `/security-review` + `/pentester` on the publish→broadcast→apply path (the new sandbox surface); a two-shell real-relay dogfood proving two users see each other live; friction sign-off.

**Gate:** `PRES-4`'s adversarial review is a hard merge gate for the IPC surface. Rides the 0.4.0 train.

## Open questions

- **OQ-PRES-1** — one `presence` broker service vs. a slice on the existing sync/ydoc route? (Leaning: its own service — clean capability + a distinct backpressure lane from doc sync.)
- **OQ-PRES-2** — main→renderer push transport: reuse the entities-staleness signal fan-out, or a dedicated per-entity subscription? (Leaning: dedicated, so an app only pays for entities it's presence-subscribed to.)
- **OQ-PRES-3** — avatar image (`avatarRef` → `brainstorm://asset/…`): does the header stack resolve it through the existing asset host, and is a peer's avatar asset even readable by the viewer? (Likely: initials fallback for v1; asset-resolved avatars a follow-up once cross-member asset read is settled.)
- **OQ-PRES-4** — do we cap the awareness fan-out per entity (a 200-person channel)? (Leaning: `capPresence` already caps the *rendered* stack; a wire cap is a later scale concern.)
