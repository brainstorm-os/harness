# Graph — embedding and intents

How the Graph app surfaces in *other* apps (the `embedded-graph` Block-Protocol block) and how it participates in cross-app intent flows.

## The `embedded-graph` block

The Graph app ships a single Block-Protocol block: `io.brainstorm.graph/embedded-graph`. Inserted into a Note (or any other Lexical-hosted surface), it renders a bound `Graph/v1` entity inline. Same shape as the Database app's `embedded-list` block.

### Block manifest

```jsonc
{
  "id": "io.brainstorm.graph/embedded-graph",
  "name": "Embedded graph",
  "providedBy": "io.brainstorm.graph",
  "props": {
    "graphId": { "type": "string", "required": true },
    "viewId":  { "type": "string", "required": false },   // optional: pin to a specific view
    "height":  { "type": "number", "required": false },   // default 480px; min 240
    "interactive": { "type": "boolean", "required": false }  // default true; false locks panning
  }
}
```

### Behavior

- **Read-mostly.** The embedded block doesn't expose the full settings panel — it shows the Graph with the bound view's settings, and a small `Open ⤴` button that dispatches `intent.open` on the Graph entity, launching the standalone Graph window. Power-user edits happen there.
- **Pattern overrides not allowed.** The pattern is whatever's on the bound Graph entity. If the user wants a different shape, they make a new Graph entity. (Same rule the Database app's `embedded-list` follows — the bound List's source is the source of truth.)
- **History animation disabled by default.** The scrubber doesn't render in embedded mode unless `block.props.allowHistory: true` is set. Embedded graphs are usually a visual aid in a Note, not an explorer.
- **Click-through.** Clicking a node in an embedded graph dispatches `intent.open` for that node — same as the standalone app — so the Note's reader can follow the topology into individual entities.

### Slash command

In Notes, the user types `/graph` to insert an embedded graph. The fancy-menus typeahead presents:

1. **From scratch** — opens a small picker (entity types + optional link types) and creates a new Graph entity with the chosen pattern, then inserts the embed.
2. **Pick existing Graph** — typeahead over the user's saved Graphs; insert the embed bound to the choice.

The picker reuses the Database app's `/database` picker shape (per [database/12-embedding-and-intents.md](../database/50-embedding-and-intents.md)) — one slash-command pattern, two providers.

## Intent registrations

The Graph app declares the following intents in its manifest:

```jsonc
"intents": [
  // Open a Graph entity in the standalone window.
  { "verb": "open", "entityType": "brainstorm/Graph/v1", "priority": "primary" },
  { "verb": "open", "entityType": "brainstorm/GraphView/v1", "priority": "primary" },

  // Open *any* entity in the Graph's Local view (root = that entity, depth 2).
  // Lower priority than the entity's primary opener — invoked via "Open with…".
  { "verb": "open", "entityType": "*", "priority": "secondary" },

  // Export a Graph as GraphML / DOT / SVG / PNG.
  { "verb": "export", "entityType": "brainstorm/Graph/v1",
    "formats": ["graphml", "dot", "svg", "png", "json"], "priority": "primary" },

  // Share — emits a vault-portable Graph entity descriptor for "Open with…" on another vault.
  { "verb": "share", "entityType": "brainstorm/Graph/v1", "priority": "primary" }
]
```

### `intent.open` on any entity

The secondary-priority `open: *` registration is what gives the user the "**Open in Graph**" affordance from any entity context menu — pick it, and the Graph app opens a Local view with that entity as the root. This is one of the cross-app affordances that makes the typed-link substrate feel like a single product, not a federation of apps.

### `intent.export` formats

| Format    | Description                                                  |
|-----------|--------------------------------------------------------------|
| `graphml` | GraphML 1.0 XML. Interop with Gephi, yEd, Cytoscape.          |
| `dot`     | Graphviz DOT. Useful for static rendering in CI / docs.       |
| `svg`     | Vector snapshot of the current view, including styling.       |
| `png`     | Raster snapshot. Configurable resolution (1x / 2x / 4x).      |
| `json`    | The pattern + visible node/edge ids in a portable JSON shape. Lossy on layout coordinates but lossless on the topology. |

The exporter runs in a Web Worker so a 50k-node SVG doesn't block the renderer. Output goes through `files.requestSave(...)` (Stage 9.10) for the user to pick a destination.

### `intent.share`

Wraps the Graph entity (and its referenced GraphView entities) in a `application/x-brainstorm-graph+json` envelope. Round-tripable: dropping the envelope on another Brainstorm vault registers the Graph and any referenced typed links if missing. Useful for inter-user sharing in v2 (the share *content* is local-vault-portable today; the *delivery* awaits sync).

## Cross-app navigation

When a Graph node is double-clicked or activated, the app dispatches `intent.open` on the node's entity. Per the [cross-app navigation doc](../../shell/37-cross-app-navigation.md):

- The shell resolves the entity's primary opener (the app whose manifest declares `priority: "primary"` for that entity type).
- That app's window is focused (or launched if not running) and the entity is opened in it.
- The Graph app stays open in the background; switching back returns to the same selection.

The "**Open with…**" submenu lets the user route to a non-primary opener. For an entity that has both a primary opener (e.g. Notes) and the Graph app as a secondary opener (via the `open: *` registration), the menu offers both — clicking "Open in Graph" creates a *temporary* Local view of that entity (rooted on it, depth 2, force layout). Closing the temporary view discards it; "Save view" on it persists it as a `GraphView/v1`.

## Inverse: opening a Graph from a Note

Conversely, when a user has a Note open and clicks an `embedded-graph` block's `Open ⤴`, the Graph app's primary-opener handler launches with `LaunchContext = { entityId: graphId, openInWindow: "new" }`. The new Graph window opens to the bound view (or the Graph's `defaultViewId`).

## Capability surface

The intents declare these caps in the manifest:

```jsonc
"capabilities": [
  "storage.kv",
  "entities.read:brainstorm/Graph/v1",
  "entities.write:brainstorm/Graph/v1",
  "entities.read:brainstorm/GraphView/v1",
  "entities.write:brainstorm/GraphView/v1",
  // The pattern compiler needs read across types — same broad rule as Database.
  "entities.read:*",
  // For inline edits in the inspector panel + drag-to-link.
  "entities.write:*",
  // For dispatched intents and the embedded-graph block.
  "intents.dispatch:open",
  "intents.dispatch:share",
  "intents.dispatch:export",
  "blocks.provide:io.brainstorm.graph/embedded-graph",
  // For SVG/PNG/JSON export.
  "files.write"
]
```

`files.write` is new compared to the Database app — Graph's PNG/SVG export writes a user-chosen file. The capability is *requested at install*; the per-grant prompt explains "the Graph app can export images of graphs to files you choose" (per [05b §Capability prompt](../../implementation-plan.md#stage-5b)).

## Create flow

A "+" affordance on the canvas opens a fancy-menus popover:

1. **+ New entity** — type picker; the picked type's primary opener handles the create flow (per [database/40-create-flow.md](../database/40-create-flow.md)). When the create flow finishes, the new entity is added to the visible graph (linked via no edges yet — the user can drag to create them).
2. **+ Link two selected nodes** — only enabled when exactly 2 nodes are selected. Opens a link-type picker filtered by compatibility (source-type → dest-type per the BP type system). Creates the link via `entities.write`.
3. **+ New subject** — adds a subject to the *pattern* rather than creating data. Useful for iteratively building a pattern.

Subject-inherited types apply: when "+ New entity" is invoked while a subject is selected in the pattern editor, the created entity's type is pre-set to the subject's allowed types (single value if the subject names exactly one type; otherwise a picker).

## Summary

- One block: `embedded-graph`, parameterized by `graphId` (+ optional view, height, interactivity).
- Intents: `open` (primary on `Graph/v1`, `GraphView/v1`; secondary on `*`), `export` (5 formats), `share`.
- "Open in Graph" affordance on any entity via the secondary `open: *` registration.
- Cross-app navigation routes through the shell's primary-opener resolver; the Graph app is the home of the typed-link experience but participates politely with other apps.
- Capability surface mirrors the Database app + adds `files.write` for export.
- Inline create flow on the canvas dispatches the same `intent.create` flow the Database app uses; subject types pre-fill.
