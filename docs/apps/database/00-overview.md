# Database — first-party app

The Database app is Brainstorm's interface onto **structured collections of entities**: tables, boards, calendars, galleries, lists, and timelines over the user's data. It is the second first-party app after Notes ([apps/notes](../notes/00-overview.md)) in the four-app roadmap (see [implementation-plan.md](../../implementation-plan.md)).

## What the Database app is

A window that opens onto **one List at a time** and renders that List through one of several **views** (grid / list / gallery / board / calendar / timeline). The user can switch views, edit per-view filters and sorts, add or remove items, and create new entities directly from a view with criteria automatically inherited.

This is the product surface other knowledge tools variously call a "database", a "set", or a "collection". Brainstorm collapses the dynamic-set / manual-collection split into a single **List entity** with an explicit *source* and explicit *member overrides*, so that the dynamic, manual, and hybrid cases are all one mental model. The reasoning is in [10-lists-sets-collections.md](10-lists-sets-collections.md).

## What it is *not*

- **Not** the storage layer. The Database app reads through the entities service (`entities.query`, `entities.subscribe`) per [data/18-storage-and-search.md](../../data/18-storage-and-search.md) and writes through `entities.createEntity` / `entities.updateEntity`. The app owns no entity tables of its own.
- **Not** the property model. Properties, vocabularies, modifiers, scopes, and value types are defined in [data/19-properties-and-schemas.md](../../data/19-properties-and-schemas.md). The Database app *consumes* PropertySchemas; it does not redefine them.
- **Not** a separate query language. Filters use the predicate language already shipped on `entities.query` (`$eq`, `$contains`, `$gt`, `$exists`, `$and`, `$or`, …) extended for List source composition (see [30-filters-sorts.md](30-filters-sorts.md)).
- **Not** an inline block editor. The Database app *exposes* one block (an `embeddedList` Block-Protocol block) so Lists can be inlined inside a Note. The editing surface for that block reuses this app's view components — see [50-embedding-and-intents.md](50-embedding-and-intents.md).
- **Not** a folder/file browser. Folders (one-parent, tree-shaped containment) are the file-manager app's domain ([apps/30-file-manager-and-folders.md](../30-file-manager-and-folders.md)). Lists are flat, multi-membership, criteria-aware. The two coexist and reference each other.

## What composes from where

| Layer            | Lives in                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Shell host       | `packages/shell/` — IPC broker, capability ledger, entities service, storage worker            |
| SDK              | `packages/sdk/` + `packages/sdk-types/` — `brainstorm.services.entities.*`, `…ui.*`            |
| App              | `apps/database/` — manifest, icon, source, built bundle                                       |
| Per-app build    | Vite — see [40-app-build.md](../notes/40-app-build.md)                                         |
| Reusable views   | `apps/database/src/views/` — `grid`, `list`, `gallery`, `board`, `calendar`, `timeline`            |
| Embedded block   | A Block-Protocol block id `brainstorm.database/embedded-list/v1`, registered by the app        |

## Doc map

| File                                                     | Topic                                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **00-overview.md**                                       | This file — what the app is, what it is not, where things live.                                       |
| [01-data-model.md](01-data-model.md)                     | `List/v1`, `ListView/v1`, source, member-overrides, storage shape, indexes.                          |
| [10-lists-sets-collections.md](10-lists-sets-collections.md) | The unified mental model: dynamic / manual / hybrid; why sets and collections are one entity.    |
| [20-views.md](20-views.md)                               | Grid / list / gallery / board / calendar / timeline. Per-view configuration. View life-cycle.        |
| [30-filters-sorts.md](30-filters-sorts.md)               | Filter predicates by value type, AND/OR grouping, sort, kanban grouping, per-view overrides.         |
| [40-create-flow.md](40-create-flow.md)                   | Criteria-inherited creation, inline vs. modal insert, default type, "+" button semantics.            |
| [50-embedding-and-intents.md](50-embedding-and-intents.md) | The `embedded-list` block, intents the app registers, openers for `List/v1` and built-in type Lists. |

## Cross-cutting prerequisites

- **Entities service** ([data/05-data-and-blocks-protocol.md](../../data/05-data-and-blocks-protocol.md), [data/18-storage-and-search.md](../../data/18-storage-and-search.md)) — Stage 9 dependency. No Database app without `entities.query`/`subscribe`.
- **PropertySchema** ([data/19-properties-and-schemas.md](../../data/19-properties-and-schemas.md)) — every property a view renders is a PropertySchema. The view's "visible columns" config is a list of PropertySchema ids plus per-view display overrides.
- **Universal icons** ([foundations/39-universal-icons.md](../../foundations/39-universal-icons.md)) — every List, every ListView, and every entity in a view carries an `Icon`.
- **Shortcut registry** ([shell/24-keyboard-shortcuts.md](../../shell/24-keyboard-shortcuts.md)) — every key chord declared via the registry; renderer code uses `useShortcut`, never raw `e.key`.
- **Localization** ([platform/21-localization.md](../../platform/21-localization.md)) — every user-visible string wrapped in `t()`.
- **Layouts** ([shell/27-layouts.md](../../shell/27-layouts.md)) — the Database window's chrome cells (cover / title / action-bar / breadcrumb) are layout, not hardcoded.
- **Fancy menus** (Stage 8 — `@react-fancy-menus/core`) — view switcher, column header menu, filter builder, and value pickers all target it on landing. Interim builds may use the shared `<Popover>` primitive.
- **Cross-app navigation** ([shell/37-cross-app-navigation.md](../../shell/37-cross-app-navigation.md)) — clicking an entity row navigates to the type's primary opener (Notes for `Note/v1`, the Database app itself for `List/v1`, etc.).

## Status

Shipped (bundled React app on real `entities.db`, public beta v0.1.5). The app lives downstream of the entities service (Stage 9.3) and the React-Yjs hooks (Stage 9.1), and uses `@react-fancy-menus/core` (Stage 8). The implementation iterations are recorded as **Stage 9.12.x** in [implementation-plan.md](../../implementation-plan.md).

## Source material this design draws on

- **Prior set/collection split.** Many tools ship Sets (dynamic queries) and Collections (manual buckets) as separate concepts on a shared dataview block — `sources: string[]` for sets, `isCollection: true` for collections — with views (`grid`, `list`, `board`, `calendar`, `timeline`, `gallery`, `graph`) carrying `filters`, `sorts`, `relations`, `groupRelationKey`, `coverRelationKey`. We take a different shape on every load-bearing piece — the `List/v1` entity replaces the inline-block content struct so Lists are shareable / embeddable / standalone; the view-kind set drops `graph` (its job belongs to a vault-scoped surface, not a list-scoped renderer); the source vocabulary is an explicit discriminated union rather than `sources: string[]`; AND/OR composition + Hybrid mode + `byLink` sources cover three cases prior tools can't express.
- **Prior "Collections 2.0"-style proposals.** Three proposed membership modes (*query* / *collect-once* / *auto-collect*); community pushback that *auto-collect* should be the only mode; the "Base / Uncategorized / Inbox" default-bucket debate; the unresolved "where does a new object land if I don't pick a list?" question. Brainstorm's position: collapse the three modes into **one entity with explicit source + overrides**; the default-bucket question dissolves because every type has an implicit type-List and the Explorer app browses entities directly.
- **Page-as-database tools.** Database-per-page mental model. We reject the column-by-database identity (which fragments value sets across databases) but borrow the per-view column visibility and ordering UX.
- **Brainstorm's own [19-properties-and-schemas.md](../../data/19-properties-and-schemas.md)** — properties are entities with explicit scope; we extend `scope.kind = "collection"` to mean `scope.kind = "list"` with a precise definition for both Manual and Query modes (see [01-data-model.md §Scope of PropertySchemas](01-data-model.md)).
