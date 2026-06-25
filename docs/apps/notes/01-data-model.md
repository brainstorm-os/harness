# Note data model

## v1 — single blob

```ts
type StoredNote = {
  id: string;                      // n_<base36>_<rand6>
  title: string;
  icon: Icon | null;               // see foundations/39-universal-icons.md
  body: SerializedLexicalState;    // tree of blocks
  values: Record<string, unknown>; // property values bound to this note
  createdAt: number;
  updatedAt: number;
};
```

Stored under `storage.kv` key `note:<id>`.

Lexical's `SerializedLexicalState` is shape-stable: `{ root: { type, children, … } }`. Each custom block declares `exportJSON()` returning the same shape. Restoring on launch is `editor.parseEditorState(saved.body)` plus the `BlockLoaderPlugin` hydrating side-stores keyed by `blockId`.

**Vault-scoped stores** (not on the note):

| Store | Key pattern | Contents |
|---|---|---|
| `propertyStore` | `property:<key>` | `PropertyDef` |
| `dictionaryStore` | `dictionary:<id>` | `Dictionary` |
| `mediaStore` | `media:<hash>` | `MediaRecord` |

Loading a note: read `note:<id>`, then lazy-read referenced `property:*` / `dictionary:*` / `media:*` keys as their consumers mount.

## Stable block ids

Every block carries `__blockId` (stable across saves). On first creation: `b_<base36-now>_<rand6>`. Survives copy-paste only when the destination is a different note (within the same note, paste rewrites ids to avoid collisions). Used as the join key for any future per-block side data (comments, version history, etc.).

## Migration to entities (Stage 9)

When the entities service lands, the storage layout swaps without changing the block-component code:

| Today | After Stage 9 |
|---|---|
| `note:<id>` → blob with body+values | `entity[type=note, id=<id>]` with `title`, `icon`, `body` (entity ref tree), `properties` (relation to property values) |
| `property:<key>` → blob | `entity[type=property-type, id=<key>]` |
| `dictionary:<id>` → blob | `entity[type=dictionary, id=<id>]` |
| Block `__blockId` → key for side-stores | Block `__blockId` → entity id; each block IS an entity |

Migrating: a one-shot importer reads `note:*` keys, creates entities, links property-values, deletes the old keys. The migration is **idempotent** so running it twice is safe.

## Stable wire format for clipboard

`application/x-brainstorm-blocks` payload:

```ts
type ClipboardPayload = {
  version: 1;
  blocks: SerializedBlock[];
  referencedProperties?: PropertyDef[];   // included so paste into a different vault works
  referencedDictionaries?: Dictionary[];
  referencedMedia?: { record: MediaRecord; bytesBase64?: string }[];
};
```

Pasting:
- Same vault → references re-bind, files dedupe by hash.
- Different vault → check each referenced property/dictionary; if absent, prompt "Add to vault?" once per kind.

## What does *not* live on the note

| | Why |
|---|---|
| Property definitions | Shared across notes — `propertyStore`. |
| Dictionary vocabularies | Shared across properties — `dictionaryStore`. |
| File bytes / media metadata | Content-addressed and dedup'd — `mediaStore` + `<vault>/data/apps/<appId>/files/<hash>`. |
| Cell-component code | App code, not state. |
| Editor view config (zoom, ruler, etc.) | Per-user UI prefs, separate `prefs:` key. |

## Indexes

Two lazy-built indexes maintained as notes save:

| Index | Key | Used by |
|---|---|---|
| `index:property-usage:<propertyKey>` | property key | "Where used" panel in property constructor; deletion confirm count. |
| `index:dictionary-usage:<itemId>` | dictionary item id | "Used by N notes" badge in dictionary editor; merge / delete impact preview. |

Both are arrays of `{ noteId, blockId, count }`. Rebuilt incrementally on save; backfilled if missing on first query.

## Editor sessions are not persisted

Cursor, scroll position, multi-block selection — kept in-memory only. Closing the window discards. Re-opening the note centres on the title.
