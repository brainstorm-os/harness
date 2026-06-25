# 61 — Keyboard accessibility

Brainstorm is keyboard-first ([13-frontend-stack.md §Accessibility](13-frontend-stack.md)) but until now only **shortcuts** were given a designed substrate ([24-keyboard-shortcuts.md](24-keyboard-shortcuts.md)). This doc covers the other half: **the whole UI is reachable, operable, and orientable from the keyboard alone** — Tab order, arrow-key composite navigation, focus traps, focus restoration, visible focus, and the screen-reader scaffolding that pairs with all of it.

Shortcuts ≠ keyboard accessibility. A shortcut is an accelerator for an action that must already be reachable by some other path ([24 §Accessibility](24-keyboard-shortcuts.md#accessibility)). This doc defines that "other path".

Companions: [13 §Accessibility and keyboard handling](13-frontend-stack.md), [24 keyboard shortcuts](24-keyboard-shortcuts.md), [36 design system §Focus](36-design-system.md). Lands as the **`KBN`** ladder in [implementation-plan.md](../implementation-plan.md), gated on `8.8` (`@react-fancy-menus/core`) for the menu half and on `8.9` (`react-aria` non-menu primitives) for the primitive half — both currently 🟢 post-v1, so this ladder ships its own thin in-tree primitives in v1 and swaps at 8.8 / 8.9, matching the precedent of `6.9` cheatsheet / `B9.1b-ui` find-bar per [[feedback_avoid_blocking_on_deps]].

## Goals

1. **No mouse-only path anywhere.** Every action, every disclosure, every selection that a mouse user can perform has a keyboard equivalent.
2. **Predictable conventions across surfaces.** Tab moves between focusable groups, arrows move within a composite, Escape unwinds the topmost overlay, Enter activates the primary action, Space toggles state. Same in every app.
3. **Focus is always visible** when the user is on the keyboard — and **suppressed** when the user is on the mouse (`:focus-visible`).
4. **Focus does not get lost.** Closing a popover / dialog / overlay restores focus to its opener. Removing the focused element moves focus to a sensible neighbour, never to `<body>`.
5. **Screen readers get the same model the eye gets.** Composite widgets announce role, position, and state; dynamic regions announce updates via `aria-live`; shortcut hints land via `aria-keyshortcuts` (already auto-stamped by `<Button shortcutId>` per [24 §Discoverability](24-keyboard-shortcuts.md#discoverability)).
6. **One shared substrate, not per-app implementations.** A composite-listbox hook in `@brainstorm/sdk/a11y` is consumed by every list-shaped surface; apps that hand-roll their own keyboard model are rejected at review.

## What is in scope here vs in [24](24-keyboard-shortcuts.md)

| Concern                                                  | Owned by    |
|----------------------------------------------------------|-------------|
| System chord (`⌘ Space`, `⌘ Shift K`, `⌘ ,`)             | [24](24-keyboard-shortcuts.md) |
| App-declared chord (manifest `shortcuts: [...]`)         | [24](24-keyboard-shortcuts.md) |
| User rebinding UI + cheatsheet                           | [24](24-keyboard-shortcuts.md) |
| `aria-keyshortcuts` auto-stamp on `<Button shortcutId>`  | [24](24-keyboard-shortcuts.md) |
| Tab order across regions                                 | **here** |
| Arrow-key navigation inside a composite (list, grid, tree, tablist, toolbar, radiogroup) | **here** |
| Roving `tabindex` / `aria-activedescendant`              | **here** |
| Focus trap inside dialogs, popovers, overlays            | **here** |
| Focus restoration on close                               | **here** |
| Visible-focus rule (`:focus-visible`) + the focus ring token | **here** |
| `Escape` behaviour (close topmost overlay; bubble if none) | **here** |
| `Enter` / `Space` semantics on rows, buttons, toggles    | **here** |
| Live-region announcements for transient state            | **here** |
| Skip-to-content / region-jump (`F6`) between major panes | **here** |
| Screen-reader landmark roles                             | **here** |

> **Decision:** chord vs context-key boundary — anything that is a **single bare key inside the focused composite** (Tab / Shift+Tab, Arrow*, Home / End / PageUp / PageDown, Enter / Space, Escape, F6) is owned here and is **not** registered in the shortcut registry. Anything else — modifier chords, action verbs reachable from anywhere in the app — is a chord and lives in [24](24-keyboard-shortcuts.md). The cheatsheet shows chords; this doc's keys are documented in-context (tooltips, help, design-system docs).

## Two layers of substrate

### Menu layer — `@react-fancy-menus/core`

Menus (launcher, context, intent, app, tray, in-app) have a designed keyboard model — typeahead, arrows, sub-menu open/close, type-to-jump, group dividers — owned by `fancy-menus`. Per [13 §Menus](13-frontend-stack.md#menus): "What it gives us out of the box: declarative config, Floating UI positioning, virtualization, drag-reorder, sub-menu stacking, **keyboard navigation**, persistence, theming."

Until `8.8` lands, every menu surface in the shell ships a plain-DOM body with the keyboard contract sketched in this doc's §Composite-listbox section (the launcher / cheatsheet / context-menu sites already do this). `8.8` is a swap at the body component — the shortcut chords ([24](24-keyboard-shortcuts.md)) and the chrome (`Popover`) stay unchanged.

### Non-menu primitive layer — `react-aria` (and pre-`8.9` in-tree primitives)

`react-aria` owns: dialog focus traps, listbox / combobox / option arrow navigation, tablist arrow navigation, radiogroup arrow navigation, toolbar arrow navigation, slider keyboard, datepicker keyboard, tooltip focus / hover parity, treegrid arrow + level traversal. Per [13](13-frontend-stack.md): "**react-aria** (and react-aria-components where the visual is OK) for non-menu primitives — focus management, dialogs, listboxes, comboboxes, popovers. **We don't roll our own keyboard-and-screenreader handling.**"

Until `8.9` lands, the same thin-in-tree pattern applies: the `@brainstorm/sdk/a11y` package below ships v1 with hand-written hooks against the exact API surface `react-aria` exposes (so the `8.9` swap is one import-path change per call-site, never a behavioural diff). Same precedent as `B9.1b-ui`.

## The SDK surface — `@brainstorm/sdk/a11y`

One subpath. Consumed by both the shell renderer and every app. Six exports cover ~95% of the composite-keyboard surface in this codebase.

```ts
// Roving tabindex / arrow navigation for a flat list or 2D grid.
// Returns DOM attrs to spread on the container + each item.
useCompositeKeyboard(options: {
  orientation: Orientation;              // Vertical | Horizontal | Grid | Spatial
  count: number;                         // total items
  activeIndex: number;                   // controlled
  onActiveIndexChange: (i: number) => void;
  onActivate?: (i: number) => void;      // Enter / Space
  wrap?: boolean;                        // default true
  columns?: number;                      // required when Grid
  typeahead?: (i: number) => string;     // optional type-to-jump
  disabled?: ReadonlySet<number>;        // non-selectable indices (Arrow skips them)
  host?: CompositeHost;                  // Listbox (default) | Combobox
  selectionAttribute?: SelectionAttribute; // AriaSelected (default) | AriaChecked | None
  cells?: ReadonlyArray<{col, row}>;     // required for Orientation.Spatial
}): { containerProps; getItemProps(i): ItemProps };

// Tree (parent/child collapse) keyboard model.
useTreeKeyboard(options): { containerProps; getNodeProps(node): NodeProps };

// Dialog focus trap + restore-on-close + escape-to-close.
useFocusTrap(options: {
  enabled: boolean;
  restoreFocusTo?: HTMLElement | null;
  onEscape?: () => void;
  initialFocus?: "first-focusable" | "container" | "explicit";
  explicitInitialFocus?: HTMLElement | null;
}): { containerProps };

// F6 region navigation across major panes within one window.
useRegionNavigation(regions: Array<{ ref: RefObject<HTMLElement>; label: string }>):
  void; // installs the F6 / Shift+F6 binder

// Visible-focus state (defers to :focus-visible; this is the JS twin for
// surfaces that need to react in JS — e.g. virtualized lists that must
// scroll-into-view on keyboard focus but not on click).
useFocusVisible(): { isFocusVisible: boolean };

// Transient announcement to screen readers via a shell-mounted aria-live.
announce(message: string, options?: { politeness?: "polite" | "assertive" }): void;
```

> **Decision:** `useCompositeKeyboard` uses **roving `tabindex`** by default (per OQ-KBN-1 leaning) — the focused item is the **active element**, so screen readers, focus-visible, and DOM-side reasoning all read identically to a single button. `aria-activedescendant` is offered as an opt-in for virtualized lists where focus may be on items that are not yet rendered; the `<FindBar>` result counter announcement, the launcher's virtualized results, and Files / Database grid views are the four call sites that need it.

> **Decision:** `Orientation.Spatial` navigates a **sparse** 2-D grid (items at arbitrary `{col, row}` cells, e.g. the dashboard's free-placed icons) by **macOS-Desktop-style spatial movement** — each arrow moves to the *nearest item in that direction*, weighting the perpendicular offset (×3) so a well-aligned item beats a nearer-but-skewed one; no wrap at an edge. This is distinct from `Orientation.Grid`, which does dense row-major index math (`±columns`) and suits the Files/Database table grids. The geometry is the pure `spatialGridStep(cells, activeIndex, direction)` (unit-tested); the reducer's `Spatial` branch calls it with `ctx.cells`. The dashboard icon grid is the first adopter (`role: "group"`, `SelectionAttribute.None` — native icon buttons).

> **Decision:** `selectionAttribute` controls which ARIA state the active item carries: `AriaSelected` (default — `listbox`/`tablist`/`grid`), `AriaChecked` (`radiogroup`), or `None` (`toolbar`, whose items are native buttons with no selected/checked state). A `toolbar` also gets **no item role** from the hook — its items keep their implicit button role (stamping `role="button"` on a `<button>` is redundant *and* flagged by `noRedundantRoles`). The running-windows strip is the first toolbar adopter (`role: "toolbar"`, `SelectionAttribute.None`); the icon/cover picker skin-tone + tint `radiogroup`s will use `AriaChecked`.

> **Decision:** `host: CompositeHost.Combobox` adapts the hook for a **text input that controls a separate listbox** via `aria-activedescendant` (the launcher, future inline search bars). In combobox mode Space and Home/End/Page keys fall through to the input for text editing — only the orientation arrows + Enter drive the list — and the hook's `onKeyDown` + `aria-activedescendant` ride the input while the `role="listbox"` rides the results container (so the role still flows through the hook, never a hand-written literal). `Listbox` (default) keeps the focused-container semantics (Space activates, Home/End jump the list).

> **Decision:** `useFocusTrap` is the **only** path to a modal. We do not allow `tabindex="-1" onKeyDown={Escape}` ad-hoc traps. The hook reads as React state but writes the live DOM imperatively (the listbox / dialog primitives `react-aria` exposes do the same) so virtualized children don't break the trap.

The shell ships a single live region (`<div role="status" aria-live="polite" />`) at the dashboard root; `announce()` writes into it. Per-app live regions are out of scope for v1 — apps that need them call `announce()` from the SDK.

## Composite-listbox conventions (Roving-tabindex variant)

These are the single source of truth for every list-shaped composite in the product. Every app's list / grid / tree / option group MUST match.

| Key                       | Behaviour                                                                                  |
|---------------------------|--------------------------------------------------------------------------------------------|
| Tab                       | Move focus into the composite. Container has `tabindex="0"`; the active item has `tabindex="0"` and gets focused on arrow; all others have `tabindex="-1"`. |
| Shift+Tab                 | Move focus out (to the previous focusable group).                                          |
| ↓ / →                     | Move active to the next item; wrap to first if past the end (per `wrap`).                  |
| ↑ / ←                     | Move active to the previous item; wrap to last if before the start.                        |
| Home                      | Jump to first item.                                                                        |
| End                       | Jump to last item.                                                                         |
| PageDown / PageUp         | Move by one viewport-page of items (10 / page-height — apps may override).                 |
| Enter / Space             | Activate the active item (open / select / toggle, as the surface defines).                 |
| Type-to-jump              | Type-ahead (≤500ms reset window); jumps to the first item whose label matches.             |
| Esc                       | Close the composite if it is an overlay; otherwise no-op (does not steal `Escape` from a dialog above). |

For a 2-D **grid** orientation, ↓/↑ moves by row, →/← moves by column, Home/End jump within the row, Ctrl+Home/Ctrl+End jump to the grid corners.

## Tab order — the regions model

Every shell-rendered window or overlay has **regions** — major focusable groups that should be hop-able with a single key (`F6` / Shift+F6), reflecting the visual structure for screen-reader users. The shell-side regions are stable; apps declare their own via `useRegionNavigation()`.

Stable shell regions:

- Dashboard window: `dashboard-grid`, `vault-switcher`, `system-tray`.
- Settings overlay: `settings-sidebar`, `settings-main`.
- Marketplace overlay: `marketplace-sidebar`, `marketplace-main`.
- Launcher: `launcher-input`, `launcher-results`.
- Find-bar: `find-bar` (single region; Shift+F6 returns to the editor).
- App window: `app-header`, `app-nav-sidebar` (if any), `app-main`, `app-inspector` (if any). The four-region pattern is what Notes / Files / Database / Tasks / Calendar / Whiteboard / Bookmarks all share.

Within a region, Tab is unconstrained — moves between focusable groups in DOM order. Across regions, `F6` (next region) / `Shift+F6` (previous) jumps explicitly. `F6` is registered in [24](24-keyboard-shortcuts.md) as `shell/region.next` and `shell/region.previous` so it shows in the cheatsheet, but the actual region table is per-window state owned by `useRegionNavigation`.

## Focus management invariants

1. **Opening a modal moves focus to its first focusable element** (or the explicit `initialFocus`).
2. **Closing a modal restores focus to the opener** (the element that had focus when the modal opened).
3. **Removing the focused element** (selection collapse, row delete, route change) moves focus to a sensible neighbour. The composite hooks own this — never let focus fall to `<body>`.
4. **Hidden elements are not focusable.** `display: none`, `hidden`, `inert`, `aria-hidden="true"` containers, and CSS `visibility: hidden` all exclude their children from the Tab order. `useFocusTrap` and the composite hooks honour this.
5. **Disabled controls are skipped by Tab**, but stay reachable by Arrow within their composite (so the user can read why they're disabled). The disabled control announces its disabled state via `aria-disabled="true"`.
6. **Visible focus is mandatory when the user is on the keyboard.** Brainstorm follows the `:focus-visible` standard — the focus ring shows when the focus arrived via Tab/F6/Arrow/programmatic-focus-from-keyboard, and is **suppressed** for pointer-driven focus.

The focus ring is a design-system token, not a per-component style. Per [36 design system §Focus](36-design-system.md):

```
outline: var(--focus-ring-outline);
outline-offset: var(--focus-ring-offset);
```

with `--focus-ring-outline: 2px solid var(--color-focus)` and `--focus-ring-offset: 2px` (or `-1px` on bordered inputs per [[feedback_focus_outline_replaces_border]]).

## Escape stack

`Escape` unwinds the topmost overlay. The shell maintains an in-renderer stack of overlay closers; opening a popover / dialog / find-bar / cheatsheet pushes; closing pops. Pressing `Escape` invokes the top-of-stack closer.

If the stack is empty, `Escape` is delivered to the focused app (apps that handle it — e.g. Notes' "exit block selection" — use `useShortcut("app/escape")` in the renderer; the app-layer chord registry deliberately routes `Escape` even though it is a bare key, because the action verb is app-defined).

This is what makes `Escape` "always work" without each surface having to wire its own listener — and what stops a stale modal from absorbing `Escape` after its closer has unmounted.

## Screen-reader scaffolding

The keyboard model and the screen-reader model are the same model. Anything that has arrow-key navigation is a composite widget that needs the matching ARIA pattern.

| Composite                  | Role(s)                                            | State                                |
|----------------------------|----------------------------------------------------|--------------------------------------|
| List (sidebar, picker)     | `listbox` + `option`                               | `aria-selected`                      |
| Grid (Database / Files)    | `grid` + `row` + `gridcell`                        | `aria-selected`, `aria-colindex` etc.|
| Tree (Files sidebar)       | `tree` + `treeitem` + `group`                      | `aria-expanded`, `aria-level`        |
| Tablist                    | `tablist` + `tab` + `tabpanel`                     | `aria-selected`, `aria-controls`     |
| Toolbar                    | `toolbar` + `button`                               | `aria-pressed` where toggle          |
| Radio group                | `radiogroup` + `radio`                             | `aria-checked`                       |
| Dialog                     | `dialog` (or `alertdialog`)                        | `aria-modal`, `aria-labelledby`      |
| Popover (non-modal)        | `dialog` (non-modal) or implicit                   | `aria-labelledby`                    |
| Slider                     | `slider`                                           | `aria-valuemin/max/now`              |
| Find bar                   | `search`                                           | `aria-label` + `aria-live` counter   |
| Live region                | `status` (polite) / `alert` (assertive)            | `aria-live`                          |

The SDK hooks stamp these for the caller; the call-site doesn't reach for raw ARIA. **One callsite that hand-writes `role="listbox"` is rejected at review.**

## Per-surface inventory

Every interactive surface in the product. **State** = today's keyboard reach. **Adoption row** = the ladder rung where the SDK substrate replaces the today path.

### Shell-side

| Surface                  | Today (v0 keyboard reach)                                  | Adoption rung         |
|--------------------------|------------------------------------------------------------|-----------------------|
| Dashboard tile grid      | **Spatial composite (`Orientation.Spatial`, macOS-Desktop nearest-in-direction arrows): one Tab stop, ←↑↓→ move the roving cursor, Enter activates — 2026-05-29.** F6 to vault-switcher/tray still pending | KBN-S-dashboard (grid ✅; F6 ⚪) |
| Vault switcher popover   | **Vertical listbox adopts `useCompositeKeyboard` (↑/↓/Home/End/type-ahead, roving tabindex, listbox/option roles); focus lands on the list on open; `<Popover>` trap + Esc — 2026-05-29** | KBN-S-vault-switcher ✅ |
| Launcher (apps + entities)| **Combobox adopts `useCompositeKeyboard` (`CompositeHost.Combobox`, `aria-activedescendant`, header indices disabled-skipped) + `useFocusTrap` overlay — 2026-05-29.** ↑/↓ + Enter drive the list; Space / Home/End reach the input | KBN-S-launcher ✅      |
| Settings sidebar + main  | **Sidebar nav arrow-navigable (`useCompositeKeyboard`) + overlay focus-trap (`useFocusTrap`, opener-restore) + F6/Shift+F6 sidebar↔main (`useRegionNavigation`) — 2026-05-29** | KBN-S-settings ✅ |
| Marketplace 5-panel      | **Sidebar panel nav → `useCompositeKeyboard` vertical listbox (mirrors Settings); kind-filter chips → hook horizontal tablist; F6 sidebar↔main; `useFocusTrap` overlay — 2026-05-29** | KBN-S-marketplace ✅  |
| Bin overlay              | **Virtualized composite listbox (`useCompositeKeyboard` + `aria-activedescendant`): ↑/↓/Home/End move; Enter restores; Delete/Backspace purges; row actions at `tabindex -1` behind the cursor; `useFocusTrap` overlay — 2026-05-29** | KBN-S-bin ✅           |
| Help reader              | Tab + arrows in TOC; **shipped 2026-05-25**                | already ✅            |
| Welcome / onboarding     | Tab + Enter; no region nav                                 | KBN-S-welcome         |
| Cheatsheet               | Already keyboard-first (uses launcher pattern)             | already ✅ — refine    |
| Context menu             | **owned by `fancy-menus`** at 8.8                          | swap-in at 8.8        |
| Popover (shared `<Popover>`) | **Esc + focus-trap + opener-restore-on-close; optional `initialFocusRef` lands focus on a safe default — 2026-05-27 / 2026-05-30** | KBN-S-popover ✅       |
| `<Button>`               | Already focusable + `aria-keyshortcuts`                    | already ✅            |
| Icon-picker / Cover-picker | **Tab rows → `useCompositeKeyboard` tablist; skin-tone row → radiogroup (`AriaChecked`) — 2026-05-29. Emoji/icon/cover virtual grids → `useVirtualGridNav` (`Orientation.Grid` + `aria-activedescendant`, one Tab stop, cursor row kept mounted) — 2026-06-11, real-Electron verified (`kbn-picker-grid.spec.ts`)** | KBN-S-pickers ✅ |
| Toasts                   | Not focusable; assertive-`aria-live` covers them           | already ✅            |
| Capability prompt        | **Deny-by-default contract (KBN-S-cap-prompt): `<Popover>` trap + opener-restore, NO global Enter-grants shortcut (a stray Enter can't grant), Escape/backdrop deny, initial focus on **Deny** via `initialFocusRef` — 2026-05-30** | KBN-S-cap-prompt ✅    |
| Lock-screen (13.8)       | Already designed keyboard-first                            | KBN-S-lock-screen     |
| Find-bar / Replace-bar   | Enter/Shift+Enter/Esc; **shipped B9.1b-ui**                | already ✅            |
| App-header object-menu (⋯) | Esc; Tab; **no roving inside menu pre-8.8**              | swap-in at 8.8        |
| Dashboard cover-picker   | **Shared SDK cover-picker — virtual library arrow-grid via `useVirtualGridNav` — 2026-06-11** | KBN-S-pickers ✅      |

### App-side

| App           | Surfaces                                                             | Adoption rung      |
|---------------|----------------------------------------------------------------------|--------------------|
| Notes (9.6)   | Editor (Lexical native) · sidebar note list · block-selection mode · slash menu (8.8) · transclusion · find-bar | KBN-A-notes        |
| Code-editor (9.7) | CodeMirror native · find-bar adoption                            | KBN-A-code-editor  |
| Files (9.8)   | Folder tree (Tree) · content list/grid (Grid/List) · inspector · breadcrumb | KBN-A-files        |
| Database (9.12) | Grid view · List view · Gallery view · Board view · Calendar view · Timeline view · filter / sort menus (8.8) · inspector | KBN-A-database     |
| Graph (9.13)  | Canvas focus · keyboard pan/zoom · node selection · local-focus stepper · settings panel | KBN-A-graph        |
| Tasks (9.14)  | Task list · sidebar · inspector · inline edit popover                | KBN-A-tasks        |
| Calendar (9.15) | Day/week/month grid (Grid) · event chip · day-stepper              | KBN-A-calendar     |
| Journal (9.16) | Day-list · entry body (read-only) · day-stepper · find-bar          | KBN-A-journal      |
| Whiteboard (9.17) | Canvas focus · board-list sidebar · object selection · arrow nudge | KBN-A-whiteboard   |
| Bookmarks (9.18) | List / grid · tag-filter · detail view                            | KBN-A-bookmarks    |
| Preview (9.20) | Page nav · zoom · find-bar (PDF only via 9.20.5)                   | KBN-A-preview      |
| Theme-editor (9.9) | Token list · preview surface                                    | KBN-A-theme-editor |
| Books / Contacts / Form-designer | post-v1; built keyboard-first against the SDK     | folded into their slot |
| Mailbox / Browser / Agent / Connector | post-v1 (group I)                            | folded into their slot |

> **Decision:** for apps not yet built (post-v1, group I), the keyboard contract is **part of their initial build**, not a follow-up rung. The SDK substrate makes "keyboard-correct" the cheap path.

## Validation

Static lint (CI guards, the [12.11–12.13 pattern](../implementation-plan.md)):

- ✅ **KBN-G-tabindex** *(landed KBN-3 2026-05-27)* — `tabindex` values other than `0` and `-1` are flagged (positive tabindex breaks document order). `// kbn-tabindex-exempt` escape hatch. Repo snapshot: 0 sites.
- ✅ **KBN-G-roles** *(landed KBN-3 2026-05-27)* — hand-written `role="listbox|grid|tree|tablist|toolbar|radiogroup"` outside `@brainstorm/sdk/a11y` is flagged (must go through the hook). `// kbn-roles-exempt` escape hatch. Repo snapshot: 27 files (snapshotted as `KNOWN_VIOLATION_PATHS`, drives a real cleanup per SH-31/.32).
- ✅ **KBN-G-onclick-non-button** *(landed KBN-3 2026-05-27)* — `onClick` on a non-`<button>` / non-`<a>` / non-input element with no `role` and no `tabindex` is flagged (mouse-only affordance). Already covered by the existing `12.11` button accessible-name guard for the button case; this is the wider net. `// kbn-onclick-exempt` escape hatch. Repo snapshot: 2 files.
- ✅ **KBN-G-focus-trap-without-restore** *(landed KBN-3 2026-05-27)* — a `useFocusTrap` call site without `restoreFocusTo` is flagged. `// kbn-trap-restore-exempt` escape hatch. Repo snapshot: 0 sites.

Runtime (Playwright, the [12.7](../implementation-plan.md) pattern):

- ✅ **KBN-P-tab-walk** *(landed KBN-4 2026-05-27)* — `tests/perf/specs/kbn-tab-walk.spec.ts`. Dashboard variant runs today; settings-overlay sub-test ⚪-skip-until KBN-S-settings.
- ✅ **KBN-P-escape-stack** *(landed KBN-4 2026-05-27)* — `tests/perf/specs/kbn-escape-stack.spec.ts`. Today exercises a 2-deep Help → Launcher stack with LIFO unwind via KBN-2's shared stack + empty-stack Escape no-op. Full 3-deep + opener-focus restore variant ⚪-skip-until KBN-S-launcher + KBN-S-settings + KBN-S-help land (only `<Popover>` restores opener focus today).
- ✅ **KBN-P-modal-trap** *(landed KBN-4 2026-05-27)* — `tests/perf/specs/kbn-modal-trap.spec.ts`. Opens the Vault Info `<Popover>` (the canonical KBN-S-popover trap); asserts Tab + Shift+Tab N+1 cycle inside the panel and never escape.
- ◑ **KBN-P-arrow-composite** *(body written against KBN-S-settings 2026-05-28; CI-pending)* — `tests/perf/specs/kbn-arrow-composite.spec.ts`. The Settings sidebar is the first `useCompositeKeyboard` adopter, so the spec body now drives a real composite: Home anchors to index 0, ArrowDown advances the active index, `aria-selected` mirrors it, the container carries the hook-stamped `role="listbox"` + `aria-orientation="vertical"`, `:focus-visible` is true after the keyboard arrow, ArrowUp returns. **Still `test.skip`** — the perf-spec suite is currently unloadable under the installed `@playwright/test` (it rejects the `async (_, testInfo)` fixture signature every KBN-P spec uses; this spec uses the accepted `async () =>` form but the suite around it must be unblocked first) and the dev sandbox can't boot Electron to completion. The composite contract itself is unit/jsdom-verified (SDK `compositeRoles` tests + shell renderer suite). Enable on the perf CI. Further adopters (launcher / dashboard / vault-switcher / marketplace / bin / pickers) extend the same spec.
- ✅ **KBN-P-focus-visible** *(landed KBN-4 2026-05-27)* — `tests/perf/specs/kbn-focus-visible.spec.ts`. Three-step pointer → Tab → pointer modality contract; asserts `:focus-visible` toggles per the standard.

Shared lib: `tests/perf/lib/keyboard-assertions.ts` (FOCUSABLE_SELECTOR mirroring the `useFocusTrap` filter, fingerprint-based focus reader, `tabWalk`, `enumerateFocusables`, `ensureVaultSeeded`, `openLauncher`, `waitForDashboard`, `isFocusVisible`). Joins `bun run perf` via the existing `testMatch: /.*\.spec\.ts$/` glob — no script change needed.

## Open questions

These move into [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-KBN-1** — Roving `tabindex` vs `aria-activedescendant` as the default. Leaning: roving `tabindex` (single active element, simpler focus-visible, predictable for non-virtualized lists), with `aria-activedescendant` opt-in for virtualized composites.
- **OQ-KBN-2** — Region navigation key. Leaning: `F6` / `Shift+F6` (matches Windows / VS Code convention). Macs have no first-class F6; users may rebind.
- **OQ-KBN-3** — `Escape` stack delivery — at the renderer (DOM `keydown` capture, in-tree stack), or at the main process? Leaning: renderer-only (every overlay is renderer-mounted, and the per-window scope is what users expect; main-process delivery would be over-reach).
- **OQ-KBN-4** — `:focus-visible` polyfill — needed for older Electron? Leaning: no — Electron 41 supports `:focus-visible` natively across all targets; no polyfill needed.
- **OQ-KBN-5** — Single-key disclosure (e.g. `?` to open contextual help) collisions with type-ahead inside a composite list. Leaning: type-ahead always wins inside a focused composite (per the [24 §Single-key suppression](24-keyboard-shortcuts.md#single-key-suppression-in-input-contexts) policy extended from text inputs to composites); the `?` chord requires no composite to be the focused element.
- **OQ-KBN-6** — Per-app Tab order — opt-in `useRegionNavigation` or default-on for every app window? Leaning: default-on, with the four-region pattern (header / nav-sidebar / main / inspector) baked into the shell's app-window template so apps don't have to wire it.

## Phasing

> **Decision:** v1 ships the **SDK substrate + shell-side adoption + per-app adoption for the apps that are in v1**. The post-v1 apps (group I) inherit the contract by construction. The fancy-menus swap (`8.8`) and the react-aria swap (`8.9`) happen post-v1 as planned; until then, the in-tree primitives implement the same surface against the same call-sites.

| Capability                                                | v1 | v2 |
|-----------------------------------------------------------|----|----|
| `@brainstorm/sdk/a11y` substrate                          | ✓  | ✓  |
| Roving-tabindex hook                                      | ✓  | ✓  |
| Focus-trap hook                                           | ✓  | ✓  |
| Region-navigation hook                                    | ✓  | ✓  |
| `announce()` shell live-region                            | ✓  | ✓  |
| Visible-focus token + `:focus-visible` enforcement        | ✓  | ✓  |
| CI guards (KBN-G-*)                                       | ✓  | ✓  |
| Playwright validation (KBN-P-*)                           | ✓  | ✓  |
| All shell surfaces keyboard-correct                       | ✓  | ✓  |
| All v1 apps keyboard-correct                              | ✓  | ✓  |
| Swap onto `react-aria` (`8.9`)                            | —  | ✓  |
| Swap onto `@react-fancy-menus/core` (`8.8`)                     | —  | ✓  |
| Per-region screen-reader announcement at region transitions | post-v1 (OQ-KBN-6 follow-up) | ✓ |
| User-configurable Tab order overrides                     | post-v1 | ✓ |

## Summary

- **Two halves**: shortcuts ([24](24-keyboard-shortcuts.md)) and traditional navigation (this doc). One does not substitute for the other.
- **One shared substrate**: `@brainstorm/sdk/a11y` — six hooks cover ~95% of the composite-keyboard surface. Apps consume it; apps do not hand-roll keyboard.
- **Two dependencies**: `@react-fancy-menus/core` (menu keyboard nav, swap at `8.8`) and `react-aria` (non-menu primitive keyboard nav, swap at `8.9`). Both gated as 🟢 post-v1; v1 ships in-tree primitives against the same call-site contract per [[feedback_avoid_blocking_on_deps]].
- **Conventions are fixed**: Tab between groups, Arrow inside composites, F6 between regions, Esc unwinds top overlay, Enter/Space activate. Documented here, enforced by CI + Playwright.
- **Focus is always visible** when the user is on the keyboard (`:focus-visible`), **never lost** (composite hooks own the neighbour-fallback), **restored** on overlay close.
- **Per-surface, per-app inventory**: every interactive surface in the product has a named adoption rung. The `KBN` ladder owns them.
