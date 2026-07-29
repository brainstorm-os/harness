# Implementation plan — at-a-glance table

Scannable remaining-work companion to [implementation-plan.md](implementation-plan.md) (authoritative for pending/in-flight detail). **This file lists only what is NOT done** — one row per open iteration (🟡/⚪/◑), completed (✅) excluded, future work included. This is the same set the dev-vault Tasks app projects (Today + Upcoming), generated from the plan's open bullets via `tools/gen-open-iterations.ts`. Completed narrative + test counts live in [implementation-log.md](implementation-log.md); ✅ history lives in the plan's own bullets + git.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · ❌ rejected

**Last updated:** 2026-07-29 — **v0.11.0 + v0.11.1 shipped** (0.11.1 = the user-requested whiteboard resize + two polish batches, incl. dark-theme code highlighting that was wrong suite-wide). **AppForge slice underway** for the `VID-build-apps` flagship video: **`AppForge-1` ✅** (shell #364 — install an app from a local folder or `.brainstorm` file; first real producer of `InstallOrigin.LocalFile`, dashboard-sender-gated, decompression-bomb bound added to every unpack path, packaged-marketplace path bug fixed) and **`AppForge-3` ✅** (shell #365 — the agent drafts `CodeFile/v1` as approvable cards); `AppForge-2` (install-from-vault, the video's money shot) in flight. Also **agent-observability track filed** (design [platform/77-agent-observability.md](platform/77-agent-observability.md), rungs `Agent-12a..e`, OQ-AO-1..5): per-run trace substrate (`agent_runs`/`agent_events` beside `ai_usage`) + per-turn timeline / automation run detail / Settings activity query / live chip; denials first-class. Design-only — no rung started. **75 open — GA 40 · v2 35** (count rises by the 5 new ⚪ rungs). Earlier: (fifth pass, 2026-07-28 — 0.11.0 bucket complete) — **`Props-3` + `Props-4` ✅** (shell #356 — Tasks + Notes on the shared `EntityPropertiesPanel`; `extraRows` host-slot + panel-owned picker decisions recorded; −144 lines of bespoke panels) and the **0.11.0 POLISH batch drained** (shell #355 — 4 fixed incl. the fleet-wide `.bs-select`/`.bs-input` face unification; 5 taste-call rungs filed ⚪ for the owner: POLISH-PROP-2, POLISH-DSN-3/4/5, POLISH-LAY-2 — hence the count RISES from 67: honest new work found). **70 open — GA 35 · v2 35.** The 0.11.0 train bucket is complete → release prep. Earlier: (fourth pass) — **`NAPI-4` ❌ closed as a no-op (owner decision)**: NAPI-P measured no budget miss (3.0 ms/tick at the 600-node cap, off-main-thread); the port only mattered for raising the cap past ~1000 nodes and the owner keeps 600. The 0.11.0 train row actualised (both heroes resolved; `6.11` de-scoped as post-v1; POLISH agent sweep in flight). **67 open — GA 32 · v2 35.** Earlier: (third pass — wave-1 merged) — **`Lock-3` ✅** (shell #346 — LockButton/EditableSync dedicated tests, failing-first lock-bypass fixes in calendar drag/bulk/delete + tasks board-drag, SDK `<Icon>` aria-hidden fix), **`Browser-5` ✅** (shell #347 — reader mode + `WebViewMethod.Capture` wired through the Net-2 core with fail-closed `web.capture` enforcement), **`7.14` ✅** (shell #348 — single-owner dock-badge aggregator + Chat/Agent/Automations consumers + running-strip badge), **F-467/F-468 fixed** (shell #349 — feedback-banner polish; open-ladder refusals now surface as a toast + `{signature}` interpolation fix), **F-466 fixed** (shell #350 — the LAN batch's address-inferred admission classification swallowed pre-open inbox subscriptions on any loopback/private relay, dropping share-time WrapBootstraps; LAN trust is now explicit `syncRelay.lan` config and the admission gate holds post-open announces too). **`IE-10` bullet actualised ✅** (shipped v0.5.0, never flipped). Table regenerated: **70 open — GA 35 · v2 35**. Wave 2: **`Connector-7` ✅** (shell #351 — the contract proven in one production-shaped in-process chain; found+fixed a real shipped defect: `mail.fetchAttachment` was capability-denied in every real vault, missing manifest `entities.write:brainstorm/File/v1`) · `Asset-B4b` built (shell #353, packaging dry-run passed macOS) · **`Connector-6` ✅** (shell #352 + #354 — both gates failed-first then passed, runs in the ledger; C1: revoked ingress left endpoints live+syncing, fixed twice over) · `Props-3/4` in flight. Prior passes: **`15d` + `12.15` ✅** (shell #343 merged — the 8 remaining apps' es/de/fr/it/pt packs, 9,095 strings; all 20 first-party apps ship the pack mechanism; residue documented in the 15d bullet: SDK `DEFAULT_*_LABELS` chrome + database `view-settings.ts` module-scope labels). Table regenerated: **74 open — GA 39 · v2 35**. Earlier today: **three closes** (`bun tools/gen-open-iterations.ts` re-run): **76 open — GA 41 · v2 35**. **`Asset-B4` ✅** (shell #341 + harness #133 — the last gate, the live 2-device relay-loop proof: `011-asset-relay-loop.spec.ts` shows A binds → chunks upload on bind → B materialises lazily on first access, byte-identical; surfaced pre-existing **F-466**: collab spec 001 fails `awaitConverged` on an unmodified main baseline — receiver `no DEK for entity`). **`IE-10e` ✅** (shell #340 — Anytype full kind-routing: Task/Bookmark layouts mint native `Task/v1`/`Bookmark/v1` instead of Note twins). **`IE-11` ✅** (shell #340 — export joins the background pattern: `transfer-run-store` generalisation, yields/progress/abort in `exportVaultBundle`, outcome toasts; residue: live-progress dashboard indicator, needs design). `Asset-B4b` (eager thumbnail tier) is now **unblocked** — its gate was Asset-B4. Also in review: **shell #343** — the 8 remaining `15d` apps (incl. journal, missing from the earlier "~6" count) get full es/de/fr/it/pt packs (9,095 translated strings); on its merge all 20 first-party apps ship the pack mechanism and `15d` closes. Carry-over from 2026-07-27: `LAN-2b` remaining item is **(d) revocation, an owner decision** (re-keys real user data through ROT-3a); `LAN-9` gated behind it. 🎉 Public beta shipped 2026-06-29 (`v0.1.5`).

Per-iteration history + test counts live in [implementation-log.md](implementation-log.md) + git. Regenerate the tables below after any status change with `bun tools/gen-open-iterations.ts`.

---

## Forward release trains (2 heroes each)

Full roadmap + hero assignments + the **infra + collaborative-sync line** live in [implementation-plan.md § Release trains](implementation-plan.md#release-trains--the-forward-queue-2-heroes-each). Summary:

| Train | Hero 1 | Hero 2 |
| ----- | ------ | ------ |
| **0.8.0 — Reach out** | `Mailbox-5` JMAP/OAuth transports | `11b.8` HTTP + Webhook |
| **0.9.0 — Find & switch in** | `11.3` semantic search ON | `IE-7` Notion-API import |
| **0.10.0 — Compose your own** | `8.10.x` Form-designer / layouts | `Browser-6/8` downloads + agentic |
| **0.11.0 — Bytes everywhere, fast** | `Asset-B4/B4b` attachment sync | `NAPI-P`→`NAPI-4` native accel |
| _═ infra + collaborative-sync line ═_ | _durable node hardened · collab layer done · `P2P-0` reported_ | |
| **0.12.0 — Share for real** | `Collab-C5` sharing UX | `P2P-1` peer-to-peer sync |
| **1.0.0 — GA** | GA definition-of-done | — |
| **v2 — commercial** | `14.x` billing / quotas / orgs | company ops · `Launch-2` |

**Every train drains a `POLISH-*` batch** — editor blocks, entity properties, visual design, layout — until the polished-product bar is met.

---

## Remaining iterations (NOT done) — complete list

Every open iteration, **bucketed by phase** (GA / pre-1.0 → v2/post-v2) then plan section. **Phase rules:** *GA* = v1, pre-1.0, rides the single-user release trains 0.8.0→1.0.0 (the GA definition-of-done); *v2* = explicitly post-v1 (paid / commercial, multi-user, marketplace) — Stage 14 / Collaboration layer / etc. Classification is computed in `tools/gen-open-iterations.ts` (`phaseFor`) so it regenerates with the table. A bundled id (e.g. `9.12.3/.4/.5/…`) is one plan bullet covering several rungs.

## GA — GA / pre-1.0 (release trains 0.8.0→1.0.0) (41)

### Peer-to-peer sync *(`P2P-*` design spike; the concrete LAN slice shipped early as `LAN-*`

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `P2P-0` | portability / design spike (gates the rest, like 10.0 for the sync spine): answer the loa… | ⚪ pending |  |
| `P2P-1` | LAN peer discovery + direct pairing over the chosen transport; own-device-only first (sin… | ⚪ pending | P2P-0 |
| `P2P-2` | live update exchange on the peer channel (the same sealed Yjs stream) with relay fallback… | ⚪ pending | P2P-1 |
| `P2P-3` | NAT traversal / direct connectivity beyond the LAN; relay used only for signaling / boots… | ⚪ pending | P2P-2 |

### LAN P2P sync *(the track-C wedge

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `LAN-9` | host-side durable tail for the both-peers-absent gap | ⚪ pending |  |
| `LAN-2b` | close the security gate (NEW 2026-07-26, gates LAN-4/LAN-9). The gate found the load-bear… | ⚪ pending | (NEW 2026-07-26, gates LAN-4/LAN-9 |

### Product polish & dogfood hardening *(standing quality track, `POLISH-*`; owner-driven)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `POLISH-1` | first owner-driven dogfood sweep (open): owner walks the fleet and files rungs per catego… | ⚪ pending |  |
| `POLISH-DSN-3` | Browser: the new-tab page is a fully blank surface (15-app-browser.png) | ⚪ pending |  |
| `POLISH-ED-2` | Markdown block shortcuts dead inside list items: after -  opens a bullet list, 1. , [] ,… | ⚪ pending |  |
| `POLISH-ED-3` | Inline-code chord dead: Mod+E applies no code mark while the bold/italic chords work and… | ⚪ pending |  |
| `POLISH-PROP-3` | Relation-picker empty copy is note-hardwired: the Assignee (person) property editor's emp… | ⚪ pending |  |
| `POLISH-LAY-5` | Calendar "Today" doesn't return after paging: June → page to August → Today leaves the ra… | ⚪ pending |  |

### App showcase videos *(standing content + polish cadence, `VID-*`; owner-driven, one app / week)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `VID-1` | first episode (owner picks the headliner | ⚪ pending |  |
| `VID-notes` | Notes is VID-1 (owner pick 2026-07-22). Polish gate PASSED | 🟡 in flight | PASSED |

### AI broker & vector / hybrid search *(Stage 11; lexical half shipped early as Shell 9.22)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `11.0b` | Tantivy comparison: wire a Tantivy BenchEngine adapter against the same harness, re-run t… | ⚪ pending |  |

### Encrypted attachment sync

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Asset-B4b` | eager thumbnail tier *(split from Asset-B4, 2026-07-03)*: a small always-synced tier (thu… | 🟡 in flight | Asset-B4 ✅ |

### Mobile companion *(design-only track

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `MOB-0` | portability spike (the 10.0 analogue): bare RN/Expo (Hermes) scaffold pairs with a real d… | ⚪ pending | OQ-MOB-1 position |
| `MOB-1` | @brainstorm/vault-core extraction (product monorepo): identity + DEK/wrap crypto + wire +… | ⚪ pending | MOB-0 |
| `MOB-2` | companion scaffold + pairing: brainstorm-mobile repo (own CI running the MOB-0 pairing te… | ⚪ pending | MOB-1 |
| `MOB-3` | sync + local store: op-sqlite/expo-sqlite driver; metadata-eager / body-lazy selective sy… | ⚪ pending | MOB-2 |
| `MOB-4` | read surfaces: tab scaffold (Home / Search / Capture / Inbox / Vault); the one stacked-la… | ⚪ pending | MOB-3 |
| `MOB-5` | capture: OS share sheet → Bookmark/v1 (58 object); quick note / task / photo / voice → se… | ⚪ pending | MOB-3 |
| `MOB-6` | reminders as local notifications: portable scheduler core (incl. onMissed: FireOnce water… | ⚪ pending | MOB-3 |
| `MOB-7` | editing: property edit + task check-off + append composer first; full block editing via W… | ⚪ pending | MOB-4 |
| `MOB-8` | hardening + store beta: biometric-gated keystore unlock (gate, never custody | ⚪ pending | MOB-4–MOB-7 |

### Window manager, menus & shortcuts *(Stage 6)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `6.11` | (post-v1) | ⚪ pending |  |

### Layouts & design system *(Stage 8 + shared fundamentals + covers/pickers)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `8.9` | post-v1 (re-scoped 2026-05-23): react-aria non-menu primitives (dialogs/comboboxes/popove… | ⚪ pending |  |

### AppForge

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `AppForge-2` | install-from-vault: an app bundle living *in the vault* (e.g. authored with the code-edit… | ⚪ pending |  |

### Bookmarks *(9.18)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.18.8` | Highlights & annotations on captured content + a per-bookmark annotation list. *(gated: n… | ⚪ pending | needs editor text-anchoring on the captured… |

### Mailbox *(group I)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Mailbox-9` | official Google OAuth client registration (pre-release, org/process task | ⚪ pending | for |

### Agent app *(group I, Stage 11c)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Agent-10` | the Notes seam (F-241 / platform/75-agent-notes-seam.md) | ⚪ pending |  |

### Agent observability *(Agent-12

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Agent-12a` | trace substrate: agent_runs + agent_events repos in account.db beside ai_usage (repo patt… | ⚪ pending | OQ-AO-1 |
| `Agent-12b` | per-turn timeline (Agent app): expandable "what I did" disclosure per assistant message | ⚪ pending | Agent-12a |
| `Agent-12c` | automation run detail (Automations app): WorkflowRun/v1 drill-in rendering the run's trac… | ⚪ pending | Agent-12a |
| `Agent-12d` | vault-level activity (Settings → AI): runs filtered by surface / app / date / outcome wit… | ⚪ pending | Agent-12a |
| `Agent-12e` | live activity: in-flight runs register with BackgroundActivityStore (named, cleared on co… | ⚪ pending | Agent-12a |

### Agent teams & orchestration *(0.12.0 flagship

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Agent-Teams-1` | agents as principals: Agent/v1 entity type (a member kind beside Profile/v1) + own Ed2551… | 🟡 in flight | none |
| `Agent-Teams-2` | Team surface + scoped grants: an agent directory (create/configure an agent) + per-agent… | ⚪ pending | Agent-Teams-1 |
| `Agent-Teams-3` | @-mention an agent in a Chat channel (the hero interaction): mentioning an agent runs the… | ⚪ pending | Agent-Teams-1/-2 |
| `Agent-Teams-4` | seeded starter agents (a Research agent + an Ops agent, AgentTemplate format) for the Nor… | ⚪ pending | Agent-Teams-1 |
| `Agent-Teams-5` | single-hop delegation (delegate tool; child caps = child ∩ delegator, never escalating) +… | ⚪ pending | Agent-Teams-2 |

## v2 — v2 / post-v2 (commercial · multi-user · marketplace) (35)

### Peer-to-peer sync *(`P2P-*` design spike; the concrete LAN slice shipped early as `LAN-*`

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `P2P-4` | multi-user P2P (shared entities across identities) | ⚪ pending | P2P-2 + collaborative-sync layer |

### Collaboration layer

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Collab-C5` | sharing UX. Core ✅ (built, was mis-marked): the <ShareDialog> (packages/sdk/src/share-dia… | 🟡 in flight | in the envelope pipeline, isAuthorizedWrite… |
| `Collab-C6` | human-facing user identity (resolves OQ-ID-1; design in 16-identity-orgs-encryption.md §S… | 🟡 in flight |  |
| `14.5` | Paddle Plus/Pro (MoR checkout, tax handling) | ⚪ pending |  |
| `14.6` | Settings → Billing UI (plan picker, change/cancel, invoices, self-serve refund). Control-… | ◑ preview-drop |  |
| `14.7` | quota enforcement (storage attachments + sync egress metering). Metering ingestion + per-… | ◑ preview-drop | arms only when account-linked ∧ metered pla… |
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
| `14.24a` | admin-panel client wiring (shell feedback view + shell-only FeedbackService + opt-in cras… | ◑ preview-drop |  |
| `DocsHub-1` | *(v2, early | ⚪ pending |  |
| `DocsHub-2` | *(v2, after 14.17 + 14.18 mature)* | ⚪ pending |  |
| `DocsHub-3` | *(v2, after packages/sdk stabilises)* | ⚪ pending |  |
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
| `BugTrack-1` | staff bug/crash/feedback triage | ◑ preview-drop |  |
| `Ops-1` | web-property auth/email/webhooks/observability | ⚪ pending |  |
| `Video-1` | Brainstorm YouTube video (owner goal, set 2026-07-18) | ⚪ pending |  |
| `Launch-2` | Product Hunt launch, August 2026 (owner target set 2026-07-19). The quality gate is the r… | ⚪ pending | is the |

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
