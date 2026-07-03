# Implementation plan — at-a-glance table

Scannable remaining-work companion to [implementation-plan.md](implementation-plan.md) (authoritative for pending/in-flight detail). **This file lists only what is NOT done** — one row per open iteration (🟡/⚪/◑), completed (✅) excluded, future work included. This is the same set the dev-vault Tasks app projects (Today + Upcoming), generated from the plan's open bullets via `tools/gen-open-iterations.ts`. Completed narrative + test counts live in [implementation-log.md](implementation-log.md); ✅ history lives in the plan's own bullets + git.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · ❌ rejected · 🔴 release-blocking · 🟢 GA-only (not beta-blocking)

**Last updated:** 2026-07-03 (pm) — **`11.3` first-run model-download progress UX** ([shell PR #89](https://github.com/brainstorm-os/shell/pull/89) — the silent ~130 MB embedding-model download now shows a live Idle→Downloading(byte %)→Ready status in Settings → Search, via a NonBlocking `ThreadsafeFunction` progress callback + a pure status reducer on `search:stats`; SHA256 pin unchanged; +29 tests). 11.3 stays 🟡 for its one remaining tail: real-Electron ANN bench (incremental vector maintenance #86 + packaging #84 + this download UX now all done). **`9.18.9` Captured-image offline assets** ([shell PR #88](https://github.com/brainstorm-os/shell/pull/88) — readable capture's remote article images now sub-fetch through the favicon/cover guard chain into the encrypted asset store + rewrite to `brainstorm://asset/` so they render + work offline; bounded 40 imgs · 5 MiB · conc 4). Earlier this session, all merged: **`12.17`** a11y `accent.onFill` ([shell PR #83](https://github.com/brainstorm-os/shell/pull/83) — the theme-contrast ratchet is now green with **zero deferrals**; completes the accent a11y story with 12.16), the **`11.3` embedding packaging tail** ([shell PR #84](https://github.com/brainstorm-os/shell/pull/84) — `ort` statically links ONNX Runtime, so `native-embed` ships like the crypto `.node` across all 6 targets; 11.3 stays 🟡 for its GA polish tails: first-run-download UX, incremental vector maintenance, ANN bench), and **`B11.10` Templates COMPLETE** ([shell PR #85](https://github.com/brainstorm-os/shell/pull/85) — editor snippet insert + save-as-template; snippets store as serialized-blocks JSON in `prototype.snippet`, no headless Yjs binding). Earlier this session: `Asset-B4` byte-plane transport (🟡, dogfood-gated; split `Asset-B4b`/`B4c`), `11.3` core, `12.16`. **Open: 68 — Beta-blocking 0 · GA 32 · v2/post-v2 36.** **🎉 Public beta shipped 2026-06-29 (`v0.1.5`)** — signed + notarized macOS/Windows/Linux + in-app auto-update; **no beta-blockers remain**, everything open is GA polish or the v2 commercial stack. Per-iteration history + test counts live in [implementation-log.md](implementation-log.md) + git.

Per-iteration history + test counts live in [implementation-log.md](implementation-log.md) + git. Regenerate the tables below after any status change with `bun tools/gen-open-iterations.ts`.

---

## Beta release roadmap (G0 → G4)

Detail in [implementation-plan.md §Release plan & roadmap](implementation-plan.md#release-plan--roadmap). G0–G2 ✅ (G2 cleared 2026-05-25; `10.9b` validated `eaa5e8e`).

| Gate                    | State | What's left to exit                                                                                                                                                    |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G0 De-risk**          | ✅     | —                                                                                                                                                                      |
| **G1 Spine**            | ✅     | —                                                                                                                                                                      |
| **G2 Sync**             | ✅     | 🟢 tails only: `10.10` wrap-bundling · `10.11` routing-token rotation                                                                                                  |
| **G3 Quality + freeze** | 🟡    | `12.4` a11y ladder ✅ COMPLETE 2026-06-15 (grid cell-nav+edit the last rung) · bug burn-down · feature freeze; budgets hold                                             |
| **G4 Beta ship**        | 🟡    | RC cut + beta-exit checklist · beta on `2026-09-01` (`13.3` ✅ Linux CI · `13.10` ✅ packaged-upgrade path landed 2026-06-15 — the last beta-blocking 🔴 hardening rung) |

---

## Remaining iterations (NOT done) — complete list

Every open iteration, **bucketed by phase** (Beta-blocking → GA → v2/post-v2) then plan section, per the roadmap rules in [implementation-plan.md §Release plan & roadmap](implementation-plan.md#release-plan--roadmap). **Phase rules:** *Beta* = on the beta-exit checklist (gates `2026-09-01`); *GA* = v1 but post-beta (the GA definition-of-done); *v2* = explicitly post-v1 (the v1-excludes set: app-store distribution, auto-update, paid/commercial, multi-user). Classification is computed in `tools/gen-open-iterations.ts` (`phaseFor`) so it regenerates with the table. A bundled id (e.g. `9.12.3/.4/.5/…`) is one plan bullet covering several rungs.

## Beta — Beta-blocking (must clear 2026-09-01) (0)

✅ **Cleared 2026-06-29 — public beta v0.1.5 shipped.** `13.11` (code-signing + notarisation) and `13.12` (in-app auto-update) both landed: signed + notarized macOS (Apple silicon + Intel), Windows + Linux, published to GitHub Releases with a working in-app updater. No beta-blocking iterations remain. *(GA residual, not beta-blocking: Windows EV signing `DQ-13.1-B`.)*

## GA — GA (v1, post-beta) (32)

### AI broker & vector / hybrid search *(Stage 11; lexical half shipped early as Shell 9.22)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `11.0b` | Tantivy comparison: wire a Tantivy BenchEngine adapter against the same harness, re-run t… | ⚪ pending |  |
| `11.3` | local embedding model → semantic search on. Core landed *(2026-07-03, shell PR #79)*: 11.… | 🟡 in flight | — |

### Localization, accessibility & perf budgets *(Stage 12)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `12.15` | app-renderer locale propagation + per-app translation packs (the explicitly-deferred "Sti… | 🟡 in flight |  |

### Native acceleration *(NAPI-RS, post-beta perf track)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `NAPI-P` | performance-bottleneck profiling sweep (gates NAPI-4 + any new native target). Goal: *con… | ⚪ pending |  |

### Encrypted attachment sync

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Asset-B4` | lazy fetch + eager thumbnail tier: materialise bytes on access (not eagerly on restore);… | 🟡 in flight | Asset-B3 ✅ |
| `Asset-B4b` | eager thumbnail tier *(split from Asset-B4, 2026-07-03)*: a small always-synced tier (thu… | ⚪ pending | Asset-B4 |
| `Asset-B4c` | cold-first-fetch metadata reconstruction *(split from Asset-B4, 2026-07-03)*: a device th… | ⚪ pending | Asset-B4 |
| `Asset-B5` | restore integration: the cold-device RestoreEngine (10.14) re-materialises asset chunks f… | ⚪ pending | Asset-B4 |
| `Asset-B6` | cross-device / offline-peer asset GC: conservative mark-and-sweep against converged refs,… | ⚪ pending | Asset-B3 (node |

### Window manager, menus & shortcuts *(Stage 6)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `6.11` | (post-v1) | ⚪ pending |  |

### Network broker & readable extraction *(doc 38 + 58

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Net-3` | live-DOM feeder: web.capture (apps/54-web-browser.md) hands the partitioned WebContentsVi… | ⚪ pending | Net-2 + Browser-1 |

### Import, export & migration *(doc [45](platform/45-import-export.md)

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `IE-7` | one-shot authenticated-API Source (Notion API import, OQ-243): the non-file Source stage… | ⚪ pending | Connector framework ✅ + IE-6 |

### Graph *(9.13)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.13.10e` | live bucketed event stream (entities.subscribe) | ⚪ pending | dep-gated |

### Bookmarks *(9.18)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.18.8` | Highlights & annotations on captured content + a per-bookmark annotation list. *(gated: n… | ⚪ pending | needs editor text-anchoring on the captured… |
| `9.18.9` | Captured-image offline assets: sub-fetch article images through the favicon/cover guard chain, store encrypted, rewrite `src`→`brainstorm://asset/<id>` so they render + work offline. | ✅ 2026-07-03 (#88) | — |

### Form-designer *(Stage 8.10)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `8.10.2` | editing canvas: drag-to-reorder cells, stacked↔grid switch, live Layout/v1 mutation with… | 🟡 in flight | 8.3 |
| `8.10.3` | group nesting + chrome-cell palette (actionBar/breadcrumb/meta/windowControls/entityHeade… | ⚪ pending | 8.4 (resolves OQ-90 |
| `8.10.4` | conditional visibility rules per cell (reuse the Database filter-language predicate, not… | ⚪ pending |  |
| `8.10.5` | save-as-Layout/v1 entity + apply-to-type + install-time validateAppLayouts (8.5) round-tr… | 🟡 in flight | 8.5 |

### Automations *(Stage 11b)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `11b.8` | HTTP step + Webhook trigger (network ingress). HTTP step landed 2026-06-16 (PR #148) over… | 🟡 in flight | a no-op → any user-authored workflow become… |
| `11b.10` | FileWatch / Startup triggers | ⚪ pending | 9.10 (Files host |

### Mailbox *(group I)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Mailbox-5` | JMAP transport + OAuth2 (Gmail / Microsoft 365) via the connector OAuth broker | 🟡 in flight | Connector-2 ✅ (cleared |
| `Mailbox-6` | threading (OQ-MB-3 ✅ | ⚪ pending | 9.10 |
| `Mailbox-8` | Email/v1 entity-event trigger source for Automations + AI-triage step | ⚪ pending | 11b + Stage 11 |
| `Mailbox-9` | official Google OAuth client registration (pre-release, org/process task | ⚪ pending | for |

### Web Browser *(group I)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Browser-5` | clip-to-vault affordance landed *(2026-06-09, F-161)*: per-tab "Save to vault" button in… | ◑ preview-drop | Net-2 |
| `Browser-6` | downloads → Files host service | ⚪ pending | 9.10 |
| `Browser-8` | agentic surface: web.browse:read-only sub-cap for autonomous loops (OQ-WV-5) + AI summari… | ⚪ pending | Stage 11 / 11b |

### Connector framework *(group I)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Connector-6` | webhook-in connectors (network ingress) | ⚪ pending | Net-1 + 11b.8 |
| `Connector-7` | Mailbox as the reference connector (proves the contract end-to-end on the socket-exceptio… | ⚪ pending | Mailbox-2 |

### Object selection & cross-app drag-and-drop *(group I

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `DND-6` | keyboard / a11y twins: "Move to… / Add to… / Link to…" target-picker commands (object men… | ◑ preview-drop | DND-1 (selection |

### Object read-only lock (fleet, cross-app)

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Lock-3` | retro-fill the workflow bar *(partly paid by shell PR #18 lock-rollout-fixes/5ffda45, 202… | ⚪ pending | none (cleanup |

## v2 — v2 / post-v2 (commercial · multi-user · marketplace) (36)

### Collaboration layer

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Collab-C5` | sharing UX (share dialog, member list with roles + revoke, presence) + the authorization… | 🟡 in flight |  |
| `Collab-C6` | human-facing user identity (resolves OQ-ID-1; design in 16-identity-orgs-encryption.md §S… | 🟡 in flight |  |
| `14.5` | Paddle Plus/Pro (MoR checkout, tax handling) | ⚪ pending |  |
| `14.6` | Settings → Billing UI (plan picker, change/cancel, invoices, self-serve refund). Control-… | ◑ preview-drop |  |
| `14.7` | quota enforcement (storage attachments + sync egress metering). Metering ingestion + per-… | ◑ preview-drop |  |
| `14.8` | per-app AI quota + bundled credit accounting. | ⚪ pending |  |
| `14.9` | org subscription mechanics (seats, invites, roles, transfer). | ⚪ pending |  |
| `14.10` | / 14.11 | ⚪ pending |  |
| `14.14` | discount verification (education / non-profit / OSS-maintainer). | ⚪ pending |  |
| `14.15` | compliance (GDPR export/delete, tax tooling, SOC 2 kickoff, DPA). | ⚪ pending |  |
| `14.16` | cross-platform subscription-lifecycle E2E. | ⚪ pending |  |
| `14.19` | wallet.db + WalletService skeleton (capability-gated, no UI). | ⚪ pending |  |
| `14.20` | wallet subscription payment methods + state. | ⚪ pending |  |
| `14.21` | wallet subscription receipts/invoices/tax/export. | ⚪ pending |  |
| `14.22` | developer portal v1 (free listings only; sovereign-key sign-in; analytics; threat-intel/a… | ⚪ pending |  |
| `14.23` | new free content kinds (LayoutPack/WallpaperPack/LocalePack/WorkflowPack/ShortcutPack) | ⚪ pending |  |
| `14.24` | Plugin kind slot reservation (free, runtime not yet wired). | ⚪ pending |  |
| `14.24a` | admin-panel client wiring (shell feedback view + shell-only FeedbackService + opt-in cras… | ⚪ pending |  |
| `DocsHub-1` | *(v2, early | ⚪ pending |  |
| `DocsHub-2` | *(v2, after 14.17 + 14.18 mature)* | ⚪ pending |  |
| `DocsHub-3` | *(v2, after packages/sdk stabilises)* | ⚪ pending |  |
| `DocsHub-4` | *(v2, after Net-1)* | ⚪ pending |  |
| `DocsHub-5` | *(post-v2)* | ⚪ pending |  |
| `14.25–14.28` | post-v2: paid marketplace activation, fee mechanics, multi-publisher orgs, AI credit bala… | ⚪ pending |  |
| `14.35` | *(M5)* | ⚪ pending |  |

### Company / operational infrastructure (out-of-product-repo, v2)

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Site-3` | Product Hunt / launch assets | ⚪ pending |  |
| `Account-1` | customer account web portal. apps/account (Next.js) landed: credential sign-in → plan/bil… | 🟡 in flight |  |
| `DevPortal-1` | / Catalog-1 | 🟡 in flight |  |
| `Support-1` | support desk + status page | ⚪ pending |  |
| `BugTrack-1` | staff bug/crash/feedback triage | ⚪ pending |  |
| `Ops-1` | web-property auth/email/webhooks/observability | ⚪ pending |  |
| `Mktg-1` | public-beta marketing campaign | 🟡 in flight |  |
| `Launch-1` | publish the public beta (2026-09-01) | 🟡 in flight |  |

### Encrypted attachment sync

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Asset-B7` | *(v2 | ⚪ pending | Collab-C5 (sharing |

### Import, export & migration *(doc [45](platform/45-import-export.md)

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `IE-9` | *(v2)* | ⚪ pending | Marketplace (Stage 14 |

### Connector framework *(group I)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Connector-8` | starter set (Calendar / Contacts / Slack / GitHub / Jira / Linear → canonical types) + Ma… | ⚪ pending | 14.17 |

