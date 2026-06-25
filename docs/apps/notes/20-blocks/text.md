# Text blocks

All text-family blocks share the same serialization shape — Lexical `ElementNode` with children that are `TextNode`s (or other inline nodes like links, mentions, emoji).

## Catalogue

| Block | Backed by | Slash | Markdown shortcut |
|---|---|---|---|
| Paragraph | Lexical built-in `ParagraphNode` | `/text` | (default) |
| Heading 1 | Lexical built-in `HeadingNode` (`tag: h1`) | `/h1` | `# ` |
| Heading 2 | `HeadingNode` (`h2`) | `/h2` | `## ` |
| Heading 3 | `HeadingNode` (`h3`) | `/h3` | `### ` |
| Bullet list | `@lexical/list` `ListNode` (`bullet`) | `/bullet` | `- ` |
| Numbered list | `ListNode` (`number`) | `/numbered` | `1. ` |
| Todo list | `ListNode` (`check`) | `/todo` | `[ ] ` |
| Quote | `@lexical/rich-text` `QuoteNode` | `/quote` | `> ` |
| Callout | custom `CalloutNode` | `/callout` | (none) |
| Code | `@lexical/code` `CodeNode` | `/code` | ```` ``` ```` |

## Turn-into

`TurnIntoPlugin` listens for `TURN_INTO_COMMAND` and replaces the top-level block with the target type. The payload type is the `BlockType` enum from [10-block-architecture.md](../10-block-architecture.md):

```ts
editor.dispatchCommand(TURN_INTO_COMMAND, { type: BlockType.Heading1 });
```

Turn-into preserves inline formatting (bold/italic/link) where the target supports it; lists ↔ paragraphs handle the wrap/unwrap.

## Inline formatting

Standard Lexical `TextFormatType`s: bold, italic, underline, strikethrough, code, subscript, superscript. Plus our additions:

- **Link** — inline `@lexical/link` `LinkNode`. Edit via `LinkEditingPlugin` (Cmd+K trigger).
- **Mention** — `MentionNode` from a custom `MentionPlugin`. `@` opens a suggest menu for in-vault entities; resolved mention renders as a small pill that opens the target on click. Distinct from `LinkBlock` — see [link.md](link.md).
- **Inline emoji** via `EmojiShortcodePlugin` (`:smile:` → 😄).

Floating toolbar (`FloatingToolbarPlugin`) appears above any text selection > 1 character. Buttons: bold, italic, underline, strike, code, link, color, bg. Standard Lexical pattern.

## Callout

Container `ElementNode`. State:

```ts
{
  blockId: string;
  icon: Icon | null;        // emoji default, picker available
  bgColor: ColorKey | null; // limited palette — see theme
}
```

- Enter inside callout: stays in callout, new paragraph child.
- Backspace at start: lifts the cursor out of the callout (exits the wrapper).
- Slash inside callout: scoped — same menu, target inserts INSIDE the callout.

## Code

`CodeNode` from `@lexical/code` with `CodeHighlightPlugin` (Prism). Language picker via `CodeBlockLanguagePlugin` — small dropdown anchored at top-right of the code block. Tab inside a code block inserts spaces (configurable per-vault).

## Lists

`@lexical/list` handles nesting (Tab / Shift-Tab to indent / outdent). Todo lists support keyboard toggle via `Cmd+Enter` on a list item.

## Open questions

- **Heading 4+** — Some prior tools go up to `h4`; Brainstorm likely caps at `h3` for prose hygiene. Reconsider if doc-style demands it.
- **Background colour** — palette tokens or free hex? Tokens, with a max of ~6 colours that match the theme accent.
