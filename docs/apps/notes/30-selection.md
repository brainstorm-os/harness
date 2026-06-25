# Block selection

Two selection modes, both first-class:

| Mode | What it covers | Owns |
|---|---|---|
| **Inline** | Caret + text range inside a block | Lexical default |
| **Block** | One or more whole blocks selected as units | `BlockSelectionPlugin` (Brainstorm) |

The architectural reference is the conventional `BlockSelectionPlugin` pattern from prior block editors. Porting **the pattern**, not any particular implementation: Yjs awareness + the shortcut registry replace MobX + raw keyboard listeners.

## Block selection state

```ts
type BlockSelection = {
  rootId: string;            // which note
  anchorKey: string;         // first selected (or "pivot" for shift-extend)
  selectedKeys: ReadonlySet<string>;  // every selected node key
};
```

Held in the editor instance (not React state) and exposed via:

- `useBlockSelection()` — React hook returning the current set (used by gutter / action menu / copy-paste).
- A class-toggle effect on `editor.getElementByKey(key)` — direct DOM `.classList.add("notes__block--selected")`. Avoids React re-rendering 50 sibling blocks on a marquee drag.

## Entering block selection

| Gesture | Effect |
|---|---|
| Click outside any block's text (the gutter margin, the padding around a block) | Select that block; clear text selection. |
| `Cmd+A` while a block has caret focus | First press: select the block. Second press: select all blocks. |
| `Esc` while text-editing | Collapse text selection; select the containing block. |
| `Cmd+Click` on a block | Toggle that block into/out of the selection. |
| `Shift+Click` on a block | Range-select from `anchorKey` through the clicked block (uses DOM order). |
| **Marquee drag** | Mousedown on the gutter (not inside a block) → start rectangle drag → release: every intersected block is selected. |

## Marquee drag specifics

Conventional intersection logic. Brainstorm version:

```ts
const DRAG_THRESHOLD_PX = 8;
const INTERSECTION_THROTTLE_MS = 16;
const AUTO_SCROLL_ZONE_PX = 40;
const AUTO_SCROLL_SPEED_PX = 16;

// On mousedown over the scroll container (not a block):
//  1. Capture initial point.
//  2. If movement > DRAG_THRESHOLD_PX → enter marquee mode, render <div class="marquee" />.
//  3. On each throttled mousemove:
//      a. Compute selRect.
//      b. For each cached block rect → rectsIntersect → collect keys.
//      c. blockSelection.setKeys(keys).
//  4. If pointer is within AUTO_SCROLL_ZONE_PX of container edge → rAF tick scrolling.
//  5. On mouseup → finalize selection; remove marquee; release.
```

**Block-rect cache** is rebuilt via `IntersectionObserver` (not a per-mousemove DOM walk). Observer fires once per layout change; cache is read-only during a drag.

## Auto-scroll

Container scrolls up/down while marquee drag is within `AUTO_SCROLL_ZONE_PX` of the edge. `requestAnimationFrame` loop, cancelled on mouseup or pointer leaving the zone. Cursor / marquee follow.

## Keyboard navigation

All chords routed through `useShortcut` (per the CLAUDE.md rule — no raw `e.key`):

| Chord | Action |
|---|---|
| `Arrow Up/Down` while a block is selected (no text caret) | Move selection to the previous/next block. With `Shift`, extend. |
| `Cmd+Up/Cmd+Down` | Jump to top/bottom block. |
| `Cmd+A` | See above. |
| `Cmd+C` / `Cmd+X` | Copy / cut the selected blocks. Lexical's clipboard helpers + our block-serializer. |
| `Cmd+V` | Paste blocks (or text — Lexical figures out which). |
| `Cmd+D` | Duplicate selected blocks below. |
| `Backspace` / `Delete` | Delete selected blocks; caret lands on the previous block's tail. |
| `Tab` / `Shift+Tab` | Indent / outdent (for list items; no-op otherwise). |
| `Cmd+Shift+Up/Down` | Move selected blocks up / down. |
| `Esc` | Clear block selection; caret returns to last text position. |

## Drag-and-drop reorder

Separate plugin: `DragHandlePlugin`. Custom mouse events (not HTML5 DnD — unreliable in Electron's WKWebView/Chromium under some platforms).

- Grip icon in the gutter, visible on row hover.
- **Click vs. drag** distinguished by 5 px movement threshold.
- On drag: a horizontal target line indicates the drop position. Multi-block drag: if the dragged block is in `selectedKeys`, all selected blocks travel together (in DOM order).
- Dropping over the gutter "+" of another block: drops INSIDE (becomes child) — applies only to `callout` / `toggle` / list-item containers.

## Clipboard format

Three MIME types on copy, identical to Lexical's pattern:

| MIME | Payload |
|---|---|
| `text/plain` | Plain-text concatenation of selected blocks. |
| `text/html` | Lexical HTML serialization — preserves text formatting; non-text blocks fallback to their `getTextContent()`. |
| `application/x-brainstorm-blocks` | Brainstorm-specific JSON: `{ version: 1, blocks: SerializedBlock[] }`. Round-trips structure with full fidelity. |

Paste: prefer `application/x-brainstorm-blocks`, fall back to `text/html`, then `text/plain`. Same prefer order as Lexical itself.

## Selection ↔ command system

The slash command menu, block action menu, and floating toolbar all need to know "what's selected" — they bind to `useBlockSelection()`. When `selectedKeys.size > 1`, transforms apply to all (e.g. "Turn into → Bullet list" converts every selected block).

## Anti-patterns we deliberately avoid

(Selection-specific.)

- **MobX**. Use Yjs awareness / vanilla observer + the existing class-toggle pattern. No reactive store dep.
- **Module-level singletons** like `dragOverlay`. Instance refs.
- **DOM-walking on `mousemove`**. `IntersectionObserver` for rect cache.
- **Raw `document.addEventListener("keydown")`**. `useShortcut` registry.

## Accessibility

- Selected blocks get `aria-selected="true"`.
- The marquee overlay is `aria-hidden="true"` (visual only).
- Keyboard equivalents for every mouse gesture (arrow nav, shift-extend, cmd-A).
- Screen-reader announcement on selection change via a live region: "3 blocks selected."

## Tasks

- T-sel-1: ✓ DONE — `BlockSelection` state model + hook. Lives in `apps/notes/src/editor/block-selection-store.ts` (vanilla pub-sub, snapshot-stable via `Object.freeze`) and `block-selection-plugin.tsx` (`useBlockSelection()` via `useSyncExternalStore`). Snapshot exposes `{anchorKey, focusKey, selectedKeys}`.
- T-sel-2: ✓ DONE — Click / shift-click / cmd-click handlers in `BlockSelectionPlugin` (`apps/notes/src/editor/block-selection-plugin.tsx`). Capture-phase document listener; uses Lexical's `$getNearestNodeFromDOMNode` → `getTopLevelElementOrThrow`. DOM class + `aria-selected` toggled via `editor.getElementByKey` to avoid re-rendering siblings.
- T-sel-3: Marquee drag with `IntersectionObserver` rect cache.
- T-sel-4: Auto-scroll.
- T-sel-5: ⚠️ PARTIAL — Esc + arrow walk + shift+arrow extend + Cmd+ArrowUp/Down jump + Cmd+A cycle (caret-block → all) + Backspace/Delete (with caret rest at prev sibling's end). All routed through `apps/notes/src/keyboard/{action-ids,default-chords,use-shortcut}.ts` (capture-phase listener so we beat Lexical's command handlers). Esc additionally calls `editor.focus()` so the caret resumes inline editing immediately. **Pending**: Cmd+Shift+ArrowUp/Down (move blocks) and Cmd+D (duplicate) — both need deep-clone / node-reorder helpers.
- T-sel-6: Clipboard read/write (three MIMEs).
- T-sel-7: Drag-handle plugin (separate).
- T-sel-8: ✓ DONE — Live-region a11y announcement. `BlockSelectionLiveRegion` renders a visually-hidden `role="status" aria-live="polite" aria-atomic="true"` div inside `BlockSelectionPlugin`; subscribes to the store, debounces text changes 150ms so rapid Shift+Arrow extensions coalesce into a single announcement. Strings ("N blocks selected") route through the notes-app `t()` / `tCount()` helper (`apps/notes/src/i18n/t.ts`) so they're translatable when the locale layer lands (Stage 12). The `.notes__sr-only` class uses the standard clip-rect-0 pattern.
