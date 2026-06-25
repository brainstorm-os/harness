# Keyboard cheat sheet

Every chord declared via the shell's shortcut registry (`useShortcut`). No raw `e.key` listeners (recon §H.7).

Action IDs follow the pattern `notes/<scope>.<verb>`. Chord defaults below; user-rebindable post-Stage 12.

## Global (anywhere in the editor)

| Chord | Action ID | Effect |
|---|---|---|
| `/` at line start | (built-in trigger) | Open slash menu |
| `Cmd+Z` / `Cmd+Shift+Z` | `notes/edit.undo`, `notes/edit.redo` | Undo / redo |
| `Cmd+B` / `Cmd+I` / `Cmd+U` | `notes/format.bold/italic/underline` | Inline formatting |
| `Cmd+Shift+S` | `notes/format.strike` | Strikethrough |
| `Cmd+E` | `notes/format.code` | Inline code |
| `Cmd+K` | `notes/format.link` | Add / edit inline link |
| `Cmd+Shift+M` | `notes/format.mention` | Open mention suggest |
| `Cmd+/` | `notes/help.shortcuts` | Open shortcut cheat-sheet panel |

## Selection (no caret OR block-selected)

| Chord | Action ID | Effect |
|---|---|---|
| `Esc` | `notes/selection.exit` | Inline → block-select containing; block → clear |
| `Cmd+A` | `notes/selection.all` | Block → all blocks; pressed again → entire root |
| `Shift+Arrow Up/Down` | `notes/selection.extend-up/down` | Extend block selection |
| `Cmd+C` / `Cmd+X` / `Cmd+V` | `notes/clipboard.copy/cut/paste` | Block-aware copy/cut; paste prefers `application/x-brainstorm-blocks` |
| `Cmd+D` | `notes/blocks.duplicate` | Duplicate selected block(s) below |
| `Cmd+Shift+Up/Down` | `notes/blocks.move-up/down` | Move selected block(s) |
| `Backspace` / `Delete` | (built-in) | Delete selected block(s) |

## In-block

| Chord | Effect |
|---|---|
| `Enter` | New paragraph (containers may override: heading → paragraph; list-item → next list-item; callout → child paragraph) |
| `Shift+Enter` | Soft line-break (no new block) |
| `Tab` / `Shift+Tab` | Indent / outdent (list-items only) |
| `Cmd+Enter` | Toggle todo (in todo-list); exit table (in table cell) |
| `Backspace` at block start | Merge with previous block; in heading/list → turn into paragraph |

## Turn-into shortcuts

Markdown shortcuts auto-transform; explicit chords below for muscle-memory users:

| Chord | Action ID | Target |
|---|---|---|
| `Cmd+Alt+0` | `notes/turn-into.paragraph` | Paragraph |
| `Cmd+Alt+1`/`2`/`3` | `notes/turn-into.h1/h2/h3` | Heading |
| `Cmd+Shift+8` | `notes/turn-into.bullet` | Bullet list |
| `Cmd+Shift+7` | `notes/turn-into.numbered` | Numbered list |
| `Cmd+Shift+9` | `notes/turn-into.todo` | Todo list |
| `Cmd+Shift+.` | `notes/turn-into.quote` | Quote |
| `Cmd+Alt+C` | `notes/turn-into.code` | Code |

## Notes-app-specific

| Chord | Action ID | Effect |
|---|---|---|
| `Cmd+N` | `notes/note.new` | New note |
| `Cmd+Shift+I` | `notes/note.inspector` | Open inspector for focused media (or property cell) |
| `Cmd+F` | `notes/note.find` | In-note find |
| `Cmd+Shift+F` | `notes/note.find-replace` | Find + replace |

## How to register

```ts
// apps/notes/src/editor/shortcuts.ts
useShortcut("notes/format.bold", () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"));
```

Defaults live alongside the action IDs in a single source-of-truth table. User overrides flow through Stage 12's settings UI.

## Cheat-sheet panel

`Cmd+/` opens a panel listing every action and its chord. Source of truth is the registry; the panel just iterates and renders.
