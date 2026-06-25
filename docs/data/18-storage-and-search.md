# 18 — Local database and full-text search

This doc describes the **local database** and **full-text search index** subsystems behind the entities service and the search service. It builds on the persistence-layout sketch in [12-shell-architecture.md](../shell/12-shell-architecture.md), goes deeper into engine choice, schema, query API, indexing pipeline, and the interaction with encryption ([16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)).

## What this subsystem must do

1. **Persist entities and links** — typed records with property-level queryability.
2. **Persist Yjs docs** — snapshot+tail binary updates, fast write-on-edit.
3. **Index for query** — answer `entities.query(...)` calls in <50ms (warm cache) for typical result sizes.
4. **Index for full-text search** — `search.query(...)` calls in <100ms across an at-rest content corpus of 100k+ entities.
5. **Stay correct under concurrent edits** — many apps and the canonical Yjs runtime write at the same time.
6. **Recover cleanly from crashes** — every acknowledged write is durable; partial writes roll back.
7. **Honor the encryption model** — content is decrypted only on the user's device; the index lives behind the same boundary.

## Engine choice

> **Decision:** **SQLite (with WAL mode)** is the local database for everything indexed: entities table, links table, capability ledger, registry, search index (via FTS5), per-app KV. SQLite is invoked through the storage worker process (per [12-shell-architecture.md](../shell/12-shell-architecture.md)). At-rest encryption uses **SQLCipher** (or equivalent — see OQ-34).

Reasoning:

- **Ubiquity.** SQLite is everywhere. Mature crash semantics. Decades of edge cases ironed out.
- **Single-file portability.** A backup is `cp` of one file per database. Inspection works with any sqlite tool.
- **FTS5 built in.** The full-text index is a native virtual table — no second engine, no second indexing pipeline.
- **JSON1 built in.** Property-level queries against entity property bags (stored as JSON) work natively without normalization.
- **Performant for OLTP-shaped workload.** Brainstorm reads and writes are mostly small, frequent, indexed by primary key or single secondary index. SQLite excels at this profile.
- **Encrypted variants are mature.** SQLCipher (or libsodium-based wrappers) provide page-level AES encryption, transparent to queries.

Alternatives considered and rejected:

- **DuckDB** — analytical workload sweet spot; not what we are. Worse OLTP latency.
- **LMDB / RocksDB** — fast KV but no SQL/FTS; we'd build query and indexing on top. Reinvention cost.
- **PostgreSQL embedded (e.g. pglite)** — server-shaped, heavier than SQLite, no win at our scale.
- **A custom store** — not justified.

> **Open:** SQLCipher is GPL/commercial-licensed. If we want to ship a fully MIT-licensed stack, alternatives are SQLeet, libsql with encryption, or a libsodium-based page-level encryption layer. Tracked as OQ-34 in [11-open-questions.md](../reference/11-open-questions.md).

### What SQLite is **not** used for

- **Yjs documents.** These are append-mostly binary updates. Storing them as SQLite blobs adds overhead and obscures the format. Y.Doc snapshots and tails live as **flat files** in `data/docs/<entity-id-prefix>/<entity-id>.ydoc`, rotated and compacted by the storage worker.
- **Large attachments.** Images, PDFs, video. These live as content-addressed blobs in `data/attachments/<hash-prefix>/<hash>`, optionally encrypted.

## Database layout

> **Decision:** domain-separated SQLite databases, not a single monolithic file.

```
data/
├── ledger.db          // capability ledger (writes from main; reads everywhere)
├── registry.db        // openers, blocks, entity types, custom-node types, widgets
├── entities.db        // entities, links, property index
├── search.db          // FTS5 index
├── docs/              // Yjs snapshots + tails (flat files, not SQLite)
├── attachments/       // blob storage (flat files, not SQLite)
└── app-private/
    └── <app-id>/kv.db // per-app private KV (one file per app)
```

Reasoning for split:

- **Failure isolation.** Corruption in the search index doesn't take down the capability ledger.
- **Locking.** Heavy write activity in `entities.db` doesn't pause reads of `registry.db`.
- **Backup granularity.** A user can export entities without exporting per-app KV.
- **Crash recovery.** Each DB has its own WAL; recovery scope is bounded.

## Schema (entities.db)

```sql
-- The canonical record per entity. Properties stored as JSON for flexibility +
-- json1 indexing where useful.
CREATE TABLE entities (
  id            TEXT PRIMARY KEY,                  -- ULID-style, e.g. ent_01HXK...
  type          TEXT NOT NULL,                     -- entity type URL
  space_id      TEXT,                              -- nullable in v1 (no orgs); set in v2
  properties    TEXT NOT NULL,                     -- JSON
  created_by    TEXT NOT NULL,                     -- creating app id
  created_at    INTEGER NOT NULL,                  -- ms since epoch
  updated_at    INTEGER NOT NULL,
  dek_id        TEXT,                              -- the entity's current DEK version
  deleted_at    INTEGER                            -- soft delete; null when alive
);

CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_updated ON entities(updated_at);
CREATE INDEX idx_entities_space ON entities(space_id);

-- Links between entities, typed by link-type URL.
CREATE TABLE links (
  id                 TEXT PRIMARY KEY,
  source_entity_id   TEXT NOT NULL REFERENCES entities(id),
  dest_entity_id     TEXT NOT NULL REFERENCES entities(id),
  link_type          TEXT NOT NULL,
  created_at         INTEGER NOT NULL,
  deleted_at         INTEGER
);

CREATE INDEX idx_links_source ON links(source_entity_id, link_type);
CREATE INDEX idx_links_dest ON links(dest_entity_id, link_type);
CREATE INDEX idx_links_type ON links(link_type);

-- Selective property indexes built per entity type's display hints
-- (e.g. "title" for Notes, "createdAt" for everything). Created lazily as
-- queries demand.
-- CREATE INDEX idx_entities_property_<type>_<property> ON entities(...) WHERE type = ...;
```

Property-level queries use `json_extract(properties, '$.foo')` — fast for indexed properties, scan-cost for un-indexed ones.

> **Decision:** the entities service materializes selective indexes for properties marked as **searchable** in their entity type's schema. The schema's display hints (`title`, `body`, `summary`) determine what's indexed by default. Apps can request more via the type's metadata; we do not auto-index every property.

## Schema (search.db)

```sql
-- FTS5 virtual table: one row per indexed entity, plain-text content
-- assembled from the entity's text-typed properties + Yjs rich-text content.
CREATE VIRTUAL TABLE entity_fts USING fts5(
  entity_id UNINDEXED,
  type      UNINDEXED,
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- File index for granted folders (per `files` capability scope).
CREATE VIRTUAL TABLE file_fts USING fts5(
  file_handle_id UNINDEXED,
  filename,
  content_excerpt,
  tokenize = 'unicode61 remove_diacritics 2'
);
```

> **Decision:** FTS5 with `unicode61` tokenizer + diacritic removal is the v1 baseline. Tokenization is intentionally simple; advanced tokenization (stemming, language detection) is deferred.

> **Open:** language-aware tokenization (Snowball stemmers, ICU tokenizer) — useful for non-English content, complicates the index, multilingual users have multi-tokenizer needs. Tracked as OQ-35.

## Tantivy as an alternative full-text engine

> **Decision under consideration:** Brainstorm may ship **Tantivy** instead of (or in addition to) SQLite FTS5 for full-text search. Tantivy is a Rust full-text-search engine with significant advantages at scale: 10–50× faster than FTS5 on large indexes; real BM25 ranking with language-aware analyzers (Snowball stemmers built in); cleaner facet/filter integration; scales past 1M documents without performance cliffs. Other knowledge tools at scale have adopted Tantivy for the same reasons.

The trade-offs:

| Aspect                        | SQLite FTS5                                     | Tantivy                                                    |
|-------------------------------|-------------------------------------------------|------------------------------------------------------------|
| Native dependency              | Already in SQLite (zero extra)                   | Rust addon via napi-rs (extra ~3MB native binary per platform) |
| Cross-platform builds          | Trivial                                          | Solved (napi-rs CI templates) but more pieces               |
| Tokenization                   | `unicode61` + diacritic; nothing built-in for stemming | Snowball stemmers per language; ICU tokenizer; language detection |
| Performance at 100k docs       | Acceptable                                       | Notably faster                                             |
| Performance at 1M docs         | Visible degradation                              | Still fast                                                 |
| Vector search co-location      | Via `sqlite-vec` extension (separate)           | Tantivy supports vector search natively (one engine)       |
| Deployment complexity          | Lower                                            | Higher (additional native dep)                             |

Two integration paths if we adopt Tantivy:

- **(a) Replace FTS5 entirely.** All full-text + vector search runs in Tantivy via the storage worker. SQLite still hosts the entity records, links, capability ledger.
- **(b) Keep both.** FTS5 for small / simple queries; Tantivy for advanced (semantic + multi-language) queries. More complex; probably not worth it.

> **Open:** which path — Tantivy-replaces-FTS5 (a), keep-FTS5-and-add-Tantivy (b), or stay-with-FTS5? Picking now would let us design the search worker once. Tantivy aligns with Brainstorm's "AI is foundational" stance (per [22-ai-foundations.md](../platform/22-ai-foundations.md)) by providing one engine for both lexical and vector queries. Tracked as OQ-128.

> **Tentative leaning:** **Tantivy replaces FTS5** in v1. The complexity tax is real but bounded; the search-quality and scale wins are clear; and we already commit to Rust elsewhere (per [13-frontend-stack.md](../shell/13-frontend-stack.md) "Rust libraries via Node addons"). The vector index naturally lives in the same engine.

## Query API

Apps never see SQL. They see entity queries via the `entities` host service (already defined in [08-app-sdk.md](../apps/08-app-sdk.md)). The query language is structured:

```ts
type EntityQuery = {
  type?: string | string[];                  // entity type URL(s)
  where?: PropertyPredicate;                 // property-level conditions
  link?: LinkPredicate;                      // link-level conditions
  text?: string;                             // FTS5 query string
  spaceId?: string | string[];
  orderBy?: { property: string; direction: "asc" | "desc" }[];
  limit?: number;
  cursor?: string;                           // for pagination
};

type PropertyPredicate =
  | { $eq: { [path: string]: unknown } }
  | { $contains: { [path: string]: unknown } }     // for arrays / strings
  | { $gt: { [path: string]: number } }
  | { $lt: { [path: string]: number } }
  | { $exists: { [path: string]: true } }
  | { $and: PropertyPredicate[] }
  | { $or: PropertyPredicate[] };

type LinkPredicate = {
  type?: string;
  source?: string;                            // a specific entity id
  dest?: string;
};
```

The entities service compiles these to SQL against `entities` (and `links`, and `entity_fts` if `text` is present). Returns a paged `Entity[]` plus a cursor.

For live results, `entities.subscribe(query, callback)` returns a subscription that re-runs the query on relevant changes. The subscription is **invalidation-driven**: whenever an entity matching the query's *types* is created/updated/deleted, the query re-runs.

> **Decision:** subscriptions are query-level, not row-level. Re-running a small SQL query is cheaper than maintaining per-row diff state, at the latencies we care about. (We can add row-level deltas later if profiling demands.)

## Indexing pipeline

When an entity is created or updated:

1. The entities service writes the new row to `entities.db` (transaction commit).
2. A **change record** is appended to a small `change_log` table — entity id, change kind (create/update/delete), version, timestamp.
3. The **search worker** subscribes to the change log. For each change:
   - Fetches the entity's text-typed properties from `entities.db`.
   - Fetches any rich-text content by walking the entity's Yjs `Y.XmlFragment`s and extracting plain text.
   - Updates the corresponding row in `entity_fts` (`INSERT OR REPLACE`).
4. The change log is truncated periodically once entries are confirmed consumed.

> **Decision:** indexing is **eventually consistent**. Search results lag entity writes by up to ~2 seconds at typical write rates. The query API does not block on index lock-step. (The user can opt to "Force reindex" from settings if they suspect drift.)

> **Decision:** the index is **rebuildable from sources**. If `search.db` is corrupted or deleted, the search worker can scan `entities.db` + Yjs docs and rebuild. No data loss; only a brief search-unavailable window.

## Yjs document persistence

Yjs docs are kept on disk as **snapshot + tail**:

```
data/docs/01H/01HXK.../body.ydoc
   ├── header        // version, last snapshot offset
   ├── snapshot      // last compacted Yjs state
   └── tail          // append-only updates since the snapshot
```

- Updates received from apps or sync transports are **immediately appended** to the tail.
- A periodic compaction merges the tail into a fresh snapshot when the tail exceeds a size threshold (default: 256KB).
- The on-disk format is a thin wrapper around Yjs's binary update format, so a file can be opened with vanilla Yjs tooling for inspection.

> **Decision:** Yjs persistence does **not** go through SQLite. Storing append-only binary updates in a B-tree-backed DB is a poor fit; flat files with WAL semantics are simpler and faster.

> **Decision:** the search worker reads Yjs rich-text content via the canonical Y.Doc (the shell holds it; see [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md)), not by parsing on-disk format directly. This avoids two readers competing on the file format.

## Encryption integration

The whole point of the encryption model in [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) is that the relay sees ciphertext only. The local database/index sit on the *trusted side* of that boundary — they live on the user's device, behind the keychain.

That said, an attacker with disk access (a stolen laptop) should not get plaintext content from `entities.db` or `search.db`. So:

> **Decision:** the local databases are encrypted at rest using a key derived from the user's identity (or, optionally, a passphrase). All four primary databases (`ledger.db`, `registry.db`, `entities.db`, `search.db`) are SQLCipher-encrypted (or equivalent — OQ-34). Yjs `.ydoc` files are also encrypted: the bytes on disk are ciphertext under the entity's storage-master-key.

What this means in practice:

- The shell unlocks the databases at startup, gated by OS keychain access (or passphrase prompt if configured).
- All queries and indexing happen in plaintext **inside the storage worker process**.
- A backup of `data/` is encrypted ciphertext; restoring requires the same identity material.

For **server-readable spaces** (per 16):

- Entities in those spaces have an additional encryption key the org server holds.
- A copy of those entities can be replicated to org infrastructure (encrypted under the org-held key) and indexed there. The org's server-side search runs on plaintext (as the org's design intends).
- Locally, the user's device sees the same plaintext via their own member key wrap.

For **E2E spaces** (the default):

- No server-side index. Search across an E2E space happens locally only.
- "Search across all my devices" requires that all devices have synced and re-indexed. There is no remote search backbone; that is an explicit consequence of E2E.

## Schema migration

Two distinct migration concerns:

### SQL schema (Brainstorm-internal)

Each database has a `_schema_version` table. The shell on startup checks the version and runs migrations if needed. Migrations are forward-only; rollback is "restore from backup".

```sql
CREATE TABLE _schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
```

> **Decision:** SQL schema migrations live in the shell binary and run on first launch of an upgraded shell. We do not support running an older shell against a newer database; the user is told to upgrade.

### Entity-type schema (cross-app, semantic)

Different concern entirely — covered in [05-data-and-blocks-protocol.md](05-data-and-blocks-protocol.md). Entity types are URL-versioned (`/v1`, `/v2`); a `/v2` schema does not migrate `/v1` entities. Both versions coexist; apps can choose to migrate (writing a `/v2` entity that supersedes a `/v1`).

## Performance budgets

Concrete targets:

| Metric                                      | Target               |
|---------------------------------------------|----------------------|
| Entity query (single type, simple where)    | <10ms p50, <50ms p99 |
| Entity query (cross-type, complex where)    | <30ms p50, <150ms p99|
| Full-text search (≤100k entities)           | <50ms p50, <100ms p99|
| Search index update lag (write → searchable)| <2s p50, <10s p99    |
| Y.Doc update applied → durable on disk      | <50ms p99            |
| Cold open of a 50MB Y.Doc                    | <300ms               |
| Backup of `data/` (200k entities)            | <30s                 |

These are runtime targets on a 2020-era machine. Lower-end hardware: 2–3× relaxed.

## Capacity assumptions

- **Entities:** target up to 1M per device. SQLite scales well past this with proper indexing; we don't pre-optimize for >1M.
- **Yjs docs:** typical 1–500KB compressed; outliers (large collaborative docs) up to a few MB. Flat-file persistence handles this trivially.
- **Search index:** entity_fts grows roughly linearly with content; a 100k-entity index is single-digit GB territory.
- **Attachments:** content-addressed; we don't index inside binary attachments by default. PDF / docx text extraction is an opt-in capability for indexer apps (similar to Spotlight importers).

## Operational concerns

- **VACUUM** — periodic, off-peak. Reclaims fragmented space after many deletes.
- **REINDEX (FTS)** — only if the search index is suspected corrupt. Forces a rebuild from `entities.db` + Yjs sources.
- **WAL checkpoint** — per WAL settings; we use `PRAGMA wal_autocheckpoint = 1000` (every 1000 pages).
- **Y.Doc compaction** — when tail exceeds 256KB; produces a fresh snapshot, truncates tail.
- **Attachment GC** — content-addressed blobs whose hash is no longer referenced are eligible for collection. Run weekly with a confirmation (in case of recent unreferenced uploads).

## Failure modes

- **Disk full** — writes fail; storage worker surfaces `Unavailable` to apps. Apps see a "save failing" state; edits accumulate in memory.
- **Corrupt SQLite file** — recovery: restore from backup if available; otherwise rebuild from sibling sources where possible (search index can be rebuilt; ledger/registry/entities cannot trivially be).
- **Search worker crash** — main shell respawns. Indexing resumes from the change log; recent writes may be a few seconds behind.
- **Yjs file corruption** — the snapshot+tail format includes per-update checksums. A bad update is skipped; the document is still loadable up to the last good update.

## Vector / semantic search

> **Decision:** **vector search ships in v1**, alongside FTS5 lexical search. Not deferred. Earlier drafts of this doc had it as OQ-36 with a "defer indefinitely" lean; that position is reversed by [22-ai-foundations.md](../platform/22-ai-foundations.md), which makes AI a foundational concern. The vector index is the substrate for semantic search, find-similar, and any AI feature that grounds in user data.

Specifics:

- **Extension** — `sqlite-vec` (or `sqlite-vss` per OQ-61) loaded in `search.db` alongside FTS5.
- **Embedding model** — a small bundled local model (per OQ-62) computes embeddings on entity write/update, in the search worker. Default leaning: `multilingual-e5-small`.
- **Index target** — one embedding per entity, computed from title + primary text properties (per the type's display hints).
- **Update pipeline** — the same change-log mechanism that drives FTS5 also drives vector updates. Eventual consistency, ~2s p50 lag.
- **Storage shape** — vector column in a sibling FTS5 table; same encryption-at-rest envelope (SQLCipher / libsql).

### Hybrid search

- `search.semantic({ query })` — top-k by cosine similarity.
- `search.lexical({ query })` — FTS5 BM25 (the original).
- `search.hybrid({ query })` — weighted blend; the user-facing default.

The launcher (per [04-shell.md](../shell/04-shell.md)) uses `search.hybrid` so typing a fragment matches both literal and semantic neighbors.

### Privacy

The embedding model runs **locally** in the search worker. For E2E content, embeddings never leave the device. For server-readable spaces (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)), the org's server may compute and index embeddings on its plaintext copy.

## What this subsystem does **not** do (and why)

- **Server-side query / search across E2E spaces.** Pure E2E precludes it. Acknowledged trade-off. (Server-readable spaces opt out.)
- **Cross-database transactions.** Each SQLite DB has its own transaction scope. We don't need 2PC across them; the schema separation guarantees that no single user-visible operation crosses DB boundaries.
- **Replication between devices via SQLite-level sync.** Replication is at the Yjs layer (per [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md)), not the SQLite layer. SQLite is per-device.
- **Time-travel queries.** Yjs already provides per-update history; the entities table is current-state. Querying historical entity state is an entity-by-entity Yjs concern, not a DB feature.

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-34** — at-rest encryption library: SQLCipher (license issue), libsql, libsodium-based, or other.
- **OQ-35** — language-aware tokenization (stemmers / ICU) — when, and how to manage multilingual users.
- **OQ-36** — vector / semantic search — *resolved as v1*, see [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **OQ-37** — search across files in granted folders — depth (filename only? excerpt? full-content via importer apps?) and freshness (watch vs. on-demand).
- **OQ-61** — vector extension (`sqlite-vec` vs `sqlite-vss`).
- **OQ-62** — local embedding model choice and bundling.

## Summary

- **SQLite** (with WAL, encrypted via SQLCipher-or-equivalent) for everything indexed. Domain-separated DBs (ledger, registry, entities, search, per-app KV).
- **FTS5 + vector index** for hybrid (lexical + semantic) full-text search — both ship in v1.
- **Yjs docs** persisted as flat snapshot+tail files (encrypted).
- **Indexing pipeline**: change-log-driven, eventually consistent, rebuildable from sources.
- **Encryption**: at-rest via SQLCipher; plaintext only inside the storage worker process.
- **Performance budgets**: query <50ms p99, search <100ms p99, index lag <2s p50.
- **No server-side search** for E2E spaces. **Server-side search supported** for opt-in server-readable spaces (per 16).
