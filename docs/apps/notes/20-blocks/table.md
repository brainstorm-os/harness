# Simple table block

A table with cells inside the Lexical tree — **not** the pattern of a `DecoratorNode` shell with cells stored side-channel, which we consider the wrong path.

Backed by `@lexical/table`'s `TableNode` / `TableRowNode` / `TableCellNode`. Selection, clipboard, undo/redo all round-trip naturally.

## Insertion

Slash command `/table` → opens a small grid picker (rows × columns, max 10×10 in v1). Inserts a `TableNode` with N rows × M cols of empty paragraph-containing cells.

Or via Markdown shortcut: type a row of `| col1 | col2 |` at the start of a line.

## State

Cells are tree-resident:

```
TableNode
  ├─ TableRowNode (header)
  │   ├─ TableCellNode (header=true, bgColor?)
  │   └─ TableCellNode (header=true)
  └─ TableRowNode
      ├─ TableCellNode → contains ParagraphNodes / lists / inline content
      └─ TableCellNode
```

Each `TableCellNode` carries: `headerState` (`row` | `column` | `both` | `no-status`), `colSpan`, `rowSpan`, `width`, `backgroundColor`. v1 enforces `colSpan=1, rowSpan=1` (no merged cells — defer).

## Interactions

- Click a cell → caret inside its inner paragraph; type rich text.
- `Tab` / `Shift-Tab` → next / previous cell.
- `Enter` → newline in the cell (a new paragraph child).
- `Cmd+Enter` → exit the table, paragraph after.
- Row/column resize: drag the border. Width is per-cell-on-the-first-row (column-level).
- Per-row / per-column gutter handles appear on hover; click opens a small action menu:
  - **Row** — insert above / below, delete, duplicate, toggle header row.
  - **Column** — insert left / right, delete, duplicate, toggle header column, align (left / center / right).

Action menus migrate to `@react-fancy-menus/core` (task #36).

## Selection

- **Cell range** — drag from one cell to another → rectangular selection (Lexical's `TableSelection`). Standard.
- **Whole table** — click the gutter outside any cell, or `Cmd+A` thrice (text → cell → row → table). Selected table participates in [block selection](../30-selection.md) — can be copied as a block, dragged, deleted with one keypress.

## Clipboard

- Copy a cell range: `text/plain` (TSV), `text/html` (`<table>`), `application/x-brainstorm-blocks` (a sub-table). Pastes into other table apps fine.
- Copy the table-as-block: full table in all three formats.
- Paste a TSV string into a cell → if the paste source is `text/plain` and contains tabs/newlines, expands into a sub-rectangle starting from the focus cell.

## Theme

Cell border, header background, alternating row backgrounds all driven by CSS custom properties. v1 ships one preset; theming is unfinished until design tokens are exposed (Stage 13).

## What we don't support in v1

- Merged cells (`colSpan` / `rowSpan` > 1).
- Per-cell formulas / computed cells. Properties cover that need.
- Per-column data-type validation (a column of dates, etc.). Use a Property block instead.
- Sortable columns. Use the Database app when it ships.

## Open questions

- **Max size** — limit to 100×20 (rows × columns) for performance? Beyond that the user should reach for the Database app.
- **Default header row** — yes by default (matches user expectation, easy to disable).
