# 12 — Shell architecture (deep)

Where [02-architecture.md](../foundations/02-architecture.md) gives the three-layer overview and [04-shell.md](04-shell.md) describes the surfaces a user sees, this doc describes how the shell is **built**: process layout, boot sequence, IPC mechanics, window manager internals, persistence layout, threading, crash recovery, and the performance budgets the shell is engineered against.

This is the document that anchors implementation choices. Other docs may say *what*; this one says *how*.

## Goals

The shell exists to make apps fast, isolated, and persistent. Concretely:

1. **Fast cold start** — the dashboard must paint quickly. No-app baseline is the floor of every user interaction.
2. **Cheap idle** — when no app is doing work, the shell should disappear into the background.
3. **Bounded blast radius** — an app crash, freeze, or memory leak must not affect the shell or other apps.
4. **Predictable persistence** — every accepted edit reaches durable storage; recovery from a crash never loses an acknowledged write.
5. **Transparent IPC** — the per-app sandbox is opaque from outside, but IPC must be cheap enough that crossing the shell ↔ app boundary is not a hot-path concern.

The performance budgets at the bottom of this doc are how we know we're meeting these goals.

## Process layout

```
                          ┌────────────────────────────────┐
                          │   Electron main process         │
                          │   - shell coordinator           │
                          │   - capability ledger           │
                          │   - IPC broker                  │
                          │   - window manager              │
                          │   - registry                    │
                          │   - identity / signing          │
                          └────────────┬───────────────────┘
                                       │
              ┌────────────────────────┼─────────────────────────┐
              │                        │                         │
              ▼                        ▼                         ▼
   ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
   │ Dashboard renderer   │  │ App renderer (sandbox)│  │ App renderer (sandbox)│
   │ (privileged, shell-   │  │ id: io.example.text   │  │ id: io.example.db    │
   │  bundled UI)          │  │                       │  │                       │
   └──────────────────────┘  └──────────────────────┘  └──────────────────────┘

                          ┌────────────────────────────────┐
                          │   Worker processes (Node)       │
                          │   - storage worker (disk I/O)   │
                          │   - sync worker (transports)    │
                          │   - search worker (indexing)    │
                          │   - yjs canonical worker(s)     │
                          └────────────────────────────────┘
```

### Roles

- **Main process** — the Electron entry point. Light: it coordinates, it does not do heavy I/O. Holds the capability ledger, the registry, the window manager state, and the IPC broker.
- **Dashboard renderer** — a single privileged renderer that hosts the dashboard, launcher, settings, app store UI, and notifications. Bundled with the shell. Has direct access to a small set of host APIs the main process exposes only to it.
- **App renderers** — one per running app (see OQ-4 on per-window splitting). Sandboxed, context-isolated, no Node integration. Communicate with the main process only through the IPC broker.
- **Worker processes** — Node-based child processes (Electron `utilityProcess` or Node workers) that own heavy I/O and CPU work: storage, sync, search indexing, and (importantly) the canonical Yjs runtime. Decoupling these from the main process keeps the main loop responsive even under disk/network/index pressure.

> **Decision:** the main process must never block on I/O. Filesystem and network operations live in worker processes, communicated to via Node's `MessagePort`. The main process is essentially a router and policy engine.

> **Resolved (OQ-18):** the canonical Yjs runtime is a dedicated *yjs worker* — *[RESOLVED in implementation-plan Stage 3 — the ydoc worker is spawned alongside the storage worker by `startWorkers()`; keeps the main loop free under heavy concurrent editing]*. See OQ-18 in [11-open-questions.md](../reference/11-open-questions.md).

### Why this many processes

Each separation buys something specific:
- **Main vs. workers**: keeps disk and network latency off the policy/IPC path.
- **Workers vs. each other**: storage failures (disk full) can't lock up sync; sync transport hangs can't pause search indexing.
- **Workers vs. renderers**: trusted Node-side code can do raw FS, network, native modules; renderers cannot.
- **App renderers vs. each other**: cross-app isolation, the security boundary.
- **Dashboard vs. apps**: the dashboard is shell-trusted code; treating it as a generic renderer would force the same sandbox restrictions and prevent it from talking to the main process more freely.

## Boot sequence

The cold-start path (no warm caches):

1. **Process spawn** (~30–60ms on modern hardware): Electron starts, main process initializes.
2. **Settings + identity load** (~10–20ms): main process reads shell settings and the identity keystore from disk synchronously. This is small (single-digit KB) and on the critical path.
3. **Worker spawn (parallel)** (~50–100ms): storage, sync, search, yjs workers launched in parallel via `utilityProcess.fork`. Main does not block on their readiness.
4. **Capability ledger + registry load** (~10–30ms): loaded from on-disk indexes by the storage worker, streamed to main as soon as available.
5. **Dashboard renderer launch** (~80–150ms): `BrowserWindow` created with the dashboard bundle. The bundle is local file I/O; no network.
6. **First paint** of dashboard: target **<300ms total** from process spawn on a 2020-era machine.
7. **Lazy work**: search indexing, sync transport connection, app pre-warming all happen *after* first paint, on idle callbacks.

> **Decision:** nothing optional is on the critical path. If a step doesn't directly contribute to the dashboard's first interactive frame, it runs after first paint.

> **Decision:** the main process is allowed to do synchronous reads only for the settings and identity keystore (a few KB at most). Everything else is async.

### Warm start

Subsequent launches benefit from OS caches and (optionally) a small persistent cache of the dashboard bundle's parsed JS. Target: **<150ms** from spawn to first paint on warm cache.

### App launch sequence

When the user opens an app:

1. Window allocated by the window manager (~5ms).
2. Renderer process spawned with sandbox preload (~80–120ms cold; <30ms warm).
3. Preload script connects to the IPC broker, hands the renderer its identity stamp.
4. App bundle loaded from disk (zero-network).
5. App's `entry` parses, calls into `brainstorm` global, requests its initial entity / launch context.
6. First paint.

Target: **<800ms cold app launch** (process spawn + bundle parse + first paint). **<200ms** warm launch (renderer kept around from previous launch).

> **Decision:** the shell may opportunistically keep recently-used app renderers alive for fast re-launch, subject to memory pressure. Idle renderers are paused (CPU throttled, GC'd) but not terminated until memory budgets fire. This is invisible to the app — `suspend` and `resume` callbacks bracket the pause.
>
> **Status (2026-05-30):** implemented in `AppLauncher` (`main/apps/launcher.ts`) as renderer *parking* — on user-close a window is hidden (not destroyed) and kept warm; re-launch shows the same renderer (no re-spawn / re-parse). An LRU cap of `DEFAULT_MAX_PARKED_WINDOWS` (3) bounds memory; parked renderers are evicted (truly destroyed) on the cap, app uninstall, and **vault lock / close / switch** (a parked renderer holds the prior session's data — it must never outlive the session). Parked windows are excluded from the running set + window strip (they read as closed) but still receive broadcasts so they're current on resume. **Pending:** explicit `suspend`/`resume` event *emission* to apps (the `LifecycleEvent` types + SDK emitter exist; the shell does not yet fire them — hidden renderers are throttled by Chromium meanwhile) and OS memory-pressure-driven eviction.

## IPC architecture

Every host-service call from an app to the shell is an IPC message. This path is critical.

### Envelope

```ts
{
  v: 1,                              // protocol version
  msg: "uuid-...",                   // correlation id
  app: "io.example.text-editor",     // identity stamped by preload
  service: "entities",
  method: "subscribe",
  args: [/* ... */],
  caps: ["entities.read:io.example/Note/v1"],   // the caller's claim
}
```

- The `app` field is **stamped at preload**, not by the app's JS. The app cannot forge it; it's set by trusted code in the renderer's preload before any app code runs.
- The `caps` field is a hint; the broker re-checks against the capability ledger. The ledger is the source of truth.

### Routing

The IPC broker in the main process:

1. Validates the envelope structure.
2. Verifies `app` matches the originating renderer (preload-stamped).
3. Resolves the target service (`entities`, `storage`, etc.) — most live in workers.
4. Checks the required capabilities for `<service>.<method>`.
5. Forwards to the worker via `MessagePort`. Worker returns; broker proxies the reply.

> **Decision:** IPC is request/response with optional streaming for subscriptions. Streaming uses long-lived `MessagePort` channels so subscription updates don't pay the per-message broker overhead.

### Throughput targets

- **Round-trip latency** (renderer → main → worker → main → renderer) for a non-streaming call: **<2ms median, <8ms p99** on cold worker; **<1ms median** when worker has warm caches.
- **Streaming throughput** for entity subscriptions (Yjs updates flowing renderer ↔ canonical Y.Doc): **>10MB/s sustained**, which is many orders above any realistic editing rate.

### Backpressure

If a worker is slow, the broker queues. Each app has a per-app queue with a fixed depth. Overflow drops the oldest non-streaming requests and surfaces an error to the app (`Unavailable`). Streaming subscriptions never drop; they apply backpressure to the producing worker.

> **Decision:** a misbehaving app cannot DoS the shell by flooding IPC. The per-app queue caps blast radius.

## Window manager

The window manager is a small piece of the main process responsible for:

- Creating, focusing, restoring, and closing windows.
- Mapping each `BrowserWindow` to its `(app_id, window_id)`.
- Persisting position, size, maximized state per `(app_id, window_id, monitor_id)` triple.
- Restoring the previous session (if enabled): re-launching apps that had open windows last time, in their last positions.
- Implementing the "uniform vs custom chrome" policy (see OQ-5).
- Debouncing position/size writes to disk (every move would otherwise hammer the storage worker).

### Multi-monitor

Each window remembers which monitor it was on by `monitor_id` (a stable hash of the monitor's geometry/identifier). On launch, if that monitor is gone, the window falls back to the primary monitor at a clamped position.

### Z-order and focus

The window manager forwards focus events to the dashboard renderer (so the launcher knows what's focused) and to the app via a lifecycle event. Apps may not steal focus across the boundary; only user gesture or an intent dispatch can raise an app window.

## Persistence layout

A clean on-disk layout makes backup, recovery, and inspection tractable.

```
~/Library/Application Support/Brainstorm/        (macOS; analogous on Windows/Linux)
├── shell/
│   ├── settings.json                  // shell-level settings
│   ├── identity/
│   │   └── keystore                   // OS-keychain-backed
│   ├── capabilities.db                // capability ledger (SQLite)
│   ├── registry.db                    // openers, blocks, types, widgets (SQLite)
│   ├── session.json                   // last running apps + window positions
│   └── audit.log                      // append-only audit trail
├── apps/
│   └── io.example.text-editor/
│       ├── 1.4.2/                     // versioned bundle
│       │   ├── manifest.json
│       │   ├── dist/...               // bundle assets
│       │   └── bundle.sha256          // integrity hash
│       └── current -> 1.4.2/          // symlink to active version
├── data/
│   ├── entities/                      // entity records (SQLite)
│   │   ├── index.db
│   │   └── entities.db
│   ├── docs/                          // Y.Doc snapshots + tails
│   │   └── <entity-id-prefix>/<entity-id>.ydoc
│   ├── attachments/                   // blob storage for embedded files
│   │   └── <hash-prefix>/<hash>
│   ├── search/                        // search index (e.g. SQLite FTS5 or Tantivy)
│   └── app-private/
│       └── io.example.text-editor/    // each app's private KV
│           └── kv.db
└── logs/
    └── shell.log
```

> **Decision:** SQLite is the default for indexed structured data (capabilities, registry, entities index, search). Single-file, well-understood crash semantics, fast for our scale. Y.Doc storage is its own format (snapshot + tail of binary updates), backed by SQLite when convenient or flat files when not.

> **Decision:** all on-disk formats are intentionally **portable** — a backup is a `tar` of `~/Library/Application Support/Brainstorm/`. No proprietary container.

### Crash semantics

- Y.Doc updates are written to a write-ahead log before being applied; partial writes on crash are recoverable.
- The capability ledger uses SQLite WAL mode; partial transactions roll back.
- The shell on launch runs a recovery pass: replay any unflushed Y.Doc updates, validate ledger integrity, log any oddities to `audit.log`.

## Threading and background work

Inside the main process and dashboard renderer, the JS event loop is the only thread. Heavy or blocking work is deferred to:

- **Worker processes** for I/O (storage, sync, search) and the canonical Y.Doc.
- **Web Workers** inside the dashboard renderer for CPU-heavy local work (e.g. computing a fuzzy-search ranking on a 100k-entity result set).
- **`requestIdleCallback`** for non-urgent main-thread work (telemetry batching, layout reflow on settings panels).

> **Decision:** no heavy synchronous work on the main process or dashboard renderer event loops. Anything >5ms goes to a worker.

## Crash recovery

Per process:

- **App renderer crash**: window closes; user is offered restart in a banner. Unflushed Yjs updates that reached the canonical doc are intact (the shell holds them); any *purely-local* Yjs updates in the renderer's replica are lost (this is rare — IPC ships updates eagerly).
- **Worker crash**: shell respawns the worker, replays any pending requests. Apps may briefly see `Unavailable` for that service.
- **Dashboard renderer crash**: shell respawns. The previous state is restored from `session.json` plus the dashboard Y.Doc.
- **Main process crash**: the whole shell is gone. On relaunch, recovery pass restores everything that was durably persisted.

> **Decision:** a write that has been acknowledged to the calling app is durable. We do not acknowledge before the storage worker has flushed (or crash-safely buffered). This is the cost we pay for the persistence guarantee.

## Performance budgets

Concrete targets the shell is designed against. These are budgets, not promises — but a regression past them is treated as a bug.

| Metric                                              | Target          |
|-----------------------------------------------------|-----------------|
| Cold start to dashboard first paint                 | <300ms          |
| Warm start to dashboard first paint                 | <150ms          |
| Cold app launch to interactive                      | <800ms          |
| Warm app launch to interactive                      | <200ms          |
| Launcher: keystroke to result paint                 | <50ms           |
| IPC round-trip latency (median)                     | <2ms            |
| IPC round-trip latency (p99)                        | <8ms            |
| Editor input latency (key to paint, in editor app)  | <16ms           |
| Idle CPU usage (no app running)                     | <0.5%           |
| Idle RAM (shell + dashboard, no apps)               | <250MB          |
| Per-app renderer baseline RAM                       | <80MB           |
| Y.Doc update applied → persisted to disk            | <50ms           |

These assume a 2020-era laptop (M1 Mac / equivalent x86, SSD). Lower-end hardware budgets are roughly 2–3x relaxed.

### Perf-harness coverage (12.7)

`tests/perf/specs/*.spec.ts` exercises every budget in the in-doc table above and `tests/perf/lib/check-results.ts` exits 1 on any `passed:false` or any missing scenario. Run via `bun run perf:ci` (build + perf suite + aggregator). Mapping:

| Budget                                              | Spec                                              |
|-----------------------------------------------------|---------------------------------------------------|
| Cold start to dashboard first paint                 | `tests/perf/specs/cold-start.spec.ts`             |
| Warm start to dashboard first paint                 | `tests/perf/specs/cold-start.spec.ts`             |
| Cold app launch to interactive                      | `tests/perf/specs/app-launch.spec.ts`             |
| Warm app launch to interactive                      | `tests/perf/specs/app-launch.spec.ts`             |
| IPC round-trip latency (median)                     | `tests/perf/specs/ipc-rtt.spec.ts`                |
| IPC round-trip latency (p99)                        | `tests/perf/specs/ipc-rtt.spec.ts`                |
| Launcher: keystroke to result paint (apps section)  | `tests/perf/specs/launcher-keystroke.spec.ts`     |
| Launcher: keystroke to result paint (entities)      | `tests/perf/specs/launcher-keystroke.spec.ts`     |
| Editor input latency (key to paint) — empty doc     | `tests/perf/specs/editor-keystroke.spec.ts`       |
| Editor input latency (key to paint) — dogfood doc   | `tests/perf/specs/editor-keystroke.spec.ts` (13.4a.2) |
| Idle CPU usage                                      | `tests/perf/specs/idle-footprint.spec.ts` (13.4)  |
| Idle RAM (shell + dashboard)                        | `tests/perf/specs/idle-footprint.spec.ts` (13.4)  |
| Per-app renderer baseline RAM                       | `tests/perf/specs/idle-footprint.spec.ts` (13.4)  |
| Y.Doc update applied → persisted to disk            | `packages/shell/src/main/integration/stress.test.ts` (13.4) |

### Stress-test coverage (13.4)

The three documented scale points — **100k entities**, a **50 MB Y.Doc**, and a **1000-cell layout** — are exercised headlessly (vitest, in-process, no native rebuild) by `packages/shell/src/main/integration/stress.test.ts`:

| Scale point             | What it drives                                                                                                                              | Asserted budget                                       |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| 100k entities           | bulk-insert 100k rows into a real `entities.db`, build the FTS5 index, time by-type / by-link / full-text queries                            | FTS <50ms p50 / <100ms p99 (docs/data/18 §budgets)    |
| 50 MB Y.Doc             | grow a `Y.Doc` through `ydoc-store` append→persist, verify per-entry CRC on reload, prove the 256 KiB tail-compaction threshold fires       | Y.Doc update→persist <50ms p99                        |
| 1000-cell layout        | validate + resolve a 1000-cell `Layout/v1` through the shared validator/resolver                                                            | single-render, well under one frame                   |

The headless suite asserts against the doc targets with a CI-safe slack multiplier (`BS_STRESS_CI_SLACK`, default ×8) because it runs on shared, unknown hardware — the raw `console.log` numbers it prints (run with vitest's console intercept disabled) are the real signal; the assertion only guards against an order-of-magnitude regression. Process-level idle budgets (CPU / RAM / per-app renderer RAM) can only be measured against a running shell, so they live in the real-Electron `idle-footprint.spec.ts` alongside the other perf specs and source from `app.getAppMetrics()`.

The launcher-entities row carries a derived budget (170ms = 50ms paint headroom + the 120ms `SEARCH_DEBOUNCE_MS` the launcher intentionally pays before the FTS5 dispatch). The derivation is recorded in `tests/perf/lib/budgets.ts` next to the entry and inline in the spec — asserting the raw 50ms there would gate on something the launcher never does. The apps-row asserts the raw doc number directly (sync-cached filter, no debounce).

## Observability

The shell records:

- **Audit log** (per [09-security-and-sandbox.md](../security/09-security-and-sandbox.md)) — security-relevant events.
- **Shell log** — process events, errors, performance counters. Local only.
- **Per-app perf counters** — IPC volume, queue depth, worker times. Visible in a debug pane; not transmitted.

> **Decision:** no telemetry leaves the device by default. If we add opt-in telemetry, it is opt-in and itemized.

## What this doc does **not** cover

- The *contents* of the dashboard (icons, widgets, launcher UX) — see [04-shell.md](04-shell.md).
- The SDK surface apps use to talk to the shell — see [08-app-sdk.md](../apps/08-app-sdk.md).
- The Yjs model itself — see [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).
- The front-end framework choices — see [13-frontend-stack.md](13-frontend-stack.md).
- Distribution and updates — see [14-app-store.md](../apps/14-app-store.md).
