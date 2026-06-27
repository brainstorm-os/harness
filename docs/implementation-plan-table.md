# Implementation plan — at-a-glance table

Scannable remaining-work companion to [implementation-plan.md](implementation-plan.md) (authoritative for pending/in-flight detail). **This file lists only what is NOT done** — one row per open iteration (🟡/⚪/◑), completed (✅) excluded, future work included. This is the same set the dev-vault Tasks app projects (Today + Upcoming), generated from the plan's open bullets via `tools/gen-open-iterations.ts`. Completed narrative + test counts live in [implementation-log.md](implementation-log.md); ✅ history lives in the plan's own bullets + git.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · ❌ rejected · 🔴 release-blocking · 🟢 GA-only (not beta-blocking)

**Last updated:** 2026-06-27 — **Open: 64 — Beta-blocking 0 · GA 30 · v2/post-v2 34** (bucketed by phase below; **`Asset-B3` durable-node asset CAS landed 2026-06-27** — the node (`../sync`) blob plane: a content-addressed `AssetCas` (has/put/get by ciphertext-hash) with `MemoryAssetCas` + durable `FileAssetCas` (sharded, atomic, immutable) + `ObjectAssetCas` (S3/R2), the node's lockstep copy of the Asset-B2 wire on a new channel byte `0x02` (request/response, admission-gated, PUT-ingress/GET-egress metered), relay-blind preserved (opaque ciphertext keyed by an opaque hash, no crypto, `[0-9a-f]{64}` path-traversal guard); +20 tests, full node suite 104 green. `Asset-B4` (lazy fetch + thumbnail tier) is now next. Earlier: **`Asset-B2` `WireKind.Asset` chunked transport landed 2026-06-27** — the client-side blob transport: 4 MiB chunks each independently sealed under the per-asset DEK (synthetic-IV nonce → stable content-addresses for resume/has-skip) and addressed by ciphertext-sha256; ordered validated manifest; `AssetCas` (has/put/get) + `uploadAsset`/`downloadAsset` (untrusted-node verification) + the `AssetWireKind` blob-plane wire (has/put/get codec, `WireAssetCas`, `serveAssetRequest`); +49 tests. Earlier: **`Asset-B1` asset-DEK re-homing landed 2026-06-26** — the first rung of encrypted attachment sync: the per-asset DEK now re-homes from the vault-master-key wrap into the referencing entity's Y.Doc sealed under the **entity DEK** (`brainstorm.meta → assetDeks` map via a crypto-free `installAssetDekWrap` worker method, AAD bound to entity+asset), so a paired device can open a synced blob; idempotent open-time pass (`asset_refs.rehomed_at` schema-v7 marker, modeled on the 10.x retro-wrap drain), `asset_deks` kept as a derived cache, +18 tests. The re-homing-migration OQ is resolved; `Asset-B2` (`WireKind.Asset` chunked transport) is now next. Earlier: **public-source split + site + docs portal landed 2026-06-25** — the `brainst0rm-os` org migration made `shell`/`sync` (AGPL-3.0) + `site`/`docs` (MIT) public while `harness`/`cloud` stay private, closing `OQ-REPO-1`/`OQ-REPO-2` (license `OQ-REPO-3` = AGPL); `Site-1` marketing site ✅ [getbrainstorm.online](https://getbrainstorm.online) + `Site-2` docs portal ✅ [docs.getbrainstorm.online](https://docs.getbrainstorm.online) (only `Site-3` Product Hunt assets remain). Also: **encrypted attachment sync designed + scheduled 2026-06-25** — the asset byte-plane ([data/70](data/70-encrypted-attachment-sync.md)) the relay doesn't move; asset-subsystem Part B lands as `Asset-B1`–`B6` (GA, single-user multi-device) + `Asset-B7` (v2, multi-user share fan-out); still zero beta-blockers. Earlier: **`MCP-2` stdio transport landed 2026-06-24** — agents can now use local-process MCP servers (filesystem/git/etc.) as tools, gated on the scarce default-off `mcp.spawn-local` cap (plain child, `shell:false`); OQ-MCP-2 resolved. The MCP client ladder (MCP-1..4) is complete. **🎉 zero open iterations now gate the `2026-09-01` beta** — what remains for beta is the G3/G4 process work, NOT feature iterations: bug burn-down, feature freeze, RC cut + the beta-exit checklist; everything else open is GA polish + the v2 commercial stack). Recent landings: **the last 3 beta-blockers closed 2026-06-23 — `9.12.13(c)` shipped as a Contacts dashboard widget (re-scoped to the 7.3b widget framework), `9.3.5.7…N` single-object-space migration closed (audit), and `Welcome-2` first-launch template gallery ✅ real-shell verified.** The 9.3.5 audit confirmed every first-party app's domain objects live on real `entities.db` (Journal rides the Notes rung; the "…N" tail collapsed to zero), which unblocked `Welcome-2` — whose gallery UI + 7 templates + import IPC already shipped (`2b6d4537`) and is now verified end-to-end by `tests/dogfood/sessions/332-welcome-2-first-launch.spec.ts` (fresh launch → gallery mounts in real Electron → pick a template → vault created + seeded → dashboard, clean console). **`10.13` selective-sync + `10.14` restore-from-zero (keystore-intact) ✅ real-shell verified 2026-06-23** via a new 2-shell wipe-and-restore dogfood (`004-wipe-and-restore.spec.ts`) — the recipient wipes `entities.db` + `docs/`, relaunches, and `syncStatus.restore()` recovers the entity byte-identically; the run found + fixed two real bugs (`isRestoreAvailable` defeated by the bootstrapped root folder; sync engines never wired for a boot-auto-restored vault = every app restart, which had also left **10.12 live-sync dead after a restart**). **cross-app drag-and-drop (`DND-1`–`DND-5` ✅, `DND-6` ◑)** — the full shell-mediated drag spine plus the app rollout: `selection`/`dnd` broker services + click-through ghost overlay + preload forwarder (DND-1/2), the `@brainstorm/sdk/object-dnd` `useDragSource`/`useDropTarget` primitives with **rect hit-testing** so multiple positioned drop zones in one window route by cursor (DND-3, fixing the window-level-LIFO collapse), the app rollout — Database rows-as-source (hover grip, selection-aware) + board-column set-property/membership, Calendar day-cell date-set, Files source-grip + folder/tree membership-add, Notes editor reference target (DND-4) — file-out to the OS via `dnd.exportFile` + `webContents.startDrag` with a temp-materialised file + sanitised name (DND-5), and the keyboard twin "Add to collection…" surfaced via the shared object menu in Notes + Database (DND-6 partial; Move/Link twins follow the action surface, doc 63). ~120 new tests; real-shell pointer-drag + startDrag-latency dogfood remains the gate. **app-lifecycle catalog spine (`14.29`–`14.34`) ✅ code-complete** — catalog-driven app install/update replacing demo-seeding, all above the existing `AppInstaller`: registry provenance (schema v9 `InstallOrigin`), bootstrap installer (`BOOTSTRAP_APPS` = **all bundled first-party apps** — corrected from the curated-5 that stranded `code-editor`), `CatalogClient` (signed-index offline Ed25519 verify + last-good cache), `InstallEngine` + `UpdateEngine` (integrity+authenticity gates, capability-consent classification, TOFU publisher continuity) over a shared `acquireBundle`, the `.brainstorm` package format + publisher + CI publish workflow (tar+gzip, OQ-LC-7), the renderer Marketplace install + **Updates panel**, and cloud **`catalog-edge`** serving real signed bundles (`/v1/catalog/index` + `/assets/*`). **`14.29`–`.34` ✅; verified in-process + live-HTTP + a passing real-shell Electron dogfood** (`dogfood:catalog` — Electron net.fetch downloads the signed index + bundle, installs via the catalog `InstallEngine`). Only residual = the cloud CDN/bundle-store deploy (Phase 3.4c, infra). `14.35` ⚪ (retire dev seeder — now un-gated). Plus dashboard `pruneOrphanAppIcons`. App-icon glyphs resized smaller + uniform. Earlier: **`10.14` restore-from-zero CONSUMER** (keystore-intact) — cold-device restore ships end-to-end: `type` now sealed in the `WrapBootstrap` (resolves OQ-SYNC-5), a client `catalog` query over the relay control channel, a new `RestoreEngine` (catalog → ungated `trackForRestore` → `wraps ++ snapshot ++ tail` backfill → row materialize + search rebuild), shared `installEntityDek` helper, and a Settings → Sync restore action + auto-detect offer; ✅ wipe-and-restore dogfood verified 2026-06-23 (fully-cold/lost-keystore still gated on account recovery). **`10.12` always-on live-sync core** (`main/sync/live-sync-engine.ts` — normal entities-service edit path auto-subscribes/emits/applies shared-entity edits, echo-free, solo edits stay off the relay; `SYNC-0`/`SYNC-1` reconciled ✅ in `../brainstorm-sync`; co-edit dogfood ✅ + post-restart wiring fixed 2026-06-23); **templates foundation** (`B11.10a` `Template/v1` data layer + codec; `B11.10` now 🟡); **identity/roster** (`Collab-C6` slice-a — signed `Profile/v1` + `roster` broker service + comment/chat @-mentions + Settings → Identity; now 🟡); chat `@`-mention scoped to people, document-pin its own affordance.

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

## GA — GA (v1, post-beta) (32)

### AI broker & vector / hybrid search *(Stage 11; lexical half shipped early as Shell 9.22)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `11.0b` | Tantivy comparison: wire a Tantivy BenchEngine adapter against the same harness, re-run t… | ⚪ pending |  |
| `11.3` | bundled local embedding model (multilingual-e5-small via @napi-rs addon), computed in the… | ⚪ pending |  |

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
| `Asset-B4` | lazy fetch + eager thumbnail tier: materialise bytes on access (not eagerly on restore);… | ⚪ pending | Asset-B3 ✅ |
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

### Notes (text-editor) *(9.6)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `B11.10` | Templates (cross-app platform foundation | 🟡 in flight |  |

### Graph *(9.13)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.13.10e` | live bucketed event stream (entities.subscribe) | ⚪ pending | dep-gated |

### Bookmarks *(9.18)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.18.8` | Highlights & annotations on captured content + a per-bookmark annotation list. *(gated: n… | ⚪ pending | needs editor text-anchoring on the captured… |
| `9.18.9` | Captured-image offline assets: store article images in the encrypted asset store (Part-B… | ⚪ pending | asset-store Part-B WireKind.Asset + assets.… |

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

## v2 — v2 / post-v2 (commercial · multi-user · marketplace) (34)

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

