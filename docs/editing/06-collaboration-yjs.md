# 06 — Collaboration with Yjs

This doc defines how Yjs is used as the runtime substrate beneath the entity model and rich-text editing. It builds on [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) and feeds [07-editing-lexical.md](07-editing-lexical.md).

## Why Yjs

Brainstorm is local-first. The user can edit anything offline; sync, when present, is for distributing changes between devices (and potentially other users later). This rules out turn-based "save the server's version" sync and pushes us toward **CRDTs** — data structures that merge concurrent edits deterministically without a central authority.

Yjs is the established choice: small, performant, composable, with bindings for the editors we care about (notably Lexical). It also gives us **awareness** (presence, cursors) for free.

## Granularity: what is a Y.Doc

A **Y.Doc** is the unit of CRDT state: a coherent collection of CRDT types (`Y.Map`, `Y.Array`, `Y.Text`, `Y.XmlFragment`) with a shared update log. The interesting design question: *what should one Y.Doc correspond to?*

> **Decision:** the unit of a Y.Doc in Brainstorm is **the entity**. Each entity is backed by exactly one Y.Doc. The doc holds the entity's properties, its links, and any rich-text fragments referenced by `$ref` from the properties.

Reasoning:

- Entities are the natural sharing/permission unit; sync per-entity is what users will actually want.
- A larger doc (e.g. one big "workspace doc") makes selective sharing impossible.
- A smaller doc (per field) explodes overhead and makes cross-field consistency hard.

Implications:

- Two apps editing the same entity collaborate via the same Y.Doc.
- Two apps editing *different* entities never share doc state, even if their content cross-references each other (links are properties of entities, not shared doc state).
- The set of all entities is **not** itself a Yjs doc. It is a regular indexed record store; only individual entities are CRDT-backed.

## Inside a Y.Doc

A typical entity's Y.Doc has:

```
root: Y.Map
├── "type"           : string                          (entity type URL)
├── "properties"     : Y.Map
│   ├── "title"      : Y.Text          (or string for non-collab fields)
│   ├── "tags"       : Y.Array<string>
│   └── "body"       : Y.XmlFragment   (rich-text fragment, edited via Lexical)
├── "links"          : Y.Array<linkRecord>
└── "meta"           : Y.Map
    ├── "createdBy"  : string (app id)
    ├── "createdAt"  : timestamp
    └── …
```

The exact shape per entity type is determined by the type's schema (see [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md)). The schema decides which properties are CRDT (`Y.Text`, `Y.XmlFragment`) and which are atomic (plain values in `Y.Map`).

> **Decision:** updates to atomic properties are atomic-replace inside the Y.Map (not character-merged). Only fields that need character-level merging (rich text, code) are `Y.Text` / `Y.XmlFragment`.

## Where the canonical Y.Doc lives

> **Decision:** the **shell** holds the canonical Y.Doc for each open entity (whether it lives in the main process or in a dedicated yjs worker process is OQ-18 in [11-open-questions.md](../reference/11-open-questions.md); the host-services contract is the same either way). App renderers see a *replica* that syncs to the canonical via IPC.

This matters because:

- Multiple apps may have the same entity open at once (e.g. text editor + graph viewer + database). They must converge.
- Persistence and remote sync are owned by the shell. The shell observes the canonical doc and writes updates to disk and to transport.
- An app crash must not lose unflushed changes. Holding the doc in the shell process gives crash isolation.

The IPC bridge between an app's renderer and the shell behaves like a Yjs `Provider`: applies remote updates into the renderer's local copy, ships local updates to the shell. The renderer can use the local copy normally — Lexical, awareness, etc. — without knowing where the canonical lives.

> **Open:** does the renderer hold a full Y.Doc replica, or a thinner view? Full replica is simplest (Yjs's standard model) and gives offline-from-canonical resilience if the IPC stalls. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Persistence

The **storage** core service persists Y.Doc updates. Two storage shapes are common:

- **Update log** — append-only list of binary updates. Replay to reconstruct the doc.
- **Snapshot + tail** — periodic snapshot, plus updates since.

> **Decision:** Brainstorm uses snapshot + tail. Snapshots compact periodically. The on-disk format is intentionally a Yjs-defined format (or a thin wrapper) so that a backup is portable.

Each entity's Y.Doc maps to one storage record. Storage is keyed by entity id.

## Sync transport

> **Decision:** sync is an *adapter*. The default transport is local-only (no network). Optional adapters add device-to-device, server-relayed, or peer-to-peer transports. Apps do not pick the transport; the shell does.

Possible transports (out of scope for v1 to ship, in scope for v1 to design):

- **Local-only** — single device, no transport. Sync code paths are inert.
- **Self-hosted relay** — `y-websocket` or similar to a user-owned server.
- **Hosted relay** — same protocol, hosted by Brainstorm infra (later).
- **P2P** — `y-webrtc` or similar; works for ad-hoc sharing without a server.

The transport sees only Yjs updates. It does **not** see entity types, app ids, or block content. This makes encrypted-at-rest, encrypted-in-transit straightforward later.

> **Open:** what is the v1 device-pairing UX? QR-code-based key exchange? Account-based? Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Awareness

Yjs awareness gives ephemeral state: cursor positions, selection ranges, "who's looking at this entity right now". Brainstorm surfaces awareness:

- Inside editors: collaborator cursors and selections.
- In the dashboard: a small indicator on icons whose entities are being viewed/edited from another device.
- In the launcher: "currently open on Other Device" hints.

Awareness data is **not** persisted; it is bounded to the duration of a session.

## How apps see all this

An app, in normal use, never directly handles a Y.Doc. The host service exposes:

- `subscribeEntity(id) -> { entity, awareness, observe(callback) }` — gives a live view.
- `mutateEntity(id, mutator)` — runs the mutator inside the entity's Y.Doc transaction, scoped to the entity's properties.
- For rich text: `getYFragment(entityId, propertyPath) -> Y.XmlFragment` — only granted to apps whose capabilities include `entities.write` for that type. Lexical attaches to the returned fragment via the standard `lexical-yjs` collaboration plugin.

Apps that want raw Y.Doc access can ask for it (capability `yjs.raw`), with a stronger consent prompt. Most apps should not need it.

## What about non-rich properties — do they need CRDT?

Most don't. A note's `tags` field can be a plain array stored in a Y.Map — concurrent edits will last-write-wins on the array as a whole. That is fine for tags. For a long collaborative title or a body, CRDT semantics matter and we use `Y.Text` / `Y.XmlFragment`.

> **Decision:** CRDT-vs-LWW per property is declared in the entity type's schema. The default for primitives is LWW; the default for `text` and `richtext` typed fields is CRDT.

## Failure modes

- **Stalled IPC** — the renderer's replica drifts. It continues to accept local edits; on resume, deltas reconcile via Yjs. The user sees no error.
- **Disk full / persistence failing** — the storage service surfaces an error; apps see a "save failing" indicator via host services. Edits continue to accumulate in memory.
- **Conflict during transport** — there is no conflict. CRDT.
- **Schema migration of an entity type** — handled at the entity-type-version level (`/v1` → `/v2`); old `/v1` entities are untouched, new ones are `/v2`. Cross-version reads happen via display hints.

## Summary

- One Y.Doc per entity, owned by the shell process.
- Apps see entities, not docs; the SDK abstracts.
- Persistence is snapshot+tail in a Yjs-portable format.
- Sync is an adapter the shell wires; apps don't choose transport.
- Rich text fragments live inside entity Y.Docs; Lexical binds to them. See next doc.
