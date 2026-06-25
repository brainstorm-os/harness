# Lists — sets and collections, unified

This is the design contribution of the Database app. Most prior knowledge tools either pick one of "dynamic query" vs "manual folder", or ship both as separate first-class concepts and force the user to choose at creation time. Brainstorm collapses the distinction into one entity (`brainstorm/List/v1`) with three reachable behaviors: **Query**, **Manual**, and **Hybrid**. The user doesn't pick a kind; they configure a source and add overrides. The mode is the consequence, not the input.

This doc explains why, how it differs from the conventional Sets-and-Collections split, what prior "Collections 2.0"-style proposals tried, and what concrete UX the unified model implies. The shape itself is in [01-data-model.md](01-data-model.md); read that first if you want concrete schemas.

## The three modes, as a single shape

Every List entity carries a `source` (a `ListSource`, possibly `null`) and a `members` overrides object (`include[]` and `exclude[]`). The combination produces three reachable states:

| `source`     | `members.include` | `members.exclude` | Mode      | What the user sees                                                              |
| ------------ | ----------------- | ----------------- | --------- | ------------------------------------------------------------------------------- |
| set          | empty             | empty             | **Query**   | A dynamic list — anything matching the source shows up; the user doesn't add things. (Conventional "Set".) |
| `null`       | non-empty         | (irrelevant)      | **Manual**  | A hand-curated list — only what the user added is there. (Conventional "Collection".) |
| set          | non-empty *or* `exclude` non-empty | (either)          | **Hybrid**  | Dynamic + overrides — auto-includes by criteria, **plus** the user pinned some extra ones in or pinned some out. (Not expressible in tools that ship a strict Set/Collection split, without dummy tags.) |

The effective membership is always the same formula:

```
effective(L) = ((source ? entities.query(L.source) : ∅) ∪ L.members.include) \ L.members.exclude
```

`source = null` collapses the first term to `∅`; that's Manual. `members.include = []` and `members.exclude = []` collapses to pure source matching; that's Query. Anything else is Hybrid.

> **Decision:** there is no `mode` field. The mode is *derived* from the shape of `source` and `members`. The UI can show a mode badge ("Query" / "Manual" / "Hybrid") for clarity, but it's a label on the effective state, not a stored switch the user toggles. This avoids the trilemma where three sibling concepts ("Query", "Collect Once", "Auto Collect") all want to exist and the community pushes back asking for just one.

> **Decision:** there is also **no "Collect Once" mode** as some prior proposals tried. "Run a query once, then freeze the membership" is a one-line operation in the unified model: copy the current source-matched entities into `members.include`, then set `source = null`. The Database app exposes this as a "Snapshot to manual list" action; the storage shape is unchanged.

## Why one entity instead of two

Prior tools ship two block-content shapes (`isCollection: true` vs `setOf` populated) on the same underlying dataview block. From the user's perspective they look almost identical — both have views, both have filters and sorts and columns. From the system's perspective, they have separate code paths:

- The "Set" path creates new objects by **inheriting the source criteria** (e.g. Set is `type = Movie` → new object gets `type = Movie`). The criteria must be expressible in the object's own properties.
- The "Collection" path creates new objects with **the default type** for the workspace and adds them to the collection via a `createdInContext` relation on the new object.

This is two creation flows and two membership records (object's own properties for Set, an inverse relation back-pointing to the Collection for Collection). The user is forced to pick at create time, and changing their mind later is "convert" — destructive in the wrong direction (Collection → Set is reasonable; Set → Collection means materializing the entire query as static members).

**Brainstorm's one-entity model removes that choice from the create path.** The user creates a List. The List has empty `source` and empty `members` by default. Adding a source moves the List toward Query; dragging entities in moves it toward Manual or Hybrid. The List's behavior changes without a "convert" step.

## Where this came from: prior "Collections 2.0"-style proposals

Earlier proposals in this space have suggested three sibling collection types:

1. **Query** — fully automatic membership by rule.
2. **Collect Once** — one-shot manual gathering with a rule that fires once at create.
3. **Auto Collect** — automatic by rule plus manual overrides.

The recurring community feedback is illuminating:

- Multiple commenters consistently argue *Auto Collect should be the only mode* — combining query flexibility with manual override capability. Brainstorm's unified List entity is this position, taken to its conclusion.
- Maintainers tend to flag uncertainty about whether shipping three modes is a good idea at all. The trilemma creates mental-model friction.
- A separate strand discusses where *new* objects land if the user doesn't pick a list — proposals include "Base", "Inbox", "Uncategorized". Brainstorm's answer is that **there is no default bucket**; every type has an implicit type-List (see [01-data-model.md §Migration](01-data-model.md)) and the Explorer app browses any entity directly. A new entity belongs to its type-List by virtue of having that type — no manual placement required.
- Nested collections with property inheritance: proposed but unresolved on depth and on whether nesting branches. Brainstorm sidesteps this by letting Lists *reference* other Lists via `byLink` (a List is just an entity, so its members are reachable by typed link). Nesting is composition, not a separate primitive.
- AND/OR query operators are a recurring top user pain in flat-set products. Brainstorm's `composite` source kind ([01-data-model.md §The ListSource shape](01-data-model.md)) ships AND/OR composition in v1.

## Operations on a List

These are the operations the Database app exposes; each maps to one or two writes to the List entity.

### Adding an entity to a List

`include` and `exclude` are independent layers of `effective(L) = (sourceMatches ∪ include) \ exclude`. An entity excluded but source-matched is *not* in effective(L) — the exclude wins. Adding therefore has to act on both layers, in this order:

```
add(L, e):
  1. if e ∈ exclude:           drop from exclude
  2. if !matchesSource(e) and e ∉ include:
                               append to include

  outcome:
    step 2 ran                                       → Included
    step 1 ran and step 2 didn't                      → UnExcluded
    neither                                           → NoOp
```

In the common case `matchesSource(e) = true` and `e ∉ exclude`, both checks fall through → NoOp (one round-trip, no writes). The pathological case (`matchesSource = true` *and* `e ∈ exclude`) requires step 1 to actually surface the entity; the old "matchesSource → no-op" short-circuit was wrong because it left the suppressing exclude in place.

### Removing an entity from a List

Symmetric to add:

```
remove(L, e):
  1. if e ∈ include:           drop from include
  2. if matchesSource(e) and e ∉ exclude:
                               append to exclude

  outcome:
    step 2 ran                                       → Excluded
    step 1 ran and step 2 didn't                      → UnIncluded
    neither                                           → NoOp
```

If `e` was pinned in (`include`) *and* the source also matches, dropping include alone leaves `e` still in effective(L) via the source-match — step 2 is required. If `e` was pinned in but the source doesn't match, step 1 is enough.

> **Decision:** include and exclude are treated as independent layers, not as a single one-of-three state machine. This is what made the original flowchart wrong and is worth pinning down: every "add" considers exclude, every "remove" considers exclude, every operation can write to both sides. The implementation in [`apps/database/src/logic/members.ts`](../../../apps/database/src/logic/members.ts) and its property tests are the canonical reference.

### Promoting a Manual list to a Query

The user has curated 20 movies in a Manual list and wants to make it dynamic ("everything of type Movie"):

1. UI offers "Make this a Query list" when manual membership is small or homogeneous.
2. User picks a source (the UI nudges with `byType = Movie` since all current members share that type).
3. Database app writes `source = {…}`; existing `members.include` *stays* (so any non-Movie items the user manually added remain — that's the Hybrid intent). UI shows a hint: "5 of 20 items are also matched by the new criteria; 15 remain pinned."

The user can then click "Trim pins that match the criteria" to remove the now-redundant `include` entries, demoting to a clean Query.

### Demoting a Query list to a Manual

1. UI offers "Freeze members" — materializes `entities.query(source)` into `members.include`.
2. Sets `source = null`.
3. The list now behaves like a conventional manual Collection.

This is the "Collect Once" operation from prior proposals, made into a one-click action rather than a mode.

### Converting a List into a *different* List

Changing the source is allowed at any time; the source is editable like any property. Members do not migrate. If the new source produces a wildly different effective membership, the UI shows a diff ("12 items will leave, 30 new items will appear, 5 stay") and waits for confirmation.

> **Decision:** changing a source is one transactional write. Old `members.include` and `members.exclude` are preserved. The user can revert by undoing the source change (Yjs gives us undo for free per [editing/06-collaboration-yjs.md](../../editing/06-collaboration-yjs.md)).

## What this enables that the conventional split doesn't

- **Hybrid lists, first-class.** "Project A's tasks" by criteria, plus three tasks from Project B that the lead is personally tracking. In a strict Set/Collection split: requires a dummy tag and a query change.
- **AND/OR/group composition.** "(Movie AND status = unwatched) OR (Book AND status = unread)" in one List.
- **Source by typed link, not just property.** "All entities that point at this Project entity by `belongs-to`" — typically only expressible by relation-back-pointer hacks.
- **Promote / demote without retyping.** The user's curation is preserved across mode changes.
- **Lists nest naturally** by reference, without a special "nested collection" primitive.

## What this gives up

- **The "I know what kind of thing this is at create time" affordance.** Users coming from a Set/Collection split often *want* to create either a Set or a Collection, deliberately. Brainstorm's create flow has to make Query and Manual reachable in equal numbers of clicks; the "+ New List" dialog defaults to a `byType` source (because that's the common case) but offers a "Manual" preset prominently — see [40-create-flow.md](40-create-flow.md).
- **Two-step set-up for some Manual lists.** Creating a Manual list and immediately adding 10 items is one click + 10 drags. We can't shortcut this; the alternative (forcing a source) is worse.
- **Performance attention on `byLink` sources.** Anchor-by-entity link traversal is the slowest source kind. We index it (per [01-data-model.md §Indexes](01-data-model.md)) but a deep-graph query with no upper bound can be slow on a 1M-entity vault.

## Sketch: what the UI shows

The List page header:

```
🎬  Movies to watch                                                   [⋯ menu]
    A Hybrid list — 247 from criteria, 3 pinned, 1 excluded
    Criteria: type is Movie AND status is unwatched   [edit ✎]
```

The mode badge ("Hybrid") is a tooltip + click-target that explains: *"This list has both criteria and manual overrides. Click to convert."* The two convert actions ("Freeze to manual", "Trim pins matching criteria") live in the badge popover. The criteria summary is human-readable; clicking `[edit ✎]` opens the source builder.

Drag-and-drop into the page area:

- If the dropped entity matches `source` → toast "Already matched by criteria — no action needed."
- If not → toast "Pinned to list" with an Undo. Adds to `members.include`.

Removing a row from a view:

- Right-click → "Remove from list" (when the entity is in `members.include`).
- Right-click → "Hide from list (exclude)" (when the entity is source-matched). Adds to `members.exclude`. UI shows it as struck-through-but-still-visible for 5 seconds with Undo.

## Why this doc is not the data model

Data-model details — schemas, storage shapes, indexes, the renamed `scope.list` — live in [01-data-model.md](01-data-model.md). This doc is the rationale: *why* one entity, *why* derived modes, *why* override-by-add-and-exclude. Future contributors should change this doc when the rationale changes, and that doc when the shape changes.

## Open questions registered

- **OQ-LD-4** — naming: do we call them "Lists" or "Databases" in the UI? "Database" matches common user expectations; "List" is more accurate (and shorter). Tentative leaning: **Database** in the launcher and window title, **List** as the entity-type name in code. Both surfaced in [11-open-questions.md](../../reference/11-open-questions.md).
- **OQ-LD-5** — when an entity matches a Query source *and* is in `members.exclude`, but the user later edits the entity so it no longer matches the source, should the exclude record auto-clean up? Tentative: yes — the exclude is now a no-op and can be dropped on next compaction.
- **OQ-LD-6** — should the user be able to express `source` as "all entities in another List L₂ (plus or minus my overrides)"? This is composition through indirection. Tentative: yes via `byLink` from List → members, but worth its own primitive `bySublist` if it becomes idiomatic.
- **OQ-LD-7** — "Nested collections with inherited properties" — do we ship anything for nesting in v1, or is reference-by-`byLink` enough? Tentative: rely on link composition for v1; revisit if users do this in volume.

## Summary

- One entity, three reachable modes. Mode is derived from shape, not stored.
- `source` defines dynamic membership (BP-shaped: by type, by filter, by link, by vocabulary, or AND/OR composition).
- `members.include` and `members.exclude` are overrides — bounded, audited, mergeable via Yjs.
- Promote, demote, snapshot are one-click operations on the same shape.
- The three-mode "Collections 2.0"-style proposal collapses to one mode here; the "Collect Once" mode is a one-action snapshot rather than a separate type.
- AND/OR composition, `byLink` sources, and Hybrid lists are all in v1 — three places where strict Set/Collection products force workarounds.
