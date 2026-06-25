# 20 — Database growth and synchronization

This doc covers how Brainstorm's data **grows** over time and how it **synchronizes** between devices (and, in v2, between users in an organization). It builds on [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md) (CRDT model and transports), [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (the encryption model that sync rides on), and [18-storage-and-search.md](18-storage-and-search.md) (the storage subsystems).

This is the operational doc — what happens when a single device has 100k entities; what happens when a new device joins a user with 5 years of history; how the system degrades when sync is slow or storage is constrained.

## Two layers, one source of truth

Brainstorm has two distinct data layers, and the design intent is that **only one of them syncs**:

| Layer                         | Role                                 | Syncs?           | Storage                        |
|-------------------------------|--------------------------------------|------------------|--------------------------------|
| **Yjs Y.Docs** (per entity)   | **Source of truth** for entity state | **Yes** (CRDT)   | Flat files, snapshot+tail      |
| **SQLite indexes**            | Derived projection for queries/FTS   | **No**           | `entities.db`, `search.db`, …  |
| Capability ledger             | Per-device security state            | **No**           | `ledger.db`                    |
| Registry                      | Per-device installed-apps state      | **No**           | `registry.db`                  |
| Awareness                     | Ephemeral presence/cursors           | Live, not persisted | in-memory                  |

> **Decision:** the Yjs layer is the only thing that synchronizes between devices. SQLite indexes are **rebuilt on each device** from local Y.Docs. The ledger and registry are **per-device** by design.

The transport layer (relay or P2P) sees only Yjs binary updates keyed by entity id. It does not see schema, queries, or the SQLite shape — those are local concerns.

### What this implies

- A new device that joins a user does not "download a database." It downloads Y.Docs and rebuilds its SQLite indexes locally.
- A schema migration of the SQLite tables happens **independently per device**, on shell upgrade. It does not need to coordinate.
- A search index that gets corrupted on one device can be rebuilt locally without affecting other devices.
- Two devices may briefly have different SQLite states even though their Yjs layer has converged — the entities have synced, the indexes are catching up.

## Growth model

### Axes of growth

| Axis                          | Light user      | Heavy user           | Bottleneck at the high end                  |
|-------------------------------|-----------------|----------------------|---------------------------------------------|
| Number of entities            | 1k–10k          | 100k–1M              | SQLite query latency for cross-type queries |
| Average Y.Doc size            | 1–50KB          | 50–500KB             | Snapshot compaction frequency               |
| Number of large Y.Docs (>1MB) | <10             | dozens to hundreds   | Memory at editor-open time                  |
| Total Y.Doc storage           | low MBs         | low GBs              | Disk space; backup time                     |
| Attachments                   | <100MB          | 10s of GB            | Disk space; cloud-attachment quota          |
| Search index size             | tens of MB      | low GBs              | Index update lag under sustained writes     |
| Property overlays             | <100            | low thousands        | Effective-schema composition latency        |

### Scaling tiers

Behavior is engineered against three tiers:

- **Tier 1 — small (≤10k entities):** everything fits comfortably; no special handling. Indexing is real-time-feeling.
- **Tier 2 — medium (10k–100k):** standard mode. Performance budgets in [18-storage-and-search.md](18-storage-and-search.md) apply.
- **Tier 3 — large (100k–1M):** stress mode. Selective sync becomes important; index update lag grows; the shell offers archival affordances.

> **Decision:** above 1M entities per device, the shell warns the user that performance has crossed a budget and recommends archival. We do not engineer for >1M-entity workloads; that is enterprise data warehouse, not a knowledge-management product.

The shell instruments these and surfaces them in a Storage settings panel: total entities, Y.Doc bytes, search index bytes, attachment bytes, last compaction, last index rebuild.

## Compaction strategy

Compaction reclaims space and keeps performance predictable.

### Yjs compaction

Each entity's Y.Doc is **snapshot + tail**. Compaction merges the tail into a fresh snapshot.

> **Decision:** compaction triggers when:
> - Tail size exceeds 256KB (default), **or**
> - Total Y.Doc file size has grown by >2x since the last snapshot, **or**
> - Time since last snapshot >7 days for an entity that's been edited.
>
> Compaction runs in the storage worker on idle CPU.

> **Decision:** historical updates older than the most recent snapshot are **eligible for pruning** if they exceed a configurable retention threshold (default 90 days). The user can configure a longer retention or "keep all". Pruned updates cannot be replayed; CRDT convergence still works because all live peers have the same snapshot.

### SQLite compaction

- `PRAGMA wal_autocheckpoint = 1000` — WAL is checkpointed every 1000 pages.
- `VACUUM` — runs weekly during idle, on each domain database. Reclaims fragmentation after deletes.
- Search FTS5 has its own internal compaction (`INSERT INTO entity_fts(entity_fts) VALUES('optimize')`); we run it monthly.

### Attachment GC

- Content-addressed blobs in `data/attachments/` are reference-counted by entity-property scans.
- Weekly: identify blobs with zero references; mark for deletion.
- Deletion happens after a 7-day grace period (in case a recently-created reference is mid-sync).

## Synchronization model

Yjs sync is the only thing that crosses devices.

### Sync unit = one entity

> **Decision:** the unit of synchronization is **one Y.Doc per entity**. Devices subscribe to Y.Docs they care about; the relay routes updates per entity id (or per opaque routing token if entity ids are themselves sensitive — see OQ-44).

This decision is foundational because:
- Selective sync becomes natural — subscribe to a subset, ignore the rest.
- Permission revocation is per-entity (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)); sync filtering aligns.
- A single oversized entity does not block sync of others.

### Wire protocol

Brainstorm uses Yjs's standard sync protocol (state-vector exchange + delta updates). The framing carries Brainstorm-specific metadata:

```
   sync envelope (relay sees this):
   ┌─────────────────────────────────────────────────────┐
   │ entityId  : <opaque routing token>                   │
   │ signature : <Ed25519 over body>                      │
   │ body      : <ciphertext under entity DEK>            │
   │            └── inside (after decrypt):               │
   │                ┌─────────────────────────────────┐   │
   │                │ kind: "update" | "stateVector"  │   │
   │                │ data: <Yjs binary>              │   │
   │                └─────────────────────────────────┘   │
   └─────────────────────────────────────────────────────┘
```

The relay validates the signature, authorizes routing (the device is on the entity's access record), and forwards. It cannot decrypt.

### Initial sync (a fresh device)

1. **Pairing handshake** completes — the new device receives the user's identity key and the access records for entities it's a member of.
2. **State catalog request** — the new device asks the relay (or a peer device) for the catalog: list of `(entityId, currentDocVersion)` pairs the user has access to.
3. **Priority application** — the device picks an initial subset to sync immediately based on user preferences (see "Selective sync" below). Default for desktop: everything. Default for phone: pinned + last 30 days.
4. **Bulk fetch** — the device requests Y.Doc snapshots for the chosen subset.
5. **Index build** — as Y.Docs arrive, the entities service materializes index rows in `entities.db`. The search worker indexes content.
6. **Background fetch** — entities not in the initial subset are fetched lazily on first access, or in the background at low priority.

> **Decision:** initial sync is **streamed** — the user can interact with already-synced entities while the rest catch up. There is no "all-or-nothing" wait.

> **Decision:** initial sync of a fresh device **requires** a peer or a relay. P2P pairing only works if at least one peer is online. If neither, the user is told: "Bring another device online or connect to a relay to bootstrap this device."

### Incremental sync

Once initial sync is past, the device is in steady state:

- Local edits → applied to local Y.Doc → update sent through transport → relay routes to other subscribed devices.
- Remote updates → applied to local Y.Doc → entities-service write triggers index update → search worker reindexes affected content.
- Awareness messages flow through the same channel, with a short TTL and no persistence.

> **Decision:** Yjs updates are **idempotent**; the transport may duplicate or reorder freely. We do not require ordering guarantees from the relay.

### Selective sync (priorities)

A 100k-entity desktop user fits everything on disk. A phone with 32GB does not.

> **Decision:** every device has a **sync policy** that determines which entities are kept locally:
>
> - **Pinned** — always synced, available offline. User-marked.
> - **Active** — recently accessed (within N days, default 30). Kept until evicted by LRU.
> - **Reachable from pinned/active** — entities linked from the pinned/active set, transitively up to a depth limit (default 1).
> - **On-demand** — everything else. Fetched on first access.
>
> Policy parameters (N, depth, max storage) are user-configurable per device. Sensible defaults: desktop = "everything"; phone = "pinned + active 30d + reachable depth 1, capped at 4GB".

Eviction is bounded by user-set storage limits. When evicted, the entity becomes "on-demand" — accessing it later triggers a fetch. The user sees a brief loading state; data is intact (it's still in the canonical Y.Doc on the relay or a peer).

### Late-joining peers

A peer that has been offline for a while comes back. State-vector exchange + receive missed updates + apply (CRDT merge) + index update. The catch-up size is bounded by what changed, not by how long offline.

### Backpressure

When sync is faster than disk persistence, the storage worker applies backpressure: it accepts updates into memory but signals the transport to slow incoming pulls. Yjs is well-behaved under this pattern.

When sync is slower than user edits, local edits queue locally. They will reach peers eventually. The user sees a "syncing…" indicator but their work is not blocked.

> **Decision:** local writes never block on sync. Sync is best-effort propagation; storage durability is local-first.

### Sync of non-content data

Beyond entity Y.Docs, a few things sync:

- **Access records** — synced as part of the entity itself (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)).
- **Key rotation records** — synced inline with the entity that owns the rotated DEK.
- **Revocation records for publisher keys** — synced through the registry/update channel ([14-app-store.md](../apps/14-app-store.md)), per-device.
- **The dashboard layout doc** — itself a Yjs doc, synced like any entity.
- **PropertySchema entities** — synced like any entity, so a custom property defined on one device propagates to the user's other devices.

> **Decision:** there is no "out-of-band" sync channel for control data. Everything that crosses devices is a Yjs doc or a signed record carried inside one.

## Schema migration propagation

### Local SQL schema migration

When a new shell version requires a different SQLite schema, the migration runs **per device, on shell upgrade**. It does not propagate.

> **Decision:** newer shells can migrate forward from older databases. Older shells refuse to open newer databases (with a clear "Please upgrade Brainstorm" message).

### Entity-type version bumps

When an app updates and introduces a new entity-type version (e.g. `Note/v1` → `Note/v2`):

- Existing `Note/v1` entities are **untouched**.
- New entities created by the upgraded app are `Note/v2`.
- Both versions coexist indefinitely.
- A migration intent (`intent.convert`) can be dispatched to convert specific entities.

This propagates through normal entity sync — no special migration channel.

### PropertySchema and vocabulary changes

These are entities; they sync like any entity. Changes propagate via the same Yjs path. CRDT semantics handle concurrent schema edits naturally.

> **Decision:** there is no atomic "schema migration" across devices. Schema changes are individual entity edits that converge via the same Yjs path as any other edit.

## Multi-user scaling (v2)

For organizations or peer-to-peer multi-user (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)):

- The relay's **fanout** scales with the number of subscribed devices per entity.
- **Awareness** updates can be chatty in heavily collaborated entities. The relay rate-limits awareness updates per device per entity (default: 30/sec).
- **Org-controlled relays** can shard entities by space across multiple relay nodes for horizontal scaling.

> **Decision:** v2 hosted relay supports up to ~200 simultaneous subscribers per entity by default. Beyond that, the org can deploy its own sharded relay infrastructure.

## Cross-device consistency

Two devices' Yjs Y.Docs converge eventually — that's the CRDT guarantee. But the **derived state** (SQLite indexes) may briefly diverge.

The user-visible consequence: a search query on device A might return a result that doesn't yet appear on device B because B hasn't finished indexing. This is an acceptable consequence of the architecture.

> **Decision:** "eventually consistent" is the contract; "consistent within a few seconds" is the typical experience.

## Failure modes

| Failure                              | Behavior                                                                |
|--------------------------------------|-------------------------------------------------------------------------|
| Disk full on local device            | Writes fail with `Unavailable`; sync queue grows in memory; user warned |
| Relay unreachable                    | Local writes continue; queued for delivery on reconnect                 |
| Peer device wedged                   | Relay holds updates indefinitely; peer catches up on return             |
| Y.Doc tail corrupted                 | Per-update checksums isolate the bad update; doc loads up to last good  |
| SQLite corrupted on one device       | Local rebuild from Y.Docs; sync continues unaffected                    |
| Search index corrupted               | Local rebuild; brief search-unavailable window                          |
| Network slower than write rate       | Local queue grows; user sees "syncing…" indicator; never blocks         |
| Selective-sync miss                  | Entity fetched on access; brief load; nothing user-visible breaks       |

## Performance budgets

| Metric                                              | Target               |
|-----------------------------------------------------|----------------------|
| Y.Doc update applied → durable on disk              | <50ms p99            |
| Y.Doc update applied → reach a peer (good network)  | <500ms p50, <2s p99  |
| Initial sync of 10k entities                        | <60s on 100Mbps      |
| Initial sync of 100k entities                       | <10min on 100Mbps    |
| Late-join catch-up of 1000 missed updates           | <5s                  |
| Compaction of one Y.Doc (typical size)              | <50ms                |
| Search index update lag (write → searchable)        | <2s p50, <10s p99    |
| Cross-device convergence after a write              | <2s on good network  |

## What this subsystem does **not** do

- **Strict consistency.** CRDT is eventual.
- **Server-side merging** of conflicts. Yjs handles all merging on-device.
- **History pruning across all peers.** Pruning is per-device with a retention policy.
- **Cross-user content discovery.** The relay routes for users who have the keys; it does not expose entities a user doesn't have access to.
- **Schema-locked entities.** Entities can be edited concurrently with their schema; the schema overlay model handles this gracefully (per [19-properties-and-schemas.md](19-properties-and-schemas.md)).

## Open questions surfaced by this doc

- **OQ-43** — attachment GC visibility: silent or surfaced?
- **OQ-44** — entity-id as routing token: hashed (relay sees opaque tokens) or raw?
- **OQ-45** — relay shard model for v2 hosted scale.
- **OQ-46** — Y.Doc tail-prune policy default (90-day retention) — make it longer? Configurable per-entity?
- **OQ-47** — "leave a copy here" UX for selective sync — discoverability of pinned vs evicted state.

## Summary

- One source of truth syncs (Yjs Y.Docs); SQLite indexes are derived per-device.
- Sync unit is one Y.Doc per entity; the relay routes opaque encrypted envelopes.
- Selective sync (pinned / active / reachable / on-demand) handles devices with constrained storage.
- Schema and vocabulary changes propagate as ordinary entity edits via Yjs — no separate migration channel.
- Compaction (Yjs snapshot+tail merging, SQLite VACUUM, FTS5 optimize, attachment GC) keeps disk bounded.
- Local writes never block on sync; cross-device convergence is eventual but typically within seconds.
- Performance scales cleanly to ~1M entities per device; beyond that, the product warns and recommends archival.
