# Database — views

A `List/v1` has one or more `ListView/v1`s. Each view picks a **kind** (`grid`, `list`, `gallery`, `board`, `calendar`, `timeline`) and configures the visible columns, the filter overlay, the sort, and any kind-specific options. Switching views inside one List is free — the source and members don't move; only the rendering does.

Read [01-data-model.md](01-data-model.md) for the `ListView/v1` schema. This doc is about *what each kind renders, what it configures, and what UX it implies*.

## Kinds

Six kinds in v1, declared as a TS string enum:

```ts
export enum ListViewKind {
  Grid     = "grid",
  List     = "list",
  Gallery  = "gallery",
  Board    = "board",
  Calendar = "calendar",
  Timeline = "timeline",
}
```

| Kind       | What it is                                                                  | Primary visual unit | Needs                                       |
| ---------- | --------------------------------------------------------------------------- | ------------------- | ------------------------------------------- |
| `grid`     | Excel-shaped table; one entity per row, one property per column.            | Row                 | —                                           |
| `list`     | One entity per row, no columns — just title + a configurable inline strip.  | Row                 | —                                           |
| `gallery`  | Card grid with cover image + title + small property strip.                  | Card                | `coverProperty` recommended                 |
| `board`    | Kanban — columns from a property's values, cards within each column.        | Card                | `groupBy.propertyId`                        |
| `calendar` | Month / week / day grid; entities placed by a `date` property.              | Pill on a date cell | `groupBy.propertyId` (date)                 |
| `timeline` | Horizontal time axis with items as events or spans; optional swimlanes.     | Marker or bar       | `primaryDateProperty` (see §Timeline below) |

> **Decision:** `graph` is **not** a view kind. A list-scoped graph (entities-of-this-List as nodes, links between them as edges) duplicates the standalone Graph app's purpose in a worse form (no whole-vault picture, no cross-list edges, no orphan visibility) and adds a renderer that has to chase force-directed layout, edge bundling, and node clustering for the sake of every List page that mostly won't use it. The decision is to ship a single, vault-scoped Graph app in its own time slot and keep the Database app focused on tabular / spatial views of typed entity sets. Adding a kind in v2 (e.g. `map`, `chart`) remains straightforward: register a renderer keyed by `ListViewKind`, declare a `layoutOptions` shape, declare a `groupBy` requirement (if any).

> **Decision:** view kinds are **not** apps. They're internal renderers inside the Database app. A third-party "Mermaid view" is not a feature of v1; if a third party wants to render a List differently they register an opener for `List/v1` and provide their own app. The internal renderer set is curated for design coherence and shared chrome.

## What's per-view vs per-list

| Concern                                  | Lives on              |
| ---------------------------------------- | --------------------- |
| Source (the criteria)                     | List                  |
| Manual overrides (`include` / `exclude`)  | List                  |
| Available properties (effective schema)   | Effectively-per-entity-type (derived) — neither |
| Visible columns                           | View (per-kind sense) |
| Column order                              | View                  |
| Column width                              | View                  |
| Filters (overlay on the source)           | View                  |
| Sorts                                     | View                  |
| Group-by                                  | View                  |
| Cover / subtitle property                 | View                  |
| Default type for "+ New"                  | View                  |
| Pagination size                           | View                  |
| Kind-specific layout options              | View                  |
| Active view                               | Window state (per-app, not persisted to the entity) |

This is the conventional split: *what's in the list* (List) and *how it's shown* (View). The active view is per-window state so multiple windows of the Database app can show the same List under different views simultaneously — this is required for the cross-app navigation model (per [shell/37-cross-app-navigation.md](../../shell/37-cross-app-navigation.md)).

> **Decision:** unlike products that maintain a per-dataview-block relation registry (where adding a relation to one view *also* registers it on the block, then a separate `viewRelationAdd` makes it visible), in Brainstorm there is no per-block relation registry. Every PropertySchema applicable to a member entity's effective schema is *available*; the view's `columns` array just decides which ones are shown and in what order. This is one less concept for users to internalize and one less write-then-toggle dance.

## Per-kind detail

### Grid

The default kind for new Lists. Renders rows as `<tr>`-equivalent, with the first column always pinned to the entity's `name` (or `title`, per type display hints) and an icon. Other columns from `columns` array.

- **Inline edit:** click a cell to edit in place — the same shared `@brainstorm/sdk/property-ui` cells used by the properties panel + editor block (text/number inline input, multiline, date calendar + natural-language input, tag/select picker with inline "Create", boolean checkbox/toggle, rating, entity-ref link picker). The grid mounts them via `react/editable-cell.tsx`, wrapping the view body in `<PropertiesProvider>`; values bridge between the DB's bare storage and the cells' shapes (`logic/db-cell-bridge.ts`) and a def is inferred per column when the vault carries no catalog `PropertyDef` (`logic/effective-def.ts`). Commits flow through the optimistic `persistEntityPatch` → `entities.update`. System/meta columns (created/updated/id) and vocabulary-coloured strings without a dictionary stay read-only. Tab/Shift+Tab walks columns; Enter walks rows.
- **Multi-select:** Shift-click / Cmd-click; bulk-update via the shared "update selected" action bar.
- **Row drag:** drags reorder for `sortKind = Manual` sorts; drag-to-other-board-column updates the grouping property (only meaningful in board kind).
- **Resizable columns:** drag on the right edge of the header.
- **Header click:** opens the column menu (sort by this, filter by this, hide).
- **Keyboard:** arrow keys move the active cell; `cmd-shift-+` adds a new column; `cmd-r` opens the row inspector (full entity edit) without leaving the grid.

```ts
layoutOptions: {
  rowHeight: "compact" | "comfortable" | "tall";
  showRowNumbers: boolean;
  pinFirstColumn: boolean;
}
```

### List

A row-per-entity stack with no fixed columns. Each row shows entity icon + name + an inline strip of property chips (configured by `columns` with the same array, but rendered as inline chips instead of grid cells).

Useful for narrow contexts (sidebars, embedded lists in Notes), for read-heavy browsing where the grid feels noisy, and for ad-hoc reading. Same selection / drag / keyboard model as Grid.

```ts
layoutOptions: {
  density: "compact" | "comfortable";
  showIcon: boolean;
}
```

### Gallery

Card grid; one entity per card. Card chrome: cover image (from `coverProperty`, expected to be a File entityRef or an `image`-formatted text property), title, optional subtitle (`cardSubtitleProperty`), and a small property strip.

Default thumbnail size: 240×160 with adjustable density (`small` / `medium` / `large`). Cards lazy-load images as they scroll into view. Empty cover → falls back to a generated gradient seeded by entity id (no broken-image squares).

```ts
layoutOptions: {
  thumbnailSize: "small" | "medium" | "large";
  cardAspectRatio: "square" | "video" | "portrait";
  showFilename: boolean;        // for File entities
}
```

### Board

Kanban — columns derived from a `groupBy.propertyId` property's values. Cards are dragged between columns; the drop *writes the new value* to the entity (per [01-data-model.md](01-data-model.md) §Members it doesn't add an override; it updates the entity).

Constraints:

- `groupBy` is required. The property must be one of: `text` with vocabulary (status, type), `entityRef` (assignee, priority), `boolean`. Numbers and dates are not allowed (they create unbounded column counts).
- For vocabulary-typed properties: one column per vocabulary value, plus an "Uncategorized" column for entities with no value, plus a "+ Add status…" column at the right edge.
- For boolean: two columns ("Yes" / "No") plus Uncategorized.
- For entityRef: one column per distinct value present in the effective membership (live-counted).

> **Known implementation gap — type-aware board grouping (future task).** The
> compile path (`apps/database/src/logic/compile-view.ts` `groupRows`)
> currently keys every value as a **raw string in data order** — it does
> not implement the per-type bucketing specified above. This was tolerable
> while `groupBy` was seed-fixed, but the view-settings popover now exposes
> a **"Group by" picker** over any property, so the gap is reachable. The
> task: thread the property kind (`resolvePropertyDef`) + a
> `resolveVocabularyOrder` (over the value's dictionary) into `groupRows`
> so vocabulary/select → one column per dictionary option in **dictionary
> order** with the entry label + colour; boolean → Yes/No (both columns,
> stable); number → numeric ranges; date → day/week/month buckets;
> entityRef → per referenced entity (label via the existing group-label
> resolver); plain text → data order (today's behaviour). Needs a per-kind
> test matrix. Until then, grouping by a non-vocabulary property produces
> raw, data-ordered columns. Tracked as its own iteration — a partial
> bucketing ships subtly wrong columns (e.g. status in random order).

Drag-to-other-column behavior:

- Default: write the new value to the entity.
- Modifier (Alt-drag): keep the entity's value, but add an override-pin to the destination column's value. This is only relevant when the column property is also the List's source — a rare case.

Within-column reordering: persisted in a `ListViewOrder` side-record (one Y.Doc per `(viewId, columnValue)`). Conventional per-column-ordinal shape.

```ts
layoutOptions: {
  columnWidth: number;          // px
  collapseEmptyColumns: boolean;
  cardPreview: "minimal" | "rich";
}
```

### Calendar

Month / week / day grid. Entities placed on dates from a `groupBy.propertyId` of type `date`.

- **Month view:** entities show as colored pills inside a date cell. Pill color from a configurable property's vocabulary color (often the same as `groupBy` for kanban — pick one to color by).
- **Week / day views:** time-of-day-aware if the date property has `granularity = "datetime"`; otherwise all-day.
- **Drag pill to new date:** writes the new date value to the entity.
- **Multi-day entities:** if the entity has a date-range property pair (start + end), it spans cells. Configured via `dateRangeStart` / `dateRangeEnd` in `layoutOptions`.
- **Create new entity:** click an empty cell → opens the create flow with date pre-filled (see [40-create-flow.md](40-create-flow.md)).

```ts
layoutOptions: {
  range: "month" | "week" | "day" | "agenda";
  startWeekOn: "sun" | "mon";
  colorBy: PropertyId | null;
  dateRangeStart?: PropertyId;
  dateRangeEnd?: PropertyId;
}
```

### Timeline

A horizontal time axis with items placed along it. This view aims at *five* concrete use cases — and the shape comes from what they share, not from copying a Gantt control:

1. **Project timelines.** Tasks with a start and an end date; sometimes dependencies; usually swimlaned by assignee or project.
2. **Personal chronologies.** Journal entries / photos / places visited / books read; one date each, no duration; flat or swimlaned by category.
3. **Editorial calendars.** Pieces of content with a publish date; sometimes a drafting window (draft-from → publish-on); swimlaned by status or channel.
4. **Itineraries.** Flights / hotels / meetings with a start and an optional end; usually flat.
5. **Reading or listening logs.** Books / albums with started+finished dates; swimlaned by status or rating.

What they share: every item has *one* primary date property (the "when"), and *optionally* a second date property that turns the item into a span. Swimlanes are useful in some cases, useless in others. The view's shape has to admit all five without forcing the user to mint fake property pairs.

**Item shape — three derived modes.** The view doesn't ask the user which mode they want; it derives one from the data:

| Mode    | When                                                                            | Visual treatment                                             |
| ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `event` | `endDateProperty` is `null`, or it's declared but no member has a value for it. | Marker (small dot + vertical tick + label).                  |
| `span`  | `endDateProperty` is declared and every member has both start and end values.    | Rounded bar with the label inside (truncated if it doesn't fit). |
| `mixed` | `endDateProperty` is declared but some members have only a start.                | Items with both → bars; items without an end → markers, rendered alongside in the same lane. |

`TimelineMode` is a TS string enum exported from the types module; like `ListMode`, it's a function of data and config, not a stored field.

**Configuration:**

```ts
layoutOptions: {
  primaryDateProperty: PropertyId;            // required — the item's "when"
  endDateProperty: PropertyId | null;         // optional — promotes items to spans
  swimlaneBy: PropertyId | null;              // optional — null = single lane
  pxPerDay: number;                           // continuous zoom scale (not a preset enum)
  showNow: boolean;                           // vertical "now" line — on by default
  showWeekends: boolean;                      // dim Sat+Sun columns at small enough zoom
  dependencyLinkTypes: string[];              // typed-link names treated as predecessor edges
  showDependencies: boolean;
  density: "compact" | "comfortable";         // pack items / one-per-row
  colorBy: PropertyId | null;                 // vocab-colored property; null = palette by type
  labelProperty: PropertyId | null;           // what shows inside the bar/marker; null = type's title display hint
}
```

**Time axis:**

The axis is two-tier: a primary scale band and a secondary scale band, chosen by zoom. The user does not pick these — they fall out of `pxPerDay`:

| pxPerDay     | Primary scale | Secondary scale | Use case                  |
| ------------ | ------------- | --------------- | ------------------------- |
| > 200        | Day           | Hour            | Itinerary, day-detail     |
| 30 < … ≤ 200 | Month         | Week            | Project, editorial        |
| 5 < … ≤ 30   | Quarter       | Month           | Mid-range project view    |
| ≤ 5          | Year          | Quarter         | Multi-year chronology     |

Zoom is **continuous**: `pxPerDay` is a number. The chrome offers four named jump buttons (Day / Month / Quarter / Year) that snap to canonical values (1440 / 60 / 15 / 4), but `Cmd+scroll` anywhere on the axis zooms smoothly with the cursor as the anchor.

**Today indicator.** A vertical line at the current instant, always-on by default. A `Go to today` button in the chrome scrolls to put it at the centre. The "today" column has a subtle accent fill at high zoom; weekends are slightly dimmed when `showWeekends` is on and `pxPerDay` is above ~50.

**Swimlanes:**

- `swimlaneBy = null` → **classic Gantt: one lane per task** (each item on its own row, labelled by `labelProperty`). A single shared lane stacks every bar on one line and is unreadable past a handful of items, so the no-swimlane case is the per-task layout.
- `swimlaneBy = <propertyId>` → one lane per distinct value present in the visible time window (lane set is *time-windowed*, not list-wide — scrolling forward in time can introduce a new lane). An "Unassigned" lane at the bottom catches missing values.
- Lane order: manual drag-reorder, persisted on the view; alphabetical fallback. The manual order survives lane-set changes (lanes added/removed as the time window shifts are slotted in at the bottom and the user reorders if they care).
- Lane height: derived from density and visible item count; not user-configurable in v1.

**Density:**

- `compact` — items pack vertically inside a lane: multiple per row when they don't overlap in time. The natural choice for chronologies, busy calendars, and event-mode timelines.
- `comfortable` — one item per row. The natural choice for project timelines where each row reads as "the task" or "the deliverable."

The view's renderer chooses pack-or-not at render time from `density`; users don't manage row counts.

**Dependencies (optional, opt-in):**

When `showDependencies` is on and `dependencyLinkTypes` is non-empty, the view draws arrows from `predecessor.endDateProperty` to `dependent.primaryDateProperty` for every typed link of those types. Arrows are subtle; clicking one selects both endpoints and opens an inspector with "Remove dependency" / "Inspect link" actions.

Editing: drag from the *right edge* of any item in span-mode (or from the marker dot in event-mode) to the *left edge* of another → creates a typed link of the first declared `dependencyLinkTypes`. (If the array is empty, the gesture is a no-op; the chrome surfaces a one-time hint.)

Dependencies are **not** required for the view to be useful. The four non-project use cases above don't need them; the property is opt-in.

**Interactions:**

| Gesture                                            | Action                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Click a marker or bar                              | Select. Selection persists across pan/zoom.                            |
| Double-click                                       | Open the entity (cross-app nav per [37](../../shell/37-cross-app-navigation.md)). |
| Drag a bar (body)                                  | Translate in time. Writes new primary and end (end shifts by the same delta). |
| Drag a bar's left or right edge                    | Change start or end. Writes that one property.                         |
| Drag a marker (event mode)                         | Writes new primary.                                                    |
| Click empty axis (no item under cursor)            | Create new entity with `primaryDateProperty` = click time (per [40-create-flow.md](40-create-flow.md)). |
| Drag horizontally on empty axis                    | Create new span (only in span / mixed mode); endpoints from drag start/end. |
| `Cmd+scroll` over the axis                         | Zoom; cursor is the anchor (date under cursor stays put).              |
| Scroll                                             | Pan left/right.                                                        |
| Right-click a bar/marker                           | Context menu — open / edit / duplicate / hide-from-list / remove-from-list / share / export. |
| Right-click empty axis at a date                   | "Create here…" with that date pre-filled.                              |

**Viewport and performance:** items outside the visible time window are not rendered. The visible window is the renderer's unit of subscription — the view subscribes to entities whose `primaryDateProperty` (or `endDateProperty`) intersects the window, with a small padding for smooth scrolling. Lane discovery is lane-set aware (a lane appears as soon as one of its items enters the window).

**Property requirements:** at view-create time, the dialog asks for `primaryDateProperty` and offers `endDateProperty` as optional. Both must reference `date`-typed properties (per [data/19-properties-and-schemas.md §Modifiers](../../data/19-properties-and-schemas.md)); the dialog hides non-date options. `swimlaneBy` accepts `text-with-vocabulary` / `entityRef` / `boolean` (the same predicate as Board's `groupBy`) plus `null`.

**What v1 does not ship:**

- **Resource leveling** ("auto-allocate work across people so no-one is double-booked"). A project-management concern; v2.
- **Critical path highlight** ("which dependency chain determines the project's end date"). Computed; v2.
- **Baseline vs actual** ("what we planned vs what's happening"). Requires snapshotting; v2.
- **Recurrence** ("this task repeats every Tuesday"). The entity model doesn't have a recurrence shape yet; v2 when `Recurrence/v1` arrives.
- **Cross-lane drag in span mode that *also* writes the swimlane property** — drag is for time only. To change a span's assignee/swimlane, the user drags it in board view or edits the property inline. (Otherwise drag has two effects and the user can't isolate them.)

> **Decision:** timeline is a first-class view kind in v1, but it is **not** a Gantt control. Project use cases work; chronology, itinerary, log, and editorial calendar use cases also work; nothing about the data model assumes scheduled work. The renderer is one component with three derived modes (`event` / `span` / `mixed`), not three separate components.

> **Decision:** there is no `zoom: "day" | "week" | …` preset enum on the layout options. `pxPerDay` is continuous. The chrome buttons exist to *jump to* canonical values but the persisted state is the number. This rules out the bug where two devices disagree on what "month zoom" means visually after a future tier-rule change.

> **Open:** when an event-mode item and a span-mode item start at the exact same instant in compact density, which renders on top? Tracked as **OQ-LD-14**. Tentative: the span (longer-lived item is the more salient one).

## View life-cycle

Each view is an entity. Standard create / rename / duplicate / delete operations.

### Create

- "+ Add view" button next to the view tab strip → presets dialog (Grid, List, Gallery, Board, Calendar, Timeline) → fills minimal config → opens.
- For Board / Calendar: the dialog requires picking the `groupBy` (Board: vocab/entityRef/boolean; Calendar: date) before activating.
- For Timeline: the dialog requires `primaryDateProperty`; offers `endDateProperty` and `swimlaneBy` as optional. We don't ship "guess the date property" — explicit is better.

### Rename

In-tab double-click → inline rename (a tiny `<input>` replacing the tab text). Enter commits.

### Duplicate

Right-click on a tab → "Duplicate". Creates a new view entity with identical config and `(2)` appended to the name. New view's id is appended to the List's `views` array.

### Delete

Right-click on a tab → "Delete". Cannot delete the only view; cannot delete the view that's currently the `defaultViewId` (must reassign first). Confirmation dialog because views can carry meaningful filter / sort state.

### Reorder

Drag tabs to reorder. Updates the order of `List.views` array (a Y.Array; concurrent reorders merge structurally).

> **Decision:** the active view is **window state**, not persisted on the List. Two open windows of the same List can show different views simultaneously. The `defaultViewId` is the first view opened in a fresh window. On window restore (per Stage 6.3), the last-active view per List per window is restored.

## Filter overlay vs source

A view's `filters` overlay AND-combines with the List's source. This is critical: the List's source defines membership; the view's filters narrow *what's visible* without changing membership.

```
visible(L, V) = filter(effective(L), V.filters)
              = filter(((source matches) ∪ include) \ exclude, V.filters)
```

Why two layers? Because:

- A List's source represents *intent* ("these are the Tasks I care about"). Stable across views.
- A View's filter represents *focus* ("right now, show me only the overdue ones"). Per-view, often flipped quickly.

Prior products often conflate the two (a Set has filters; views also have filters; the relationship is opaque). Brainstorm separates them: source on List, focus on View. See [30-filters-sorts.md](30-filters-sorts.md) for the predicate language.

> **Decision:** the view's filter overlay can *narrow* but cannot *widen* the List's source. A view filter that would include entities outside `effective(L)` is rejected at write time by the entities service. This keeps "what's in this list?" sourced in one place.

## Empty / loading / error states

Every view kind ships a shared empty state:

```
┌─────────────────────────────────┐
│        ✦ No items yet            │
│   This list has no entities.     │
│                                  │
│        [+ Add entity]            │
└─────────────────────────────────┘
```

When the empty state is due to filter overlay (effective(L) non-empty but `visible(L,V)` empty), the message is "No items match the current filter" and the button is "Clear filter".

Loading: spinners are bounded; if entities.query takes >100ms (per [18 §Performance budgets](../../data/18-storage-and-search.md)) a skeleton renders. Subscription updates patch in-place — no full re-render.

Error: if the entities service returns `Unavailable` (capability revoked, worker down), the view shows an inline error state with a "Retry" button. The view does *not* clear cached entities.

## What's out of scope for v1

- **Graph view.** A list-scoped node-edge view duplicates the standalone Graph app's purpose and adds renderer complexity (force-directed layout, edge bundling, clustering) that the Database app doesn't otherwise need. Decision recorded above in §Kinds.
- **User-saved per-property formulas** (rollups, formulas). These land with derived properties in v2 per [19 §Phasing](../../data/19-properties-and-schemas.md).
- **Pivot tables / cross-tab views.** Pivot is a deeper transformation than the six view kinds; deferred to v2 (or a dedicated third-party app).
- **Linked-list views** ("show this view of *that* list inside this Note") beyond the embedded-list block — see [50-embedding-and-intents.md](50-embedding-and-intents.md). v1 supports the embed; "saved query results inline" beyond that is v2.
- **Multi-list views** ("show me items from List A and List B together"). The same effect is achievable by making a Hybrid list with a `composite` source — that's the v1 answer.

## Summary

- Six view kinds: grid, list, gallery, board, calendar, timeline. Graph is intentionally absent.
- Each kind is an internal renderer keyed by a TS enum; layout options are per-kind discriminated shapes.
- Per-view: filters, sorts, group-by, visible columns, default type, kind-specific layout. Per-list: source and members.
- A view's filter narrows the List's effective membership; it can never widen it.
- Board / Calendar require explicit `groupBy` at create; Timeline requires `primaryDateProperty`. We don't guess.
- Timeline has three derived modes (event / span / mixed); continuous `pxPerDay` zoom; opt-in dependencies via typed links; no Gantt-only assumptions.
