# 52 — Editor virtualization (large-document rendering)

This doc defines how the Brainstorm editor stays fast on very long documents. It builds on [07-editing-lexical.md](07-editing-lexical.md) (the editor framework and the always-Yjs-bound invariant) and [06-collaboration-yjs.md](06-collaboration-yjs.md) (the CRDT substrate). The performance budgets it answers to live in [13 §Performance budgets](../shell/13-frontend-stack.md) and [12 §Performance budgets](../shell/12-shell-architecture.md); the stress target that surfaces the need is [implementation-plan.md Stage 13.4](../implementation-plan.md) ("50MB Yjs doc opened").

## The problem

Lexical reconciles its entire **EditorState** node tree into the DOM. Incremental edits are cheap (the reconciler only re-touches dirty nodes), but the *resident* DOM is the whole document. For a long note — thousands of top-level blocks — the costs that break us are not the model costs:

- The Yjs doc in memory is cheap; Yjs is efficient and the Stage 13.4 stress test explicitly validates a 50 MB doc.
- The Lexical EditorState tree in memory is cheap.
- The **`contenteditable` DOM** is not. A 10k-node editable subtree means large initial mount, expensive browser style/layout recalc scoped over the whole editable, scroll jank, and IME/caret work the browser does against the full tree. This is what blows the **`<16ms` keystroke→paint** budget ([13-frontend-stack.md §Performance budgets](../shell/13-frontend-stack.md)) once documents get large.

So virtualization here is a **DOM-size problem only**. The model stays whole; the rendered surface is what must be bounded.

## Constraints that shape the design

> **Decision:** the Yjs-bound EditorState is never mutated for a view concern. Per [07 §Yjs binding](07-editing-lexical.md), "Lexical state is *always* backed by a Yjs fragment." Any scheme that swaps offscreen blocks for placeholder *nodes*, or detaches offscreen subtrees from the EditorState, writes to the CRDT — corrupting the document and breaking collaboration. Such schemes are disqualified outright. Virtualization is a **projection of an unchanged state**, never an edit to it.

> **Decision:** native browser behaviour over offscreen content is an accepted loss, paid back by our own equivalents. Offscreen blocks that are not in the DOM cannot be matched by the browser's native Ctrl+F or covered by a drag-selection that crosses them. We accept this *provided* the editor ships its own document-scoped **find** and a model-level **select-all** (both operate on the EditorState text/range, not the DOM Selection). This is the trade that makes true windowing feasible; without it the design would be forced into the heavier "everything stays in the DOM" regime permanently.

**Non-goals (v1):**

- **Intra-block virtualization.** The unit of virtualization is the **top-level block** (a direct child of the editor root: paragraph, heading, list, code block, embed). A single pathological block — a 5,000-item list, a 20k-line code block — is a separate, rarer problem; windowing *within* a block is a tracked follow-up, not v1.
- **Virtualizing read-only previews.** `EditorPreview` (the Lexical-free renderer, [07 §Reading rich text without an editor](07-editing-lexical.md)) already caps with `maxBlocks` for snippet contexts and does not instantiate Lexical; it is out of scope here.

## The design: layered, measurement-gated

Lexical has no native virtualization and no official windowing plugin. The honest engineering position is that **truly windowing a single `contenteditable` while keeping one Yjs-bound EditorState is not cleanly supported by Lexical**, and every shortcut that mutates the tree is disqualified by the invariant above. So the design is two phases, and **Phase 2 is entered only if measurement on the Stage 13.4 stress document proves Phase 1 misses the budget**.

### Phase 1 — zero-cost offscreen blocks, full DOM (low risk)

The editor renders the whole tree as today, but each top-level block is made cheap when offscreen:

1. **Stable block hooks.** A Lexical `MutationListener` / node transform stamps every root child element with a `data-bs-block` attribute (stable id) and is the single place block-level chrome hooks attach — this also satisfies the StylePack selector-contract direction in [OQ-183](../reference/11-open-questions.md), so the two surfaces share one hook contract rather than inventing parallel ones.
2. **`content-visibility: auto` + accurate `contain-intrinsic-size`.** Each top-level block gets `content-visibility: auto` so the browser skips rendering, layout, and paint of offscreen blocks while keeping their nodes in the DOM. The `contain-intrinsic-size` is driven by the **height cache** (below), *not* the browser's lazy default — so the scrollbar geometry and scroll position stay correct and stable, and native find still partly works (bonus, not relied on).
3. **Heavy decorator content unmounts when offscreen.** `BlockEmbedNode` iframes ([07 §Block embedding](07-editing-lexical.md)), code-block syntax highlighters, and images are the expensive children. The shared decorator wrapper gates them behind an `IntersectionObserver`: offscreen, the decorator renders a height-correct placeholder `<div>` and tears the iframe/highlighter/image down; on-screen, it remounts. This is the bulk of the win for embed-heavy documents and is independent of (2).

Phase 1 is near-zero-risk: no fork of Lexical, no change to the EditorState, selection and collaboration cursors keep working unchanged (DOM is present). For "long but not enormous" documents it is expected to clear the budget on its own.

### Phase 2 — true windowing (only if Phase 1 measurements miss)

Only the visible block range plus an overscan margin is reconciled into the editable DOM; offscreen runs of top-level blocks are represented by non-Lexical **spacer `<div>`s** sized from the height cache. The EditorState stays whole and Yjs-bound; only the **reconciliation target** is windowed — realized by an extended `RichTextPlugin` content component that reconciles a `[firstVisibleIndex, lastVisibleIndex]` slice of root children. This is the part the accepted native-behaviour trade unlocks.

Shared mechanics (used by both phases where relevant):

- **Height cache.** A map keyed by stable block id (so it survives reload and Yjs re-sync), recording the measured rendered height of each top-level block via a `ResizeObserver` on mounted blocks. Unmeasured blocks get a typed estimate (heading ≈ one line at heading size; paragraph ≈ line-count from text length × line height; code ≈ line count × code line height; embed ≈ declared aspect or a default box). Estimates are replaced by real measurements as blocks pass through the window; the prefix-sum of heights gives scroll geometry.
- **Window computation off the keystroke path.** A scroll listener on the editor scroll container recomputes the visible range from the height prefix-sum plus overscan, throttled to `requestAnimationFrame`. It never runs on the keystroke path — typing changes one block's height, which updates the cache locally; it does not trigger a window recompute unless the height delta crosses the viewport boundary.
- **Selection / caret survival (Phase 2).** Model selection lives in the EditorState, so it survives windowing inherently. The DOM-Selection risk is only when the selection-bearing block scrolls out of the rendered window: the window computation **pins the block holding the current selection (and its immediate neighbours) into the rendered range regardless of scroll**. Programmatic navigation (find-result jump, link/anchor jump, `RelativePosition` resolution from [31-linking-protocol.md](../platform/31-linking-protocol.md)) mounts the target block *before* setting selection.
- **Collaboration cursors (Phase 2).** Remote awareness cursors on offscreen blocks have no DOM target. They degrade to **viewport-edge indicators** ("N collaborators above / below", click to jump) rather than absolutely-positioned overlays. Phase 1 keeps them exactly as today (DOM present).

### Replacing the lost native behaviours

- **Document find.** A document-scoped find that searches the EditorState text (not the DOM), with next/previous navigation that scrolls the match's block into the window then sets Lexical selection on it. Distinct from the vault-wide global search ([Stage 9.22 / global-search](../data/18-storage-and-search.md)) — this is in-document, in-editor.
- **Select-all.** A model-level select-all that constructs a Lexical range spanning the whole EditorState, independent of which blocks are currently in the DOM. Copy/cut then serialize from the model, not the DOM Selection.

### Activation threshold

Always-on windowing has overhead (height cache, observers, scroll math) that is pure cost for short documents. The editor activates virtualization only above a **block-count / estimated-DOM-size threshold**; below it the editor renders plainly with none of the machinery engaged. The exact threshold, and whether it keys on block count vs. estimated node count vs. measured first-paint time, is an open question.

## Performance contract

This iteration ships **before/after numbers** (Workflow standard 2) measured on the Stage 13.4 stress document:

- **Existing budget held:** `<16ms` keystroke→paint ([13-frontend-stack.md §Performance budgets](../shell/13-frontend-stack.md)) on a large document, not just a small one.
- **New editor budgets (proposed, finalized with the numbers):** open a large document (≈ the 13.4 stress doc) to interactive within a stated bound; sustain 60 fps scroll through it. These land in the [13-frontend-stack.md](../shell/13-frontend-stack.md) budget table when the iteration measures them.

## Measurement infrastructure (landed at 9.3.5.N5)

The shared synthetic-document fixture + benchmark harness 13.4a's before/after pass uses lives in `@brainstorm/editor`:

- **`LARGE_DOC_PROFILES`** — three deterministic profiles spanning `dogfood` (200 blocks), `large` (1000 blocks), and `stress` (5000 blocks). The block mix is realistic Notes-shaped (paragraphs / headings every 25 / a code block / a bullet list every 25); the same shape is materialised by both the headless and the live `<BrainstormEditor>` so numbers compare across environments.
- **`seedLargeDoc(editor, profile)`** — populates a Lexical editor (headless or live) in a single discrete transaction.
- **`timeSamples(fn, n)`** — wraps `performance.now()` and returns `{min, median, max}` so a single GC spike doesn't speak for the run.
- **`packages/editor/src/keystroke-paint.bench.test.tsx`** — measures keystroke→reconcile cost on every profile, two layers:
  - **Model layer** (headless, no DOM): proves the Lexical reconciler stays roughly flat as blocks grow because only dirty nodes + their ancestor chain are walked — confirms the §Problem thesis that the model is cheap and virtualization shouldn't (and can't) move this number. **N5 numbers** (M2 Pro / macOS): 0.09ms (200 blocks) → 0.25ms (1000) → 1.18ms (5000) median.
  - **DOM layer** (`<BrainstormEditor>` in jsdom): the cost virtualization actually addresses. **N5 numbers**: 0.33ms (200 blocks) → 1.24ms (1000) median. Note: jsdom has no layout engine / compositor / `content-visibility` support, so it materially under-reports real-browser keystroke cost AND cannot measure Phase 1's payoff at all — the test asserts only on a generous smoke ceiling. 13.4a re-runs the same fixture under Electron (Playwright bench) for the actual `<16ms` budget call.

What this gives 13.4a: a single source of truth for the document shape under test (no "wait, are we comparing the same workload" arguments between Phase 1 and Phase 2 measurements), and a baseline trend (DOM cost growing visibly with block count even in jsdom) the post-virtualization numbers can be diffed against. The headless model-layer measurement is the regression guard that survives once virtualization lands: it shouldn't change because virtualization is a DOM-only concern.

## Real-Electron baseline (13.4a.2)

Captured 2026-05-25 on darwin-arm64 by `tests/perf/specs/editor-keystroke.spec.ts`:

| Profile | Blocks | Keystroke→paint median | p95 | p99 | max | Budget | Status |
|---------|--------|------------------------|-----|-----|-----|--------|--------|
| empty   | 0      | **16 ms** | 17 ms | 521 ms* | 1004 ms* | <17 ms | ✅ PASS |
| dogfood | 200    | **16 ms** | 17 ms | 18 ms   | 18 ms    | <17 ms | ✅ PASS |
| large   | 1000   | **16 ms** | 17 ms | 17 ms   | 17 ms    | triage | ✅ sub-budget |

50 samples per profile, M2 Pro, darwin-arm64. Budget gate is the median (`BS_BUDGET_EDITOR_KEY_PAINT_DOGFOOD_MS`).

*Empty's p99/max are JIT + first-paint warmup outliers absorbed by the harness's warmup keystrokes (`BS_PERF_KEYSTROKES_WARMUP=10`); they don't move the median, which is what the budget asserts. The large profile (5× the dogfood doc) is statistically indistinguishable from dogfood — virtualization is doing its job.

The original 2026-05-25 morning attempt timed out at the contenteditable mount on all three profiles (a fresh `perf-fixture` vault has no notes → Notes lands on its empty-state UI → no editor mount). Closed in the afternoon by `packages/shell/src/main/dev/notes-scratch.ts` + the new `dev:notes:create-and-open-scratch-note` IPC — bench mints + opens an empty note in one shot, contenteditable appears immediately. The dev-bench-plugin's `NODE_ENV !== "production"` gate was also dropped: the production Notes bundle now always installs the global (sandboxed renderer, no cross-window reach).

## Verdict (2026-05-25)

**Phase-1 sufficient — Phase 2 not built for v1.** Phase-1 keystones (block-id stamp + height cache + `content-visibility` + decorator-unmount) hold the keystroke→paint budget through the `large` (1000 blocks) profile with a 1ms median margin. The activation-threshold question collapses to "always on, Phase-1 only" — every Notes document gets the keystones unconditionally, no per-doc decision.

**OQ-185 RESOLVED.** Phase 2 (true reconciliation-windowing) is reinstated as a fresh iteration if (a) Books / Code-editor workloads exceed the budget under Phase-1 alone, or (b) a future regression makes Phase 2 necessary. The §Phase 2 design above is preserved against that contingency.

## Phasing

Slotted as **implementation-plan iteration 13.4a** — adjacent to the 13.4 stress test that surfaces the need — with a **pull-forward trigger**: if dogfooding the Notes app on a real long document hits the `<16ms` budget before Stage 13, this is promoted into a Stage 9 editor-perf iteration ahead of schedule. The design (height cache, stable `data-bs-block` hooks, Phase-1 layer) is built so the keystones survive whichever phase is needed.

## Summary

- Long-document slowness in the editor is a **DOM-size problem**, not a model problem; Yjs and the EditorState stay whole and cheap.
- The Yjs-bound EditorState is **never mutated** for virtualization — view projection only.
- **Phase 1**: `content-visibility:auto` + height-cache-accurate intrinsic sizing + offscreen decorator unmount. Low risk, likely sufficient for most long docs, native find/selection preserved.
- **Phase 2** (only if Phase 1 measures short): true reconciliation-windowing with model-pinned selection and edge-indicator collab cursors — enabled by the accepted trade of native find/select for our own.
- Activation is threshold-gated so short documents pay nothing.
- Open design points tracked as **OQ-185**; ships as **13.4a** with a pre-Stage-13 pull-forward trigger.
