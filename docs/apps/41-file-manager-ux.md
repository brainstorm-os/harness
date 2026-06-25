# 41 — File manager — UX and interaction design

This doc is the **UX / interaction specification** for the first-party file-manager app (`brainstorm.files`). It builds on [30-file-manager-and-folders.md](30-file-manager-and-folders.md) (the data model — `Folder/v1`, multi-membership, smart folders, breadcrumb chrome) and is paired with [42-file-manager-implementation.md](42-file-manager-implementation.md) (the engineering plan).

Doc 30 says **what** the file manager is and which entity types it operates on; this doc says **how** the user actually uses it.

## Why a separate doc

The user's mental model for "where do I find my stuff" is a Finder / Windows Explorer / Nautilus / Files-on-Linux app — a sidebar of locations, a content pane, breadcrumbs, multi-select, rename in place, drag to move, search in current folder. Brainstorm needs that mental model *and* needs to honor "Folder is just an entity type" and "every entity can be a member of any folder". This doc reconciles the two.

The deeper move: **the file manager is the user's primary navigation surface for the vault.** It is what answers "where does this live?", "what's in the vault?", and "how do I move things around?" If it is wrong here, the product feels uninhabitable regardless of how good the editor is.

## Goals

1. **Familiar.** A user who has used Finder, Explorer, or any modern desktop file browser feels at home in the first five seconds. No retraining tax.
2. **Type-aware.** The pane shows the right glyph and primary fields for each entity type — a Note looks different from a File, which looks different from a Task. Doc 30's "type-aware in display" is the principle; this doc says exactly how.
3. **Folder-agnostic.** Folders are not the only way to organize. Tags, saved queries, recent items, and direct entity links are peer surfaces in the sidebar.
4. **Keyboard-first.** Every operation has a key binding declared through the renderer-side shortcut registry. The mouse is the second-best path. A user can pin, rename, move, open, search, and create without touching the trackpad.
5. **Fast.** Listing 10k members renders within frame budget via virtualization; switching folders feels instant.
6. **Honest about scope.** The file manager is **the file manager**, not the dashboard, not the breadcrumb owner, not the launcher. Anywhere these other surfaces are the right answer, defer.

## Window layout

The file-manager window is a **three-column** layout in `stacked` mode at the top level (per [27-layouts.md](../shell/27-layouts.md) — the file-manager is one of the first apps to need a layout outside the form-designer flow). Two of the columns are resizable; the third is collapsible.

```
┌───────────────────────────────────────────────────────────────────┐
│ chrome.breadcrumb   chrome.tabs?         chrome.actionBar         │  44px header
├──────────┬──────────────────────────────────────┬─────────────────┤
│          │ Toolbar  view-switch  sort  view ▾  │                 │
│ Sidebar  ├──────────────────────────────────────┤  Inspector      │
│          │                                      │  (collapsible)  │
│ tree +   │  Content pane                        │                 │
│ pins +   │  list / grid / column                │  preview chrome │
│ smart    │                                      │  + properties   │
│ tags     │  (virtualized)                       │                 │
│          │                                      │                 │
│          ├──────────────────────────────────────┤                 │
│          │ Status bar — 4 selected · 132 items  │                 │
└──────────┴──────────────────────────────────────┴─────────────────┘
```

- **Header (44px)** — flush with the rest of the shell's panel-header convention from `CLAUDE.md` ("Panel headers share a fixed height (44px) and a 1px subtle bottom border"). Hosts the breadcrumb, the back/forward arrows (from `chrome.actionBar` per [37](../shell/37-cross-app-navigation.md)), an in-window tab strip when the user has split the window, and an action-bar with "New", "Search", and the overflow menu.
- **Sidebar (default 240px, min 200px, max 480px)** — the persistent navigator.
- **Content pane (flex)** — the active folder's members in the active view mode.
- **Inspector (default 320px, min 280px, max 520px, collapsed by default)** — properties / preview for the selected entity. Toggle via `Mod+I`.
- **Status bar (24px)** — selection summary, total count, sort indicator, view switcher (echoes the toolbar but always visible).

> **Decision:** the file-manager window uses **two stacked panels** under one window — the sidebar and the content pane — with the inspector as an overlay-like third panel. All three obey the 44px header rule. The visual identity is the same as Settings: glass panels, 1px subtle separators between panels, 12px outer radius.

## The sidebar

The sidebar is the **persistent navigator**. It is not the breadcrumb (the breadcrumb is path-of-arrival per doc 30; the sidebar is choice-of-destination).

Four sections, in order from top to bottom:

| Section          | Renders                                                              | Pinnable | Collapsible |
|------------------|----------------------------------------------------------------------|----------|-------------|
| **Pinned**       | User-pinned folders, smart folders, tags, saved queries, entities.    | n/a      | yes         |
| **Folders**      | Tree view rooted at the vault's `rootFolderId` (per doc 30).          | n/a      | yes         |
| **Smart folders**| Standalone smart folders (no parent in the tree).                     | implicit | yes         |
| **Tags**         | Top-level tag entries (resolved as smart folders over `$contains: tags`). | implicit | yes         |

Each section header is a 32px row with a chevron, a label, a count, and a `+` affordance on hover.

### The folder tree

The tree:

- Roots at the **vault root folder** per doc 30.
- Renders nested folders down to **depth 8** (the doc-30 default cap). Beyond 8, the user can drill in via the content pane; the tree just stops indenting.
- **Virtualizes** (per `@tanstack/react-virtual`, already in the recommended set in [13-frontend-stack.md](../shell/13-frontend-stack.md)) — only on-screen + a buffer renders.
- Each row: `[chevron] [icon] [name] [count badge]`. Chevron is hidden when the node has zero subfolders.
- **Collapsed by default** at depth > 2 to keep the initial render compact.
- **Right-click** on a row opens the standard folder context menu (see below).
- **Drag-drop** onto a row moves selected items into that folder (or copies, with `Mod+Drag`).

> **Decision:** the tree displays **folders only**. Files and other-type entities live in the content pane, not the sidebar. Sidebars that pretend to host every entity type get unusable past a few hundred items.

### Pinned

A list of entities pinned to the sidebar for fast access. Pinned items are persisted as a property on the user's `FileManagerState` entity (one per vault; see implementation doc §State).

The user pins via:
- The folder context menu → "Pin to sidebar".
- Drag from the content pane onto the Pinned section header.
- `Mod+D` on the selected entity (rebindable).

### Smart folders and tags

Both render via the smart-folder query mechanism per doc 30. The sidebar lists them by name; clicking one swaps the content pane to the query result. Tags are the special case of `{ where: { $contains: { tags: "<tag>" } } }` — they are not separate primitives.

## The content pane

The content pane displays the active folder's members in one of three view modes. The active mode is **personal-by-default** per the `view` property on the Folder (doc 30) — a user's preference for one folder doesn't bleed into others unless they pick a global override.

### View modes

| Mode      | Best for                                | Density     | Default for                              |
|-----------|-----------------------------------------|-------------|------------------------------------------|
| **List**  | Long flat folders; sortable columns.     | High        | Folders with > 50 members.               |
| **Grid**  | Visual / image / cover-heavy content.    | Medium      | Folders whose members carry `cover` or `thumbnail` properties. |
| **Column**| Finder-style miller-columns drill.       | High; spatial | Power-user override; not v1 default.   |

> **Decision:** **list and grid** ship in v1. Column-view (Finder miller columns) is deferred to v2 — it interacts with intra-app tabs (per [37](../shell/37-cross-app-navigation.md)) and we want both to mature first. Tracked as OQ-174.

#### List view

A vertical, virtualized list. Each row uses the entity's `row`-context Layout (per [27-layouts.md](../shell/27-layouts.md)). Default columns for each entity type:

- **Name** — the entity's `title` / display-hint primary field; falls back to `id`.
- **Type** — entity-type name (e.g. "Folder", "Note", "File").
- **Modified** — `updated_at` relative ("2 hours ago"), absolute on hover.
- **Size** — for `File/v1`, bytes; otherwise empty.

Columns are user-resizable, drag-reorderable, and toggleable from a column-chooser in the toolbar overflow menu. Column state is stored on the Folder entity (so two different folders can have different active columns), with a "Apply to all folders" affordance.

> **Decision:** column state is a **per-folder** property. A user inspecting a Notes folder and a Files folder gets different columns by default; the chooser surfaces "Apply to all" to opt in to global state.

#### Grid view

Tile grid with type-aware tile chrome:

- A `File/v1` tile shows a thumbnail derived from the file's MIME type — image preview for images, file-type glyph otherwise.
- A `Folder/v1` tile shows the folder icon + count + cover (if set).
- A `Note/v1` tile shows the first ~80 chars of the body + a small footer.
- A generic-entity tile shows the entity's `card`-context layout.

Tile size has three presets: Small (96px), Medium (144px, default), Large (208px). Stored per-folder like list-view columns.

#### Column view (deferred)

Finder's miller columns: each column shows the children of the previously-selected folder. The right-most column shows file preview. Defer per OQ-174.

### Selection model

Selection is a **multi-select** model identical to Finder / Explorer:

- **Plain click** — single-select; clears the existing selection.
- **`Mod+Click`** — toggle one item in/out of the selection.
- **`Shift+Click`** — range-select from anchor to clicked item.
- **`Mod+A`** — select all visible items in the content pane.
- **Rubber-band drag** in empty space — lasso-select intersecting items.

The selection is published via `selection.publish(...)` per [17 §Selection](../platform/17-interoperability.md) so cross-app intents ("Process → Summarize") can act on it.

> **Decision:** the file manager **does not own the focus ring**. Standard focus traversal walks the sidebar → content pane → inspector via `Tab`; the focused-but-unselected vs selected distinction follows the same convention as macOS Finder (blue outline = focused, blue fill = selected).

### Sorting and grouping

A `view ▾` button in the toolbar opens a `@react-fancy-menus/core` menu with:

- **Sort by** — name / created / modified / size / type. Direction toggle.
- **Group by** — none (default) / type / first-letter / month-modified.
- **Show hidden** — soft-deleted entities (per [18 §Schema](../data/18-storage-and-search.md)'s `deleted_at` column). Off by default.

State is per-folder, mirrors the column state.

## The breadcrumb

The breadcrumb lives in the window header as the `chrome.breadcrumb` cell per doc 30. The file manager **does not implement breadcrumb rendering** — it publishes navigation context per doc 30's decision ("breadcrumb chrome reads navigation state").

What the file manager does provide:

- **`ui.windows.setRoute(route)`** on every folder change (per [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md)) so the breadcrumb resolver can map the current window to a path.
- **`ui.navigation.pushNav(path)`** when the user enters a child folder, so the chrome.breadcrumb cell can render A → B → X with the right intermediates.
- **`ui.navigation.back()` / `forward()`** hooked to the breadcrumb's chevron buttons + `Mod+[` / `Mod+]`.

A crumb is clickable to jump to that ancestor; right-click on a crumb opens the standard folder context menu for that ancestor.

## The toolbar

Pinned to the top of the content pane (32px). From left to right:

| Affordance        | Behavior                                                          | Default chord       |
|-------------------|-------------------------------------------------------------------|---------------------|
| **New ▾**          | Menu: New Folder · New Note · New File from upload · Templates… | `Mod+N` (rebindable)|
| **Search…**       | Focuses the in-window search field; scope = current folder.       | `Mod+F`             |
| **View ▾**         | Sort, group, columns, view-mode picker.                            | — (no chord)        |
| **Inspector**     | Toggle the right-hand inspector panel.                             | `Mod+I`             |
| **Overflow ⋮**     | Folder-properties editor, smart-folder editor, "Apply to all".    | — (no chord)        |

> **Decision:** the toolbar is **minimal**. Every action surface has at most one row of affordances; advanced actions live in the overflow menu, the context menu, or under a keyboard shortcut. The launcher (per [04-shell.md](../shell/04-shell.md)) remains the right place for one-off operations.

## The status bar

A persistent 24px footer at the bottom of the content pane:

- **Left**: selection summary — "4 selected · 312 KB" when multi-selected, "Notes · Modified 2 days ago" when single-selected, "132 items" when nothing selected.
- **Right**: a compact view-mode switcher (list / grid icons) mirroring the toolbar so the user always has a place to click.

The status bar is the only place running counters live — the toolbar doesn't echo the selection count.

## The inspector

Optional right-side panel. Collapsed by default; user opens with `Mod+I` or the toolbar button.

Three tabs:

1. **Preview** — the selected entity rendered in `preview` context per [27-layouts.md](../shell/27-layouts.md). For Files, a thumbnail + MIME + size; for Notes, the first ~500 chars of the body; for Folders, member count + creation date.
2. **Properties** — editable form for the selected entity's properties (excluding rich-text bodies — those open in the entity's primary opener). For a Folder, this is also the **collection-scope overlay editor** per doc 30 (so users can author overlays here without leaving the file manager).
3. **Links** — incoming and outgoing links to/from the selected entity. Useful for "where is this referenced?".

> **Decision:** inspector is **single-select**. Multi-select hides Properties and Links and shows a "Bulk actions" pane.

## Create flow

The user creates new content via the **New ▾** menu, drag-and-drop, or a context menu's "New here" command.

### New Folder

1. User triggers (menu, keyboard, context menu).
2. A new `Folder/v1` entity is created in the active folder's `members` with a placeholder name ("Untitled folder").
3. The new folder is **inserted into the content pane** and immediately enters rename mode (see below).
4. Pressing `Enter` commits; `Escape` rolls back the creation entirely (delete the new folder, restore previous selection).

> **Decision:** "Untitled folder" rename-on-create is the default. Suppressing the rename popup (Finder behavior) is **off by default** — power users can opt out via Settings → File manager.

### New Note (and other entity-type creates)

The "New ▾" menu enumerates types via `intent.suggest({ verb: "compose", entityType: <type> })` so apps that own a type can offer "New X" entries. The text-editor app contributes "New Note"; the database app contributes "New Database"; etc. Selecting an entry:

1. Dispatches `intent.compose` with `{ intoType, parentFolderId }`.
2. The handler app creates the new entity and adds it to the parent folder's `members`.
3. The file manager focus-selects the new entity and (optionally) opens it for editing per the user's preferences.

### New File (upload)

A separate menu entry that opens the native file picker via `files.requestOpen(...)` (per [08-app-sdk.md](08-app-sdk.md)). For each picked file:

1. The file manager creates a `brainstorm/File/v1` entity from the file metadata (per [19-properties-and-schemas.md](../data/19-properties-and-schemas.md) "files as entities") with a `FileHandle` reference.
2. The new entity is added to the active folder's `members`.
3. The content pane re-renders with the upload progress overlay until the file copy into the vault's `attachments/` directory completes.

### Drag-drop create

Dropping OS files onto the content pane creates `File/v1` entities exactly as in the upload flow. Dropping a `text/uri-list` payload creates a `brainstorm/Bookmark/v1` entity (proposed in OQ-176 — defer if undecided; falls back to no-handler).

### Templates

The "Templates…" item opens a `@react-fancy-menus/core` menu of templates per type, sourced from a `brainstorm/Template/v1` query — the simplest implementation is "any entity tagged `template`". Picking one dispatches `intent.compose` with `{ template: <ent-id> }` and falls back to "From blank" if no handler claims it.

## Rename flow

Renaming is **inline**, like Finder.

- Trigger: `Enter` on the focused-but-not-editing item; or `F2` on Windows-feel keyboards; or a slow-double-click on the name area (single-click selects, slow-second-click promotes to rename).
- The name cell becomes a `<input>`; the text is selected sans extension so the user retypes the body without losing `.md` / `.pdf`.
- `Enter` commits the rename via `entities.update(id, { properties: { name: <new> } })`.
- `Escape` cancels.
- On commit, if another sibling in the same folder has the same name, the file manager **does not auto-suffix** — it surfaces a toast: "A folder named X already exists here. Rename anyway, replace, or cancel?" with three buttons.

> **Decision:** **no silent rename-collision resolution.** Finder appends "(2)"; we ask. The vault's data model permits siblings with the same `name` (uniqueness is by `id`), but two siblings named the same is almost always a mistake at write time.

> **Open:** OQ-175 — should the file manager normalize Unicode (NFC) in names on commit? Filesystem-side conventions differ (HFS+ NFD vs APFS NFC); for entity names there's no filesystem to consult. Tentative leaning: **NFC** at write time, matching the modern macOS / Linux default.

## Open flow

The user opens an entity via:

- **Double-click** on the entity in the content pane.
- **`Enter`** on the focused entity in the content pane.
- The "Open" item in the context menu.
- The `chrome.actionBar` "Open" button when an entity is selected.

In every case the file manager dispatches `intent.open` with `{ entityId }` per [17-interoperability.md](../platform/17-interoperability.md). The shell's navigation resolver picks the primary opener for the entity's type and handles focus-existing per [37](../shell/37-cross-app-navigation.md). The file manager **never** decides which app opens what.

Modifier conventions, identical to the rest of the shell per doc 37:

| Modifier         | Mode         |
|------------------|--------------|
| (no modifier)    | `replace` — replace the focused window if the user's default for `(open, <type>)` is replace; otherwise new-window. |
| `Mod+Click`      | `new-tab`    |
| `Mod+Shift+Click`| `new-window` |
| `Alt+Click`      | `new-panel`  |

Special case: **`Space`** triggers **`quick-look`** — a modal preview of the entity without launching its opener. Implemented via `intent.dispatch({ verb: "quick-look", payload: { entityId } })` so any app can register a quick-look handler. Falls back to the `preview`-context layout if no handler is registered.

### Folder open

Opening a `Folder/v1` from inside the file manager **does not** dispatch `intent.open` — the file manager is itself the primary opener for Folder, so opening a child folder is internal navigation: it pushes onto the in-window nav stack and updates `ui.windows.setRoute(...)`. This avoids re-launching the same app on every click.

## Search

Two search surfaces:

### In-window search

The toolbar's **Search…** field (`Mod+F`) is **scoped to the current folder**, filtering visible members live as the user types. Backed by the in-renderer member list — no broker round-trip per keystroke, just JS string-match against the property fields the active columns show.

The scope chip next to the field can flip between:

- **This folder** (default).
- **This folder and subfolders** — calls `entities.query(...)` walking the folder hierarchy.
- **Vault** — broadcasts to the shell's launcher (per [04-shell.md](../shell/04-shell.md)). The file manager closes its in-window search and opens the launcher pre-populated with the query.

> **Decision:** **the file manager never duplicates the launcher.** Vault-wide search is a launcher concern; the file manager focuses on local filtering. Doc 30's "search within folder — scoped `search.hybrid`" is honored by the second scope option.

### Saved queries (smart folders)

Saving the current search query as a smart folder uses the `fancy-menus`' `queryBuilder` panel (per [13-frontend-stack.md](../shell/13-frontend-stack.md)). The "Save as smart folder…" button appears in the search-field's overflow menu when a query is non-empty. The new smart folder lands in the sidebar's Smart Folders section.

## Move and copy

Move:

- **Drag-drop** within the file manager moves entities between folders. The drop indicator highlights the destination folder.
- **`Mod+X` → `Mod+V`** — cut/paste with multi-select.
- **Context menu → "Move to…"** opens a `@react-fancy-menus/core` folder picker.

Copy:

- **`Mod+Drag`** (or `Alt+Drag` on macOS) copies instead of moving.
- **`Mod+C` → `Mod+V`** — copy/paste.

Because `Folder/v1` membership is on the folder (per doc 30), **copy** means add the same entity id to a second folder's `members` (multi-membership), not duplicate the entity. The file manager surfaces this in the UI: a "Copied to N folders" toast, and the inspector's "Links" tab lists all containing folders. Genuine duplication (a separate entity) is a different command: **"Duplicate"** (`Mod+D`), which creates a new entity with the same property snapshot. Both commands appear in the context menu.

> **Decision:** **`Mod+D` is Duplicate (new entity).** Pin-to-sidebar moves to `Mod+Shift+D` per the sidebar section above; the default chord can be rebound.

### `intent.move`

Cross-app moves (the database app dispatching "move these rows to that folder") use `intent.move` per doc 30. The file manager is the registered handler. Implementation calls the same path as in-window drag-drop.

## Delete

Delete is a **two-step** operation:

1. **Soft-delete** — `Delete` / `Backspace` on selection sets `deleted_at` on the entities. They disappear from the content pane.
2. **Permanent-delete** — opening Settings → Vault → Recently Deleted shows soft-deleted entities for a configurable retention window (default 30 days). The user can restore or permanently delete from there.

The shell takes care of the permanent-delete sweep on a vault-wide cadence; the file manager only soft-deletes.

> **Decision:** the file manager **never permanently deletes** in one step. Even with `Shift+Delete`. Real deletion is gated to a separate surface. Reason: undo recovery is the most-asked-for affordance in any file browser; we make the default-safe path the only path.

## Multi-folder membership and "Where is this?"

Because doc-30 entities can live in many folders, the inspector's Links tab and the right-click → "Reveal in…" submenu list every folder that contains the focused entity. Clicking one navigates the file manager to that folder, scrolls to the entity, and selects it. This is the resolution of doc 30's reverse-lookup at the UX level.

## Keyboard map

All keys go through the shortcut registry per [`35-code-conventions.md §Keyboard handling`](../foundations/35-code-conventions.md). Default chords below are rebindable. New action ids declared:

| Action id                                | Default chord            | Behavior                                              |
|------------------------------------------|--------------------------|-------------------------------------------------------|
| `brainstorm.files/new-menu`              | `CmdOrCtrl+N`            | Open New ▾ menu.                                       |
| `brainstorm.files/new-folder`            | `CmdOrCtrl+Shift+N`      | Create a new folder in the active folder.              |
| `brainstorm.files/search`                | `CmdOrCtrl+F`            | Focus the in-window search field.                      |
| `brainstorm.files/toggle-inspector`      | `CmdOrCtrl+I`            | Toggle the inspector.                                  |
| `brainstorm.files/rename`                | `Enter`                  | Rename focused item (when not in edit mode).           |
| `brainstorm.files/rename.alt`            | `F2`                     | Same as above, Windows-feel.                           |
| `brainstorm.files/open`                  | `CmdOrCtrl+O`            | Open focused / selected entity.                        |
| `brainstorm.files/quick-look`            | `Space`                  | Quick-look the focused entity.                         |
| `brainstorm.files/delete`                | `Delete`                 | Soft-delete selection.                                 |
| `brainstorm.files/delete.alt`            | `Backspace`              | Same.                                                   |
| `brainstorm.files/copy`                  | `CmdOrCtrl+C`            | Copy selection.                                        |
| `brainstorm.files/cut`                   | `CmdOrCtrl+X`            | Cut selection.                                         |
| `brainstorm.files/paste`                 | `CmdOrCtrl+V`            | Paste at active folder.                                 |
| `brainstorm.files/duplicate`             | `CmdOrCtrl+D`            | Duplicate (new entity from selection).                  |
| `brainstorm.files/pin`                   | `CmdOrCtrl+Shift+D`      | Pin to sidebar.                                         |
| `brainstorm.files/select-all`            | `CmdOrCtrl+A`            | Select all visible.                                     |
| `brainstorm.files/back`                  | `CmdOrCtrl+[`            | Back (delegates to `ui.navigation.back`).               |
| `brainstorm.files/forward`               | `CmdOrCtrl+]`            | Forward.                                                 |
| `brainstorm.files/up`                    | `CmdOrCtrl+ArrowUp`      | Go to parent folder.                                    |
| `brainstorm.files/focus-sidebar`         | `CmdOrCtrl+1`            | Focus the sidebar list.                                  |
| `brainstorm.files/focus-content`         | `CmdOrCtrl+2`            | Focus the content pane.                                  |
| `brainstorm.files/focus-inspector`       | `CmdOrCtrl+3`            | Focus the inspector (and open if closed).                |
| `brainstorm.files/cycle-view`            | `CmdOrCtrl+Alt+1..3`     | List / Grid / Column.                                    |
| `brainstorm.files/sort-menu`             | `CmdOrCtrl+Shift+S`      | Open Sort/Group menu.                                    |

Component-scoped shell ids (`shell/popover.close`, `shell/list.next`, etc.) continue to apply per the existing registry.

## Accessibility

The file manager is keyboard-complete and screen-reader-complete:

- Every interactive element has a `role`, an accessible name from `t(...)`, and a focus indicator.
- The content pane is a `role="grid"` (list mode) or `role="listbox"` (grid mode) with documented `aria-multiselectable`, `aria-activedescendant`, `aria-rowindex`, `aria-colindex`.
- The tree uses `react-aria`'s `useTree`/`useTreeItem` per [13](../shell/13-frontend-stack.md).
- The breadcrumb crumbs are a `role="navigation"` with `aria-label` of the path.
- Rename's `<input>` is properly labelled and announces "Renaming X — type new name, press Enter to commit".
- Drag-drop has a **keyboard-only equivalent**: `Mod+X` → navigate to destination → `Mod+V`. The keyboard path is **first-class**, not a fallback.
- Sound: no audio cues by default; opt-in success/error chimes deferred.
- High-contrast theme support is automatic via the design-token layer (per [36](../shell/36-design-system.md)).

> **Decision:** the file manager passes WCAG 2.2 AA at v1 release. CI runs `@playwright/test` with `axe-core` against the file-manager Playwright suite.

## Localization

All user-visible strings use `t(key)` per [`35 §Localization`](../foundations/35-code-conventions.md). The id namespace is `brainstorm.files.*`:

- `brainstorm.files.actions.new` → "New"
- `brainstorm.files.actions.newFolder` → "New folder"
- `brainstorm.files.actions.rename` → "Rename"
- `brainstorm.files.actions.delete` → "Delete"
- `brainstorm.files.actions.quickLook` → "Quick Look"
- `brainstorm.files.sidebar.pinned` → "Pinned"
- `brainstorm.files.sidebar.folders` → "Folders"
- `brainstorm.files.sidebar.smartFolders` → "Smart folders"
- `brainstorm.files.sidebar.tags` → "Tags"
- `brainstorm.files.status.itemsZero` → "Empty folder"
- `brainstorm.files.status.itemsOne` → "1 item"
- `brainstorm.files.status.itemsN` → "{n} items"
- `brainstorm.files.status.selectedN` → "{n} selected · {size}"
- `brainstorm.files.search.placeholderFolder` → "Search this folder"
- `brainstorm.files.search.scopeFolder` → "This folder"
- `brainstorm.files.search.scopeSubfolders` → "Subfolders included"
- `brainstorm.files.search.scopeVault` → "Search vault"
- `brainstorm.files.rename.collision.title` → "Name in use"
- `brainstorm.files.rename.collision.body` → "A {kind} named {name} already exists here."
- `brainstorm.files.delete.confirm.title` → "Move to Recently Deleted?"
- `brainstorm.files.delete.confirm.body` → "{n} items will be recoverable for {retentionDays} days."
- `brainstorm.files.empty.title` → "Nothing here yet"
- `brainstorm.files.empty.body` → "Drop files, or click New."
- `brainstorm.files.view.list` → "List"
- `brainstorm.files.view.grid` → "Grid"
- `brainstorm.files.view.column` → "Column"

ICU pluralization is used for `itemsN` and `selectedN` once the locale layer lands per [21-localization.md](../platform/21-localization.md).

## Performance

| Metric                                                              | Budget                       |
|---------------------------------------------------------------------|------------------------------|
| First paint (file-manager window cold open from launcher)            | < 200 ms after handshake     |
| Folder switch (in-window navigate to a 1k-member folder)             | < 80 ms                      |
| List render of 10k members (virtualized)                              | 60 fps idle, < 16 ms / frame |
| Search keystroke → updated visible set (≤ 1k members)                 | < 16 ms                      |
| Search keystroke → updated visible set (≤ 50k members, subfolders)    | < 200 ms (debounced)         |
| Rename commit → visible reorder                                       | < 100 ms                     |
| Drag-and-drop move 100 entities (single transaction)                  | < 250 ms                     |
| Sidebar tree render (1k folders, depth 8)                              | < 50 ms                      |

These mirror the file-manager-specific entries in [12-shell-architecture.md](../shell/12-shell-architecture.md) and feed into the stage-9 performance audit per [`implementation-plan.md §Workflow standards`](../implementation-plan.md).

## Visual identity

- **Glass panels.** Sidebar and inspector match the Settings overlay's `glass--strong` treatment (existing convention).
- **Panel headers.** Every panel (sidebar / content pane / inspector) has the 44px header per CLAUDE.md.
- **Density.** Compact (32px rows) by default; matches the Typography "default" scale. Users in Settings → Typography → "Comfortable" get 40px rows; "Compact" stays 32.
- **Icons.** Every glyph is `<Icon name="…" />` per [13 §Themes](../shell/13-frontend-stack.md) — no inline SVG. The canonical names added for v1: `file`, `folder`, `folder.smart`, `tag`, `pin`, `inspector`, `view.list`, `view.grid`, `view.column`, `search`, `arrow.up`, `arrow.left`, `arrow.right`.
- **Animation.** Motion uses `motion` (Framer-Motion's successor) per [13 §Domain-specific libraries](../shell/13-frontend-stack.md), at the standard 150ms easing curve from the tokens package.

## What this is not

- **Not the dashboard.** Pinning happens both places, but the dashboard is OS-shell, the file manager is in-app browser.
- **Not the launcher.** Vault-wide search lives in the launcher; the file manager scope is the current folder by default.
- **Not the editor.** Opening a Note does not put the file manager into edit mode; it dispatches `intent.open` and lets the editor app render.
- **Not the owner of the Folder type.** Per doc 30, the file manager *registers* the type but does not own it.
- **Not the breadcrumb owner.** The `chrome.breadcrumb` cell is shell-rendered; the file manager publishes nav context.
- **Not a Finder clone.** Finder's "tags as colored dots" are not v1; column view is not v1; QuickLook is the curated intent, not a Finder-faithful preview overlay.

## Open questions

- **OQ-174** — Column-view (Finder miller columns) in v1 or v2? Tentative leaning: v2, behind intra-app tabs + nav-stack maturity.
- **OQ-175** — Unicode normalization on name commit (NFC vs NFD vs none). Tentative leaning: NFC at write time.
- **OQ-176** — Bookmark entity type for dropped `text/uri-list` payloads (`brainstorm/Bookmark/v1`). Useful but cross-cutting; defer.
- **OQ-177** — Persisting per-folder column / sort / view choices on the Folder entity itself vs on a per-user `FileManagerState` entity. Doc 30's `view` and `sortBy` properties live on Folder; the rest could be either. Tentative leaning: keep all view state on Folder (Personal-by-default → user scope when needed).
- **OQ-178** — Quick-look fallback for entity types with no registered handler — render the entity's `preview` layout, or surface "No quick-look available"? Tentative leaning: fall through to `preview` layout.
- **OQ-179** — Whether `Mod+D` should be Duplicate (this doc's leaning) or Pin (Apple convention is `Cmd+D` for Duplicate, Brave/Arc convention is Pin) — small but visible choice. Tentative leaning: Duplicate, with Pin on `Mod+Shift+D`.

These are added to [11-open-questions.md](../reference/11-open-questions.md).

## Cross-doc updates needed (paired with this doc)

- [30-file-manager-and-folders.md](30-file-manager-and-folders.md) — forward reference to this doc; UI surfaces sketch points here.
- [27-layouts.md](../shell/27-layouts.md) — the file manager is named as one of the first apps needing `row` + `card` + `preview` context layouts for arbitrary types.
- [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md) — confirm the file manager publishes route via `ui.windows.setRoute` and uses the four nav modes.
- [17-interoperability.md](../platform/17-interoperability.md) — `intent.quick-look` example wires through the file manager's Space-key handler.
- [42-file-manager-implementation.md](42-file-manager-implementation.md) — engineering plan tied to this UX spec.

## Summary

- **Three columns** — sidebar (tree + pinned + smart folders + tags), content pane (list / grid; column-view v2), inspector (preview / properties / links). All panels obey the 44px header rule.
- **Familiar mental model** — Finder/Explorer-shaped: persistent navigator, breadcrumb-up-top, rename-in-place, drag-to-move, multi-select with Shift / Mod, soft-delete to recently deleted.
- **Folder-agnostic sidebar** — pinned items, tags, smart folders, and saved queries are peer sections to the folder tree.
- **Type-aware content pane** — every row / tile renders the entity's `row` / `card` layout from doc 27. The file manager has no special-case rendering per type.
- **`intent.open` everywhere** — opening an entity always goes through the curated verb namespace per doc 17.
- **Keyboard-first** — every action declared in the shortcut registry; no raw `e.key`.
- **i18n from day one** — every string through `t(key)` with the `brainstorm.files.*` namespace.
- **Soft-delete only** — permanent deletion is a separate surface; the file manager never `Shift+Delete`s.
- **Performance budgets in place** — virtualized lists/trees, debounced search, single-transaction bulk moves.
- **Open questions** OQ-174 through OQ-179 capture the v1 vs v2 splits and a few small policy calls.
