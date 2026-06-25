# Graph — overview

The Graph app is the third of Brainstorm's four first-party apps (Notes → Database → **Graph** → Explorer per the project first-party-apps memory and the broader [01-vision.md](../../foundations/01-vision.md) §"a graph viewer is one of the apps you install"). Where the Notes app proves the block protocol substrate and the Database app proves entities + queries + views, the Graph app's job is to **prove typed links** as a first-class queryable, navigable substrate.

This doc is the entry point. Subsequent docs go deeper:

- [01-data-model.md](01-data-model.md) — `Graph/v1` and `GraphView/v1` entity types; the link-timestamp story that the history animation depends on.
- [10-pattern-filters.md](10-pattern-filters.md) — **the differentiator**: multi-subject, multi-level pattern filters ("Persons who studied at the same School *and* live in Berlin"). This is *not* the flat row-filter shape common in prior tools — pattern matching is qualitatively richer than row filtering.
- [20-views-and-rendering.md](20-views-and-rendering.md) — layouts, settings, node/edge styling, performance budgets.
- [30-history-animation.md](30-history-animation.md) — temporal playback. Brainstorm's `links.created_at` is already in the schema (per [data/18-storage-and-search.md](../../data/18-storage-and-search.md) §entities.db), so we can animate **edge creation order**, not just node creation order — which prior tools couldn't do because their data model lacked edge timestamps.
- [50-embedding-and-intents.md](50-embedding-and-intents.md) — `io.brainstorm.graph/embedded-graph` BP block for inline-in-Notes graphs; intent registrations (`open`, `share`, `export`).

## What problem the Graph app solves

The vault is a typed-link knowledge graph. Three things this app makes possible that aren't possible from the Database app or the Notes app:

1. **See the link structure.** Lists hide links behind row rendering. The Graph app *is* the link structure — every node is an entity, every visible edge is a typed link, and the user can read the topology at a glance.
2. **Multi-hop selection.** "Persons connected to each other via a shared School *and* both linked to City=Berlin" is not a row-filter query — it's a pattern. The Database app's `byLink` source kind handles single-anchor membership; the Graph app's pattern filter (per [10-pattern-filters.md](10-pattern-filters.md)) handles arbitrary subject + edge constraints.
3. **Replay growth.** A vault accretes over months. Scrubbing time backwards is the difference between "I have a graph" and "I can see how my thinking grew." Some prior tools ship node-only playback; ours uses edge timestamps as well.

## What the Graph app is *not*

- **Not a whiteboard.** Freeform drawing, sticky notes, hand-drawn edges, and the layout-as-content workflow belong to the whiteboard designer (v2 per [01-vision.md](../../foundations/01-vision.md)).
- **Not a Mermaid renderer.** Mermaid-style diagrams live inside Notes as embedded blocks shipped by a separate app. The Graph app reads vault data; Mermaid blocks render diagram source.
- **Not a CRDT canvas.** Co-editing of a graph layout is awareness-only in v1 (cursors, selection); the layout state is per-view configuration, not a CRDT-merged document. (Layout persistence still goes through Yjs because every entity does — see [01-data-model.md](01-data-model.md) §Persistence.)
- **Not a database view kind.** A graph view *inside* the Database app was considered and explicitly descoped in [database/20-views.md §Kinds](../database/20-views.md). The Database app's job is *tabular views of a List*; the Graph app's job is *spatial views of the link structure*. They share the entities service and the predicate language; their UI surfaces are different products. (Same line we drew between the Notes app and the Database app.)

## Sub-apps inside the Graph app

The Graph app's window hosts three modes that all read the same data:

1. **Full graph** (default) — the whole vault (or a saved subject set) laid out spatially.
2. **Local mode** — a single root entity plus its N-hop neighborhood. The chord opens this mode on the entity in focus.
3. **Path mode** — pick two entities; the app finds and highlights the shortest path (or set of paths) between them. Useful for "how is *Person X* connected to *Project Y*?"

Each mode is a `GraphView/v1` entity with `kind` set to `full` / `local` / `path`. The user can save views per mode the same way they save Database views.

## Dependencies and stage placement

| Depends on                          | Why                                                                              |
|-------------------------------------|----------------------------------------------------------------------------------|
| Entities service (Stage 9.3)        | Subject sets compile to `entities.query` predicates.                              |
| Typed links over `entities.subscribe` (Stage 9.3) | Edge fetching + live updates.                                            |
| Block Protocol Graph (Stage 9.3)    | The data shape this app reads is BP-Graph entities + link types.                  |
| `@brainstorm/react-yjs` (Stage 9.1) | The `Graph/v1` and `GraphView/v1` entities are Yjs-backed like every other entity.|
| Block frame iframe (Stage 9.5)      | The `embedded-graph` block runs inside Notes.                                     |
| Fancy-menus (Stage 8)               | Settings popover, edge-type picker, subject editor.                               |
| Database app's predicate language ([apps/database/30-filters-sorts.md](../database/30-filters-sorts.md)) | Subject predicates reuse `PropertyPredicate` verbatim. |

The app lands in **Stage 9.13** (placed after the Database app's Stage 9.12 because both apps share the same entities-service ramp-up; doing Database first burns down the predicate-language risk). The skeleton (manifest + types + readiness placeholder, mirroring 9.12.1) lands at the start of the stage; the real renderer fills in as 9.13.* iterations land. See [implementation-plan.md §Stage 9.13](../../implementation-plan.md).

## How the Graph app reads data

The Graph app is a *reader* — it does not own any data the user can't get to from other apps. Every read goes through `entities.subscribe(...)`:

```ts
// Pseudocode; the real call shape is in 10-pattern-filters.md
entities.subscribe({
  graphPattern: {
    subjects: { Person: { types: ["io.example/Person/v1"] }, ... },
    edges:    [ { from: "Person", to: "School", linkType: "io.example/StudiedAt/v1" }, ... ],
  }
}, callback);
```

The entities service compiles the pattern into recursive joins against the `links` table (per [data/18-storage-and-search.md §Schema](../../data/18-storage-and-search.md)) and streams the resulting `{nodes, edges}` payload over IPC. The app does not write SQL; it does not maintain a parallel cache; it does not hold a denormalized link index. Same architectural rule as the Database app.

Writes from the Graph app go through:

- `entities.write` for property edits made in a node's inspector panel (the gear cell on a selected node).
- `entities.write` for typed-link creation (drag from one node's edge-handle to another).
- `entities.write` on the `GraphView/v1` entity for layout/settings persistence.

The Graph app does **not** invent its own link types — it reads from whatever apps have registered (per [05-data-and-blocks-protocol.md](../../data/05-data-and-blocks-protocol.md) §Links). When the user creates a new link via drag, they pick a link type from the existing registry (via a fancy-menus typeahead).

## Performance budgets

Tracked alongside [data/18-storage-and-search.md §Performance budgets](../../data/18-storage-and-search.md) and [shell/13-frontend-stack.md §Performance budgets](../../shell/13-frontend-stack.md):

| Budget                                   | Target                                  |
|------------------------------------------|-----------------------------------------|
| Initial graph load (10k nodes, 30k edges) | < 800ms wall clock from launch        |
| Pattern-filter recompile after edit       | < 100ms p50                            |
| Force-layout tick on 10k nodes            | 60fps with WebGL renderer; 30fps with canvas fallback |
| History-animation seek (jump to date)     | < 50ms                                 |
| History-animation play (1x speed)         | one frame per logical day, never below 30fps |
| Subgraph save / load                       | < 200ms                                |

Hard caps:

- **50k nodes** in a single view. Beyond that, the app surfaces a "narrow the source" banner and disables auto-layout. Soft warning at 25k.
- **150k edges** in a single view. Beyond that, edges thin to faint grey and are not interactable.
- **8 levels of pattern nesting** (subject ↔ edge ↔ subject ↔ edge ↔ …). The pattern compiler short-circuits if the join product would exceed the node cap.

## Prior-art cross-reference

The Graph app borrows liberally from established graph-app UX patterns:

| Pattern                                     | What we adopt                                                       |
|--------------------------------------------|---------------------------------------------------------------------|
| Two-section settings (appearance + show-on-graph) | Appearance (labels/markers/icons/preview/cluster) + show-on-graph (links/relations/orphans/type-edges) — see [40-settings](20-views-and-rendering.md#settings). |
| Per-type visibility toggle                  | Adopted, plus a per-link-type visibility toggle — first-class because we have typed links. |
| Local-mode depth slider                     | Adopted — see [20-views-and-rendering.md §Local mode](20-views-and-rendering.md#local-mode). |
| Timeline scrubber + play/pause/speed        | Adopted as the **history animation** ([30-history-animation.md](30-history-animation.md)), extended to edge timestamps not just node timestamps. |
| `d3-force` layout                           | Adopted with WebGL renderer (pixi) on top instead of canvas-only — see [20-views-and-rendering.md §Rendering](20-views-and-rendering.md#rendering). |

Things we don't adopt:

- **The `relation` edge type as a first-class concept.** Some prior tools render property links (e.g. an entity's `assignedTo` field) as edges. We do not — properties are properties, links are links. If a user wants property-derived edges, they create a link instead.
- **Orphan-objects toggle hidden by default.** We default to showing orphans — discovering the disconnected periphery of a vault is one of the things this app is for.
- **The single-flat filter list.** Flat per-relation rows with at most one level of nesting via group is a common shape in prior tools. The Database app already ships nestable AND/OR groups; the Graph app extends to **multi-subject pattern matching** (per [10-pattern-filters.md](10-pattern-filters.md)) — strictly more expressive.

## Open questions

Cataloged in [reference/11-open-questions.md](../../reference/11-open-questions.md) as `OQ-GR-1` through `OQ-GR-9`. The ones that block specific 9.13 iterations:

- **OQ-GR-1** — Pattern-filter persistence shape (one Y.Map per subject vs one Y.Map for the whole pattern). Blocks 9.13.3.
- **OQ-GR-2** — Layout-position storage: per-view vs per-entity (one global "preferred position"). Blocks 9.13.6.
- **OQ-GR-3** — Edge creation timestamp backfill for legacy links (created before Brainstorm tracked it). Blocks 9.13.10.
- **OQ-GR-4** — Force vs WebGL renderer pick. Blocks 9.13.5.
- **OQ-GR-5** — Co-presence cursor model (awareness for layout drags vs read-only). Non-blocking; defers to Stage 10.

## Summary

The Graph app is the first-party app that surfaces the link structure of the vault. Three modes (full / local / path), pattern-based multi-subject filters that go beyond row-filtering, a temporal playback that uses our edge timestamps, and the same predicate language the Database app uses for everything else. Lands at Stage 9.13 (scaffold first, then 9 iterations).
