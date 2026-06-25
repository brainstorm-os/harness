# 03 — App model

This doc defines what an app *is*, how it is packaged, and how its lifecycle interacts with the shell. The SDK surface (functions, types, callbacks) is in [08-app-sdk.md](08-app-sdk.md); this doc is the conceptual model.

## What an app is

An **app** is a self-contained package consisting of:

- A **manifest** describing identity, version, capability requests, and registrations.
- A **bundle** of code and assets that the shell loads into a renderer process.
- (Optionally) **block definitions** the app contributes to the system — embeddable UIs others can use.
- (Optionally) **entity-type registrations** the app introduces.

Apps are not microservices. They are user-facing pieces of software with windows, menus, and state. The shell launches them and brokers their access to data, but does not run them as background workers (with a narrow exception for **widgets**, see [04-shell.md](../shell/04-shell.md)).

## Manifest

Conceptually, every app ships a manifest like:

```jsonc
{
  "id": "io.example.text-editor",                  // globally unique
  "name": "Text Editor",
  "version": "1.4.2",                              // semver
  "sdk": "1",                                      // SDK API version pin
  "description": "Rich-text editor for plain documents.",
  "icon": "assets/icon.png",
  "entry": "dist/index.html",                      // loaded into a renderer

  "capabilities": [
    "storage.kv",                                // read/write own docs
    "entities.read:io.example/Note/v1",            // read these entity types
    "entities.write:io.example/Note/v1",
    "files.open:text/*",                           // can be a default opener
    "blocks.publish"                               // can register blocks
  ],

  "registrations": {
    "openers": [
      { "mime": "text/markdown", "kind": "primary" },
      { "entityType": "io.example/Note/v1", "kind": "primary" }
    ],
    "blocks": [
      { "id": "io.example.text-editor/paragraph", "name": "Paragraph" }
    ],
    "entityTypes": [
      { "id": "io.example/Note/v1", "schema": "schemas/note.v1.json" }
    ],
    "widgets": [
      { "id": "recent-notes", "name": "Recent notes", "size": "small" }
    ]
  }
}
```

The fields are defined formally in [08-app-sdk.md](08-app-sdk.md); the shape above is the conceptual surface.

> **Decision:** the manifest is data, not code. Capability requests, openers, blocks, and widgets are all declared statically. Dynamic registration at runtime is **not** part of the v1 model — it makes capability auditing intractable.

> **Open:** does an app's manifest describe entity-type schemas inline, or only reference them by URL (the Block Protocol way)? The latter is cleaner but requires resolving the URL at install time. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## App identity

Each app has:

- A **package id** — globally unique reverse-DNS, immutable across versions.
- A **version** — semver, advances on update.
- A **signing key** (optional in v1, required by v2) — used to verify updates come from the same origin.

The shell stores apps under their id. Two apps with the same id cannot coexist. An app's id never changes; if it changes, it is a different app.

## Lifecycle

```
   ┌────────┐  install   ┌──────────┐  launch   ┌─────────┐
   │ source │──────────► │ installed│──────────►│ running │
   └────────┘            └──────────┘           └─────────┘
                              ▲                      │
                              │   suspend / quit     │
                              └──────────────────────┘
                              │
                          uninstall
                              │
                              ▼
                         (removed)
```

### Install

Inputs to install:
- A package (local file, URL, or registered source).
- The user's confirmation, including review of capability requests.

Effects:
- Manifest validated.
- Bundle copied to a content-addressed directory under the shell's data dir.
- Capabilities recorded in the capability ledger as **granted** (the user explicitly approved them at install) or **deferred** (the user can grant them later).
- Registrations (openers, blocks, entity types, widgets) added to the shell's registries.

> **Decision:** install is the only time an app can ask for capabilities in a batch. Runtime capability requests are also allowed, but only one at a time, with full UI prompt. There is no "auto-grant on first use".

### Launch

The shell creates a renderer process, loads the app's `entry`, and provides:
- A handle to the host-services IPC channel (with the app's identity stamped on every message).
- The current capability set.
- Any launch context: a file to open, an entity to display, a deep link payload.

The app's main window opens. The app may open additional windows it owns; these are tracked by the shell.

### Suspend

When the user closes all windows of an app (without quitting), the shell may keep the renderer alive (for fast re-launch) or terminate it (to free memory). This is invisible to the user; from the user's view, the app simply isn't on screen.

### Update

An update replaces the bundle for an installed app. The shell:
- Verifies the update is the same package id and a higher version.
- Diffs requested capabilities. **New** capabilities require explicit user approval. Removed capabilities are dropped silently.
- Notifies running instances; running app windows can either reload or finish their work and reload on next launch.

> **Decision:** updates may add capability requests but never escalate them silently. A passive accept is not allowed.

### Uninstall

The shell:
- Closes all windows and terminates the app's renderer.
- Removes the bundle.
- Removes the app's registrations (openers, blocks, entity types, widgets).
- Revokes all capability grants.

The app's **data** — entities it created, files it owns — is retained by default and offered for export. The user can opt to delete it. **Why default-retain:** other apps may have linked to this app's entities; deleting silently would break those links.

> **Open:** what happens to entity-type registrations contributed by an uninstalled app, when other apps are still using those types? Provisional answer: the type definition stays in the registry as orphaned-but-resolvable; new apps can re-claim it. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Kinds of apps

There is no enum of app kinds — but conceptually we expect at least these:

- **Document apps** — open and edit a document type. Examples: text editor, code editor, PDF editor, image editor. Usually register as openers for one or more MIME types or entity types.
- **Database apps** — present collections of structured entities with views (table, board, calendar). Read/write multiple entity types.
- **Viewer apps** — read-only or mostly-read-only over entities or files. Examples: file viewer, graph viewer.
- **Tool apps** — operate on data without owning a primary surface. Examples: a search bar, a clipboard manager, a quick-capture inbox. Often appear as widgets or palette entries.
- **Background helpers** — explicitly opt-in long-running tasks (e.g., a sync provider, an LLM gateway). Subject to extra capability scrutiny.

The kinds are descriptive; the model just sees apps that have made certain registrations.

## Multiple windows

An app may open multiple windows of its own. The shell tracks these as belonging to the app. The user perceives them as multiple windows of the same program (taskbar grouping, mission-control grouping). Each window is a separate `BrowserWindow` but shares the renderer process model — see [02-architecture.md](../foundations/02-architecture.md).

Apps that open many same-shaped windows (text editor, database, code editor, graph explorer) should opt into **shell-managed tabs** — one OS window hosts a tab group, the shell paints the tab strip, each tab has its own route + back-stack. App authors declare opt-in via `windowing.tabbing` in the manifest; the full contract is in [43-tabs.md](43-tabs.md). Don't ship your own tab strip — apps that bypass the shell's grouping lose focus-existing, drag-out, and back/forward.

> **Open:** does each app window get its own renderer process, or do windows of the same app share a process? Sharing is faster and cheaper. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Inactive / removed apps in user data

When an app is uninstalled (or fails to load), entities and blocks it produced still appear elsewhere. The shell shows them with a **fallback renderer**: a card listing the entity's primary fields, sourced from the entity's Block Protocol type, with a "this app is no longer installed — install or pick a handler" affordance. **No errors, no broken UI.** This is a hard requirement of the model.
