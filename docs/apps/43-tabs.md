## 43 — Tabs: opting your app into shell-managed tab groups

Tabs in Brainstorm are a **shell feature**, not an app feature. Apps don't ship a tab strip — the shell groups multiple windows of the same app into one OS-level window with a tab bar, and routes per-tab navigation through a single SDK. App authors only need to: (a) opt in (or out) via the manifest, (b) publish a `route` whenever the content changes, and (c) trigger new tabs through `ui.navigate(..., { mode: "new-tab" })`.

This doc is the app-author-facing reference. The shell-side design is in [33-windows-and-menus.md §Tabs](../shell/33-windows-and-menus.md) (grouping mechanics) and [37-cross-app-navigation.md §Intra-app tabs revisited](../shell/37-cross-app-navigation.md) (routes + nav stack). Read those if you need to understand why the model is the way it is; this doc is the contract.

## When to use tabs

Apps with **multiple long-lived focused surfaces of the same kind**:

- A text editor that lets you open many documents
- A database that lets you flip between lists
- A code editor with multiple files open
- A graph explorer with several saved patterns

Apps with a **single, fixed surface** (a settings panel, a popover-style picker, a one-shot dialog) should **not** use tabs — they declare `tabbing: "single"` instead and stay as freestanding windows.

## Manifest declaration

```jsonc
{
  "id": "io.example.editor",
  // …
  "windowing": {
    "tabbing": "supported"
  }
}
```

| Value             | Meaning                                                                                     |
|-------------------|---------------------------------------------------------------------------------------------|
| `"supported"`     | (default) Windows can be tabbed if the user / shell requests; can also stand alone.         |
| `"single"`        | Windows are always standalone; never tabbed. Use for settings, popovers, dialogs.           |
| `"always-tabbed"` | New windows open inside an existing tab group of the same app whenever one exists.          |

If `windowing` is omitted, the shell treats the app as `"supported"`.

## How tabs appear

The OS-level rendering depends on the platform:

- **macOS** — windows share a tabbing identifier via `BrowserWindow.setTabbingIdentifier()`. The native tab bar from AppKit shows. View > Show Tab Bar / Move Tab to New Window work out of the box.
- **Windows / Linux** — the shell renders its own tab strip in the `chrome.tabs` layout cell (per [27-layouts.md](../shell/27-layouts.md)). One OS window hosts the strip plus the focused tab's content.

Both modes produce the same SDK surface — the app doesn't branch on platform.

## What you get for free

Per the shell-managed contract, your app does not implement any of the following:

- The tab strip (rendering, hover, drag-to-reorder, close button).
- Tab focus events. Each tab's renderer keeps running; switching tabs is a focus change, not a re-mount.
- Per-tab `route`, `navStack`, and lifecycle. Each tab has its own URL-like address and back-stack.
- Drag-out promotion (tab → standalone window) and drag-in demotion (window → tab in a group). Both are dashboard / OS gestures.
- Back / forward navigation (`Mod+[` / `Mod+]`). The shell drives these against the focused tab's `navStack`.

## What you publish + call

Two SDK touch-points keep tabs working:

### 1. Publish your route whenever the content changes

```ts
import { ui } from "@brainstorm/sdk";

// On entity load / change / focus:
ui.windows.setRoute("brainstorm://entity/ent_X");
```

The shell stores this on the `WindowEntry` and uses it for **focus-existing** matching (a new navigation to the same route focuses your existing tab rather than opening a duplicate) and for the tab's display label / icon (the shell looks up the entity to render the tab chrome).

Apps that don't publish routes still work — they just don't participate in focus-existing or back-stack semantics, and their tabs show a generic label.

### 2. Open new tabs through `ui.navigate`

```ts
import { ui } from "@brainstorm/sdk";

// Plain click: replace in current tab.
ui.navigate({ route: "brainstorm://entity/ent_Y", mode: "replace" });

// Cmd+Click / "Open in new tab":
ui.navigate({ route: "brainstorm://entity/ent_Y", mode: "new-tab" });
```

In practice you rarely call `ui.navigate` directly — instead you render the SDK's `<Link>` component, which inspects modifier keys and dispatches the right mode automatically (per [37 §The Link component](../shell/37-cross-app-navigation.md)). Use `ui.navigate` for keyboard shortcuts, command-palette results, and programmatic flows.

## Back / forward

Each tab has its own `navStack`. The shell ships `Mod+[` / `Mod+]` shortcuts, plus:

- `ui.navigation.canGoBack()` / `ui.navigation.canGoForward()` — for rendering arrow affordances in `chrome.actionBar`.
- `ui.navigation.back()` / `ui.navigation.forward()` — programmatic.

Back-stack entries are pushed automatically whenever your app calls `ui.windows.setRoute` with a different route. You don't manage the stack yourself.

## Promotion / demotion

The user — not the app — controls grouping:

- **Drag a tab out** of the tab strip → it becomes a freestanding window (or detaches into a new OS window on macOS).
- **Drag a freestanding window onto a tab strip** of the same app → it joins the group.
- **Right-click a tab → "Move to New Window"** does the same as drag-out.

Apps that declare `tabbing: "single"` opt out of both; their windows ignore the drag targets.

## Anti-patterns

- **Don't build your own tab strip.** It will be visually inconsistent with the shell's chrome and won't participate in the focus-existing, drag-out, and back/forward machinery.
- **Don't navigate without publishing the route.** A click that updates content without `ui.windows.setRoute` will produce duplicate tabs the next time the user clicks the same link.
- **Don't gate behaviour on platform.** The SDK surface is the same on every OS; let the shell handle the native vs. cross-platform rendering split.

## Caveats and limits

- **Intra-app only.** Tabs never mix apps. v2 will revisit "project-scoped" cross-app tab groups (OQ-136); v1 keeps it simple.
- **`always-tabbed` is opt-in.** Most apps want `"supported"`; choose `"always-tabbed"` only if a freestanding window of your app feels out of place by default.
- **Back-stack depth.** The shell caps each tab's `navStack` at a configurable limit (default 100 entries, oldest evicted — see [37 §OQ-161](../shell/37-cross-app-navigation.md)).

## See also

- [33-windows-and-menus.md §Tabs as a shell feature](../shell/33-windows-and-menus.md) — manifest schema, macOS native vs. cross-platform rendering, the cross-app-tabs decision.
- [37-cross-app-navigation.md §Intra-app tabs revisited](../shell/37-cross-app-navigation.md) — routes, `navStack`, the `<Link>` component, back/forward.
- [27-layouts.md](../shell/27-layouts.md) — the `chrome.tabs` cell.
- [08-app-sdk.md](08-app-sdk.md) — the `ui.windows.*` and `ui.navigate` SDK surface.
