# Implementation plan — at-a-glance table

Scannable remaining-work companion to [implementation-plan.md](implementation-plan.md) (authoritative for pending/in-flight detail). **This file lists only what is NOT done** — one row per open iteration (🟡/⚪/◑), completed (✅) excluded, future work included. This is the same set the dev-vault Tasks app projects (Today + Upcoming), generated from the plan's open bullets via `tools/gen-open-iterations.ts`. Completed narrative + test counts live in [implementation-log.md](implementation-log.md); ✅ history lives in the plan's own bullets + git.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · ❌ rejected

**Last updated:** 2026-08-10 — **table regenerated from the plan after five weeks of hand-edits.** The previous "61 open" was wrong in both directions: it listed `10.3c` and `Tool-7b` as pending months after they shipped, and it was missing twelve open iterations the plan already carried (`10.15`, `Catalog-2`…`Catalog-8`, `Ops-2`, `14.36/37/38`, and `10.3c`'s residue). `10.3c` ✅ (producers landed 2026-08-03, both gates passing); residue split out as `10.3d`. **77 open — GA 34 · v2 43.**

<!-- PASS LOG — append-only, ONE short bullet per pass, newest FIRST. Never
     rewrite or absorb earlier bullets (that megaparagraph was the repo's worst
     merge-conflict magnet). Full pass narratives belong in
     implementation-log.md; anything older than the list below is in git
     history of this file. -->

### Pass log

- **2026-08-10 · `0.14.0` train defined — cut 2026-09-01, design polish is the hero** *(owner directive)*. Also corrected: **`0.13.0` shipped** (tagged 2026-08-03, published 2026-08-05 on GitLab, 18 assets) while the plan still described it as uncut — and it was cut **with its own gate undrained** (`Tool-8`/`Tool-8b` open on the tag date, `F-486` open), which is now recorded on the train row rather than smoothed over. The design program (`POLISH-DSN-13` audit → `DS-face-audit-1` systemic → `POLISH-DSN-14` local) is written to defeat the specific way polish failed twice: `POLISH-APP-0..20` drove the drift ratchet to an **empty baseline across all twenty apps** and the owner then found the fleet broken anyway (`F-486`), because a colour/px ratchet cannot see misalignment, lookalike primitives, UA-default chrome, or a control that is the wrong height beside its neighbour. **Judged from screenshots, both themes, findings filed before any is fixed, and anything appearing in two apps becomes a `DS-*` primitive + ratchet rather than a per-app patch.** **77 open — GA 34 · v2 43.**
- **2026-08-10 · plans actualised (no feature work)** — the table had drifted from the plan for five weeks because regeneration is a manual copy-paste of `gen-open-iterations.ts`'s stdout, and nothing failed when it was skipped. Corrected: `10.3c` ⚪→✅ (shell #466/#467/#468, both gates passing 2026-08-03 in the [ledger](_review/evaluations.jsonl)); its residue promoted to `10.3d` so it survives the parent going ✅; `10.15` moved out from between `10.3c` and its own sub-bullets, where it had been silently orphaning them. **Three open items had no iteration id at all** and so were dropped by the generator with no signal — Files' shell bootstrap (now `9.8.2c`), the 9.18.6 scrape residue (now `9.18.6b`), and `10.3c`'s residue. The generator now **exits 1 and names them** rather than dropping them, which is the actual fix: the silence was the bug. **74 open — GA 31 · v2 43** (was reported as 61).
- **2026-08-02 · editor rungs filed AND driven (owner request)** — `B11.19` slash-menu sections **built + merged same day** ✅ (shell #449 @ `e34368a5`: Lists/Layout/Advanced categories + residue re-taxonomy, sectioned browse view / flat ranked filter view, drift-fence; real-shell verified, dogfood probe 931) + `B11.20` external embed-block family: **(a) design ✅** (doc 15 §External web embeds + doc 38 provider reconciliation; v1 = YouTube + Google Maps, click-to-load mandatory for Maps), (b) build pending. Found + filed `F-485` (perf-launcher app windows open 0-width, pre-existing on main). **69 open — GA 34 · v2 35.**
- **2026-08-02 · app-tools track complete through Tool-9** — `Tool-5` ✅ (#436), `Tool-6`/`Tool-8`(approval half)/`Tool-9` ✅ (#442). OQ-TOOL-2 → coexist; OQ-TOOL-4 applied (sideloaded tools never reach the model's prompt); OQ-TOOL-5 → effect × initiator. The reviews found two shipping regressions of the same shape — a working path removed before its replacement landed (Tool-5's approval could never be minted; Tool-8's prompt had no receiver) — plus a workflow capability ceiling that did not bind app-tool calls. Residue split honestly: `Tool-7b` (editor surfaces) and `Tool-8b` (proposal tray · refusal chips · argument prompt · trace row, the last gated on OQ-TOOL-6).

- **2026-08-02 · Tool-5 rug-pull re-prompt** — an app UPDATE can no longer rewrite an approved tool and inherit the friction the old wording earned. The review caught the rung shipping a regression that would have made EVERY app tool permanently uncallable (the caller derived `confirmed` from `effect` alone, so an unapproved `pure` tool could never record its approval) — the rung's own tests missed it because the fixture pre-approved everything. Four more fixed: fail-closed on an unreadable store, the Changed reason now reaches the human, approvals keyed per caller, re-baseline only after success.

- **2026-08-02 · Tool-7 object-menu surface** — app tools render in the object ⋯ menu through the SAME AS-4 policy (projection + one shared inline cap), invoked via `tools.call` with a real refusal seam rather than the intent precedent's fire-and-forget. Three defects the rung's premise missed: the shared `dedupe` would have collapsed every tool into one row (the very verb collision this track removes), `tools.list` never stamped a trust tier so the quarantine could not apply, and it would have listed tools the caller could not call — dead menu rows. `Tool-7b` filed for the three EDITOR surfaces, blocked on `BlockCommand.run` being sync/void with nowhere to report a named refusal.

- **2026-08-02 · Tool-4 + OQ-TOOL-5 settled** — `tools.call` ships: cross-app invocation gated by `tools.provide` / `tools.call:<appId>[/<name>]`, with authorization checked BEFORE the registry so error codes cannot enumerate installed tools. `allowedTypes` enforced against the entity store. Friction = effect × initiator, initiator derived from the verified principal; an agent-initiated confirm is refused rather than self-approved. Two of the rung's own premises were wrong (`decideToolFriction` not reusable; no `mcp.tool:` capability to mirror) and are corrected in doc 78. **The pentest failed the rung first** — two working exploits (a narrow per-tool grant readable as a broad one; `javascript:`/`file:` URLs passing a `format:url` argument because it was enforced with a *display* validator) plus three proven-latent ones — all five fixed in-PR and pinned. `main` CI went GREEN on the Tool-3 merge — first pass since #428.

- **2026-08-02 · Tool-3 + OQ-TOOL-1 settled** — owner picked `PropertyDef` over JSON Schema ("safer wins"), so arguments are validated **at the broker before the call reaches the provider** and the model's JSON Schema is projected from the same declaration. Security review found three real defects (unscreened `pattern`/`allowedTypes` reaching the model prompt; `null` passing every constraint; a `date` value passed by reference) — all fixed in-PR. Also fixes `main`'s red CI, red since Tool-2 (#428) on a mis-anchored `biome-ignore`. **68 open — GA 33 · v2 35** (the count fell 88 → 68 because the table had not been regenerated since the polish drain).
- **2026-08-01 · drift baseline EMPTY** — `POLISH-APP-8..11/13/14` drained (shell #420/#421/#422/#423) + APP-12 Notes mechanical half; `tools/design-drift-baseline.json` is now **0 literal colors + 0 px font-sizes across all 20 apps** (born at 194+24 in #407). Remaining polish = judgment audits APP-15..20 + Notes' deep pass.
- **2026-08-01 · agent track closes** — `Agent-12b/c/d/e` ✅ (shell #416; #415 closed as fully absorbed): per-turn timeline, automation run detail (proven failing-first twice), Settings→AI activity (privileged IPC, no app capability), live dashboard chip. Agent track = zero open rungs; residue stated: no delegation UI, no real-shell/packaged exercise. **88 open — GA 53 · v2 35.**
- **2026-08-01 · infra merge** — `Asset-B4b` ✅ (packaging gate re-run + appended to the ledger); the find: `10.3b` shipped only the receive half — nothing in production wraps a DEK for a paired device, so `10.3c` (the missing producer) is filed. F-472/F-473 corrected against code. **93 open — GA 58 · v2 35.**
- **2026-08-01 · agent drain** — `Agent-Teams-5` ✅ (shell #411, delegation with no second mechanism), `Agent-Teams-3` closure ✅ (#409), `Agent-10` ✅ (shipped v0.5.1, never flipped), all five `OQ-AO-*` resolved, `Agent-12a` ✅ (#414 — pentest failed first on a cross-principal audit-erasure primitive, fixed per-principal). **93 open — GA 58 · v2 35.**
- **2026-08-01 · polish program filed** — owner directive; `POLISH-APP-0` ✅ (shell #407 drift ratchet) + `POLISH-APP-1..20` ⚪ one rung per app by measured color drift; `POLISH-APP-1..7` drained the same day (shell #408/#410/#412/#413/#417/#418/#419). Earlier: the open POLISH batch drained (#404 merged, #405 DSN calls for owner).
- **2026-07-29 · VID-build-apps filmable + app-tools track filed** — AppForge slice shipped (#364..#366) + capture pipeline; `Tool-1..9` filed (doc 78) superseding the same-day `AS-5..11` (closed ❌ with content map). **85 open — GA 50 · v2 35.**
- **2026-07-28 · 0.11.0 bucket complete** — `Props-3/4` ✅ (#356), POLISH batch drained (#355), `NAPI-4` ❌ (owner keeps the 600-node cap), wave-1/2 closes (`Lock-3` · `Browser-5` · `7.14` · `Connector-6/7` · F-466 root-caused), `15d`/`12.15` locale fan-out ✅ (#343). **70 open — GA 35 · v2 35.**

Older passes: see this file's git history and [implementation-log.md](implementation-log.md). 🎉 Public beta shipped 2026-06-29 (`v0.1.5`).

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

## GA — GA / pre-1.0 (release trains 0.8.0→1.0.0) (34)

### Sync, multi-device & E2E encryption *(Stage 10)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `10.3d` | 10.3c residue: one roster read per pass + the two-device dogfood *(split out of 10.3c 202… | ⚪ pending |  |
| `10.15` | multi-identity vaults *(filed 2026-08-08 from F-493; owner position taken: build real mul… | ⚪ pending |  |

### Peer-to-peer sync *(`P2P-*` design spike; the concrete LAN slice shipped early as `LAN-*`

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `P2P-1` | : LAN peer discovery + the dial flow; own-device-only (single identity, multi-device) *(0… | ⚪ pending | P2P-0 ✅ |
| `P2P-2` | : live update exchange on the peer channel with relay fallback + reconciliation on reconn… | ⚪ pending | P2P-1 |
| `P2P-3` | : re-scoped by P2P-0 from "NAT traversal" to direct connectivity wherever the network alr… | ⚪ pending | P2P-2 |

### LAN P2P sync *(the track-C wedge

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `LAN-9` | host-side durable tail for the both-peers-absent gap | ⚪ pending |  |
| `LAN-2b` | close the security gate (NEW 2026-07-26, gates LAN-4/LAN-9). The gate found the load-bear… | ⚪ pending | (NEW 2026-07-26, gates LAN-4/LAN-9 |

### Product polish & dogfood hardening *(standing quality track, `POLISH-*`; owner-driven)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `POLISH-1` | first owner-driven dogfood sweep (open): owner walks the fleet and files rungs per catego… | ⚪ pending |  |
| `POLISH-DSN-13` | fleet screenshot audit, all twenty apps + shell + Settings, both themes *(the 0.14.0 desi… | ⚪ pending |  |
| `DS-face-audit-1` | systemic defects from POLISH-DSN-13 get a primitive + a ratchet. One rung per shared face… | ⚪ pending |  |
| `POLISH-DSN-14` | app-local defects from POLISH-DSN-13. The residue that genuinely is one app's problem. Ga… | ⚪ pending |  |

### AI broker & vector / hybrid search *(Stage 11; lexical half shipped early as Shell 9.22)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `11.0b` | Tantivy comparison: wire a Tantivy BenchEngine adapter against the same harness, re-run t… | ⚪ pending |  |

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

### Dev tooling & self-hosting *(Stage 0 dev-MCP + SH ladder + cross-cutting tracks)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `SH-41` | GitLab CI port *(verify + e2e-smoke proven green 2026-08-06; pipelines DISABLED 2026-08-07 | 🟡 in flight |  |

### Window manager, menus & shortcuts *(Stage 6)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `6.11` | (post-v1) | ⚪ pending |  |

### Layouts & design system *(Stage 8 + shared fundamentals + covers/pickers)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `8.9` | post-v1 (re-scoped 2026-05-23): react-aria non-menu primitives (dialogs/comboboxes/popove… | ⚪ pending |  |

### Marketplace surface *(Stage 14.17–14.18, preview)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `14.36` | launch-time bundle-integrity re-verification (32 §1). hashBundleDirectory runs at install… | ⚪ pending |  |
| `14.37` | threat-intel feed client + quarantine flow (32 §3 + §Quarantine flow). Poll each subscrib… | ⚪ pending |  |
| `14.38` | app-impersonation detection at install (32 §5). Fuzzy name + publisher-key disambiguation… | ⚪ pending |  |

### Notes (text-editor) *(9.6)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `B11.20` | External embed-block family *(owner request 2026-08-02 | 🟡 in flight | (a |

### Files (file-manager) *(9.8)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.8.2c` | Files shell bootstrap | ⚪ pending |  |

### Bookmarks *(9.18)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.18.6b` | scrape residue: author / publishedAt scrape; the typed-fields → property-backed migration… | ⚪ pending |  |
| `9.18.8` | Highlights & annotations on captured content + a per-bookmark annotation list. *(gated: n… | ⚪ pending | needs editor text-anchoring on the captured… |

### Mailbox *(group I)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Mailbox-9` | official Google OAuth client registration (pre-release, org/process task | ⚪ pending | for |

### App tools *(Tool-1..Tool-9

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Tool-8b` | results + lifecycle, the presentation half *(chips: shell #446 merged; tray + argument pr… | 🟡 in flight | OQ-TOOL-6 (trace row only |
| `Tool-8` | results + lifecycle *(shell #442, 2026-08-02)* <gates: security-review> | 🟡 in flight |  |

## v2 — v2 / post-v2 (commercial · multi-user · marketplace) (43)

### Peer-to-peer sync *(`P2P-*` design spike; the concrete LAN slice shipped early as `LAN-*`

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `P2P-4` | : multi-user P2P (shared entities across identities): only after Collab-C5/C6 land. gate:… | ⚪ pending | P2P-2 + collaborative-sync layer |

### Collaboration layer

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Collab-C5` | sharing UX. Core ✅ (built, was mis-marked): the <ShareDialog> (packages/sdk/src/share-dia… | 🟡 in flight | in the envelope pipeline, isAuthorizedWrite… |
| `Collab-C6` | human-facing user identity (slice (a) ✅ shipped; (b) + (c) + (d) NOT BUILT, audited 2026-… | 🟡 in flight |  |
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
| `Catalog-2` | deploy the official catalog origin. Blocks Launch-2 (Product Hunt) *(scoped 2026-08-03)*.… | ⚪ pending |  |
| `Catalog-3` | production key ceremony + rotation drill. Blocks Launch-2 (Product Hunt) *(scoped 2026-08… | ⚪ pending |  |
| `Catalog-4` | bundle object store + CDN (cloud 3.4c production half). Blocks Launch-2 (Product Hunt) *(… | ⚪ pending |  |
| `Catalog-5` | close the CI publish loop. Blocks Launch-2 (Product Hunt) *(scoped 2026-08-03)*. .github/… | ⚪ pending |  |
| `Catalog-6` | automated submission review *(post-PH; gates third-party submissions)*. catalog-admin's r… | ⚪ pending |  |
| `Catalog-7` | third-party publishing tooling *(post-PH)*. Publishing today is the internal tools/publis… | ⚪ pending |  |
| `Catalog-8` | catalog discovery producers *(post-PH)*. Discover currently mirrors Browse, and Marketpla… | ⚪ pending |  |
| `Ops-2` | marketplace policy + legal surface *(post-PH; gates third-party submissions)*. Nothing ex… | ⚪ pending |  |
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
