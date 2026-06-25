# 42 — File manager — implementation plan

This is the **engineering plan** for the first-party file-manager app (`brainstorm.files`). It is paired with [30-file-manager-and-folders.md](30-file-manager-and-folders.md) (the `Folder/v1` data model) and [41-file-manager-ux.md](41-file-manager-ux.md) (the UX specification).

Goal: take the file manager from "not yet started" to "ships at the end of Stage 9 (iteration 9.8)" without leaving the workflow standards in [`implementation-plan.md §Workflow standards`](../implementation-plan.md) behind. Each iteration below is one PR-sized deliverable with explicit tests and exit criteria.

## Position in the broader plan

Implementation-plan stage 9 lists:

> 9.8 — file-manager app (`apps/files/`): browses granted folders; `brainstorm/Folder/v1` canonical type per [30](30-file-manager-and-folders.md). The vault's root Folder is what it opens to.

This doc expands that single iteration into a sub-iteration ladder **9.8.1 … 9.8.10**. Some sub-iterations depend on Stage 8 (layout system) and Stage 9.1–9.5 (`react-yjs`, `brainstorm-editor`, Block Protocol modules); the dependencies are flagged inline.

## Package layout

The app lives **outside** `packages/shell` because it is a sandboxed app (per [03-app-model.md](03-app-model.md)). Same posture as the text-editor and code-editor apps.

```
apps/
└── files/
    ├── manifest.json              ← installed by the shell on first launch
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── .size-limit.json
    ├── src/
    │   ├── index.html              ← the renderer entry
    │   ├── index.tsx                ← React bootstrap
    │   ├── file-manager-window.tsx  ← top-level window
    │   ├── sidebar/
    │   │   ├── sidebar.tsx
    │   │   ├── folder-tree.tsx
    │   │   ├── pinned-list.tsx
    │   │   ├── smart-folders-list.tsx
    │   │   ├── tags-list.tsx
    │   │   └── section.tsx          ← reusable section chrome
    │   ├── content/
    │   │   ├── content-pane.tsx
    │   │   ├── list-view.tsx
    │   │   ├── grid-view.tsx
    │   │   ├── empty-state.tsx
    │   │   ├── status-bar.tsx
    │   │   └── toolbar.tsx
    │   ├── inspector/
    │   │   ├── inspector.tsx
    │   │   ├── preview-tab.tsx
    │   │   ├── properties-tab.tsx
    │   │   └── links-tab.tsx
    │   ├── selection/
    │   │   ├── use-selection.ts     ← multi-select state machine
    │   │   ├── selection-publisher.ts
    │   │   └── range-select.ts
    │   ├── operations/
    │   │   ├── create.ts            ← new folder / new entity / upload
    │   │   ├── rename.ts            ← inline-rename state + commit
    │   │   ├── move.ts              ← drag-drop + cut/paste + intent.move
    │   │   ├── copy.ts              ← multi-membership add / duplicate
    │   │   ├── delete.ts            ← soft-delete + restore
    │   │   └── search.ts            ← in-folder filter + scope flip
    │   ├── intents/
    │   │   ├── on-intent.ts         ← intent dispatch handler (`open`, `move`, `quick-look`)
    │   │   └── compose-menu.ts      ← `intent.compose` aggregator for New ▾
    │   ├── nav/
    │   │   ├── use-nav.ts           ← in-window nav stack + setRoute
    │   │   └── breadcrumb-bridge.ts ← publishes nav context for chrome.breadcrumb
    │   ├── state/
    │   │   ├── file-manager-state.ts ← per-user FileManagerState/v1 entity helpers
    │   │   ├── per-folder-view.ts    ← columns / sort / view-mode helpers
    │   │   └── view-mode.ts          ← enum + types
    │   ├── shortcuts/
    │   │   └── shortcut-ids.ts       ← action-id constants for this app
    │   ├── i18n/
    │   │   └── strings.ts            ← `brainstorm.files.*` defaults
    │   ├── icons/
    │   │   └── canonical-names.ts    ← icon name registrations
    │   └── styles/
    │       └── *.css.ts              ← vanilla-extract sheets
    └── tests/
        ├── selection.test.ts
        ├── rename.test.ts
        ├── nav.test.ts
        ├── intents.test.ts
        ├── search.test.ts
        ├── operations.test.ts
        └── e2e/                      ← Playwright specs
            ├── open-folder.spec.ts
            ├── rename.spec.ts
            ├── move.spec.ts
            └── search.spec.ts
```

Per [`35-code-conventions.md`](../foundations/35-code-conventions.md): kebab-case files, feature folders (not type-of-thing folders), tests alongside source, **only the package root has a barrel** (`src/index.tsx` is the renderer entry, not a barrel — there is no library API for this app).

## Manifest

```jsonc
{
  "id": "brainstorm.files",
  "name": "Files",
  "version": "1.0.0",
  "sdk": "1",
  "description": "Browse, open, search, and organize everything in the vault.",
  "icon": "assets/icon.png",
  "entry": "dist/index.html",
  "capabilities": [
    "entities.read:brainstorm/Folder/v1",
    "entities.write:brainstorm/Folder/v1",
    "entities.read:brainstorm/File/v1",
    "entities.write:brainstorm/File/v1",
    "entities.read:*",
    "schema.read:*",
    "files.pick",
    "intents.dispatch:open",
    "intents.dispatch:quick-look",
    "intents.handle:open",
    "intents.handle:move",
    "intents.handle:quick-look",
    "intents.handle:compose",
    "storage.kv"
  ],
  "registrations": {
    "openers": [
      { "entityType": "brainstorm/Folder/v1", "kind": "primary" }
    ],
    "intents": [
      { "verb": "open", "entityType": "brainstorm/Folder/v1", "priority": "primary" },
      { "verb": "compose", "entityType": "brainstorm/Folder/v1" },
      { "verb": "compose", "entityType": "brainstorm/File/v1" },
      { "verb": "quick-look", "entityType": "brainstorm/Folder/v1" },
      { "verb": "quick-look", "entityType": "brainstorm/File/v1" }
    ],
    "entityTypes": [
      { "id": "brainstorm/Folder/v1", "schemaUrl": "https://brainstorm.dev/schemas/folder/v1.json" },
      { "id": "brainstorm/File/v1",   "schemaUrl": "https://brainstorm.dev/schemas/file/v1.json"   },
      { "id": "brainstorm/FileManagerState/v1", "schemaUrl": "https://brainstorm.dev/schemas/file-manager-state/v1.json" }
    ]
  },
  "layouts": [
    { "type": "brainstorm/Folder/v1", "context": "full", "config": { "...": "tree-view layout for full context" } },
    { "type": "brainstorm/Folder/v1", "context": "card", "config": { "...": "card-context layout" } },
    { "type": "brainstorm/Folder/v1", "context": "row",  "config": { "...": "row-context layout" } },
    { "type": "brainstorm/File/v1",   "context": "card", "config": { "...": "card-context for File" } },
    { "type": "brainstorm/File/v1",   "context": "row",  "config": { "...": "row-context for File" } }
  ],
  "shortcuts": [
    { "id": "brainstorm.files/new-folder", "default": "CmdOrCtrl+Shift+N", "label": "New folder" }
    // remaining action ids registered via the renderer's `default-chords.ts` style (per UX doc §Keyboard map)
  ]
}
```

> **Decision:** the file manager does **not** request `intents.dispatch:*`. It dispatches only `open` and `quick-look`; any cross-app verbs it needs in the future require explicit declaration. Per [09 §Capabilities](../security/09-security-and-sandbox.md): "narrowest form an app can ask for".

> **Decision:** `entities.read:*` is requested with a plain-language reason at install: "Files needs to read every entity type so it can show all of your data when you browse a folder." This is the broad capability doc 30 already calls out; it does **not** have a write-companion (`entities.write:*` is *not* requested — move operations are scoped to source/destination Folder writes per doc 30).

## Capability surface

| Capability                                | Why                                                                                | Granted at |
|-------------------------------------------|-------------------------------------------------------------------------------------|------------|
| `entities.read:brainstorm/Folder/v1`      | Read folders to render the tree, breadcrumb, and content pane.                       | install    |
| `entities.write:brainstorm/Folder/v1`     | Move, rename, create, delete folders; edit `members`.                                | install    |
| `entities.read:brainstorm/File/v1`        | Render File rows / tiles / previews.                                                  | install    |
| `entities.write:brainstorm/File/v1`       | Create File entities from upload; rename; soft-delete.                                | install    |
| `entities.read:*`                          | Show non-Folder, non-File entities (Notes, Tasks, etc.) inside folders.                | install (prompt-heavy) |
| `schema.read:*`                            | Read entity-type display hints to render the right `row`/`card` layout.                | install    |
| `files.pick`                               | "New file from upload" — opens the native picker.                                      | install    |
| `intents.handle:open` (for Folder/v1)      | Be the primary opener for Folder.                                                       | install    |
| `intents.handle:move`                      | Centralized move handler per doc 30.                                                    | install    |
| `intents.handle:quick-look`                | Folder + File quick-look handler.                                                       | install    |
| `intents.handle:compose`                   | "New Folder" / "New File" entries in the `New ▾` aggregator menu.                       | install    |
| `intents.dispatch:open`                    | Opening any non-Folder entity dispatches `open`.                                         | implicit (per [09](../security/09-security-and-sandbox.md))   |
| `intents.dispatch:quick-look`              | Space-bar preview.                                                                       | install    |
| `storage.kv`                               | Tiny per-vault preferences (e.g. last-active inspector tab).                              | implicit   |

> **Decision:** the file manager **never holds `entities.write:*`**. Every write is scoped to a type it explicitly requested. This is the principle behind doc 30's "Does NOT hold `entities.write:*`".

## Registrations summary (effects on the shell)

The shell's app installer (per `packages/shell/src/main/apps/installer.ts`) writes the file manager's registrations into `registry.db` at install. The relevant tables (per `packages/shell/src/main/storage/registry-repo/`):

- `openers` → primary opener for `brainstorm/Folder/v1`.
- `intents` → six rows (open / compose ×2 / quick-look ×2 / move).
- `entity_types` → three rows (Folder/v1, File/v1, FileManagerState/v1).
- `widgets` → none in v1 (a "Recent files" widget is deferred to post-Stage 9).

## Entity types introduced or referenced

### `brainstorm/Folder/v1` (introduced; per doc 30)

Already specified in [30](30-file-manager-and-folders.md). The file manager registers it but does not own it.

### `brainstorm/File/v1` (introduced; per [19](../data/19-properties-and-schemas.md) "files as entities")

A canonical entity type for a file in the vault's `attachments/` blob store. Schema sketch (full schema lands with iteration 9.8.5):

| Property        | Type                                | Notes                                                        |
|-----------------|-------------------------------------|--------------------------------------------------------------|
| `name`          | text, count: {1,1}                   | Required. Includes extension.                                |
| `mime`          | text, count: {1,1}                   | RFC 6838 string (`image/png`, `application/pdf`, etc.).      |
| `size`          | number, count: {1,1}                 | Bytes.                                                       |
| `hash`          | text, count: {1,1}                   | Blob content hash (`sha256:…`).                              |
| `attachment`    | fileHandle, count: {1,1}              | Opaque handle to the blob in `attachments/`.                  |
| `thumbnail`     | fileHandle, count: {0,1}              | Optional pre-rendered preview (post-Stage 9 backfill).         |
| `description`   | richText, count: {0,1}                | Optional caption.                                              |
| `tags`          | text[], count: {0,*}                  | User-applied tags.                                              |

> **Decision:** the file manager **does** introduce `File/v1`. Although "files as entities" is a doc-19 concept, no other Stage-9 app needs to introduce it — the file manager is the natural owner-of-record. Other apps (text-editor, image viewer) handle existing File entities via `intent.open` without introducing the type.

### `brainstorm/FileManagerState/v1` (introduced; per UX doc §Sidebar / §View modes)

A per-user singleton entity holding:

| Property             | Type                                                  | Notes                                                  |
|----------------------|-------------------------------------------------------|--------------------------------------------------------|
| `pinned`             | entityRefs, count: {0,50}                              | Sidebar pin list.                                       |
| `defaultView`        | text + vocabulary (list/grid)                           | Used when a Folder doesn't set its own `view`.         |
| `defaultColumns`     | text[], count: {0,*}                                    | Fallback column set.                                    |
| `inspectorOpen`      | boolean                                                | Inspector toggle last value.                              |
| `inspectorWidth`     | number                                                  | Last-set inspector width in pixels.                       |
| `sidebarWidth`       | number                                                  | Last-set sidebar width in pixels.                         |
| `expandedNodes`      | entityRefs                                              | Tree nodes the user has expanded.                          |
| `recentFolders`      | entityRefs, count: {0,20}                              | MRU for the launcher's "recently visited" hook.            |

> **Decision:** `FileManagerState` is **per-vault, per-user** (scope `user`). It does **not** sync at Stage 9; Stage 10's sync transport picks it up automatically since it's just an entity.

### `brainstorm/Bookmark/v1` (deferred; per UX doc OQ-176)

Defer to a follow-up doc once OQ-176 resolves.

## State model — what's where

Per [13 §State management](../shell/13-frontend-stack.md): **Yjs is the source of truth for entity-shaped state**. The file manager follows that. Specifically:

| State                                             | Where                                            | How accessed                                                 |
|---------------------------------------------------|--------------------------------------------------|--------------------------------------------------------------|
| Active folder id, in-window nav stack              | React state (in `use-nav.ts`)                     | `useState` + `ui.windows.setRoute` push.                      |
| Selected entity ids                                | React state                                       | `useReducer` for multi-select state machine; published via `selection.publish(...)` per [17](../platform/17-interoperability.md) §Selection. |
| Folder members (the displayed list)                | Yjs                                              | `entities.subscribe({ id: folderId })` + `entities.getMany(memberIds)`. |
| Smart-folder results                                | Yjs + query                                      | `entities.query(folder.query)` re-runs on relevant entity-change events. |
| Per-folder view config (columns, sort, view-mode)   | Yjs (Folder properties)                          | `entities.update(folderId, { properties: {...} })`.            |
| Per-user view defaults, pin list, expanded tree     | Yjs (FileManagerState)                            | `entities.subscribe(stateEntityId)`.                            |
| Inspector tab, in-window search query                | React state                                      | `useState` (transient; not persisted across reloads).            |
| Rename mode active for entity X                     | React state                                      | `useState` (transient).                                          |

No Zustand store in v1 (per [13](../shell/13-frontend-stack.md) — Zustand only when state is genuinely cross-component *and* not entity-shaped).

## Broker calls used

The file manager calls only the host-service APIs from [08-app-sdk.md](08-app-sdk.md). For reference, the calls actually used:

- `entities.get(id)`
- `entities.subscribe({ type | id | ... }, onUpdate)`
- `entities.query({...})`
- `entities.create(type, properties, links?)`
- `entities.update(id, patch)`
- `entities.delete(id)` (soft-delete)
- `files.requestOpen({ filters: [...] })` — for "New File from upload" (per [`CLAUDE.md`](../../CLAUDE.md) "File-open / file-save dialogs declare allowed extensions when the operation is filterable" — the picker is exhaustive for the files the app actually handles).
- `files.read(handle)` — for thumbnail generation in the inspector preview.
- `intents.dispatch({ verb, payload, source })` — for `open` and `quick-look`.
- `intents.suggest({ verb, payload })` — for the New ▾ menu's `compose` aggregator.
- `ui.windows.setRoute(route)`
- `ui.navigation.back() / forward()`
- `ui.notify({...})` — toasts.
- `capabilities.subscribe(onChange)` — to degrade gracefully on revoke.
- `selection.publish({...})`

> **Decision:** **no `yjs.raw`** — the file manager never gets direct Y.Doc access. It works through entity reads/writes. The Lexical-backed inspector preview reads rich text via `entities.getYFragment(...)` but never reaches into the doc directly.

## Per-iteration breakdown (9.8.1 – 9.8.10)

Each sub-iteration is one PR. The exit criterion of each is the merge target: a working incremental product, not an internal milestone. **Total time budget:** approximately one stage's worth (≈ 2 weeks calendar, depending on parallelism with 9.9 / 9.10).

### 9.8.1 — App skeleton + manifest + install

**Goal:** the shell installs `brainstorm.files` at first launch as a bundled first-party app, and the user can launch it (empty window).

**Tasks:**

- Create `apps/files/` with `package.json`, `tsconfig.json`, `vite.config.ts`, `.size-limit.json`, `manifest.json`, `src/index.html`, `src/index.tsx` (renders a placeholder "Files" string).
- Add the build step to the workspace root (`bun run build` produces `apps/files/dist/`).
- Wire the bundled-first-party-install hook in `packages/shell/src/main/index.ts`: on vault create or shell start, if `brainstorm.files` is not in `apps_repo`, install from `apps/files/dist/`.
- Add a `Files` icon to the dashboard's default-pinned set.

**Tests:**

- Unit: `apps/files/tests/manifest.test.ts` — manifest validates against the shell's `validateManifest`.
- Unit: shell-side test for the bundled-install hook (idempotent on second launch).
- E2E: Playwright opens the shell, finds the Files icon on the dashboard, clicks it, sees the placeholder window.

**Exit criteria:**
- ✓ `bun run build` produces a valid app bundle.
- ✓ The shell installs it on first launch into `registry.db`.
- ✓ Clicking the dashboard icon launches the placeholder window with the right title.
- ✓ Coverage floor (70%) met for `apps/files/`.

### 9.8.2 — Vault root folder, tree view, in-window navigation

**Goal:** the user opens Files, sees the vault's root folder, navigates into child folders, navigates back. No content pane yet — just the sidebar tree and a placeholder content area.

**Depends on:** Stage 9.1 (`react-yjs` hooks), iteration 9.8.1.

**Tasks:**

- Implement the vault's root-folder bootstrap in `packages/shell/src/main/vault/session.ts`: on vault create, create a Folder entity with `name = "(vault)"` and record its id as `rootFolderId` in `vault.json`.
- Wire `FolderTree` reading `entities.subscribe(rootFolderId)` and recursively descending into member entities whose `type === "brainstorm/Folder/v1"`.
- Wire `useNav` with in-window back/forward, `ui.windows.setRoute("brainstorm://entity/<folderId>")` on every change.
- Implement `breadcrumb-bridge.ts` publishing navigation context per doc 30.
- Add the `up` / `back` / `forward` shortcut ids (per UX doc §Keyboard map).

**Tests:**

- Unit: nav stack push/pop semantics, route normalization.
- Unit: tree-rendering against a synthetic vault with depth-5 folders.
- E2E: open Files → click child folder → click child-child → press Back → land on parent.

**Exit criteria:**
- ✓ The vault has a root folder at `rootFolderId`.
- ✓ User navigates 8 levels deep and back without losing state.
- ✓ Breadcrumb chrome renders the right path.
- ✓ Coverage floor maintained.

### 9.8.3 — Content pane (list view) + selection model

**Goal:** the content pane renders members in list view; the user can single-select, range-select, multi-select with Mod; the status bar shows selection summary.

**Tasks:**

- `ListView` component virtualizing with `@tanstack/react-virtual`.
- `Row` renders entity's `row`-context Layout (using the layout resolver from Stage 8).
- Implement `use-selection.ts` — full multi-select state machine (anchor + range + toggle).
- Implement `selection-publisher.ts` — pushes selection through `selection.publish(...)`.
- Implement `status-bar.tsx` — renders count / selection summary; `t()` keys per UX doc §Localization.
- Toolbar shell with the view-mode switcher (list/grid icons).

**Tests:**

- Unit: selection state machine — every modifier combo (single, range, toggle, select-all).
- Property test: random sequence of clicks vs. final selection set converges per spec.
- Unit: virtualizer's `getRow(i)` for boundaries (0, last, off-screen).
- E2E: Shift-click range; Mod-click toggle; status bar text matches.

**Exit criteria:**
- ✓ List view renders 10k rows at 60 fps idle.
- ✓ Selection works across all five modifier combinations.
- ✓ Status bar matches the visible selection.
- ✓ Coverage floor maintained.

### 9.8.4 — Open + quick-look + intents wiring

**Goal:** double-click / `Enter` / `Space` work for every entity in the content pane via `intent.open` / `intent.quick-look`. The shell-side resolver lands handler routing.

**Depends on:** Stage 9.6 + 9.7 (text-editor / code-editor as primary openers of Note types). Without them, the file manager opens only Folder/v1 itself (focus-existing on the file-manager window) and a stub fallback.

**Tasks:**

- `on-intent.ts` registers handlers for `open` (Folder, File), `quick-look` (Folder, File).
- File manager's own `open` handler for Folder: internal-navigate (don't re-dispatch).
- `quick-look` handler for both types: render the entity's `preview` layout in a modal popover via the existing `<Popover>` primitive.
- Double-click / Enter / Space gestures wired to action ids via `useShortcut`.

**Tests:**

- Unit: intent handler correctly distinguishes Folder (in-window nav) from non-Folder (intent.dispatch).
- Property test: dispatching `intent.open` from the file manager and asserting the shell's navigation resolver picks the right handler.
- E2E: open a Note from the file manager → it opens in the text-editor window per the user's mode default.

**Exit criteria:**
- ✓ Every entity type in the test vault opens via the right handler.
- ✓ Quick-look works for Folder and File without launching their primary opener.
- ✓ Coverage floor maintained.

### 9.8.5 — Create flow (folders + files + compose intent)

**Goal:** the user creates new folders, new files (via upload), and dispatches `compose` for type-specific creates from the `New ▾` menu.

**Tasks:**

- `New ▾` toolbar menu via `@react-fancy-menus/core` (re-exported from the SDK).
- Aggregate creator entries via `intents.suggest({ verb: "compose" })`.
- "New folder" path: `entities.create("brainstorm/Folder/v1", { name: "Untitled folder" }, ...)` + add to active folder's `members` + enter rename mode immediately.
- "New file" path: `files.requestOpen({...})` → create File/v1 entity per picked file → copy blob to `attachments/`.
- Introduce `brainstorm/File/v1` entity-type registration; ship default `row` and `card` layouts (per UX doc §Visual identity).

**Tests:**

- Unit: New folder creates, names "Untitled folder", appears at top of active folder's content pane.
- Unit: New file upload creates the right File/v1 entity with `mime`, `size`, `hash`.
- Unit: Aggregator menu reflects `intents.suggest` correctly when other apps register `compose` for their types.
- E2E: create folder, rename inline, see it persisted after reload.

**Exit criteria:**
- ✓ New folder works keyboard-only (`Mod+Shift+N` → type name → `Enter`).
- ✓ New file upload roundtrips through the picker.
- ✓ `File/v1` is registered; primary opener resolves for it (deferred to whichever app registers it — image-viewer is post-Stage 9).
- ✓ Coverage floor maintained.

### 9.8.6 — Inline rename + collision handling

**Goal:** rename works in place. Conflicts surface a confirm rather than silently appending suffixes.

**Tasks:**

- `rename.ts` state machine: idle → editing → committing → idle, with rollback on Escape.
- Inline `<input>` placed over the name cell, value pre-selected sans extension.
- Commit goes through `entities.update(id, { properties: { name } })`.
- Collision detector: read active folder's `members`, compare by `name`; if collision → open the rename-collision `<Confirm>` per UX doc §Rename flow.
- Three actions on collision: rename anyway, replace (only for File/v1, soft-deletes the existing), cancel.

**Tests:**

- Unit: state machine — every transition.
- Unit: collision detection — case-sensitive + Unicode-normalized.
- E2E: rename, hit collision, pick "Rename anyway"; rename, hit collision, pick "Cancel" → original name restored.

**Exit criteria:**
- ✓ Rename works via keyboard (`Enter` → type → `Enter`).
- ✓ Collision surfaces correctly; no silent suffixing.
- ✓ Coverage floor maintained.

### 9.8.7 — Move, copy, drag-and-drop + `intent.move`

**Goal:** drag-and-drop within the file manager and across apps; cut/copy/paste; cross-app `intent.move`.

**Depends on:** Stage 8 (chrome cells; `intent.move` host-side capability flow per OQ-121).

**Tasks:**

- `move.ts`: takes a source folder id, dest folder id, and a list of entity ids; runs a single Yjs transaction per affected folder per doc 30.
- `copy.ts`: multi-membership add (the same entity id appended to dest's `members`); separate `duplicate` operation creates a new entity.
- `@dnd-kit` integration for drag-drop within the sidebar/content pane.
- `dataTransfer` payload includes `application/x-brainstorm-entity` per [17 §Drag-and-drop](../platform/17-interoperability.md) so drops onto other apps work.
- `intent.move` handler implemented; same code path as in-window drag-drop.
- `Mod+X` / `Mod+C` / `Mod+V` action ids wired to the same handlers.
- Cycle rejection per doc 30 — depth-32 DFS at write time.

**Tests:**

- Unit: cycle rejection (every depth from 1 to 32).
- Unit: bulk-move 1000 entities in one transaction.
- Property test: random move sequences converge to the right `members` arrays.
- E2E: drag-drop one row, multi-select drag-drop, keyboard cut-paste.

**Exit criteria:**
- ✓ Drag-drop works within file manager and from another app.
- ✓ `intent.move` dispatched from the database app (Stage 8 test app) lands in the right folder.
- ✓ Cycles rejected at write time with a clear toast.
- ✓ Coverage floor maintained.

### 9.8.8 — Soft-delete + restore + Recently Deleted

**Goal:** Delete / Backspace soft-deletes; a Settings → Vault → Recently Deleted panel surfaces restore + permanent-delete.

**Tasks:**

- `delete.ts`: set `deleted_at` on selected entities via `entities.delete(id)` (the SDK call already maps to soft-delete per [18 §Schema](../data/18-storage-and-search.md)).
- Pre-delete confirm `<Confirm>` per UX doc §Delete.
- Add a `Recently Deleted` section to the shell's existing Settings overlay under a new "Vault" tab.
- Listing query: `entities.query({ where: { $exists: { deleted_at: true } } })` filtered by retention window.
- Restore: clear `deleted_at`.
- Permanent delete: hits a privileged dashboard-only path (apps cannot permanently delete by themselves).

**Tests:**

- Unit: soft-delete + restore roundtrip.
- Unit: retention window cut-off.
- E2E: delete from the file manager → check Recently Deleted → restore → confirm visible again.

**Exit criteria:**
- ✓ Delete / Backspace never lose data.
- ✓ Recently Deleted lists soft-deleted entities and supports restore.
- ✓ Permanent delete only available from Recently Deleted, not the file manager.
- ✓ Coverage floor maintained.

### 9.8.9 — Search (in-folder filter + scope flip to launcher)

**Goal:** `Mod+F` filters the active folder live; the scope chip flips between "this folder", "subfolders", "vault" (launcher).

**Tasks:**

- Toolbar search field; debounced input.
- In-renderer string-match against the active members for "this folder".
- `entities.query(...)` walking subfolders for "subfolders".
- Flip to launcher: closes the file manager's search, calls the launcher's open-with-query IPC (per [04 §Launcher](../shell/04-shell.md)).
- "Save as smart folder" via `queryBuilder` panel of `@react-fancy-menus/core`.

**Tests:**

- Unit: filter algorithm correctness (case folding, diacritic folding, prefix vs substring).
- Property test: filter result for a random member list matches the spec.
- E2E: search "design" in a 1k-member folder → see filtered list within 16 ms (per perf budget).

**Exit criteria:**
- ✓ All three scope modes work.
- ✓ Saved smart folder appears in the sidebar.
- ✓ Perf budgets met (per UX doc §Performance).
- ✓ Coverage floor maintained.

### 9.8.10 — Inspector + view options + persistence

**Goal:** the right-side inspector tabs, the View ▾ menu, per-folder view-state persistence, and the `FileManagerState/v1` per-user singleton entity.

**Tasks:**

- `Inspector` with three tabs (Preview, Properties, Links). Each tab reads the focused entity's `preview` / writes properties via `entities.update` / reads `entities.query({ link: { source/dest } })`.
- View ▾ menu via `@react-fancy-menus/core` — sort, group, columns, view mode picker.
- Per-folder columns/sort/view-mode persist on the Folder entity; default-fallback values persist on FileManagerState.
- Inspector toggle persists on FileManagerState.
- Layout helper: panel-resize state (sidebar / inspector widths) persists.

**Tests:**

- Unit: state precedence — Folder property wins; FileManagerState fills gaps; built-in default fills if neither set.
- Unit: inspector property edits round-trip.
- E2E: change view mode, switch folder, switch back — state remembered.

**Exit criteria:**
- ✓ Inspector renders for every entity type via layout system.
- ✓ View ▾ menu persists per-folder.
- ✓ FileManagerState entity initializes correctly on first launch.
- ✓ Coverage floor met **across the whole `apps/files/` package**.
- ✓ Full UX doc §Performance budget table verified by the perf harness.
- ✓ Playwright suite (`apps/files/tests/e2e/`) covers the four canonical flows (open, rename, move, search).
- ✓ Stage 9 stability + perf + security audits passed for this iteration (recorded under `docs/_review/<date>-stage-9-audit.md`).

## Test plan summary

Per the workflow standards in [`implementation-plan.md`](../implementation-plan.md):

- **Coverage floor 70%** (first-party apps). Tracked per-PR via `@vitest/coverage-v8`.
- **Property tests** required for: multi-select state machine; nav-stack push/pop; cycle rejection on move; rename-state machine.
- **E2E** required for: open-folder, open-entity-via-intent, rename, drag-drop move, search.
- **A11y**: every PR's E2E spec includes `axe-core` assertions.
- **i18n**: every PR ships its new `brainstorm.files.*` ids in `apps/files/src/i18n/strings.ts`; CI rejects bare JSX text per the Stage 8 lint rule.
- **Keyboard**: every PR's UI-touching code declares new action ids in `shortcut-ids.ts` and binds via `useShortcut`. Lint rejects raw `e.key`.

## Performance budgets and harness checkpoints

| Iteration | Budget checkpoint                                                        |
|-----------|--------------------------------------------------------------------------|
| 9.8.1     | Bundle size: `apps/files/dist/index.js` < 250 KB gz per [13 §Performance budgets](../shell/13-frontend-stack.md). Measured by `size-limit`. |
| 9.8.2     | Folder switch: < 80 ms p50.                                              |
| 9.8.3     | 10k rows at 60 fps idle in the perf harness.                              |
| 9.8.5     | New folder → first paint: < 100 ms.                                       |
| 9.8.7     | Bulk move 100 entities: < 250 ms.                                         |
| 9.8.9     | In-folder search (≤ 1k members): < 16 ms per keystroke.                   |
| 9.8.10    | Cold open (window from launcher): < 200 ms after handshake.                |

Regressions > 5% require either justification or fix-forward per standard 2.

## Security and capability audit checkpoints

Per [`implementation-plan.md §3 Stability and security`](../implementation-plan.md):

- **9.8.1**: new app, new install path. Run `/security-review` over the manifest + install hook. Confirms no escalation.
- **9.8.4**: new intent handlers (`open`, `quick-look`, `move`). Confirm scope is narrow and `compose` requires user gesture.
- **9.8.5**: `files.requestOpen` usage — verify `filters` declares file kinds (per [`CLAUDE.md`](../../CLAUDE.md)).
- **9.8.7**: `intent.move` — closes OQ-121 with the capability decision: `intents.handle:move` is sufficient because the broker re-checks per-Folder write capability on every `entities.update`.
- **9.8.10**: end-of-iteration security audit logged under `docs/_review/<date>-stage-9-files-audit.md`.

## Schema migration notes

The shell's per-DB migrations (per [`packages/shell/src/main/storage/migrations.ts`](../../packages/shell/src/main/storage/migrations.ts)) do not change as a result of the file manager. Three entity types **are** added to `registry.db.entity_types`, but that table is data-driven (one INSERT per registered type), not a schema migration.

Doc 30 already specified the `Folder/v1` schema; the file manager registers it. No DB schema bump.

## Intent-verb namespace updates

The current `INTENT_VERBS` constant in [`packages/shell/src/main/apps/manifest.ts`](../../packages/shell/src/main/apps/manifest.ts) is the curated set from [17-interoperability.md](../platform/17-interoperability.md): `open, insert, share, convert, export, import, process, compose, quick-look`.

Doc 30 names two verbs not in that list: **`move`** and **`organize`**. The file-manager iteration 9.8.7 needs `move`. Adding it is a single-line update to `INTENT_VERBS` plus the matching `INTENT_VERB_SET` and intents-bus payload mapping. Treat that as part of 9.8.7's PR, not a separate iteration.

`organize` from doc 30 (a higher-level "let me arrange these") is **not** required in v1 — defer until a concrete user gesture wants it.

## Layout-system dependency

The file manager relies on the **layout resolver** from Stage 8 to render each entity in `row` / `card` / `preview` context. Specifically:

- `Folder/v1` ships default `row`, `card`, `preview`, `full` layouts in `manifest.layouts`.
- `File/v1` ships default `row`, `card`, `preview` layouts (no `full` — opens via primary opener).
- Generic entities the file manager doesn't introduce render via the **shell fallback layout** per [27 §Resolution](../shell/27-layouts.md).

If Stage 8's layout resolver is not yet available when 9.8.3 lands, the file manager falls back to a hand-rolled row renderer (per the `avoid-blocking-on-deps` workflow memory): a fixed schema-driven `<Row name={title} updated={updatedAt} type={typeName}/>`. Migrate to the layout resolver when it ships.

## Bundled-install hook

The file manager ships **with the shell**, not as a downloadable app. The hook:

```ts
// in packages/shell/src/main/index.ts (sketch — concrete impl in 9.8.1)
async function ensureFirstPartyApps(installer: AppInstaller): Promise<void> {
  const bundled = [
    { id: "brainstorm.files",   dir: join(app.getAppPath(), "../apps/files/dist") },
    // text-editor, code-editor, etc. — added by their own iterations
  ];
  for (const { id, dir } of bundled) {
    if (!installer.isInstalled(id)) {
      await installer.installFromDirectory(dir);
    }
  }
}
```

Run on every shell start. **Idempotent** — repeated calls do nothing if the version on disk matches. Per the workflow-standards memory: tests added in 9.8.1 cover both first-install and second-launch (no-op) paths.

## Cross-doc updates required when iterations land

- [`implementation-plan.md`](../implementation-plan.md) §Stage 9 — when each sub-iteration lands, mark `9.8.x ✓ DONE` with a one-line note (per the keep-plan-current workflow memory).
- [`30-file-manager-and-folders.md`](30-file-manager-and-folders.md) — when 9.8.5 lands, update the "Phasing" table to mark v1 capabilities ✓ implemented.
- [`28-vault-and-onboarding.md`](../foundations/28-vault-and-onboarding.md) — when 9.8.2 lands, confirm the root-folder bootstrap is wired (it's already specified there; this is a checkbox).
- [`reference/10-glossary.md`](../reference/10-glossary.md) — add `File/v1`, `FileManagerState/v1`, "Recently Deleted" entries.
- [`reference/11-open-questions.md`](../reference/11-open-questions.md) — OQ-174 / OQ-175 / OQ-176 / OQ-177 / OQ-178 / OQ-179 from [41](41-file-manager-ux.md) added; OQ-121 (intent.move capability) resolved at 9.8.7.

## Stage exit criteria (recap from implementation-plan.md)

Stage 9's existing exit criterion for the file manager:

> The file-manager opens a granted folder; revoking the grant ends the app's access on next read.

After this plan, the bar is:

- ✓ The file-manager app is installed bundled with the shell and visible on the dashboard.
- ✓ Opening it shows the vault's root folder.
- ✓ User creates / renames / moves / copies / deletes / searches inside the file manager.
- ✓ Cross-app `intent.open`, `intent.move`, and `intent.quick-look` work both ways (file manager dispatching and handling).
- ✓ Revoking `entities.read:*` ends the cross-type read path on next subscription update.
- ✓ Performance budgets met per UX doc.
- ✓ A11y test passes via `axe-core`.
- ✓ Coverage floor 70% met across `apps/files/`.

## Open questions raised by this implementation plan

These are added to [11-open-questions.md](../reference/11-open-questions.md) as concrete engineering decisions surfaced during planning:

- **OQ-180** — Bundled-install hook location: is `ensureFirstPartyApps` in `main/index.ts` (this plan's leaning) or a dedicated `main/first-party-apps.ts` module? Question is about discoverability vs. size of `index.ts`.
- **OQ-181** — Per-folder column / sort state representation: are these distinct properties on Folder (`columns`, `sort`, `viewMode`), or one composite `viewConfig` property? Composite is forward-compatible; distinct is greppable.
- **OQ-182** — `FileManagerState` per-user vs per-device. Currently planned as per-user (entity-shaped, syncs in Stage 10). Argument for per-device: monitor resolution drives sidebar/inspector width preferences. Tentative leaning: per-user with per-device overrides stored locally via `storage.kv` (the small surface).

## Summary

- **One Stage-9 iteration (9.8) expands into ten PR-sized sub-iterations (9.8.1 – 9.8.10).** Each is independently shippable.
- **Skeleton in 9.8.1, navigation in 9.8.2, list view in 9.8.3, intents in 9.8.4, create in 9.8.5, rename in 9.8.6, move in 9.8.7, delete in 9.8.8, search in 9.8.9, inspector + persistence in 9.8.10.**
- **Capability surface is narrow:** Folder/File reads and writes scoped to their types; `entities.read:*` for cross-type display; no broad write capability.
- **Three new entity types** introduced: `File/v1`, `FileManagerState/v1`, and `Folder/v1` (registration — doc 30 owns the schema).
- **State model is Yjs-first**, with React state only for transient UI (selection, rename, search).
- **Performance and a11y are first-class** — every iteration checkpoints against the UX-doc budgets and runs `axe-core` in E2E.
- **Open questions OQ-180 / OQ-181 / OQ-182** capture the small engineering policy calls; UX-side OQ-174 – OQ-179 are tracked separately.
