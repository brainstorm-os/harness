# Objects and collections

Status: **design** (resolves [OQ-DM-1](../reference/11-open-questions.md); gates implementation-plan §9.3.5). This doc unifies decisions already split across [05-data-and-blocks-protocol.md](05-data-and-blocks-protocol.md) (entities, types, Block Protocol), [19-properties-and-schemas.md](19-properties-and-schemas.md) (composable properties, layered scopes incl. `collection`), [apps/30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md) (membership-on-container, multi-membership), and [apps/database/10-lists-sets-collections.md](../apps/database/10-lists-sets-collections.md) (Query/Manual/Hybrid Lists). It does not introduce a new mechanism so much as **activate and unify** mechanisms the docs already specify, and removes the per-app entity silos that contradict them.

## The problem

Today each first-party app persists its own entities in a private `<vault>/data/apps/<app-id>/kv.json` silo; the `vault-entities` service merely *aggregates* those silos read-only, and every entity carries exactly one hardcoded, app-owned `type` (`io.brainstorm.notes/Note/v1`, `brainstorm/Task/v1`, …). Consequences:

- An object can't exist in two apps' worlds. "Add this note to Tasks" is impossible.
- Types are app-owned and fixed; users can't define their own.
- The same conceptual object (a note that is also a task) is two unrelated rows in two silos.

This contradicts the data model the docs already describe: a single canonical entities service (05), composable properties with a `collection` scope (19), membership-on-container with multi-membership (30), and unified Lists (database/10). The remodel makes the implementation match the design.

## The model

Four concepts, each already in the docs; this section pins how they relate.

- **Object** — the unit of data and of a Y.Doc (unchanged from 06: exactly one Y.Doc per entity). One row in the single shared `entities.db`. Has an id, a `properties` bag, links, provenance. *Object* and *entity* are the same thing; "object" is the user-facing word.
- **Type** — a Block-Protocol entity-type URL (e.g. `brainstorm/Note/v1`). Identity + interop schema. **An object has exactly one type.** Registered in the shared `entity_types` registry, *not owned by any app* (05 already says this).
- **Collection** — a schema-bearing, membership-defining, view-owning object. Unifies with `brainstorm/List/v1` (source + `members.include/exclude` + `views`, the Query/Manual/Hybrid model from database/10). A Collection may declare a **property schema** (a set of `PropertySchema` entities scoped `{ kind: "collection", target: <collectionId> }` — already specified in 19). Membership is M:N: an object may be in many collections.
- **Property** — composable `PropertySchema` entities (19, unchanged). Vault-level, reusable, scoped.

> **Decision (resolves OQ-DM-1; closes the cardinality fork):** an object keeps **exactly one Block-Protocol `type`** (the existing `entities.type` column, the BP `entityTypeId`, the Yjs-doc identity). **Multi-typing is expressed through Collection membership, not multiple `type`s.** A user-defined Collection with a schema *is* a user-defined "type" in the user's mental model; an object in N collections has the **union** of its type's canonical schema + every member collection's `collection`-scoped overlay — which is exactly the effective-schema composition the entities service already performs (19 §Layered scopes). This is option (c) of OQ-DM-1, reframed: one stable type for identity/Block-Protocol/Yjs; Collections as the flexible, user-definable, additive multi-membership layer. No `entities.db` schema change, no Block-Protocol divergence, no Yjs-doc-identity change.

> **Decision:** **Collection unifies with `brainstorm/List/v1`.** "List", "Set", "Collection" are one entity type — the database/10 model (a `source` query + `members.include/exclude` → Query / Manual / Hybrid) is the collection. A Collection additionally may own a property schema (collection-scoped `PropertySchema` overlays) and a default template. There is no separate "Collection" entity type to invent; there is the List, promoted to first-class across the product (not database-app-internal).

> **Decision (membership ⇒ inheritance):** "adding an object to a collection makes it inherit that collection's properties" is **not new mechanism** — it is the existing `scope: { kind: "collection", target }` overlay (19) composed by the entities service into the effective schema. Membership semantics follow 30: **membership is authoritative on the collection** (`members` + `source`), the object doesn't know its collections; reverse lookup ("which collections contain E?") is the SQL reverse index over `links` / `members`. Removing a collection never mutates member objects.

## Universal rich-text body

User directive (2026-05-15): *every object is a rich-text body **plus** properties; all objects are structurally identical and differ only in their properties (the type/collection schema) and the app-workflows that operate on them.* This is the conclusion of the model above, not a new mechanism — 06-collaboration-yjs already makes every entity exactly one Y.Doc that may hold rich-text fragments, and 19 already has a `richText` base value type.

> **Decision (universal body):** every object has a **canonical `root` rich-text container** — a `Y.XmlText` named `"root"` in the object's Y.Doc (the well-known name `@lexical/yjs`'s `createBinding` binds to — `doc.get('root', XmlText)`). It is **universal** (every object, regardless of type/collection), **lazy** (the root doesn't exist on disk until first edited — an unused body is zero storage + zero Y.Doc tail; both Yjs and `@lexical/yjs`'s `shouldBootstrap` preserve the empty-doc invariant), and **not** a per-type opt-in property. Rich text is therefore not a property at all — it is intrinsic to every object, alongside the property bag. (The 19 `richText` value type remains for *additional* rich-text properties beyond the primary body, e.g. a separate "review" field.) The 9.3.5.B keystone originally named the root `"body"` / `Y.XmlFragment`; the reconciliation to `"root"` / `Y.XmlText` landed in 9.3.5.N2 once the `@lexical/yjs` binding shape was confirmed — zero on-disk migration cost (no production data on either name), zero @lexical/yjs fork.

> **Decision (apps = workflows over uniform objects):** there is no structurally special "rich-text app". An app/workflow declares which **properties** it edits and **whether it surfaces the body editor** (and where — primary surface vs. an expandable notes panel). Notes is the workflow whose *primary* surface is the body; Tasks/Bookmarks/etc. are workflows whose primary surface is properties — but the same object still carries a body, editable through any workflow that chooses to show it. "Open this task as a document" / "add rich notes to this bookmark" are then free — same object, different workflow.

> **Decision (no Block-Protocol / migration impact):** one `entityType` per object is unchanged; the body is rich text *inside* the entity's Y.Doc exactly as 05/06 already model it (BP sees the type + properties; the body is the Yjs layer). The in-flight per-app `kv.json`→entities migrations (§9.3.5.x) are **not reworked** — they migrate the property bag; the universal body rides the existing 9.3.2b transport (`loadDoc`/`applyDoc` base64 update channel). Surfacing a body editor inside a property-first app (Tasks notes, Bookmark annotations, …) is a per-app **workflow** rung, never a data migration.

## Layouts — the third dimension

Already designed in [shell/27-layouts.md](../shell/27-layouts.md) + planned as Stage 8 (the form-designer *is* the layout builder); recorded here only to tie it into the uniform-object model — no new machinery.

> **Decision (workflow = collection × schema × layout × behaviors):** given uniform objects (body + properties), a Layout (`brainstorm/Layout/v1`, 27-layouts) is the third independent dimension — *how* an object's body + properties are arranged for a `context` (full / card / row / chip / preview / whiteboard / print). Layouts are **data**, scoped under the **same layered-overlay precedence as PropertySchema** (19): `entity > collection > type > user > org > app-default > shell-fallback`, resolved per `(object, context)`, per-render, with a fallback so every object renders something. The OQ-DM-1 `collection` scope makes the existing `{kind:"collection"}` Layout scope concrete (a Collection can carry a default layout the same way it carries a property schema). **"Adjust the layout for one entity" is the existing `{kind:"entity"}` Layout scope** — not new mechanism; the layout builder (Stage 8.10 form-designer) authors a Layout entity at whatever scope (`entity` = this one object, `collection`/`type` = all of a kind, `user`/`org` = personal/shared). An "app" is therefore fully expressible as *(a Collection) × (its effective schema) × (its effective layouts per context) × (its behaviors/intents)* — which is precisely why apps are workflows over uniform objects, not owners of bespoke data + UI.

## Single shared object space

> **Decision:** there is **one** object store: `entities.db`, via the entities service (9.3.1). Per-app `kv.json` entity silos are **eliminated**. Apps read and write the shared space through `entities.*` (capability-gated per type, per 05/09). The `vault-entities` aggregator is deleted once every app is migrated; until then it bridges un-migrated apps read-only (avoid-blocking — incremental).

> **Decision:** **apps become views/editors over collections, not owners of types or stores.** Each first-party app is bound to a seeded Collection (Notes ↔ a "Notes" collection whose `source` selects `Note/v1`; Tasks ↔ "Tasks"; etc.) and is an opinionated editor for that collection's schema. The Database app is the *generic* collection browser/editor (all six view kinds). Because the space is shared, an object that is a `Note/v1` can be added to the "Tasks" collection, gain the Tasks schema overlay, and appear in the Tasks app — without copying or retyping it.

## Block Protocol reconciliation

The Block Protocol Graph model gives each entity one `entityTypeId` (05). That is preserved: the object's single `type` is its `entityTypeId`. Collection-contributed properties live in the **effective schema** (already a Brainstorm overlay concept the entities service composes — 19 §"schema composition happens in the entities service"), which is a Brainstorm extension *above* the canonical BP type, not a change to it. At the Block-Protocol boundary an object exports its one type + its property values; collection overlays are Brainstorm-side enrichment. **No BP divergence; no `types: string[]`.**

## Yjs

Unchanged from 06. One Y.Doc per object; object identity is the doc identity. Collections are other objects (other docs); membership is data (`members` / links), never shared doc state. The remodel does not touch Yjs-doc routing.

## What changes vs. what doesn't

| Layer | Change |
|---|---|
| `entities.db` schema | **No change.** `type` stays single (= BP identity). Membership reuses List `members` + the `links` reverse index. `entity_types` registry unchanged. |
| Composable properties (19) | **No change.** `scope:{kind:"collection"}` overlays + effective-schema composition are the inheritance mechanism, already specified. |
| Y.Doc model (06) | **No change.** |
| Block Protocol mapping (05) | **No change.** One `entityTypeId`; collection overlays are a Brainstorm extension in the effective schema. |
| Per-app `kv.json` silos | **Removed.** One-time import into `entities.db` per app, folded into each app's already-pending "write-half" iteration. |
| `vault-entities` aggregator | **Removed** once all apps migrated; bridges un-migrated apps until then. |
| First-party apps | Refactored to read/write the shared entities service against their seeded Collection. Incremental, one app per iteration. |
| `List/v1` | Promoted from database-app-internal to the product-wide Collection. |

## Migration

1. **Seed Collections for existing types** — a "Notes" / "Tasks" / "Bookmarks" / … Collection per current per-app type, `source` = a Set query selecting that type (1:1, backward-compatible — nothing breaks; the app renders its collection).
2. **Per-app store import** — each app's pending "write-half" iteration (9.12.2 write half, etc.) becomes "migrate this app off `kv.json` onto the entities service." Existing `kv.json` rows are imported once; the app thereafter reads/writes the shared space.
3. **Retire the aggregator** — when the last app is migrated, delete `vault-entities-service`.
4. **Multi-membership UX** — only after the space is shared: the "add object to collection" affordance, collection schema editor (reuses the property constructor), reverse "collections containing this object" panel.

> **Decision:** migration is **incremental and backward-compatible** (avoid-blocking). The collection model + seeded collections land first (nothing breaks). Apps migrate one per iteration. Big-bang is rejected.

## Open sub-points (resolve during the ladder, non-blocking)

- User-facing naming: is the user word "Type", "Collection", or both surfaced differently? (we've unified Set/Collection into List — the UX label is a product-design call, not a model call.)
- Default-template ownership when an object is in multiple schema-bearing collections (precedence already defined by 19 §Conflict resolution: more-specific scope wins; `collection` > `type`).
- Whether a seeded app Collection's `source` is a `byType` Set, a `byMembership` Manual list, or Hybrid per app (database/10 already supports all three).

## Implementation

Gated behind this design (stage-gating). Ladder in [implementation-plan.md §9.3.5](../implementation-plan.md). Substrate (the shared `entities.db` + entities service) already exists from 9.3.1; the remodel is the seeded-collections layer, the per-app store migrations, and the multi-membership UX — not a new storage engine.
