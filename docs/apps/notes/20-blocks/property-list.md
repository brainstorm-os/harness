# Property block / Property list block

The most architecturally important block. Two visible block-types share one implementation:

- **`property` (single)** — exactly one property rendered inline. Used when you want "Author: Roman" stamped into a note's flow.
- **`property-list`** — N properties stacked in a card. Used for the property panel near the top of a note.

Both render through the same `<Property>` component; `property-list` is `<Property>` × N inside a card chrome with an "Add property" button.

## Three concepts

| Concept | Where it lives | Owns |
|---|---|---|
| **Property type** (schema) | `propertyStore` — `storage.kv` key `property:<key>`, **vault-scoped** | name, icon, kind, options, cardinality |
| **Property value** | `valueStore` — `storage.kv` key `note:<id>` (the StoredNote's `values` field), **per-note** | bound value(s) |
| **Property view** | per-block config in the Lexical node | how the value renders |

This separation follows the conventional schema/value split, but with a key extension: per-block **view** that prior tools lack inline.

## PropertyDef

```ts
export enum PropertyKind {
  Text       = "text",
  Number     = "number",
  Date       = "date",
  Boolean    = "boolean",
  Select     = "select",        // single-value, drawn from a dictionary
  MultiSelect = "multi-select", // many-values, drawn from a dictionary
  File       = "file",          // 0..N file refs (image / video / audio / doc)
  Link       = "link",          // 0..N entity refs (in-vault)
  Url        = "url",
  Email      = "email",
  Phone      = "phone",
}

export type PropertyDef = {
  key: string;             // immutable id, e.g. "prop_2026_05_12_xyz"
  name: string;            // display name; editable
  icon: Icon | null;       // see foundations/39-universal-icons.md
  kind: PropertyKind;      // immutable post-creation
  description?: string;
  // kind-specific options
  options?:
    | { kind: PropertyKind.Number; format?: "integer" | "decimal" | "percent" | "currency"; min?: number; max?: number }
    | { kind: PropertyKind.Date; includeTime?: boolean }
    | { kind: PropertyKind.Select; dictionaryId: string }
    | { kind: PropertyKind.MultiSelect; dictionaryId: string }
    | { kind: PropertyKind.File; accept?: string[]; maxCount?: number }
    | { kind: PropertyKind.Link; entityType?: string; multi?: boolean };
};
```

Why `kind` is immutable: changing kind would invalidate every existing value across the vault. Renaming, re-icon-ing, re-describing are all free.

## PropertyValue

Stored on the note under `values[propertyKey]`. Shape depends on kind:

| Kind | Stored value |
|---|---|
| Text / Url / Email / Phone | `string \| null` |
| Number | `number \| null` |
| Date | `{ at: number, includeTime: boolean } \| null` |
| Boolean | `boolean` |
| Select | `string \| null` (dictionary item id) |
| MultiSelect | `string[]` (dictionary item ids) |
| File | `string[]` (file hashes; metadata in `mediaStore`) |
| Link | `string[]` (entity ids; will be `EntityRef[]` post-Stage 9) |

`null` is the canonical "empty" — never `undefined`.

## Views

Each property *block* picks a `PropertyView` for how to render the value. Not all views apply to all kinds.

```ts
export enum PropertyView {
  Pill          = "pill",          // inline rounded chip; default for most kinds
  Plain         = "plain",         // unstyled text — for inline flow
  Card          = "card",          // larger card; default for Link
  Tag           = "tag",           // coloured chip with icon — Select / MultiSelect default
  TagList       = "tag-list",      // wrapped row of Tags — MultiSelect default
  Checkbox      = "checkbox",      // Boolean default
  Toggle        = "toggle",        // Boolean alternative
  ProgressBar   = "progress-bar",  // Number with min/max
  Gallery       = "gallery",       // File grid — Brainstorm extension
  FileList      = "file-list",     // File rows with name + size
  ImageRow      = "image-row",     // File first-image expanded, rest as thumbs
  LinkInline    = "link-inline",   // Link as bare name
  LinkCard      = "link-card",     // Link as icon + name + snippet
}
```

Allowed views per kind:

| Kind | Default view | Allowed views |
|---|---|---|
| Text / Url / Email / Phone | `Pill` | `Pill`, `Plain` |
| Number | `Pill` | `Pill`, `Plain`, `ProgressBar` (when min+max set) |
| Date | `Pill` | `Pill`, `Plain` |
| Boolean | `Checkbox` | `Checkbox`, `Toggle` |
| Select | `Tag` | `Tag`, `Pill`, `Plain` |
| MultiSelect | `TagList` | `TagList`, `Plain` |
| File | `FileList` | `FileList`, `Gallery`, `ImageRow` |
| Link | `LinkCard` | `LinkCard`, `LinkInline` |

The user picks the view in a small "View as…" submenu inside the property block's gutter menu. Default is per-kind.

## Block state (Lexical node)

```ts
class PropertyBlockNode extends DecoratorNode<JSX.Element> {
  __blockId: string;
  __propertyKey: string;        // ref into propertyStore
  __view?: PropertyView;        // null → use default for kind
  __collapsed?: boolean;        // PropertyList only — group-level
}

class PropertyListBlockNode extends DecoratorNode<JSX.Element> {
  __blockId: string;
  __propertyKeys: string[];     // ordered
  __collapsed?: boolean;
  __title?: string;             // e.g. "Properties" (optional header)
}
```

Per the architecture doc: blocks hold only ref state. Values come from `valueStore[propertyKey]`, schema from `propertyStore[propertyKey]`.

## Components

```
apps/notes/src/editor/components/property/
  Property.tsx            // single property — picks Cell from kind + view
  PropertyList.tsx        // header + N <Property> + "Add property" button
  AddPropertyMenu.tsx     // search existing + "Create new property"
  PropertyGutterMenu.tsx  // per-row: "View as…", "Hide on this note", "Remove from list"
  cells/
    index.ts              // const CELL_REGISTRY: Map<`${PropertyKind}::${PropertyView}`, Component>
    PillCell.tsx
    PlainCell.tsx
    TagCell.tsx
    TagListCell.tsx
    CheckboxCell.tsx
    ToggleCell.tsx
    ProgressBarCell.tsx
    GalleryCell.tsx       // File grid — see media.md for upload integration
    FileListCell.tsx
    ImageRowCell.tsx
    LinkInlineCell.tsx
    LinkCardCell.tsx
```

Cell component contract (always the same prop shape):

```tsx
type CellProps<V = unknown> = {
  property: PropertyDef;
  value: V;
  onChange: (next: V) => void;
  readOnly?: boolean;
  noteId: string;            // for refs that need context (e.g. file URLs)
};
```

Same component is reusable in:
- `PropertyBlock` (inline editor)
- Eventual table / database app's grid cells
- Eventual entity sidebar inspector

This is the recon's §E lesson — one cell per `(kind, view)` combination, registered in one map, reused everywhere.

## Add / pick a property

From an empty `PropertyList`, the "+" button opens `<AddPropertyMenu>`:

1. Search input.
2. Existing-property suggestions (filter `propertyStore` by name).
3. "**+ Create new property**" entry → opens [property-constructor.md](property-constructor.md) modal.

Clicking an existing property adds it to the list (`__propertyKeys`) and focuses its cell. Clicking "Create new" defines and adds in one shot.

## Editing the value

Each cell handles its own interactions. Text/number/date open a small popover; checkbox toggles in place; select/multi-select open a menu (the dictionary-editor's read-only viewer, with a "Manage values" footer that routes to the dictionary editor); file opens a file-picker (uses `storage.upload` capability, when it lands) or a drop zone.

## Read-only / locked notes

`readOnly: true` flows from a note-level lock (a separate property `meta:locked: boolean`). Cells render but disable input. The same flag suppresses the gutter menu's destructive items.

## Validation

Cells validate on commit:
- Number: parse, clamp to `min/max`, format.
- Url / Email / Phone: shape check, surface inline error if invalid (Pill cell shows a red border + tooltip).
- Date: parse natural-language input ("tomorrow", "next monday") via a small parser. (Future: replace with chrono-node-like dep once allowed.)

## Multi-block selection

PropertyBlock + PropertyListBlock are first-class blocks for [selection](../30-selection.md) (cmd-click, rectangle drag, copy/paste). Clipboard serializer is `application/x-brainstorm-property-block` carrying `{ propertyKey, view, value? }` — paste into another note re-binds to the same `propertyStore[key]` if it exists, and prompts to create-or-skip otherwise.

## Renaming / icon-changing

Editing the property's name or icon flows through `<PropertyConstructor>` (see [property-constructor.md](property-constructor.md)) and propagates to every consumer via the `propertyStore` subscription.

## Deletion

Deleting a property from a note's `PropertyList` only removes its `propertyKey` from `__propertyKeys` — the property type itself stays in `propertyStore`. **Deleting the type itself** (from Settings → Properties) is destructive: all bound values across the vault are nulled. Confirm dialog uses the `<Confirm>` primitive with the `Destructive` variant.

## fancy-menus migration

`AddPropertyMenu` and `PropertyGutterMenu` are anchored menus today. Both migrate to `@react-fancy-menus/core` when Stage 8 lands (task #36) — same wiring as the dashboard icon context menu.

## Tasks

- T-prop-1: Define enums + types (`PropertyKind`, `PropertyView`, `PropertyDef`, `CellProps`).
- T-prop-2: `propertyStore` + `valueStore` with `storage.kv` persistence + Y.Doc upgrade path.
- T-prop-3: Cell registry + first cells (Pill, Tag, Checkbox).
- T-prop-4: `<Property>` + `<PropertyList>` blocks.
- T-prop-5: `<AddPropertyMenu>`.
- T-prop-6: Gallery cell + File cells (depends on [media.md](media.md) infra).
- T-prop-7: Link cells (depends on link block — see [link.md](link.md)).
- T-prop-8: View switcher submenu in gutter.
- T-prop-9: Clipboard serializer + paste-rebind flow.

## Open questions

- **Property colour** — should select/multi-select tags get a colour per dictionary item, or one accent per property type? (Today's assumption: per-item colour, stored in `DictionaryItem.colour`.)
- **Numeric formatting** — i18n locale or vault-level pref? Probably vault.
- **Cross-vault property re-use** — N/A in v1, deferred.
