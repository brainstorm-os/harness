# Database — data model

This doc defines the two canonical entity types the Database app introduces and how their values are laid out in the Y.Doc + entities table. Read [00-overview.md](00-overview.md) first; the *why* of the design (and the rationale for unifying sets and collections into one List entity) is in [10-lists-sets-collections.md](10-lists-sets-collections.md).

## The two canonical types

| Type URL                                  | What it is                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `brainstorm/List/v1`                      | One List: a name, an icon, a source (criteria), member overrides, and a set of view references. |
| `brainstorm/ListView/v1`                  | One view onto a List: kind, per-view filters, sorts, group-by, visible columns, layout-specific options. |

Both are registered by the Database app via its manifest's `entityTypes` block (see [apps/03-app-model.md](../03-app-model.md)). Like every entity-type registration, the schema lives at a URL (with optional inline copy per **OQ-2 → hybrid**) and other apps may handle the same types (per [data/05-data-and-blocks-protocol.md](../../data/05-data-and-blocks-protocol.md)).

> **Decision:** Lists and ListViews are entities, not nested block content. This diverges from prior tools that embed a dataview's full state in a page block's content. Splitting them out means:
> - A List can be shared across apps (Notes embeds it, Explorer renders it) without re-creating state.
> - A List survives the page it was created on.
> - A ListView can be duplicated, exported, or referenced from multiple Lists (e.g. a "this-quarter Tasks" view used on both the personal and team list).
> - The capability surface is uniform (`entities.read`/`entities.write` per type) — no extra "block content edit" path.

## `brainstorm/List/v1`

```jsonc
{
  "id": "ent_list_01HXK…",
  "type": "brainstorm/List/v1",
  "properties": {
    "name": "Movies to watch",
    "icon": { "kind": "emoji", "value": "🎬" },
    "description": "Things I want to watch this year.",

    "source": { /* ListSource — see below */ },

    "members": {
      "include": [
        { "entityId": "ent_movie_01HXM…", "addedAt": 1731418800000, "by": "app:database" }
      ],
      "exclude": [
        { "entityId": "ent_movie_01HXN…", "removedAt": 1731418800000, "by": "user" }
      ]
    },

    "views": ["ent_view_01HXP…", "ent_view_01HXQ…"],
    "defaultViewId": "ent_view_01HXP…",

    "createdAt": 1731000000000,
    "updatedAt": 1731418800000
  }
}
```

### Fields

- **`name`** — `text`, `count: {1, 1}`. The label shown in the title bar and launcher.
- **`icon`** — `Icon | null` per [foundations/39-universal-icons.md](../../foundations/39-universal-icons.md).
- **`description`** — `text`, optional, single, multiline. Surfaced under the title.
- **`source`** — the *criteria* that produces dynamic members. Structure in §The `ListSource` shape below. May be `null` for a pure Manual list.
- **`members`** — explicit overrides over what the source returns. Both `include` and `exclude` are arrays.
- **`views`** — ordered array of `ListView/v1` entity ids. The List **owns** its views by reference (deleting the List soft-deletes the views; views can also be detached).
- **`defaultViewId`** — which view to open by default. If unset, the first view in `views` wins.

### The `ListSource` shape

A `ListSource` is a structured query. It composes from four primitive source kinds and a composite operator:

```ts
export enum ListSourceKind {
  ByType = "byType",
  ByFilter = "byFilter",
  ByLink = "byLink",
  ByVocabulary = "byVocabulary",
  Composite = "composite",
}

export type ListSource =
  | { kind: ListSourceKind.ByType;       types: string[]; }
  | { kind: ListSourceKind.ByFilter;     where: PropertyPredicate; }
  | { kind: ListSourceKind.ByLink;       linkType: string; direction: "in" | "out"; anchorEntityId: string; }
  | { kind: ListSourceKind.ByVocabulary; vocabularyId: string; values?: string[]; }
  | { kind: ListSourceKind.Composite;    op: "and" | "or"; sources: ListSource[]; }
  | null;                                                          // pure Manual mode
```

| Kind             | What it produces                                                                                                              | Example                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `byType`         | All non-deleted entities whose `type` is one of the listed URLs.                                                              | `{ kind: ByType, types: ["io.example/Movie/v1"] }`                                   |
| `byFilter`       | Entities matching a `PropertyPredicate` (the same one used in `entities.query` per [18-storage-and-search.md](../../data/18-storage-and-search.md)). | `{ kind: ByFilter, where: { "$eq": { "assignee": "ent_user_self" } } }`              |
| `byLink`         | Entities reachable from `anchorEntityId` by a typed edge (in either direction).                                               | `{ kind: ByLink, linkType: "…/depends-on/v1", direction: "out", anchorEntityId: "ent_…" }` |
| `byVocabulary`   | Entities whose `text`-with-vocabulary property points at the listed vocabulary values.                                        | `{ kind: ByVocabulary, vocabularyId: "ent_vocab_status", values: ["todo", "doing"] }` |
| `composite`      | AND/OR composition of any of the above. Arbitrary depth.                                                                      | `{ kind: Composite, op: "and", sources: [...] }`                                     |
| `null`           | No source — Manual mode. Members are exactly `members.include`.                                                                | —                                                                                    |

The `byType` kind is the page-database equivalent and the most common source. The `byFilter` kind subsumes the conventional "set by single relation" source. The `byLink` kind expresses "set by relation pointing to this object" (e.g. "all Tasks where `parentProject = <this project>`"). The `composite` kind is the AND/OR composition prior tools typically *cannot do* — `("Book" AND status = "unread") OR ("Movie" AND status = "unwatched")`. This was a top-voted ask in prior community feedback on flat sets.

> **Decision:** `byLink` lets a Set query members through links, not just property predicates. This is the BP-native form of "this is a Set of objects related to *this* one." Anchor is stored by id; deleting the anchor entity soft-deletes the List by side-effect (the source is unsatisfiable). The user is warned, not silently dropped.

> **Open:** can `byLink`'s anchor be **multiple** entities (a List of "objects related to any of these")? Tracked as **OQ-LD-1** in [11-open-questions.md](../../reference/11-open-questions.md). Tentative leaning: yes, with `anchorEntityIds: string[]` and an implicit OR.

### The `members` overrides

`members.include` and `members.exclude` are stored as `Y.Array` of small records. They encode user intent that is *not* expressible as a source:

- **`include`** — entities the user explicitly added that the source may or may not match. `entities.query(source)` returns set `S`; the effective List is `(S ∪ include) \ exclude`.
- **`exclude`** — entities the user explicitly removed from a source match. Effective List drops them even if they keep matching the source.

```ts
type MemberOverride = {
  entityId: string;                       // ULID
  addedAt?: number;                       // ms (set on include)
  removedAt?: number;                     // ms (set on exclude)
  by: "user" | `app:${string}`;           // for audit
  reason?: string;                        // optional user note
};
```

When a user "drags an entity into" a List that has a source: if the dragged entity already matches the source, nothing is written (a no-op); otherwise it lands in `members.include`. When a user removes an entity from a List: if it's in `members.include`, that record is deleted; if it matches the source but isn't pinned, it's added to `members.exclude`; if it neither matches nor is included, nothing is written.

> **Decision:** `members` is bounded. Hard cap **5,000** per List (sum of include + exclude). This is large enough for any human-curated set; sources scale to millions. UI nudges promotion of a high-membership Manual list to a Query list ("we noticed everything you've added has type = Movie — convert to a Query?").

### Why not store members as a relation on each entity?

The natural alternative is: drop `members` from the List entity; on each entity, store an inverse property `inList: List[]`. This would mirror how a conventional "in-database" relation works and how PropertySchema's `scope.collection` was sketched.

We reject it for v1 because:

1. **Source-driven inclusion would still need a side-record.** A Query list's members are computed; you can't materialize them as a stored property without doubling writes.
2. **Multi-membership counts get expensive.** Showing "this entity is in 7 Lists" requires inverse-relation queries on every entity render. Centralizing in the List avoids it.
3. **Single-writer auditability.** The List entity is the one place where "what's in this list?" is decided; the audit trail (who added what when) sits there cleanly.

> **Decision:** membership is stored on the List, not on the entity. PropertySchema `scope.kind = "list"` (the renamed `"collection"` scope from [19](../../data/19-properties-and-schemas.md)) is *resolved* against the effective List membership at composition time, not stored as an inverse on each entity. The List's `members` array is canonical; the entity's "what Lists am I in?" is computed.

### Storage shape

Inside the `List/v1` entity's Y.Doc:

```
root: Y.Map
├── "type":         "brainstorm/List/v1"
├── "properties":   Y.Map
│   ├── "name":         Y.Text                              // collaborative title
│   ├── "icon":         { kind, value }                     // bare JSON in Y.Map
│   ├── "description":  Y.Text
│   ├── "source":       Y.Map  (recursive — see below)
│   ├── "members":      Y.Map
│   │   ├── "include":  Y.Array<MemberOverride>
│   │   └── "exclude":  Y.Array<MemberOverride>
│   ├── "views":        Y.Array<viewEntityId>
│   ├── "defaultViewId":string
│   ├── "createdAt":    number
│   └── "updatedAt":    number
└── "links":        Y.Array<linkRecord>                     // empty for a List; reserved
```

`source` itself is a small JSON-shaped tree mirrored as Y.Maps and Y.Arrays so two devices can edit its predicate concurrently. For sources that are simple (just `byType`), the value is a tiny Y.Map; for `composite` sources of depth `n`, recursion follows naturally.

> **Decision:** the entire source predicate goes into the Y.Doc, not a side table. Concurrent edits to filter trees (two devices adjusting predicates at the same time) merge via Yjs the same way two notes merge — the last writer doesn't clobber, and the merge is structural.

## `brainstorm/ListView/v1`

```jsonc
{
  "id": "ent_view_01HXP…",
  "type": "brainstorm/ListView/v1",
  "properties": {
    "name": "By status",
    "icon": { "kind": "pack", "value": "phosphor/columns" },
    "listId": "ent_list_01HXK…",

    "kind": "board",

    "filters":  [ /* per-view filter overlay — see 30-filters-sorts.md */ ],
    "sorts":    [ /* multi-key sort */ ],

    "groupBy":   { "propertyId": "ent_prop_status_for_movie" },
    "coverProperty":     "ent_prop_poster",
    "cardSubtitleProperty": "ent_prop_year",

    "columns": [
      { "propertyId": "ent_prop_name",   "width": 240, "visible": true,  "displayOverride": { "view": "inline" } },
      { "propertyId": "ent_prop_status", "width": 120, "visible": true,  "displayOverride": { "view": "pill"   } },
      { "propertyId": "ent_prop_year",   "width":  80, "visible": false }
    ],

    "defaultTypeUrl":   "io.example/Movie/v1",
    "defaultTemplate":  null,

    "pageSize": 50,
    "layoutOptions": {
      "columnWidth": 280,
      "collapseEmptyColumns": false,
      "cardPreview": "rich"
    }
  }
}
```

### Fields

- **`name`** — required, `text`. Shown in the view switcher tab.
- **`icon`** — `Icon | null`. Optional; defaults to the kind's glyph.
- **`listId`** — back-pointer to the parent List. Set on view creation; not user-editable through the property panel. Ensures cleanup on List delete.
- **`kind`** — TS string enum (`ListViewKind.Grid | List | Gallery | Board | Calendar | Timeline`). Drives which renderer mounts. See [20-views.md](20-views.md).
- **`filters`** — per-view filter overlay (AND-combined with the List's source). [30-filters-sorts.md](30-filters-sorts.md).
- **`sorts`** — multi-key sort spec. [30-filters-sorts.md](30-filters-sorts.md).
- **`groupBy`** — required for `board` (the column property — vocab / entityRef / boolean) and `calendar` (the date property whose value places the entity on the grid). Timeline does **not** use this field — its placement and optional swimlane property both live inside `TimelineLayoutOptions` (see [20-views.md §Timeline](20-views.md)). Other kinds ignore it. (The asymmetry — placement config at the top level for two kinds, inside `layoutOptions` for one — is tracked as **OQ-LD-17**.)
- **`coverProperty`** / **`cardSubtitleProperty`** — gallery and board card chrome.
- **`columns`** — visible properties per view. The order of the array is the visual order. Each entry references a PropertySchema id, optionally with a per-view `displayOverride` (e.g. show this entityRef as `chip` here even though the schema default is `card`).
- **`defaultTypeUrl`** — when "+ New" is clicked, what type to create. Inferred from the List's source if it's `byType` with a single type. Otherwise user-set. Required for "+" to be enabled.
- **`defaultTemplate`** — entity-id of a template to clone when creating. Optional; v2 — `null` for v1.
- **`pageSize`** — pagination size; default `50`.
- **`layoutOptions`** — kind-specific UI tweaks. **Discriminated by `kind`**: each kind has its own option shape in [`apps/database/src/types/list-view.ts`](../../../apps/database/src/types/list-view.ts) (`BoardLayoutOptions` ≠ `CalendarLayoutOptions` ≠ `TimelineLayoutOptions` ≠ …). The example above shows the Board shape because the example's `kind` is `"board"`; switching `kind` would change the legal shape of `layoutOptions`. Validation lives on the typed surface, not in JSON Schema.

### Storage shape

Same Y.Doc convention as List. The arrays (`filters`, `sorts`, `columns`) are Y.Arrays so concurrent edits to a view's column order from two devices merge structurally.

## Scope of PropertySchemas with `scope.kind = "list"`

[19-properties-and-schemas.md](../../data/19-properties-and-schemas.md) declares a PropertySchema `scope.kind = "collection"` for v2. With Lists shipping, we rename it to `"list"` (consistent with the rest of this app) and pin its semantics:

```ts
type Scope =
  | { kind: "entity";    target: string }   // applies to one entity
  | { kind: "type";      target: string }   // applies to all entities of type URL X
  | { kind: "list";      target: string }   // applies to entities currently *in* List L
  | { kind: "user";      target: string }   // applies to all entities owned by user U
  | { kind: "org";       target: string };  // applies to entities in org O (v2)
```

**A PropertySchema with `scope.kind = "list"` applies to an entity E iff E is in the *effective membership* of List L** — i.e. `((source matches) ∪ include) \ exclude`. This is well-defined for both Manual and Query and Hybrid modes.

> **Decision:** the property is *resolved* per-render; it is not stored on the entity. When E enters L's membership, the property "lights up"; when E leaves, the value is preserved (per [19 §Remove](../../data/19-properties-and-schemas.md): removing a PropertySchema does not delete values) but no longer surfaced in views over E.

> **Decision:** rename `scope.collection` → `scope.list`. The earlier name predates the unified List entity. PropertySchema is canonical-form-changing, so this is a v1-or-never rename — settled here.

> **Open:** when E is currently in *no* List, does a `scope.kind = "list"` property still hold its value on E for later? Or is the value purged when E leaves the last List that scoped it? Tracked as **OQ-LD-2**. Tentative: hold (the value stays — leaving a List is not destructive).

## Indexes

Two SQL indexes the entities service materializes for List traversal:

```sql
-- Lookup "lists this entity is pinned into" (manual include)
CREATE INDEX idx_list_member_include
  ON entities (type, json_extract(properties, '$.members.include[*].entityId'))
  WHERE type = 'brainstorm/List/v1';

-- Lookup "views attached to this list"
CREATE INDEX idx_view_list
  ON entities (type, json_extract(properties, '$.listId'))
  WHERE type = 'brainstorm/ListView/v1';
```

Source-driven membership uses the existing `idx_entities_type`, `idx_links_*`, and per-type property indexes (per [18-storage-and-search.md](../../data/18-storage-and-search.md)) — sources compile to the same SQL the entities service already serves.

## Migration / forward-compat

There is no v0 to migrate from. When this lands, **default Lists** are seeded for the v1 type set the user already has (e.g. the type-List `All Notes`, `All Folders`, `All Files`, `All Tasks`). These are first-class `List/v1` entities with `source = { kind: ByType, types: ["…/v1"] }` and `members = { include: [], exclude: [] }`; they're flagged with a `system: true` property (read-only) so the user cannot delete them, only hide them from the launcher.

> **Open:** which built-in type-Lists ship with v1, vs which appear on-demand as the user installs apps that register new types? Tracked as **OQ-LD-3**. Tentative: ship `All Notes`, `All Folders`, `All Files`, `All Workflows`, `All Reminders`, plus one per installed first-party app's entity type; defer Explorer-style "browse all types" to the Explorer app.

## What this doc does *not* cover

- *Why* sets and collections are one entity — that's [10-lists-sets-collections.md](10-lists-sets-collections.md).
- View kinds and their option shapes — [20-views.md](20-views.md).
- Filter / sort / group-by predicates — [30-filters-sorts.md](30-filters-sorts.md).
- "+ New" entity creation flow — [40-create-flow.md](40-create-flow.md).
- The Block-Protocol block for inlining Lists into Notes — [50-embedding-and-intents.md](50-embedding-and-intents.md).
