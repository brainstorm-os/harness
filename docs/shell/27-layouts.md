# 27 — Layouts

This doc covers how an entity is **visually presented** when displayed — what fields appear where, what's emphasized, what's grouped, whether the form is freeform-spatial or list-stacked. Prior tools have a chronic problem here: layouts are strictly positioned and styled, hardcoded by the app authors; users can't shape how their content looks. Brainstorm's answer is **layouts as data**, with a spectrum from rigid template to freeform whiteboard, scoped per-entity / per-type / per-collection / per-user / per-org under the same overlay model as properties (per [19-properties-and-schemas.md](../data/19-properties-and-schemas.md)).

This is an exploratory doc — flagged as "an idea, needs deeper thinking" — so design decisions here are weight-of-leaning, not locked-in.

It builds on [03-app-model.md](../apps/03-app-model.md) (apps register), [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) (block embedding), [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md) (the BlockEmbedNode bridge), [19-properties-and-schemas.md](../data/19-properties-and-schemas.md) (the scope model layouts mirror).

## What went wrong in prior tools

Layout decisions were baked into app/shell code. A document had **structural chrome the user couldn't move or replace**:

- A **cover block** at the top, fixed in position.
- A **title block** below it, fixed in position.
- An **icon** in a fixed slot.
- **Floating action controls** that repositioned themselves based on document alignment and other implicit state — not under user control.
- A **content area** in the only place a content area could go.

You couldn't move the action buttons elsewhere. You couldn't get rid of the cover. You couldn't put the icon to the side instead of above. The chrome was the chrome and that was that.

The deeper issue: **everything structural was hardcoded.** Schema's display hints alone aren't enough; the actual *layout* of structural elements (cover, title, icon, action bar, breadcrumb, meta info, content) needed to be data, not code.

A second issue (related): apps couldn't visually differentiate their entity types. A Task and a Person and a Company shared the same page-shaped chrome. Different per-type visual treatment was a downstream consequence of the chrome being hardcoded.

Brainstorm's response: **layouts own everything that renders, including the chrome**. Cover, title, icon, action bar, breadcrumb, meta — every structural element is a layout cell. Apps and users can reposition, replace, or omit any of them.

> A typical prior-art block editor is the canonical example for the reasoning, not a prescription. Brainstorm doesn't copy its layout; it makes the principle ("everything is a layout cell") the default for any entity-rendering surface.

The deeper architectural move: **layout ≠ schema.** Schema declares *what* an entity has; layout declares *how — and where, including the chrome — it's presented*.

## Goals

1. Layouts are **data**, not code. Editable, syncable, scopeable.
2. The same entity can have **different layouts in different contexts** — a card in the launcher, a full page in the editor, a row in a database, a freeform sticky on a whiteboard.
3. App authors ship sensible defaults; users override at any scope level (matching the [Personal-by-default principle](../foundations/01-vision.md)).
4. The model spans from **rigid template** (form-like, accessibility-strong) to **freeform whiteboard** (spatial, expressive). Both are first-class.
5. Performance stays tractable — even freeform layouts render within frame budget.
6. Accessibility is preserved — every layout has a *linear reading order* fallback used by screen readers and keyboard-only navigation.

## Layouts as entities

A **Layout** is a first-class entity (`brainstorm/Layout/v1`):

```jsonc
{
  "id": "ent_layout_person_card",
  "type": "brainstorm/Layout/v1",
  "properties": {
    "name": "Person card",
    "scope": { "kind": "type", "target": "io.example/Person/v1" },
    "context": "card",                          // card | full | row | whiteboard | grid
    "mode": "stacked",                          // stacked | grid | freeform
    "cells": [
      {
        "id": "header",
        "kind": "property",
        "property": "name",
        "display": { "view": "block", "size": "lg" }
      },
      {
        "id": "avatar",
        "kind": "property",
        "property": "avatar",
        "display": { "view": "thumbnail", "size": "md" }
      },
      {
        "id": "contact",
        "kind": "group",
        "label": "Contact",
        "cells": [
          { "kind": "property", "property": "email" },
          { "kind": "property", "property": "phones" }
        ]
      },
      {
        "id": "notes-block",
        "kind": "block",
        "blockId": "io.example.notes/recent-notes",
        "params": { "linkedTo": "$entity" }
      }
    ],
    "readingOrder": ["header", "avatar", "contact", "notes-block"]
  }
}
```

Layouts are entities, so they:
- Sync across the user's devices via Yjs.
- Are scopeable (per-entity, per-type, per-collection, per-user, per-org) using the same machinery as PropertySchema.
- Can be edited collaboratively.
- Support undo/history.
- Are encrypted at rest like everything else.

> **Decision:** layouts use the same scope model as PropertySchema. Default scope when a user creates a layout: `user`. Promotable to `org` for shared brand layouts. Personal-by-default per [01-vision.md](../foundations/01-vision.md) Principle 9.

## Layout structure

A layout is a tree of **cells**. Six cell kinds:

| Cell kind     | Renders                                                     | Notes                                                  |
|---------------|-------------------------------------------------------------|--------------------------------------------------------|
| `property`    | A property value, formatted via the property's display options | The base case. References the entity's effective schema. |
| `block`       | A Block Protocol block embed                                  | Drives composition; same model as [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md). |
| `chrome`      | A shell-rendered structural element (action bar, breadcrumb, meta, window controls, etc.) | Replaces hardcoded chrome — see "Chrome cells" below. |
| `group`       | A logical grouping of child cells (with optional label/icon) | Visually expressed as a section, card, fieldset, or freeform cluster, depending on `mode`. |
| `text`        | Literal text (heading, helper text, caption)                 | Translatable per [21-localization.md](../platform/21-localization.md). Apps register `textKey`; users use literal `text`. |
| `divider`     | Visual divider                                                | Stylistic; does not affect reading order.              |

Each cell has:
- An `id` (stable across edits; used in `readingOrder`).
- A `kind`.
- Layout-mode-specific positioning (see below).
- Optional `display` overrides for property cells (override the property's default `display` from PropertySchema).
- Optional `condition` (show this cell only when … — e.g. `{ $exists: "phones" }` to hide an empty phone group).

> **Decision:** layouts cannot fundamentally change *what* an entity is — they cannot add or remove properties, only choose which to render and how. Schema is owned by [19-properties-and-schemas.md](../data/19-properties-and-schemas.md); layout is presentation.

## Chrome cells (shell-rendered structural elements)

Layouts include the chrome — the structural elements that traditionally are hardcoded around content. The `chrome` cell kind references shell-provided rendered elements by name; the shell knows how to draw each. Layouts decide where they go, whether to include them, and what their display options are.

The canonical chrome kinds:

| `chrome.kind`        | Renders                                                              |
|----------------------|----------------------------------------------------------------------|
| `actionBar`          | The standard row of action buttons for the entity (Open / Share / More / app-registered intent buttons). |
| `breadcrumb`         | Hierarchical navigation back to parent (collection / space / org).    |
| `meta`               | Standardized metadata: created / modified / author / source app.       |
| `windowControls`     | Close / minimize / maximize controls (when the app uses custom chrome rather than native — see OQ-5). |
| `entityHeader`       | A composite default header (icon + title + action bar) for use when the layout author wants the conventional shape without composing it themselves. |
| `tabs`               | Per-window tab strip when the layout has multiple panes.               |

```jsonc
{
  "kind": "chrome",
  "chrome": "actionBar",
  "options": { "alignment": "end", "buttons": ["open", "share", "more"] }
}
```

> **Decision:** the shell renders **no fixed chrome** outside of the layout system. Every structural element a user sees around an entity is a layout cell. If a layout omits `actionBar`, there is no action bar.

> **Decision:** shell-rendered chrome cells use the active theme's tokens and `fancy-menus` for any menu surfaces (More button, etc.). They are not customizable in their internals — apps that want different action-button rendering use a `block` cell instead.

> **Open:** what is the canonical set of chrome kinds? `actionBar`, `breadcrumb`, `meta`, `windowControls`, `entityHeader`, `tabs` is a starting set; we'll likely grow it. Should the set be open (apps register chrome kinds) or curated (shell-defined only)? Tracked as OQ-90.

## A worked example: a document with explicit chrome

A typical prior-art editor hardcodes cover + icon + title + content + floating action bar. In Brainstorm the same shape is composed:

```jsonc
{
  "type": "brainstorm/Layout/v1",
  "properties": {
    "name": "Document with cover",
    "scope": { "kind": "type", "target": "io.example.editor/Document/v1" },
    "context": "full",
    "mode": "stacked",
    "cells": [
      { "id": "breadcrumb", "kind": "chrome", "chrome": "breadcrumb" },
      { "id": "cover",      "kind": "property", "property": "cover",
        "display": { "view": "banner", "size": "lg" } },
      { "id": "header",
        "kind": "group",
        "mode": "grid",
        "cells": [
          { "id": "icon",  "kind": "property", "property": "icon",
            "display": { "view": "icon", "size": "lg" },
            "position": { "col": 1, "row": 1 } },
          { "id": "title", "kind": "property", "property": "title",
            "display": { "view": "block", "size": "xl" },
            "position": { "col": 2, "row": 1, "colSpan": 2 } },
          { "id": "actions", "kind": "chrome", "chrome": "actionBar",
            "position": { "col": 4, "row": 1 },
            "options": { "alignment": "end" } }
        ]
      },
      { "id": "body", "kind": "property", "property": "body",
        "display": { "view": "block" } },
      { "id": "meta", "kind": "chrome", "chrome": "meta",
        "options": { "fields": ["createdAt", "modifiedAt"] } }
    ],
    "readingOrder": ["breadcrumb", "cover", "icon", "title", "actions", "body", "meta"]
  }
}
```

Things this layout makes possible that prior-art hardcoding made impossible:

- The user moves `actions` from inside the header to a footer slot (`readingOrder` updates accordingly).
- The user removes `cover` entirely for a cleaner view.
- The user replaces `icon` with a different display option (avatar instead of emoji, say) by editing one cell's `display`.
- An app author ships a "minimal" variant layout that omits cover and breadcrumb.
- A user creates a per-collection layout (scope `collection`) where their "Drafts" Documents render without a cover and "Published" Documents render with one.

None of this is special-cased. It all falls out of treating chrome as layout cells.

## Layout modes (the spectrum)

> **Decision:** three layout modes span the design space. The same layout entity declares one `mode` (mixed mode is not allowed at the top level — but a `group` cell can declare its own internal mode for nested composition).

### `stacked`

Cells render in vertical reading order. The simplest, most form-like, most accessibility-friendly mode. The default for new layouts.

- Cell positioning is just *order in the cells array*.
- Spacing is design-token driven (no per-cell pixel positioning).
- Used for: the canonical "page" of an entity, settings panels, mobile-friendly views.

### `grid`

Cells render in a fixed-column grid. More structured than stacked; less freeform than whiteboard.

- Cell positioning: each cell declares `{ col, row, colSpan, rowSpan }`.
- Reflowable: on narrow viewports, the grid collapses to stacked.
- Used for: dashboard cards, kanban-card layouts, "preview" contexts where you want a dense overview.

### `freeform`

Cells render at user-positioned coordinates on an infinite canvas. The whiteboard mode the user described.

- Cell positioning: each cell declares `{ x, y, width, height, rotation? }` in canvas units.
- Pan / zoom supported.
- Used for: spatial thinking, mind-mapping, distinguishing entity types visually (a Task, a Person, a Company can each be styled differently and arranged spatially).

> **Open:** are layout-mode rules **per-context** (e.g. the `whiteboard` context always uses `freeform`; the `row` context always uses `stacked`)? Or are they free per layout? Tracked as OQ-85.

> **Decision:** `freeform` mode requires an explicit accessibility fallback — the `readingOrder` field at the top of the layout entity. Screen readers and keyboard navigation use this order; spatial arrangement is purely visual.

## Layout contexts

Brainstorm distinguishes **contexts** in which an entity might be rendered:

| Context     | Where                                                                        |
|-------------|------------------------------------------------------------------------------|
| `full`      | A dedicated window or tab dedicated to one entity.                            |
| `card`      | An entity rendered as a self-contained card (in a board, gallery, search result). |
| `row`       | An entity in a tabular view (database).                                       |
| `chip`      | An entity rendered inline (an @-mention, a tag).                              |
| `preview`   | A hover-card or quick-look popover.                                           |
| `whiteboard`| An entity placed on a freeform canvas.                                        |
| `print`     | The print/PDF-export view (per [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md)). |

Each context can have a different active layout. The Layout entity declares its `context`. The shell's resolver picks the highest-priority layout for a given `(entity, context)` pair.

> **Decision:** an entity's full-context layout, card-context layout, etc. are **separate Layout entities**. They can be edited independently. A user can customize the card view of their Tasks without affecting the full-page view.

## Resolution

When the shell needs to render entity `E` in context `C`:

1. Look up Layout entities whose scope matches `E` and whose `context == C` (or `context == null` meaning "any context").
2. Apply the same layered scope precedence as PropertySchema: `entity` > `collection` > `type` > `user` > `org` > app-shipped default > shell fallback.
3. Most specific match wins; ties broken by most-recent-modified.

```
   render(entity E, context C):
     candidates = layouts matching scope(E) AND (context == C OR context == null)
     winner = candidate with highest scope precedence
     if no winner:
       fallback = app-default-layout(typeOf(E), C)
       if no fallback:
         winner = shell-fallback-layout(C)   // schema-driven generic render
     return mountLayout(winner, E)
```

The fallback chain ensures **every entity renders something** in every context, even when no app or user has authored a layout — same fallback-renderer principle as elsewhere.

> **Decision:** layout resolution is **per render**, not cached at the entity level. An entity that gains an applicable layout (because the user just created one with `type` scope) re-renders on next observation, no migration needed.

## App-shipped defaults

Apps ship default Layout entities for their types and the contexts they care about. These live in the app's manifest under `layouts:`:

```jsonc
"layouts": [
  { "type": "io.example/Person/v1", "context": "full",       "config": { /* layout cells */ } },
  { "type": "io.example/Person/v1", "context": "card",       "config": { /* layout cells */ } },
  { "type": "io.example/Person/v1", "context": "row",        "config": { /* layout cells */ } },
  { "type": "io.example/Task/v1",   "context": "full",       "config": { /* ... */ } }
]
```

On install, the shell creates Layout entities from the manifest at app-default scope (a special scope distinct from user/org). User overrides layer above; user can freely revert to app default.

> **Decision:** an app cannot ship a layout for a type it doesn't introduce. (`io.example.notes` cannot ship a default layout for `io.example.tasks/Task/v1`.) Cross-type layouts are user-created.

## Layout editors

A **layout editor** is an app that produces and modifies Layout entities. The shell ships at least one (probably two):

- **Form designer** — for `stacked` and `grid` layouts. WYSIWYG with drag-to-reorder, group nesting, conditional visibility editor.
- **Whiteboard designer** — for `freeform` layouts. Spatial canvas, pan/zoom, drag entities and cells onto the canvas.

Layout editors are *just apps*. They use the SDK like any other app. Multiple competing editors can exist; the user picks. The shell's role is to display whichever Layout the resolution picks; it does not own the editing experience.

> **Decision:** the shell does **not** ship a "settings panel" for layouts beyond a switcher (pick a layout for this type/context). Real layout editing is the editor app's domain.

> **Open:** in `freeform` layouts, can cells overlap arbitrarily? Performance and selection semantics get tricky. Tentative: yes, with z-ordering. Tracked as OQ-86.

## Render pipeline

The shell's layout resolver returns a Layout. The shell then mounts it:

1. **Cell tree walk** — for each cell:
   - `property` cell → resolve the property via the entities service, format with display options, render.
   - `block` cell → mount via the BlockEmbedNode iframe path (per [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md)).
   - `chrome` cell → render the shell's built-in component for the named chrome kind, parameterised by `options`.
   - `group` cell → render container, recurse into children.
   - `text` cell → resolve translation if `textKey`, render.
   - `divider` cell → render styling element.
2. **Mode-specific positioning**:
   - `stacked`: vertical flex/grid.
   - `grid`: CSS Grid with declared spans.
   - `freeform`: absolute positioning on a `<canvas>`-shaped container with virtualization for off-screen cells.
3. **Reactivity** — cells subscribe to their bound properties; updates re-render only that cell, not the whole layout.

> **Decision:** cells are virtualized in `freeform` mode (only on-screen cells render). At ~10k cells the rest hide; pan/zoom recalculates visible set.

## Performance

| Metric                                                | Target                |
|-------------------------------------------------------|-----------------------|
| Layout resolution + first paint (typical entity)      | <50ms                 |
| `freeform` canvas with 1000 cells, 60fps pan/zoom     | yes (with virtualization) |
| Layout edit → re-render                                | <16ms                 |
| Layout entity sync to a peer device                    | <500ms (good network) |

The freeform mode is the perf-stress mode. Without virtualization, 1000 cells × 60fps is unworkable. With virtualization (only render on-screen + a buffer), it's tractable.

## Accessibility

Every layout, regardless of mode, has a **`readingOrder`** array — an ordered list of cell ids for screen readers and keyboard navigation.

- For `stacked` mode, `readingOrder` is the same as the cells array (auto-derived).
- For `grid` mode, `readingOrder` defaults to row-major (top-to-bottom, left-to-right) and can be overridden.
- For `freeform` mode, `readingOrder` is **mandatory** — without it the layout is non-accessible and the layout editor warns.

Keyboard navigation respects `readingOrder` for `Tab` traversal. Selection, copy/paste, and search match the linear order.

> **Decision:** layout entities without a valid `readingOrder` (in modes that require one) fail validation. The layout editor surfaces this as a hard error before save.

## Storage

A Layout is one Yjs doc per the canonical entity model. The cell tree is a `Y.Array` of cell records (themselves `Y.Map`s); positioning and content are CRDT-merged.

> **Decision:** concurrent edits to the same Layout are CRDT-merged like any entity. Two users dragging the same cell at the same time converge to a single position (last-writer-wins on `x`/`y`).

## Phasing

> **Decision:** v1 ships `stacked` and `grid` modes with the form-designer app, app-shipped defaults, scope-layered resolution, accessible reading order. **v2** adds `freeform` mode and the whiteboard-designer app.

| Capability                                       | v1   | v2  |
|--------------------------------------------------|------|-----|
| Layout as entity (`brainstorm/Layout/v1`)        | ✓    | ✓   |
| `stacked` mode                                   | ✓    | ✓   |
| `grid` mode                                      | ✓    | ✓   |
| `freeform` mode                                  | —    | ✓   |
| App-shipped default layouts                      | ✓    | ✓   |
| User overrides (entity / type / user scopes)     | ✓    | ✓   |
| Collection / org scopes                          | post-collection-design / v2 | ✓ |
| Form-designer app                                | ✓    | ✓   |
| Whiteboard-designer app                          | —    | ✓   |
| Per-context layout (full / card / row / preview) | ✓    | ✓   |
| `whiteboard` context                              | —    | ✓   |
| Cell virtualization for `freeform`                | —    | ✓   |
| Reading-order validation                          | ✓    | ✓   |

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-85** — Layout-mode rules per context (e.g. `whiteboard` context forces `freeform`)?
- **OQ-86** — Cell overlap rules in `freeform` mode (z-ordering, selection semantics).
- **OQ-87** — Can a Layout entity reference computed/derived properties for its display, or only stored properties?
- **OQ-88** — Cross-app layout: can a Layout's `block` cell point at a block from any installed app, with capability gating, or only the originating app's blocks?
- **OQ-89** — Layout templates as a marketplace category — users share their Person-card layout? (extends [14-app-store.md](../apps/14-app-store.md)).
- **OQ-90** — Canonical chrome-cell set: which `chrome.kind` values does the shell ship? Open or curated registry?

## Summary

- **Layouts are entities** (`brainstorm/Layout/v1`) — editable, syncable, scopeable, encrypted like everything else.
- **Layout ≠ schema.** Schema declares *what* an entity has; layout declares *how* it's presented.
- **The layout owns the chrome too.** Cover, title, icon, action bar, breadcrumb, meta — every structural element around content is a layout cell. The shell renders *nothing fixed* outside the layout system. This is the deeper response to the hardcoded-chrome problem in prior tools.
- **Six cell kinds**: `property`, `block`, `chrome` (shell-rendered structural elements), `group`, `text`, `divider`.
- **Three modes**: `stacked` (form-like, accessibility-strong, default), `grid` (structured, dense), `freeform` (whiteboard, spatial). Pick per-layout.
- **Per-context layouts**: `full`, `card`, `row`, `chip`, `preview`, `whiteboard`, `print` — the same entity can render differently in each.
- **Scope model**: same as PropertySchema (`entity` / `type` / `collection` / `user` / `org`). Personal-by-default. App-shipped layouts as the lowest-priority layer.
- **Layout editors are apps**, not shell features. Form-designer ships in v1; whiteboard-designer in v2.
- **Accessibility-first**: every layout has a linear `readingOrder`; `freeform` requires it explicitly.
- **Performance**: `stacked` / `grid` are cheap; `freeform` virtualizes off-screen cells.
- v1 = `stacked` + `grid` + form-designer + chrome cells + app defaults + user overrides; v2 = `freeform` + whiteboard-designer + collection / org scopes.
