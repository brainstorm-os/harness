# Database — entity creation flow

When the user clicks "+ New" on a view, the Database app creates a new entity and inserts it into the List. The trick is **inheriting criteria** so the new entity ends up matching the source (and any view filters), without forcing the user to re-pick values they've already committed to by configuring the List. We call the pre-filled shape an **entity draft** — the type + property values handed to `entities.createEntity` before the actual write.

This doc covers: where the create button lives, how criteria inheritance works, the default-type rule, the inline-vs-modal split, and the Manual vs Query vs Hybrid create paths.

Read [01-data-model.md](01-data-model.md) for the schema, [10-lists-sets-collections.md](10-lists-sets-collections.md) for the mode model, and [20-views.md](20-views.md) for view-kind context.

## Where "+ New" lives

| View kind   | Where the "+" button renders                                                  |
| ----------- | ----------------------------------------------------------------------------- |
| `grid`      | Sticky last row ("+ Add row") plus a "+ New" button in the view chrome.       |
| `list`      | Same — last row + chrome button.                                              |
| `gallery`   | A "+ New" card slot at the end of the visible grid, plus chrome button.       |
| `board`     | One "+ Add" affordance per column (creates with that column's value pre-set) + chrome button. |
| `calendar`  | Click any empty cell → opens create with that date pre-filled.                |
| `timeline`  | Click empty axis at a date → create event with `primaryDateProperty` = clicked date. Drag horizontally on empty axis (span / mixed mode only) → create span with both endpoints from the drag. Chrome button always available. |

Plus the global shell shortcut to add to the currently-active view: `Cmd+N` (configured in the shortcut registry per [shell/24-keyboard-shortcuts.md](../../shell/24-keyboard-shortcuts.md); action id `database/new-row`).

## What "+ New" actually does

The flow is the same in every view kind:

1. Resolve the new entity's **type** from `view.defaultTypeUrl` (or, if absent, from `source.byType.types[0]` if the source is single-type).
2. Compute the **entity draft** by walking the List's source predicate and the view's filters, extracting any predicate that pins a property to a concrete value.
3. If the kind is `board`, override `groupBy.propertyId` in the draft with the column the user clicked.
4. If the kind is `calendar`, override the date property in the draft with the clicked cell's date.
5. Call `entities.createEntity(draft.type, draft.properties)`.
6. If the List is Manual or Hybrid: append the new entity id to `members.include`.
7. Open the new entity for editing (inline rename in grid/list/board/calendar; full inspector in gallery/timeline).

That's it. The draft step is the only nontrivial part.

## Criteria inheritance — the draft

Inheritance walks the **AND-chain** of `source ∪ view.filters` and pulls out predicates whose evaluation pins a property to a single value. Predicates inside an OR branch are *not* inheritable because the entity could satisfy any one branch — we can't pick which.

The pinnable predicate set:

```ts
// Each of these tells us "this entity will have property P = value V"
type PinnablePredicate =
  | { $eq:        { [path: string]: ScalarValue } }
  | { $in:        { [path: string]: ScalarValue[] } }   // if values.length === 1
  | { $contains:  { [path: string]: ScalarValue } }     // single value → array of one
  | { $allIn:     { [path: string]: ScalarValue[] } }   // multi-value: pre-set the whole array
  | { $gte:       { [path: string]: ScalarValue } }     // dates: pin to the lower bound
  | { $lte:       { [path: string]: ScalarValue } }     // dates: pin to the upper bound (if no $gte)
  // … anything else is NOT pinnable
```

Algorithm — implemented in [`apps/database/src/logic/entity-draft.ts`](../../../apps/database/src/logic/entity-draft.ts):

```ts
function draftForList(inputs: DraftInputs): EntityDraft {
  const properties: Record<string, DraftValue> = {};

  for (const pred of collectAndOnlyPredicates(inputs.source)) {
    pinFromPredicate(pred, properties);
  }
  for (const pred of collectAndOnlyPredicatesFromFilterNode(inputs.viewFilters)) {
    pinFromPredicate(pred, properties);
  }

  // Type: view's defaultTypeUrl wins; else fall back to single-type byType source.
  const type =
    inputs.defaultTypeUrl ??
    (inputs.source?.kind === ListSourceKind.ByType && inputs.source.types.length === 1
      ? inputs.source.types[0]
      : undefined);

  return type !== undefined ? { type, properties } : { properties };
}
```

`collectAndOnlyPredicates` recurses through `$and` groups (both in source `composite` ops and in filter trees) but bails on `$or` branches — those go un-pinned. Predicates with multiple paths (e.g. `$eq: { foo: 1, bar: 2 }`) emit one property per path.

The draft computer emits **bare scalars** (or scalar arrays for multi-value properties); the entities service wraps them into a value envelope at write time using the PropertySchema's `valueMeta` (per [data/19-properties-and-schemas.md §Value envelopes](../../data/19-properties-and-schemas.md)). The draft step never invents meta — meta is downstream.

Examples:

- List source `byType = [Movie/v1]` → new entity gets `type = Movie/v1`.
- List source `byFilter = { $eq: { genre: "Comedy" } }` → new entity gets `genre = "Comedy"`.
- View filter `{ $and: [{ $eq: { status: "todo" } }, { $eq: { assignee: "ent_user_self" } }] }` → new entity gets `status = "todo"` and `assignee = "ent_user_self"`.
- View filter `{ $or: [{ $eq: { status: "todo" } }, { $eq: { status: "doing" } }] }` → **nothing inherited from this filter** (ambiguous which to pick).
- View filter `{ $gte: { dueDate: "2026-01-01" }, $lte: { dueDate: "2026-12-31" } }` → new entity gets `dueDate = "2026-01-01"` (the lower bound — start-of-range is the safer pin).

> **Decision:** OR-branch values are not auto-pinned. The user picks at create time. The UI doesn't *block* OR-branches from being inheritable — it surfaces them as "Inherit which?" pills in the create dialog. The default is no pick (entity is created without that property set; it may or may not match a branch).

> **Decision:** date-range filters pin to the lower bound. For "next 30 days" the new entity gets today's date by default; the user can edit before saving. The "upper bound" alternative would default new entities to a date 30 days from now, which is rarely what users want.

> **Open:** when a view filter pins property P to value V but the *user explicitly types a different value V'* during inline-create, we silently let V' through, even though the new entity no longer matches the filter (and thus disappears from the visible set). Toast: "Created — not shown in this view because filter mismatch." Acceptable? Tracked as **OQ-LD-9**. Tentative: yes — the user took an explicit action; we don't second-guess.

## Default type

The view's `defaultTypeUrl` is the source of truth. If absent, the List's source provides a fallback only for single-type sources. If neither yields a type, the "+ New" button is **disabled** and the chrome shows a small inline note: "Pick a default type to add entities." Clicking opens the view's settings.

> **Decision:** "+ New" requires an explicit default type. We don't ship a "create object of arbitrary type" UX, because it almost always produces a stub that the user has to convert later. Forcing the explicit choice up front matches the "Set type for new objects" affordance common in prior tools.

## Inline vs modal create

| Kind        | Default                                                    | Modal opens when                                          |
| ----------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `grid`      | Inline (focus the name cell)                                | User presses `Cmd+Enter` on a row → opens full inspector |
| `list`      | Inline (focus title)                                        | Same                                                      |
| `gallery`   | Inline (card flips to edit mode for title, cover unset)     | Card click → full inspector                               |
| `board`     | Inline (card appears in column, title focused)              | Card double-click → full inspector                        |
| `calendar`  | Inline (pill on cell, title focused in popover)             | Pill click → full inspector                               |
| `timeline`  | Inline (marker / bar appears at the click/drag point, title focused in a tiny inline popover) | Marker / bar double-click → full inspector |

Inline is the default because creating one entity usually means typing one name and moving on. The full inspector is for "I want to set 5 properties at once" — Cmd+Enter on a row or double-click on a card opens it.

The **inspector** is the same component used for full entity edit (the Block-Protocol-shaped card view per [data/05-data-and-blocks-protocol.md](../../data/05-data-and-blocks-protocol.md)). For now, the Database app ships its own simple inspector; once the layout system lands (Stage 8), the inspector becomes a layout target and any app's inspector layout overrides apply.

## Per-mode create paths

### Manual mode (no source)

1. Resolve default type from view.
2. No inheritance from a source (source is `null`); inheritance comes only from view filters.
3. Create the entity.
4. Append to `members.include`.

### Query mode (source, no manual)

1. Resolve default type from source (single-type) or view.
2. Inherit from `source ∪ view.filters`.
3. Create the entity. It matches the source by construction (we just pinned the values that make it match).
4. **Do not** write to `members.include` — the entity is in the effective List by virtue of matching.

### Hybrid mode (source + manual)

1. Resolve default type from view (Hybrid Lists with composite sources usually have a fixed `defaultTypeUrl` since the source's type is ambiguous).
2. Inherit from `source ∪ view.filters` to the extent inheritable (AND-only).
3. Create the entity.
4. **Conditional `members.include`:** check if `entities.query(source)` matches the new entity *after* its initial properties are set. If yes, do nothing (it's a source match). If no (because the user typed a value that breaks the inherited pin, or because the source had non-pinnable OR branches), add to `members.include`.

The third path is the trickiest: we want the user to be able to add a "doesn't quite match the criteria but should be in the List" entity from a "+ New" click. The check-then-pin step makes this work without an extra dialog. The user's mental model: "+ New in this List always adds to this List, regardless of criteria."

> **Decision:** in Hybrid mode, "+ New" *always* makes the entity appear in the List, even if criteria mismatch — by pinning to `members.include` as a fallback. This is the "Auto Collect" expectation from prior proposals. The user can later "Trim pins that match criteria" if they want a clean Query.

## Inline-create UI in detail

In grid view:

```
┌ Movies to watch                                    [⋯ menu] ┐
│                                                              │
│  Status   │ Name                  │ Year   │ Rating          │
│  ─────────┼───────────────────────┼────────┼──────────       │
│  Watched  │ Inception              │ 2010   │ 9              │
│  Watched  │ Tenet                  │ 2020   │ 8              │
│  Unwatched│ |▏                     │        │                │   ← new row, name input focused
│           │                         │        │                │
│  [+ Add row]                                                   │
└────────────────────────────────────────────────────────────────┘
```

- Status pre-pinned from view filter `{ $eq: { status: "Unwatched" } }`.
- Type pinned from List source `byType = [Movie]` (invisible — not a property in the view's columns).
- Cursor in Name cell. Enter commits; Esc cancels.
- The new row is **provisional** until Enter: rendering happens immediately, but the `entities.createEntity` call doesn't fire until commit. (Avoids littering the DB with empty Drafts.)

> **Decision:** create commits on first non-empty Enter / Tab-out. Empty-name Esc cancels and removes the provisional row. We do not auto-save partial state — the user has to mean it.

In board view, the per-column "+ Add" button creates with the column's grouping property pre-set. E.g. clicking "+ Add" in the "Doing" column on a board grouped by `status` creates an entity with `status = "Doing"` plus any other view-filter inherited values.

## Templates

A **template** is a reference entity whose body + properties are copied (not linked) into newly-created entities. The view's `defaultTemplate` is the entity-id of the template to clone.

Templates are a **cross-app platform foundation**, not a Database-internal feature — designed in [platform/66-templates.md](../../platform/66-templates.md). They are first-class entities of type `brainstorm/Template/v1` (OQ-LD-10 resolved → own type); `view.defaultTemplate` is the most-specific rung of the resolution ladder (`view.defaultTemplate` → `collection.defaultTemplate` → type-level default → blank). At instantiation, **criteria-inherited pins win over template values** for any property both set, so a templated entity still matches the list it is created in. The early Database grid ships with `defaultTemplate = null` until the foundation lands; thereafter the create-flow picker (Blank + applicable templates) is inherited automatically — no Database-specific template UI.

## What "+ New" doesn't do

- It doesn't write to **other** Lists. If an entity created in List A could *also* appear in List B by virtue of matching B's source, that's a List B concern (its subscription will pick up the new entity). The Database app doesn't proactively notify B.
- It doesn't ask "Add to which List?" The user is in a List context and creating "in" it. Multi-list assignment at create time is a v2 polish item.
- It doesn't trigger external workflows or automations. That's the Automations app's domain (per [apps/39-automations-and-workflows.md](../39-automations-and-workflows.md)); a `Workflow` with trigger `entity.created` will fire on its own schedule.

## Summary

- "+ New" is per-view; inline-create is the default, modal inspector for advanced.
- Type is from `view.defaultTypeUrl`; "+" is disabled without it.
- Criteria inheritance pulls AND-chain pinnable predicates (eq, in-of-one, contains, allIn, gte / lte) from source + view filters.
- Inheritance always inherits the *clicked context* (board column, calendar date).
- Manual / Query / Hybrid have distinct membership-write rules; Hybrid always pins to `members.include` if the entity wouldn't otherwise match.
- Templates are v2; for v1, the "+" creates an entity carrying only the inherited draft.
