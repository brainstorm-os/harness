---
name: performance-review
description: Performance review of the pending changes against Brainstorm's documented budgets — startup, IPC round-trip, search latency, dashboard/app render, bundle size — plus the project's known perf traps (SVG-in-canvas, non-transform panel animation, sync work on main, unbounded caches). Trigger on "performance review", "perf check", "did this regress a budget", or as a step in /iteration-chores.
---

# Performance review

Assess only what the pending branch changes. The bar is the documented budgets, not vibes.

## Read first

- `docs/shell/12-shell-architecture.md` — startup + IPC RTT budgets.
- `docs/shell/13-frontend-stack.md` — dashboard/app render + bundle budgets.
- `docs/data/18-storage-and-search.md` — search latency + storage budgets.

## Method

1. **Budgeted-surface touch test.** Does any change touch startup path, an IPC method on a hot path, search/query, dashboard or app first paint, or anything in `.size-limit.json`'s scope? If nothing budgeted is touched, say so and stop early — don't manufacture concern.
2. **Before/after numbers.** For any budgeted surface that *is* touched, demand real numbers, not estimates. No numbers → that's a must-fix gap, not a pass.
3. **`bun run size`** — run it; report whether every `size-limit` entry passes, with the deltas.
4. **Known-trap scan** (project has been burned by these — see memory):
   - SVG-in-canvas in the Graph app. The canonical path is pixi + d3-in-worker; new SVG render paths for large node counts are a regression.
   - Panel open/close must animate via `transform: translateX(...)` (GPU-only) — flag any `width` / `grid-template-columns` / `margin` / `left` transition.
   - Pixi: `unsafe-eval` import present before `new Application()`; textures/Graphics reused not re-created per frame.
   - Sync/CPU work on the main process or the renderer's main thread that belongs in a worker.
   - N+1 IPC (per-row round-trips instead of one batched envelope).
   - Unbounded growth: caches/Maps without eviction, listeners accumulating, snapshots not coalesced.
   - `font-size`/layout thrash; non-virtualized large lists.

## Report

Under 250 words: `BUDGET IMPACT` (which surfaces, or "none touched") / `NUMBERS` (before→after + `bun run size` result) / `REGRESSIONS` (must-fix) / `OK`. **Stop and surface to the user on any budget regression; proceed only if the user explicitly accepts it. Do not auto-optimise.**
