# Graph — views, rendering, and settings

This doc covers everything between "the pattern returned a set of nodes and edges" and "pixels on the screen": the three view kinds, the layout algorithms, the renderer, the persistent settings, and the discoverable interactions on the canvas.

## The three view kinds

A `GraphView/v1.kind` is one of `Full` / `Local` / `Path`. Same Graph entity, different framings:

### Full

The pattern's complete node set, laid out in space. The default. Useful for "what's in my vault."

- Default layout: `LayoutKind.Force` with `clusterByType: true`.
- The 50,000-node hard cap (per [01-data-model.md §Hard caps](01-data-model.md#hard-caps)) is the upper bound; the renderer surfaces a soft-warning banner at 25,000.
- Camera resets to "fit" only on first open; subsequent opens restore the saved zoom + pan.

### Local

A single root entity + its N-hop neighborhood — the conventional "local graph" shape (per [00-overview.md §Prior-art cross-reference](00-overview.md#prior-art-cross-reference)).

- Default layout: `LayoutKind.Radial` — concentric rings, one ring per hop distance from the root.
- The root entity sits at the origin; ring 1 = direct neighbors; ring 2 = neighbors-of-neighbors; etc.
- `depth` slider (1..10, default 2) re-runs the BFS from the root.
- `linkDirections` toggle: in / out / both. Default both. "In" = trace edges pointing *to* the root; "out" = away.
- The pattern's subject predicates still apply — a Local view of "all Persons" with depth 2 from `Me` shows only Persons within 2 hops, not Notes or Tags.

### Path

Find one or more paths between two selected entities. Useful for "how do these two entities connect?"

- Default layout: `LayoutKind.Hierarchy` — top-to-bottom, root entity at top, target at bottom, intermediates in rows by hop distance.
- `algorithm` options:
  - `shortest` — one path of minimum length (default).
  - `shortest-weighted` — minimum-length, then minimum-summed-link-recency (older links preferred — they're more "established" connections).
  - `all-simple` — up to `maxPaths` simple paths (no node repeats), capped at `maxLength` per [01-data-model.md](01-data-model.md).
- The path-finding query is a separate compilation — it's a recursive CTE from the source entity bounded by `maxLength`, terminating when the target id is reached.
- Highlight: nodes/edges *on* a path are full opacity; nodes that participate in *no* path fade out (and are clickable but greyed).

## Rendering

The Graph app renders to canvas via [pixi.js](https://pixijs.com) (WebGL renderer with a 2D-canvas fallback for environments where WebGL isn't available). We use d3 for layout and pixi for paint because the 25k-node soft-cap demands GPU acceleration.

> **Open: OQ-GR-4** — Renderer pick. The alternatives are (a) pixi.js + d3-force on the main thread, (b) pixi.js + d3-force in a Worker thread (positions posted over `MessageChannel` per [12-shell-architecture.md §Worker pool](../../shell/12-shell-architecture.md)), (c) a custom WebGL2 renderer using transform feedback for positions. Tentative: **(b)** — running layout in a worker keeps the main thread responsive on 10k+ node animations. The pattern-compiled `{nodes, edges}` payload is sent to a per-window layout worker, which posts back per-frame positions; the main thread reads positions and draws.

Three render layers, bottom-to-top:

1. **Edges layer** — straight lines (force/radial/circular) or curved Bézier (hierarchy). Edges colored by link-type by default; user can override per-link-type via settings.
2. **Nodes layer** — colored discs, sized per `settings.sizing`, colored per `settings.coloring`. Icons (when `showIcons`) overlay on the disc as a small inner sprite.
3. **Labels layer** — title text, only drawn when (a) `showLabels` is true *and* (b) zoom level is past `LABEL_VISIBILITY_ZOOM_THRESHOLD` (default 0.4). At extreme zoom-out, labels are noise; the renderer hides them.

### Edge rendering

- Straight by default. Curved when the same pair of entities has multiple edges of different link types (the renderer offsets the curves so all are visible).
- Arrowheads (markers) on by default for directed edges; toggleable via `GraphVisibility.showArrows`.
- Edge thickness scales with `settings.coloring = ByRecency` to emphasize recently-created edges.
- Highlighted edges (from `Graph.highlights`) render at full opacity even when `edgeOpacity` is fractional.

### Cluster-by-type physics

When `clusterByType: true`, the force layout uses `d3-force-cluster` to group entities of the same type. The visual is a cluster of like-typed nodes with weak inter-type forces — the user sees their *types* at a glance. Type URLs come from BP entity types.

### Coloring

`NodeColoring.ByType` (default) maps each unique type URL to a color from a 12-color qualitative palette (matching the dashboard's app-icon palette per `renderer/dashboard/app-icon-palette.ts`). Colors are derived deterministically by hashing the type URL — same type URL = same color across vaults.

`NodeColoring.ByProperty` lets the user pick a property and a palette:
- Categorical (string + vocabulary): colored by value, palette wraps at 12.
- Numeric: linear or log color ramp between two endpoints (default: blue → red).
- Boolean: two colors.
- Date: hue-rotated color ramp; recent dates use the warm end.

`NodeColoring.ByCluster` runs a community-detection algorithm (Louvain) on the visible graph once per render and colors by computed cluster id. The computation is debounced to 500ms after the pattern stops changing. Useful for "who hangs out together."

`NodeColoring.ByRecency` is a green-→-red heatmap on `updated_at`: cool = old, hot = recent.

### Performance: 5,000 nodes baseline

Per [00-overview.md §Performance budgets](00-overview.md#performance-budgets), the budget is 10,000 nodes / 30,000 edges at 60fps. The renderer hits this by:

- **WebGL batched draw calls** — one batched draw per layer; nodes/edges as instanced quads.
- **Frustum culling** — nodes/edges outside the current viewport are skipped each frame.
- **Level-of-detail** — when zoomed out past `LABEL_VISIBILITY_ZOOM_THRESHOLD`, labels are skipped; when zoomed out past `ICON_VISIBILITY_ZOOM_THRESHOLD = 0.2`, icons are also skipped; at `0.1` zoom, edges are skipped and only nodes paint.
- **Layout worker** — the force simulation runs in a Worker. The main thread only reads positions, never simulates.

Hardware-fail-graceful: if WebGL initialization fails, the renderer falls back to a 2D-canvas path with hard-coded LoD thresholds (`labels off`, `clusterByType off`, `forceParams.charge` halved). The status bar shows a `Software renderer` chip. The 25,000-node soft warning becomes a 5,000-node hard cap on the software path.

## Settings panel

The settings panel uses a two-section layout (appearance + show-on-graph), extended for Brainstorm's typed-link substrate:

```
┌ Appearance ────────────────────────────────────────────────┐
│   ⊟ Show labels                                            │
│   ⊠ Show arrows                                            │
│   ⊠ Show icons                                             │
│   ⊟ Show hover preview                                     │
│   ⊠ Cluster by type                                        │
│   ⊟ Show type edges                                        │
│                                                              │
│   Node size:    [ Uniform ▾ ]    [ ... property ... ]      │
│   Node color:   [ By type ▾ ]    [ ... property ... ]      │
│                                                              │
│   Edge opacity:   ────●──────  0.65                         │
│   Hi-quality render: ⊠  (off when ≥10k nodes)              │
└────────────────────────────────────────────────────────────┘
┌ Show on graph ─────────────────────────────────────────────┐
│   ⊠ Links                                                  │
│   ⊠ Orphan entities (no edges in this view)                │
│   ⊠ Hidden types: [ pick types … ]   3 types hidden        │
│   ⊠ Hidden link types: [ pick link types … ]               │
└────────────────────────────────────────────────────────────┘
┌ Local mode ────────────────────────────────────────────────┐
│   ⊠ Use as local graph                                     │
│   Depth:        ────●────────  3                            │
│   Directions:   [ In ⊟ ] [ Out ⊠ ] [ Both ⊟ ]              │
└────────────────────────────────────────────────────────────┘
┌ History animation ─────────────────────────────────────────┐
│   ⊠ Enable                                                  │
│   Reveal:       [ Eased ▾ ]                                 │
│   See [30-history-animation.md](30-history-animation.md)    │
└────────────────────────────────────────────────────────────┘
```

The panel itself is a `<Popover>` (per the [shared popover rule](../../../CLAUDE.md#conventions-that-bite)) anchored on a gear icon in the right corner of the app header. The gear's chord is `Cmd+,` (consistent with the global Settings chord) when the Graph window is focused.

> **Decision:** the *Hidden types* and *Hidden link types* controls live in the Settings panel, not in a separate "Type filter" submenu. One panel, one mental model. The picker is a fancy-menus typeahead.

### Per-link-type settings

A separate sub-popover (entered from "Hidden link types" → "Customize…") lets the user set per-link-type:

- Visibility (mirrors the visibility toggle).
- Edge color override (default: type-URL-hashed color).
- Edge width override.
- Arrowhead style (none / open / closed / double).

These persist on the GraphView's `settings.linkTypeOverrides: Record<string, LinkTypeStyle>`.

## Interactions on the canvas

| Gesture                              | Effect                                                                              |
|--------------------------------------|-------------------------------------------------------------------------------------|
| Single-click a node                  | Select it. Sidebar shows the node's inspector.                                       |
| Cmd/Ctrl-click                       | Toggle selection.                                                                    |
| Shift+drag on empty space            | Lasso-select.                                                                        |
| Double-click a node                  | Dispatch `intent.open` for that entity (opens its primary app).                       |
| Drag a node                          | Move it. Releasing while modifier-held pins it (writes to `Graph.pins`).             |
| Drag from a node's edge handle to another node | Create a typed link. Picks the link type from a fancy-menus popover.       |
| Right-click a node                   | Context menu (rename, hide from graph, copy link, open in other app).                |
| Right-click empty space              | Context menu (new entity at this position, paste pinned coords, reset camera).       |
| Mouse wheel                          | Zoom centered on cursor. Pinch on trackpad equivalent.                                |
| Two-finger drag / middle-drag        | Pan.                                                                                  |
| Cmd/Ctrl + 0                         | Fit-to-view.                                                                          |
| Cmd/Ctrl + 1                         | Reset zoom to 1.0.                                                                    |
| F                                    | "Focus": center on the selected node, zoom to 1.5.                                    |
| /                                    | Open the launcher palette (per [37-cross-app-navigation](../../shell/37-cross-app-navigation.md)) scoped to the current Graph. |
| Esc                                  | Clear selection; if a popover is open, close it.                                      |

All shortcuts route through the renderer-side `useShortcut(id, handler)` hook per the [keyboard-and-i18n rule](../../foundations/35-code-conventions.md#keyboard-handling) — no raw `e.key` in the renderer. The ids land in `renderer/shortcuts/default-chords.ts` (the Graph app's chord set is namespaced `graph/...`).

## Inspector panel (the right rail)

When one or more nodes are selected, the right rail of the Graph app window opens to an inspector that shows the selection:

```
┌ Selected ─────────────────────────────────────────┐
│                                                     │
│   1 node selected                                   │
│                                                     │
│   ⌗ Person A                                        │
│      Name:        Alice                             │
│      City:        Berlin                            │
│      Studied at:  RWTH Aachen, ETH Zürich           │
│                                                     │
│   [ Open in Notes ]   [ Edit properties ]           │
│                                                     │
│   Connections: 12                                   │
│      → Studied at (2)                               │
│      → Lives in (1)                                 │
│      → Works at (1)                                 │
│      ← Authored by (8)                              │
│                                                     │
└────────────────────────────────────────────────────┘
```

Multi-selection inspector shows shared properties (per [entities §Reading effective schemas](../../data/19-properties-and-schemas.md)) — when 5 Persons are selected, the inspector shows `name (5)`, `city (3, mixed)`, etc.

The inspector reuses the same property editor surface as the Database app's grid inline edit (per the DRY rule). When the user edits a property in the inspector, the write goes through `entities.write` and the live update flows back through the pattern subscription to update the visible state.

## Subgraphs

The "Subgraphs" submenu in the left rail lets a user save the *currently-visible-and-selected* subset of nodes as a named subgraph entity. Subgraphs are first-class — they're a saved `Graph/v1` entity with a pattern that pins the exact entity ids of the captured selection.

Useful for:

- "Save the network I just explored."
- "Mark this subset for later comparison."
- Sharing a snapshot of a sub-question with a teammate (when sync ships in Stage 10).

Subgraphs are listed in the launcher and are intent-targetable like any entity.

## Compare mode (v2 candidate)

Side-by-side rendering of two graphs (or the same graph at two different history-cutoff dates). Useful for "what changed between Q1 and Q2." Not in v1 scope; tracked as `OQ-GR-6`.

## Cluster summarization (v2 candidate)

When zoomed out past `0.15`, the renderer optionally summarizes clusters into supernodes labeled with their type and count (e.g. a single node "Persons (47)" instead of 47 individual circles). Toggleable. Not v1; tracked as `OQ-GR-7`.

## Summary

- Three view kinds: Full (everything), Local (root + N hops), Path (between two endpoints).
- pixi.js WebGL renderer with d3-force in a worker; canvas fallback for fail-graceful.
- Settings: appearance + show-on-graph + local mode + history animation, with typed-link extensions.
- Per-link-type visibility / color / width — a control surface enabled by first-class typed links.
- Interactions: click / drag / pan / zoom / shortcut. Every chord goes through the shortcut registry.
- Inspector reuses Database app's property editor; subgraph snapshots are saved Graph entities.
- 10k nodes / 30k edges at 60fps; soft warning at 25k; hard cap at 50k.
