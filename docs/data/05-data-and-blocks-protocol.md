# 05 — Data and Block Protocol

This doc defines the *data interop layer*: how apps share information without sharing code. Brainstorm adopts the **Block Protocol** (BP) — the open standard at [blockprotocol.org](https://blockprotocol.org/) ([github.com/blockprotocol/blockprotocol](https://github.com/blockprotocol/blockprotocol)) — as its data and block-UI interop substrate.

## Why Block Protocol

Brainstorm has many small apps that need to operate on overlapping data: a note may show up in a notes app, a graph viewer, a search palette, and a database. The classical answer is to define a single document model in the shell — but that is the monolithic-shell trap. Instead, Brainstorm adopts an **external standard for entity types and embeddable UI** so that:

- Type definitions are addressable URLs, owned by no single app.
- A block UI is a contract any app can render or embed without knowing the producer.
- New apps interoperate with old data simply by speaking the protocol.
- Blocks built for Brainstorm should be portable to other BP-compatible hosts (HASH, WordPress, …) and vice versa.

## What Block Protocol actually is

BP is **four module specifications**, versioned independently. Brainstorm uses all four:

| Module        | What it specifies                                                                                  | Brainstorm's use                                            |
|---------------|----------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| **Core**      | Base contract for how a block initializes, declares its requirements, and exchanges messages with an embedding application. | Every block in Brainstorm conforms to Core.                 |
| **Graph**     | The shared data model: **property types**, **entity types**, **link (entity) types**, **entities**, **links**. All addressable by URL. | The entities service implements Graph for Brainstorm.       |
| **Hook**      | Lets a block defer rendering of an arbitrary UI to the host (e.g. "render a rich-text editor for this property here"). | The shell provides hook handlers — rich text via Lexical, menus via fancy-menus, file pickers via the files service. |
| **Service**   | Lets a block call external services (e.g. an LLM, image generation, mapping) **through the host**, without the block holding credentials. | The `intent.process` verb (see [17-interoperability.md](../platform/17-interoperability.md)) is implemented over Service — apps that broker external services register as Service handlers. |

This is more than earlier drafts of this doc treated BP as (just "entity types + link types + blocks"). The Hook and Service modules are first-class and load-bearing for Brainstorm.

## The Graph type system

BP's type system has **three first-class, separately-addressable kinds of types**, all identified by URL:

- **Property types** — small reusable typed values: a "name" property type, a "due date" property type. Each has a JSON-Schema-shaped definition; property types can refer to other property types.
- **Entity types** — what entities are: a "Note" entity type lists which property types it includes (required and optional) and which link types are allowed. Entity types can extend other entity types.
- **Link (entity) types** — typed edges: "linked to" / "depends on" / "authored by". Each has a source-type and destination-type constraint, plus optional cardinality.

URLs are versioned (BP convention is a versioned URL like `…/types/entity-type/note/v/1`). Once published, a type is immutable. New versions are new URLs.

> **Decision:** Brainstorm uses BP's URL-versioned type system as-is. Where earlier drafts of this doc implied entity-type schemas could be inlined in app manifests, the corrected story is: types live at URLs (resolvable via local cache + offline-bundled fallback per OQ-7), and apps reference them.

> **Decision:** Brainstorm adopts the `@blockprotocol/type-system` package as the type-system runtime where practical. This includes its WebAssembly-compiled validators (auto-generated from the Rust reference implementation). We do not maintain a parallel type-system implementation.

## Where Brainstorm extends BP (and where it doesn't)

Brainstorm extends BP at exactly two layers:

1. **PropertySchema overlays** — see [19-properties-and-schemas.md](19-properties-and-schemas.md). BP's type system is canonical and immutable; users want to add fields to entities without forking a new entity-type version. PropertySchema overlays sit *above* BP types — they don't modify the canonical type, they layer additional fields onto the entity at read time. Effective schemas are `BP type schema ∪ matching overlays`.

2. **`BlockEmbedNode` for in-Lexical embedding** — see [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md). BP defines block-to-host messaging; Brainstorm adds one Lexical node type that bridges from rich-text contexts to BP block embeds. This does not change BP's contract; it's how Brainstorm threads BP blocks into a Lexical document.

Brainstorm does **not** extend:

- The Core message protocol (we use it as-specified).
- The Graph type system shape (we use it as-specified; PropertySchemas live alongside, not inside).
- Versioning semantics (we use BP's URL versioning).
- Block manifests (we use BP's metadata format; our app manifest references blocks by their BP id).

## Tooling we adopt from BP

Block authors building Brainstorm blocks use BP's existing developer tooling:

- **`@blockprotocol/core`, `@blockprotocol/graph`, `@blockprotocol/hook`** — runtime libraries.
- **`@blockprotocol/type-system`** — type-system runtime (WASM, generated from Rust).
- **`create-block-app`, `block-scripts`, `block-template-*`** — scaffolding for new blocks.
- **`mock-block-dock`** — testing environment that simulates an embedding application.
- **`blockprotocol` CLI** — interacting with the BP API for publishing types.

These are **the** developer experience for blocks in Brainstorm. We do not ship parallel tooling. Brainstorm's app SDK ([08-app-sdk.md](../apps/08-app-sdk.md)) wraps these where needed but does not replace them.

## Entities

An **entity** is a piece of structured data with:

- An **id** (unique within the local store; UUID-shaped).
- An **entity type** (a URL pointing to a schema).
- A **properties** record matching the schema.
- **Links** to other entities, typed by link-type URL.
- Provenance: created-by app, created-at, last-edited-by app, last-edited-at.

Example (a note):

```jsonc
{
  "id": "ent_01HXK…",
  "entityType": "io.example/Note/v1",
  "properties": {
    "title": "Meeting prep",
    "tags": ["work", "Q2"],
    "body": { "$ref": "doc://01HXK…/body" }   // see "Rich text" below
  },
  "links": [
    {
      "linkType": "io.example/links/related-to/v1",
      "destinationEntityId": "ent_01HXM…"
    }
  ]
}
```

> **Decision:** entity ids are local identifiers, not Block-Protocol entity URLs. Entity type URLs are global; entity instance ids are local. (Block Protocol does treat instances as URL-addressable; Brainstorm keeps that for cross-instance sharing later.)

### Where entities live

The **entities service** (a core service inside the shell — see [02-architecture.md](../foundations/02-architecture.md)) is the canonical store. It exposes:

- `getEntity(id)` / `getEntitiesByType(type, query?)` — read.
- `createEntity(type, properties, links?)` — write.
- `updateEntity(id, patch)` — partial update.
- `deleteEntity(id)` — soft-delete (recoverable for a window).
- `subscribe(query, callback)` — live updates.
- `query(...)` — structured query over types, properties, and links.

These are exposed to apps via host-service IPC, gated by `entities.read` / `entities.write` capabilities scoped per type.

Internally, entities are persisted as records that point at Yjs docs for any rich content. See [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md) for how the two layers compose.

## Entity types

An **entity type** is a JSON-schema-shaped document at a URL, e.g. `io.example/Note/v1`. It defines:

- The shape of `properties`.
- Required vs. optional fields.
- Allowed link types and their destination types (constraints).
- Display hints (which property is the "title", which is the "body", which is a "thumbnail").

In Brainstorm:

- Types are **registered** by apps (via manifest `entityTypes`) but **not owned** by apps. Other apps may declare they handle the same type.
- Type URLs are versioned in the URL itself (`/v1`, `/v2`). Types are immutable once published; revisions are new URLs.
- The shell maintains a local **type registry** that resolves type URLs to schemas, fetched from sources or bundled by apps.

> **Decision (OQ-7, resolved):** URL resolution is **reverse-DNS-only** — type ids (`io.example/Note/v1`) are opaque identifiers; schemas come from app bundles / the inline `entity_types` registry and are **never fetched**. `https://`-fetchable types are a post-v1 cross-org-interop consideration; no hosted registry.

> **Decision (OQ-DM-1, resolved — see [21-objects-and-collections.md](21-objects-and-collections.md)):** an object has **exactly one** `entityType` (this column, the Block-Protocol `entityTypeId`, the Yjs-doc identity — unchanged). User-facing multi-typing is expressed through **Collection membership**, not multiple types: a Collection (= `brainstorm/List/v1`) may own a `collection`-scoped property schema (19), and an object's *effective* schema is its type's canonical schema ∪ every member collection's overlay — the composition the entities service already performs. There is **one shared object space** (`entities.db` via the entities service); per-app `kv.json` entity silos are removed and apps become views/editors over Collections. No `entities.db` schema change, no Block-Protocol divergence. **Every object additionally has a universal, lazy canonical `body` rich-text fragment** (a `Y.XmlFragment` named `"body"` in its Y.Doc) — rich text is intrinsic to every object, not a per-type property; apps are workflows that choose which properties to edit and whether to surface the body editor (see [21 §Universal rich-text body](21-objects-and-collections.md)).

## Links

Links are typed edges. A link type URL specifies:

- The source entity type (constraint).
- The destination entity type (constraint, may be union).
- Cardinality (one-to-one, one-to-many, many-to-many).
- Display hint (how to render the link in a generic view).

Apps query links the same way they query entities. The graph-viewer app, for example, reads links across all types it has access to and renders them as a graph.

## Blocks

A **block** is a UI component that:

- Renders content from an entity (or a transient/inline value).
- Edits that content via a **block protocol message channel** with the host.
- Is identified by a block id (e.g. `io.example.text-editor/paragraph`).

A block does not know its host. It receives messages like "here is your entity" and emits messages like "the user changed property X to Y".

In Brainstorm, blocks are how an app can be embedded *inside* another app's UI without coupling:

- App A's document includes a reference to a block of type `io.example.code/code-snippet` bound to entity `ent_…`.
- The shell looks up which app provides that block id (via the registry) and embeds the block in App A's window via a **block frame** (typically an iframe scoped to that block, communicating with App A — and through App A to the host — via Block Protocol messages).

> **Decision:** cross-app block embedding is via iframe-isolated block frames, not direct shared rendering. This preserves process isolation between apps even when they appear to compose visually. The iframe is mounted **inside the embedding app's renderer** (closes OQ-8 as resolved in [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md)).

The full integration story between Block Protocol embeds and Lexical custom nodes — when to use which, how they share the Yjs substrate, and the capability subject when a block reads its bound entity — is in [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md).

## Rich text inside entities

Some properties are *not* primitive — a note's `body` is rich text. Brainstorm handles this via a property convention:

```jsonc
"body": { "$ref": "doc://01HXK…/body" }
```

The `$ref` points to a Yjs doc / fragment. Apps that know how to render rich text follow the ref; apps that don't see a placeholder ("[rich content]") via the type's display hints. See [07-editing-lexical.md](../editing/07-editing-lexical.md) for the editor side.

## What apps see vs. what the shell sees

- An **app** sees: typed entities, queries, links, block embedding.
- The **shell** sees: a generic record store and a Yjs doc store. It knows nothing about `Note`, only that an entity of type `io.example/Note/v1` exists.

This separation is the whole point. The shell can persist, sync, search, and back up entities without ever interpreting them.

## Search

The search service indexes:

- Entity properties (per their type's display hints — title, summary, etc.).
- Yjs document content (text content of rich-text fields).
- File names of files known to the shell.

It does **not** index blocks directly; the entity behind the block is what gets indexed. This keeps the index aligned with the data, not with how it happens to be displayed.

## What this enables

- An app written six months from now can ingest existing notes if it speaks the same entity-type URL.
- A graph viewer can be installed and immediately see all link relationships across the system.
- Removing the original "owner" app for a type leaves the data fully usable: a fallback renderer derives a reasonable view from the type schema.
- A new block type (e.g. a Mermaid diagram) becomes embeddable everywhere as soon as one app publishes it.
