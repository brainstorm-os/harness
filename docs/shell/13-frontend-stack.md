# 13 — Front-end stack

This doc records front-end technology choices for Brainstorm and the reasoning behind them. The driving constraint, per the project goals, is **performance**: cold start, input latency, idle footprint, and bundle size. Where a choice is debatable, the alternatives are documented and the open decision is referenced in [11-open-questions.md](../reference/11-open-questions.md).

## Scope

Two surfaces have front-end code:

1. **The shell** — dashboard, launcher, settings, app store UI, notifications. Bundled with the app, owned by us.
2. **Apps** — third-party (and first-party) software that runs in sandboxed renderers. Their tech is mostly their own choice; we provide a recommended track and a baseline package (`brainstorm-editor`).

The shell's stack is something we control. App authors' stacks are something we *recommend* and provide tooling for, but cannot mandate.

## The framework choice

Performance criteria for the shell:

- Smallest possible bundle (loaded on every cold start).
- Lowest possible runtime overhead (the shell is always live).
- Predictable, fine-grained reactivity (the dashboard observes Yjs docs and per-app status without re-rendering the world).
- A mature ecosystem for accessibility, internationalization, design-system primitives.

Three credible candidates:

### Option A: React 19 + React Compiler

- **Pros:** dominant ecosystem, mature accessibility primitives, the Lexical lock-in already pulls us here, React Compiler removes most manual `useMemo`/`useCallback`, Suspense improvements help cold start.
- **Cons:** VDOM remains; bundle is ~45KB gz; reactivity is coarse-grained per-component; concurrent rendering helps but doesn't beat fine-grained.

### Option B: SolidJS

- **Pros:** ~7KB runtime, no VDOM, fine-grained signals match Yjs's observable model perfectly, JSX with React-like mental model, demonstrably the fastest mainstream framework on UI benchmarks.
- **Cons:** smaller ecosystem (still growing), no Lexical binding, mixing with React-required apps creates two stacks for shell-provided components to live in.

### Option C: Svelte 5 (with runes)

- **Pros:** compile-time reactivity, very small runtime (~5KB), good DX.
- **Cons:** different syntax (.svelte single-file components) — less code-reuse with React-using apps; runes are new and the migration story for libraries is unsettled.

### The Lexical lock-in

Lexical is React-coupled. The official editor toolkit (`@lexical/react` and its plugin ecosystem) targets React. There is a vanilla Lexical core, but using it without `@lexical/react` means rebuilding the binding plus a substantial plugin layer (history, collaboration, lists, code, markdown, mentions, …). That work is real and never finished — every Lexical version is a porting cost.

**Implication:** any app that uses Lexical for rich text is going to use React. Period. The `brainstorm-editor` package — the shared editor configuration we ship — is therefore a React package. Apps that include rich text are React apps.

This means the question for *the shell specifically* is: do we accept a dual-framework world (Solid for shell, React for Lexical apps), or do we stay React everywhere?

### Decision (v1)

> **Decision:** Brainstorm v1 uses **React 19 with the React Compiler** for the shell, the `brainstorm-editor` package, and the recommended app track. **One ecosystem.**

Reasoning:

1. **Reactivity is the load-bearing reason, not Lexical.** Brainstorm is a CRDT-backed, multi-device, collaborative product: an entity changes from another device/user, a sync update arrives, a cross-app edit lands — and the UI must reconcile. A declarative framework gives "state changed → UI reconciles" (keyed DOM reuse, fine-grained re-render) *for free*. Leave the framework to each app and every app re-implements its own subscribe-to-vault-and-re-render stack — coarsely, divergently, buggily (the bookmarks scroll-blink + a different debounce in every app were exactly this). One ecosystem means **one** reactivity stack: the Yjs document body via `@brainstorm/react-yjs` `useYMap`/`useYText`, and live entity lists via `useVaultEntities`/`useLiveEntities`. This is why the bar below is "reactive apps use React," not "rich-text apps use React."
2. **The big perf wins are below the framework**. Cold start is dominated by process spawn, bundle parse, and worker startup — not VDOM. IPC throughput, Yjs serialization, and disk I/O dwarf the difference between Solid and React in the budgets at [12-shell-architecture.md](12-shell-architecture.md). The shell's per-frame work is small (the dashboard is not a complex animation surface); we don't need fine-grained signals to hit 60fps here.
3. **Lexical pulls us to React anyway**. A mixed stack means shell components can't easily compose with editor-using apps; widgets that include rich text (a "recent notes" widget showing a snippet) need React.
4. **Ecosystem maturity matters for desktop**. Accessibility, keyboard handling, and platform polish come from established React libraries.
5. **The decision is reversible at a clean boundary**. The shell is one renderer process with its own bundle. If perf measurement shows React is the bottleneck, swapping the shell to Solid is a self-contained project — no app code is affected.

> **Rule (first-party apps): every app is a React app.** A **reactive app** — anything backed by vault/Yjs entities that updates from other devices/users (which is nearly every app, including code-editor: collaborative code is a Yjs surface) — **reads live state only through the shared `@brainstorm/react-yjs` hooks**. It must NOT hand-roll `vaultEntities.onChange → list() → setState/render`. Canvas-heavy apps (Graph, Whiteboard) are not exempt: imperative code is confined to the render surface itself — the Pixi/WebGL/2D-canvas draw loop — while everything around the canvas (header, sidebars, inspectors, panels, dialogs, legends) is React, and even the draw loop subscribes to entity changes through the shared hooks, not a private loop. Enforced by the ratchet `tools/check-app-reactivity.mjs` (run in `bun run lint`/`verify`); scaffold a compliant app with `bun run new-app <id> "<Name>"`.

> **Open:** revisit the framework choice if profiling shows the shell renderer's React runtime is the dominant cost in cold start or idle CPU. Tracked as OQ-19 in [11-open-questions.md](../reference/11-open-questions.md).

### What we use to make React fast

Picking React isn't picking the slow path. We use the modern React stack deliberately:

- **React 19** — the baseline. No compatibility shims.
- **React Compiler** (the `babel-plugin-react-compiler` from React 19's release) — removes 95% of manual memoization. Components stay readable, re-renders stay narrow.
- **No legacy rendering modes** — Concurrent React only.
- **No `use client` / `use server`** — Brainstorm is not an RSC product. The whole app is a client; SSR is irrelevant.
- **Selective suspense** — for code-splitting widget UI and settings panels.

## TypeScript

> **Decision:** TypeScript 5.x with `strict: true` is mandatory for all shell code. Apps are recommended but not required to use TypeScript.

Strict mode catches the Yjs/IPC class of error (typing the wire format, narrowing entity types, propagating capability errors) where it matters most.

The published SDK type package (`@brainstorm/sdk-types`, see OQ-13) gives app authors the same typed surface even if their app is plain JS.

## Build tooling

> **Decision:** Vite for development; Rollup (Vite's prod path) for production builds. Bun as the runtime for non-Electron tooling and dev scripts where its speed matters. **Biome** as the single linter + formatter (replacing ESLint + Prettier).

- **Vite** — fastest dev server we know about; HMR is instant; pre-bundling with esbuild is solid. Used by both shell and the recommended app track.
- **Rollup** — production bundles. Tree-shaken aggressively. Targeting Chromium-only (Electron) lets us drop polyfills.
- **Bun** for tasks (test runner, codegen, build scripts, package management). Faster than Node for our use, especially when running many small workers.
- **Biome** — Rust-based, single binary, replaces ESLint + Prettier. ~25× faster than ESLint, formatter is Prettier-compatible. Custom rules (e.g. the no-hardcoded-strings rule from [21-localization.md](../platform/21-localization.md)) implemented as Biome plugins where possible; remaining edge cases via lightweight checks in `brainstorm-cli`.
- **TypeScript project references** (composite projects) for the shell's internal package layout — incremental rebuilds.

> **Open:** Biome's TypeScript rule coverage is still catching up to typescript-eslint for some advanced rules (e.g. exhaustive switches). For any rule we need that Biome doesn't have yet, we either contribute upstream or ship a lightweight standalone check. Acceptable trade-off for the dev-time speedup. Tracked as OQ-65.

> **Open:** do we ship the shell with separate development and production builds, or always production-built (with sourcemaps for debugging)? Tracked in OQ-20.

## State management

This is the area where it's easiest to over-engineer. Brainstorm has *one* primary reactivity system, and it's not a UI-framework concept — it's Yjs.

> **Decision:** **Yjs is the source of truth for entity-shaped state.** No separate global store mirrors entities. UI components subscribe to Yjs observables (via thin React hooks like `useYMap`, `useYText`, etc., or via the higher-level entity-subscription APIs in the SDK) and re-render on change.

For non-entity local UI state (the launcher's current query, the active settings tab, transient tool state):

- **`useState` / `useReducer`** for component-local state. Default.
- **React context** for shell-wide ambient state (theme, locale).
- **Zustand** if a piece of state is genuinely cross-component and not entity-shaped (rare — most cross-component state in Brainstorm *is* an entity property, e.g. dashboard layout).

> **Decision:** **No MobX.** Layering MobX over Yjs creates two reactivity systems with overlapping responsibilities; subtle propagation bugs and performance opacity are the predictable result. Yjs's subscriptions are sufficient for entity state; React's built-in tools are sufficient for UI state.

> **Decision:** **No Redux.** The Yjs-everywhere model removes the use case for a centralized event-sourced store; Yjs *is* the event-sourced store, and it lives at the right layer.

### Yjs <-> React binding

A thin internal package (working name `react-yjs`, published as part of the SDK) provides:

- `useYDoc(entityId)` — subscribes to the entity's Y.Doc; re-renders on update.
- `useYMap(yMap, key)` — observes one key.
- `useYText(yText)` / `useYXmlFragment(yXmlFragment)` — for editors (Lexical handles this internally via `@lexical/yjs`).
- `useAwareness(entityId)` — observes presence/cursor data.

These hooks are *the* way React touches Yjs. They batch updates per microtask to avoid thrash, and they read-only — mutations go through the SDK's `entities.update` (see [08-app-sdk.md](../apps/08-app-sdk.md)).

## Styling

> **Decision:** **Vanilla-extract** for shell-bundled components. CSS Modules are accepted; Tailwind is allowed inside individual apps but not in the shell.

Reasoning:

- **Vanilla-extract** gives type-safe, zero-runtime CSS. Builds to static `.css` files. No styled-components-style runtime overhead. Plays well with TypeScript's design-token autocomplete.
- **Tailwind** is fine for app authors who want it — its build-time atomicity is performant — but bringing it into the shell adds a build dependency we don't need.
- **No CSS-in-JS with runtime** — no styled-components, no emotion. They generate styles at runtime; we measure that as 5–15% overhead on initial paint, which we don't accept for the shell.

A small **design-token package** (working name `brainstorm-tokens`) is provided: colors, spacing, typography, motion. Apps may import it for visual coherence with the shell, or ignore it. The shell uses it.

## Motion

The product's perceived smoothness is load-bearing: a sidebar that snaps, an app window that pops, a tile that doesn't acknowledge a click — all read as "clunky" even when every underlying operation is fast. Treat motion as a first-class part of the design system, not as ornament.

### Canonical motion language

- **Spring values are pinned.** `MOTION_SPRING_STANDARD = { stiffness: 360, damping: 36 }` (in `@brainstorm/sdk/motion`) mirrors the Settings drawer slide-in. Any new entrance / overlay animation in the shell reuses these values so the product feels coherent. A bespoke spring is rejected — match the existing language.
- **Durations** come from CSS variables: `--motion-duration-fast` (120ms), `--motion-duration-normal` (200ms), `--motion-duration-slow` (320ms). Easing comes from `--motion-easing-standard` / `--motion-easing-decelerated` / `--motion-easing-accelerated`. Hand-typed `120ms ease` is rejected — token names make refactors and theme overrides tractable.
- **App-window entrance.** Every cold app launch fades in from `opacity: 0` + `scale(0.96)` to full opacity / scale over 220ms. Driven by `:root[data-bs-launch-phase="entering-cold"]` set by the app preload, paired with the `bs-app-entrance-cold` keyframes. Warm re-show (keep-alive renderer) uses `entering-warm` (fade only, no scale).
- **Dashboard tile press.** Tiles dip to `scale(0.94)` while the pointer is down — pure CSS `:active`, instant feedback, no React state. The dragging variant wins so a drag never bounces.

### Animate transform, not size

Project-wide rule (per [[feedback_animate_transform_not_width]]): never transition `width`, `grid-template-columns`, `margin`, or `padding`. These touch layout and pay reflow cost on every frame; on a panel with text inside, the typography shimmers as it gets squeezed.

Pattern for collapsible panels (the **canonical** pattern, prior-art lives in Notes' `.notes__nav`):

1. **Track flips instantly.** The grid track (or flexbox width) goes from `260px` to `0` with **no transition**. Content reflows immediately — body width becomes wider in the same frame.
2. **Panel slides via transform.** The inner panel is positioned absolutely inside the track or stays in flow with `overflow: hidden` on the track; it transitions `transform` over `--motion-duration-normal` and toggles `translateX(-100%)` (left panels) or `translateX(100%)` (right panels). GPU-only — `will-change: transform` is set.

A shared `.bs-panel-slide` helper will land alongside its first non-Notes consumer (per CLAUDE.md "no abstraction without three uses"). Until then, every collapse re-implements the two-step pattern above with its own class names.

### Reduced motion

Every new animation honours `prefers-reduced-motion: reduce`. There are two layers:

1. **Global cover** in `renderer/styles.css`: a single `@media (prefers-reduced-motion: reduce)` block crushes every `transition-duration` / `animation-duration` to `0.01ms`. New animations in the **shell renderer** fall under this cover without per-rule work. (Sandboxed app renderers don't load `renderer/styles.css`; `app-preload.ts` injects an equivalent block alongside the entrance keyframes so apps inherit the same behavior.)
2. **Per-feature opt-outs** where the animation is semantically a part of the surface (e.g. popover backdrop fade, app entrance) — these add a localised `@media (prefers-reduced-motion: reduce) { animation: none; }` for clarity at the call site.

`@brainstorm/sdk/motion` exports `prefersReducedMotion()` and `onReducedMotionChange()` for non-CSS contexts (e.g. the `attachResizable` animated tween short-circuits to an instant write).

### Smoothness contract for new surfaces

When you add a new entrance, collapse, or overlay surface, the diff includes (no exceptions, [[feedback_workflow_standards]]):

- Tokenised durations (`var(--motion-duration-*)`) or `MOTION_SPRING_STANDARD`.
- Transform-only animation for layout-adjacent changes.
- A `@media (prefers-reduced-motion: reduce)` cover at the rule or the global level.
- A test covering the animated path (vitest fake-timer for rAF-driven helpers; assert reduced-motion short-circuit).

## Routing and view state

The shell is a single-window app with multiple panes (dashboard, launcher, settings). It is **not** a multi-page web app.

> **Decision:** No router library. Pane navigation is plain React state. The launcher is a controlled overlay; settings is a modal route within the dashboard renderer.

For apps, routing is the app author's concern. Many apps will be effectively single-view; some (database with multiple tabs) will want internal routing. Recommended track: TanStack Router for apps that want one. Required track: none.

## Accessibility and keyboard handling

The shell is keyboard-first (launcher hotkey, navigation between widgets, settings).

> **Decision:** **react-aria** (and react-aria-components where the visual is OK) for non-menu primitives — focus management, dialogs, listboxes, comboboxes, popovers. We don't roll our own keyboard-and-screenreader handling.

This is non-negotiable for the shell. Apps are encouraged to do the same; the SDK provides a re-export.

The designed surface — Tab order, composite arrow-keys, focus traps, focus restoration, `:focus-visible`, Escape stack, F6 region jumps, screen-reader scaffolding, per-app inventory — lives in [61-keyboard-accessibility.md](61-keyboard-accessibility.md). Shortcuts ([24](24-keyboard-shortcuts.md)) are accelerators for actions that must already be reachable by the 61 paths. Ships as the **`KBN` ladder** in [implementation-plan.md](../implementation-plan.md); the `react-aria` swap is `8.9` (🟢 post-v1), the `fancy-menus` swap is `8.8` (🟢 post-v1), v1 ships in-tree primitives against the same call-site contract per [[feedback_avoid_blocking_on_deps]].

## Menus

Menus are a special, first-class UI surface in Brainstorm: the launcher is a command-palette menu, every right-click context menu is a menu, the "More Actions" / "Share" / "Open with…" / "Export to…" intent surfaces are menus, app menus and tray menus are menus, settings selectors are menus.

> **Decision:** **`@react-fancy-menus/core`** is the menu constructor for the shell and (re-exported via the SDK) for apps. One menu engine across the system; one set of accessibility, performance, and visual behaviors.

`fancy-menus` is an in-house React package being developed in parallel (located at `../fancy-menus` in the dev tree, pre-release; will be published as `@react-fancy-menus/core` on npm). The shell pins to a specific version; the SDK re-exports it so apps build menus consistent with the shell.

What we use it for:

- The **launcher** — command-palette pattern (filter chrome + virtualized result list + sub-menus for actions on a selected result).
- **Context menus** — right-click on entities, blocks, selections.
- **Intent menus** — "Open with…", "Export to…", "Share to…", "More Actions" surfaces driven by `intents.suggest` (see [17-interoperability.md](../platform/17-interoperability.md)).
- **App menus** — the menubar/menu surface apps register, where the shell composes the chrome.
- **Tray menus** — for apps with `tray.publish`.
- **In-app menus** — apps importing the SDK get the same menu engine.

What it gives us out of the box (per its README): declarative config, Floating UI positioning, virtualization (`@tanstack/react-virtual`), drag-reorder (`@dnd-kit`), sub-menu stacking, keyboard navigation, persistence, theming. Body kinds: list / grid / form / custom / composed. Rich row vocabulary: item, section, divider, switch, checkbox, select-nav, color, object, participant, add, sortable, chip. Panel kinds: search, monthGrid, emojiGrid, tileGrid, fileDropZone, queryBuilder, slider, katex, qrCode, markdownToolbar.

Many of those map cleanly to Brainstorm primitives: `participant` for member pickers, `object` for entity references, `fileDropZone` for import flows, `queryBuilder` for entity queries.

> **Decision:** the SDK re-exports `@react-fancy-menus/core` so apps don't take a direct dependency. This lets us version-control the menu engine across all apps, hot-fix accessibility issues system-wide, and align theming with `brainstorm-tokens`.

> **Open:** how is the SDK's re-export pinned vs. apps' shipped versions? Likely: SDK pins the major; apps see the pinned API. Tracked as OQ-32 in [11-open-questions.md](../reference/11-open-questions.md).

> **Open:** while `fancy-menus` is pre-release, which body/row/panel kinds will the shell ship leaning on, and which can wait? The shell needs at minimum: list body, item / section / divider / chip rows, search / fileDropZone panels. Tracked as OQ-33.

## Testing

- **Vitest** — unit tests for shell modules and the SDK type-and-runtime package.
- **Playwright** — end-to-end on a built shell binary, automating the dashboard, launcher, and a few representative apps.
- **Yjs property tests** — generate concurrent edit sequences, assert convergence on canonical doc.

> **Decision:** every IPC envelope shape is round-tripped through a property test. The protocol is the most stable contract; we treat it as such.

## Performance budgets (front-end side)

Mirroring the system-wide budgets in [12-shell-architecture.md](12-shell-architecture.md) but tightened to front-end metrics:

| Metric                                               | Target          |
|------------------------------------------------------|-----------------|
| Shell renderer bundle size (gz, minified)            | <270KB          |
| App preload bundle size (br, minified)               | <32KB           |
| Shell bundle parse time                              | <80ms           |
| Dashboard React reconcile per frame (idle)           | 0 commits       |
| Editor keystroke → paint                             | <16ms           |
| `react-yjs` hook subscription cost (single observe)  | <0.1ms          |
| App bundle size guideline (gz, recommended track)    | <250KB          |

Bundle budgets are enforced in CI (`size-limit` or equivalent on every PR). Anything that grows the shell bundle by more than 10KB requires explicit justification.

> **Re-baseline (2026-05-19).** The original `<150KB` target was set against a minified bundle, but `size-limit` had been scoring the *unminified* dev artifact (`electron.vite.config.ts` set `minify: false` for readable error-log stacks). The build now minifies in production only (sourcemaps stay on, so stacks still resolve), and the budgets are scored against the minified output. The shell renderer measures **251KB gz** minified — over the old `<150KB` aspiration because of accumulated feature surface across stages (full dashboard + Settings/Marketplace overlays + SDK surface, no code-splitting yet) — so the enforced ceiling is re-baselined to **270KB** with ~7% headroom. The always-on app preload measures **29KB br** minified (it must inline `@brainstorm/react-yjs` → Yjs + lib0, which the sandboxed preload cannot externalize) and is re-baselined to **32KB**. These are explicit floors, not the design aspiration: code-splitting the renderer and lazy-loading the preload's ydoc transport remain the path back toward the original target and are tracked as a reduction item, not deferred bloat acceptance.

## Recommended library set

Beyond the framework / tooling already covered, the shell and the recommended app track standardize on this small library set so apps don't reinvent and the bundle size stays predictable:

| Concern                         | Library                                | Notes                                                                   |
|---------------------------------|----------------------------------------|-------------------------------------------------------------------------|
| Menus (every menu surface)       | **`@react-fancy-menus/core`**                | Re-exported via SDK. See [04-shell.md](04-shell.md).                    |
| Accessibility / non-menu primitives | **`react-aria` / `react-aria-components`** | Dialogs, listboxes, comboboxes, focus management.                       |
| List virtualization              | **`@tanstack/react-virtual`**          | Already a transitive dep via `fancy-menus`. Used directly by apps that render long entity lists, table views, etc. |
| Drag & drop (lists, kanban)      | **`@dnd-kit/core`** + ecosystem        | Already a transitive dep via `fancy-menus`. Used by the kanban-style app, sortable lists, dashboard reordering. |
| Floating UI (popovers / tooltips)| **`@floating-ui/react`**               | Used internally by `fancy-menus` and `react-aria`; available for app use. |
| Forms                            | **`react-hook-form`** + `zod`          | Optional; for apps with complex forms. Shell does not need it.          |
| Internationalization             | **`@formatjs/intl`** + ICU             | Per [21-localization.md](../platform/21-localization.md).                           |
| Date math                        | **`date-fns`** (modular) or `Temporal` polyfill | Use native `Intl` for *formatting*; `date-fns` for arithmetic.       |
| Styling                          | **`vanilla-extract`** + design tokens  | Per "Styling" section above.                                            |
| Code highlighting                | **`shiki`**                            | For code blocks in editors and viewers; uses VS Code grammars.          |
| Markdown parsing                 | **`unified` / `remark`** ecosystem     | For Markdown export/import (per [17-interoperability.md](../platform/17-interoperability.md)) and search content extraction. |
| PDF rendering                    | **`pdfjs-dist`**                       | Used by the PDF-viewer/editor app.                                      |
| Diagram rendering                | **`mermaid`**                          | One option for the diagram block app; other diagram apps may bring their own. |
| Color manipulation               | **`culori`**                           | Used for vocabulary value colors and theming math.                      |
| Crypto                           | **`@noble/ciphers`** + `@noble/hashes` | Pure-JS, audited, MIT. Used for client-side encryption per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md). |
| Entity ids                       | **`ulid`**                             | Sortable, time-ordered, URL-safe. Used everywhere `ent_…` ids are minted. |
| Vector search runtime            | **`sqlite-vec`** (or `sqlite-vss` per OQ-61) | Per [22-ai-foundations.md](../platform/22-ai-foundations.md), bundled with shell. |
| LLM client                        | Provider-specific official SDKs        | The AI broker normalizes them; apps don't see provider SDKs directly.   |
| Block Protocol                    | **`@blockprotocol/{core,graph,hook,type-system}`** | Per [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md). |
| Lexical                           | **`lexical`** + **`@lexical/react`** + `@lexical/yjs` | Per [07-editing-lexical.md](../editing/07-editing-lexical.md). |
| Yjs                               | **`yjs`** + `y-protocols` + `y-indexeddb` | Per [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md), [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md). |
| Testing                           | **`vitest`** + **`playwright`** + `@vitest/coverage-v8` | Per "Testing" section below.                                            |

> **Decision:** the shell pins exact versions of these libraries; apps inherit them through the SDK where the SDK re-exports (menus, react-yjs, fancy-menus). Apps may bring their own versions of *everything else* (forms, charts, app-specific deps) at their own bundle cost.

## Rust libraries via Node addons

Brainstorm uses **Rust** for a small set of performance- and security-critical paths, exposed to the Node/Electron side via N-API addons (typically built with [napi-rs](https://napi.rs/)).

> **Decision:** Rust appears in v1 only as **library code linked into the shell's Node process** (or worker processes), never as separate spawned-process services. This keeps the deployment story simple — the shell ships native addons per platform, same as it ships `better-sqlite3`. Separate Rust services (sync workers, indexers as standalone binaries) are a v2 consideration if scale demands.

### What's Rust in v1

| Concern                        | Rust crate                       | Why Rust                                                            |
|--------------------------------|----------------------------------|---------------------------------------------------------------------|
| OS keystore access             | **`keyring`** via `@napi-rs/keyring` | Replaces unmaintained `keytar`; identical OS-keystore guarantees on macOS Keychain / Windows DPAPI / Linux Secret Service. See [29-credentials-storage.md](../security/29-credentials-storage.md). |
| Full-text search index         | **Tantivy** via Node bindings (see OQ-128) | 10–50× faster than SQLite FTS5 at large index sizes; better tokenization (real BM25, language-aware analyzers); scales cleanly past 1M documents. Per [18-storage-and-search.md](../data/18-storage-and-search.md). Other knowledge tools have adopted Tantivy for the same reasons. |
| Embedding model runtime        | **`ort`** (ONNX Runtime via Rust) or **`candle`** | The local embedding model (per OQ-62) runs an ONNX or GGUF model. Rust runtimes are 3–10× faster than `onnxruntime-web` (WASM) or `transformers.js`, addressing OQ-105's vector-index-lag concern. |
| Crypto bulk operations         | **`@noble/ciphers`** stays for app-side; bulk shell-side ops can use **`ring`** or **`aes-gcm`** if profiling shows JS is a bottleneck | Pure-JS `@noble` is fast enough for typical use; Rust is reserved for batch decryption when opening large vaults if profiling demands. |

### What's NOT Rust in v1 (and why)

- **The shell's main process and renderers** — JavaScript / React, no change. Rust would force IPC across yet another boundary for hot-path UI work.
- **Yjs** — we use the JS `yjs` package. The Rust port (`yrs`) is faster but having two implementations is a coordination burden; defer to v2 if storage-side compaction or large-doc loading becomes a bottleneck.
- **SQLite** — `better-sqlite3` is fine; SQLite is C, not Rust. No reason to switch.
- **PDF / image / compression** — JS implementations (`pdfjs-dist`, `blueimp-load-image`, `pako`) are fine for v1. If the PDF viewer or image-handling apps hit perf budgets, those individual apps can adopt Rust later.

### Build and distribution

Rust addons are pre-built per-platform via napi-rs's CI templates and shipped as part of the shell bundle. Apps do not need a Rust toolchain to develop against Brainstorm. The shell is the only thing with native dependencies; apps stay pure JS.

> **Open:** v2 — split heavy work into separate Rust binaries (sync worker, indexer) communicating via stdin/stdout JSON or shared memory? Tracked as OQ-129.

## Domain-specific libraries (prior-art audit additions)

An audit against the production dependencies of a comparable local-first knowledge product (per OQ-66, now resolved) surfaced twelve categories we hadn't accounted for. These are added to the recommended set, mostly used by individual apps rather than the shell itself; the shell pins versions only where the SDK re-exports them.

| Concern                          | Library                                | Notes                                                                  |
|----------------------------------|----------------------------------------|------------------------------------------------------------------------|
| HTML sanitization                | **`dompurify`**                        | Required for paste-from-other-apps and rendering any HTML the user didn't write. Re-exported via SDK so apps don't reinvent. |
| Whiteboard / freeform canvas     | **`@excalidraw/excalidraw`**           | The whiteboard layout mode (per [27-layouts.md](27-layouts.md) freeform mode + future whiteboard-designer app). v2 ships the whiteboard-designer app on top of this. |
| Math typesetting                 | **`katex`**                            | Used by `fancy-menus`' `katex` panel and any rich-text-with-math context. |
| Charts and data visualization    | **`d3`** core + selected modules; for the graph viewer specifically `d3-force` + `d3-force-cluster`. | Per-app dependency, not bundled in the shell. The graph viewer app pins it. |
| Phone-number formatting          | **`libphonenumber-js`**                | Used by the `format: phone` modifier on text properties (per [19-properties-and-schemas.md](../data/19-properties-and-schemas.md)). |
| File-type detection              | **`file-type`** + **`read-chunk`**     | Determines MIME of dragged files when creating File entities (per [19-properties-and-schemas.md](../data/19-properties-and-schemas.md)'s File entity). |
| Image processing                 | **`blueimp-load-image`**               | EXIF rotation, thumbnail generation; used by image-handling apps and File entity preview. |
| UI animation                     | **`motion`** (formerly Framer Motion)  | Shell transitions, app-launch animations, fancy-menus-internal where needed. |
| Filename sanitization            | **`sanitize-filename`**                | When creating File entities from arbitrary user-typed names. |
| Disk-space monitoring            | **`check-disk-space`**                 | Powers the Storage settings panel (per [25-settings.md](25-settings.md)) and "vault is full" warnings. |
| Compression (zlib)               | **`pako`**                             | For external-format compatibility (zlib-compressed inputs / outputs); separate from our archive format which uses zstd via `tar`. |
| Diff                              | **`diff`**                             | For AI-suggestion review (accept/reject diffs, per [22-ai-foundations.md](../platform/22-ai-foundations.md)) and provenance visualization. |

### What we explicitly do **not** adopt from the audited prior-art stack

| Library                  | Why we don't                                                                      |
|--------------------------|-----------------------------------------------------------------------------------|
| `mobx`, `mobx-react`     | Already rejected — Yjs is our reactivity system (per "State management" above).   |
| `@sentry/browser`        | Telemetry that leaves the device. Privacy posture is opt-in only (per [22-ai-foundations.md](../platform/22-ai-foundations.md)). |
| `amplitude-js`           | Same — analytics that leaves the device. Not in our v1.                            |
| `react-virtualized`      | Older API. We picked `@tanstack/react-virtual` (in fancy-menus and direct).        |
| `prismjs`                | Less faithful syntax highlighting. We picked `shiki` (real TextMate grammars).     |
| `sha1`                   | Cryptographically broken. We use SHA-256 / BLAKE3 via `@noble/hashes`.             |
| `keytar`                 | Archived by GitHub in 2023. **We use `@napi-rs/keyring`** — the actively-maintained Rust-backed successor — for real OS keystore items (vault master key, identity private key) per [29-credentials-storage.md](../security/29-credentials-storage.md). `safeStorage` is encryption-only over a regular file; not suitable for primary key material. |
| `@electron/remote`       | Discouraged by Electron core. We use `contextBridge` + IPC.                        |
| `electron-store`, `electron-json-storage`, `electron-window-state` | Replaced by our own per-vault settings (per [25-settings.md](25-settings.md)) and shell window manager (per [12-shell-architecture.md](12-shell-architecture.md)). |

## Themes

A **theme** in Brainstorm is a complete **visual-identity bundle**, not just a colour palette. It composes three pieces, each separately swappable:

| Layer        | What it specifies                                                              | Default                          |
|--------------|--------------------------------------------------------------------------------|----------------------------------|
| **Tokens**   | Colour, spacing, typography, motion, radii, shadows, z-layer values.            | Bundled `brainstorm-tokens` package — light / dark / system / print variants. |
| **Icon pack** | The mapping from semantic icon names (`save`, `settings`, `trash`, `entity.note`) to actual SVGs. | Bundled Phosphor pack via shadcn registry (per OQ-71). |
| **Typography** | Font family and scale choices, beyond the size tokens.                         | System sans-serif stack.          |

A theme can mix and match: a user might pick the dark token set + the Phosphor icon pack + a serif typography choice. Or accept the entire shipped "Default Dark" composite.

> **Decision:** Brainstorm ships with **light / dark / system-follows** token sets built-in, **one default icon pack** (Phosphor, installed via the shadcn registry at [shadcn.io/icons/ph](https://www.shadcn.io/icons/ph)), and a **default font stack**. The combinations form the shipped composite themes (`Default Light`, `Default Dark`). Users mix-and-match or install third-party packs.

### Tokens

- The `brainstorm-tokens` package defines the **token namespace**: colour slots (background, surface, accent, text-primary, text-secondary, …), spacing scale, typography scale, motion scale, radii, shadows, z-layer scale. Apps reference tokens, never raw values.
- A **token set** is a concrete value mapping for the namespace. `light`, `dark`, and `system` ship with the shell, plus a special `print` token set for output (see [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md)).
- Custom token sets are user-creatable as entities of type `brainstorm/TokenSet/v1` — user-scoped by default (personal-by-default), promotable to `org` for org-wide brand palettes.
- Active token values are published as CSS custom properties on the shell's root document; renderers inherit. Apps load `@brainstorm/tokens` runtime helpers (`useToken("color.accent")`).

### Icon packs

> **Decision:** apps reference icons **by semantic name** (`<Icon name="save" />`), never by inline SVG. The active icon pack maps the name to actual content. Pack swap is runtime; the same code renders a different visual style.

An **icon pack** is an entity of type `brainstorm/IconPack/v1`. It contains:

```jsonc
{
  "type": "brainstorm/IconPack/v1",
  "properties": {
    "name": "Phosphor",
    "version": "0.300.0",
    "license": "ISC",
    "metadata": {
      "style": "line",                 // line | solid | duotone | colored | hand-drawn
      "weight": "regular"
    },
    "icons": {
      "save":      { "svg": "<svg viewBox=\"0 0 24 24\"...></svg>" },
      "settings":  { "svg": "<svg ...></svg>" },
      "trash":     { "svg": "<svg ...></svg>" },
      "entity.note":     { "svg": "<svg ...></svg>" },
      "entity.task":     { "svg": "<svg ...></svg>" },
      "entity.file":     { "svg": "<svg ...></svg>" },
      "entity.person":   { "svg": "<svg ...></svg>" },
      "...": "..."
    },
    "fallback": "questionmark"          // shown when a name isn't in the pack
  }
}
```

The shell provides:
- A **canonical icon-name registry** — a curated namespace (`save`, `settings`, `entity.<type>`, `vocab.color.<name>`, etc.) every pack should define. Packs that miss names show the pack's `fallback` icon.
- An `<Icon name="save" />` React component (re-exported via SDK) that resolves through the active pack at render time.
- A `useIcon("save")` hook for non-component contexts.
- A pack-resolver that caches SVGs per render.

> **Decision:** the canonical icon-name registry is **shell-curated and versioned**. Adding new canonical names is a shell-release decision. Apps cannot invent new canonical names at runtime, but they can register **app-scoped** names (`io.example.tasks/icon.kanban-column`) that only their own UI references.

Apps that need an icon the registry doesn't include can:
- Request its addition to the canonical registry (preferred for general-purpose icons).
- Use an app-scoped name (`<app-id>/<icon-name>`) and provide its own SVG fallback.
- Inline a one-off SVG (last resort; doesn't follow theme switches).

> **Decision:** **Phosphor** is the default icon pack, installed via the [shadcn icon registry](https://www.shadcn.io/icons/ph) (`npx shadcn add icon`). Phosphor provides ~1,200 icons in six weights (thin / light / regular / bold / fill / duotone) under MIT. The shadcn registry path means individual icons are pulled into our source tree on demand, not as a single fat dependency — tree-shaking is automatic since each icon is its own React component. Resolves OQ-71.

> **Open:** do icon packs need to ship pre-rendered raster fallbacks for very small sizes where SVG hinting is poor? Probably no for v1; revisit if antialiasing is a problem. Tracked as OQ-72.

### Typography

A theme's **typography choice** is a small entity:

```jsonc
{
  "type": "brainstorm/Typography/v1",
  "properties": {
    "name": "Default sans",
    "fonts": {
      "ui":      { "stack": "Inter, system-ui, sans-serif" },
      "body":    { "stack": "Inter, system-ui, sans-serif" },
      "code":    { "stack": "JetBrains Mono, Menlo, monospace" },
      "display": { "stack": "Inter, system-ui, sans-serif" }
    },
    "scale": "default"            // default | compact | comfortable
  }
}
```

System fonts are the default (no shipped binaries; Inter etc. only if available). Custom typography entities can ship as part of a theme bundle.

> **Decision:** Brainstorm does not bundle proprietary font files in v1. Custom-typography entities reference system or user-installed fonts. Apps that need a specific brand font include it as a font asset in their bundle.

### A theme as a composite

A `brainstorm/Theme/v1` entity points at the three pieces:

```jsonc
{
  "type": "brainstorm/Theme/v1",
  "properties": {
    "name": "My Workspace",
    "tokenSet": "ent_tokens_dark_acid",      // entityRef → TokenSet
    "iconPack": "ent_icons_phosphor_solid",  // entityRef → IconPack
    "typography": "ent_typo_serif_reading",  // entityRef → Typography
    "scope": "user"                            // personal-by-default
  }
}
```

This composition is what the user picks in settings. Switching the active theme broadcasts the change; the shell and all apps re-render with the new tokens, icons, and typography simultaneously.

> **Decision (single source of truth for app theming):** sandboxed apps declare **zero** theme values. The shell preload (`packages/shell/src/preload/app-preload.ts`) injects into every app document, in order: (1) the flattened active-theme tokens as a `:root` block, (2) platform window-chrome insets, and (3) one static stylesheet — `packages/shell/src/preload/app-theme.ts` — that owns the alias layer (`--accent`/`--bg`/`--text`/…, each bound to a canonical semantic token, no fallbacks) **and** the shared component styles (the glossy primary button, `.glass*`, the header-icon gloss). An app's `styles.css` keeps only structural rules; its `:root` is just `color-scheme`. Changing a colour or a button is a one-file edit in `app-theme.ts`. This replaced a model where each of the ten first-party apps re-declared its own alias block and button CSS while the shell overlaid gloss on top — four-plus drifted copies (different fallback hexes; aliases pointing at tokens that don't exist, e.g. `--color-state-danger`, `--color-accent-soft`, `--font-family-sans`, so they silently fell back). Apps adding an accent button reuse one of the canonical primary-button class names rather than inventing a new one.

### Lifecycle

- The active theme is a property on a per-user state entity (a small Yjs doc); switching is a write to that entity.
- The change syncs across the user's devices like any entity.
- Apps observe the active theme via SDK hooks; switches don't require reload.
- A **theme-editor app** ships first-party — users compose token sets, browse icon packs, pick typography, save composites.

> **Decision:** the theme model is **stratified**: tokens, icons, and typography are independent entities and independently swappable. A composite Theme entity references all three. This is more flexible than one-monolithic-theme; it lets users like one icon pack across many color variants.

### Distribution

> **Decision:** themes (and their components — TokenSet, IconPack, Typography — individually) are distributed through the **same store and manifest-URL infrastructure as apps**. Same `.brainstorm` package format (with `manifest.kind: "theme"`), same Ed25519 signing, same install / update / remove lifecycle, same catalog channels, same threat-intel feed. See [40-theme-store.md](../apps/40-theme-store.md) for the full spec — including author profiles, catalog-supplied ratings, live preview, validation (no executable code, contrast lint, SVG sanitizer), and the v2 paid-themes posture.

> **Open:** do we expose a "theme manifest" for app authors so they can ship a custom theme alongside an app (e.g. a writing app shipping a sepia/serif theme)? If yes, the trust model: app-focused themes (apply only when this app is focused, requires user accept), or shell-wide (heavier prompt)? Tracked as OQ-67. (Distribution as a standalone theme package is now answered by [40-theme-store.md](../apps/40-theme-store.md); the remaining open question is *app-bundled* themes.)

## What we do **not** use, and why

- **Next.js / Remix / RSC** — server-rendering for a desktop app is meaningless overhead.
- **Webpack** — Vite/Rollup is faster, simpler config, fewer plugins.
- **MobX** — covered above; redundant with Yjs.
- **Redux / RTK** — covered above; Yjs is the event-sourced store.
- **styled-components / emotion** — runtime CSS-in-JS overhead we don't need.
- **Storybook** — overkill for a shell with ~30 components. A short-lived 8.T gallery was added in May 2026 and removed shortly after; dev pages and Playwright specs cover the same ground without the dependency surface.
- **i18n libraries** — defer; Brainstorm v1 is English-only (see OQ-21).

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- OQ-19: revisit framework if shell perf becomes the bottleneck (deferred decision).
- OQ-20: dev vs. prod build distribution.
- OQ-21: internationalization timeline.
