# Slash commands & block actions

Three command surfaces share one underlying registry:

| Surface | Where it lives | Triggered by |
|---|---|---|
| **Slash menu** | Inline at the caret | Typing `/` at the start of a block |
| **Block action menu** | Anchored to the grip handle | Clicking the grip in the gutter |
| **Right-click menu** | Anchored at cursor | `contextmenu` on a block |

## Registry

```ts
type Command = {
  id: string;                      // "block.insert.image", "block.action.duplicate", …
  category: CommandCategory;
  label: string;                   // t() key in v1
  description?: string;
  icon: Icon;
  keywords?: string[];             // search synonyms
  shortcut?: string;               // displayed only — actual chord lives in shortcut registry
  enabled?: (ctx: Context) => boolean;
  run: (ctx: Context) => void;
};

enum CommandCategory {
  Basic         = "basic",         // text blocks
  Media         = "media",
  Embed         = "embed",         // bookmark, link
  Property      = "property",
  Action        = "action",        // duplicate, delete, move
  TurnInto      = "turn-into",     // transforms only
}

type Context = {
  editor: LexicalEditor;
  selection: BlockSelection;
  // …
};
```

All commands declared in `apps/notes/src/editor/commands.ts` as a flat array. Enums per CLAUDE.md — string-literal `SlashCommandCategory` discriminators are the anti-pattern we avoid.

## Slash menu

- Opens when the caret is at column 0 (or after a space at column 0) and the user types `/`.
- Filters by case-insensitive substring against `label + keywords`.
- Sections by `category`. Keyboard nav via `↑/↓` (within section, wraps), `Enter` activates, `Esc` closes.
- All chords routed through `useShortcut` (`slash.next`, `slash.prev`, `slash.activate`, `slash.close`). No raw `e.key` (per CLAUDE.md).

## Block action menu

Same registry filtered to `category ∈ {Action, TurnInto}`. Multi-block-aware: when `selection.size > 1`, only commands valid for the whole set are enabled. "Turn into" applies to all selected (e.g., 3 paragraphs → all become H2).

## Right-click

Same set as action menu, anchored at click position. The dashboard icon's right-click menu is the prototype (`packages/shell/src/renderer/dashboard/icon-context-menu.tsx`).

## fancy-menus migration

All three surfaces share an anchored-menu primitive in the app. When `@react-fancy-menus/core` lands (Stage 8), swap the primitive — registry stays unchanged. Task #36 tracks the same migration shell-side.

## i18n

`label` and `description` are `t()` keys. The English defaults live in `apps/notes/src/i18n/commands.ts`; the app participates in the shell's locale-pack loader when Stage 12 lands.

## Open questions

- **User-defined commands** — should apps expose extension points so users can add their own (e.g., "Insert daily-log header")? Defer; if added, becomes a separate registry append.
- **Templates** — pre-built block-tree fragments inserted as one command (e.g., "Insert meeting-notes template"). Defer until users ask.
