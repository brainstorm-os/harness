# 24 — Keyboard shortcuts

This doc covers Brainstorm's keyboard-shortcut architecture. There are shell-wide shortcuts that always work (intercepted in main, preempt the app), plus per-app shortcuts active when an app has focus. Both are user-rebindable. All bindings are personal by default (per the principle in [01-vision.md](../foundations/01-vision.md)). Unlike VS Code (app wins), Brainstorm is shell-first: app shortcuts only override the shell when the manifest declares `shadowsShell` and the user approves at install.

> Shortcuts are **accelerators** for actions that must already be reachable by some other path (Tab, Arrow, F6, mouse, menu). The other half of keyboard handling — **Tab order, arrow-key composite navigation, focus traps, focus restoration, Escape stack, region jumps** — is the [61-keyboard-accessibility.md](61-keyboard-accessibility.md) `KBN` ladder. The split is: bare keys inside a focused composite (Tab/Arrow/Home/End/Enter/Space/Esc/F6) belong to 61; modifier chords and named action verbs belong here.

Builds on [04-shell.md](04-shell.md), [08-app-sdk.md](../apps/08-app-sdk.md), and [13-frontend-stack.md](13-frontend-stack.md) (react-aria for keyboard handling primitives).

## Goals

1. Shell shortcuts are predictable across the system; they work regardless of which app is focused.
2. App shortcuts are scoped — they activate only when their app holds focus.
3. Users can rebind freely; nothing is hardcoded.
4. Conflicts are surfaced to the user at the moments they can act on them (install, rebind); they are never overwritten without trace.
5. Discovery is easy — there is always a way to find "what shortcut does this".
6. Bindings sync across the user's devices but are personal by default.
7. Apps publish their full shortcut surface to the shell (statically via manifest, dynamically via a typed IPC). The cheatsheet, settings panel, and `aria-keyshortcuts` hints all read from one aggregated source.

## The two layers

### Shell layer (always active)

The shell owns a small set of system-level shortcuts that work whether an app is focused or not:

| Default chord (mac / win-linux)       | Action                                              |
|---------------------------------------|-----------------------------------------------------|
| `⌘ Space` / `Ctrl Space`              | Open the launcher.                                   |
| `⌘ ,` / `Ctrl ,`                      | Open settings.                                       |
| `⌘ N` / `Ctrl N`                      | New entity (with a quick-pick of types).             |
| `⌘ \`` / `Ctrl \``                    | Switch between open windows.                         |
| `⌘ W` / `Ctrl W`                      | Close current window.                                |
| `⌘ Q` / `Ctrl Q`                      | Quit Brainstorm.                                     |
| `⌘ Shift K` / `Ctrl Shift K`          | Show shortcuts cheatsheet for current context.       |
| `?`                                   | Open the contextual help (when no input is focused). |

Shell shortcuts cannot be disabled, but their chord can be rebound. (Rebinding `⌘ Space` to nothing is a way to disable it; rebinding to a different chord works.)

### App layer (active when app has focus)

Apps register shortcuts in their manifest:

```jsonc
"shortcuts": [
  { "id": "save",          "default": "Mod+S",             "label": "Save",                 "scope": "window" },
  { "id": "format-bold",   "default": "Mod+B",             "label": "Bold",                 "scope": "editor" },
  { "id": "find-in-doc",   "default": "Mod+F",             "label": "Find in document",     "scope": "window" },
  { "id": "outline-toggle","default": "Mod+Shift+O",       "label": "Toggle outline",       "scope": "window" }
]
```

- `id` is app-scoped (`<app-id>/<id>` is the global id).
- `default` is the suggested chord. `Mod` is the platform-appropriate modifier (`⌘` on macOS, `Ctrl` elsewhere).
- `label` is what appears in the cheatsheet and rebinding UI (translatable per [21-localization.md](../platform/21-localization.md)).
- `scope` narrows when the shortcut is active: `window` (anywhere in the app's windows), `editor` (only when an editor surface has focus), `selection` (only when something is selected), or app-defined custom scope strings.

App shortcuts fire when the app's window has OS-level focus and the chord is not claimed by the shell layer (see §Delivery mechanics — shell intercepts first in the main process, and only un-matched chords propagate into the app renderer).

### Manifest is the source of truth

Apps declare their full shortcut surface in the manifest. The shell mirrors those entries into the main-process `ShortcutRegistry` under the `app/<app-id>/<id>` namespace at install time. Runtime registration via the SDK (`useShortcut(id, handler)`) looks the chord up in the registry — apps never hand-write chord strings in their renderer code, which is what lets user rebinding propagate without a redeploy.

Dynamic shortcuts (registered at runtime for state-dependent actions) publish to the shell over the `shortcuts:registered` IPC channel and persist only for the app's lifetime. The cheatsheet aggregator (§Aggregation across the sandbox boundary) consumes both static and dynamic sources.

## Conflict resolution

> **Decision:** **shell shortcuts always win** on a layer collision. The shell intercepts in the main process via `before-input-event` and `preventDefault()`s before the app renderer hears the keydown. This is what guarantees Goal 1 (shell shortcuts predictable across the system) and is the inverse of VS Code's policy — Brainstorm is a shell, not an IDE.

Concretely: pressing `⌘ Shift L` (`shell/appearance.toggle`) anywhere in a Brainstorm window flips the appearance, regardless of what the focused app would have done with it.

### App opt-in shadowing

An app that genuinely needs a shell chord (e.g. a future IDE app claiming `⌘ Shift P` for its own palette) declares it on the manifest entry:

```jsonc
{ "id": "command-palette", "default": "Mod+Shift+P", "label": "Command palette", "shadowsShell": true }
```

- `shadowsShell` is **surfaced at install time** in the install prompt ("This app wants to override the shell's Marketplace shortcut. Allow?"). The user can refuse, in which case the app installs but its binding is dropped (the chord still hits the shell).
- The rebinding UI lists shadowed shell chords so the user can revert.
- Without `shadowsShell`, an app's manifest chord that collides with a shell chord is **rejected at install** (not silently shadowed). The app must either rebind or set the flag.

### Within a layer

- **Shell-only conflicts** — two shell-level bindings for the same chord are impossible (the shell ships its set; there's no in-shell conflict).
- **Within an app** — apps shouldn't ship conflicting defaults. The shell validates the manifest at install time and refuses an install with internal conflicts.
- **Between apps** — two different running apps with the same chord don't collide: each is delivered to whichever app is focused. The cheatsheet renders both, scoped to their app.
- **User-rebinding conflicts** — when a user binds a chord that's already in use (in the same layer), the rebinding UI shows a "this conflicts with X" warning. The user picks: replace, keep both (becomes a chord-of-chords; second press disambiguates), or cancel.

> **Decision:** automatic-silent-overwrite is forbidden. Conflicts surface either at install (manifest-vs-shell, manifest-internal) or at rebind time (user action).

## Delivery mechanics

The two layers run on different surfaces — this is load-bearing and not interchangeable.

- **Shell layer** is intercepted in the **main process** via `webContents.on("before-input-event", …)`. The listener is attached to every Brainstorm BrowserWindow (dashboard + every app window) **at window-create time**, not lazily and not gated on session events. A matched chord calls `event.preventDefault()` so the app renderer never sees that keydown, then sends the action to the dashboard renderer over the `shell:action` IPC channel.
- **App layer** is intercepted in the **app renderer** on DOM `keydown`, via the SDK's `useShortcut(id, handler)`. The renderer never sees shell-matched chords (they were preventDefaulted in main), so app handlers don't need to know about the shell registry.

> **Decision:** chord matching uses `KeyboardEvent.code` as the primary key for ASCII-letter chords (`KeyA…KeyZ`, `Digit0…9`) and `KeyboardEvent.key` for everything else (`Space`, `Enter`, `Escape`, `Arrow*`, `Tab`, punctuation). This makes `Cmd+Shift+L` work on AZERTY / Cyrillic / Dvorak without the user re-binding per layout, and keeps semantic keys (Escape, arrows) physically locale-independent.

> **Decision:** `before-input-event` attach happens at window-create, in the launcher's window-factory path, not via `onSessionRebuilt` indirection. A window created before the shortcut subsystem was wired must not exist; if attach is deferred, that window is silently invisible to shell shortcuts. (This is the regression that caused `⌘ Shift L` to fail from a focused app window — recorded here to keep the wiring invariant.)

> **Decision:** the shell does **not** use Electron's `globalShortcut.register`. Shell chords fire only while a Brainstorm window has OS focus (per [01-vision.md](../foundations/01-vision.md) — Brainstorm is a desktop citizen). The single exception is the `shortcuts.global` capability (§Capabilities), used by tray-resident or always-on apps.

### Single-key suppression in input contexts

> **Decision:** single-key shortcuts (`?`, `j`, `k`, `/`) are suppressed when the focused element is a text input, contenteditable, or any element with `role="textbox"`. The suppression rule lives in **both** layers: the main process checks `webContents.isFocusedFormControl` / equivalent before matching single-key shell chords; the renderer SDK checks the active element before matching single-key app chords. Apps that genuinely need single-key bindings in input contexts must use a chord with a modifier.

## User customization

The user can customize bindings from a single shortcuts settings panel:

- See all shortcuts grouped by source (Shell / per-app).
- Search by label, chord, or action.
- Rebind any shortcut.
- Reset one or all to defaults.
- Add a new binding for an action that doesn't have a default.
- Remove a binding (the action stays, just no shortcut).

> **Decision:** the rebinding UI captures input by listening for key events ("press the new chord"). It validates platform-correctness (suggesting `Mod` instead of literal `⌘`/`Ctrl` for cross-platform users).

### Shortcut bindings as a personal entity

User customizations are stored as a `brainstorm/ShortcutBindings/v1` entity, scope `user` (personal-by-default per [01-vision.md](../foundations/01-vision.md)). The entity records overrides as `(target-id, chord)` pairs:

```jsonc
{
  "type": "brainstorm/ShortcutBindings/v1",
  "properties": {
    "scope": { "kind": "user", "target": "<user-id>" },
    "overrides": [
      { "target": "shell/launcher", "chord": "Mod+P" },                      // user changed launcher hotkey
      { "target": "io.example.editor/format-bold", "chord": null }           // user removed Bold shortcut
    ]
  }
}
```

This entity syncs across the user's devices; each device sees the same bindings. In v2, an org may set defaults (an `org`-scoped ShortcutBindings) that the user's personal entity can override.

## Aggregation across the sandbox boundary

The cheatsheet and settings panel must render **every active shortcut**, including those declared by sandboxed app renderers. The shell can't peek into an app's renderer, so:

- **Static declarations** (manifest `shortcuts: [...]`) are mirrored into the main-process `ShortcutRegistry` at install time, under the `app/<app-id>/<id>` namespace. The cheatsheet and settings panel read from the registry directly — no IPC required at open time.
- **Dynamic registrations** are published over the broker-validated `shortcuts:registered` IPC channel. The shell adds them to a per-app sub-registry that lives only while the app is running. Removed when the app's last window closes.
- **Active-scope filtering** (per OQ-75) is the focused app's job: when the cheatsheet opens, the shell asks the focused app's renderer "what's your current active scope?" via a synchronous-shaped IPC (`shortcuts:queryActiveScope`); the shell then filters the displayed list to entries whose `scope` matches. Apps without focus contribute nothing.
- **Cheatsheet body** combines: all `shell/*` entries (always), all `app/<focused-app-id>/*` entries whose scope is active, and `editor/*` / `popover/*` component entries scoped to the focused element type.

> **Decision:** the registry is the single source of truth at runtime. The cheatsheet, settings panel, `<Button shortcutId>` hover hint, `aria-keyshortcuts` value, and launcher chord display all read from the same data — there is no separate "display label" or "rebindable label" cache.

## Discoverability

### Cheatsheet (`⌘ Shift K`)

The cheatsheet is a `fancy-menus` command-palette body listing every active shortcut for the current context. Items show: action label, current chord, and a search filter chrome at the top. Selecting an item triggers the action and dismisses the cheatsheet.

> **Decision:** the cheatsheet is **always-on**. Even apps with their own internal command palette (a code editor, say) inherit the system one through the SDK; they can extend it but not replace it.

### Settings panel

A full `Keyboard Shortcuts` section in shell settings lists every binding with rebind affordances. Shows source (Shell / app / org-managed in v2 / personal override).

### Hover hints and `aria-keyshortcuts`

The shell exposes a `<Button shortcutId="…">` primitive (and a `useShortcutLabel(id)` hook for non-button surfaces). It resolves the current user-rebound chord from the registry and renders the platform-correct glyphs next to the label (e.g. "Save  ⌘S"). The same hook stamps `aria-keyshortcuts` on the host element for screen readers.

> **Decision:** there is no manual `chord=` prop on shell primitives. Hover hints and `aria-keyshortcuts` both come from the registry by action id; if a user rebinds, the hint follows automatically.

Apps consume the same primitive through the SDK (`@brainstorm/sdk/shortcut` → `<Button shortcutId>`), so an app's button labelled "Save" gets `⌘S` next to it the same way a shell button does, and the same way for a screen reader.

### Launcher

Typing in the launcher matches actions by label; the matching chord is rendered alongside. Pressing the chord directly is identical to picking the launcher result.

## Platform-aware defaults

Apps declare chords using the `Mod` token (resolves to `⌘` on macOS, `Ctrl` elsewhere) and `Alt` / `Shift` literals. The shell normalizes display per platform:

```
Mod+S          → "⌘ S" on mac, "Ctrl + S" on Windows/Linux
Mod+Shift+P    → "⌘ ⇧ P" / "Ctrl + Shift + P"
Alt+Enter      → "⌥ ↵" / "Alt + Enter"
```

For chords that genuinely differ per platform (rare), apps can declare them per-platform:

```jsonc
{ "id": "preferences", "default": { "mac": "Cmd+,", "win": "Ctrl+,", "linux": "Ctrl+," } }
```

## Accessibility

> **Decision:** every shortcut-triggerable action must also be reachable via a menu, the launcher, or a button. Shortcuts are accelerators, not the only entry point.

Single-key suppression in input contexts is enforced in both layers — see §Delivery mechanics.

Screen readers receive shortcut hints alongside element labels via `aria-keyshortcuts`, auto-stamped by the `<Button shortcutId>` primitive (§Discoverability).

## Storage and sync

- `brainstorm/ShortcutBindings/v1` entity is created lazily (only when the user has at least one override).
- Scope `user`; syncs across devices via Yjs.
- The shell's startup loads shell-default bindings + app-default bindings + the user's overrides; resolves to an in-memory binding map.
- Changes write to the entity; subscribers re-resolve immediately.

## Capabilities

A new capability for apps:

- `shortcuts.register` — granted by default to any app at install (it's part of being an app). Apps register shortcuts via manifest; runtime registration is allowed but rare.
- `shortcuts.global` — register a shortcut that fires even when the app is not focused (system-wide). This is sensitive (think: hotkey hijacking) and requires explicit user grant; only meaningful for tray-resident or always-on apps.

## Focus-scope consequences

The "focus-scoped, not OS-wide" decision (§Delivery mechanics) has a practical consequence: a chord that conflicts with a well-known OS chord (`Cmd+Space`, `Cmd+Tab`, `Cmd+Q`) is fine to use *inside* Brainstorm — but the user still has the OS chord available everywhere else. If a user dislikes the in-app override, they rebind per the rebinding UI; Brainstorm doesn't fight the OS by hogging the chord.

The `shortcuts.global` capability (§Capabilities) is the documented escape hatch: apps that explicitly request and obtain it can fire when unfocused, going through the per-app capability prompt UX. Apps without this capability cannot escape the focus-scope.

## Phasing

> **Decision:** v1 ships shell-default bindings, app shortcuts via manifest, full user rebinding UI, the cheatsheet, the settings panel, platform-aware display. **v2** adds org-managed defaults and shortcuts.global capability handling.

| Capability                                | Status | v1 | v2 |
|-------------------------------------------|--------|----|----|
| Shell-default shortcuts                   | ✅ Stage 6.1–6.6 | ✓  | ✓  |
| `ShortcutRegistry` + alias-insensitive chord parse | ✅ Stage 6.1–6.6 | ✓ | ✓ |
| User rebinding UI                         | ✅ Stage 6.8 | ✓ | ✓ |
| `ShortcutBindings/v1` entity + migration  | ✅ Stage 6.7 | ✓ | ✓ |
| `before-input-event` shell delivery       | ✅ landed | ✓ | ✓ |
| Attach to every BrowserWindow at create-time | ⚠️ partial — see Hardening ladder | ✓ | ✓ |
| Layout-invariant chord match (`code` for ASCII letters) | ⚪ Hardening ladder | ✓ | ✓ |
| App shortcuts via manifest → main-process registry | ⚪ Hardening ladder | ✓ | ✓ |
| `shortcuts:registered` IPC for dynamic    | ⚪ Hardening ladder | ✓ | ✓ |
| Cheatsheet (`⌘ Shift K`)                  | ⚪ Stage 6.9 (gated on design-system 8.8) | ✓ | ✓ |
| Settings panel (search / rebind / reset)  | ✅ Stage 6.8 | ✓ | ✓ |
| Platform-aware display (`Mod` → glyph)    | ⚪ Hardening ladder | ✓ | ✓ |
| `<Button shortcutId>` + `aria-keyshortcuts` auto-stamp | ⚪ Hardening ladder | ✓ | ✓ |
| Single-key suppression in inputs (both layers) | ⚪ Hardening ladder | ✓ | ✓ |
| App-vs-shell conflict surfaced at install (`shadowsShell` opt-in) | ⚪ Hardening ladder | ✓ | ✓ |
| Chord-of-chords (resolve user conflicts)   | ⚪ post-v1 | ✓  | ✓  |
| Org-managed default bindings               | — | —  | ✓  |
| `shortcuts.global` capability              | — | —  | ✓  |
| Modal sequences (e.g. `⌘ K` then `S`)     | OQ-73 | post-v1 | ✓ |

### Hardening ladder (the "shortcut system is complicated" iteration)

These work items close the gap between the user-facing model above and what the code currently honors. Each is small in isolation; together they make the doc's promises real. Lands as an interleave under Stage 6, post-6.7.

1. **6.10a — Attach-at-create + layout-invariant match.** Move `before-input-event` attach into the BrowserWindow factory path (dashboard + every app window). Switch chord-vs-input matching to `code`-first for ASCII letters, `key` for everything else. Fixes the regression where shell chords were invisible from app windows on certain timings / keyboard layouts.
2. **6.10b — Manifest → registry mirror.** Install-time mirror of app manifest shortcuts into `ShortcutRegistry` under `app/<app-id>/<id>`. Install validates manifest-internal conflicts and manifest-vs-shell collisions (latter requires `shadowsShell: true` to land). SDK `useShortcut(id)` becomes id-keyed everywhere.
3. **6.10c — Dynamic IPC + cheatsheet aggregator.** `shortcuts:registered` broker channel + per-app sub-registry. Cheatsheet body (6.9 once unblocked) reads from aggregated registry. Active-scope query for the focused app.
4. **6.10d — Hover hint + `aria-keyshortcuts` primitive.** `<Button shortcutId>` and `useShortcutLabel(id)` in shell-renderer + SDK; rewrite call sites that hand-render chord strings.
5. **6.10e — Single-key suppression cross-layer.** Both layers agree on "input-focused → skip single-key chord". Pinned by a test that exercises `?` in a text input vs in the dashboard chrome.
6. **6.10f — Platform-aware display.** `formatChord(chord, platform)` helper consumed by hint + cheatsheet + settings panel. `Mod`-token round-trip with the rebinding capture UI.
7. **post-v1 — Modal sequences (OQ-73) + `shortcuts.global` capability.**

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-73** — Modal sequences (e.g. VS Code's `⌘K ⌘S`) — v1 nice-to-have or later?
- **OQ-74** — Default-rebinding handling: when an app updates and changes a default, do existing user customizations stay or revert?
- **OQ-75** — Does the cheatsheet show ALL bindings or only those reachable from the current context (focused element / app / window)?

## Summary

- **Two layers**: shell-level (always active) and app-level (active when app focused). **Shell wins on layer collision**; apps opt-in to override via `shadowsShell` on the manifest entry, surfaced at install.
- **Two delivery surfaces**: shell layer intercepts in main via `before-input-event` (attached at every BrowserWindow create); app layer intercepts in the app renderer on DOM keydown. Shell `preventDefault`s, so the app renderer never sees a shell-matched chord.
- **Layout-invariant matching**: `code`-first for ASCII letters, `key` for semantic keys (Space/Enter/Escape/Arrow*/Tab/punctuation).
- Shortcuts are **declared in manifests** (apps) or built-in (shell); user customizations live as a `brainstorm/ShortcutBindings/v1` personal entity that syncs across devices.
- **One registry, one source of truth at runtime** — cheatsheet, settings panel, `<Button shortcutId>` hover hint, `aria-keyshortcuts`, and launcher chord display all read the same data. Dynamic app shortcuts publish via `shortcuts:registered` IPC.
- **No silent conflicts** — manifest-vs-shell rejects at install (unless `shadowsShell`); manifest-internal rejects at install; user rebinding surfaces in the UI with replace / keep-both / cancel.
- **Discoverability**: `⌘ Shift K` cheatsheet (fancy-menus command palette), settings panel, hover hints, launcher.
- **Platform-aware**: `Mod` token resolves to `⌘`/`Ctrl`; per-platform chords supported when needed.
- **Accessibility**: every shortcut-triggerable action also reachable via UI; single-key shortcuts suppressed in input fields, in both layers.
- **Personal-by-default**: bindings are user-scoped; v2 adds org-managed defaults the user can override.
