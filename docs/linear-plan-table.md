# Linear plan — single-track execution order

A flattened, dependency-ordered march through every open iteration in [implementation-plan-table.md](implementation-plan-table.md). Where the at-a-glance table groups work by app/section, **this file is one ordered list**: do row 1, then row 2, top to bottom. Ordering rules, in priority: **(1) keystones first** (items gating the most downstream work), **(2) beta-blocking before post-beta GA**, **(3) honor the dependency chain within equal priority.** The only hard dividers are real milestones (Beta ship, GA) — not topic sections.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · 🔴 release-blocking · 🟢 GA-only · 🚩 milestone

**Keystones** (everything keys off these — pulled as early as actionable): `9.3.5.V` (Lists→vault entities) · `11.5` (AI broker) · Net-1 / `9.10` (network + Files host). `11.5` and `NAPI-3` are already in flight and run as background threads during the early app runs.

## ✅ Recently completed (newest first)

So progress is visible — this list grows as the open table below shrinks. Completed iterations move **out** of the open table into here; full history lives in git + [implementation-log.md](implementation-log.md).

| Done | ID | Task | Landed |
| ---- | -- | ---- | ------ |
| ✅ | `10.12` | Always-on live-sync — real-shell two-shell co-edit dogfood verified (collab `001`/`002`/`003`: multi-shell co-edit converges through the relay + real durable node, ciphertext durably persisted) | 2026-06-22 |
| ✅ | `SYNC-2` | Durable sync node core (`brainstorm-sync`) — pluggable `SnapshotStore` + client-driven snapshot+tail compaction; OQ-SYNC-3 resolved | 2026-06-22 |
| ✅ | `7.3` | Dashboard widgets host + widget-mode lifecycle (`7.3a` widget set → `7.3b` sandboxed `bswidget://` iframes; OQ-6) | 2026-06-20 |
| ✅ | `9.20.8 → .9 → .10 → .11` | Preview viewers complete — HEIC/HEIF · Office (DOCX/XLSX/PPTX) · 3D (glTF/GLB/OBJ) · RAW | 2026-06-17 |
| ✅ | `9.18.7` | Bookmarks detail body editor — `<BrainstormEditor>` on `UniversalBody/v1` (PR #142) | 2026-06-15 |
| ✅ | `9.18.2b` | Notes paste-URL → embedded-bookmark suggestion handler (PR #143; gate-opener built in-slice) | 2026-06-15 |
| ✅ | `9.21.7` | Books `embedded-highlight` BP block + `/book` slash — last open Books rung (PR #145) | 2026-06-15 |
| ✅ | `9.21.2` | Books EPUB reader — hybrid epub.js parser → existing reflow reader (OQ-BK-1) | 2026-06-15 |
| ✅ | `9.13.11` | Graph click=select + multi-selection + editable inspector property cells | 2026-06-15 |
| ✅ | `B11.17` | Spellcheck custom dictionary — store + `editor.spellcheck.*` capability + Add/Ignore menu actions (a) + Settings manager panel (b); OQ-SP-2 | 2026-06-15 |
| ✅ | `B11.16` | Inline spellchecking — engine + session enablement (a), editable opt-in (b), right-click suggestion menu (c); all 5 prose apps; OQ-SP-1/-3 | 2026-06-15 (`main`) |
| ✅ | `12.4` | a11y / KBN ladder COMPLETE — Database grid cell-nav + in-cell editing closed the last rung | 2026-06-15 |
| ✅ | `13.10` | Packaged-app upgrade path (last beta-blocking 🔴 hardening rung) | 2026-06-15 |
| ✅ | `13.5` / `13.7` | Vault portability test · design-doc consistency | 2026-06-15 |
| ✅ | `13.2` / `13.4` | Bundle-hash recording · stress tests | 2026-06-14 |
| ✅ | `11b.11` | Automations builder UI | 2026-06-14 |
| ✅ | `9.12.6/.9` · `9.13.15` · `9.8.10` | Database view tab strip · Graph Pixi hardening · Files view options | 2026-06-14 |
| ✅ | `9.7.3` | Code-editor core editing — autocomplete/completion popup + per-language keywords (last core rung) | 2026-06-14 |
| ✅ | `9.12.3/.4/.5/.8/.10/.12/.14` | Database `ListView/v1` lifecycle — full rung (predicate compiler → tab strip → grid/list/group) | 2026-06-14 |
| ✅ | `9.3.5.V` | Lists/Collections → vault-level entities (**keystone**) — slices 7a–7d (codec → persist → cross-app → templates) | 2026-06-13 |
| ✅ | `9.23.5` | Contacts inbound address → `Person/v1` resolver (link-to-existing, never auto-create) | 2026-06-10 |

---

## Open work (single-track order)

Reconciled against `implementation-plan-table.md` ground truth, last 2026-06-22. **Stage-10 sync is now in the open table** — the always-on live-sync core (`10.12`), selective-sync policy + Settings picker (`10.13`), and restore-from-zero consumer (`10.14`) all landed and sit `🟡` pending a real two-shell dogfood (`SYNC-2` durable node ✅; cold/lost-keystore restore still gated on account recovery). **The DnD ladder is no longer design-only** — the shell-mediated spine shipped (selection host `DND-1` · drag-session + ghost overlay `DND-2` · drop-target primitive + wire `DND-3` · drag sources `DND-3b` · drop-semantics foundation `DND-4a`), so `DND-1→4` are now `🟡`; remaining is rolling drop targets across apps, file-out, and the a11y twins. **`Collab-C6`** (signed `Profile/v1` + `roster` service + @-mentions + Settings → Identity) landed slice-a `🟡`. **Notes templates** data layer (`B11.10a` `Template/v1` + codec) landed, so `B11.10` is `🟡`. The **AI/Stage-11 push** (`11.4` hybrid search · `11.5` verb set · `11.6`/`11.8`/`11.9` BYO key + provenance + Settings panel) and the **import/export track** (`IE-1…IE-6` + `IE-8` core, merged via #149 + follow-ups) have all **landed but stay `🟡` in the source plan** — each carries a documented residue tail (real vector recall via `11.3`, `extract intoType`/streaming, per-app budgets, IE single-writer rung, etc.), so they remain in the open table below rather than moving to ✅. **R3 Beta gates fully clear** — only the RC-cut milestone stands before Beta.

| # | ID | Task | Run | Gate / dep | Status |
| -: | -- | ---- | --- | ---------- | ------ |
| 1 | `9.3.5.7…N` | per-app shared-object-space migration rungs | R1 Foundation | rides `9.3.5.V` ✅ (not gated — large) | ⚪ |
| 2 | `9.13.10e` | Graph live bucketed event stream (`entities.subscribe`) | R2 Core apps | prior graph-streaming rung (dep-gated) | ⚪ |
| 3 | `9.7.6` | Code-editor inline squiggles + problem list (code ✅) | R2 Core apps | LSP language-server binary (out-of-sandbox) | 🟡 |
| 4 | `B11.10` | Notes templates — **OQ-TPL-1..4 resolved**; data layer (`B11.10a`) + **decision layer** (`buildCreateTemplateMenu`/`draftFromCreateOption`/`objectToTemplateProperties`, +18 tests) landed. Remaining (real-shell): fancy-menu wiring in "+ New" + cross-entity Yjs body copy + editor slash-snippet insert + save-selection-as-template | R2 Core apps | real-shell UI wiring | 🟡 |
| 5 | `9.8.8 → .9 → .10` | Files routes + view options + inspector — **real-shell verified 2026-06-22** (specs 249 inspector property-rows · 233 sidebar + PDF teardown · 175 breadcrumbs/routes nav, all green; folder inspector renders cover/icon/rename — screenshot confirmed). *Note: dogfood specs 068 (`[data-testid=new-folder]`) + 176 (`.bs-cell-plain` name cell) are stale-selector false-fails, not Files bugs — flagged for spec maintenance.* | R2 Core apps | view-options/inspector verified; spec-selector refresh pending | ◑ |
| 6 | `9.17.20` | Whiteboard canvas-renderer perf — **core ✅** (decision + 3 optimized-HTML increments: drag-without-rebuild · viewport-culling · keyed reconcile; jsdom op-cost 4–32×). Residue: real-Electron Playwright frame-time bench (Increment 4), escalate to canvas hybrid only if it misses budget | R2 Core apps | real-Electron bench only (post-beta perf track) | ◑ |
| 7 | `8.10.3 → .4` | Form-designer group nesting → conditions (.2/.5 ✅) | R2 Core apps | 8.4 (OQ-90, post-v1) | ⚪ |
| 8 | `F-229` / residual | Dogfood fixes real-shell verify (dates, clip, mention, props, Pin) | R2 Core apps | real-shell verify only | 🟡 |
| 9 | — | bug burn-down + feature freeze → RC cut | 🚩 BETA `2026-09-01` | R3 gates ✅ | ⚪ |
| 10 | `11.5` | AI broker host service (keystone) — verb set complete (generate/transform/extract/cost); residue: extract `intoType` + token streaming | R4 AI spine | *in flight* | 🟡 |
| 11 | `11.0b / 11.3` | Tantivy bench · bundled embedding model (enables real `11.4` recall) | R4 AI spine | 11.5 ✅ | ⚪ |
| 12 | `11.6 / 11.8 / 11.9` | BYO keys · provenance · Settings → AI panel — **all landed**; residue: real-key round-trip · budget enforcement (14.8) · per-app budgets / routing UI | R4 AI spine | 11.5 ✅ | 🟡 |
| 13 | `Net-3` | live-DOM feeder (web.capture) | R5 Net + Files-host | Net-2 + Browser-1 | ⚪ |
| 14 | `11b.10` | `FileWatch` / `Startup` triggers | R6 Automations | **actionable** (`9.10` ✅) | ⚪ |
| 15 | `11b.6 / .15` | host **deploy landed** (PR #148: session-open reg + entity-change-emitter; security-reviewed, no must-fix) | R6 Automations | real-Electron verify only | 🟡 |
| 16 | `11b.8b` · `11b.7` | **per-origin egress allowlist** (11b.8 HTTP step ✅ PR #148, egress fail-closed pending) · AICall/AIAgent | R6 Automations | **8b actionable** · 11b.7 Stage 11 | ⚪ |
| 17 | `Mailbox-2 → -4 → -5 → -6 → -8 → -9` | Mailbox chain (compose, JMAP/OAuth, threading, triggers) | R7 Connectors | 11b · Stage 11 (9.10 ✅) | 🟡 |
| 18 | `Browser-4 → -5 → -6 → -8` | blocklist · clip · downloads · agentic surface | R7 Connectors | Net-2 · Stage 11 (9.10 ✅) | 🟡 |
| 19 | `Connector-7 → -6 → -8` | Mailbox reference · webhook-in · starter set | R7 Connectors | Mailbox-2 · Net-1 · 14.17 | ⚪ |
| 20 | `Agent-3 → -4 → -5 → -6 → -7` | tools · retrieval · grants · save-as-automation · memory | R7 Connectors | Stage 11 · 11b | ⚪ |
| 21 | `IE-7` · `IE-8` tail · `IE-9` | remaining import/export tail — authenticated-API Source (IE-7) · external scheduled export (IE-8) · marketplace (IE-9, v2). **IE-1/-2/-3/-4/-5/-6 + IE-8 core all landed** | R8 Import/export | IE-7 → Connector framework + IE-6 ✅ · IE-8 tail → OQ-186 egress | 🟡 |
| 22 | `Welcome-2` | vault template gallery — first-launch UI (7d core ✅) | R8 Import/export | not gated — gallery-UI branch merged; verify/close | 🟡 |
| 23 | `DND-4 → -5 → -6` | cross-app drag-and-drop ([65](platform/65-object-selection-and-cross-app-dnd.md)) — **spine landed 🟡** (DND-1 selection host · DND-2 drag-session + ghost overlay + `WindowIndex` hit-test · DND-3 drop-target primitive + wire reconcile · DND-3b drag sources · DND-4a drop-semantics); remaining: roll drop targets across apps (DND-4) · file-out via `startDrag` (DND-5) · keyboard/a11y twins (DND-6) | R8 platform interop | spine ✅; not beta-blocking | 🟡 |
| 24 | `10.13 / 10.14` | sync — selective-sync policy + Settings picker (10.13) · restore-from-zero consumer (10.14); `10.12` co-edit ✅ verified + `SYNC-2` durable node ✅ | R9 Collab + sync | cores landed; remaining: **wipe-and-restore dogfood** (10.14) + cold/lost-keystore gated on account recovery | 🟡 |
| 25 | `Collab-C6` | human-facing identity — **slice-a landed 🟡** (signed `Profile/v1` · `roster` service · chat/comment @-mentions · Settings → Identity) | R9 Collab + sync | remaining: petname UI · Contacts registry; cross-user mention sync gated on C5 | 🟡 |
| 26 | `Collab-C5` | sharing UX (dialog, roles, presence) + authorization | R9 Collab + sync | not gated — multi-shell verify | ⚪ |
| 27 | `10.10 / 10.11` | G2 perf tails (`NAPI-3` crypto consolidation ✅ — native XChaCha, `@noble` dropped, `5e8ca5c5`) | R9 Collab + sync | post-beta GA | 🟢 |
| 28 | `14.1…14.16` | billing spine → Stripe/Paddle → quota/AI accounting — **billing-edge backend landed in `brainstorm-cloud`** (`14.2/14.3/14.4/14.7/14.12/14.13`); in-product Settings→Billing UI (`14.6`/`14.1`) + AI accounting (`14.8`) pending | R10 Commercial | Stage 14 billing infra | 🟡 |
| 29 | `14.19…14.24` + infra | wallet · dev portal · company infra (Site/Account/Ops/Support) — **out-of-repo in [`brainstorm-cloud`](https://github.com/<owner-account>/brainstorm-cloud)**; backlog in its `docs/plan.md`, tracked in-vault as `seed_proj_cloud`. Landed: `billing-edge` (Phase 2 complete) + `apps/account` portal + self-serve Checkout; entitlement contract (`14.3` keystone) | R10 Commercial | Stage 14 infra | 🟡 |
| 30 | `Community-1–8` · `Chats-1–7` · `DocsHub-1–5` · `14.25–28` | v2 apps · paid marketplace activation | 🚩 v2 | — | ⚪ |

---

**Resume pointer:** R2 Core-apps tail (`9.3.5.7…N`, Files `9.8.x` verify, Whiteboard `9.17.20`, code-editor `9.7.6`) is the top of the open list before the RC cut. The Stage-10 sync cores (`10.12`/`10.13`/`10.14`) need a real **two-shell dogfood** to flip 🟡 → ✅ (the durable-node E2E harness already co-edits two real shells). The AI spine (`11.x`) is now mostly landed — `11.3` bundled embedding model is the next real unblock there (enables `11.4` recall). Regenerate the source counts via `bun tools/gen-open-iterations.ts`; this linear file is hand-ordered and updated when dependency state changes.
