# 37 — Cross-app navigation: routes, panels, and intra-app tabs

This doc fills the gap between [17-interoperability.md](../platform/17-interoperability.md) (intents as the *request*), [31-linking-protocol.md](../platform/31-linking-protocol.md) (URIs as the *address*), and [33-windows-and-menus.md](33-windows-and-menus.md) (windows as the *frame*). It answers: when the user *navigates* — by clicking a link, dispatching an intent, or following a route — **where does the result appear, which existing window should pick it up, and which window operations are first-class so apps don't reinvent them?**

The driving observation: users navigate constantly between apps (open a database → click into a row → that row is owned by the editor app → click a link in the editor → that opens a third app). Today that flow opens N windows. Browsers solved this with tabs and, more recently, with side-by-side panels (Arc). Brainstorm needs the same affordances **without forcing every app to ship its own tab strip, route table, and link-handler**.

## Goals

1. **One window per route.** If the user navigates to `brainstorm://entity/ent_X` and a window in some app is already showing that route, focus it. Don't open a second window.
2. **Apps don't ship their own router.** Routes live on `WindowEntry`; the shell tracks them; the SDK exposes a single `ui.navigate(route, mode)` call.
3. **Cross-app handoff is invisible to the user.** Clicking a link to a Note from a database row "just opens it" — in the same panel group, in a tab next to the database, or in a fresh window — whichever the user chose as default for that verb-type pair.
4. **Side-by-side panels are first-class.** Arc-style column arrangement of related windows is a shell feature, not a per-app feature. Any two app windows can be grouped into a panel column.
5. **Intra-app tabs are first-class.** A tab strip lives on `chrome.tabs` (per [27-layouts.md](27-layouts.md)); an app opts in once and gets tab-switch, tab-close, drag-to-reorder for free. Tabs are intra-app per [33](33-windows-and-menus.md).
6. **Navigation modes are uniform across apps.** Replace-in-place, new-tab, new-window, new-panel — every app exposes the same four modes wherever links are clicked.

## The route concept

Every app window has, at any moment, a **route**: a `brainstorm://` URI that identifies what the window is currently showing, or `null` if the window is showing landing/empty state.

```ts
type WindowEntry = {
  // ... existing fields per docs/shell/33 ...
  route: string | null;        // current brainstorm:// URI, or null
  navStack?: string[];          // back-stack of previous routes, oldest first; bounded
  group?: string;               // tab-group OR panel-group id (see below)
  groupKind?: "tabs" | "panel"; // what kind of grouping this window is in, if any
};
```

> **Decision:** `route` is **published by the app**, validated by the shell. The app calls `ui.windows.setRoute(route)` whenever its displayed content changes; the shell parses, validates against the curated authority set (per [31](../platform/31-linking-protocol.md)), and stores the canonical form. Apps that don't publish routes still work — they just don't participate in focus-existing or back-stack semantics.

### Route normalization

Two routes are **route-equivalent** if their canonical forms match. Canonical form:

- Path components are URL-decoded then re-encoded with the canonical encoder.
- Query parameters are sorted alphabetically.
- The `from=...` query parameter (and any others on the **ephemeral query allowlist**) are stripped.
- Trailing slashes are removed.
- Fragments are preserved verbatim (anchors per [31](../platform/31-linking-protocol.md) are part of identity — `#anchor` is a different *position* than the bare entity, but focus-existing still picks the same window since the entity portion matches).

> **Decision:** focus-existing matches on the **entity portion** (everything before the fragment). A click on `brainstorm://entity/ent_X#anchor-A` focuses the window already showing `brainstorm://entity/ent_X#anchor-B`, then asks the app to scroll the new anchor into view via a follow-up `ui.windows.scrollToAnchor(anchorId)` call. Avoids opening duplicate windows for sub-entity navigation.

> **Open:** OQ-157 — should the **ephemeral query allowlist** be shell-curated or app-extensible? Shell-curated keeps canonicalization predictable; app-extensible lets apps mark internal parameters as non-identity-bearing. Tentative leaning: shell-curated for v1 (`from`, `via`, `referrer`); revisit if apps need more.

## Navigation modes

Every navigation has a **mode** — what to do with the result. Four modes, identical wherever a link is followed:

| Mode          | Meaning                                                                                       | Default keystroke (override per OS)              |
|---------------|-----------------------------------------------------------------------------------------------|---------------------------------------------------|
| `replace`     | Replace the current window's content. Pushes the previous route onto the nav stack.           | Plain click                                       |
| `new-tab`     | Open in a new tab within the current window's tab group (creating the group if absent).        | `Mod+Click`                                       |
| `new-window`  | Open in a brand-new top-level window. Detached.                                                | `Mod+Shift+Click`                                 |
| `new-panel`   | Open as a side-by-side panel next to the current window in a panel group.                      | `Alt+Click`                                       |

> **Decision:** mode keystrokes are **shell-defined defaults**, but the user can rebind per [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md). Apps **do not** intercept link-click modifier keys; the shell-provided link component (see "Link component" below) reads the modifier and forwards `mode` to `ui.navigate`.

### Per-(verb, type) defaults

A click *without* a modifier resolves to a **default mode**, which is configurable per `(verb, sourceApp, targetType)` triple. Defaults are stored in shell settings:

- Initial baseline: `replace` for same-app navigation; `new-window` for cross-app, `new-panel` for cross-app when the source window is in a panel group (additive instead of replacing the user's arrangement).
- The user can override globally ("always open Notes in a new tab"), per source-app ("links from the Code Editor open in a panel"), or per session ("just for this click — won't remember").
- Visible and clearable in Settings → Defaults (same surface that already manages per-`(verb, type)` *handler* defaults per [17 §Default handlers](../platform/17-interoperability.md)).

> **Decision:** mode and handler are **two separate defaults**. "Always open Notes with the Editor" (handler) is independent from "Always open Notes in a new tab" (mode). Settings lists both.

## Focus-existing semantics

When the shell receives a navigation request — whether from a click inside an app, from an intent dispatch, from a deep link, or from the launcher — it runs this resolution:

```
1. Resolve the request → (targetRoute, mode, targetApp).
2. If mode is "new-window" or "new-panel": skip step 3 (the user
   explicitly asked for a new window, even if a match exists).
3. If a window has a route route-equivalent to targetRoute:
     a. Focus that window.
     b. If the route differs only in fragment, also call
        ui.windows.scrollToAnchor(fragment) on the target window.
     c. Return — no new window created.
4. Otherwise: open a new window in the chosen mode.
```

> **Decision:** focus-existing is **on by default**, regardless of which app introduced the matching window. Users find this intuitive — Brainstorm acts like a desktop, where two clicks on the same icon focus the existing window. Apps can request *force-new* via the explicit modes; the shell never opens duplicates against the user's intent.

### What if multiple windows match?

If two windows have route-equivalent routes (e.g., the user opened the same entity twice intentionally), focus the **most-recently-focused** one (the window with the highest `lastFocusedAt` per [33 §The window index](33-windows-and-menus.md)). If the user explicitly wants the other instance, they switch via the window switcher.

### What if the target route is in a minimized window?

Restore from minimized and focus. Same window, not a new one. (Restoring is the user's likely intent if they're following a link to it.)

## Panel groups

A **panel group** is a horizontally-arranged set of windows rendered edge-to-edge in a single OS window, with draggable dividers between them. Inspired by Arc's split-view and macOS Stage Manager's grouping. Each panel hosts one app window; panels can come from different apps (database in panel 1, editor in panel 2, AI summarizer in panel 3).

### Creation

- Implicit: `mode: "new-panel"` from any link / intent adds the new window as a panel adjacent to the source window.
- Explicit: drag a window onto another window's edge (Alt+drag or via a `chrome.windowControls` affordance — final UX gesture TBD per OQ-158).
- From dashboard: right-click a window in the window-list widget → "Add to panel group as side panel."

### Behavior

- The OS sees **one window** (the panel group's container). The shell renders multiple `<webview>`-equivalent child surfaces inside it, each running its own app renderer per [33 §Window manager](33-windows-and-menus.md).
- Per-app keyboard focus is still per-panel (clicking a panel focuses its app).
- The application menu reflects the **focused panel's app** (same focus-follows-content rule as freestanding windows per [33 Part 1](33-windows-and-menus.md)).
- Closing a panel removes it from the group; the rest re-flow. Closing the last remaining panel collapses the group into a freestanding window.
- Resizing the group's container does not reflow panel widths; each panel keeps its width and the rightmost panel absorbs overflow (or the user scrolls horizontally if total panel width exceeds the container).

> **Decision:** panel groups are **cross-app**. Unlike tab groups (intra-app only per [33 §Cross-app tab groups](33-windows-and-menus.md)), panels are explicitly designed to host multiple apps together. The complexity that tab-grouping cross-app raises (focus events, shared state, capability boundaries) does not apply to panels because each panel keeps its own renderer with its own identity, capability set, and focus.

### Persistence

Panel groups are part of window state per [33 §Window manager](33-windows-and-menus.md). They restore across crashes and shell restart. Cross-device sync of panel arrangements ties to OQ-138 (Workspace entity).

> **Open:** OQ-158 — gesture for creating panels by drag (Alt+drag? drag-onto-edge? both? a dedicated affordance in `chrome.windowControls`?). Resolve once the layout system lands (Stage 8).

> **Open:** OQ-159 — should panels support vertical splitting (rows), not just horizontal columns? Arc is columns-only; Stage Manager is freer. Tentative leaning: columns-only in v1, vertical split deferred to OQ-138's Workspace work.

> **Open:** OQ-160 — minimum and maximum panel widths. Tentative leaning: min 280px (sub-280 cramps any layout), max unbounded (user can drag a panel to fill the screen, effectively focusing it).

## Intra-app tabs revisited

[33-windows-and-menus.md §Tabs](33-windows-and-menus.md) already commits to tab-style grouping as a shell-managed feature. This doc fills in the **route + navigation** plumbing:

- A tab group hosts N windows of the **same app**. The OS sees one window; the shell renders a `chrome.tabs` strip plus the focused tab's content.
- Each tab has its own `route`, `navStack`, and lifecycle. Switching tabs is cheap (it's a focus change, not a re-instantiation — the underlying app renderer is shared per OQ-4 (b) resolution at Stage 7 entry).
- `mode: "new-tab"` finds the current window's tab group (creating it on first use) and adds a tab.
- A tab can be **promoted** to a freestanding window (drag-out gesture, or right-click → "Move to New Window"). A freestanding window can be **demoted** into an existing tab group (drag onto the tab strip).

### Tab back/forward

Each tab's `navStack` enables in-tab back/forward navigation. Default shortcuts: `Mod+[` / `Mod+]` (overridable per [24](24-keyboard-shortcuts.md)).

> **Decision:** back/forward operates on the **tab's** stack, not the app's global history. Stacks are per-tab so two tabs of the same entity can have independent navigation histories.

The shell provides:

- `ui.navigation.back()` / `ui.navigation.forward()` — moves the focused window's route along its `navStack`.
- `ui.navigation.canGoBack()` / `ui.navigation.canGoForward()` — for rendering nav-arrow affordances in `chrome.actionBar` (per [27-layouts.md](27-layouts.md)).

> **Open:** OQ-161 — back-stack depth limit. Browsers cap at ~50 entries per tab. Tentative leaning: 100 entries, oldest evicted; configurable in shell settings.

## How the four mechanisms compose

A worked example threading interop (17), linking (31), windows (33), and this doc:

**Scenario:** user is in the database app viewing a list of Notes. They `Mod+Click` a row.

1. The database app's row component is a **shell-provided Link component** (see below) wrapping its visual presentation. `Mod+Click` resolves to `mode: "new-tab"`.
2. The Link component calls `ui.navigate({ route: "brainstorm://entity/ent_X", mode: "new-tab" })`.
3. The shell's navigation resolver:
   a. Parses the route → `(authority=entity, entity-id=ent_X)`.
   b. Finds the registered `intent.open` handler for `ent_X`'s entity type. Suppose it's the Editor app.
   c. **Focus-existing check:** does any window have a route-equivalent route? Suppose no.
   d. **Mode handling:** `new-tab` → find the current window's tab group; the database window isn't in one yet. Create a tab group; add the database window as the first tab.
   e. Launch the Editor app via `LaunchOrchestrator` (per [03-app-model.md](../apps/03-app-model.md) §Launch) with `LaunchContext = { reason: "open-entity", entityId: "ent_X" }`. The Editor opens, becoming the second tab.
   f. The Editor calls `ui.windows.setRoute("brainstorm://entity/ent_X")` once it has loaded the entity. The window index updates.

If the user later clicks the same row again (plain click):

3'. `mode: "replace"`. Focus-existing matches the Editor tab. Shell focuses it. No new window or tab created.

If the user `Alt+Clicks` a link inside the Editor to a related Note:

3''. `mode: "new-panel"`. Shell launches the related Note next to the Editor in the same OS window, as a side panel. The OS window now hosts a tab group on the left (database + editor tabs) and a panel on the right (related note).

## The Link component

App authors don't write click handlers, modifier-key sniffers, or route generators. The SDK ships one component:

```tsx
<Link route="brainstorm://entity/ent_X">{children}</Link>
```

It:

- Renders any DOM (the children — a text span, a row, a card, an icon — anything).
- Captures clicks; inspects modifier keys; resolves the right `mode` per the user's defaults; calls `ui.navigate`.
- Surfaces `aria-current="page"` when its route is the current window's route (for selection styling in lists).
- Handles middle-click as `new-tab` (Chrome convention).
- Surfaces a context menu on right-click with "Open", "Open in new tab", "Open in new window", "Open in panel" — same as a browser link.
- Emits a drag payload with `application/x-brainstorm-entity` + `text/uri-list` + `text/plain` per [17 §Drag-and-drop](../platform/17-interoperability.md) so the link can be dragged into another surface.

> **Decision:** every internal navigation in every app goes through `<Link>`. Apps that bypass it lose focus-existing, mode-respect, drag, context menus, and accessibility — they shouldn't bypass it without reason. Lint rule (Stage 8): a custom rule flags `onClick` handlers that produce navigation without going through `<Link>` or `ui.navigate`.

## Object menu

`<Link>` answers *navigation*. The **object menu** answers *"what else can I do with this object?"* — the right-click / overflow menu on any object an app shows (a Database row, a Graph node, a Notes mention, a Files entry, a dashboard pin). Before this every app hand-rolled its own item list with subtly different labels, order and behaviour; that fragmentation is the thing this convention removes.

The contract is one headless builder:

```ts
import { buildObjectMenuItems, isObjectPinned } from "@brainstorm/sdk/object-menu";

const pinned = await isObjectPinned(runtime, entityId);          // pre-fetch (async)
const items = buildObjectMenuItems({
  target: { entityId, entityType },
  runtime,
  pinned,
  onRemove,                                                      // optional, app-owned
  extraItems,                                                    // optional, app-specific
});
// render `items` through the app's existing menu chrome
```

It returns an **ordered** `ObjectMenuItem[]`; the app maps it onto whatever menu primitive it already has (Database's `openContextMenu`, the shell's `DashboardIconContextMenu`, …). It is deliberately *not* a DOM/React widget — we share the *contract* (items, order, labels, semantics), not the chrome, so menus stay visually native to each surface while behaving identically.

**v1 item order** — fixed so the menu is muscle-memory across apps:

1. **Open** — always present (`intents.dispatch:open` is default-minimum). Routes through the one open path (`openEntity`), so it inherits focus-existing + the registered opener exactly like `<Link>`.
2. **Pin to dashboard / Remove from dashboard** — a single toggle, gated on the default-minimum `dashboard.pin` capability and the presence of `services.dashboard`. Calls `services.dashboard.pin` / `unpin`. The pin stores only the entity id; the dashboard live-resolves the object's own icon + a small opener-app badge and tombstones a deleted target (never auto-removes it). Unpinning is pure dashboard state — it never deletes or hides the object ([[OQ-DASH-1]]).
3. *app `extraItems`* — app-specific actions (future: **Print** per [23 — output/printing](../platform/23-output-printing-pdf.md), Duplicate, Move…). Inserted here, in array order, so destructive stays last.
4. **Remove** — the app-owned destructive action (delete the entity / remove from a list). Only appears when the app passes `onRemove`; the app owns the confirmation UX. An app without a confirm affordance omits it rather than shipping an unconfirmed delete.

Labels default to English and are overridable (`labels`) so the menu follows the user's locale where the app has an i18n table.

> **Decision:** every per-object context menu in every app is built with `buildObjectMenuItems`. Apps add their own actions via `extraItems`, never by forking the built-ins (so Open/Pin never drift). New object surfaces adopt this the same way the universal-icon / cover passes rolled out — incrementally, as each surface is touched, with the SDK builder as the single source of truth. First adopter: the Database app (one delegated `contextmenu` over the stage body covers every view kind).

## Resolution flow (the shell side)

The **navigation resolver** is a single function in the shell, called by:

- The `<Link>` component (renderer-side, via `ui.navigate(...)`).
- Every `intent.open` dispatch (per [17](../platform/17-interoperability.md)).
- Every deep-link follow (per [31](../platform/31-linking-protocol.md)).
- The launcher (per [04-shell.md](04-shell.md)) when the user picks an "Open <entity>" result.

```ts
async function resolveNavigation({
  route: string,             // brainstorm:// URI
  mode: "replace" | "new-tab" | "new-window" | "new-panel",
  source: { app: string, windowId?: string },
}): Promise<{ window: WindowEntry, created: boolean }> {
  const canonical = canonicalizeRoute(route);
  const handler = await resolveHandler(canonical);   // per docs/17 — registered intent.open handler
  if (!handler) {
    // No handler — show "no handler installed" notification (per docs/17 §Failure modes).
    throw new NoHandlerError(canonical);
  }

  if (mode === "replace" || mode === "new-tab") {
    const existing = findExistingWindow(canonical);
    if (existing) {
      focusWindow(existing);
      maybeScrollToAnchor(existing, anchorOf(canonical));
      return { window: existing, created: false };
    }
  }

  switch (mode) {
    case "replace":     return openInSourceWindow(handler, source, canonical);
    case "new-tab":     return openInTabGroupOf(handler, source, canonical);
    case "new-window":  return openInNewWindow(handler, canonical);
    case "new-panel":   return openInPanelOf(handler, source, canonical);
  }
}
```

> **Decision:** the resolver is **shell-internal**. Apps cannot observe other apps' navigations or intervene. The resolver exposes one function to the dashboard renderer (`shell.navigation.history(limit)`) for the "Recently visited" widget; apps see only their own navigations.

## Privacy and capability boundaries

- An app can read its own routes (`ui.windows.currentRoute()`, scoped to its own windows).
- An app **cannot** enumerate other apps' windows or their routes. Window-index access is privileged-dashboard-only per [33 §Threat model](33-windows-and-menus.md).
- Focus-existing matching happens **in the shell** with the resolved canonical route. The dispatching app learns only `{ ok: true, focused: existingWindow }` for cross-app dispatches — never the existing window's full record.
- A `process` or `share` intent dispatched to another app does not get to see the recipient's other open routes — only the result the handler returned.

## Phasing

| Capability                                              | Stage         | Notes                                                                  |
|---------------------------------------------------------|---------------|------------------------------------------------------------------------|
| `route` field on `WindowEntry` + `setRoute` SDK call    | 7b (7.5)      | Lands with the intents bus — both pieces share `ui.windows.*`.         |
| Route canonicalization + focus-existing in the resolver | 7b (7.5)      | Same iteration.                                                        |
| Navigation modes (`replace` / `new-tab` / `new-window`) | 7b (7.5)      | Minimum mode set for the intents bus to be useful cross-app.           |
| `<Link>` component + lint rule against ad-hoc onClick   | 7b (7.5)      | Lint rule lands with the component to enforce uniform routing.         |
| `new-panel` mode + panel-group rendering                | 8             | Needs the layout system's chrome composition; intra-stage with tabs.   |
| Panel-creation gesture (drag onto edge)                 | 8             | Lands with `chrome.windowControls`.                                    |
| Intra-app tabs via `chrome.tabs`                        | 8             | Per [33](33-windows-and-menus.md); the per-tab `route`+`navStack` plumbing lands here. |
| Back/forward + `Mod+[ / Mod+]` shortcuts                | 8             | Once tabs ship; depends on the nav stack.                              |
| Per-(verb, type, source-app) mode defaults in Settings  | 8             | Settings surface; ties to existing handler-defaults UI per [17](../platform/17-interoperability.md). |
| Vertical panel split (rows)                             | post-v1       | OQ-159.                                                                |
| Cross-app tab groups                                    | post-v1       | OQ-136 per [33](33-windows-and-menus.md).                              |
| Saved panel/tab arrangements (Workspace/v1)             | post-v1       | OQ-138.                                                                |

## Open questions (new)

- **OQ-157** — ephemeral query allowlist for route canonicalization: shell-curated or app-extensible?
- **OQ-158** — panel creation gesture (Alt+drag, drag-onto-edge, dedicated affordance, or all of the above).
- **OQ-159** — vertical panel split (rows) in addition to columns.
- **OQ-160** — minimum and maximum panel widths.
- **OQ-161** — back-stack depth limit per tab.
- **OQ-162** — should focus-existing also match across **vaults**? When the user switches vaults, prior routes in the old vault become unreachable; do their windows close, or remain in a "stale" state until restoration?

## Cross-doc updates needed

- [33-windows-and-menus.md](33-windows-and-menus.md) — `WindowEntry` gains `route`, `navStack`, `groupKind`. Tabs section gets a forward reference to this doc for the nav-stack + mode plumbing. Add panel groups as a sibling concept to tab groups in §Part 2.
- [17-interoperability.md](../platform/17-interoperability.md) — `intent.open` dispatch resolves through the navigation resolver; cross-reference here. Default-handler section gains a sibling concept: default *mode*.
- [31-linking-protocol.md](../platform/31-linking-protocol.md) — route canonicalization rules cited from here; the ephemeral query allowlist is defined here. Anchor-stable navigation behavior (focus existing, then scroll) clarified.
- [08-app-sdk.md](../apps/08-app-sdk.md) — `ui.navigate`, `ui.windows.setRoute`, `ui.navigation.back/forward`, and the `<Link>` component land in the SDK surface.
- [27-layouts.md](27-layouts.md) — `chrome.actionBar` references back/forward affordances; `chrome.tabs` references per-tab `navStack`.
- [25-settings.md](25-settings.md) — Defaults section gains per-`(verb, type, source-app)` mode entries alongside the existing per-`(verb, type)` handler entries.
- [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md) — modifier conventions for navigation modes (`Mod+Click`, `Mod+Shift+Click`, `Alt+Click`) registered as shell-default rebindable shortcuts; `Mod+[ / Mod+]` for back/forward.

## Summary

- Every window has a **route** — a `brainstorm://` URI it currently displays. The shell tracks routes; apps publish them via `ui.windows.setRoute`.
- **Focus-existing**: if a route is already shown somewhere, navigation focuses that window instead of opening a duplicate. Modifier keys override.
- **Four navigation modes** (replace / new-tab / new-window / new-panel) — uniform across apps, modifier-keyed, with per-(verb, type, source-app) defaults users can change.
- **Panel groups** are cross-app, side-by-side window arrangements rendered as one OS window with multiple child renderers. Arc-style columns; v1 columns-only.
- **Intra-app tabs** (per [33](33-windows-and-menus.md)) gain per-tab routes, back-stacks, and back/forward shortcuts. The shell ships the tab strip via `chrome.tabs`; apps opt in once.
- The SDK provides one `<Link>` component every app uses for internal navigation. Modifier keys, context menus, drag payloads, and accessibility come from the component, not the app.
- A single shell **navigation resolver** is called by `<Link>`, by intent dispatches, by deep-link follows, and by the launcher — same code path for every navigation in the product.
- Privacy boundaries: apps see only their own windows' routes; cross-app navigation discloses no other-app state to the dispatcher beyond `{ok: true, focused}`.
