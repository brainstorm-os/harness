# Notes — first-party block editor app

The first real first-party Brainstorm app: a Lexical-based block editor demonstrating the full stack (manifest → install → launch → SDK → storage → renderer). Future first-party apps follow the same shape — see [project-level apps roadmap](../../implementation-plan.md).

## What Notes is

A document editor with **block-based content**: each line / element is a self-contained block (paragraph, heading, list, table, image, etc.). Blocks can be selected, moved, copied, and turned-into-each-other. Selection of more than one block is first-class.

A block-protocol-style document editor, with three deliberate improvements over the patterns common in prior block editors:

1. **Proper media inspector** — alt text, focal point, caption, replace, where-used. Prior tools typically expose only a resize handle.
2. **Multiple views per property** — the property block can render the same value as pill, tag, gallery (file kind), etc., chosen per block. Prior tools typically confine this to dataview surfaces.
3. **Dictionary editor** — first-class managed vocabularies for select properties.

## What it composes from

| Layer | Where |
|---|---|
| Shell host | `packages/shell/` — windowing, IPC, capabilities, storage worker |
| SDK | `packages/sdk/` — `window.brainstorm` runtime that this app uses |
| App | `apps/notes/` — manifest, icon, source, built bundle |
| Per-app build | Vite — see [40-app-build.md](40-app-build.md) |

## Doc map

| File | Topic |
|---|---|
| **00-overview.md** | This file. |
| [01-data-model.md](01-data-model.md) | Note entity shape; storage layout; migration path to entities (Stage 9). |
| [10-block-architecture.md](10-block-architecture.md) | Lexical setup, theming, the cell-registry pattern, plugin tree. Read first before any block doc. |
| [20-blocks/text.md](20-blocks/text.md) | Paragraph, headings, lists, quote, callout, code. |
| [20-blocks/table.md](20-blocks/table.md) | Simple tables (Lexical built-ins, not a side-channel mirror approach). |
| [20-blocks/media.md](20-blocks/media.md) | Image / video / audio + inspector. |
| [20-blocks/link.md](20-blocks/link.md) | In-vault entity link. |
| [20-blocks/bookmark.md](20-blocks/bookmark.md) | URL bookmark with OG-preview fetcher. |
| [20-blocks/property-list.md](20-blocks/property-list.md) | Property + property-list blocks. |
| [20-blocks/property-constructor.md](20-blocks/property-constructor.md) | Define / edit a property type. |
| [20-blocks/dictionary-editor.md](20-blocks/dictionary-editor.md) | Manage the enum vocabulary behind a select property. |
| [30-selection.md](30-selection.md) | Single + multi-block selection, drag, keyboard, copy/cut/paste. |
| [31-commands.md](31-commands.md) | Slash-command registry; turn-into / block actions / inserts. |
| [32-keyboard.md](32-keyboard.md) | Every chord, in one sheet. |
| [40-app-build.md](40-app-build.md) | Per-app Vite build pipeline (prerequisite). |

## Cross-cutting prerequisites

- [foundations/39-universal-icons.md](../../foundations/39-universal-icons.md) — every entity / property / dictionary item carries an `Icon`.
- [`@react-fancy-menus/core`](../../implementation-plan.md) — Stage 8. All anchored menus in Notes (slash, action menu, kind picker, etc.) target it on landing; today's interim builds on a hand-rolled positioned panel and migrates per task #36.

## Status

Shipped (public beta v0.1.5): a bundled React + Lexical block editor under `apps/notes/`, on real `entities.db`. The block surfaces continue to fill in across the phases tracked in `docs/implementation-plan.md` Stage 9-13 window.
