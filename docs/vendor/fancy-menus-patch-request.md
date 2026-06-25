# Task: fix `@react-fancy-menus/core` runtime to honor its own typed contract (+ one new mode)

You are working on the **`@react-fancy-menus/core`** package source (the menu runtime published to npm; consumers install `dist/`). A downstream product ("Brainstorm") pins `@react-fancy-menus/core@0.1.0` and wraps it as its single menu layer. Four fields/behaviors are **declared in your public `.d.ts` types but the runtime ignores them**, forcing the consumer into ugly workarounds (registering a separate `MenuConfig` per label/alignment, faking collapsed anchor rects, and re-implementing whole menus outside the runtime). One item is a genuinely new mode. Fix all of them, with tests, and produce a patch.

Do **not** change CSS class names (`.fm-menu`, `.fm-list`, `.fm-row`, `.fm-row--selected`, `.fm-row--destructive`, etc.) — downstream borrows them. No breaking changes to existing call sites; everything below is additive or "start honoring a field that was previously a no-op."

---

## Issue 1 — Runtime ignores `OpenParam.position` (per-open position override)

**Typed but inert.** `OpenParam` already declares `position?: Partial<PositionConfig>` (types `OpenParam`, ~line 489). The runtime positions **only** from the static `config.position`; the per-open `param.position` is dropped.

**Why it matters.** The consumer wants one registered context-menu config opened sometimes bottom-start, sometimes bottom-end (a left chip vs. a right-aligned `⋯` button). Because per-open position is ignored, they register a **duplicate `MenuConfig` per (alignment × ariaLabel) combination** and pick the variant at open time. That's pure boilerplate that should collapse to one config + a per-open override.

**Expected.** At open, merge `param.position` over `config.position` (shallow merge; `param` wins per-key) and drive Floating UI / rect math from the merged result. `update(id, { position })` should re-position a live menu.

**Acceptance.**
- Opening the same config id with `{ position: { horizontal: Horizontal.Right } }` vs. `{ horizontal: Horizontal.Left }` yields right-aligned vs. left-aligned placement, no config duplication.
- Unset keys in `param.position` fall back to `config.position`.
- Existing call sites that pass no `param.position` are unchanged.

## Issue 2 — Runtime ignores `position.fixedX` / `position.fixedY`

**Typed but inert.** `PositionConfig.fixedX?: number` / `fixedY?: number` are documented ("Pin to absolute coordinates (overrides anchor math)", ~lines 402–403) but the runtime never reads them. The consumer worked around this by constructing a **zero-area `DOMRect` at the cursor point** and passing it as `rect` — which works, but means the documented field is a trap (it type-checks, does nothing).

**Expected.** When `fixedX`/`fixedY` are set (via config or, after Issue 1, via `param.position`), pin the menu's anchor point to those viewport coordinates, overriding `element`/`rect`-derived anchor math. Still apply flip/shift clamping to keep it on-screen unless `noFlipX/Y`/`noBorderX/Y` say otherwise.

**Acceptance.** A menu opened with `position: { fixedX: 100, fixedY: 200 }` and **no** `element`/`rect` anchors at (100, 200). If you decide pinned coords are out of scope, the alternative is to **remove `fixedX`/`fixedY` from the public type** so they can't be passed silently — but honoring them is preferred.

## Issue 3 — Runtime ignores `position.stickToElementEdge`

**Typed but inert.** `PositionConfig.stickToElementEdge?: Edge` ("Snap to a specific edge of the trigger element regardless of anchor", ~line 418) is dropped by the runtime. The consumer hit this on cascade submenus: they wanted a child to stick to the spawning row's edge and the field did nothing, so they fell back to `Vertical.Center + Horizontal.Right` placement.

**Expected.** Honor `stickToElementEdge` — anchor the menu to the named `Edge` of the trigger element regardless of the `vertical`/`horizontal` anchor, then flip/shift as usual. Same fallback option as Issue 2: if unimplementable, remove it from the public type rather than leaving a silent no-op.

## Issue 4 — Runtime ignores per-open / config `ariaLabel` for `role="menu"` shells

**Typed but inconsistently applied.** `ChromeConfig.ariaLabel?: string` exists (~line 1429) and per-item `ariaLabel` exists, but for a plain `role="menu"` list shell with no `title`, the accessible name isn't emitted from the static config, and there is **no per-open `ariaLabel`**. Combined with Issue 1, this is the *other* reason the consumer registers a config-per-label: each menu needs its own screen-reader name baked into a static config.

**Expected.**
- Honor `chrome.ariaLabel` on the outer shell for **all** roles including `role="menu"` (not only `dialog`).
- Add a per-open override: `OpenParam.ariaLabel?: string` (or `param.chrome?: { ariaLabel?: string }`) that wins over `config.chrome.ariaLabel`. This lets one config carry many distinct accessible names.

**Acceptance.** Opening one config with `{ ariaLabel: "Note actions" }` vs. `{ ariaLabel: "Sort by" }` emits the matching `aria-label` on the shell; nothing leaks the internal menu id.

## Issue 5 (new mode) — externally-driven list body for caret typeaheads

**The gap.** A caret typeahead (slash-command `/`, `@`-mention, inline pickers) lives **inside a text editor**: the editor must keep DOM focus / the caret, and an external owner drives the highlighted row and commits on Enter. Today the list body **auto-focuses on mount and owns the keyboard**, which steals the caret and freezes typing — so the consumer cannot use the runtime at all for these. They re-implement positioning + keyboard from scratch and only borrow your `.fm-*` CSS classes. That's the one case that escapes the runtime entirely.

`KeyboardNavigation.None` exists (disables internal nav) but the body still grabs focus on mount and there's no way to feed in a controlled highlight.

**Expected — add a "controlled / presentational list" mode** so a host can render a real runtime menu it doesn't focus:
- `ListBody.focusOnMount?: boolean` (or `BodyConfig.manageFocus?: boolean`) — when `false`, the body renders/positions but never calls `.focus()`; DOM focus stays where the host put it (the editor). Filter input focus is already separately controllable via `FilterConfig.focusOnMount` — mirror that naming.
- A **controlled active index**: accept `activeIndex` via `OpenParam` (and updatable via `update(id, { activeIndex })`) so the host moves the highlight from its own keydown handler while the editor keeps the caret. The highlighted row should paint the same active treatment as keyboard nav (so it's pixel-identical to a normal menu).
- Works with `KeyboardNavigation.None` so the runtime doesn't fight the host for arrow/enter keys.

**Acceptance.** A host can: open a `BodyKind.List` menu anchored to a DOM rect, keep focus in a `contenteditable`, type to update `data`/filter via `update()`, move the highlight via `update({ activeIndex })`, and commit on its own Enter — with **no focus stolen** and the rows visually identical to a standard menu. Provide a runnable example (Storybook story or test harness) showing a fake `/`-menu over a `contenteditable`.

---

## Cross-cutting requirements

1. **No breaking changes.** All of the above is additive or "honor a field that was a no-op." Existing configs/call sites must behave identically when they don't use the new behavior. Call out any unavoidable behavior change explicitly in the changelog.
2. **Keep public CSS class names and the existing keyboard model stable.**
3. **Tests.** Unit/integration tests (jsdom + your existing harness) for each issue: per-open position merge, `fixedX/fixedY` pinning, `stickToElementEdge`, per-open `ariaLabel`, and the controlled/no-focus list mode. Include a regression test asserting `param.position` overrides `config.position` per-key.
4. **Types.** Update `.d.ts` source so the new `OpenParam` fields (`ariaLabel`, `activeIndex`) and the `focusOnMount`/`manageFocus` body field are exported and documented. If you drop `fixedX/fixedY`/`stickToElementEdge` instead of implementing them, remove them from the type and note it as breaking.
5. **Docs/changelog.** Add a `CHANGELOG.md` entry and bump the version (minor if purely additive: `0.1.0 → 0.2.0`).
6. **Build.** `dist/` must rebuild cleanly (the consumer imports `./`, `./types`, `./runtime`, `./runtime.css`).

## Deliverable

A single git patch (or PR branch) against the `@react-fancy-menus/core` source containing: the runtime fixes, type updates, tests, an example/story for Issue 5, a `CHANGELOG.md` entry, and a version bump. Output the patch as `git format-patch` / `git diff` text plus a short summary of what changed per issue and any field you chose to remove rather than implement.

## Downstream context (for your understanding — do NOT edit these; they're in the consumer repo)

- `packages/sdk/src/menus/context-menu.ts` — registers a `MenuConfig` **per (alignment × ariaLabel)** purely because Issues 1 & 4 are inert (`configFor()`); builds a zero-area `DOMRect` at the cursor because Issue 2 is inert (`anchorRectAt()`); falls back from `stickToElementEdge` (Issue 3) on the cascade child.
- `packages/editor/src/plugins/slash-menu-plugin.tsx` — the caret typeahead that **cannot** use the runtime today (Issue 5) and only borrows `.fm-menu`/`.fm-list`/`.fm-row` CSS.

When all four "inert field" issues land, the consumer collapses its per-variant config registration to one config + per-open overrides, and the slash/`@`-mention menus move onto the real runtime.
