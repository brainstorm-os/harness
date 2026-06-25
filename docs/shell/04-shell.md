# 04 — Shell

The **shell** is the hosting environment apps run inside. This doc describes its visible surfaces (dashboard, launcher, window management) and the responsibilities behind them. The internal services it exposes to apps are covered in [08-app-sdk.md](../apps/08-app-sdk.md).

## Surfaces the user sees

### Dashboard

The dashboard is the screen the user sees with no app focused. It contains:

- A **wallpaper** — image, gradient, or live source. Customizable. Has no functional role beyond appearance.
- **Icons** — visual launchers placed on the desktop surface. Each icon points to either an app, a specific entity (open this with X), or a saved view (open this query in app X).
- **Widgets** — interactive surfaces published by apps (clock, recent-notes list, calendar today, quick-capture box). Widgets are read-mostly; for full interaction the user clicks through into a window.
- **A launcher** — keyboard-driven palette (a la Spotlight) that searches across apps, entities, files, and intents.

Layout is the user's. The shell does not impose a grid of icons; positioning is per-icon. The dashboard's state is itself a Yjs doc, which means layout syncs across devices like any other content.

> **Decision:** the dashboard is *not* an app. It is a privileged surface owned by the shell. Apps publish widgets *into* it but cannot replace it.

### Application windows

Each running app appears as one or more windows. The shell:

- Manages window placement, focus, restore, and the OS-level taskbar/dock.
- Provides a uniform window chrome where appropriate (close, minimize, maximize), but allows apps that want a custom titlebar to opt in.
- Persists window position/size per app per window-id (apps can name their windows, e.g. `main`, `inspector`).

> **Open:** does Brainstorm draw its own window chrome (consistent across apps) or use platform-native chrome? Native is cheaper and more accessible; custom is more cohesive. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

### Launcher

The launcher is opened by a global hotkey (`⌘ Space` style). It runs:

- App search ("Notes" → launch Notes app)
- Entity search (across the entities service index)
- File search (within granted folders)
- Intent search ("New note", "Open in PDF editor", "Search Wikipedia for…")

Results are flat-ranked across these sources. Apps contribute searchable content by writing to the entities service or by registering intent providers. The launcher itself is not an app — it is a shell surface.

The launcher is rendered using `@react-fancy-menus/core` (see [13-frontend-stack.md](13-frontend-stack.md)), configured as a command-palette body with a search filter chrome and a virtualized result list. The same menu engine drives right-click context menus, "Open with…" / "Export to…" intent menus, tray menus, and in-app dropdown menus across the system.

### System areas

- **Notifications** — apps can post notifications via a host service. The shell renders them.
- **Tray / menu bar** — apps can publish a tray entry (with a subset of their menu) if granted the capability.
- **Settings** — a single shell-owned settings surface; apps register settings panels rather than opening their own.

## Responsibilities behind the surfaces

The shell is responsible for, and only for:

1. **Hosting** — process management, window management, lifecycle of apps.
2. **Brokering** — every host-service call passes through the shell, which checks capabilities, stamps app identity, and routes.
3. **Persistence** — the shell owns where data lives on disk (via the storage service); apps never touch the filesystem directly outside grants.
4. **Sync** — the shell owns the Yjs runtime and transport adapters; apps subscribe through it.
5. **Capability ledger** — granting, listing, revoking permissions; surfacing them in a single place.
6. **Registry** — the canonical map from MIME types/entity types to apps that can open them; from block ids to apps that can render them.
7. **Identity** — the local user, key material, device pairing.
8. **Discovery** — install/uninstall/update flow.

The shell is **not** responsible for:

- Knowing what an entity means.
- Editing content.
- Implementing block UIs (it only hosts them).
- Talking to remote services that aren't sync transports (apps do that, with network capability).

## Window management details

- Each app's main window is launched by the shell from the manifest's `entry`.
- An app can request additional windows it owns; they are subject to per-app limits the user can adjust.
- The shell tracks windows by `(app_id, window_id)`. Position, size, and z-order persist.
- When the user logs in, the shell can optionally restore the previous session: which apps were running, which windows were open. This is an opt-in.

## Widgets

Widgets are a special, restricted surface:

- A widget is a small embeddable view from an app, displayed on the dashboard.
- Widgets receive data via the same host services the app uses; they read more than they write.
- Widgets do not run when off-screen (they are paused).
- Widgets have stricter UI constraints (size, no popovers spilling outside the widget bounds, no modal dialogs).

> **Open:** are widgets implemented as the same renderer process as the parent app, lazily showing a widget-mode UI? Or as a separate, lighter process? Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Multi-monitor and workspaces

The shell respects platform conventions for multi-monitor and (on macOS) Spaces. The dashboard is per-monitor; the launcher is global. Beyond that, no special workspace concept in v1.

## What the shell stores

- The **app registry** (installed apps and their manifests).
- The **capability ledger** (per-app grants).
- The **registration index** (openers, blocks, entity types, widgets).
- The **session** (running apps and window placement).
- The **dashboard doc** (wallpaper, icons, widget layout) — itself a Yjs doc.
- The **identity** (local user keys).
- A pointer to **storage** and **sync** state, which the storage service manages.

All of these together make a shell instance. Backing up a shell instance backs up the system.
