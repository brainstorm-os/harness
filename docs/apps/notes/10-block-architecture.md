# Notes — block architecture

Lexical-based block editor. The architectural backbone follows the conventional block-protocol-editor shape, with deliberate corrections for patterns we identified as fragile.

## The shape of a block

Every custom block is a Lexical `DecoratorNode` whose internal state is **only** stable references:

```ts
class FooBlockNode extends DecoratorNode<JSX.Element> {
  __blockId: string;          // stable id across saves
  __ref?: string;              // optional pointer into a side store (entity id, file hash, etc.)
  // NO content fields — content lives in stores keyed by __blockId / __ref.
}
```

Why so thin: the Lexical tree owns *position* and *type*, nothing else. Heavy state — schema, file bytes, fetched OG tags, property values — lives in dedicated stores. The decorator component subscribes to the store and renders.

Three exceptions stay as `ElementNode` (children inside the Lexical tree) because their content participates in text selection / typing flow:
- Paragraph, headings, lists, quote, callout, toggle, code.
- Table cells (we use Lexical's built-in `TableNode` / `TableRowNode` / `TableCellNode`, rather than the side-channel-mirror approach some prior editors take).

## Store layout

```
NotesEditorState (per open Note, in-memory)
 ├─ BlockTree         <Y.XmlFragment | LexicalEditorState>   ← positions + types
 ├─ propertyStore     Map<propertyKey, PropertyDef>          ← schema
 ├─ valueStore        Map<propertyKey, unknown>              ← bound values for THIS note
 ├─ dictionaryStore   Map<dictionaryId, DictionaryItem[]>    ← enum vocabularies
 └─ mediaStore        Map<fileHash, MediaRecord>             ← upload meta (alt, caption, dims, …)
```

`propertyStore` and `dictionaryStore` are **vault-scoped** (used by every Note in the vault — see [property-list.md](20-blocks/property-list.md) §schema vs. value).

## Persistence — v1 (today)

One `note:<noteId>` key in `storage.kv`:

```ts
type StoredNote = {
  id: string;
  title: string;
  body: LexicalSerializedState;
  values: Record<string, unknown>;     // ← per-note property values for this note
  createdAt: number;
  updatedAt: number;
};
```

`propertyStore` and `dictionaryStore` are stored separately under `properties:<key>` and `dictionaries:<id>` so they're shared across notes.

Each block gets a stable `id` in the serialized form so [Stage 9](../../implementation-plan.md) can migrate to one entity per block without breaking links.

## Persistence — Stage 9+ (entities)

When the entities service lands, the `StoredNote.body` becomes a graph of `block` entities linked to the parent `note` entity. Lexical's serializer round-trips through that graph. `propertyStore` becomes the entity-type registry; values become entity fields. **The block component code does not change** — we swap the bridge layer, not the components.

## Rendering pattern

```tsx
function PropertyBlock({ rootId, blockId, propertyKey }: Props) {
  const property = useProperty(propertyKey);   // subscribes to propertyStore
  const value = useValue(rootId, propertyKey); // subscribes to valueStore
  const Cell = useCellComponent(property.kind);
  return <Cell property={property} value={value} onChange={…} />;
}
```

Cell registry: `Map<PropertyKind, ComponentType<CellProps>>` in `apps/notes/src/editor/cells/index.ts`. Same component is reused everywhere a property value appears (in-block, in dataview cell, in inspector). See [property-list.md](20-blocks/property-list.md).

## Plugin tree

A conventional Lexical plugin tree, with corrections:

| Plugin | Notes |
|---|---|
| `RichTextPlugin` | Lexical built-in. |
| `ListPlugin` / `CheckListPlugin` / `TablePlugin` | built-ins. **Tables use these**, not a custom mirror. |
| `HistoryPlugin` | undo/redo. |
| `MarkdownShortcutsPlugin` | `#`, `>`, etc. |
| `KeyboardShortcutsPlugin` | declares via the shortcut registry (`useShortcut`), not raw `e.key`. |
| `FloatingToolbarPlugin` | bold/italic/link on text selection. |
| `LinkEditingPlugin` / `AutoLinkPlugin` | inline `<a>` links — separate from our LinkBlock. |
| `BlockSelectionPlugin` | multi-block selection, see [30-selection.md](30-selection.md). |
| `BlockBehaviorPlugin` | Enter / Backspace at start of heading / list / callout exits. |
| `TurnIntoPlugin` | listens for `TURN_INTO_COMMAND`. Payload type is a TS **enum**, not a string-literal union. |
| `SlashCommandPlugin` | see [31-commands.md](31-commands.md). |
| `BlockActionMenuPlugin` | gutter + right-click. Will swap to `@react-fancy-menus/core` (task #36). |
| `DragHandlePlugin` | "+" / grip + target-line. Rect cache via `IntersectionObserver`. |
| `DragDropPastePlugin` | file paste/drop → upload. |
| `EmojiShortcodePlugin` | `:smile:` → 😄. |
| `MentionPlugin` | `@` → entity / property suggest. |
| `BlockLoaderPlugin` | hydrate Lexical from `storage.kv` on mount. |
| `AutosavePlugin` | debounced `storage.put`, identical to today's Notes-app autosave. |

## Decorator → React bridge

Decorator nodes render through a single `<EditorContext.Provider rootId={…}>` wrapping `<LexicalComposer>` so decorators get `rootId` via `useContext(EditorContext)`, not via `data-root-id` DOM-scraping.

## Enums everywhere

Per CLAUDE.md: every block / property / view / kind / category is a TS string enum. No `case "callout":` literals anywhere. Conversion helpers live in one place:

```ts
export enum BlockType { Paragraph = "paragraph", … }
export enum PropertyKind { Text = "text", Number = "number", … }
export enum PropertyView { Pill = "pill", Tag = "tag", Gallery = "gallery", … }
export enum SlashCategory { Basic = "basic", Media = "media", … }
```

## Theming

Lexical `EditorThemeClasses` maps to a flat set of class names (`notes__block--paragraph`, `notes__block--h1`, …). Notes ships its own theme today; once design tokens are exposed via app preload (Stage 13), the theme becomes a thin shim that maps class names to token-defined CSS custom properties.

## Anti-patterns we explicitly avoid

(Quick reference.)

1. Decorator-node tables storing zero structure in Lexical. Use Lexical's built-ins.
2. String-literal discriminators. Enums.
3. Module-level mutable singletons (`dragOverlay`). Instance refs.
4. O(n) mousemove block-rect calculation. IntersectionObserver + cache.
5. `data-root-id` DOM querying for context. React context.
6. Bypassing the shortcut registry with `document.addEventListener("keydown", …)`. `useShortcut`.
7. Three separate `formatLabel(kind)` switch statements. One i18n table.
8. No clipboard wire format for decorator blocks. Each decorator declares its serializer.
9. Inaccessible gutter. `aria-label`, `role`, tab order.

## Build pipeline prerequisite

The Notes app ships bundled via the per-app Vite pattern (Lexical + React require bundling). See [40-app-build.md](40-app-build.md).
