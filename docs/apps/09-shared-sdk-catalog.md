# Shared SDK component catalog

`@brainstorm/sdk` is the reusable component + logic library every Brainstorm app builds on. This is its catalog: **what already exists, what it does, and when to reach for it.** [`08-app-sdk.md`](08-app-sdk.md) is the *runtime contract* (manifest, capabilities, host services); this doc is the *library* of UI components, view primitives, and shared logic you compose an app out of.

Brainstorm is an app-development framework. First-party apps and third-party developers build against the **same** component library — so the bar is: if two apps need the same thing, it lives here exactly once.

## The reuse rule (non-negotiable)

> **Any UI element or piece of logic that exists in ≥2 apps is ONE shared SDK module.** Reuse it; never reimplement it.

Operationally:

1. **Before writing any component, helper, list row, popover, formatter, picker, icon, or data-access layer — search this catalog and `packages/sdk/package.json`'s `exports` map.** If it exists, import it.
2. **At copy two, extract.** The first time you'd copy-paste something from one app into another (a searchbar, a list row, a date formatter, a repository factory), stop and move it to the SDK instead. Per [`35-code-conventions.md`](../foundations/35-code-conventions.md): *no abstraction without two uses; three is a hard ceiling.* This catalog exists because that rule was repeatedly missed — `panelToggleIcon` shipped 8×, the searchbar shipped 7× with three different bug states, `frustum.ts` and `language-detect.ts` were each written twice verbatim.
3. **Fix it once.** A bug in a shared component is fixed in one place and every app inherits the fix. A bug in a copy-pasted component is fixed N times and drifts.
4. **A PR that re-implements something already in this catalog (or copy-pastes UI chrome between apps instead of extracting) is rejected.**

When something genuinely *isn't* shareable yet, see [What is deliberately not shared](#what-is-deliberately-not-shared) — over-extraction is also a smell.

## How an app consumes the SDK

Canonical wiring (verified against `apps/notes`, `apps/database`, `apps/journal`):

```ts
// 1. Theme CSS first — before any DOM/React mount. (per project_apps_inherit_shell_theme)
import "@brainstorm/sdk/app-theme.css";
import "@brainstorm/editor/editor.css";        // only if using the Lexical editor

// 2. Persisted panel widths before first paint (avoids layout flash).
import { applyPersistedPanelWidth } from "@brainstorm/sdk/resizable";
applyPersistedPanelWidth({ storageKey: "notes:nav-width", cssVar: "--nav-w", defaultWidth: 260 });

// 3. Per-subpath named imports — never deep-reach into src, never default-import.
import { Icon, IconName } from "@brainstorm/sdk/icon";
import { createNavHistory, NavButtons } from "@brainstorm/sdk/nav-history";
import { Searchbar } from "@brainstorm/sdk/searchbar";
```

Rules:

- **Always import the theme CSS** (`@brainstorm/sdk/app-theme.css`) and **any component's CSS subpath** it documents (e.g. `@brainstorm/sdk/searchbar/searchbar.css`). CSS ships as explicit subpath exports because side-effect imports get tree-shaken (see [`project_workspace_css_subpath_export`]). Component CSS lives in the SDK, **not** in an app's `styles.css`.
- **Import from the documented subpath**, not the barrel and not a relative `../src` path. The `exports` map is the public surface.
- `react` is a peer dependency. Even DOM-only apps depend on `react` because the SDK's React components share their DOM twins' code.
- Every component below ships in one of three flavours: **React** (`<Component>`), **DOM twin** (`createXElement` / `attachX` — for vanilla-DOM apps), or **pure** (no React, no DOM). Pick by your app's host.

## Catalog

> Import path is relative to `@brainstorm/sdk`. Flavour: **R** = React component, **D** = DOM helper, **P** = pure logic/types.

### UI components & chrome

| Module | Import | Flavour | What it is / when to use |
|---|---|---|---|
| Popover | `/popover` | R + D | The shared glass dialog/popover primitive (backdrop, panel, header, close, footer, escape, focus). **Every** dialog/popover uses this — no per-app dialog chrome. |
| Searchbar | `/searchbar` (+ `/searchbar/searchbar.css`) | R + D | Search input with result filtering. The one searchbar for every list surface. |
| Object menu | `/object-menu` | R + D | The cross-app object context menu (Open → Pin/Unpin → extra → Remove); `buildObjectMenuItems`, `openObjectMenu`, `ObjectMenuTrigger`, `ObjectMenuMoreButton`. |
| Select menu | `/select-menu` (+ `/select-menu.css`) | R + D | The native-`<select>` replacement: a `.bs-select` trigger (current label + caret) opening its option list through the fancy-menus runtime, check on the chosen option, `group` for `<optgroup>`-style sections. `<SelectMenu>` (React), `createSelectMenu` (DOM), `openSelectMenu` (imperative opener for an existing button). No raw `<select>` in app or shell UI. |
| Panel toggle | `/panel-toggle` | R + D | Sidebar/panel collapse-expand button + icon. |
| Checkbox | `/checkbox` (+ `/checkbox/checkbox.css`) | R + D | Painted checkbox over a hidden native input; indeterminate support. `<Checkbox>` (React) and `createCheckbox` (DOM) share one chrome — no app hand-rolls a native `<input type="checkbox">`. |
| Count badge | `/count-badge` (+ `/count-badge.css`) | R + D | The ONE numeric count pill (`.bs-count-badge`) trailing sidebar rows / list filters / board lanes / tabs. `<CountBadge count tone max>` (React) and `createCountBadge` (DOM) share one chrome; `tone` → `Neutral` (resting grey) or `Accent` (active/unread), `max` caps the display (`99+`). No app hand-rolls a `__count` pill. |
| Empty state | `/empty-state` (+ `/empty-state.css`) | R | The ONE "nothing here yet" surface (`.bs-empty-state`): glyph + title + optional hint + optional action (a CTA). `<EmptyState icon title hint action tone>`; `tone` → `Hero` (large accent-tinted glyph chip — a full-pane first-impression empty) or `Compact` (small dim glyph — an empty nested inside other chrome). No app hand-rolls a placeholder. |
| Icon picker | `/icon-picker` | R | Emoji / Phosphor / upload icon chooser (skin-tone, tint). |
| Cover picker | `/cover-picker` | R | Object-cover chooser (image/gradient/color, focal point, upload). |
| Share dialog | `/share-dialog` | R | Collab-C5 multi-user share surface: member list (roster) + role badges, add-by-pasted-invite-code with a role, revoke (Owner-only), and mint-your-own-invite-code. Drives `services.sharing` + `services.roster`; takes translated `labels`. A consuming app must declare the scarce `sharing.share` cap. CSS at `/share-dialog.css`. |
| Color picker | `/color-picker` (+ `/color-picker.css`) | D | Rich hex colour picker (2D saturation×value area + hue track + hex field) mounted as a fancy-menus custom-body surface; `openColorPicker({ anchor, initial, onPreview, onSelect, onCancel })` opens it anchored to a swatch — the themed replacement for `<input type="color">`. Plus `hsvToHex`/`hexToHsv`/`normalizeHex`. |
| Picker host | `/picker-host` | R | Lazy portal that mounts IconPicker/CoverPicker into a DOM app. |
| Properties panel | `/properties-panel` (+ `.css`) | R | The properties inspector chrome (content-only `.bs-props__inner`; the **app owns the container** — resizable pane or glass overlay). See [`project_sdk_shared_properties_panel`]. |
| Dictionary editor | `/property-ui/dictionary-editor` | R | Vocabulary editor (reorderable list, sort modes, per-user persistence). |

### Property system

| Module | Import | Flavour | What it is |
|---|---|---|---|
| Property UI | `/property-ui` (+ `/property-ui/cells.css`) | R | Cell registry `getCell(valueType, view)` (the deeper shared primitive used in Lexical blocks + panels + grids), `PropertyStore`/`DictionaryStore`, `PropertiesProvider`, `useProperty`/`useDictionary`. **Editing cells (shipped):** Text Pill/Plain (+Url/Email/Phone validation) · Text **Multiline** (auto-grow) · Tag/TagList select with inline **"Create '<value>'"** · Number Pill/Plain · **ProgressBar** · **Rating** (stars) · Boolean **Checkbox** + **Toggle** · Date Pill/Plain/**Calendar** (month grid + natural-language) + **Relative** · EntityRef Link/Chip/Card picker · File drop. Every editable trigger carries a hover affordance (discoverability); resting cells fall back to a faint placeholder. *Pending:* RichText Block/Inline, File Viewer/Thumbnail. |
| Property UI (pure) | `/property-ui/pure` | P | `formatDate/Number/Scalar`, `parseScalar`, dictionary algebra, `DictionarySortMode` — no React. |
| Property keys/validate/preset | `.` (barrel) | P | `properties-keys`, `properties-validate` (coercion/guards), `defForPreset` (preset → PropertyDef), inline-property-form logic. |

### Entity rendering

| Module | Import | Flavour | What it is |
|---|---|---|---|
| Entity icon | `/entity-icon` | D | `createEntityIconElement` — emoji/image/pack icon for an object. The non-React twin of `<EntityIcon>`. |
| Tab identity | `/tab-identity` | D | `publishTabIdentity({ title, icon })` — labels the shell tab strip + OS window with the open object's name and icon (`document.title` + favicon; codec in `@brainstorm/sdk-types`). Call on every open-object change. |
| Entity cover | `/entity-cover` | R + D | Object cover banner (image/gradient/color, 16:9, id-seeded fallback). |
| Icon | `/icon` | R + D | `Icon` / `createIconElement` + `IconName` enum + `setActiveIconPack`. **All chrome glyphs route through here** — never hand-roll inline SVG (see [`feedback_no_inline_glyphs`]). |
| Open entity | `.` (barrel) | P | `openEntity`, `quickLookEntity` — cross-app navigation intents. |

### View primitives — date / calendar

| Module | Import | Flavour | What it is |
|---|---|---|---|
| Date grid | `/date-grid` | P | Week/month grid math, `daysBetween`, `dateKey`, `buildMonthGrid`. |
| Calendar | `/calendar` (+ `.css`) | D | `createMonthGrid`, `createMiniCalendar`, `openCalendarPopover` (anchored single-date picker — the themed replacement for a native `<input type="date">`). |
| Date pager | `/date-pager` | R + D | "today + prev + next" navigation cluster. |
| Date buckets | `/date-buckets` | P | `dateBucket` / `groupByDateBucket` — group timestamps into Today/Yesterday/Last 7/Last 30/Month (recency lists). |
| Reminder schedule | `/reminder-schedule` | P | Minutes-before-start reminder offsets (`normalizeReminders` / `toggleReminder` / presets) + the fire-exactly-once in-app scheduler (`dueRemindersInWindow` / `createReminderScheduler`). Calendar event reminders + Tasks due/scheduled alerts ride it. |

### Keyboard, navigation & a11y

| Module | Import | Flavour | What it is |
|---|---|---|---|
| Shortcut | `/shortcut` | R + D | `useShortcut` / `attachShortcut` + chord parser + suppression registry. **All keyboard handling goes through here — never raw `e.key`.** |
| Nav history | `/nav-history` | R + D | In-app back/forward: `createNavHistory` + `NavButtons` / `createNavButtons`. THE in-app nav for every app (see [`project_nav_history_primitive`]). |
| Last viewed | `/last-viewed` | P | `rememberLastViewed(settings, id)` / `recallLastViewed(settings)` — "reopen what I was looking at". Records the open entity id on selection-change and restores it at boot (when launch isn't an explicit `open-entity`). Backed by the per-device `settings` service, so it's per-vault + per-app-namespaced + non-synced (correct: "where I was" is device-local) — NOT `localStorage` (apps have no vault id, so localStorage would bleed ids across vaults). Best-effort; the caller validates the id still resolves before navigating. Used by books, notes, contacts, code-editor. |
| Find/replace | `/find-replace` | R + D | `createFindController`, `<FindBar>` / `attachFindBar`, `createDomTextSearchProvider`. Model-based in-document find/replace; app provides a `TextSearchProvider`. |
| A11y | `/a11y` | P + R | Composite keyboard (list/tree/tablist), virtual-grid nav (`useVirtualGridNav` — activedescendant arrow cursor for row-virtualized grids), focus-trap stack, escape-handler stack, typeahead, live-region announce, focus-visible hook. |

### Layout & sandboxing

| Module | Import | Flavour | What it is |
|---|---|---|---|
| Resizable | `/resizable` | D | `attachResizable` + `applyPersistedPanelWidth` — drag-handle panel resize with localStorage persistence + animated collapse. |
| Layout resolver | `/layout-resolver` | P | `resolveLayout(target, candidates)` — layered scope precedence (entity > collection > type > user > org > app-default > shell). |
| Block frame | `/block-frame`, `/block-frame/inner` | D | iframe sandbox constants + `createBlockFrame` + postMessage transport for Block Protocol embeds. |
| Block registry | `/block-registry` | P/R | `createBlockRendererRegistry` — BP block id → React renderer, cached, with fallback. |
| Block mount | `/block-mount` | R | `BpBlockMount` — the inline mount seam every BP block plugs into. |

### Cross-app logic & infrastructure

| Module | Import | Flavour | What it is |
|---|---|---|---|
| i18n | `/i18n` | P | `createT()` type-safe localisation wrapper + canonical English labels for SDK surfaces. Each app passes its own manifest. |
| Search filter | `.` (barrel) | P | `orderByHitRank` result ranking. |
| Collections | `.` (barrel) | P | `effectiveMembers` — resolve a List/Collection's members. |
| Perf | `/perf` | P | `time` / `timeAsync` / `mark` / `measure` + ring-buffer subscribers; no-op safe. |
| Motion | `/motion` | P | Spring/duration/easing tokens, `prefersReducedMotion`, `tweenNumber` — the canonical motion language. |
| Export file | `/export-file` | D | `suggestedFilename`, `textToBytes`, `svgToPng`, `requestSaveBytes` — generic file save/serialise adapters. |
| Entity export | `/entity-export` | D | `buildEntityExportItems` / `runEntityExport` (IE-8) — the generic "Export…" object-menu affordance for any entity: serialises properties to Markdown/CSV/JSON via the injected `export.serializeEntities` port, saves through `requestSaveBytes` + the shared export popover. Content-agnostic (works off entity ids), so apps without a bespoke exporter (Database, Tasks, …) adopt it with no per-app export code. Notes/Graph/Whiteboard keep their content-specific exporters. |
| PDF engine | `/pdf-engine` | D | THE one pdf.js stack (extracted from Preview 9.20.5 when Books 9.21.5 became consumer two): `loadPdfEngine` (lazy `import("pdfjs-dist")` + worker wiring — consumers stay code-split), `openPdfDocument(bytes)`, `renderPdfPage(page, canvas, scale, dpr)`, `terminatePdfWorker`, plus the pure zoom/fit math (`clampZoom`, `fitScale`, `PDF_*_ZOOM`). Structural `PdfEngineDocument`/`PdfEnginePage` types — no pdf.js d.ts dependency leaks. |
| Runtime / bridge / handshake | `.` (barrel) | P | `Bridge` types, `encodeHandshake`/`decodeHandshake`, `newMessageId`, errors. |
| SDK types | `.` (barrel) | P | `export type * from @brainstorm/sdk-types`; `defaultIconForType`, `GENERIC_TYPE_ICON`. |

### Data, storage & domain logic

| Module | Import | Flavour | What it is |
|---|---|---|---|
| Storage repository | `/storage-repository` | P | Repository plumbing over `storage.kv` + the shared entities service: `createKvRepository` / `createEntityRepository` (single-entity), building blocks `listParsedRows` / `putRow` / `deleteRow` / `queryEntityRows` / `upsertEntity` / `deleteEntity` for bespoke multi-type repos, and `importKvRows` (kv→entities migration). Each caller passes its codec + a `log`. |
| In-memory entities | `/in-memory-entities` | P | The canonical client-side `EntityRow` / `LinkRow` vault shape + `emptyVault` + `readPropertyPath` (dotted-path reader). |
| System entities | `/system-entities` | P | `SystemEntityType` const + `SYSTEM_ENTITY_TYPES` set + `isSystemEntityType(type)` — the canonical "plumbing, not user content" classification (BrowsingSession, ListView, Trigger, Workflow, WorkflowRun, …). Presentation-only: type-enumerating surfaces (Graph SHOW filter, sidebars) group/dim these; never changes query semantics (F-212). |
| Predicate eval | `/predicate-eval` | P | THE evaluation stack for the Database filter language + `ListSource` membership: `evaluatePredicate` (full `PropertyPredicate` truth-table incl. `$prop`/`$now`/`$relativeDate`), `evaluateSource`, `applyMemberOverrides`, relative-date resolver. Shared by the Database renderer AND the shell's `vaultEntities.querySource` (9.12.3) — semantics cannot drift. |
| Codec helpers | `/codec-helpers` | P | Leaf coercion guards for persistence codecs: `nullableString`, `nullableNumber`, `coerceEnum`. |
| Sanitize text | `/sanitize-text` | P | `sanitizeInlineText(raw, maxLength)` — hardening for untrusted single-line text before persist/publish (strips C0/C1 controls + DEL, zero-width, bidi-override marks, BOM; collapses whitespace; clamps). Consumers: editor peer-presence names, Browser clip-to-vault page titles. |
| Spellcheck | `/spellcheck` | P | `TextSurfaceKind` (Prose / Code) + `spellcheckForSurface(kind)` — the one place every editable surface decides its `spellcheck` attribute (B11.16b). Prose surfaces opt in, code opts out. The shell enables Chromium's spellchecker per app session (B11.16a, `main/web/spellcheck.ts`); this is the renderer opt-in. Consumers: editor `contentEditable`, property text cells, Whiteboard sticky text, code-editor textarea. |
| Spellcheck menu | `/spellcheck-menu` | R + D | `mountSpellcheckMenuFromWindow(labels)` (or `mountSpellcheckMenu(bridge, labels)`) + pure `buildSpellMenuItems` (B11.16c / B11.17a). Renders Chromium's right-click suggestions for a misspelled word through fancy-menus (Electron has no native menu); picking one calls `runtime.spellcheck.replace`, plus **Add to dictionary** (`addWord`, capability-gated) and **Ignore** (`ignoreWord`, session-only) rows. Mount once per prose app after `mountMenuHost`. No-op when the shell exposes no spellcheck bridge. |
| Peer presence | `/peer-presence` | P | Presence-publishing core (extracted from `@brainstorm/editor` at copy two — Whiteboard 9.17.19 is the second consumer; the editor re-exports): `PEER_COLORS` / `peerColor(seed)` (deterministic per-client cursor hue), `sanitizePeerName`, `localPresenceName()` (bounded, hardened display name), `localPresence(clientId)`. |
| Selection | `/selection` | P | Multi-select math: `SelectionModifier`, `computeRange` (anchor→target slice), `toggleId`, `modifierFromEvent`. Apps keep their own state container. |
| Object DnD | `/object-dnd` | C | Cross-app drag (DND-3, [platform/65](../platform/65-object-selection-and-cross-app-dnd.md)). **Drop:** `useDropTarget({accepts, dropEffectFor, onDrop})` → one drop handler over BOTH transports — native intra-renderer HTML5 (`dropProps` spread on the zone, reads `application/vnd.brainstorm.entity+json`) AND the shell-mediated cross-app session (`CrossAppDropRegistry` over the preload-forwarded `CROSS_APP_*` events). Target decides the meaning (least-destructive default); payload arrives on drop only (hover leaks kinds+point). **Source:** `useDragSource({getItems, onDropped})` → `dragHandleProps.onPointerDown` on a drag handle drives the shell session with pointer events (threshold-gated begin → rAF-coalesced `dnd.move` → drop/cancel; gesture logic in the renderer-free `DragMachine`). **Semantics:** `DropSemantic` enum (reference/transclude/add-membership/set-property/move/copy/compose) + `effectForSemantic` (→ cursor `DropEffect`) + `leastDestructive` (safe default). Wire helpers (`serialize/parseObjectDragPayload`, `setObjectDragData`, `readObjectDragData`) live in `/entity-drag` (single payload home). Notes' `entity-drop-plugin` is the reference drop target; `composer-context`'s `useComposerObjectDrop` is the reference *additive* adoption (drop an object → pin it as context). |
| Language detect | `/language-detect` | P | `CodeLanguage` enum + `detectLanguage(input, { fallback })` (path/MIME/shebang) + `languageForExtension`/`Mime`/`Shebang` + `languageDisplayLabel`. |
| Frustum cull | `/frustum-cull` | P | Canvas-renderer visibility math: `computeViewBounds`, `nodeInView`, `segmentInView`, `viewportUsable`, `CameraTransform`/`ViewBounds`. |
| Date formatters | `/date-formatters` | P | `formatRelativeDate(epochMs, now, labels, options?)` — "Today"/weekday/locale month-day with a configurable weekday window + style. |
| Recurrence labels | `/recurrence-labels` | P | `buildRecurrenceLabels(translate)` — builds a `RecurrenceSummaryLabels` pack from a suffix-translator (locale weekday/month names baked in). |
| Y.Doc resolver accessor | `@brainstorm/react-yjs` | P | `createYDocResolverAccessor(getRuntime)` — memoised renderer-side `getYDocResolverApi` over `entities.loadDoc/applyDoc/closeDoc` + `ydoc.onRemote`; null until the doc surface exists. (Lives in react-yjs, beside `createYDocResolver`.) |
| Live entity lists | `@brainstorm/react-yjs` | P | **The sanctioned way to read a live entity list** (the async counterpart to `useYMap`/`useYText`, which bind a single entity's body). `useVaultEntities(service)` → live `{entities, links}`; `useLiveEntities(source, {initial, equals})` over any `{list, onChange?}` source (a repo or the vault service). Wraps the pure, framework-free `createQueryStore` (trailing-coalesced reload + version-aware short-circuit + ref-counted bind/teardown + out-of-order-load guard) so imperative apps can drive the same core via `subscribe`/`getSnapshot` while migrating. Comparators: `vaultSnapshotEquals`, `shallowArrayEquals`. **Do NOT hand-roll `vaultEntities.onChange → list() → setState`** — that re-implements this per app (the drift that caused the bookmarks scroll-blink + per-app coalescers). |

Plus, on existing modules: `@brainstorm/sdk/icon` adds `createGlyphElement(spec, opts)` (the shared inline-SVG builder for app-local chrome glyphs), and `@brainstorm/sdk/object-menu` adds `bindDelegatedObjectMenu` + `createMoreButton` (one delegated listener pair instead of per-row triggers).

### Rich-text editor save contract (`@brainstorm/editor`)

Every `<BrainstormEditor>` consumer (Notes, Journal, Tasks, Bookmarks, …) saves in **two layers** — get both right or the app *looks* unsaved:

1. **Rich body → Y.Doc → disk.** Automatic: binding via `useYDoc(entityId)` makes the resolver persist every update through `services.entities.applyDoc`. No app code.
2. **Denormalised mirrors → entity `properties`.** What list rows, calendar/week previews, word counts, `updatedAt` and local search read. The app owns this, via:

| Export | Flavour | What it is |
|---|---|---|
| `AutosavePlugin` | React | The ONE interaction-gated change hook. Calls `onChange(SerializedEditorState)` only after a real `KEY_DOWN/PASTE/CUT/DROP` (never the mount-settle / hydration echo — the `notes_autosave_swallows_first_edit` invariant) and trailing-debounces. **Never use a raw `OnChangePlugin` to persist** — it fires on mount and writes spuriously. |
| `denormalizeBody(state)` | P | `{ title, snippet }` from a `SerializedEditorState` — the title (first TitleNode text) + a clipped plain-text body snippet. Call it inside the `AutosavePlugin` callback; route the result to your store. |
| `extractTitle` / `extractPlainText` / `clipPlainText` / `DEFAULT_SNIPPET_LENGTH` | P | The building blocks `denormalizeBody` composes — node-class agnostic (any inline node with a string `label` is treated as a chip). |

Per-app rule: write only the mirrors that have a reader. Notes writes `title`+`body`. **Journal writes only `body`** — its `title` is the canonical ISO date and `projectJournalEntries` drops any entry whose title isn't a date, so a body heading must never overwrite it. Tasks writes neither (the body is a free-form notes field with no row/preview reading it back) but still mounts the gated `AutosavePlugin`.

## What is deliberately not shared

Over-extraction is also a smell. These stay per-app on purpose — do **not** try to unify them:

- **Properties-panel *wrappers*.** The `PropertiesPanel` chrome is shared; the per-app adapter that maps an entity's `values` to rows and writes changes back is app-specific and correct.
- **App sidebars and content lists.** Calendar's mini-calendar+source filters, Tasks' projects+archived tree, Files' folder tree, Notes' note list — these are different UI schemas. They share *primitives* (virtualization, DnD, list rows) but not algorithms.
- **App bootstrap / state machines / event wiring** in each `app.tsx`.
- **i18n manifests** (the strings) — only the `createT` machinery and cross-app label helpers are shared.
- **Domain codecs** (URL normalization, recurrence rules, node-kind dispatch) — only the primitive helpers (`nullableString`, enum coercion) are shared.
- **The pixi `unsafe-eval` import** — a one-line idiom per renderer (see [`feedback_pixi_unsafe_eval_in_sandbox`]).

Rule of thumb: extract the **algorithm / chrome / primitive**; keep the **app-specific schema / adapter / domain rule** local.

## Extraction backlog

From the 2026-05-30 cross-app duplication audit. All rows below shipped in the same pass; each landed with unit tests + workspace typecheck. The two UI rows (icons, object-menu) preserve rendered markup by construction — a Playwright screenshot pass against the running shell is the recommended belt-and-braces check before release.

| Module | Consuming apps | ~LOC saved | Status |
|---|---|---|---|
| `@brainstorm/sdk/in-memory-entities` (EntityRow/LinkRow + `readPropertyPath`) | database, graph | 40 | ✓ done |
| `@brainstorm/sdk/frustum-cull` | graph, whiteboard | 150 | ✓ done |
| `@brainstorm/sdk/language-detect` (`CodeLanguage`, `detectLanguage`) | code-editor, preview | 270 | ✓ done |
| `@brainstorm/sdk/selection` (range/toggle/modifier math) | database, files | 80 | ✓ done |
| `@brainstorm/sdk/date-formatters` (`formatRelativeDate`) | calendar, tasks | 65 | ✓ done |
| `@brainstorm/sdk/recurrence-labels` (`buildRecurrenceLabels`) | calendar, tasks | 110 | ✓ done |
| `@brainstorm/sdk/codec-helpers` (`nullableString/Number`, `coerceEnum`) | bookmarks, calendar, tasks, whiteboard | 40 | ✓ done |
| `@brainstorm/sdk/storage-repository` (KV + entities repo factories + building blocks + `importKvRows`) | bookmarks, calendar, tasks, whiteboard | 620 | ✓ done |
| `@brainstorm/react-yjs` `createYDocResolverAccessor` (lives in react-yjs — its own `createYDocResolver`'s home, avoids a new SDK→react-yjs dep) | code-editor, journal, tasks, notes | 180 | ✓ done |
| `@brainstorm/sdk/icon` `createGlyphElement` (shared inline-SVG builder; apps keep their own glyph paths/metrics) | calendar, database, graph, journal, preview, tasks, whiteboard | 140 | ✓ done |
| `@brainstorm/sdk/object-menu` `bindDelegatedObjectMenu` + `createMoreButton` | bookmarks, journal, tasks | 240 | ✓ done |
| `@brainstorm/sdk/empty-state` (`<EmptyState>` glyph+title+hint+action, `Hero`/`Compact` tone) | automations, preview, books, contacts, code-editor, notes, mailbox, chat, agent | 230 | ✓ done (2026-06-24) — screenshot-verified (sessions 338 / 338b / 339b); the canonical center-pane empty across all apps |

**Follow-ups (the primitive now exists; adoption is a separate, behaviour-changing pass):**

- **code-editor / files / notes** still use per-row `attachObjectMenuTrigger` / `object-menu-context`. They can adopt the shared `bindDelegatedObjectMenu` to drop from O(N) row listeners to one — an optimisation, not a code-dedup, so it ships on its own with screenshot verification.
- **Chevron stopgaps → registry.** Calendar/Journal/Preview's hand-drawn prev/next chevrons predate the SDK gaining `IconName.CaretLeft/CaretRight`; they now route through the shared `createGlyphElement` builder but still carry their own paths. Swapping them to the registry carets is a pixel change — do it with a screenshot diff. Likewise Tasks' Inbox/Upcoming and Database's view-kind glyphs are candidates to graduate into the generated `IconName` registry (via `build:glyphs`) once someone runs the generator.

## Storybook

Once the catalog stabilises, every component above gets a Storybook story (states, props, keyboard path, RTL/dark variants) and this doc links each row to its story. _(Planned — link to be added.)_
