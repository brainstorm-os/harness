**Critical block types we're missing**

  **Inline marks / typeahead gaps**

  - [ ] **Inline emoji marks** with :shortcode: typeahead or Cmd+E invocation that inserts at caret. Today we have an icon-picker for entity icons, not inline emoji.
  - [ ] **Date mentions** — @today, @tomorrow, @2026-06-01 chips that resolve to typed date refs.
  - [ ] **Member / contact mentions** — separate kind from object mentions (waits on Contacts app, 9.23).
  - [ ] **Inline object transclusion mark** — a `MarkType.Object`-style inline mark would show a card preview _inside_ a text run; we only have block-level TransclusionNode.
  - [ ] **Suggestion / track-changes mark** — MarkType.Change proposes edits without writing. We have no suggestion mode.
  - [ ] **Unicode shortcuts on type** — -> → →, => → ⇒, != → ≠, >= → ≥, -- → —, ... → …, (tm) → ™ etc. Not in our markdown transformers.
  - [ ] **Toggle-header markdown shortcuts** — #>  / ##>  / ###>  collapse-heading. Today we hit Toggle via slash menu only.

  **Editor chrome gaps**

  - [ ] **Inline toolbar additions** — mention, emoji, LaTeX, "remove formatting", overflow …. Today we ship B/I/U/S/code + link + color only.

  **Tables (we have @lexical/table but it's thin)**

  - [ ] **Column resize** via drag.
  - [ ] **Column reorder** via drag.
  - [ ] **Sort by column** (header click).
  - [ ] **Type-specific cells** (date picker, select dropdown, checkbox, number) — today every cell is plain rich text.
  - [ ] **Fill down** (Cmd+Shift+D).
  - [ ] **Header row toggle** with styled background.

  **Code blocks**

  - [ ] **Syntax highlighting** — Prism with 100+ langs is the standard reference; we explicitly disabled it. Shiki integration is on the post-v1 follow-up list.
  - [ ] **Language picker** dropdown.
  - [ ] **Copy button** on code block.
  - [ ] **Word-wrap toggle**.
  - [ ] **Line numbers** option.

  **Toggle / collapsible**

  - [ ] **Persisted expanded/collapsed state** across reload (today it resets — flagged in our own audit).
  - [ ] **Toggle list items** — ▶ marker on a list row that collapses its sub-tree. We have ToggleNode for paragraph/heading variants only.

  **Keyboard shortcut chord gaps (we have a registry; coverage is the issue)**  

  - [ ] Cmd+E — emoji picker invocation.

  - [ ] Cmd+Shift+M — mention picker chord (in addition to @).

  - [ ] Cmd+Shift+S — strikethrough.

  - [ ] Cmd+L — code mark on selection (we expose code via toolbar only).

  - [ ] Cmd+Shift+C — text color picker.

  - [ ] Cmd+Shift+H — background color picker.

  - [ ] Cmd+Alt+0…9 — turn-into quick chords for the 10 most-used block styles.

  - [ ] Cmd+P — print.

  - [ ] Ctrl+Shift+L — page lock toggle.

  

  **Bulk / multi-block ops**

  - [ ] **Tab / Shift+Tab on multi-block selection** for bulk indent/outdent (we only handle single-block indent).

  - [ ] **Bulk turn-into** triggered by quick chord (see above).

  - [ ] **Bulk apply mark** on multi-block selection — partially works; verify color/background/strike paths.

  

  **Drag and drop**

  

  - [ ] **Drag entity from sidebar / search → insert link or transclusion block** at drop point. We accept OS-file drops; we don't accept entity drops from shell surfaces.

  

  **Collaboration (Stage 10 just landed — pieces are now possible)**

  

  - [ ] **Remote cursors** painted from Yjs awareness (channel exists in react-yjs, no renderer mounted in Notes).

  - [ ] **Selection sharing** (range highlight per peer).

  - [ ] **Comments thread** anchored to a text range or block id.

  - [ ] **Suggestion mode** (see marks above).

  

  **Templates / starter blocks**

  

  - [ ] **Object templates** — create-new flow lets the user pick a template. Planned Stage 12+.

  - [ ] **Reusable block snippets** — "save selection as template" then insert from slash menu.

  

  **Lock / read-only**

  

  - [ ] **Per-block lock** (fields.isLocked style) — read-only on a single block while the doc is otherwise editable.

  - [ ] **Page-level lock toggle** with Ctrl+Shift+L. We have editable: false at editor level but no UI affordance.

  

  **Export**

  

  - [ ] **Markdown export** — UI button, file-save dialog. We have @lexical/markdown round-trip and @brainstorm/sdk/export-file, just not wired.

  - [ ] **PDF export** (via Cmd+P → Save-as-PDF, with a print stylesheet).

  - [ ] **HTML export** standalone file (we serialize internally for clipboard, not for download).

  - [ ] **Print stylesheet** — light theme override, page breaks, header/footer.

  

  **Block-link / anchor**

  

  - [ ] **Copy link to block** — reference editors generate a URL with the block id; opening it scrolls the doc to that block. Our entity URI scheme stops at the doc level (brainstorm://entity/<id>), no

  block-anchor.

  

  **Emoji picker polish**

  

  - [ ] **Skin-tone modifier** for humanoid emojis.

  - [ ] **Custom emoji upload** (user-supplied PNG/SVG as a reusable emoji).

  

  **Find / replace polish**

  

  - [ ] **Case-sensitive toggle** in FindBar (verify; not visible in the SDK API survey).

  - [ ] **Whole-word toggle**.

  - [ ] **Match counter "n of m"** display.