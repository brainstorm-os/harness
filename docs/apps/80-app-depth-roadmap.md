# App depth roadmap — what each app does *next*

Every app ladder is ✅, which is easy to misread. It means **v1 scope closed**, not that the app is finished. v1 asked each app to exist, hold real entities, and be keyboard- and screen-reader-complete. It did not ask any of them to be *good at their domain* the way a mature tool is.

This document is the second axis: **depth**, not breadth. No new apps — more capability inside the ones that exist.

## How rungs are minted here

Each app continues its **own existing id space** (`9.13.x` for Graph, `9.12.x` for Database), so history stays contiguous and `parse-plan` keeps working. Nothing here gets an id until its app has had an **inventory pass** — a read of what actually shipped, not what the plan says shipped. Graph and Database have had one (2026-08-03); the rest have not, and their sections below are *candidates*, deliberately unnumbered.

That distinction matters because this session found the plan overstating reality twice in one day (F-488's triage blamed a render fault for data loss; the drift ratchet certified twenty apps the owner then found broken). A roadmap written off the plan alone would inherit those errors.

## Graph *(9.13.x)* — inventoried 2026-08-03

**What exists:** one layout (`9.13.5`, d3-force in a Web Worker, frustum culling + LOD, 5k-node frame bench), a `GraphPattern` SQL compiler, local-view depth, a `where` predicate builder, click-select + multi-select + editable inspector, a live bucketed event stream, export-to-file, and a hardened Pixi renderer.

**The gap:** force-directed is one opinion about what a graph means. It is the right default and the wrong answer for most specific questions — "what depends on this?", "how did this evolve?", "what clusters?" each want a different geometry. A single layout also makes the 5k budget harder than it needs to be, because force is the most expensive option.

| Candidate | Why it earns its place |
| --- | --- |
| **Hierarchical / layered (Sugiyama)** | The answer to "what depends on what". Force-directed actively hides direction; a layered DAG makes it the primary visual. Highest value of the set. |
| **Radial / ego** | Pairs with the existing local-view depth (`9.13.7`), which already computes the neighbourhood — this is the layout that neighbourhood deserves. Cheapest to add for the value. |
| **Timeline / temporal** | Positions by `createdAt`, so the graph answers "how did this grow". Reuses the bucketed event stream (`9.13.10e`). |
| **Cluster / community** | Modularity grouping with collapsible super-nodes. Also the honest answer to graphs above the 5k cap — collapse rather than cull. |
| **Layout as a persisted per-graph choice** | Prerequisite for all of the above: layout becomes state on `Graph/v1`, not a hardcoded call. Should land *first*. |

**Sequencing note:** the persisted-choice rung is not optional plumbing to defer — adding a second layout without it means the third one is a rewrite.

## Database *(9.12.x)* — inventoried 2026-08-03

**What exists:** `List/v1`, formula/rollup computed columns, per-column and per-board aggregations, CSV import + export, live-rolling relative-date filters, advanced typed-ref predicates, relations browse, in-place cell editing. Views today are **grid and board**.

**The gap:** the data layer is genuinely strong — formulas, rollups and aggregations are the hard part and they are done. What is missing is *ways to look at it*. Aggregations already compute the numbers a chart would draw, so charts are closer to shipping than they look.

| Candidate | Why it earns its place |
| --- | --- |
| **Chart view** | The aggregation engine (`9.12.18`) already produces the series. Bar / line / pie over an existing group-by is mostly a rendering problem, not a data one. Highest ratio of value to remaining work. |
| **Calendar view** | Any list with a date column is a calendar. The date-filter machinery (`9.12.20`) already understands the column semantics. |
| **Gallery / card view** | The view every "database" product needs the moment a row has a cover, and covers already exist fleet-wide. |
| **Timeline / Gantt** | Two date columns become a span. Wants the relation work (`9.12.22`) for dependencies. |
| **Saved views** | Named filter + sort + view-type combinations per list. Cross-cutting: it is what makes *having* five view types usable rather than a mode toggle. |

**Sequencing note:** saved views should land with or before the second view type, for the same reason as Graph's persisted layout.

## Other apps — candidates, not yet inventoried

Listed to be argued with, not built from. Each needs its own inventory pass first.

- **Notes** — the embed-block family (`B11.20`) is already filed and is the live thread. Beyond it: backlink panel depth, and outline/document map.
- **Tasks** — recurring tasks, dependencies, and a workload view are the usual depth axis; unknown how much exists.
- **Calendar** — ladder closed with CalDAV. Depth is probably availability/scheduling rather than more views.
- **Files** — preview coverage and bulk operations.
- **Whiteboard** — templates, and connector routing.
- **Books / Bookmarks** — both have reading-position and annotation threads already part-filed (`9.18.8`).
- **Mailbox / Browser / Agent / Automations** — these are the least mature and most likely to need breadth before depth; treat them separately.

## What this roadmap deliberately does not do

It does not propose new apps. The fleet is twenty apps and the honest constraint is that several are thin — adding a twenty-first would make that worse. It also does not touch the marketplace, sync, or agent tracks, which have their own ladders.

**Open question for the owner:** depth is a *lot* of surface, and the two apps above alone are ~10 rungs. Is the goal a few apps that are genuinely excellent, or an even rise across the fleet? The answer changes the order completely, and it is a product call rather than an engineering one.
