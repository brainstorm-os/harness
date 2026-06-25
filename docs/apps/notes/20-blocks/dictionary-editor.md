# Dictionary editor

A dictionary is the **enum vocabulary** behind a select or multi-select property. Example: a `Country` property's dictionary is the list of countries the user has defined.

Each dictionary is identified by `dictionaryId` and referenced from `PropertyDef.options.dictionaryId` (see [property-list.md](property-list.md)).

## Shape

```ts
export type DictionaryItem = {
  id: string;             // stable id, used as the value stored on notes
  label: string;          // display text
  icon: Icon | null;      // see foundations/39-universal-icons.md
  description?: string;
  colour?: string;        // optional accent — drives tag/pill background
  sortIndex: number;      // manual order
  archivedAt?: number;    // soft-delete; archived items keep history but
                          // disappear from value pickers
};

export type Dictionary = {
  id: string;             // matches PropertyDef.options.dictionaryId
  name: string;           // "Countries"
  items: DictionaryItem[];
};
```

Stored under `storage.kv` key `dictionary:<dictionaryId>` (vault-scoped, like properties).

## Surface

`<DictionaryEditor dictionaryId={…} />` is a vertically-scrolling list with:

1. **Header** — dictionary name (editable), item count.
2. **Toolbar** — Search input, Sort (Manual / A→Z / Most-used), "Add item" button.
3. **List** — one row per item:
   - drag-handle (manual sort)
   - icon (clickable — opens `<IconPicker>`)
   - label (click to rename inline)
   - usage count ("used by 14 notes")
   - row context menu (`…`): edit, duplicate, archive, delete
4. **Footer** — "Show archived (N)" toggle.

Editor is used in two places:
- **Settings → Properties → "Edit values"** on a select-kind property (the full editor — see [property-constructor.md](property-constructor.md)).
- **Inline popover** on a Select/MultiSelect cell, when the user types a new value that doesn't exist — offers "Create '<typed text>' in <Dictionary name>". Smaller surface; just the list + add-new affordance.

## Sort modes

| Mode | Behaviour |
|---|---|
| **Manual** | User-defined; `sortIndex` is authoritative. Drag-handle shown. |
| **A→Z** / **Z→A** | Sort by `label` (locale-aware). Drag-handle hidden. Switching back to Manual re-uses the last manual order. |
| **Most-used** | Sort by descending usage across all notes in the vault. Drag-handle hidden. |

Sort mode itself is **per-user**, not per-dictionary — stored in `app.settings:dictionary-sort:<dictionaryId>`. Reordering a row in Manual writes `sortIndex` back into the dictionary; reordering in A→Z first switches to Manual.

## Item lifecycle

- **Add** — appends a new item with a fresh id, blank label, focuses the label input. Default icon is `null` (renderer falls back to a tinted dot using the colour).
- **Edit** — label, icon, colour, description, all inline. Changes propagate live to every cell using that item via the `dictionaryStore` subscription.
- **Archive** — soft-delete. Item disappears from value pickers but existing values keep rendering correctly (read from the archived item). Archived items are visible behind the "Show archived" toggle and can be unarchived.
- **Delete** — hard-delete after confirm. Drops the item AND nulls every note's bound value referencing it (`Select` → `null`, `MultiSelect` → array filtered). Destructive variant of `<Confirm>`.
- **Merge** — combine two items into one. Picks a target item, optionally re-labels, and rewrites every note's value across the vault. Surfaced from the row menu as "Merge into…". Atomic operation; emits a single toast with rollback for 5s.

## Editing usage

Hover a row → shows a usage badge ("14 notes"). Click → opens a list of consumer notes (full-screen panel; one item per note, click to open). This relies on a usage index — built lazily on first query and incrementally updated when notes save.

## Bulk import / export

Surface lives in the dictionary editor's header menu:

- **Import** — paste CSV / TSV / JSON. Maps `label,icon,description` columns; user reviews the parsed rows before commit.
- **Export** — copies the dictionary as JSON to clipboard.

## Validation

- Labels are not required unique (two items can share the same display label as long as their ids differ — useful for translated copies). The UI warns on duplicates but doesn't block.
- Hex colour string format validated; invalid entries reject with inline error.
- Icon validation routed through the picker primitive (which already handles its own validation).

## Accessibility

- Each row is a `<li role="option">` if used inside a value picker; a `<li>` with action buttons otherwise.
- Drag handle has `aria-label="Reorder {label}"` and is keyboard-operable (`Space` to pick up, arrow keys to move, `Space` to drop).
- Search input bound to `useShortcut("dictionary.focus-search", …)` chord — `Cmd+F` when the editor is the focused panel.

## fancy-menus migration

The row context menu (`…`) is an anchored menu; it migrates to `@react-fancy-menus/core` alongside every other anchored menu (task #36).

## Future

- **Shared dictionaries across vaults** — when entities ship (Stage 9), dictionaries become first-class entities and can be linked / synced. Deferred.
- **Hierarchical dictionaries** — `Country → Region → City`. Useful but not v1.
- **External dictionary sources** — pull list from a URL (e.g. ISO country codes from a CDN) with periodic refresh. Future.
