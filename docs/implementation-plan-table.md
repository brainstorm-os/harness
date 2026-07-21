# Implementation plan — at-a-glance table

Scannable remaining-work companion to [implementation-plan.md](implementation-plan.md) (authoritative for pending/in-flight detail). **This file lists only what is NOT done** — one row per open iteration (🟡/⚪/◑), completed (✅) excluded, future work included. This is the same set the dev-vault Tasks app projects (Today + Upcoming), generated from the plan's open bullets via `tools/gen-open-iterations.ts`. Completed narrative + test counts live in [implementation-log.md](implementation-log.md); ✅ history lives in the plan's own bullets + git.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · ❌ rejected

**Last updated:** 2026-07-21 — **`v0.7.0` shipped**; **roadmap restructured.** The pre-beta gate machinery (G0→G4, beta-freeze, decision queue, beta-exit checklist, cut levers) is **retired** and archived in [implementation-log.md § Beta program (retired)](implementation-log.md#beta-program-retired--shipped-v015-2026-06-29). Forward work is now **release trains** — each with two hero features + a mandatory product-polish batch — up to GA (`1.0.0`), then the v2 commercial stack (see [implementation-plan.md § Release trains](implementation-plan.md#release-trains--the-forward-queue-2-heroes-each)). **New tracks:** **`P2P-*`** peer-to-peer sync (design-only spike, `P2P-0` first), **`POLISH-*`** product-polish / dogfood hardening (standing, owner-driven), and **`VID-*`** weekly app-showcase videos (standing, one app / week — a polish→capture→publish cadence, owner-driven). **Open: 79 — GA 44 · v2 35.** 🎉 Public beta shipped 2026-06-29 (`v0.1.5`); everything open is GA / pre-1.0 polish or the v2 commercial stack.

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

## GA — GA / pre-1.0 (release trains 0.8.0→1.0.0) (44)

### Peer-to-peer sync *(design-only spike, `P2P-0` first; NOT started)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `P2P-0` | portability / design spike (gates the rest, like 10.0 for the sync spine): answer the loa… | ⚪ pending |  |
| `P2P-1` | LAN peer discovery + direct pairing over the chosen transport; own-device-only first (sin… | ⚪ pending | P2P-0 |
| `P2P-2` | live update exchange on the peer channel (the same sealed Yjs stream) with relay fallback… | ⚪ pending | P2P-1 |
| `P2P-3` | NAT traversal / direct connectivity beyond the LAN; relay used only for signaling / boots… | ⚪ pending | P2P-2 |

### Product polish & dogfood hardening *(standing quality track, `POLISH-*`; owner-driven)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `POLISH-1` | first owner-driven dogfood sweep (open): owner walks the fleet and files rungs per catego… | ⚪ pending |  |

### App showcase videos *(standing content + polish cadence, `VID-*`; owner-driven, one app / week)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `VID-1` | first episode (owner picks the headliner | ⚪ pending |  |

### AI broker & vector / hybrid search *(Stage 11; lexical half shipped early as Shell 9.22)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `11.0b` | Tantivy comparison: wire a Tantivy BenchEngine adapter against the same harness, re-run t… | ⚪ pending |  |

### Localization, accessibility & perf budgets *(Stage 12)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `12.15` | app-renderer locale propagation + per-app translation packs (the explicitly-deferred "Sti… | 🟡 in flight |  |
| `15d` | content (the big lift, one slot per app or fan-out). 12/18 apps landed *(2026-07-13)*: co… | 🟡 in flight |  |

### Native acceleration *(NAPI-RS, post-beta perf track)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `NAPI-P` | performance-bottleneck profiling sweep (gates NAPI-4 + any new native target). Goal: *con… | ⚪ pending |  |

### Encrypted attachment sync

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Asset-B4` | lazy fetch + eager thumbnail tier: materialise bytes on access (not eagerly on restore);… | 🟡 in flight | Asset-B3 ✅ |
| `Asset-B4b` | eager thumbnail tier *(split from Asset-B4, 2026-07-03)*: a small always-synced tier (thu… | ⚪ pending | Asset-B4 |

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

### Intents, widgets, tray & notifications *(Stage 7b)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `7.14` | app notification badges (iOS-style unread counts on app icons): an app can surface a badg… | ⚪ pending |  |

### Network broker & readable extraction *(doc 38 + 58

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Net-3` | live-DOM feeder *(gate Browser-1 ✅ | ⚪ pending | Browser-1 ✅ — cleared with the Browser app |

### Import, export & migration *(doc [45](platform/45-import-export.md)

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `IE-7` | one-shot authenticated-API Source (Notion API import, OQ-243): the non-file Source stage… | ⚪ pending | Connector framework ✅ + IE-6 |
| `IE-10e` | Anytype fidelity v2: source-map binding · layout routing · media widths (owner reports 20… | 🟡 in flight |  |
| `IE-11` | background import/export runs (owner call 2026-07-18: "import/export should be a backgrou… | 🟡 in flight |  |
| `IE-10` | Anytype import (design platform/72-anytype-import.md): the highest-fidelity third-party s… | ⚪ pending | a real Anytype JSON export fixture (the des… |

### Graph *(9.13)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.13.10e` | live bucketed event stream (entities.subscribe | ⚪ pending | note was stale |

### Bookmarks *(9.18)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.18.8` | Highlights & annotations on captured content + a per-bookmark annotation list. *(gated: n… | ⚪ pending | needs editor text-anchoring on the captured… |

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

### Object read-only lock (fleet, cross-app)

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Lock-3` | retro-fill the workflow bar *(partly paid by shell PR #18 lock-rollout-fixes/5ffda45, 202… | ⚪ pending | none (cleanup |

## v2 — v2 / post-v2 (commercial · multi-user · marketplace) (35)

### Peer-to-peer sync *(design-only spike, `P2P-0` first; NOT started)*

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
| `BugTrack-1` | staff bug/crash/feedback triage | ◑ preview-drop |  |
| `Ops-1` | web-property auth/email/webhooks/observability | ⚪ pending |  |
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
