# Database — embedding and intents

The Database app is not just a standalone window; it's a building block. Two ways it composes with the rest of the system:

1. **Embedded list block** — a Block-Protocol block that renders a List inside a Note (or any host that supports BP embeds).
2. **Intents** — verbs the Database app handles (open a List, open the type-List for a type, add an entity to a List, create a new List) and verbs it dispatches.

This is the doc for both.

## The `embedded-list` block

The Database app registers one Block-Protocol block:

```
block id:     brainstorm.database/embedded-list/v1
type:         block
data target:  brainstorm/List/v1 (a List entity by id)
view target:  brainstorm/ListView/v1 (optional — pick which view to render)
```

Behavior: when a Note contains a `BlockEmbedNode` (per [editing/15-embedding-and-composition.md](../../editing/15-embedding-and-composition.md)) pointing at the `embedded-list` block id with a `List/v1` entity reference, Lexical mounts the block in an iframe-isolated frame (per [data/05-data-and-blocks-protocol.md](../../data/05-data-and-blocks-protocol.md) §Blocks). The frame loads the Database app's `block` bundle and renders the bound List at the bound view (or `defaultViewId`).

### Block contract

The block speaks BP-Core for lifecycle + BP-Graph for entity reads + BP-Hook for the property editor surfaces. The minimal message set:

| Direction      | Message                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| Host → block   | `graph.entity` — initial List/v1 entity                                              |
| Host → block   | `graph.entity` — initial ListView/v1 entity (if pinned)                              |
| Host → block   | `graph.subscribe` — subscription to member entities                                  |
| Block → host   | `graph.updateEntity` — write filter changes back to the view (if user edited inline) |
| Block → host   | `intent.dispatch` — when a row is clicked, "open this entity"                         |
| Host → block   | `hook.editor` — when an inline editor is needed (e.g. cell edit), host opens it      |

### Permissions

Embedded lists inherit the **host page's read access** to the bound List entity. The block doesn't get a free pass to read other Lists or all entities. Per [data/05-data-and-blocks-protocol.md §Blocks](../../data/05-data-and-blocks-protocol.md) and [editing/15-embedding-and-composition.md](../../editing/15-embedding-and-composition.md), the block frame has *no inherited capabilities* — it can only act on entities the host explicitly hands it.

This means an embedded list can:

- Render the bound List's effective members (the host already has read on those by virtue of having read on the List).
- Edit the bound view's filters / sorts (the user has write on the host page; the host extends a *scoped* write capability).
- Open a member entity (via intent dispatch, which the host can intercept and route).

It cannot:

- Read Lists other than the bound one.
- Modify the List's source or members (those are non-bound state — the user must open the standalone Database app for that).
- Create new entities (the block frame doesn't get `entities.write`; create flows happen in the standalone window).

> **Decision:** the embedded block is **read-mostly**. Editing the source / members happens in the standalone Database window, opened via "Open in Database" affordance on the embedded list. This keeps the capability surface tight and the embedded UX focused on display.

### Embed UX

Inside the Note, the user inserts an embedded list via the slash-menu command `/database` (or `/list`) → fancy-menus picker → either pick an existing List or "Create new". The block renders inline:

```
┌────────────────────────────────────────────────────────────┐
│ 🎬 Movies to watch     [Status ▾] [By status ▾] [Open ⤴]   │ ← header strip
├────────────────────────────────────────────────────────────┤
│  (board / grid / gallery / … rendered at reduced density)  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

The header strip carries the List icon + name, the active view picker (read-only — pick which of the List's views to show here), and "Open ⤴" which dispatches `intent.open` for the List entity (opens the standalone Database app on it).

The block has **fixed height** (configurable via Lexical's resize handle, default 480px). Long lists scroll inside; "Open ⤴" is the escape hatch.

> **Decision:** the embedded list **always shows one of the List's existing views**, never a one-off view defined in the Note. If the user wants a custom view "just for this Note," they create a new ListView on the List and pick it in the header. This avoids the recurring prior-tool problem where inline-set views and standalone-set views drift apart.

> **Open:** can the same `embedded-list` block embed a **different** view than the List's `defaultViewId` and persist that selection on the block (not the List)? Or must it always render the default? Tracked as **OQ-LD-11**. Tentative: yes, persist the chosen view-id as a block prop in the Lexical node; the List's `views` array is the menu's value space.

## Intents

[platform/17-interoperability.md](../../platform/17-interoperability.md) defines the curated intent verb namespace. The Database app handles and dispatches these:

### Intents the Database app handles

| Intent                     | Argument                                                                | Behavior                                                                                |
| -------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `intent.open`               | `{ entity: ent_list_… }`                                                | Open the standalone Database window on this List. Focus existing window if open.        |
| `intent.open`               | `{ entity: ent_view_… }`                                                | Open the parent List with this view active.                                             |
| `intent.open`               | `{ type: "brainstorm/List/v1" }` (no entity)                            | Open the "All Lists" launcher view in the Database window.                              |
| `intent.create`             | `{ type: "brainstorm/List/v1", draft?: { source, name, icon } }`        | Open the "New List" flow with the draft pre-filled.                                     |
| `intent.create`             | `{ type: "brainstorm/ListView/v1", listId, kind, … }`                   | Add a view to a List.                                                                   |
| `intent.add-to-list`         | `{ listId, entityIds: string[] }`                                      | Bulk-add entities to a List's `members.include` (multi-select drag-into-list use case). |
| `intent.remove-from-list`    | `{ listId, entityIds: string[] }`                                      | Bulk-remove (drops include or appends exclude per the algorithm in [10](10-lists-sets-collections.md) §Operations). |
| `intent.export-list`         | `{ listId, format: "csv" \| "json" \| "markdown" }`                    | Export effective members. Streams to a file via the file-manager's save-dialog flow.    |

Two of these are **new verbs** in the curated namespace:

- `intent.add-to-list` and `intent.remove-from-list` — explicit list-membership operations that any app can dispatch (e.g. file-manager right-click → "Add to list…").
- `intent.export-list` — list-aware export. The generic `intent.export` already exists for entities; this one operates on the effective members of a list.

> **Decision:** these three new intents are added to the curated namespace per [platform/17-interoperability.md](../../platform/17-interoperability.md). They register the Database app as the canonical handler.

> **Open:** should `intent.add-to-list` accept a *predicate* instead of (or in addition to) explicit ids — "add all entities matching X to List Y"? That's a power-user flow that overlaps with "edit the List's source." Tracked as **OQ-LD-12**. Tentative: no, keep it concrete. Predicate-based bulk add is what setting a source does.

### Intents the Database app dispatches

| Intent                     | When                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `intent.open`               | Row / card click → open the entity in its primary opener (Notes for `Note/v1`, etc.). Cross-app nav per [37](../../shell/37-cross-app-navigation.md). |
| `intent.share`              | Right-click → Share. Generic intent; the share targets handle it.                                                |
| `intent.process`            | Right-click → AI actions (summarize, tag, …). Routes to the AI broker per [22](../../platform/22-ai-foundations.md). v2-aligned. |
| `intent.export`             | Right-click → Export single entity (the generic, not the list export).                                          |

## Openers the Database app registers

The Database app registers as a **primary opener** for `brainstorm/List/v1` and `brainstorm/ListView/v1`. It also registers as a **non-primary opener** for `brainstorm/PropertySchema/v1` (so users can browse "all entities using this property" — a degenerate List `byFilter { $exists: { <propName>: true } }`).

```jsonc
// apps/database/manifest.json#openers (sketch)
{
  "openers": [
    { "type": "brainstorm/List/v1",        "primary": true,  "verb": "open" },
    { "type": "brainstorm/ListView/v1",    "primary": true,  "verb": "open" },
    { "type": "brainstorm/PropertySchema/v1", "primary": false, "verb": "open", "label": "Browse entities" }
  ]
}
```

## Capability surface

The Database app's manifest declares:

```jsonc
"capabilities": [
  { "id": "entities.read",  "scope": ["brainstorm/List/v1", "brainstorm/ListView/v1", "*"] },
  { "id": "entities.write", "scope": ["brainstorm/List/v1", "brainstorm/ListView/v1"] },
  { "id": "entities.write", "scope": ["*"], "reason": "Update properties of member entities (e.g. drag a card to a new board column updates the entity's grouped property)." },
  { "id": "intents.dispatch", "scope": ["open", "share", "process", "export", "add-to-list", "remove-from-list", "export-list"] },
  { "id": "intents.handle",   "scope": ["open", "create", "add-to-list", "remove-from-list", "export-list"] },
  { "id": "ui.window",        "scope": ["primary", "secondary"] },
  { "id": "blocks.provide",   "scope": ["brainstorm.database/embedded-list/v1"] }
]
```

The `entities.write * (any type)` capability is **the** sensitive one — it's how board / calendar / timeline drag-to-column updates work. The capability prompt at install time spells this out: *"Database app needs to edit member entities of any type so you can drag-update their properties in views."*

> **Decision:** the `entities.write` capability is requested for *all* types, with a clear reason at install time. Without it, drag-update doesn't work; we don't ship a half-broken UX. Users wanting tighter control can revoke per-type via the grants panel (per [security/09-security-and-sandbox.md](../../security/09-security-and-sandbox.md)) and accept that drag-update is then read-only for that type.

> **Open:** could we route drag-update through an explicit `intent.update-property` instead of direct `entities.write`, surfacing one prompt per drag rather than a blanket write grant? Better security, much more friction. Tracked as **OQ-LD-13**. Tentative: keep the blanket write with the install-time reason — the friction would be unbearable. Revisit if user feedback differs.

## Summary

- One BP block (`embedded-list`) lets Notes embed a List inline. The block is read-mostly; standalone Database window owns edits to source / members.
- The Database app handles `intent.open` for List + ListView, plus three new list-aware intents (`add-to-list`, `remove-from-list`, `export-list`).
- It dispatches `intent.open` on row click (cross-app nav to the entity's primary opener) and the standard share / process / export verbs.
- It registers as the primary opener for `List/v1` and `ListView/v1`; non-primary for `PropertySchema/v1`.
- Capability surface includes broad `entities.write` — declared at install time with a plain-language reason, revocable per-type.
