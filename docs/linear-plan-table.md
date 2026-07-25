# Linear plan — single-track execution order

A flattened, dependency-ordered march through every open iteration in [implementation-plan-table.md](implementation-plan-table.md). Where the at-a-glance table groups work by app/section, **this file is one ordered list**: do row 1, then row 2, top to bottom. Ordering rules, in priority: **(1) unblock the current release train** (its two heroes name it), **(2) keystones — items gating the most downstream work**, **(3) honour the dependency chain within equal priority**, **(4) owner-driven standing tracks ride alongside, not in the queue.** The only hard dividers are real milestones (GA, v2) — not topic sections.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · 🔴 blocking · 🟢 GA-only · 🚩 milestone

**Where we are:** 🎉 the public beta shipped **2026-06-29** (`v0.1.5`) and the product has iterated to **`v0.9.1`**. There is no beta gate left — forward work is the **release trains** to GA (`1.0.0`), then the v2 commercial stack. Current train: **`0.10.0` — Compose your own**. Keystones already banked: `9.3.5.V` (Lists→vault entities) · `9.10` (Files host) · `Net-1`/`Net-2`/`Net-3` · `11.5` (AI broker) · the `10.x` sync spine + durable node · the `Agent-11` propose→approve ladder.

## ✅ Recently completed (newest first)

So progress is visible — this list grows as the open table below shrinks. Completed iterations move **out** of the open table into here; full history lives in git + [implementation-log.md](implementation-log.md).

| Done | ID | Task | Landed |
| ---- | -- | ---- | ------ |
| ✅ | `Browser-8` (complete) | **Summarize this page** — the ⋯ menu reads the live page (Net-3) and summarizes it through the broker, into a dismissible panel. Goes through `ai.transform` with a NEW `AiTransformKind.Summarize`, so the page rides `source` (user role only) and the "content, never instructions" guard lives once in the contract for every app that summarizes (shell `feat/browser-8-summarize`) | 2026-07-24 |
| ✅ | `Net-3` | **Live-DOM feeder** — the rendered DOM of a partitioned `WebContentsView` goes to the SAME Net-2 extraction worker the static feeder uses (one shape for an in-browser read and a fetched URL). Clamps on both sides of the parser; truncation flagged, never silently elided (shell #285) | 2026-07-24 |
| ✅ | `Browser-8` (read-only half) | **Agentic browsing is navigate-and-read** — **OQ-WV-5 resolved**: `web.browse:read-only` as a separate capability scope, mode derived from broker-verified caps and fixed at open, own throwaway partition, session refuses every non-GET/HEAD request. Remaining: the AI summarize/extract surface (shell #284) | 2026-07-24 |
| ✅ | `IE-7` | **Notion import over the API** — no export file: connect a workspace, preview what the integration can see, import. Lands in the same `NotionImportPlan` the export-zip path produces, so one write path + one dedupe rule (`notion:<page id>`). Token stored Tier-2, never back across IPC (shell #282) | 2026-07-24 |
| ✅ | `Agent-11d` / `Agent-11e` | **The `Agent-11` ladder completed** — the agent proposes rows in an existing database (columns + types derived from the live vault; unknown/ambiguous database refused) and whole new databases (schema inference + seed rows → Collection + Grid view + one object per row). Propose→approve throughout (shell #280/#281) | 2026-07-24 |
| ✅ | `Agent-11a`/`b`/`c` + `0.9.0` | **Agent writes your vault** — the 0.9.0 hero: propose-artifact catalogue + preview-confirm tray + server-authoritative provenance back-links. No model output can persist; the approve gesture is the only write (shell #267/#271) | 2026-07-23/24 |
| ✅ | `Agent-Teams-1a`/`1b` | Agents as principals — `Agent/v1` member type + roster member kind; agent key custody (own Ed25519, sealed) (shell #276/#277) | 2026-07-24 |
| ✅ | `LAN-1`/`LAN-2`/`LAN-6` | **LAN P2P sync — localhost proof.** Embedded blind relay host (the cloud relay's own `FrameRouter`, RELAY-BLIND fence verified) + roster-signed admission with deterministic host election; tests prove live co-edit **and** backfill with no cloud relay. The real external-socket bind is withheld behind a security review (shell #264) | 2026-07-24 |
| ✅ | `Browser-6` | Downloads → Files host (`File/v1` in the vault) (shell #272) | 2026-07-24 |
| ✅ | `8.10.4` / `8.10.5` | Form-designer — conditional field visibility · save-as-`Layout/v1` + apply-to-type + install-contract round-trip (shell #252/#273) | 2026-07-22/24 |
| ✅ | `Mailbox-5` | **All four `MailProtocol`s build a real driver** (imap · jmap · gmail-api · ms-graph) — the 0.8.0 hero. Residue is not code: live-account verification + the separate `Mailbox-9` registration (shell #241) | 2026-07-21 |
| ✅ | `11b.8` / `11b.10` | Automations — Webhook ingress trigger (loopback listener + relay client) · FileWatch + Startup triggers (shell #244/#246/#242) | 2026-07-20/21 |
| ✅ | `9.13.10e` | Graph live bucketed event stream (shell #253) | 2026-07-22 |
| ✅ | `7.14` (core) | App-icon notification badges — `ui.badge` service + dashboard chip + Mailbox consumer. Follow-ups open (OS dock aggregation, more consumers, windows strip) (shell #251) | 2026-07-22 |
| ✅ | `12.16` / `12.17` | a11y accent-as-text + accent-on-fill WCAG AA — dedicated tokens + a base-theme contrast CI ratchet, now green with zero deferrals (shell #82/#83) | 2026-07-03 |
| ✅ | `11.3` (core + packaging) | Local embedding model → semantic search ON — `bge-small-en-v1.5` 384-d via fastembed/ONNX, statically-linked ORT shipped across all 6 targets, first-run consent gate (shell #79/#84; #228) | 2026-07-03 |
| ✅ | `B11.10` | Templates COMPLETE — create-flow picker + editor snippet insert / save-as-template (shell #48/#85) | 2026-07-03 |
| ✅ | `Asset-B1`…`B3` / `B4c` / `B5` / `B6` | Encrypted attachment sync — DEK re-homing → chunked wire → durable content-addressed CAS → cold-fetch metadata reconstruction + node-side GC | 2026-06/07 |
| ✅ | `012–028` | Dogfood app-sweep — fleet verified clean (0 page/console errors across 17 sessions · 20/20 apps clean on dark · 0 ICU plural leaks) | 2026-06-27 |
| ✅ | Public-source split | `brainstorm-os` org migration — `shell`/`sync` (AGPL-3.0) + `site`/`docs` (MIT) public; `Site-1`/`Site-2` live | 2026-06-25 |
| ✅ | `MCP-1`…`MCP-4` | Agent MCP client ladder — HTTP + stdio servers, Settings panel, confirm-writes friction model | 2026-06-24 |
| ✅ | `14.29 → .34` | App-lifecycle catalog spine — signed-catalog install/update, `.brainstorm` package + CI publish, Marketplace + Updates panel | 2026-06-24 |
| ✅ | `SYNC-2`…`SYNC-5` | Durable sync node — snapshot store → object-store backend → entitlement-gated admission → ops limits | 2026-06-22/23 |
| ✅ | `10.12` / `10.13` / `10.14` | Always-on live sync (real two-shell co-edit) · selective-sync policy + picker · restore-from-zero | 2026-06-22/23 |
| ✅ | 🚩 **PUBLIC BETA** | `v0.1.5` — signed + notarized macOS, Windows + Linux on GitHub Releases, in-app auto-update. ~9 weeks ahead of the original `2026-09-01` target | **2026-06-29** |
| ✅ | `9.3.5.V` | Lists/Collections → vault-level entities (**keystone**) | 2026-06-13 |

---

## Open work (single-track order)

Regenerated against `implementation-plan-table.md` ground truth, **2026-07-24** (Open: **80** — GA 46 · v2 34). Ordered by the current release train first, then by what unblocks the most.

**Read this before picking a row:** several rows are **gate-blocked by design** and should not be started ahead of their gate — `8.10.2`/`8.10.3` wait on the post-v1 Layouts render pipeline (`8.3`/`8.4`); `LAN-4`/`LAN-9` wait on a mandatory security review of the shell's first inbound socket; `9.18.8` waits on editor text-anchoring; `IE-10` waits on a real Anytype export fixture. Rows marked **owner** are standing tracks that ride alongside the queue rather than blocking it.

| # | ID | Task | Train | Gate / dep | Status |
| -: | -- | ---- | ----- | ---------- | ------ |
| 1 | `Browser-5` | clip-to-vault — affordance shipped; bind the write path to the same Net-3 feeder | 0.10.0 | `Net-3` ✅ | ◑ |
| 3 | `8.10.2` | Form-designer editing canvas — `stacked`↔`grid` switch + per-cell subscriptions (drag-to-reorder ✅) | 0.10.0 hero | **`8.3` render pipeline (unbuilt)** | 🟡 |
| 4 | `8.10.3` | Form-designer group nesting + chrome-cell palette | 0.10.0 hero | **`8.4` chrome registry** (OQ-90) | ⚪ |
| 5 | `9.18.8` | Bookmarks highlights & annotations on captured content | 0.10.0 rider | editor text-anchoring on the captured body | ⚪ |
| 5.1 | `Props-3` | Tasks → `<EntityPropertiesPanel>` — needs an ordered host-row slot on the shared panel first | 0.10.0 rider | **SDK slot decision** | ⚪ |
| 5.2 | `Props-4` | Notes → `<EntityPropertiesPanel>` — the one clean migration; its add-picker is shared with the Lexical `/property` command | 0.10.0 rider | **picker decision** | ⚪ |
| 6 | `7.14` (rest) | App badges — OS dock/taskbar aggregation under ONE owner · Chat/Agent/Automations consumers · running-windows strip | 0.10.0 rider | core ✅ | 🟡 |
| 7 | `Lock-3` | Retro-fill the read-only-lock workflow bar (cleanup) | 0.10.0 rider | none | ⚪ |
| 8 | `IE-11` | Background import/export runs (owner call 2026-07-18) | 0.10.0 rider | none | 🟡 |
| 9 | `IE-10e` | Anytype fidelity v2 — source-map binding · layout routing · media widths | 0.10.0 rider | none | 🟡 |
| 10 | `IE-10` | Anytype import — the high-fidelity third-party source | — | a real Anytype JSON export fixture | ⚪ |
| 11 | `Asset-B4` | Encrypted attachment sync — lazy fetch on access (transport ✅; residue is the live 2-device dogfood) | **0.11.0 hero** | `Asset-B3` ✅ | 🟡 |
| 12 | `Asset-B4b` | Eager thumbnail tier (a small always-synced tier) | 0.11.0 | `Asset-B4` | ⚪ |
| 13 | `NAPI-P` | Perf-bottleneck profiling sweep — **gates `NAPI-4` and any new native target** | **0.11.0 hero** | none | ⚪ |
| 14 | `12.15` / `15d` | App-renderer locale propagation — infra ✅; content fan-out is 12/18 apps (missing: bookmarks · calendar · database · graph · journal · notes · tasks · whiteboard) | 0.11.0 rider | infra ✅ | 🟡 |
| 15 | `11.0b` | Tantivy `BenchEngine` comparison vs the FTS5 baseline (measurement only) | GA polish | Tantivy NAPI binding | ⚪ |
| 16 | `6.11` | Window-manager post-v1 tail | GA polish | none | ⚪ |
| 17 | `Connector-7` | Mailbox as the reference connector — proves the contract end-to-end | 0.10.0/0.11.0 | `Mailbox-2` | ⚪ |
| 18 | `Connector-6` | Webhook-in connectors (network ingress) | — | `Net-1` + `11b.8` ✅ | ⚪ |
| 19 | `Mailbox-9` | Official Google/Microsoft OAuth client registration — **org/process task, weeks-to-months of external lead time; start early** | 🔴 GA | external | ⚪ |
| 20 | `LAN-3` | LAN discovery bootstrap — host address in the existing `relayUrl` slot at pair time | infra line | none | ⚪ |
| 21 | `LAN-4` | LAN transport selection + election (`ActiveRelayKind.Lan`) | infra line | **🔴 security review of the inbound-socket path** | ⚪ |
| 22 | `LAN-5` | LAN status UX — "Syncing on local network (no server)" vs "via relay" | infra line | `LAN-4` | ⚪ |
| 23 | `LAN-7` / `LAN-8` | Backfill trigger (automate the LAN-6 resync) · state-vector diff instead of the full-state snapshot | infra line | `LAN-4` | ⚪ |
| 24 | `LAN-9` | Host-side durable tail for the both-peers-absent gap | infra line | **🔴 security review** | ⚪ |
| 25 | `P2P-0` | Portability / design spike — the general transport beyond the LAN slice (discovery · transport · NAT) | infra line | none | ⚪ |
| 26 | `P2P-1` / `P2P-2` / `P2P-3` | General peer discovery + pairing · live exchange with relay fallback · NAT traversal | **0.12.0 hero** | `P2P-0` | ⚪ |
| 27 | `Agent-Teams-1` (rest) | Agents as principals — 1a/1b ✅; the rest of the rung (agents as members everywhere + grant/revoke + audit) | **0.12.0 flagship** | none | 🟡 |
| 28 | `Agent-Teams-2` | Team surface — directory, create/configure, scoped grants | 0.12.0 | `Agent-Teams-1` | ⚪ |
| 29 | `Agent-Teams-3` | **@-mention an agent in a Chat channel** (the hero interaction) | 0.12.0 | `Agent-Teams-1`/`-2` | ⚪ |
| 30 | `Agent-Teams-4` / `-5` | Seeded starter agents · delegation (`delegate` tool, recursive `intersectAgentTools`) | 0.12.0 | `Agent-Teams-1`/`-2` | ⚪ |
| 31 | `MOB-0` | Mobile companion **portability spike** (the `10.0` analogue) — gates the whole MOB ladder | 🟢 GA-only | OQ-MOB-1 position | ⚪ |
| 32 | `MOB-1` … `MOB-8` | `vault-core` extraction · companion scaffold + pairing · sync + local store · read surfaces · capture · reminders · editing · store beta | 🟢 GA-only | `MOB-0` chain | ⚪ |
| 33 | `POLISH-1` | First owner-driven dogfood sweep — files rungs per category | **owner** | none | ⚪ |
| 34 | `VID-notes` / `VID-1` | App-showcase videos — Notes is VID-1 (polish gate PASSED); then one app / week | **owner** | none | 🟡 |
| 35 | 🚩 **GA (`1.0.0`)** | All 19 app ladders ✅ · `11.4` hybrid search + `11.9` AI panel · official OAuth clients (`Mailbox-9`) · full Stage 12/13 · every v1-gating OQ resolved · no open Sev-1/Sev-2 · the polish bar met | 🚩 GA | everything above | ⚪ |
| 36 | `Collab-C5` / `C6` | Sharing UX (finish) · human-facing user identity | v2 line | multi-shell verify | 🟡 |
| 37 | `P2P-4` | Multi-user P2P (shared entities across identities) | v2 | `P2P-2` + collab layer | ⚪ |
| 38 | `Asset-B7` | Attachment sync — multi-user share fan-out | v2 | `Collab-C5` | ⚪ |
| 39 | `14.5`…`14.16` | Billing spine → Paddle/Stripe → quota + AI accounting → compliance | v2 | Stage 14 infra | ⚪ |
| 40 | `14.19`…`14.24a` | Wallet · developer portal · new content kinds · admin-panel client wiring | v2 | Stage 14 | ⚪ |
| 41 | `Account-1` · `DevPortal-1` · `Support-1` · `Ops-1` · `BugTrack-1` · `Site-3` · `Launch-2` | Company/operational infrastructure (out-of-product-repo) — incl. **Product Hunt launch, August 2026** | v2 | org accounts | 🟡 |
| 42 | `Connector-8` · `IE-9` · `DocsHub-1`…`5` · `14.25`–`14.35` | Connector starter set + marketplace content · adapter marketplace · docs hub · paid marketplace activation | v2 / post-v2 | `14.17` | ⚪ |
| 43 | `Community-1–8` · `Chats-1–7` | v2 apps (a dogfood-scoped Chat app slice shipped early 2026-06-20; arbitrary-multi-user Chats stays v2) | 🚩 v2 | org/consumer accounts | ⚪ |

---

**Resume pointer:** `Browser-8` is **complete** (read-only browsing + summarize), so the top of the queue is **`Browser-5`** (row 1) — clip-to-vault, which binds the same Net-3 feeder the summarize path just proved. The train's other hero, Form-designer `8.10.2`/`8.10.3` (rows 3–4), is **gate-blocked on the unbuilt Layouts render pipeline `8.3`/`8.4`** — building that pipeline is the real unlock if 0.10.0 is to close on its named heroes. Two long-lead items deserve starting out of order: **`Mailbox-9`** (row 19 — external OAuth registration, months of lead time, 🔴 for GA) and **`NAPI-P`** (row 13 — it gates every native target). The LAN ladder (rows 20–24) can progress to `LAN-3`, but **must not open a real socket** before the security review. Regenerate the source counts with `bun tools/gen-open-iterations.ts`; this linear file is hand-ordered and updated when dependency state changes.
