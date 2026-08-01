# Implementation plan — at-a-glance table

Scannable remaining-work companion to [implementation-plan.md](implementation-plan.md) (authoritative for pending/in-flight detail). **This file lists only what is NOT done** — one row per open iteration (🟡/⚪/◑), completed (✅) excluded, future work included. This is the same set the dev-vault Tasks app projects (Today + Upcoming), generated from the plan's open bullets via `tools/gen-open-iterations.ts`. Completed narrative + test counts live in [implementation-log.md](implementation-log.md); ✅ history lives in the plan's own bullets + git.

**Legend:** ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · ❌ rejected

**Last updated:** 2026-08-01 (fourth pass — infra merge) — **the infra sweep closed one rung and found that a rung marked done five months ago never shipped its product half.** `Asset-B4b` ✅ (eager thumbnail tier, shell #353) — the code merged 2026-07-28; what kept it 🟡 was that its **packaging gate lived in prose and not in the [ledger](_review/evaluations.jsonl)**, the exact shape "gates are recorded, not asserted" exists to catch. The `electron-builder --dir` dry-run was re-run at main `cf87904c` and appended (addon lands in `Resources/native/`, asar carries the loader + `imageThumbnail`), so the ✅ is now reachable rather than claimed. **The find: `10.3b` ⚠️ corrected and `10.3c` ⚪ filed.** Re-running `012-lan-two-devices` against a real two-shell LAN (rather than re-reading its notes) showed `P2P-1`'s **transport** claim is met — host self-joins in-process, both shells report `transportKind: "lan"`, relay stopped — and its **hero** claim is not: convergence fails with `no DEK for entity`, because **nothing in production ever gives a paired device an entity DEK.** Every production `wrapDekForRecipient` call site addresses this device or a *cross-user* member key (under which two devices of one identity are one recipient); pairing moves the identity secret and roster records but no keys; each device mints its own X25519 pair. `10.3b` shipped the entire *receive* half and went ✅ on an E2E that **hand-builds the wrap production never builds** — so two of one user's devices have never synced in a shipped build, over LAN or relay. The missing producer is `10.3c`, filed with an executable brief (ongoing fan-out + pairing backfill; addressing / ordinal / cost / revocation questions written down). Three stale friction entries corrected against the code: **F-473 ✅** and **F-472 ✅** (fixed in shell #385/#386 and #387), **F-474** re-triaged onto its real cause. `P2P-1`'s "(a) packaging has no run" text was also stale — that gate ran 2026-07-31. **93 open — GA 58 · v2 35** (`Asset-B4b` ✅ −1 · `10.3c` ⚪ +1 — net zero against the third pass). Previously (third pass): **the agent track is drained: `Agent-Teams` is COMPLETE and `Agent-10` was never actually open.** `Agent-Teams-5` ✅ (shell #411) landed single-hop delegation + assignment-driven runs, and the keystone is that there is **no second mechanism**: a delegator is declared one tool per target (`delegate-to-<fingerprint>`) carrying `agents.delegate:<fingerprint>` as its footprint, so the loop's existing `intersectAgentTools` does the scoping and child caps = child ∩ delegator by construction; depth-one is structural (a child's set is built from the propose catalogue alone, so a delegate tool is never offered and a cycle is not expressible). Its **security review, not its pentest, was the finding-bearing pass** — `agentDelegatedBy` had shipped as an ordinary property (a forgeable provenance claim, now RESERVED — the third sibling learned this way) and a `Message/v1` assignment trigger would have re-fired on the run's own report, not looping only by accident of the write path. `Agent-Teams-3` ✅ (shell #409) closed the two items its own slice-2 review left open rather than fixed — the approve path wrote `dekId: null` (fixed by extracting ONE shared mint/wrap/zero seam both `entities.create` and approve route through, differing only in an explicit failure policy), and Chat rendered an Approve button on any message carrying the card property including foreign synced ones (now gated on a shell-authored `Agent/v1` author, fail-closed). A third scoped-out item was **verified rather than assumed** and recorded as confirmed-structural. `Agent-10` ✅ was shipped on 2026-07-18 in `v0.5.1` and simply never flipped. **All five `OQ-AO-*` resolved** (tiered retention · shell-only reads · no debug capture · coalesced denials · no `model-call` rows), unblocking `Agent-12a`, which is in build. **Residue named, not hidden:** the delegation half has no UI, and nothing on the Teams track has had a real-shell or packaged-build exercise. **`Agent-12a` ✅ too** *(shell #414)* — the trace substrate, whose **pentest FAILED first on exactly the kind of finding the track exists for**: the run-count cap was global newest-wins only, so an app looping `beginTurn` could evict every *other* principal's history at the next prune — an audit-erasure primitive aimed at the surface meant to make agents auditable (fixed with a per-principal cap). Metadata-only is pinned by a real property test (200 hostile transcripts, control/bidi/zero-width stripped), and its hooks cover both Agent-Teams-5 run paths. `Agent-12b/12c/12d/12e` are built and gated in shell #415 + #416, awaiting merge. **93 open — GA 58 · v2 35** — the drop from 99 is the five agent rungs above plus `POLISH-APP-1` (whiteboard) and `POLISH-APP-2` (books), which landed in parallel via #195/#197 and whose rows this regeneration also clears (the table had been carrying them as open). Earlier the same day: **the per-app design-polish program is filed** (owner directive: "design quality is still bad… polish each app separately"): `POLISH-APP-0` ✅ (shell #407 — the `check-design-drift.mjs` ratchet: literal colors + px font-sizes per file, shrink-only, `design-ok:` audited exemptions; px font-size drift already ZERO fleet-wide after the chat/journal/books drains) + `POLISH-APP-1..20` ⚪, one rung per app ordered by measured color drift (whiteboard 53 · books 38 · browser 17 · code-editor 14 · graph 13 · …), each = drain baselines + walk [dogfood/app-design-audit.md](dogfood/app-design-audit.md) + extract cross-app findings to SDK/ratchets. **99 open — GA 64 · v2 35** (+20 honest new rungs). Earlier the same day: **the open POLISH batch was drained** (shell #404 **merged** + [shell #405](https://github.com/brainstorm-os/shell/pull/405) open + the harness spec fix): `POLISH-ED-2` ✅ (block markdown shortcuts now convert inside list items — new `ListMarkdownShortcutsPlugin` on `KEY_SPACE_COMMAND`, converting through the extracted `$applyTurnInto`; mounted in `StandardEditingPlugins` + Notes), `POLISH-ED-3` ✅ (`Mod+E` applies inline code; `Mod+Shift+E` stays as alias), `POLISH-PROP-3` ✅ (type-aware relation-picker empty copy via the new optional `linkNoResultsOfType` seam label, 6 locales), `POLISH-DSN-3` ✅ (the Browser new-tab **start page**: most-visited tiles from `BrowsingHistory/v1`, `<EmptyState>` hint, private tabs suppressed; the `WebContentsView` parks at zero bounds like the reader sheet), and `POLISH-LAY-5` ✅ **disproved as a spec artifact** — the dogfood locator (`[aria-label="Today"]`) can never match the DatePager's text-only Today button, the `.catch()` swallowed the miss; an app-level repro (`app-today-nav.test.tsx`) passes on unmodified logic and the spec now clicks `.bs-date-pager__today`. The `918`/`918c`-sweep design rungs `POLISH-DSN-10/11/12` are 🟡 in shell #405 (DSN-10's Neutral-face softening and DSN-12's fill-only chip family are conservative design calls flagged for owner review on the PR); after it, the only open `POLISH-*` rung is the standing `POLISH-1` owner sweep. Table regenerated against the current plan: **79 open — GA 44 · v2 35** (the prior table was one pass stale — it still listed `POLISH-LAY-6/7/8` + `POLISH-FN-1/2`, all ✅ since shell #368/#369). Previously: 2026-07-29 — **`VID-build-apps` is filmable**: the AppForge slice shipped (#364 folder/file sideload · #365 agent `propose-code-file` · #366 install-from-vault), the storyboard was rewritten against real behaviour (the `IDE-0..5` program it depended on was never built and is not needed — there is no build step; an app is `manifest.json` + `index.html`), and the capture pipeline + polish-gate dry-run landed. The dry-run **blocked the shoot** and filed 5 rungs, all since fixed (shell #367/#368/#369) — including two shipped-build bugs it surfaced: the Agent’s "New chat" appended to the previous thread (and silently broke every cross-app "ask the agent" handoff), and a newly installed app’s tile landed on top of Notes. Re-capture pending. Previously: 2026-07-29 (second pass) — **app-tools track filed** (design [platform/78-app-tools.md](platform/78-app-tools.md), rungs `Tool-1..Tool-9`, OQ-TOOL-1..6): installed apps become **typed tool providers, exactly as connected MCP servers already are** — `app.<appId>.<toolName>` mirroring `mcp.<serverId>.<toolName>`, typed args validated **at the broker**, one registry feeding three consumers (other apps' menus · the agent's Tools layer · automation steps). Corrects two shipped limits found in code, not assumed: the agent loop addresses a tool by its **verb alone so two tools collide** (why the Agent ships ONE curated `open` tool) and `AgentTool` has **no input schema**. `Tool-1` is a **shell→app request/response channel that does not exist today** — all ~20 shell→app channels are fire-and-forget and `menu:invoke` is dead (the app preload never subscribes). Also verified: `useContributedActions` has **zero callers**, so AS-2's "adopted by cover/selection/block/slash menus" claim was stale — annotated, residue → `Tool-7`. Design-only — no rung started. **85 open — GA 50 · v2 35** (+9 new ⚪ `Tool-*` rungs; the 7 `AS-5..AS-11` rungs merged hours earlier in #156 are closed ❌ superseded, not deleted — ids stay resolvable per the immutability rule; the 7 `AS-*` rungs it replaces are ❌ so they leave the open set; the prior table also under-counted GA vs. a fresh regen, now corrected). Earlier the same day: the **in-place-actions** track (`AS-5..AS-11`, doc `78-in-place-actions.md`) was filed and merged (#156), then **superseded within hours** by the app-tools reframe above — its rungs are closed ❌ with a content map, its doc renamed to `78-app-tools.md`, and OQ-AS-6..10 marked superseded. Earlier: (fifth pass, 2026-07-28 — 0.11.0 bucket complete) — **`Props-3` + `Props-4` ✅** (shell #356 — Tasks + Notes on the shared `EntityPropertiesPanel`; `extraRows` host-slot + panel-owned picker decisions recorded; −144 lines of bespoke panels) and the **0.11.0 POLISH batch drained** (shell #355 — 4 fixed incl. the fleet-wide `.bs-select`/`.bs-input` face unification; 5 taste-call rungs filed ⚪ for the owner: POLISH-PROP-2, POLISH-DSN-3/4/5, POLISH-LAY-2 — hence the count RISES from 67: honest new work found). **70 open — GA 35 · v2 35.** The 0.11.0 train bucket is complete → release prep. Earlier: (fourth pass) — **`NAPI-4` ❌ closed as a no-op (owner decision)**: NAPI-P measured no budget miss (3.0 ms/tick at the 600-node cap, off-main-thread); the port only mattered for raising the cap past ~1000 nodes and the owner keeps 600. The 0.11.0 train row actualised (both heroes resolved; `6.11` de-scoped as post-v1; POLISH agent sweep in flight). **67 open — GA 32 · v2 35.** Earlier: (third pass — wave-1 merged) — **`Lock-3` ✅** (shell #346 — LockButton/EditableSync dedicated tests, failing-first lock-bypass fixes in calendar drag/bulk/delete + tasks board-drag, SDK `<Icon>` aria-hidden fix), **`Browser-5` ✅** (shell #347 — reader mode + `WebViewMethod.Capture` wired through the Net-2 core with fail-closed `web.capture` enforcement), **`7.14` ✅** (shell #348 — single-owner dock-badge aggregator + Chat/Agent/Automations consumers + running-strip badge), **F-467/F-468 fixed** (shell #349 — feedback-banner polish; open-ladder refusals now surface as a toast + `{signature}` interpolation fix), **F-466 fixed** (shell #350 — the LAN batch's address-inferred admission classification swallowed pre-open inbox subscriptions on any loopback/private relay, dropping share-time WrapBootstraps; LAN trust is now explicit `syncRelay.lan` config and the admission gate holds post-open announces too). **`IE-10` bullet actualised ✅** (shipped v0.5.0, never flipped). Table regenerated: **70 open — GA 35 · v2 35**. Wave 2: **`Connector-7` ✅** (shell #351 — the contract proven in one production-shaped in-process chain; found+fixed a real shipped defect: `mail.fetchAttachment` was capability-denied in every real vault, missing manifest `entities.write:brainstorm/File/v1`) · `Asset-B4b` built (shell #353, packaging dry-run passed macOS) · **`Connector-6` ✅** (shell #352 + #354 — both gates failed-first then passed, runs in the ledger; C1: revoked ingress left endpoints live+syncing, fixed twice over) · `Props-3/4` in flight. Prior passes: **`15d` + `12.15` ✅** (shell #343 merged — the 8 remaining apps' es/de/fr/it/pt packs, 9,095 strings; all 20 first-party apps ship the pack mechanism; residue documented in the 15d bullet: SDK `DEFAULT_*_LABELS` chrome + database `view-settings.ts` module-scope labels). Table regenerated: **74 open — GA 39 · v2 35**. Earlier today: **three closes** (`bun tools/gen-open-iterations.ts` re-run): **76 open — GA 41 · v2 35**. **`Asset-B4` ✅** (shell #341 + harness #133 — the last gate, the live 2-device relay-loop proof: `011-asset-relay-loop.spec.ts` shows A binds → chunks upload on bind → B materialises lazily on first access, byte-identical; surfaced pre-existing **F-466**: collab spec 001 fails `awaitConverged` on an unmodified main baseline — receiver `no DEK for entity`). **`IE-10e` ✅** (shell #340 — Anytype full kind-routing: Task/Bookmark layouts mint native `Task/v1`/`Bookmark/v1` instead of Note twins). **`IE-11` ✅** (shell #340 — export joins the background pattern: `transfer-run-store` generalisation, yields/progress/abort in `exportVaultBundle`, outcome toasts; residue: live-progress dashboard indicator, needs design). `Asset-B4b` (eager thumbnail tier) is now **unblocked** — its gate was Asset-B4. Also in review: **shell #343** — the 8 remaining `15d` apps (incl. journal, missing from the earlier "~6" count) get full es/de/fr/it/pt packs (9,095 translated strings); on its merge all 20 first-party apps ship the pack mechanism and `15d` closes. Carry-over from 2026-07-27: `LAN-2b` remaining item is **(d) revocation, an owner decision** (re-keys real user data through ROT-3a); `LAN-9` gated behind it. 🎉 Public beta shipped 2026-06-29 (`v0.1.5`).

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



## GA — GA / pre-1.0 (release trains 0.8.0→1.0.0) (58)

### Sync, multi-device & E2E encryption *(Stage 10)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `10.3c` | multi-device DEK wrap fan-out (the missing producer) *(filed 2026-08-01 from the P2P-1 cl… | ⚪ pending | none blocking — the primitives all exist |

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
| `POLISH-DSN-10` | the Neutral button variant reads as the heaviest element on a light surface. By design Ne… | 🟡 in flight |  |
| `POLISH-DSN-11` | the Agent's proposal cards wear bespoke chrome. .agent-proposal__btn (Add to vault / Disc… | 🟡 in flight |  |
| `POLISH-DSN-12` | the Marketplace listing detail mixes chip and value faces. On a sideloaded app's detail t… | 🟡 in flight |  |
| `POLISH-APP-3` | Browser (17 literal colors) + rubric audit incl. the new start page. | ⚪ pending |  |
| `POLISH-APP-4` | Code editor (14 literal colors; syntax-theme literals may warrant annotation) + rubric au… | ⚪ pending |  |
| `POLISH-APP-5` | Graph (13 literal colors; canvas draw-loop colors need theme-reactive resolution, not CSS… | ⚪ pending |  |
| `POLISH-APP-6` | Tasks (10 literal colors) + rubric audit incl. the POLISH-DSN-4 follow-up (ghost Group/So… | ⚪ pending |  |
| `POLISH-APP-7` | Files (10 literal colors) + rubric audit. | ⚪ pending |  |
| `POLISH-APP-8` | Database (9 literal colors) + rubric audit. | ⚪ pending |  |
| `POLISH-APP-9` | Calendar (8 literal colors) + rubric audit. | ⚪ pending |  |
| `POLISH-APP-10` | Journal (6 literal colors; font-px drained in #407) + rubric audit. | ⚪ pending |  |
| `POLISH-APP-11` | Preview (6 literal colors) + rubric audit. | ⚪ pending |  |
| `POLISH-APP-12` | Notes (5 literal colors) + rubric audit | ⚪ pending |  |
| `POLISH-APP-13` | Form designer (4 literal colors) + rubric audit. | ⚪ pending |  |
| `POLISH-APP-14` | Bookmarks (1 literal color) + rubric audit. | ⚪ pending |  |
| `POLISH-APP-15` | Chat (mechanical drift drained in #407) | ⚪ pending |  |
| `POLISH-APP-16` | Agent (0 mechanical) | ⚪ pending |  |
| `POLISH-APP-17` | Mailbox (0 mechanical) | ⚪ pending |  |
| `POLISH-APP-18` | Contacts (0 mechanical) | ⚪ pending |  |
| `POLISH-APP-19` | Automations (0 mechanical) | ⚪ pending |  |
| `POLISH-APP-20` | Theme editor (0 mechanical) | ⚪ pending |  |

### App showcase videos *(standing content + polish cadence, `VID-*`; owner-driven, one app / week)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `VID-1` | first episode (owner picks the headliner | ⚪ pending |  |
| `VID-notes` | Notes is VID-1 (owner pick 2026-07-22). Polish gate PASSED | 🟡 in flight | PASSED |
| `VID-build-apps` | "Build a new app inside Brainstorm" | 🟡 in flight | 1 (polish/capture dry-run |

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

### Window manager, menus & shortcuts *(Stage 6)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `6.11` | (post-v1) | ⚪ pending |  |

### Layouts & design system *(Stage 8 + shared fundamentals + covers/pickers)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `8.9` | post-v1 (re-scoped 2026-05-23): react-aria non-menu primitives (dialogs/comboboxes/popove… | ⚪ pending |  |

### Bookmarks *(9.18)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `9.18.8` | Highlights & annotations on captured content + a per-bookmark annotation list. *(gated: n… | ⚪ pending | needs editor text-anchoring on the captured… |

### Mailbox *(group I)*

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Mailbox-9` | official Google OAuth client registration (pre-release, org/process task | ⚪ pending | for |

### Agent observability *(Agent-12

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |

| `Agent-12b` | per-turn timeline (Agent app): expandable "what I did" disclosure per assistant message | ⚪ pending | Agent-12a |
| `Agent-12c` | automation run detail (Automations app): WorkflowRun/v1 drill-in rendering the run's trac… | ⚪ pending | Agent-12a |
| `Agent-12d` | vault-level activity (Settings → AI): runs filtered by surface / app / date / outcome wit… | ⚪ pending | Agent-12a |
| `Agent-12e` | live activity: in-flight runs register with BackgroundActivityStore (named, cleared on co… | ⚪ pending | Agent-12a |


### App tools *(Tool-1..Tool-9

| ID | Task | Status | Gate |
| -- | ---- | ------ | ---- |
| `Tool-1` | the reverse channel (AppCallHost): correlation-id request/response from shell INTO an app… | ⚪ pending |  |
| `Tool-2` | declaration + registry: manifest registrations.tools (name/title/description/input/output… | ⚪ pending |  |
| `Tool-3` | typed arguments: tool inputs described as PropertyDefs (not raw JSON Schema | ⚪ pending | OQ-TOOL-1 |
| `Tool-4` | invocation + capabilities: tools.call({tool, args}); new grants on the existing (appId, c… | ⚪ pending |  |
| `Tool-5` | untrusted-descriptor hardening: a provider's tool name/description reaches the model's pr… | ⚪ pending | OQ-TOOL-4 |
| `Tool-6` | agent projection: projectAppTools → AgentTool-shaped rows carrying the namespaced id (lif… | ⚪ pending | Tool-4 |
| `Tool-7` | menu presentation (closes the AS-2 residue): tools declaring a UI surface render as contr… | ⚪ pending | Tool-2, Tool-4 |
| `Tool-8` | results + lifecycle: proposes-write results render through a shared proposal/diff tray an… | ⚪ pending | Tool-4 |
| `Tool-9` | automations: AgentTool gains the namespaced id + the real input schema so a workflow step… | ⚪ pending | Tool-6 |

## v2 — v2 / post-v2 (commercial · multi-user · marketplace) (35)

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
