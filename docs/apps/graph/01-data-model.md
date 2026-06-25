# Graph — data model

The Graph app registers two canonical entity types: **`brainstorm/Graph/v1`** (a saved graph configuration: which subjects, which edges, which subgraph filters) and **`brainstorm/GraphView/v1`** (a rendering of a Graph: layout kind, settings, history-animation state). The split mirrors `List` / `ListView` in [database/01-data-model.md](../database/01-data-model.md) — for the same reason: one logical scope can be looked at multiple ways.

## `Graph/v1`

```ts
export type Graph = {
  id: string;
  name: string;
  icon: Icon | null;
  description: string;
  // The pattern that determines which entities and links appear.
  // See [10-pattern-filters.md](10-pattern-filters.md).
  pattern: GraphPattern;
  // Saved-by-user overrides that survive pattern changes.
  pins:   PinnedNode[];        // manually-positioned nodes
  hides:  HiddenNode[];        // entities the user removed from this graph
  highlights: HighlightedEdge[]; // edge ids the user wants emphasized
  // The user's saved views of this graph (full / local / path variants).
  views: string[];             // GraphView/v1 entity ids
  defaultViewId: string | null;
  createdAt: number;
  updatedAt: number;
};
```

| Field         | Purpose                                                                                          |
|---------------|--------------------------------------------------------------------------------------------------|
| `pattern`     | The query that produces the visible `{nodes, edges}` payload. Full shape in [10-pattern-filters.md](10-pattern-filters.md). |
| `pins`        | Per-entity x/y overrides. Force-layout respects pins by treating them as fixed nodes.            |
| `hides`       | Per-entity removal from this graph. Survives pattern recomputation (an entity that re-enters the pattern stays hidden).  |
| `highlights`  | Edge ids the user explicitly tagged. Renders thicker / brighter than the rest.                   |
| `views`       | `GraphView/v1` entity ids belonging to this Graph.                                                |
| `defaultViewId` | Which view opens when the Graph is opened from an opener.                                       |

```ts
export type PinnedNode = {
  entityId: string;
  x: number;        // in graph units (not screen px); the renderer applies the current zoom.
  y: number;
  pinnedAt: number; // ms epoch
  by: "user" | `app:${string}`;
};

export type HiddenNode = {
  entityId: string;
  hiddenAt: number;
  reason?: string;  // free-text — surfaced in the Settings → Hidden panel.
};

export type HighlightedEdge = {
  linkId: string;
  color: string | null;  // null = default highlight token; explicit hex for custom.
  note?: string;
};
```

> **Decision:** `pins`/`hides`/`highlights` live on the Graph entity, not the GraphView. A user with three GraphViews (full, local, path) of the same vault expects "I pinned Person X" to hold across all three views — pinning is about the *node-in-this-graph*, not the *layout-this-view*.

### Why `pattern` lives on the Graph, not the GraphView

Pattern is *which entities are members*, akin to a List's `source` + view filters. The Database app keeps source on the List and only filter overlays on the View. Here the analogy is exact: the **pattern is the Graph's source**; per-view filter overlays let a view narrow further. The view filter is much simpler than the Graph pattern (a single `PropertyPredicate` over the already-selected nodes) — most users will never need it.

> **Open: OQ-GR-1** — Persistence shape for `pattern`. Option (a): one `Y.Map<string, Subject>` keyed by subject name + one `Y.Array<EdgeConstraint>` for edges. Option (b): a single `Y.Map<string, unknown>` opaque to Yjs structural merging. Tentative: (a) — subject reorderings and edge additions should merge cleanly across two devices editing the same Graph.

## `GraphView/v1`

```ts
export enum GraphViewKind {
  Full   = "full",   // whole pattern, no scope narrowing.
  Local  = "local",  // root entity + N-hop neighborhood (depth slider).
  Path   = "path",   // shortest path(s) between two selected entities.
}

export type GraphView = {
  id: string;
  graphId: string;            // FK to Graph/v1
  name: string;
  icon: Icon | null;
  kind: GraphViewKind;
  // Per-kind layout options — discriminated by kind.
  layoutOptions: LayoutOptions;
  // What's visible.
  visibility: GraphVisibility;
  // Per-view filter overlay; AND-combined with the Graph's pattern.
  filterOverlay: FilterNode | null;  // same shape as database/30-filters-sorts.md
  // Sort key (used for staggered animation and history ordering).
  ordering: GraphOrdering;
  // Persistent visual state.
  settings: GraphSettings;
  history: HistoryAnimationState;
  // Drift control: when the pattern recomputes, where should the camera end up?
  cameraPolicy: CameraPolicy;
  createdAt: number;
  updatedAt: number;
};
```

### `GraphVisibility`

A typed "Show on graph" section:

```ts
export type GraphVisibility = {
  showLabels: boolean;            // node titles
  showIcons: boolean;             // entity icons
  showArrows: boolean;            // edge markers (directed)
  showOrphans: boolean;           // entities with no edges in this view
  showPreviewOnHover: boolean;    // hover preview
  clusterByType: boolean;         // cluster toggle; we extend to clusterBy property in v2.
  hiddenTypes: string[];          // entity type URLs to omit
  hiddenLinkTypes: string[];      // link type URLs to omit — first-class because we have typed links
};
```

### `LayoutOptions`

Discriminated by `view.kind`:

```ts
export enum LayoutKind {
  Force      = "force",      // d3-force; default for Full
  Radial     = "radial",     // ring per hop; default for Local
  Hierarchy  = "hierarchy",  // top-down; for Path
  Circular   = "circular",   // single ring
  Grid       = "grid",       // uniform; for screenshot / export
}

export type LayoutOptionsFull = {
  kind: GraphViewKind.Full;
  layout: LayoutKind;
  forceParams: ForceParams | null;        // null = renderer defaults
  initialCenter: { entityId: string } | null;
};

export type LayoutOptionsLocal = {
  kind: GraphViewKind.Local;
  layout: LayoutKind;                      // typically Radial
  rootEntityId: string;
  depth: number;                           // 1..graphDepthCap (default 10)
  linkDirections: LinkDirection[];         // in / out / both
};

export type LayoutOptionsPath = {
  kind: GraphViewKind.Path;
  fromEntityId: string;
  toEntityId: string;
  maxPaths: number;                        // default 5; cap 20
  maxLength: number;                       // default 6; cap 12
  algorithm: "shortest" | "shortest-weighted" | "all-simple";
};

export type LayoutOptions = LayoutOptionsFull | LayoutOptionsLocal | LayoutOptionsPath;

export type ForceParams = {
  charge: number;        // repulsion (negative)
  linkDistance: number;  // ideal edge length in graph units
  collisionRadius: number;
  centerStrength: number;
  velocityDecay: number; // 0..1
};
```

### `GraphSettings`

The persistent appearance + behavior toggles that survive close/reopen. Mirror of the settings sections in [00-overview.md §Prior-art cross-reference](00-overview.md#prior-art-cross-reference):

```ts
export enum NodeSizing {
  Uniform    = "uniform",
  ByDegree   = "by-degree",     // larger = more edges
  ByRecency  = "by-recency",    // larger = recently edited
  ByProperty = "by-property",   // larger = higher value on settings.nodeSizeProperty
}

export enum NodeColoring {
  ByType     = "by-type",       // default; one color per entity type
  ByProperty = "by-property",   // categorical or numeric color ramp
  ByCluster  = "by-cluster",    // colored by computed cluster id (community detection)
  ByRecency  = "by-recency",    // green→red heatmap on updated_at
  Uniform    = "uniform",
}

export type GraphSettings = {
  sizing: NodeSizing;
  nodeSizeProperty: string | null;
  coloring: NodeColoring;
  nodeColorProperty: string | null;
  // The visibility toggles already on GraphVisibility above:
  //   showLabels, showIcons, showArrows, showOrphans, showPreviewOnHover, clusterByType
  showTypeEdges: boolean;       // synthesized "is-a" edges from entity to type entity
  edgeOpacity: number;          // 0..1; faint edges when 50k+ visible
  // Performance knobs:
  webgl: boolean;               // false forces canvas; default true if 3k+ nodes
  highQuality: boolean;         // antialiased + per-frame stroke; off when ≥10k nodes
};
```

> **Decision:** sizing/coloring discriminators are TS enums (`NodeSizing`, `NodeColoring`, `LayoutKind`, `GraphViewKind`) per the enums-not-string-constants convention memory. The wire format stays as strings because the enum values *are* strings.

### `HistoryAnimationState`

The serialized state of the history scrubber. The renderer can resume mid-playback after a vault reopen — useful for screen-recording vault evolution. Full mechanics in [30-history-animation.md](30-history-animation.md):

```ts
export type HistoryAnimationState = {
  enabled: boolean;
  // Playback range. Both ms epoch; null = "unbounded on this side".
  startAt: number | null;
  endAt: number | null;
  // Current playhead position (ms epoch). Persisted so paused playback survives reopen.
  cutoffAt: number | null;
  // Playback speed multiplier on the "1 day per second" baseline. 1 / 2 / 4 / 8 / 16.
  speed: number;
  // What to interpolate as time advances.
  reveal: HistoryReveal;
};

export enum HistoryReveal {
  // Nodes + edges appear when their `created_at` ≤ cutoff. Removed when `deleted_at` ≤ cutoff.
  Strict     = "strict",
  // Strict + a fade-in over the surrounding 24h window for context.
  Eased      = "eased",
  // Only the delta in the last N hours; everything older fades to background.
  Recent     = "recent",
}
```

### `CameraPolicy`

```ts
export enum CameraPolicy {
  KeepUserPosition  = "keep",      // pattern recompute: do not move camera (default)
  FitToView         = "fit",       // after recompute, zoom to fit the new node set
  CenterOnSelection = "centerSel", // recompute: re-center on currently selected node
}
```

### `GraphOrdering`

Used by both staggered-animation appearance and history-replay step order. Multi-key, like `Sort` in the Database app:

```ts
export type GraphOrdering = {
  primary:   { key: "created" | "updated" | "degree" | "title" | `property:${string}`; direction: SortDirection };
  secondary: GraphOrdering["primary"] | null;
};
```

## Storage layout

| Field              | Storage                                                                                            |
|--------------------|----------------------------------------------------------------------------------------------------|
| `Graph/v1` entity  | `entities.db` (the row) + the entity's Y.Doc (the pattern's mutable subject/edge structures).      |
| `pattern`          | Inside the Y.Doc — `Y.Map<subjectName, Y.Map>` + `Y.Array<EdgeConstraint>`. Concurrent edits merge structurally. |
| `pins` / `hides` / `highlights` | Inside the Y.Doc as `Y.Array<Y.Map>`. Soft-deleted entries persist (the user can un-hide). |
| `GraphView/v1`     | Same pattern: `entities.db` row + per-view Y.Doc carrying mutable fields (`layoutOptions`, `settings`, `history`). |
| Layout coordinates | Per-view Y.Map<entityId, {x, y, pinned: boolean}>; per-view because two views of the same Graph can have independent layouts. (Pinned nodes' coordinates are also written back to `Graph.pins` so they survive view recreation.) |

### Why a Y.Doc per entity, again

Same reasoning as elsewhere in Brainstorm: every entity that holds mutable user state gets a Y.Doc so concurrent edits merge cleanly. Graphs and GraphViews routinely have many in-window writes (drag a node → write a coordinate, toggle a setting, scrub the history slider) so an in-memory Y.Doc keeps the latency local; the IPC roundtrip to the ydoc worker happens on the next compaction tick.

## Link timestamps (the substrate that makes history animation possible)

Brainstorm's `links` table (per [data/18-storage-and-search.md §Schema](../../data/18-storage-and-search.md)) already carries:

```sql
CREATE TABLE links (
  id                 TEXT PRIMARY KEY,
  source_entity_id   TEXT NOT NULL REFERENCES entities(id),
  dest_entity_id     TEXT NOT NULL REFERENCES entities(id),
  link_type          TEXT NOT NULL,
  created_at         INTEGER NOT NULL,
  deleted_at         INTEGER
);
```

`created_at` and `deleted_at` are exactly what the history animation needs. Prior tools that lacked edge timestamps could animate only entity creation — not the moment a link was drawn. Brainstorm gets edge-accurate playback for free.

### Backfill for entities created before timestamp tracking

> **Open: OQ-GR-3** — for a vault upgraded from a build before link `created_at` was reliably written, we have rows where `created_at` is missing or zero. Options:
>
> - (a) Treat missing timestamps as "exists from the beginning" — they appear at the very first frame.
> - (b) Treat them as "appeared last" — they sit at the right edge of the timeline.
> - (c) Backfill on first vault open: the source entity's `created_at` is a reasonable fallback for "when was this entity-and-its-outgoing-edges first written".
>
> **Tentative**: (c) — backfill on first open of the Graph app's window for that vault. The backfill rule is `link.created_at = MAX(link.created_at, source_entity.created_at)` and is a one-shot SQL UPDATE. The audit log records the count of rows touched.

## Effective member set (pattern → nodes)

The entities service compiles a `GraphPattern` to a SQL plan against `entities.db` + `links` per the algorithm in [10-pattern-filters.md §Compilation](10-pattern-filters.md#compilation). The result is two cursors:

- **Nodes cursor** — `{entityId, type, properties, createdAt, updatedAt}` per matched node, with the bound subject name attached.
- **Edges cursor** — `{linkId, sourceEntityId, destEntityId, linkType, createdAt, deletedAt}` per matched edge.

These stream over a single `entities.subscribe({graphPattern})` subscription, with the live-update protocol from [entities §Subscriptions](../../data/18-storage-and-search.md). The Graph app's renderer never compiles SQL itself; the only computation it does is layout + rendering.

## Hard caps

| Field                                | Cap                              |
|--------------------------------------|----------------------------------|
| `pins.length`                         | 5000 (same shape as List `MEMBERS_HARD_CAP`) |
| `hides.length` + `highlights.length`  | 5000 each                        |
| `views.length`                         | 50                              |
| Pattern subjects                       | 16                              |
| Pattern edge constraints                | 32                              |
| Per-view layout coordinates             | 50000 (matches the node cap)    |

Hard caps are enforced at write time (the entity validator rejects writes that would exceed them; UI grays out the affected actions). Soft caps (warnings) sit at 50% of the hard cap.

## Default views shipped with the app

On first install, the Graph app seeds three views attached to a single seeded `Graph/v1` entity named *"Vault"* (covers the whole vault, no pattern filter):

- *"All entities"* (Full) — `layoutKind: Force`, `clusterByType: true`.
- *"Around me"* (Local) — `rootEntityId: <vault's "Me" identity>`, `depth: 2`. Falls back to the most-recently-edited entity if there's no identity entity.
- *"Path"* (Path) — `fromEntityId: null`, `toEntityId: null`. Disabled until the user picks both endpoints.

These three views are `system: true` and cannot be deleted (matching the Database app's built-in type-Lists per OQ-LD-3). The user can duplicate them to make custom variants.

## Summary

- One `Graph/v1` entity per saved graph; one `GraphView/v1` per rendering. Mirrors `List` / `ListView`.
- `pattern` (multi-subject + multi-edge) lives on the Graph; per-view filter overlays are simple Property-Predicates.
- Pins, hides, highlights are user overrides that survive pattern recomputation.
- Layout coordinates per view; pinning writes back to the Graph for cross-view consistency.
- `links.created_at` already in the schema makes the history-animation feature possible without a data-model change.
- Three system views ship by default; hard caps prevent runaway state.
