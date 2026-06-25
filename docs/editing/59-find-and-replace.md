# 59 — Find & replace in text (the in-document search primitive)

This doc introduces a shared, cross-app **in-document find & replace** primitive — `@brainstorm/sdk/find-replace` — that every text-capable app (Notes, Code-editor, Journal, …) reuses instead of hand-rolling. It is the **payback for the OQ-185 virtualization trade**: true editor windowing ([52-editor-virtualization.md](52-editor-virtualization.md)) deliberately gives up the browser's native Ctrl+F over offscreen content *on the condition that the editor ships its own document-scoped, model-level find*. This doc is that find — and the replace half users expect alongside it.

It builds on [07-editing-lexical.md](07-editing-lexical.md) (the Lexical+Yjs editor baseline; the *never mutate Yjs-bound state outside editor commands* invariant), [52-editor-virtualization.md](52-editor-virtualization.md) + [11 OQ-185](../reference/11-open-questions.md) (why find must operate on `EditorState`, not the DOM), [foundations/35-code-conventions.md](../foundations/35-code-conventions.md) (keyboard-via-registry, `t()`, enums-not-literals, no default exports), and the SDK-primitive shape established by `@brainstorm/sdk/nav-history` (B8) and `@brainstorm/sdk/resizable` (pure controller + React component + DOM twin + shared chords + shared i18n + one shell-injected chrome).

> **See also:** *engineering sequencing* is impl-plan §Layouts & design system — the **B9** ladder. This is **distinct from global search** ([data/18-storage-and-search.md](../data/18-storage-and-search.md), impl-plan 9.22): global search is a vault-wide FTS5 index over persisted entities; this is the *open document's live model*, no index, no IPC.

## The problem

Ctrl+F is table stakes in any text surface. Two forces make "just use the browser's find" unavailable here:

1. **Virtualization removes it.** [52](52-editor-virtualization.md) Phase 2 windows the DOM — offscreen blocks are *not in the DOM*, so native Ctrl+F and cross-block drag-selection cannot see them. OQ-185 accepted this loss **explicitly contingent** on the editor providing its own document-scoped find + model-level select-all that operate on `EditorState`, not `document.Selection`.
2. **Every text app would reinvent it.** Notes (Lexical), Code-editor (CodeMirror), Journal (plain DOM) each have a different text model. Without a shared primitive each grows its own find bar, its own chords, its own match-count UX, its own replace edge-cases — the exact copy-paste the project's DRY rule rejects (the nav-history precedent: Files was *refactored off* its bespoke `nav-stack.ts` onto the shared primitive).

> **Decision:** find & replace is **one SDK primitive, adopted, never hand-rolled** — same shape as `@brainstorm/sdk/nav-history`. A *generic controller* owns query/match/cursor state; a thin per-app **`TextSearchProvider`** adapter bridges it to that app's text model; one shell-injected `<FindBar>` chrome is identical in every app (apps declare zero styling). One find bar, one set of chords, one mental model, everywhere.

## Architecture

> **Decision (consistent interface — user directive 2026-05-19, resolves OQ-FR-2):** the find/replace **interface is identical in every text-capable app** — same bar, same layout, same chords, same match-counter wording, same option toggles, same a11y semantics — *regardless of the underlying text engine*. **No app exposes a native or bespoke find panel.** Code-editor does **not** surface CodeMirror's built-in search UI; it wraps `@codemirror/search` strictly as the matching/replace *engine* behind the shared `<FindBar>` and the shared controller. The `TextSearchProvider` seam exists precisely so the engine can differ (Lexical / CodeMirror / DOM) while the user-facing interface never does. A user who learns find in Notes already knows it in Code-editor and Journal.

### `TextSearchProvider` — the per-app seam

The controller is model-agnostic. Each text-capable app implements one small adapter:

```
interface TextSearchProvider {
  search(query: FindQuery): Match[];          // over the MODEL, not the DOM
  revealMatch(m: Match): void;                // scroll block into the window, then set model selection
  replaceMatch(m: Match, replacement: string): void;
  replaceAll(query: FindQuery, replacement: string): number;  // ONE transaction
  readonly selectionRange: ModelRange | null; // for "in selection" scope
}
```

`Match` is an **opaque, model-addressed handle** (e.g. Lexical `{nodeKey, offset, length}` / CodeMirror `{from,to}` / Journal `{entryId, charRange}`) — never a DOM range. `FindQuery` carries the term plus `FindOptions`.

> **Decision (load-bearing, from OQ-185):** matches are computed over the **`EditorState` / document model**, and `revealMatch` **scrolls the match's block into the virtualization window *then* sets the editor's model selection** — the exact recipe OQ-185 requires. Find never reads the DOM, so it is correct whether or not the match's block is currently rendered. This is *why* find is a model primitive and not a DOM helper; it is the literal precondition for [52](52-editor-virtualization.md) Phase 2 (find unblocks virtualization, not the reverse).

> **Decision:** replace goes through the editor's **own commands** (Lexical dispatch / CodeMirror transaction), never a raw write to Yjs-bound state — so it is collaboration-safe, rides the Yjs `UndoManager` as a normal undo step, and respects the [07](07-editing-lexical.md) invariant. **Replace All is a single transaction / single undo step**, not N edits (correctness *and* the [52](52-editor-virtualization.md) "don't thrash the model" budget).

### The generic controller

`createFindController(provider, opts)` — pure, no React, no DOM (mirrors `createNavHistory`):

- State: `{ query, options, matches, activeIndex, status }`; `subscribe(fn)`.
- API: `setTerm` / `setOptions` / `next` / `previous` / `replace` / `replaceAll` / `open` / `close`.
- **Incremental + debounced** search off the keystroke path (rAF/throttle, same discipline as [52](52-editor-virtualization.md)'s window computation) so typing a query never blocks input.
- Persists last term + options to `localStorage` (the nav-history persistence pattern), restored per surface.
- Active match is **sticky across edits**: after a replace, the cursor advances to the next match deterministically; an external (collaborative) edit re-runs search and re-anchors by nearest model offset, never by DOM.

### UI — `<FindBar>` + DOM twin

- React `<FindBar controller={...} mode="find" | "find-replace" />` is the common case; `attachFindBar(el, controller)` is the plain-DOM twin (Journal). Same as nav-history's `<NavButtons>` / `createNavButtons`.
- One **shell-injected chrome** (a docked bar, top-trailing of the text surface, slides in via `transform` per [feedback: animate transform not width]) — identical in every app; apps add zero CSS. Bottom 1px subtle border consistent with the panel-header convention is *not* used (it floats over content); it uses the shared `<Popover>`-class elevation tokens.
- Contents: term input, **match counter** (`"{current} of {total}"`, or "No results"), previous/next, a disclosure that expands the **replace row** (replacement input, Replace, Replace All), and option toggles — case-sensitive `Aa`, whole-word `“ab”`, regex `.*`, in-selection. Toggles are icon buttons with `aria-pressed` + tooltip; **no glyph-in-label** (the `iconLeft` convention).
- Every string via `t()` from day one (`editor.find.*`), shared defaults in `DEFAULT_FIND_LABELS` (the `DEFAULT_NAV_LABELS` pattern). RTL-safe.
- a11y: the bar is a labelled `role="search"`; the match counter is an `aria-live="polite"` region so a screen-reader hears "3 of 17" as the user steps matches; focus returns to the prior selection on close.

### Keyboard — via the registry, never raw `e.key`

New action ids (declared in `renderer/shortcuts/default-chords.ts` *and* mirrored in the main `shortcut-registry.ts`, consumed via `@brainstorm/sdk/shortcut` / `useShortcut`):

| id | default chord | action |
|---|---|---|
| `editor/find` | `CmdOrCtrl+F` | open the bar in find mode, focus the term input (seed from current selection) |
| `editor/find.replace` | `CmdOrCtrl+Alt+F` (mac) / `Ctrl+H` (win/linux) | open in find-replace mode |
| `editor/find.next` | `Enter` / `CmdOrCtrl+G` | next match |
| `editor/find.previous` | `Shift+Enter` / `CmdOrCtrl+Shift+G` | previous match |
| `editor/find.close` | `Escape` | close, restore selection (reuses the shared close semantics) |

All rebindable through the existing shortcut-settings surface; nothing bypasses the registry.

## Not a host capability

> **Decision:** find & replace introduces **no new IPC, no host service, no capability, no network, no broker traffic**. It operates entirely in the renderer over the already-loaded document model. The capability review for the B9 ladder is explicitly *"no new surface"* — recorded so the per-iteration security review (workflow standards) has its answer. (Contrast global search, which *is* a host service behind `search.read`.)

## "Capable apps" — adoption

A text-capable app is one with a multi-line editable text model. v1 scope:

| App | Model | Adapter | Surface |
|---|---|---|---|
| **Notes** | Lexical + Yjs | Lexical `TextSearchProvider` (walks `EditorState`, `revealMatch` = window-scroll + `$setSelection`) | primary consumer; the OQ-185 payback |
| **Code-editor** | CodeMirror 6 | wraps `@codemirror/search` as the engine only — behind the same `TextSearchProvider`, same shared `<FindBar>`; **CodeMirror's native search panel is not surfaced** (consistent-interface decision) | regex/multiline strength |
| **Journal** | plain DOM entries | DOM-twin `attachFindBar` over the entry model | tertiary; proves the non-React twin |

Apps **without** a multi-line editable text surface (Tasks/Database cells, Whiteboard canvas text, Calendar, Bookmarks, Files, Graph) are **out of v1 scope** (OQ-FR-3): "find across grid cells / sticky notes" is a *view-model* search that overlaps view-scoped global search, not document find — a separate, later concern.

## Conventions honored

Per [35-code-conventions.md](../foundations/35-code-conventions.md): SDK subpath export `@brainstorm/sdk/find-replace` (+ each consuming app's vitest alias and package dep, per the entity-icon/nav-history requirement); no default exports; `FindOptions` flags and `MatchStatus` are **enums / const-object unions, not string literals**; keyboard only via the registry; every visible string in `t()` from the first commit; new features ship with tests (per-package floors — property-tested match-finding over generated documents, Playwright assertion for the bar's keyboard path + screen-reader path).

## Open questions

To be added to [11-open-questions.md](../reference/11-open-questions.md) (`OQ-FR-*`):

- **OQ-FR-1** — Regex in v1 or v2? **Lean: v1 = substring + case-sensitive + whole-word + in-selection; regex (with `$1` replace templating) is v2** behind a toggle — regex over a CRDT rope plus capture-group replace is the expensive, edge-case-heavy part and is not needed to pay back OQ-185.
- **OQ-FR-2 — RESOLVED (Decision, user directive 2026-05-19):** **consistent interface everywhere.** Code-editor wraps `@codemirror/search` as the engine behind the shared `<FindBar>`; CodeMirror's native search panel is not surfaced. No per-app find dialect. (See the *consistent interface* Decision in §Architecture.)
- **OQ-FR-3** — Do non-document text surfaces (Database/Tasks inline cells, Whiteboard sticky text) get "find across the view"? **Lean: out of v1.** It is view-model search (closer to global search scoped to a view) and the controller's `TextSearchProvider` seam can host it later without an API change — flagged so it isn't designed twice.
- **OQ-FR-4** — Does `editor/find` seed the term from the current selection (editor-classic behaviour) unconditionally, or only when the selection is single-line/short? **Lean: seed when selection is non-empty and single-block; otherwise open empty.** Non-blocking polish.

## Phasing (the B9 ladder)

| | v1 | later |
|---|----|----|
| SDK primitive: pure `createFindController` + `TextSearchProvider` + React `<FindBar>` + DOM twin + chords + `DEFAULT_FIND_LABELS` + Notes Lexical adapter (find only, model-level — the **OQ-185 payback**) — **B9.1** | ✓ | — |
| Replace + Replace-All (single-transaction, Yjs-undoable) + options (case/word/in-selection) in Notes — **B9.2** | ✓ | — |
| Adoption: Code-editor (CM wrapped behind shared bar — consistent-interface decision) + Journal (DOM twin) — **B9.3** | ✓ | — |
| Regex + capture-group replace (OQ-FR-1) | — | ✓ |
| View-model find for grid/canvas surfaces (OQ-FR-3) | — | ✓ |

> **Sequencing note:** B9.1 is a **precondition for [52](52-editor-virtualization.md) Phase 2** (impl-plan 13.4a) — virtualization may not remove native find until the model find exists. B9.1 does not itself depend on virtualization and ships against the editor as it is today (9.2).

## Summary

- One SDK primitive — `@brainstorm/sdk/find-replace` — adopted by every text-capable app, **never hand-rolled** (the nav-history shape: pure controller + `TextSearchProvider` adapter + React `<FindBar>` + DOM twin + shared chords + shared i18n + one shell chrome).
- Find operates on the **`EditorState`/model, never the DOM**, and `revealMatch` scrolls-into-window-then-selects — this is the explicit **payback for the OQ-185 virtualization trade** and the precondition for [52](52-editor-virtualization.md) Phase 2.
- Replace goes through editor commands; **Replace All is one transaction / one undo step** — collaboration-safe, honoring the [07](07-editing-lexical.md) Yjs invariant.
- **No new capability, IPC, network, or host surface** — purely in-renderer; distinct from the vault-wide global-search service (9.22 / [18](../data/18-storage-and-search.md)).
- v1 capable apps: Notes (primary), Code-editor (CM wrapped), Journal (DOM twin). Grid/canvas "find" and regex are deliberately later.
