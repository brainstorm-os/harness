# 34 — App-side workers and concurrency

This doc covers **what app-side logic should run in workers** and how the shell supports that. It's distinct from [12-shell-architecture.md](12-shell-architecture.md), which covers the *shell's* worker processes (storage, sync, search, yjs canonical, AI broker). This doc is about workers an *app author* spawns inside their own renderer process.

It builds on [12-shell-architecture.md](12-shell-architecture.md) (process model), [13-frontend-stack.md](13-frontend-stack.md) (front-end stack), [08-app-sdk.md](../apps/08-app-sdk.md) (SDK surface), and [22-ai-foundations.md](../platform/22-ai-foundations.md) (when an app might run its own model).

## Why apps need workers

The renderer's main thread runs React, Lexical, fancy-menus, and the SDK proxy. Anything that takes more than ~5ms there causes dropped frames. Apps doing real work — parsing a 10MB Markdown file, running a local AI model, computing a diff over a long document, building an in-memory index, processing image pixels — must offload to workers or they tank the UX.

Without explicit guidance, apps reinvent worker patterns badly: they post-message huge structured clones of state every frame, they spawn workers per-task without pooling, they block waiting on workers that should be async. The shell can give a small amount of guidance and a thin SDK shim that makes the right path the easy one.

## Goals

1. **Don't block the main thread for >5ms.** Off-main-thread work goes to a worker.
2. **Keep the SDK accessible** even from inside a worker — without the worker manually re-implementing IPC.
3. **Capability inheritance is automatic.** A worker spawned by an app has access to (a subset of) the same capabilities as its parent renderer. No re-prompts.
4. **Apps don't escape isolation via workers.** The sandbox boundary is the *renderer process*, not the main thread; workers inside that process inherit the same sandbox, no more no less.

## What kinds of workers are available

| Kind                    | When to use                                                          | Constraints                                                |
|-------------------------|----------------------------------------------------------------------|------------------------------------------------------------|
| **Web Worker** (dedicated) | Default for off-main-thread work tied to one window.                  | Same process as the renderer; postMessage to main thread.  |
| **SharedWorker**        | An app with multiple windows wanting to share long-lived state across them. | Same renderer process when windows share one, OQ-4-pending. |
| **Wasm worker**         | A Web Worker hosting compiled Wasm (Rust, AssemblyScript, etc.).      | Same as Web Worker; the binary is loaded in the worker.    |
| **Service Worker**      | Not generally used in Brainstorm.                                     | Electron context; offline caching not the right fit; we use vault-side persistence instead. |
| **Separate OS process** | Apps cannot spawn their own utility/child processes.                  | Reserved for shell-internal workers per [12](12-shell-architecture.md). |

> **Decision:** apps in v1 may use **Web Workers** and **SharedWorker**, plus Wasm workers as a special case of Web Workers. They cannot spawn separate OS processes (capability mismatch with the sandbox; would let apps escape capability prompts). If an app genuinely needs a separate process, it can host its own backend off-platform and connect via the network capability — but that's app-side architecture, not worker.

## The Worker SDK shim

The biggest DX issue: a Web Worker doesn't have access to the `brainstorm` global injected at preload time (preload runs in the main thread of the renderer). Without help, apps that want to call `entities.get` from a worker must postMessage to their main thread, which calls the SDK, which postMessages back. Apps reinvent this badly.

> **Decision:** the SDK package exposes a **Worker SDK shim** — a small library that an app loads inside its worker entry point. The shim transparently mirrors the `brainstorm.services.*` surface, postMessaging to the main thread under the hood. The main thread runs a tiny relay that forwards to the actual SDK and ships responses back.

Usage from app code:

```ts
// app's main thread (renderer)
import { createWorkerBridge } from "@brainstorm/sdk/worker-host";

const worker = new Worker(new URL("./my-worker.ts", import.meta.url));
createWorkerBridge(worker);                  // attaches the relay; one line
```

```ts
// app's worker code (./my-worker.ts)
import { brainstorm } from "@brainstorm/sdk/worker";

// Use the SDK as if you were on the main thread
const note = await brainstorm.services.entities.get("ent_01HXK...");
const subscription = brainstorm.services.entities.subscribe(query, onUpdate);
```

The shim:
- Mirrors the entire `brainstorm.services.*` surface.
- Buffers and batches calls under load (per OQ-102's batched-API leaning).
- Cancels in-flight calls when the worker is terminated.
- Surfaces structured errors (CapabilityDenied, NotFound, etc.) the same as on the main thread.
- Does **not** mirror DOM-touching APIs (`brainstorm.ui.*`) — those are main-thread-only.

> **Decision:** the worker shim is part of `@brainstorm/sdk`, exposed as `@brainstorm/sdk/worker` (worker-side) and `@brainstorm/sdk/worker-host` (main-thread relay). Both ship as part of the shared platform libraries (per [13-frontend-stack.md](13-frontend-stack.md) "Shared platform libraries" section).

> **Open:** can the worker shim provide *streaming* subscriptions efficiently, or is per-update postMessage too expensive? With Yjs updates flowing through, this could be a real cost. Tracked as OQ-141.

## What logic to put in workers

Decision criteria — put it in a worker if:

1. **It blocks for >5ms on typical input.** UI lag is the canonical reason.
2. **It's CPU-bound.** Workers parallelize across cores; main thread is single-threaded.
3. **It runs in the background.** Periodic sync to non-Brainstorm services, deferred index rebuilds.
4. **It holds long-lived state shared across multiple windows of the app** (use SharedWorker).

Common patterns where this applies:

### Pattern 1 — App-side derived indexes

A database app may want to maintain its own derived indexes (e.g., a faceted-search index over Status × Priority × Assignee for fast filter UIs) beyond what the shell indexes. Computing those incrementally from entity-update streams should run in a worker.

```
   shell entity updates → main thread → worker (incremental update of derived index)
                                      → main thread (responds to UI queries against the index)
```

### Pattern 2 — App-side AI inference

An app that bundles its own local model (e.g., a sentiment-detection app, a custom code-completion model) runs inference in a worker. ONNX-Web / `transformers.js` both support worker execution; Wasm-backed models load in the worker.

> **Decision:** **the AI broker** (per [22-ai-foundations.md](../platform/22-ai-foundations.md)) is the *recommended* path for AI features. Apps using the broker don't need their own worker — the broker has its own worker. The pattern in this section applies to apps that intentionally bundle a custom model (rare; most should use the broker).

### Pattern 3 — Format parsing and conversion

Markdown → AST, AST → entity tree, CSV → entity rows, OPML → folder tree, etc. Parsing large files on the main thread tanks rendering. Workers handle parse, postMessage tree to main thread, main thread renders.

### Pattern 4 — Diff and merge for non-Yjs content

When an app wants to show a diff for content that isn't directly Yjs-backed (e.g., a code editor showing a file diff, an AI app showing accept-reject diff for suggestions), `diff` (per [13-frontend-stack.md](13-frontend-stack.md)) runs in a worker.

### Pattern 5 — Image / video processing

Image-editor apps applying filters, video apps processing frames. Wasm workers with `image` (Rust) or similar run the pixel work; main thread handles canvas display.

### Pattern 6 — Background sync to external services

An app that syncs a subset of entities with Google Calendar / Linear / etc. uses a worker for the periodic poll-and-reconcile. SharedWorker if multiple windows of the app share the sync state.

## What logic NOT to put in workers

- **Anything touching the DOM.** Workers can't.
- **Anything calling the SDK in tight loops without batching.** The postMessage round-trip per call is the bottleneck; use the shim's batched APIs.
- **Tiny synchronous tasks.** Worker spawn cost (~5-10ms first time, <1ms subsequent) dwarfs sub-1ms work.
- **State that should be the source of truth.** Workers are *compute* — derived indexes, transient state, in-flight tasks. The Yjs entity is always the source of truth.
- **Anything an app shouldn't be doing anyway** — workers don't grant new capabilities.

## Capability and trust model

> **Decision:** **workers inherit their parent renderer's capabilities exactly.** A worker can do anything the renderer can do via the SDK. It cannot do less and cannot do more. There is no separate "worker capability" surface.

This means:
- A worker can call `entities.read:Note/v1` if the parent app has the grant.
- A worker cannot make a network request the parent app couldn't make.
- A worker cannot escape the parent's process sandbox.

> **Decision:** workers **count toward the parent renderer's resource budgets** (memory, CPU, IPC quota). An app spawning 50 workers doesn't get 50× the IPC quota — it gets the same total, divided among workers.

> **Decision:** the shell does **not** prompt the user when an app spawns a worker. Workers are an implementation detail; capabilities are user-facing. The user's grant of `entities.read:*` covers all the app's worker code automatically.

## Performance characteristics

| Operation                                        | Cost                                                  |
|--------------------------------------------------|-------------------------------------------------------|
| Worker spawn (first time)                        | 5-15ms                                                |
| Worker spawn (warm, e.g. from a worker pool)     | <1ms                                                  |
| postMessage with structured clone (small object) | ~0.1ms                                                |
| postMessage with `Transferable` ArrayBuffer      | ~0.05ms (ownership transfer, no copy)                 |
| Worker → main thread call via SDK shim           | ~0.5ms + the underlying IPC cost (~1-2ms)             |
| `brainstorm.services.entities.subscribe` from worker (per update) | per-update postMessage cost — see OQ-141 |

> **Decision:** apps using workers should batch when possible. The Worker SDK shim auto-batches reads in a 4ms window; subscriptions stream individually unless a coalescing helper is requested.

## A worker-pool helper

For apps that spawn workers frequently (e.g., per-task workers for image filters), the shell SDK provides `@brainstorm/sdk/worker-pool`:

```ts
import { WorkerPool } from "@brainstorm/sdk/worker-pool";

const pool = new WorkerPool({
  worker: new URL("./compute-worker.ts", import.meta.url),
  size: 4,
});
const result = await pool.run("processImage", { buffer, filter: "sepia" });
```

Workers in the pool are kept alive between tasks; spawn cost is amortized.

> **Decision:** `WorkerPool` is provided as a convenience but not mandatory. Apps with bespoke worker patterns implement their own.

## Multi-window apps and SharedWorker

An app with multiple windows (per [03-app-model.md](../apps/03-app-model.md)'s `ui.openWindow`) can use SharedWorker to share state across them:

```ts
// shared across all windows of the app
const shared = new SharedWorker(new URL("./shared.ts", import.meta.url), {
  name: `${manifest.id}.shared`,
});
```

The SharedWorker holds the app-private long-lived state (active connections to external services, local caches, etc.) accessible from any window. The shell's renderer-process model determines whether the SharedWorker actually shares: per OQ-4 (renderer-per-window vs renderer-per-app), windows sharing a renderer share workers; windows in separate renderers don't.

> **Decision:** SharedWorker is most useful when the app has opted to share renderers across its windows (OQ-4 leaning toward shared). Apps requiring strict per-window isolation should use Web Workers and explicit cross-window state via the entities service.

> **Open:** if windows of the same app live in different renderer processes (per OQ-4), can SharedWorker still share? Browser SharedWorker is scoped to origin + name; in Electron-renderer-process isolation, this needs verification. Tracked as OQ-142.

## Threat model

What this changes:
- **Adds an off-main-thread surface within the renderer.** Workers run in the same process as the renderer, share the same memory space (logically isolated by V8), and cannot escape the process sandbox.
- **Doesn't add new capability surface.** Workers inherit parent capabilities.
- **Doesn't change the shell-app boundary.** All worker → SDK calls flow through the renderer's main thread to the IPC broker, same as a non-worker call would.

What this doesn't change:
- Cross-app process isolation (still per-app-renderer per [12](12-shell-architecture.md)).
- Cross-renderer block isolation (block iframes per [15](../editing/15-embedding-and-composition.md)).
- Capability gating (workers go through the same broker).

## Cross-doc updates needed

- [08-app-sdk.md](../apps/08-app-sdk.md) — note the SDK has a worker variant; cross-link.
- [12-shell-architecture.md](12-shell-architecture.md) — clarify that 12's "workers" refers to shell-side worker processes, not app-side Web Workers.
- [13-frontend-stack.md](13-frontend-stack.md) — `@brainstorm/sdk/worker` and `@brainstorm/sdk/worker-host` and `@brainstorm/sdk/worker-pool` ship as part of shared platform libraries.

## Phasing

| Capability                                      | v1   | v2  |
|-------------------------------------------------|------|-----|
| Web Worker support (apps just spawn them)       | ✓    | ✓   |
| Worker SDK shim (`@brainstorm/sdk/worker`)      | ✓    | ✓   |
| Worker pool helper                              | ✓    | ✓   |
| SharedWorker support                            | ✓    | ✓   |
| Wasm worker support                             | ✓    | ✓   |
| Streaming subscriptions through the shim        | post-v1 (OQ-141) | ✓ |
| Worker resource attribution / quotas surfaced    | —    | ✓   |
| Apps spawning their own OS processes            | never (out of scope) |

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-141** — efficiency of streaming subscriptions through the Worker SDK shim — per-update postMessage cost may dominate at high update rates.
- **OQ-142** — SharedWorker behavior under per-window vs per-app renderer process choice (OQ-4 dependency).

## Summary

- **App-side workers run in the renderer process**; sandbox boundary is the renderer, not the main thread.
- **Worker SDK shim** (`@brainstorm/sdk/worker`) gives workers transparent access to `brainstorm.services.*` via postMessage relay; one-line setup.
- **Workers inherit parent renderer's capabilities exactly** — no new surface, no new prompts.
- **Six common patterns**: derived indexes, app-side AI inference, format parsing, diff/merge, image/video processing, background sync to external services.
- **Workers count toward parent's resource budgets** — apps don't get more by spawning more.
- **No separate OS processes for apps in v1** — escape hatch via network-connected backends, not via process spawn.
- v1 ships Web Worker + SharedWorker + Worker SDK shim + worker-pool helper. Streaming-subscription efficiency tracked for post-v1 improvement.
