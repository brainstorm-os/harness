# 33 — Windows and system menus

This doc covers **two related concerns** in the shell-as-host layer: the **Electron application menu** (the OS-native menu bar / per-window menu) and **cross-window coordination** — making the dashboard aware of and able to control all open app windows. The bigger conceptual move here is treating windows as **first-class addressable things the dashboard knows about**, not just OS-level frames each app manages alone.

It builds on [04-shell.md](04-shell.md) (dashboard surfaces), [12-shell-architecture.md](12-shell-architecture.md) (window manager internals), [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md) (shortcut ↔ menu binding), [27-layouts.md](27-layouts.md) (chrome cells include `tabs`), and [13-frontend-stack.md](13-frontend-stack.md) (themes, icon packs).

## Goals

1. The OS-native application menu reflects what the user can do *now* — shell items always, focused-app items when an app has focus. No one-size menu.
2. The dashboard knows what windows are open and can show / switch / arrange them.
3. Tab-style window grouping is a first-class affordance, not a per-app reinvention.
4. Window state is recoverable across crash and restart (already promised in [12-shell-architecture.md](12-shell-architecture.md)); add cross-device window-arrangement persistence (post-v1).
5. Apps don't control other apps' windows directly — coordination flows through the shell, capability-checked.

## Part 1 — The system menu

### Per-platform behavior

| OS         | Where the menu lives                                  | Visible content                                     |
|------------|-------------------------------------------------------|-----------------------------------------------------|
| macOS      | Global menu bar at the top of the screen              | Always reflects the focused window's app + shell    |
| Windows    | Per-window, attached below the title bar (or inside custom chrome) | Per-window, focused window's contents only |
| Linux      | Per-window (GNOME, KDE) or global (Unity, some others) | Same as Windows in most cases                       |

Brainstorm's menu has the same logical content on every platform; the host-OS difference is rendering and where it appears.

### Logical structure

> **Decision:** the menu is **composed by the shell** at runtime from three sources:
>
> 1. **Shell-owned items** — global, always present (Brainstorm > About / Settings / Quit on macOS; File > New Vault / Open Vault on every platform; Window > shell-managed window operations; Help).
> 2. **Currently-focused-app items** — the app whose window has focus contributes File-relevant, Edit-relevant, View-relevant, app-specific items. When focus changes, the menu changes.
> 3. **Standard items** — system-level Edit (Cut, Copy, Paste, Undo, Redo, Select All), Window (Minimize, Zoom, Bring All to Front), and Help defaults filled in by Electron from OS conventions.

### What apps declare

Apps add menu items via their manifest:

```jsonc
{
  "menus": [
    {
      "menu": "File",
      "items": [
        { "id": "new-document", "label": { "$key": "io.example.editor/menu.newDocument" }, "shortcut": "Mod+N" },
        { "id": "open-document", "label": { "$key": "..." }, "shortcut": "Mod+O" },
        { "type": "separator" },
        { "id": "save", "label": { "$key": "..." }, "shortcut": "Mod+S" }
      ]
    },
    {
      "menu": "Edit",
      "items": [
        { "type": "system", "role": "undo" },
        { "type": "system", "role": "redo" },
        { "type": "separator" },
        { "type": "system", "role": "cut" },
        { "type": "system", "role": "copy" },
        { "type": "system", "role": "paste" },
        { "type": "separator" },
        { "id": "find-in-doc", "label": { "$key": "..." }, "shortcut": "Mod+F" }
      ]
    },
    {
      "menu": "Format",
      "items": [
        { "id": "bold", "label": { "$key": "..." }, "shortcut": "Mod+B" },
        { "id": "italic", "label": { "$key": "..." }, "shortcut": "Mod+I" }
      ]
    }
  ]
}
```

The shell merges app items with shell items into the appropriate top-level menu. New top-level menus an app introduces (`Format` above) appear after the shell's standard ones (File / Edit / View) and before Window / Help.

> **Decision:** the **menu order** at the top level is shell-controlled: `Brainstorm` (macOS only) / `File` / `Edit` / `View` / `<app-introduced menus in declaration order>` / `Window` / `Help`. Apps can extend; they cannot reorder shell-owned menus.

### Triggering: menu item → action

When the user clicks a menu item:

1. The shell's menu handler resolves the click to the contributing app's id.
2. If it's a shell item, the shell handles directly.
3. If it's an app item, the shell dispatches an internal-intent to the focused app's renderer (a private channel for menu actions, not the public `intent.dispatch`).
4. The app's menu handler executes the action.

Shortcuts (per [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md)) and menu items are **two views of the same action registry**: a menu item with a shortcut binds the shortcut automatically. The user rebinding a shortcut updates the menu item's displayed accelerator.

> **Decision:** menu item ids and shortcut ids share the same namespace per app (`<app-id>/<id>`). A single registration declares the action; shortcut and menu items reference it.

### Standard items

The shell fills in standard items the OS expects:

- **Brainstorm menu** (macOS) — About Brainstorm, Settings, Hide Brainstorm, Hide Others, Show All, Quit.
- **File menu** — New Vault, Open Vault, Open Recent, Close Window, separator, app-contributed items.
- **Edit menu** — Undo, Redo, Cut, Copy, Paste, Paste and Match Style, Delete, Select All — all `role`-based, OS-native behavior.
- **View menu** — Toggle Full Screen, Zoom In, Zoom Out, Reset Zoom, app-contributed items.
- **Window menu** — Minimize, Zoom, Cycle Through Windows, Bring All to Front, separator, **list of all open windows** (see Part 2 below).
- **Help menu** — Brainstorm Help, Keyboard Shortcuts, Send Feedback, About (Windows/Linux).

> **Decision:** the Window menu's window-list is the same data the dashboard's window-list widget reads. One source of truth.

### Translation

Menu item labels use the `$key` translation references from [21-localization.md](../platform/21-localization.md). Standard items (`role: undo`) use OS-native localizations automatically.

### What apps cannot do

- Change the menu when their window is **not** focused. (No "menus from background apps" — only the focused app contributes.)
- Add items to the Brainstorm menu (macOS-specific) — that's shell-only.
- Reorder shell items.
- Add items to other apps' menus.

> **Decision:** menu manipulation is bounded to the contributing app's own additions; the shell composes the final menu.

### Tray menu (separate)

The tray menu (per [04-shell.md](04-shell.md)) is a different surface, requested via the `tray.publish` capability. Tray menus are app-rendered via `fancy-menus` (per [13-frontend-stack.md](13-frontend-stack.md)), not OS-native menus. Distinct from the application menu.

## Part 2 — Cross-window coordination

The bigger conceptual move: making the **window** a first-class addressable thing the dashboard knows about, can show, and can switch to.

### The window index

The shell's window manager (per [12-shell-architecture.md](12-shell-architecture.md)) already tracks `(app_id, window_id)` pairs. Surface that as a **window index** — an in-memory list updated as windows open, close, focus, resize, get titles updated. Records:

```ts
type WindowEntry = {
  windowId: string;            // shell-assigned ULID
  appId: string;
  appName: string;             // resolved at index time
  windowName?: string;         // app-supplied (per 03-app-model.md app may name windows like "main", "inspector")
  title: string;               // current title (entity name, document title, etc.)
  iconRef?: string;            // resolved icon — current entity's icon, or app icon as fallback
  monitorId: string;
  bounds: { x, y, width, height };
  state: "normal" | "minimized" | "maximized" | "fullscreen" | "hidden";
  focused: boolean;
  lastFocusedAt: number;       // for MRU ordering
  thumbnail?: ImageData;       // recent screenshot, optional, captured at focus-change events
  group?: string;              // tab-group id if windowed into a group
};
```

> **Decision:** the window index is **maintained by the shell main process** and exposed to the dashboard renderer via a privileged host service (`shell.windows.*`). Apps cannot read the index directly — only the dashboard does (it's a privileged shell surface, per [04-shell.md](04-shell.md)).

> **Decision:** the dashboard subscribes to the window index via Yjs-like change events. New windows, focus changes, title changes flow as updates; the dashboard re-renders affected widgets reactively.

### What the dashboard does with it

The dashboard treats itself as **the OS shell of the user's vault** — open windows are visible *on the dashboard*, switchable from *the dashboard*, and managed *on the dashboard*. Three surfaces drive on the index. The first two are the load-bearing ones; the third (OS-native Window menu) is the platform's expected behavior.

#### 1. Running-apps surface on the dashboard

The dashboard renders a **running-apps area** — a always-present strip / dock / live tiles section (exact UX TBD per OQ-140) showing every open window with app icon, current title, route, focus indicator, and a live thumbnail when one is available. This is **not** an optional widget like the calendar or weather; it is part of the dashboard's primary surface, analogous to a desktop OS's dock or taskbar.

> **Decision:** the running-apps surface is **always visible** on the dashboard, not an optional widget. Personal-by-default still applies (the user can choose the visual treatment — strip / grid / overlay-on-hover — but not whether running windows are surfaced at all). The lack of a window-list parallel in single-window prior tools is a coherence cost users feel; we don't repeat that.

Interaction:

- **Click** a row / tile → focuses the window (route-aware focus per [37-cross-app-navigation.md](37-cross-app-navigation.md)).
- **`Mod+Click`** → opens a duplicate-route window (overrides focus-existing per [37](37-cross-app-navigation.md)).
- **Right-click** → context menu: minimize, restore, close, move to monitor, add to tab group, add to panel group, "Send to background workspace" (post-v1).
- **Drag** a window-tile onto another → forms a tab group (intra-app) or a panel group (cross-app) per [37](37-cross-app-navigation.md).
- **Drag** a window-tile onto the wallpaper → minimizes that window. Drag from the running-apps area onto a panel-group divider → adds the window as a panel.

> **Decision:** the dashboard's running-apps surface is **the single canonical OS-shell-style affordance** in Brainstorm. We don't ship a separate dock, taskbar, or activity bar widget. One surface, one source of truth.

#### 2. Window switcher overlay (Alt+Tab equivalent)

A keyboard-driven full-screen overlay shows all open windows with **live thumbnails** and titles, navigable by keyboard alone. This is the **Alt+Tab equivalent for Brainstorm windows** — users coming from macOS / Windows / Linux expect a "show me everything I have open, let me arrow over to it, hit Enter to switch" affordance.

Keystrokes (defaults, per [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md), rebindable):

| OS       | Open switcher (hold)             | Step forward / back  | Commit          |
|----------|----------------------------------|----------------------|-----------------|
| macOS    | `Cmd+\``                         | `Tab` / `Shift+Tab`  | release `Cmd`   |
| Windows  | `Ctrl+\``                        | `Tab` / `Shift+Tab`  | release `Ctrl`  |
| Linux    | `Ctrl+\`` (X11/Wayland may vary) | `Tab` / `Shift+Tab`  | release `Ctrl`  |

> **Decision:** Brainstorm does **not** rebind the OS-level Alt+Tab / Cmd+Tab. Those remain owned by the OS for inter-application switching. The Brainstorm switcher is **intra-product** — it switches between Brainstorm's own windows, including those in panel groups and tab groups (which the OS sees as a single window). `Mod+\`` is the standard "switch windows within this app" macOS convention; we extend it to Windows / Linux for cross-platform consistency.

Display modes (one Settings toggle; default `grid`):

- **`grid`** — Mission Control / Exposé style. Tiles arranged in a grid, sized by window. Live thumbnails. Mouse-friendly.
- **`list`** — vertical list of rows with app icon + title + small thumbnail. Keyboard-friendly. Default for accessibility-mode users.
- **`mru-strip`** — horizontal strip of large thumbnails in MRU order. Classic Alt+Tab feel.

> **Decision:** the switcher is **a fancy-menus surface** — body kind `grid` / `list` / `mru-strip` driven by the same window index that feeds the dashboard's running-apps area. One data source, three presentations.

Live thumbnails:

> **Decision:** thumbnails are captured at focus-change events plus an optional **slow background refresh** every 30s for visible-on-dashboard windows (covers the case where a window's content updates while another is focused). Capture happens in the main process via Electron's `webContents.capturePage`; thumbnails ride the window-index update stream. Apps cannot capture thumbnails of other apps — that boundary stays in §Threat / capability model below. (Resolves part of OQ-135; the rest is the precise capture rate.)

#### 3. Window menu integration

The OS-native Window menu (per Part 1) lists all open windows in MRU order at the bottom. Same data as the dashboard's running-apps surface; same source.

### Tabs as a shell feature

> **Decision:** Brainstorm supports **tab-style window grouping** as a shell-managed feature. Apps don't implement tabs themselves; the shell groups windows.

> **Refinement (OQ-241):** the canonical mental model is **Chrome's** — the tab is the primary unit *inside* a window, opening an object opens a **new tab in the focused window** (`Mod+Click` = new window), and tabs can be **pinned** (icon-only, left-anchored, ordered before unpinned, restored on vault reopen via `WindowSessionState.groups`). This supersedes the *merge-separate-windows* framing below as the user model; the shell still owns the strip (apps never draw tabs), rendered via the `chrome.tabs` cell, with macOS native tabs as a platform rendering of the same group. Tabs stay intra-app in v1.

Two modes, picked per OS:

#### macOS native tabs

macOS supports per-app native tabs via `BrowserWindow.setTabbingIdentifier()`. Multiple windows with the same tabbing identifier are merged into one OS window with a native tab bar.

> **Decision:** on macOS, windows of the same app share a tabbing identifier by default. The user can opt windows into / out of a tab group via View > Show Tab Bar / Move Tab to New Window (OS-native behavior).

#### Cross-platform tab groups

On Windows and Linux (no native window tabs), Brainstorm renders its own tab strip via the `chrome.tabs` cell (per [27-layouts.md](27-layouts.md)). A tab group is a single OS window hosting multiple panes, one per "tab."

> **Decision:** tab groups are **opt-in per app**. An app's manifest declares whether its windows can be grouped:
>
> ```jsonc
> "windowing": {
>   "tabbing": "supported"  // | "single" | "always-tabbed"
> }
> ```
>
> - `supported` (default for most apps) — windows can be tabbed if the user requests; can also stand alone.
> - `single` — windows are always standalone; cannot be tabbed (e.g., a settings window, a popover-style panel).
> - `always-tabbed` — opens within an existing tab group of the same app by default (e.g., a code editor that strongly prefers tabbed-by-default).

### Cross-app tab groups?

> **Decision:** v1 does **not** support cross-app tab groups. Tabs are intra-app only. Cross-app tabs raise complex questions about shared state, focus events, and capability boundaries — defer to v2.

> **Open:** v2 — should tabs span apps (e.g., a "current project" tab group containing a Notes window, a Database window, a Files window all related to one project)? Useful but raises the cross-app complexity. Tracked as OQ-136.

### Window-control capabilities

Apps cannot control other apps' windows. Apps can control their own windows via the existing `ui.openWindow / ui.closeWindow` (per [08-app-sdk.md](../apps/08-app-sdk.md)).

The dashboard (privileged surface, not an app) can:
- Focus any window.
- Minimize / restore any window.
- Close any window (with the app's permission — the app handles `before-close` per its own logic).
- Move a window to a monitor / position.
- Group windows into a tab group (where supported).

> **Decision:** these dashboard actions correspond to capabilities the shell self-grants to its own dashboard renderer. They are not exposed to apps. New capability namespace: `shell.windows.*` (shell-internal only).

### Window & tab state persistence

Goal 4 promises window state is recoverable across crash and restart. This is the concrete v1 mechanism — distinct from the speculative *saved arrangements* in Part 3 (which are user-named, on-demand snapshots). This is the **automatic, always-on** restore of "what the user had open" so a crash or quit-and-relaunch is non-destructive.

#### What is persisted

A `WindowSessionState` is derived from the live window index — the durable subset of `WindowEntry`, plus tab-group structure:

```ts
type WindowSessionState = {
  windows: Array<{
    appId: string;
    windowName?: string;          // app-supplied window role ("main", "inspector")
    route?: string;               // the cross-app route (per 37-cross-app-navigation.md) — which entity/view was open
    bounds: { x, y, width, height };
    monitorId: string;            // best-effort; falls back if the monitor is gone at restore
    state: "normal" | "minimized" | "maximized" | "fullscreen";
    group?: string;               // tab-group id
    lastFocusedAt: number;        // restore focus to the MRU window
  }>;
  groups: Array<{
    groupId: string;
    appId: string;                // intra-app only in v1 (cross-app groups are OQ-136, v2)
    tabOrder: string[];           // ordered window keys within the group
    activeTab: string;            // which tab was foreground
  }>;
};
```

> **Decision:** persistence stores **route, not content**. The session records *which entity / view a window had open* (its route), not a copy of the rendered state. On restore the shell re-opens each app at its route; the app rehydrates from its own entity store. This keeps the session state small, avoids stale snapshots, and means restore correctness is the app's existing route-load path — not a second serialization format to keep in sync.

> **Decision:** `hidden` windows are **not** persisted (a hidden window is transient app UI, not user-facing state). `minimized` / `maximized` / `fullscreen` *are* — they're user intent.

#### Where it lives

> **Decision:** `WindowSessionState` is **vault-scoped**, written by the shell main process to the vault's local app-state store (per [12-shell-architecture.md](12-shell-architecture.md)), not synced. It is per-device by design — window bounds and monitor ids are device-specific. Cross-device window-arrangement sync stays post-v1 (phasing table; Goal 4 second clause).

It is keyed by vault, so opening a different vault restores *that* vault's last window set, and the dashboard's own window is excluded (the shell owns the dashboard's lifecycle separately).

#### When it is written

> **Decision:** the session is written on a **coalesced, debounced** schedule off the same window-index update stream that feeds the dashboard — on window open/close, move/resize settle (debounced ~500ms), tab-group change, and focus change. Plus a final write on graceful quit. The debounce keeps a drag-resize from thrashing the store; the index stream means there is no second observation path to maintain.

Because writes are incremental and frequent, a crash loses at most the last sub-second of geometry changes — never the set of open windows.

#### Restore flow

On vault open the shell:

1. Reads `WindowSessionState` for that vault.
2. Filters windows whose `appId` is no longer installed (skipped silently) and clamps `bounds` to currently-attached monitors (a window saved on a now-disconnected display is re-placed on the primary monitor, not lost off-screen).
3. Re-creates tab groups first (so member windows open *into* their group per the `chrome.tabs` cell / macOS `tabbingIdentifier`), then standalone windows.
4. Restores each window's `state` and routes its app to the saved `route`.
5. Focuses the window with the greatest `lastFocusedAt`.

> **Decision:** restore is **best-effort and fail-soft**. Any single window that fails to restore (app errored on its route, manifest changed incompatibly) is logged and skipped; the rest of the session still comes back. A corrupt `WindowSessionState` is discarded and the shell starts with just the dashboard — restore never blocks startup.

> **Open:** should restore be **automatic** or behind a "Reopen windows from last session" affordance (like browsers' session-restore prompt)? Leaning automatic for crash recovery, with a Settings opt-out and a one-shot "don't reopen" on the next launch after a crash loop. Tracked as OQ-141.

#### What this is *not*

This is not the Part 3 `Workspace/v1` entity (OQ-138). That is an explicit, user-named, potentially-synced, switchable arrangement. This is the implicit single "last session" per vault. The two share the `WindowSessionState` shape — a saved Workspace is essentially a named, pinned `WindowSessionState` — so the v2 workspace work builds on this, it does not replace it.

## Part 3 — Workspaces and saved arrangements

This part is more speculative — design ideas the user asked for, not v1 commitments.

### Workspaces

Like macOS Spaces or Linux workspaces: multiple "desktops" within Brainstorm, each with its own dashboard wallpaper, icons, widgets, and window set. Switching workspaces hides one set, shows another.

> **Open:** is this in v1 or v2?
> - **In v1:** if the implementation is just "multiple dashboard layouts" leveraging the existing layout entities (per [27-layouts.md](27-layouts.md)), it's tractable.
> - **Not in v1:** if it requires deep changes to window-state persistence and OS-level interaction.
>
> Tracked as OQ-137. Tentative leaning: post-v1; the dashboard already has icons + widgets + window-list, which covers most needs. Workspaces are a refinement.

### Saved window arrangements

Like tmux sessions or VS Code workspaces. A user has 4 windows arranged a particular way for "doing finance." They save the arrangement as an entity. Re-opening the entity restores the windows and their arrangement.

> **Open:** **Workspace entity type** — `brainstorm/Workspace/v1`? Records: which apps are running, which entities they have open, window positions/sizes/monitors, tab grouping. Not a Layout (which is content-rendering); a *workspace* (which is window-arrangement).
>
> Tracked as OQ-138. Tentative leaning: post-v1, but the data model design happens with the file-manager doc since it relates to entity-organization.

### Window groups (lightweight grouping)

A simpler precursor to workspaces: ad-hoc grouping of currently-open windows. "These three windows are about Project X." Group has a name, a color. Visible as a section in the dashboard window-list and as a label on each member window.

> **Open:** is this just metadata on `WindowEntry`, or a separate entity type? Tracked as OQ-139.

## Performance considerations

| Concern                                       | Mitigation                                                              |
|-----------------------------------------------|-------------------------------------------------------------------------|
| Window thumbnail capture                      | Capture only on focus-change, not periodically. Throttle to ~1/s max.   |
| Window-index update broadcast                 | Coalesce events to ~16ms (one per frame). Subscribers re-render on next frame. |
| Global window switcher rendering 50+ windows  | `@tanstack/react-virtual` for the list; thumbnails lazy-loaded.          |
| Per-OS native menu rebuild on focus change    | Electron handles efficiently; menu state diff'd, not full rebuild.       |

## Threat / capability model

- The window index is a **privileged surface** — only the shell's dashboard renderer reads it. Apps cannot enumerate other apps' windows or know which are open.
- Apps **cannot** capture screenshots of other apps' windows. The shell's thumbnail capture happens in the main process; thumbnails go to the dashboard renderer only.
- The OS-native menu is rendered by Electron; Brainstorm provides structure but cannot override OS-level menu behavior (security feature of Electron).

> **Decision:** the dashboard renderer is the only place that can see window-index data. Even other shell surfaces (the launcher, the settings window) get filtered views.

## Phasing

| Capability                                       | v1   | v2  |
|--------------------------------------------------|------|-----|
| Shell + focused-app menu composition             | ✓    | ✓   |
| Standard menu items via Electron `role`          | ✓    | ✓   |
| Manifest-declared menu items + shortcuts unified | ✓    | ✓   |
| Window index (main process, exposed to dashboard) | ✓    | ✓   |
| Dashboard running-apps surface (always-visible, OS-shell-style) | ✓ | ✓ |
| Window switcher overlay (`Mod+\\\``) with live thumbnails        | ✓ | ✓ |
| Three switcher display modes (grid / list / mru-strip)           | ✓ | ✓ |
| Window menu listing all open windows              | ✓    | ✓   |
| macOS native tabs via tabbingIdentifier           | ✓    | ✓   |
| Cross-platform tab groups via `chrome.tabs`       | ✓    | ✓   |
| Tab groups intra-app only                        | ✓    | ✓   |
| Automatic per-vault window/tab session restore   | ✓    | ✓   |
| Cross-app tab groups                             | —    | ✓ (post-OQ-136) |
| Workspaces                                       | —    | ✓ (post-OQ-137) |
| Saved window arrangements (`Workspace/v1` entity) | —    | ✓ (post-OQ-138) |
| Window groups (ad-hoc, in-memory)                | —    | ✓ (post-OQ-139) |
| Cross-device window-arrangement sync             | —    | ✓   |

## Cross-doc updates needed

- [04-shell.md](04-shell.md) — note that the window-list widget is a first-party widget; the launcher / window-switcher coexist.
- [12-shell-architecture.md](12-shell-architecture.md) — the window manager exposes the window index to the dashboard renderer via a privileged service; it also derives + persists per-vault `WindowSessionState` to the vault's local app-state store and restores it on vault open.
- [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md) — menu items + shortcuts share the same registry.
- [27-layouts.md](27-layouts.md) — `chrome.tabs` cell renders the cross-platform tab strip.
- [21-localization.md](../platform/21-localization.md) — menu labels use `$key` translation references.
- [03-app-model.md](../apps/03-app-model.md) — app manifest gains `menus` and `windowing.tabbing` fields.

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-135** — window thumbnail capture cadence (focus-change-only vs periodic).
- **OQ-136** — cross-app tab groups (v2).
- **OQ-137** — workspaces (multi-dashboard with own window sets); v1 or v2?
- **OQ-138** — `Workspace/v1` entity type for saved window arrangements.
- **OQ-139** — window groups: metadata-on-entry vs separate entity type.
- **OQ-140** — should the dashboard's window-list be a chrome cell on the dashboard layout (per [27](27-layouts.md)), so users can reposition / restyle it like any chrome?
- **OQ-141** — automatic window/tab session restore vs. an explicit "reopen last session" prompt (and crash-loop opt-out behavior).

## Summary

- **The Electron application menu** is composed by the shell from three sources: shell items (always), focused-app items (per manifest), and OS-standard items (`role`-based). One declaration drives both menu items and keyboard shortcuts.
- **The window index** lives in the shell main process and is exposed only to the dashboard renderer (privileged surface). Apps cannot enumerate other apps' windows.
- **Three dashboard surfaces** drive on the index: window-list widget, window switcher overlay (`Mod+\\\``), and the OS Window menu's window-list.
- **Tabs are a shell-managed feature** — macOS native tabs via `tabbingIdentifier`; cross-platform tab groups via `chrome.tabs` cell. Apps opt in per manifest.
- **Window & tab state is persisted automatically per vault** — a route-based (not content-based) `WindowSessionState` derived from the window index, written debounced off the index stream, restored fail-soft on vault open. Distinct from the v2 user-named `Workspace/v1` (OQ-138), which it underpins (OQ-141).
- **No cross-app tabs in v1** — defer to v2 (OQ-136).
- **Workspaces, saved window arrangements, ad-hoc window groups** — design ideas tracked as OQs (137-139); leaning post-v1.
- v1 ships full menu composition + window index + dashboard widget + switcher overlay + intra-app tabs. v2 ships cross-app and persistence-based extensions.
