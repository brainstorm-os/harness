---
name: memory-leak-review
description: Leak & lifetime audit of the pending changes — unreleased event/IPC listeners, undisconnected observers, uncleared timers, Yjs doc refcounts, Pixi GPU objects, SQLite statements, undisposed vault sessions / unzeroed keys, retained closures. Trigger on "check for leaks", "memory leak review", "lifetime audit", or as a step in /iteration-chores.
---

# Memory-leak review

Electron is multi-process and long-lived (main + workers + per-app renderers that open/close repeatedly). A leak is anything **acquired on mount/subscribe/open that isn't released on unmount/unsubscribe/close**. Audit only the pending branch changes; trace each acquisition to its matching release.

## Method

For every resource the diff acquires, find its release and prove the release runs on **every** exit path (including error/throw and early return). Symmetry is the test: `on` ↔ `off`, `observe` ↔ `disconnect`, `setInterval` ↔ `clearInterval`, `acquire` ↔ `release`, `open` ↔ `close`, `subscribe` ↔ unsubscribe-returned-disposer actually called.

## Brainstorm-specific leak checklist

- **IPC / lifecycle listeners.** `ipcRenderer.on(...)`, broker push channels (`app:*`, `*:snapshot`, `app:intent`, `app:vault-entities-changed`), `runtime.on(...)` — each needs a matching removal on window/component teardown. Capture-phase DOM listeners too.
- **Yjs resolver refcount.** `useYDoc(entityId)` / resolver handles are refcounted with echo-suppression — every acquire must release; a missing release pins the Y.Doc + its update tail forever. Confirm `closeDoc` / handle release on unmount and on entity switch.
- **Observers.** `ResizeObserver` / `IntersectionObserver` / `MutationObserver` disconnected on teardown (Graph canvas, resizable panels, widget pause-off-screen). `attachResizable` returns a cleanup — confirm it's invoked.
- **Pixi GPU objects.** Textures, `Graphics`, `Sprite`, `Application` must be `.destroy()`-ed; per-frame allocation of textures/Graphics instead of reuse is both a perf and a GPU-memory leak.
- **Timers / RAF / async.** `setTimeout`/`setInterval`/`requestAnimationFrame` cleared; in-flight async guarded (AbortController or a disposed flag) so a late resolve doesn't write into a torn-down view or re-subscribe.
- **SQLite / repos.** Prepared statements finalized or owned by a long-lived repo (not re-prepared per call and dropped); no per-request DB handle that never closes.
- **Vault session / secrets.** `closeActiveVaultSession` / `dispose` zeroes the 32-byte master key and clears identity; the diff must not copy those bytes into a buffer that outlives the session or a closure that retains it.
- **Retained closures / growing collections.** Long-lived `Map`/`Set`/array that only grows (per-window/app/entity caches with no eviction or no removal on close); closures capturing large state (whole snapshots, DOM nodes, Y.Docs) kept alive by a listener that is never removed.

## Report

Under 250 words: `MUST-FIX (leak: resource, where acquired, missing release, exit path)` / `NICE-TO-FIX (lifetime hardening)` / `OK (acquisitions traced, releases symmetric)`. List what you traced even when clean. **Stop and surface to the user on any must-fix; do not auto-fix.**
