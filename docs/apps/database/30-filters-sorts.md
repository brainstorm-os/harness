# Database — filters, sorts, and grouping

Filters select *which entities a view shows*. Sorts choose *the order*. Group-by, for board / calendar / timeline kinds, partitions members into columns / cells / swimlanes. All three live on the View (not on the List) and overlay AND-wise on the List's source.

This doc pins the predicate language, the per-value-type predicate sets, the AND/OR/group structure, the sort spec, the kanban grouping semantics, and the UI implications. Schema is in [01-data-model.md](01-data-model.md); view-level concerns are in [20-views.md](20-views.md).

## Predicate language

The Database app uses **the same `PropertyPredicate` shape** that `entities.query` already speaks per [data/18-storage-and-search.md](../../data/18-storage-and-search.md). There is no Database-specific filter language.

```ts
export type PropertyPredicate =
  | { $eq:        { [path: string]: unknown } }
  | { $neq:       { [path: string]: unknown } }
  | { $contains:  { [path: string]: unknown } }       // for text / arrays
  | { $notContains:{ [path: string]: unknown } }
  | { $gt:        { [path: string]: number | string } }   // dates as ISO strings
  | { $lt:        { [path: string]: number | string } }
  | { $gte:       { [path: string]: number | string } }
  | { $lte:       { [path: string]: number | string } }
  | { $in:        { [path: string]: unknown[] } }      // any-of
  | { $allIn:     { [path: string]: unknown[] } }      // all-of for multi-value
  | { $notIn:     { [path: string]: unknown[] } }
  | { $exists:    { [path: string]: true } }
  | { $empty:     { [path: string]: true } }
  | { $like:      { [path: string]: string } }         // substring; case-insensitive
  | { $notLike:   { [path: string]: string } }
  | { $and:       PropertyPredicate[] }
  | { $or:        PropertyPredicate[] }
  | { $not:       PropertyPredicate };
```

`path` is the property name on the entity (the same name resolved by the effective schema per [19 §Reading effective schemas](../../data/19-properties-and-schemas.md)). For multi-value properties stored as `Y.Array<{value, label?}>`, the path can target the array element shape directly:

- `phones.value` matches any phone's value.
- `phones.label` matches any phone's label.
- A label-aware predicate is `{ $and: [{ $eq: { "phones.label": "Home" } }, { $like: { "phones.value": "555" } }] }` — same scoping rule as `entities.query`.

> **Decision:** extending the shared predicate language is preferred over a Database-only DSL. If a Database-app filter needs a predicate that doesn't exist (e.g. relative-date `withinDays(7)`), we add it to `PropertyPredicate` once and every consumer (the launcher, the Search app, the entities service) gets it for free.

## Per-value-type predicate sets

Filter UIs show only predicates that make sense for the property's value type. The mapping (drawing on conventional predicate vocabularies and our own value types per [19](../../data/19-properties-and-schemas.md)):

| Value type             | Predicates (in menu order)                                                              |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `text` (no vocab)      | `$eq`, `$neq`, `$like`, `$notLike`, `$empty`, `$exists`                                  |
| `text` + `vocabulary`  | `$in`, `$notIn`, `$allIn` (when `count.max > 1`), `$empty`, `$exists`                    |
| `number`               | `$eq`, `$neq`, `$gt`, `$lt`, `$gte`, `$lte`, `$empty`, `$exists`                         |
| `boolean`              | `$eq`, `$neq` (truthy / falsy / unset)                                                   |
| `date`                 | `$eq`, `$neq`, `$gt` ("after"), `$lt` ("before"), `$gte`, `$lte`, plus relative presets  |
| `entityRef` (single)   | `$eq`, `$neq`, `$empty`, `$exists`, `$in`, `$notIn`                                      |
| `entityRef` (multi)    | `$contains` (any-of), `$allIn`, `$notContains`, `$empty`, `$exists`                      |
| `richText`             | `$like`, `$notLike`, `$empty`, `$exists`                                                 |

### Relative date presets

Date fields surface a small set of relative-time presets *in addition to* absolute date pickers. These compile to absolute-bound predicates at write time, **not** to a "current-relative" recurring expression — concrete bounds, snapshotted when the filter is built.

| Preset           | Compiles to                                                          |
| ---------------- | -------------------------------------------------------------------- |
| Today            | `{ $gte: x = startOfDay(today), $lte: x = endOfDay(today) }`         |
| Yesterday        | `{ $gte: …, $lte: … }`                                                |
| Tomorrow         | `…`                                                                   |
| This week        | `…`                                                                   |
| Last 7 days      | `{ $gte: x = now − 7d, $lte: x = now }`                              |
| Next 30 days     | `…`                                                                   |
| Past / Future    | `{ $lt: now } / { $gt: now }`                                         |

> **Decision:** relative-date presets snapshot to absolute bounds when the filter is *built*, not re-evaluated on each query. This matches the conventional behavior in similar tools and avoids "the same view returns different results on different days" surprises. A user wanting a rolling 7-day window uses the "Last 7 days" preset and **re-applies it** when they want it to roll forward. Live-rolling windows are a v2 feature gated on a `relativeDate` flag on the filter row.

### Existence vs emptiness

`$exists` returns true if the entity *has the property* in any state (including null / empty array). `$empty` returns true if the entity has the property *and* its value is null / empty string / empty array. Most users only need `$empty` — and we surface `$exists` only when a higher-scope property may be absent on lower-scope entities (e.g. an overlay property that hasn't propagated to all entities).

## AND / OR / groups

Filters compose into a tree:

```ts
type FilterNode =
  | { kind: "predicate";  predicate: PropertyPredicate }
  | { kind: "group";      op: "and" | "or"; children: FilterNode[] };

type ViewFilters = FilterNode;        // root; usually a group
```

The default root is `{ kind: "group", op: "and", children: [] }`. Users add rows; rows are predicates; rows live inside groups; groups can nest.

> **Decision:** AND/OR + nestable groups, from day one. Composable AND/OR is a recurring gap in prior tools (one of the loudest pains in community feedback on flat filter UIs). Shipping it in v1 closes that gap and is cheap: `PropertyPredicate` already supports it.

### Filter UI

The filter builder is a stack of rows + group controls, rendered through a fancy-menus popover (Stage 8 dependency; until then, the shared `<Popover>` primitive):

```
┌ Filter ────────────────────────────────────────────────────┐
│                                                              │
│  Match  [ all ▾ ] of the following:                          │
│                                                              │
│   • Status      [is ▾]    [Todo ✕] [Doing ✕]    [+ value]  │
│   • Due date    [before ▾] [2026-06-01]                    │
│                                                              │
│  └ Or any of:                                                │
│      • Priority  [is ▾]  [Urgent ✕]                          │
│      • Assignee  [is ▾]  [me ✕]                              │
│                                                              │
│  [+ Filter]   [+ Group]                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

`Match [all/any] of the following` toggles the root group's operator. `+ Filter` adds a predicate row at the current level; `+ Group` adds a nested sub-group. Nested groups indent. There's no hard depth cap; UI gets unwieldy past 3-4 levels and that's the natural ceiling.

> **Decision:** the filter row is the same component for source predicates and view predicates. Building a List source's `byFilter` predicate is the same UI as building a view's filter overlay — we don't want users learning two filter builders.

## Sorts

A view's sort is a list of keys, each with a direction:

```ts
export enum SortDirection { Asc = "asc", Desc = "desc", Manual = "manual" }
export enum EmptyPlacement { None = "none", Start = "start", End = "end" }

type Sort = {
  propertyId: string;
  direction: SortDirection;
  emptyPlacement: EmptyPlacement;
};

type ViewSorts = Sort[];
```

- **Multi-key sort:** sorts apply in order; ties broken by the next key. UI shows a numbered list.
- **`Manual`:** persists explicit per-entity order via a `ViewOrderEntry` side-record (`{ viewId, entityId, ordinal }`). Reorder writes new ordinals.
- **`emptyPlacement`:** `start` puts entities with no value at the top; `end` at the bottom; `none` interleaves them by value (which for `null` typically means "before everything else" — the SQL default).

> **Decision:** sort direction is a TS enum (`SortDirection`). Per [§Conventions that bite in CLAUDE.md](../../../CLAUDE.md), no raw `"asc"` / `"desc"` literals in code — always `SortDirection.Asc`. The string values match the persisted form.

> **Decision:** `Manual` sort lives in v1. The side-record table needs an index; it's tiny (10s of bytes per ordering) and lets users drag-reorder rows in grid view, which is a common ergonomic ask.

### Sort UI

A small popover anchored on the column header (grid view) or on a "Sort" pill in the view chrome (other kinds):

```
┌ Sort ────────────────────────────┐
│ 1. Status        ↓ desc  ✕      │
│ 2. Due date      ↑ asc   ✕      │
│ 3. Name          ↑ asc   ✕      │
│                                  │
│   [+ Add sort]                   │
│                                  │
│ Empty values: [end ▾]            │
└──────────────────────────────────┘
```

Drag-to-reorder the sort priority. The "empty values" applies per-sort-key (single dropdown on each row, not global) — that's flexible without being noisy.

## Group-by (board / calendar / timeline)

Group-by lives on the view, in the `groupBy` field. The semantics differ by kind:

### Board

- `groupBy.propertyId` must reference a `text + vocabulary` / `entityRef` / `boolean` property.
- Columns are one per *value present* in the effective membership, plus an "Uncategorized" column for entities with no value, plus a "+ Add" column for vocabularies.
- The user can manually reorder columns (persisted in `groupOrder` on the view).
- Drag a card to another column → writes the new value to the entity.

### Calendar

- `groupBy.propertyId` must reference a `date` property.
- Cells are days / weeks / months depending on `layoutOptions.range`.
- Entities placed on cells matching their date.
- Drag a pill → writes a new date.

### Timeline

- Two properties involved: `groupBy` for swimlanes, plus `dateRangeStart` and `dateRangeEnd` in `layoutOptions` for bar position.
- Swimlanes are one per value present, ordered alphabetically by default; user can drag-reorder.

> **Decision:** group-by lives on the view, not on the List. A List with three board views can group differently in each (board by status, board by assignee, board by priority) without any view stepping on the others.

> **Open:** when a vocabulary-typed group-by encounters values *outside* the vocabulary (legacy data, schema drift), do we render them in their own columns or roll them into "Uncategorized"? Tracked as **OQ-LD-8**. Tentative: own columns, with a "fix value" hint surfaced on the column header.

## Filter / sort / group write semantics

All three are stored as Y.Arrays / Y.Maps on the view entity. Concurrent edits merge structurally:

- Two devices simultaneously adding sort keys → both keys appear, in insertion order per Yjs.
- Two devices simultaneously toggling the root group's `op` from "and" to "or" → last-write-wins on the field (it's a primitive in the Y.Map).
- Two devices simultaneously changing the same filter row's predicate → last-write-wins on the row's content (the row itself is one Y.Map entry).

> **Decision:** view filter/sort edits are not transactionally bundled. A user who flips one filter row while another user adds a sort sees both changes apply — neither edit blocks the other. This is the same Yjs-default semantics applied to everything else in Brainstorm.

## Predicate compilation

The entities service compiles `PropertyPredicate` to SQL against the `entities` table (per [18 §Indexing pipeline](../../data/18-storage-and-search.md)). For Database app queries, the compiler additionally:

1. **AND-combines** the List's source-derived query with the view's filter overlay.
2. **Applies the override set** in SQL: `WHERE id IN (source-matches) UNION ALL (include) EXCEPT (exclude)`.
3. **Joins to property index tables** for any property the view sorts by.

This compilation is owned by the entities service, not the app. The Database app's renderer just calls `entities.subscribe({ list: listId, viewId })`; the service does the work.

> **Decision:** the entities service gets a new query shape, `entities.subscribe({ list, viewId })`, that takes a list id + view id and returns the effective visible entities with subscription. This is the canonical way the Database app reads — there is no direct compose-this-predicate-yourself path in the app code, because the view's filter language is already the entities service's language.

## What's out of scope for v1

- **Derived predicates** (formulas / rollups). Land with v2 derived properties per [19 §Phasing](../../data/19-properties-and-schemas.md).
- **Cross-property predicates** (e.g. `dueDate < now() AND assignee = me() AND status = open`). The first two require derived properties; the third is shipped. v1 covers the third only.
- **Negated groups** (`$not` over a whole group). Possible — the predicate language supports it — but the UI for inverting a group is gnarly enough to be a polish item. Tentative: ship in v1 as a "Negate this group" toggle on each group, defer the polish.
- **Saved filters per user** (named filter presets). Manageable later as ListView templates.

## Summary

- The predicate language is `PropertyPredicate` from the entities service. No DSL fork.
- Predicates per value type are limited to what makes sense for each base type plus modifiers.
- Filters compose into AND/OR groups, nestable. Day-one feature — closes a long-standing gap in flat-filter tools.
- Sorts are multi-key with `asc`/`desc`/`Manual` and `start`/`end`/`none` empty placement.
- Group-by drives board columns, calendar cells, and timeline swimlanes; lives on the view.
- Filter / sort / group concurrent edits Yjs-merge structurally.
- The entities service compiles List + view to one SQL query and serves a subscription; the app never writes SQL.
