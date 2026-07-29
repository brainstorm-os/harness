# 49 — Self-hosting

Brainstorm is a knowledge product modeled as a desktop OS. The dogfooding goal is that **Brainstorm hosts the project-management surface for building Brainstorm**: design docs read in Notes, iterations tracked in Tasks, plan views explored in Database, OQ↔iteration relationships explored in Graph, and the MCP server is the data plane glueing all of it to the assistant that does the keystrokes. **Source-code editing stays in the host OS** — Brainstorm does not bridge sandboxed app capabilities to the raw filesystem (see SH-11/12 rejection below).

This is the long arc. It does not land in one stage; pieces of it are already on the per-stage plans. This doc captures the meta-goal — *why* we self-host and *what the path looks like* — and tracks the cross-cutting "Self-hosting" iteration ladder.

## Why self-host

1. **Forcing function for app quality.** When the team's own daily-driver workflow runs on Tasks / Database / Notes / Files / Code-editor, every rough edge gets seen, named, and fixed faster than synthetic dogfood.
2. **The MCP server is already the project's structured projection.** Per [implementation-plan §Dev MCP server](../implementation-plan.md), iterations 0.10–0.12 turn `implementation-plan.md` and `11-open-questions.md` into queryable resources + write tools. Once the assistant edits the plan via `plan.update_iteration`, the data-plane half is done.
3. **The renderer half closes the loop.** Once Brainstorm apps consume the same plan / OQ / coverage / size / capability data the MCP server projects, contributors stop alt-tabbing between the markdown source, the assistant, and the editor — the whole loop sits inside one window.
4. **Acid test for the SDK + capability model.** A real development workflow that *uses* the SDK (cross-app intents, shared property model, vault entities, the file protocol) is a stronger validation than the bundled demo dataset.

## Scope and non-goals

**In scope (v1 self-hosting):**

- The MCP server exposes plan / OQ / coverage / size / capability / keyboard / health state as resources + tools, and is the only sanctioned editor of the plan + OQ ledger (per 0.12).
- A real Brainstorm vault, opened with the repo path bound, surfaces the same project state as first-party entities (`Iteration/v1`, `OpenQuestion/v1`, `Stage/v1`, `DesignDoc/v1`) the existing apps already render.
- The Code-editor app (iteration 9.7) edits **vault-resident** `CodeFile/v1` entities — snippets, configs, REPL fragments stored inside the vault. No source-tree access in v1.
- The Tasks app's "implementation plan" project is the real plan, not a demo fixture.

**Out of scope (deferred, or never):**

- Running the Electron dev build *from inside* a Brainstorm window. Brainstorm is the IDE for editing the code + browsing the data; the actual `bun run dev` shell process still runs on the host OS.
- A bespoke Brainstorm-only git client. Git interaction stays at the shell prompt + the assistant's Bash tool until the Code-editor app's source-control panel lands (post-v1).
- Replacing the design docs with an "in-Brainstorm wiki." Markdown is still the source of truth (per [implementation-plan §Dev MCP server](../implementation-plan.md)); Brainstorm renders / queries / cross-links it, but does not own it.

> **Sideload-install position (AppForge-1, 2026-07-29):** installing user-chosen content — a local bundle folder or a `.brainstorm` file — is a **privileged shell action behind a user gesture** (dashboard-only IPC driving the OS file dialog, stamped `InstallOrigin.LocalFile`) and does **not** revise the app-sandbox/filesystem boundary: apps still cannot reach the installer or the filesystem; only the shell reads the chosen bundle, and the result is quarantined as an unsigned/local install (advisory in v1).

> **Self-hosted-install note (v2):** the [`DocsPack/v1`](../platform/60-developer-docs.md) distribution mechanism (the v2 upgrade path for the in-shell Help center) interacts with self-hosting in two predictable ways. First, every shell binary embeds a **bootstrap** `DocsPack` at build time — a self-hosted Brainstorm with no network egress configured still has working developer docs + Help content forever (just frozen at the binary's build commit). Second, when network egress is available, the auto-update check uses the catalog-fetch path; a self-hosted install can **pin a `DocsPack` version**, point at a **private catalog origin** (consistent with how third-party app catalogs already federate), or **disable the auto-check entirely** via Privacy → Network. In all three cases the Help reader degrades gracefully — there is no "online required" failure mode for reading docs.

## Three arms

### Arm A — MCP server as data plane

Already on the plan as iterations 0.10–0.12 of Stage 0 (see [implementation-plan §Dev MCP server](../implementation-plan.md)). Status: **0.10 ✓ DONE**; 0.11–0.12 pending. This arm is the structured projection of the markdown source-of-truth: every iteration / OQ / coverage / size / capability / keyboard signal is reachable through MCP resources and tools.

Specific additions this doc reserves on top of the existing 0.11–0.12 surface:

- **`audit.test_run`** — runs `bun run test --reporter=json` and reports `{ totalFiles, totalTests, passed, failed, failingFiles[] }`. Foundation for the stage-boundary audit's stability arm.
- **`audit.typecheck`** — runs `bun run typecheck`, parses output to `{ ok, errors[] }`.
- **`audit.lint`** — runs `bun run lint`, returns `{ ok, errors[] }`.
- **`plan.list_iterations({ stage?, status? })`** — search-friendly companion to the existing `plan://iteration/<id>` resource.
- **`oq.list({ stage?, status? })`** — already named in the §Dev MCP server roadmap; restated here as a self-hosting prerequisite.

### Arm B — Brainstorm apps as the development UI

Three new first-party entity types land at the vault level so existing apps render real project state without bespoke chrome:

| Entity                  | Owner               | Surfaces it appears in                                                                 |
|-------------------------|---------------------|-----------------------------------------------------------------------------------------|
| `brainstorm/Iteration/v1` | Self-hosting track   | Tasks (project "Implementation plan"), Database (List → Grid / Board / Timeline)        |
| `brainstorm/OpenQuestion/v1` | Self-hosting track | Database (List → Grid / Board grouped by status), Graph (subjects + decision edges)     |
| `brainstorm/Stage/v1`     | Self-hosting track   | Database, Graph (stage → iteration → OQ chain)                                          |
| `brainstorm/DesignDoc/v1` | Self-hosting track   | Notes (read-only render with cross-doc `@`-mentions), Database, Files (real file paths) |

Seeding path (gated on Stage 9.3 entities service):

1. The MCP server's `vault.seed_demo` (0.10, **landed**) grows a `BrainstormProject` scope: parses `implementation-plan.md` + `11-open-questions.md` + the docs index into the four entity shapes above and writes them into the vault's per-app KV files via `vault-entities-service`.
2. Apps that already render typed entities (Tasks, Database, Graph) pick up the new types via their existing manifest-declared `entities.read:*` capabilities — no app code changes needed beyond updating the demo project to point at the real iterations.
3. ~~A new shell-side service `dev-repo` (sandboxed read/write access to the repo root, gated on a `BRAINSTORM_DEV_REPO` env var) lets Files + Code-editor browse + open + edit repo files.~~ **Rejected (2026-05-14)** as an overreach: bridging sandboxed app capabilities to raw filesystem access mixes the vault threat model with the source-tree threat model. The self-hosting goal is met by the seeding strategy alone — the data apps render typed entities sourced from the plan / OQs / docs; the actual source tree is edited via the host OS shell / editor as before.

### Arm C — the v0.1.0 release as a live product-management system

Arm B proved the *data path* (plan → typed entities → Tasks/Database/Notes). Arm C makes the result an **actual product-management system for shipping Brainstorm 0.1.0**, not a flat dump of plan rows. The bar: a contributor opens the vault and sees the release the way a PM tool would show it — a dated release, a roadmap, epics, a backlog with live statuses, a dependency graph, a dev journal — and *every first-party app earns its place in that workflow*.

#### Release anchor

One vault-level constant anchors everything:

- **Release:** Brainstorm **v0.1.0**
- **Target date:** **2026-09-01** (`RELEASE_TARGET_DATE`, a single exported constant — never re-typed)

This is the only hand-set date. Every other date is *derived* so the roadmap stays honest as the plan moves.

#### Canonical model (extends `BrainstormProjectEntities`)

Two PM-spine entity types join the existing four. They are built by the same pure builder; no app invents its own truth.

| Entity | Cardinality | Derived from | Key fields |
|--------|-------------|--------------|------------|
| `brainstorm/Release/v1` | exactly 1 | "What v1 means" / "does NOT include" in `implementation-plan.md` | `version`, `targetDate`, `status`, `scopeIncludes[]`, `scopeExcludes[]`, `stageIds[]`, `milestoneIds[]` |
| `brainstorm/Milestone/v1` | one per stage-gate + one GA | stage list + the release date | `releaseId`, `stageId`, `targetDate`, `status`, `summary` |

**Schedule derivation (pure, deterministic):** done stages take a past `targetDate` from the last completion date among their iterations (`completedAt`); the remaining stages are spread evenly across the window `[today … RELEASE_TARGET_DATE]`; a final **GA milestone** sits exactly on `RELEASE_TARGET_DATE`. This is the planning function — it is exactly what a PM tool does when you set a release date and have unstarted epics. It is one tested pure function (`deriveReleaseSchedule`), so the dates change *only* when the plan changes.

#### Links

On top of the existing `Iteration→Stage`, `Iteration→OQ` edges:

- `Stage → in-release → Release`
- `Milestone → in-release → Release`
- `Stage → gated-by → Milestone`

#### All apps, each with a real job

"We need all apps to be used" is a hard requirement of this arm, not a nice-to-have. Each app is a *projection* of the one canonical model — the seeder owns no per-app truth:

| App | Its job in the release workflow | What it projects |
|-----|---------------------------------|------------------|
| **Tasks** | The work tracker / backlog | Iterations → `Task/v1` (live `statusKey`, `completedAt`, `dueAt` from the stage's milestone date), Stages → `Project/v1`, the Release as the pinned umbrella project |
| **Database** | Analytical views over the backlog | One `List/v1` over `Task/v1` with Board-by-stage, Board-by-status, Timeline (roadmap to 2026-09-01), Calendar; plus an OpenQuestion list (board by status) and a DesignDoc gallery |
| **Graph** | The dependency / decision map | A `system` `Graph/v1` + `GraphView/v1` over Release→Milestone→Stage→Iteration→OQ→DesignDoc (the four self-hosting types + the two new ones projected into the vault snapshot — closes **SH-9**) |
| **Calendar** | The release timeline | Each Milestone → all-day `Event/v1` on its `targetDate`; the v0.1.0 **GA** as the marquee event on 2026-09-01; Task `dueAt`s appear automatically via the cross-app date surface |
| **Journal** | The engineering log | One daily Note per real activity date (grouped by iteration `completedAt` / OQ resolution): "what shipped, what resolved" — the honest dev diary, regenerated from the plan |
| **Whiteboard** | The roadmap canvas | A "v0.1.0 Roadmap" board: a Frame per stage, embedded Release/Milestone nodes, stage→stage→release edges, sticky notes for the v1 scope vs non-goals |
| **Notes** | Design corpus + release hub | Every design doc as a Note (existing SH-10) + a top-level **"Brainstorm 0.1.0 — Release Plan"** hub note with `@`-mentions into stages/milestones |
| **Files** | The browsable design corpus | A `Folder/v1` tree mirroring `docs/` (foundations / shell / data / security / platform / reference / apps) with DesignDoc entities as leaves |
| **Bookmarks** | External research the design anchors on | A curated `Bookmark/v1` set (Block Protocol, Yjs, Lexical, CRDT, Electron security, Phosphor) tagged by the subsystem that cites them |
| **Code-editor** | Architectural reference snippets | A few vault-resident `CodeFile/v1` touchstones (the IPC envelope shape, the capability check, the seed schedule constant) — read-only, no source-tree access (SH-11/12 stays rejected) |
| **Preview** | Quick-look of release artifacts | No entities (it is an opener) — exercised via the `open` intent on DesignDoc markdown + the icon art; covered by the open ladder, asserted not separately seeded |

#### Sync-with-documentation invariant

The whole point: **the docs are the database; the apps are the projection.** The seeder re-runs on every shell boot with stable ids and idempotent merge. So the loop is: the assistant edits `implementation-plan.md` / `11-open-questions.md` via the MCP server (`plan.update_iteration`, `plan.mark_oq_resolved`) → next boot the Tasks status flips, the Journal gains a dated entry, the Calendar/Graph/Database/Whiteboard re-derive. No app state is hand-authored; user edits to *non-seeded* keys are always preserved by the merge.

## Iteration ladder

Numbered SH-N. Each iteration is one PR, ships with tests, updates the implementation-plan + table in the same turn. Iterations are mostly independent of the per-stage plans except where called out.

| Iter   | What lands                                                                                                                                                                                                  | Depends on    | Status                  |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|-------------------------|
| SH-1   | `audit.test_run` MCP tool — runs vitest with `--reporter=json`, reports `{ totalFiles, totalTests, passed, failed, failingFiles[] }`. Tests over a captured JSON fixture.                                  | 0.10          | **✓ DONE (2026-05-14)** |
| SH-2   | `audit.typecheck` + `audit.lint` MCP tools — parse `tsc --noEmit` + `biome check .` output to `{ ok, errors[] }`. Round out the read-side health surface alongside `audit.test_run` + `coverage.check` + `size.check`. | SH-1          | **✓ DONE (2026-05-14)** |
| SH-3   | `plan.list_iterations` + `oq.list` MCP tools — search-friendly companions to the existing `plan://iteration/<id>` + `oq://<id>` resources. Filter by stage / status.                                       | 0.10          | **✓ DONE (2026-05-14)** |
| SH-4   | Plan + OQ write tools — `plan.update_iteration` + `plan.mark_oq_resolved`. This is 0.12 from the original Dev MCP server roadmap; restated as a self-hosting iteration because it gates Arm B.            | SH-2, SH-3    | **✓ DONE (2026-05-14)** |
| SH-5   | Vault entity types: `Iteration/v1` + `OpenQuestion/v1` + `Stage/v1` + `DesignDoc/v1` registered in `sdk-types` with JSON schemas, validators, and frozen enums.                                            | SH-4          | **✓ DONE (2026-05-14)** |
| SH-6   | `vault.seed_demo` MCP tool grows a `BrainstormProject` scope that writes the four entity types into vault KV from real `implementation-plan.md` + OQ ledger + docs index.                                 | SH-5          | **✓ DONE (2026-05-14)** |
| SH-7   | Tasks app's "Implementation plan" demo project replaced by the seeded real plan. Same renderer, real data.                                                                                                | SH-6          | **✓ DONE (2026-05-14)** |
| SH-8   | Database app ships a "Project" list with three default views: `By stage` (board, group by stage), `By status` (board, group by status), `Timeline` (timeline, span by iteration window).                  | SH-6          | **✓ DONE (2026-05-14)** |
| SH-9a  | Shell-side `vault-entities-service` adapter for `Task/v1` + `Project/v1` rows from `<vault>/data/apps/io.brainstorm.tasks/kv.json`. Each task with a `projectId` emits an `in-project` link so the snapshot carries the project tree. Storage-write broadcast generalised from notes-only to "any vault-entity write", so Database / Files / Graph all live-update on Tasks edits. | SH-6, SH-7    | **✓ DONE (2026-05-14)** — Database app's seeded "Implementation Plan" list (which `byType`-filters on `brainstorm/Task/v1`) now resolves to real rows; Files app shows the same rows under the vault root; +12 service tests + 5 broadcast tests. |
| SH-9   | Graph app subjects: `Iteration`, `OpenQuestion`, `Stage`, `DesignDoc`. Edges from existing cross-doc + iteration→OQ + stage→iteration relationships.                                                       | SH-6, SH-9a   | **✓ DONE (2026-05-17) — superseded by SH-18** (snapshot projection + seeded plan-structure pattern). |
| SH-10  | Notes app renders `DesignDoc/v1` entities as read-only markdown; `@`-mentions across docs resolve to the same entity ids the Database / Graph apps use.                                                   | SH-6          | **✓ DONE (2026-05-14)** (Note rows written from real docs; cross-doc `@`-mentions deferred to a later iteration) |
| SH-11  | Shell-side `dev-repo` service                                                                  | —             | **❌ REJECTED (2026-05-14)** — overreach. Mixing sandboxed app capabilities with raw filesystem access muddies the security model the rest of the shell has been built around. Goal is met by seeding (SH-6..SH-10). |
| SH-12  | Files app picks up the `dev-repo` source                                                       | SH-11         | **❌ REJECTED (2026-05-14)** — depends on SH-11.                                                                                                                                                                       |
| SH-13  | Code-editor app — vault-resident `CodeFile/v1` only (no source-tree access)                    | 9.2           | **scaffold ✓ DONE (2026-05-14)** — `apps/code-editor/` with manifest declaring `CodeFile/v1` (vault-resident; v1 has no source-tree access — see SH-11/12 rejection above) + open intent for 12 source-code MIMEs; pure helpers `languageForExtension` / `languageForMime` / `languageForShebang` / `resolveLanguage` covering 30+ extensions + special filenames + path-stripped shebang interpreters; `offsetToLineColumn` / `lineColumnToOffset` round-trip + `countLines`; readiness placeholder renderer. Real renderer lands when 9.2 brainstorm-editor is live. |
| SH-14  | Code-editor inline reads from the MCP server: hover an iteration id (`9.13.1.5`) → cite the plan resource; hover an `OQ-N` → cite the OQ resource. Cross-cutting MCP-resource consumer in the editor.     | SH-13         | **✓ DONE (2026-05-18)** — `citation-index.ts` + `citation-scan.ts` pure keystones (resolve buffer tokens against the vault-projected `Iteration/v1` / `OpenQuestion/v1` ledger; match set built from index keys so only real codes resolve, no version/date false-positives) + a caret-preserving right-side References inspector that opens the cited entity via the shared `openEntity` intent. Inline hover lands with the real editor at 9.7.2 over the same keystones. +27 tests. **SH ladder complete.** |
| SH-15  | **Release anchor + canonical PM spine.** `RELEASE_TARGET_DATE = 2026-09-01` constant; `Release/v1` + `Milestone/v1` added to `BrainstormProjectEntities`; `deriveReleaseSchedule` pure scheduler; `Stage→in-release→Release`, `Milestone→in-release→Release`, `Stage→gated-by→Milestone` links. sdk-types registration + validators + property tests on the scheduler (monotonic, GA on the constant, deterministic). | SH-6          | **✓ DONE (2026-05-17)** — `release-schedule.ts` + sdk-types `Release/v1`/`Milestone/v1` + scope parser + shell projection + links; +12 scheduler tests, +1 projection test. |
| SH-16  | **Tasks app upgraded to a real backlog.** Iterations carry live `statusKey` + `completedAt` from the plan and `dueAt` from the owning stage's milestone date; the Release becomes the pinned umbrella `Project/v1`; status flips on the next boot after `plan.update_iteration`. | SH-15, SH-7   | **✓ DONE (2026-05-17)** — `mapPlanToTasksApp` takes milestones+release; `proj-release` umbrella + stage/iteration `dueAt` + project `milestoneAt`; +4 tests. |
| SH-17  | **Database release views.** Extend the seeded list set: OpenQuestion list (board by status) + DesignDoc gallery alongside the existing plan list; Timeline view bounded by `RELEASE_TARGET_DATE`. | SH-15, SH-8   | **✓ DONE (2026-05-17)** — 3 lists (plan/OQ/docs), 7 views; Timeline now a created→`dueAt` roadmap span bounded by the GA milestone; tests updated +4. |
| SH-18  | **Graph closes SH-9.** Project the four self-hosting types + `Release/v1` + `Milestone/v1` and their links into the vault snapshot; seed a `system` `Graph/v1` + `GraphView/v1` ("Plan structure", Full, colour-by-type). Supersedes the old SH-9 row. | SH-15, SH-9a  | **✓ DONE (2026-05-17)** — `plan-to-graph.ts` seeds `graph:state` with the 6-subject / 5-edge plan-structure pattern (snapshot projection landed in SH-15); +6 tests incl. an `apps/graph` enum drift guard. |
| SH-19  | **Calendar = release timeline.** `plan-to-calendar` mapper: Milestones → all-day `Event/v1` on `targetDate`, GA marquee event on 2026-09-01, seeded Month `CalendarView/v1`. | SH-15         | **✓ DONE (2026-05-17)** — `plan-to-calendar.ts`; all-day milestone Events (GA = marquee) under `event:`; rows round-trip the real `apps/calendar` codec; +5 tests. (No fabricated `CalendarView/v1`: the app keeps view-kind state outside kv — Events are the surface, same call as the Graph seed.) |
| SH-20  | **Journal = engineering log.** `plan-to-journal` mapper: group iterations/OQs by real completion date → one daily Note per active date (`note:journal-YYYY-MM-DD`) summarising what shipped/resolved. | SH-15, SH-10  | **✓ DONE (2026-05-17)** — `plan-to-journal.ts`; dated `note:journal-*` entries (exact ISO title) in the Notes keyspace; rows project back through the real `apps/journal` logic; +5 tests. |
| SH-21  | **Whiteboard = roadmap canvas.** `plan-to-whiteboard` mapper: "v0.1.0 Roadmap" `Whiteboard/v1` — Frame per stage, embedded Release/Milestone nodes, stage→stage→release `WhiteboardEdge/v1`, scope/non-goal sticky notes. | SH-15         | **✓ DONE (2026-05-17)** — `plan-to-whiteboard.ts`; roadmap board + edges round-trip the real `apps/whiteboard` codec; +5 tests. |
| SH-22  | **Files = design corpus tree.** `plan-to-files` mapper: `Folder/v1` tree mirroring `docs/` subdirs with DesignDoc entities as leaves. | SH-10         | **✓ DONE (2026-05-17)** — `plan-to-files.ts` + **root fix**: the seeder now builds real `DesignDoc/v1` entities (was `designDocs: []`, so the Database docs gallery + Graph `D` subject were empty too); `folder:` projection in `kv-entities-scan`; tree verified through the real `apps/files` `buildVaultFileTree`; +5 tests. |
| SH-23  | **Bookmarks = external research.** `plan-to-bookmarks` mapper: curated `Bookmark/v1` set (Block Protocol, Yjs, Lexical, CRDT, Electron security, Phosphor) tagged by citing subsystem. | SH-6          | **✓ DONE (2026-05-17)** — `plan-to-bookmarks.ts`; 10 curated `bookmark:` rows that round-trip the real `apps/bookmarks` codec; +3 tests. |
| SH-24  | **Code-editor reference snippets.** `plan-to-codefiles` mapper: a few read-only vault-resident `CodeFile/v1` architectural touchstones. | SH-13, SH-15  | **✓ DONE (2026-05-17)** — `plan-to-codefiles.ts`; 3 `code-file:` touchstones (IPC envelope / fail-closed cap check / release anchor) projected as `CodeFile/v1`, round-trip the real `apps/code-editor` projection; +4 tests. |
| SH-25  | **Notes release hub.** Top-level "Brainstorm 0.1.0 — Release Plan" hub Note with `@`-mentions resolving to seeded Stage/Milestone entity ids. | SH-15, SH-10  | **✓ DONE (2026-05-17)** — `plan-to-hub.ts`; `note:release-hub` with Release/Stage/Milestone mentions that resolve through the real shell `extract-note-references` walker; +3 tests. |
| SH-26  | **End-to-end self-host audit.** Boot a clean vault, assert every first-party app surfaces the release (Preview via an `open`-intent assertion on a DesignDoc + art asset), the round-trip byte-stability test covers all new mappers, and a single `docs/_review/<date>-self-host-audit.md` records the pass. | SH-15..SH-25  | **✓ DONE (2026-05-17)** — `self-host-audit.test.ts` seeds the real repo plan, asserts all 8 app surfaces + byte-stable round-trip + Preview wiring; the historical audit file under `docs/_review/` was pruned 2026-05-23. |

> **SH-27 — seed-quality fix (2026-05-18, user-reported).** Seeding the real plan into a release vault surfaced four defects the synthetic-fixture tests missed: (a) **garbled titles** (`0.1 — — ✅`) — most shipped iterations are condensed in the plan to a one-line log pointer; the real title lives in `implementation-log.md`. New pure `parse-log.ts` (`parseImplementationLog`) recovers title + ship date; `brainstorm-project.ts` resolves title = log → meaningful plan first-line → stage heading. (b) **Timeline smear** — every iteration shared one created→stage-milestone span. New `deriveIterationSchedule` ranks iterations globally in plan order: shipped work cascades across a fixed past epoch, the backlog across the road to GA, real log dates anchor done bars (per-iteration `scheduledStart/End`; Tasks maps createdAt=start, dueAt=end). (c) **`unknown` status junk column** — added `IterationStatus.Todo`; unstarted → `todo` (added to the `plan-properties` STATUS vocab), no catch-all `unknown`. (d) **Graph painted nothing** — the matcher is `O(|entities|^|subjects|)` and SH-18 seeded a *six-subject* join → cost-cap explosion; `plan-to-graph.ts` now seeds ONE linear `Plan` subject over the six types, `showUnmatched:true` (snapshot links paint the clusters). Also: Database `compileView` gained a `labelFor` group-key resolver so a board grouped by `projectId` shows the project name, not `proj-0`; and the on-shell-start `seedDemoProject` hook was **removed** — the content seed is manual-only via `tools/mcp-server/src/seed/seed-cli.ts` (run from `tools/mcp-server/`). (e) **Graph "blink"** — the first paint was the unfiltered all-nodes graph because the persisted pattern only reconciled a frame after `loadVaultEntities`. `loadPersistedState` was split into `readPersistedRaw` (fetch+validate) + a two-pass `applyPersistedState` around the vault load: before (first scene build already filtered) and after (cutoff/pinned/camera restore against the populated scene). The old vault-first guard comment was stale — `loadVaultEntities` only resets `cutoffAt`, restored by the second pass. **Tests:** +12 mcp-server (`parse-log` 8, `deriveIterationSchedule` 4), reworked `plan-to-graph`/`iteration-to-task`/`parse-plan` assertions, +1 `compile-view`; 300 mcp-server green + 193 graph green; typecheck + biome clean on all touched files; Database + Graph app bundles rebuilt.

> **SH-1 through SH-4 are pure MCP-server work — additive read tools then the gated write tools.** They unblock everything downstream and do not depend on any in-flight Stage 9 work. SH-5 onward depends on the entities service (Stage 9.3) for real persistence; until then the seeded demo path (per [[preview-drop-pattern]]) is the bridge.

## Conventions specific to this track

- Every Self-hosting iteration updates `docs/implementation-plan.md` + `docs/implementation-plan-table.md` in the same turn — same workflow rule as every other iteration ([keep-plan-current](../implementation-plan.md#keep-this-plan-current)).
- The MCP server is the only sanctioned editor of the plan + OQ ledger from SH-4 onward (restating 0.12). Raw markdown edits to those two files are PR-rejected unless the change is non-structural prose in a non-iteration section.
- ~~Capability surface additions in SH-11 (`dev-repo.read`, `dev-repo.write`)~~ — n/a, see SH-11 rejection above.
- Brainstorm-UI iterations (SH-7..SH-14) follow the per-stage workflow standards — tests, screenshots, keyboard path, screen-reader path, perf numbers if a budget moves.

## How to know we're done (for v1)

- A contributor can open Brainstorm, see Brainstorm **0.1.0** as a real release: a dated release anchored on 2026-09-01, a roadmap, epics, a live backlog, a dependency graph, and an engineering journal — and run their PR workflow alongside the host editor: read the design doc in Notes, find their iteration in Tasks, observe Database's "By status" board flip the row to ✓ DONE when the assistant calls `plan.update_iteration` (source editing itself stays in the host OS).
- **Every first-party app earns its place** (Arm C): Tasks, Database, Graph, Calendar, Journal, Whiteboard, Notes, Files, Bookmarks, Code-editor all surface the release; Preview is exercised via an `open`-intent assertion. The SH-26 audit gates this.
- The MCP server is the only path that writes to `implementation-plan.md` or `11-open-questions.md`; grep for raw `Edit` against those two files in the recent PR log returns zero.
- The `vault.seed_demo` `BrainstormProject` scope round-trips: re-running it on a clean vault produces the same entity set the prior run produced, byte-for-byte — **every Arm C mapper included**.
- Editing the plan via the MCP server and rebooting re-derives every app's view with **no hand-authored app state**; user edits to non-seeded keys survive the merge.

This doc supersedes the inline §Dev MCP server roadmap in [implementation-plan.md](../implementation-plan.md) where they overlap: the iteration ladder above is canonical; the §Dev MCP server section stays as the architecture note.
