# 30 — File manager and the Folder entity

This doc introduces a first-party **file-manager app** and the canonical **`brainstorm/Folder/v1`** entity type that gives Brainstorm hierarchical organization. It closes the collection-scope gap deferred since OQ-38.

The deeper architectural move: **a Folder is just an entity type**, not a shell primitive. Hierarchy is one organization among many.

It builds on [03-app-model.md](03-app-model.md), [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), [19-properties-and-schemas.md](../data/19-properties-and-schemas.md), [27-layouts.md](../shell/27-layouts.md), [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md), and [18-storage-and-search.md](../data/18-storage-and-search.md).

> **See also:** the file-manager's *UX / interaction* spec is in [41-file-manager-ux.md](41-file-manager-ux.md); the *engineering plan* (package layout, manifest, capability surface, iteration ladder for Stage 9 iteration 9.8) is in [42-file-manager-implementation.md](42-file-manager-implementation.md). This doc remains the source of truth for the `Folder/v1` data model.

## Why a Folder concept

Brainstorm's principle is "the schema is owned by data, not apps." A user organizing thousands of entities needs hierarchical structure, breadcrumbs, drag-to-organize, and "where does this live" answers. Without an explicit Folder concept, every app reinvents this.

Two failure modes Brainstorm avoids:

- **Flat-bag-of-objects** — every entity in one global pool; no first-class hierarchy.
- **Strict-single-parent tree** — every page has exactly one parent; cross-tree organization is awkward.

Brainstorm's answer: **multiple membership in many folders**, with hierarchy as one organization among others.

## The Folder entity type

> **Decision:** `brainstorm/Folder/v1` is canonical, registered by the shell-bundled file-manager app, but not owned by it.

Schema:

| Property         | Type                          | Notes                                                                |
|------------------|-------------------------------|----------------------------------------------------------------------|
| `name`           | text, count: {1, 1}            | Required.                                                            |
| `icon`           | entityRef or text, count: {0, 1} | Optional.                                                            |
| `description`    | richText, count: {0, 1}        | Optional notes.                                                       |
| `members`        | entityRefs, count: {0, 50}     | Ordered list; cap is hard limit per direct write.                     |
| `query`          | entityFilter, count: {0, 1}    | Optional saved query for smart folders.                               |
| `sortBy`         | text + vocabulary, count: {0, 1} | Manual / name / created / modified. Personal-by-default.            |
| `view`           | text + vocabulary, count: {0, 1} | tree / grid / list. Personal.                                       |

Ships with default Layout entities for `full`, `card`, `row`, `chip` contexts.

> **Decision:** the `members` count cap (50) is deliberate friction. Folders for thousands of items use the `query` property or organize hierarchically.

> **Open:** lift cap to 500 for advanced users? Tracked as OQ-117.

## Membership semantics

> **Decision:** **membership is on the folder, not the child.** A Folder's `members` array is authoritative. The child entity does not know which folders contain it; that's a reverse lookup.

Why load-bearing:

- An entity can be in zero, one, or many folders simultaneously.
- Adding/removing a Folder doesn't touch the child entity's data.
- Children survive folder deletion.
- "Schema is owned by data" holds — apps don't add hierarchy properties to other apps' entity types.

### Reverse lookup

"Which folders contain entity E?" via `entities.query({ type: "brainstorm/Folder/v1", where: { $contains: { "members": "<E.id>" } } })`. Reverse index in `entities.db` makes this O(1).

> **Decision:** the reverse index is a SQL query against the links table. No special-case code for Folders.

## Hierarchy

A Folder containing Folders is a tree. Nesting unbounded in the data model; rendering caps depth (default 8).

> **Decision:** **cyclic membership is rejected at write time.** Bounded depth-first walk (default depth 32) detects cycles.

## Smart folders

A Folder with a `query` property auto-resolves additional members:

```jsonc
{
  "type": "brainstorm/Folder/v1",
  "properties": {
    "name": "Recent Notes",
    "members": [],
    "query": {
      "type": "io.example/Note/v1",
      "where": { "$gt": { "modifiedAt": "$now-7d" } },
      "orderBy": [{ "property": "modifiedAt", "direction": "desc" }],
      "limit": 50
    },
    "view": "list"
  }
}
```

Resolution: explicit `members` first, then query results (de-duplicated).

> **Decision:** smart-folder queries reuse the entities query API. Not a separate language.

> **Decision:** template variables (`$now`, `$now-7d`, `$user`, `$vault`) resolve at query time so saved queries stay portable.

> **Open:** smart-folder refresh model. Tracked as OQ-118.

## Closing OQ-38: collection scope

Per [19-properties-and-schemas.md](../data/19-properties-and-schemas.md), property overlays scope at `entity` / `type` / `collection` / `user` / `org`. Folders make `collection` concrete:

> **Decision:** `scope: { kind: "collection", target: <folder-id> }` applies the overlay to all entities currently in that folder. The reverse index makes evaluation efficient.

> **Decision:** collection-scoped overlays are **inherited by transitive members** unless an inner folder's overlay overrides.

> **Open:** conflict when an entity is in two folders defining the same property at collection scope. Tracked as OQ-119.

## Breadcrumbs

The `chrome.breadcrumb` cell from [27-layouts.md](../shell/27-layouts.md) renders parent paths. Folders supply the resolution:

> **Decision:** breadcrumb chrome reads **navigation state**, not entity state. When the file manager opens entity X via path A → B → X, navigation context records the path. Without nav context, fallback walks reverse-membership and picks the first containing folder (alphabetical tie-break) recursively to vault root.

> **Decision:** "(vault)" is the breadcrumb root. `vault.json`'s `rootFolderId` defines it.

> **Open:** multi-folder breadcrumb without nav context. Tracked as OQ-120.

## The file-manager app

> **Decision:** the **file-manager app** is a first-party app shipping with the shell. It registers as primary opener for `Folder/v1`.

UI surfaces:

- **Tree view** sidebar.
- **Content pane** showing the active folder's members.
- **Breadcrumbs** at the top via `chrome.breadcrumb`.
- **Drag and drop** within and across apps.
- **Multi-select + bulk operations**.
- **Smart-folder editor** via `fancy-menus`' `queryBuilder` panel.
- **Folder properties panel** — edit folder properties AND author collection-scoped overlays.
- **Search within folder** — scoped `search.hybrid`.

Not the file manager:
- Not the dashboard (shell-owned per [04-shell.md](../shell/04-shell.md)).
- Not the owner of the Folder entity type.
- Not the owner of breadcrumb rendering — that's the chrome cell.

### App registrations

```jsonc
{
  "id": "brainstorm.files",
  "name": "Files",
  "registrations": {
    "openers": [
      { "entityType": "brainstorm/Folder/v1", "kind": "primary" }
    ],
    "intents": [
      { "verb": "open",   "entityType": "brainstorm/Folder/v1" },
      { "verb": "insert", "entityType": "brainstorm/Folder/v1" },
      { "verb": "move" },
      { "verb": "organize" }
    ]
  },
  "capabilities": [
    "entities.read:brainstorm/Folder/v1",
    "entities.write:brainstorm/Folder/v1",
    "entities.read:*",
    "schema.read:*"
  ]
}
```

> **Decision:** holds broad `entities.read:*` (shows whatever the user puts inside). Does NOT hold `entities.write:*` — moving = editing source/destination Folders' `members`, scoped.

> **Open:** `intent.move` capability requirements. Tracked as OQ-121.

## Cross-app interactions

### Drag from another app into a folder

1. DnD payload includes `application/x-brainstorm-entity` with entity ids (per [17-interoperability.md](../platform/17-interoperability.md)).
2. File manager handles drop, calls `entities.update(folderId, { $append: { members: [<ids>] } })`.
3. Reverse index updated; folder re-renders; collection-scoped overlays apply to new members.

### Smart folder over another app's type

1. Query: `{ type: "io.example.tasks/Task/v1", where: { $contains: { "tags": "urgent" } } }`.
2. File manager has `entities.read:*` → reads Task entities directly.
3. Each Task renders using its own type's `card` layout.

The file manager is **type-aware in display** — it asks the layout resolver for each member's `card` layout.

### `intent.move` from any app

Any app dispatches `intent.move` with `{ entityIds, fromFolderId?, toFolderId }`. Folders are the centralized membership authority.

## Vault root folder

Per [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md):

> **Decision:** every vault has a **root Folder** at vault creation. Its id is recorded in `vault.json` as `rootFolderId`. The file manager opens here by default.

The root folder is just a Folder; the shell's reference is the only "specialness."

> **Open:** root folder deletability. Tracked as OQ-122.

## Performance

| Scenario                                       | Mitigation                                                                |
|------------------------------------------------|---------------------------------------------------------------------------|
| Folder with 50 members + smart query for 1000  | Explicit at full layout; smart-folder results virtualize.                 |
| 10-level nested folder sidebar                 | Tree-view virtualization; collapsed folders don't render children.        |
| Reverse lookup                                 | SQL reverse index.                                                        |
| Bulk-move 1000 entities                        | Single Yjs transaction per affected folder.                               |
| Cyclic-membership detection on move            | Bounded DFS (depth 32).                                                   |

> **Decision:** bulk operations are atomic per folder, not across folders.

## What this is not

- **Not the only organization mechanism.** Tags, links, saved queries, launcher are peer organizations.
- **Not opinionated about content.** A Folder can contain any entity type.
- **Not a single-parent constraint.** Multi-membership is the default.
- **Not the dashboard.**

## Phasing

| Capability                                          | v1   | v2  |
|-----------------------------------------------------|------|-----|
| `brainstorm/Folder/v1` canonical type               | ✓    | ✓   |
| File-manager app (tree / grid / list)               | ✓    | ✓   |
| Multi-membership                                    | ✓    | ✓   |
| Hierarchy                                            | ✓    | ✓   |
| Cycle rejection                                      | ✓    | ✓   |
| Smart folders                                        | ✓    | ✓   |
| Collection scope (closes OQ-38)                      | ✓    | ✓   |
| Breadcrumb chrome from nav context                   | ✓    | ✓   |
| Bulk operations                                      | ✓    | ✓   |
| Drag-and-drop                                         | ✓    | ✓   |
| Folder-properties panel for collection-scoped overlays | ✓    | ✓   |
| Sub-types (Album extends Folder)                     | —    | ✓   |
| Folder templates as catalog content                  | —    | ✓   |

## Cross-doc updates needed

- [19-properties-and-schemas.md](../data/19-properties-and-schemas.md) — collection scope concrete; OQ-38 resolved.
- [27-layouts.md](../shell/27-layouts.md) — `chrome.breadcrumb` reads nav context; folder-walk fallback.
- [04-shell.md](../shell/04-shell.md) — clarify Files is a first-party app.
- [17-interoperability.md](../platform/17-interoperability.md) — add `intent.move` and `intent.organize`.
- [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md) — `rootFolderId`.
- [18-storage-and-search.md](../data/18-storage-and-search.md) — reverse index.

## Open questions

- **OQ-117** — Folder direct-membership cap.
- **OQ-118** — Smart-folder refresh model.
- **OQ-119** — Collection-scope conflict on multi-membership.
- **OQ-120** — Breadcrumb without nav context.
- **OQ-121** — `intent.move` capability.
- **OQ-122** — Vault root folder deletability.

## Summary

- **`brainstorm/Folder/v1`** is canonical; the file-manager app surfaces it.
- **Membership is on the folder** — entities can live in zero, one, or many folders without modification.
- **Hierarchy is folder-of-folders**; cycles rejected at write time.
- **Smart folders** use entity queries; explicit `members` and `query` coexist.
- **Closes OQ-38**: collection scope = "entities in this folder".
- **Breadcrumbs** read nav state, fall back to reverse-walk.
- **Vault has a designated root Folder**; file manager opens there.
- **One organization among many** — tags, links, queries, launcher are peers.
