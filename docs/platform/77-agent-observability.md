# 77 — Agent observability (runs, traces, denials)

The governed-agent story ([67 §Thesis](../foundations/67-ai-native-company.md)) rests on three legs: agents act with **scoped**, **audited**, **revocable** permissions. Scoping is real (the three-tier fail-closed intersection, [55 §Capabilities](../apps/55-agent-app.md)); revocation is real (the `CapabilityLedger`, per-conversation grants). The *audited* leg is today an architecture stance, not a product surface: [69](69-agent-teams-and-orchestration.md) promises "what this agent did is a query", but the rows that query would read do not exist, and nothing shows the user what an agent actually did in a turn beyond "Used …" chips and the artifacts it created. This doc specifies the missing layer — a **per-run trace substrate** written by the shell, and the **user-facing surfaces** that make an agent's actions legible: what it called, what it touched, what was proposed and approved, and — most important — **what was denied**.

The sharpest motivation is the denial case. Fail-closed is the right security posture, but its failure mode is *silence*: a tool the ledger refuses returns `Unavailable` and the model routes around it. A shipped bug proved the cost — capability scopes were silently stripped on the way to the renderer, the agent's tool offering silently collapsed, and nothing anywhere said so; diagnosis took an investigation that one visible denial counter would have made a one-glance read. Observability is how fail-closed stays debuggable — for the user *and* for us.

It builds on [22-ai-foundations.md](22-ai-foundations.md) (§Provenance — the per-call usage log + `ai_usage` accounting this doc extends from *calls* to *runs*), [55-agent-app.md](../apps/55-agent-app.md) + [62-agent-harness.md](62-agent-harness.md) (the loop, tools, and the `tool-refused` step this doc persists durably), [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md) (`WorkflowRun/v1` — the second front-end of the same loop), [69](69-agent-teams-and-orchestration.md) (per-principal attribution, forward-compat), [64-mcp-integrations.md](64-mcp-integrations.md) (its per-call audit rows join this substrate), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (the audit-log posture), and [12-shell-architecture.md §Observability](../shell/12-shell-architecture.md) (the standing decision: **nothing leaves the device**).

## What exists vs. what's missing

| Piece | Status | Where |
|-------|--------|-------|
| Per-call AI usage (app, verb, provider, model, tokens, outcome, duration) | ✅ shipped (11.8 / 14.8) | `ai-usage-log.ts` JSONL + `ai_usage` in `account.db` |
| Non-forgeable creation provenance on agent-created entities | ✅ shipped (Agent-11c) | `agentProvenance` property, stamped server-side |
| Transient tool steps on messages (`toolCalls`, incl. `tool-refused`) | ✅ shipped (Agent-3/5) | `Message/v1` — per-message, chat-only, not queryable |
| MCP per-call audit (arg-shape only) | ✅ shipped (MCP-1) | `main/mcp/` |
| Live background-operation surface | ✅ shipped | `BackgroundActivityStore` + dashboard chip |
| **Per-run trace: one queryable record of a turn/run and its events** | ❌ missing | this doc |
| **Denial visibility (which calls were refused, which cap was missing)** | ⚠️ chat-only, transient | this doc |
| **"What did agents do to this vault/entity" query surface** | ❌ missing | this doc |

## Principles

> **Decision:** agent observability is **user-facing legibility, not vendor telemetry.** Every record is local, per-vault, and readable only on the user's own surfaces. The [12 §Observability](../shell/12-shell-architecture.md) decision is unchanged: nothing leaves the device; opt-in telemetry, if ever, is itemized and separate. Third-party tracing services are out of scope permanently.

> **Decision:** **metadata only, by construction.** A trace row records *what happened* — tool name, target entity id, capability checked, outcome, timing — never prompt or completion bodies and never raw tool-call argument values (the MCP audit's "arg-shape only" rule generalizes to every tool). This is the 11.8 posture extended: the trace must be safe to keep, safe to render, and boring to leak. Whether a debug-grade full capture ever exists (default-off, explicit consent, self-expiring) is OQ-AO-3 — the substrate does not depend on it.

> **Decision:** **the shell writes the trace, never the model and never the app.** Rows are emitted at the chokepoints the architecture already owns — the broker's service dispatch (cap check → outcome), the shared `runAgentLoop` host seam (`dispatchTool` / propose interception), and the approve gesture (proposal → persist). An app cannot forge a row about another app (the broker stamps identity from the verified envelope, exactly as `agentProvenance` does), and a prompt-injected model cannot suppress one. Trace writes are best-effort fail-soft (a full disk never breaks a turn — same contract as `recordAiUsage`), but *emission* is not optional per-app: any surface driving the shared loop is traced.

> **Decision:** **one substrate, both front-ends.** A chat turn (Agent app) and an automation run (`WorkflowRun/v1`) produce the same record shape, distinguished by a `surface` discriminator. There is one loop ([55 §One engine](../apps/55-agent-app.md)); there is one trace. MCP tool calls, retrieval, propose/approve, and future delegation hops ([69](69-agent-teams-and-orchestration.md)) are event kinds within it, not parallel systems.

## The data model

Two tables in `account.db` beside `ai_usage` (same migration discipline, same repo pattern — no inline SQL outside the repo):

**`agent_runs`** — one row per turn/run: `id`, `surface` (enum: `chat` | `automation`), `conversation_id` / `workflow_run_id` (one set, per surface), `agent` (the acting principal — today the app id, forward-compat with [69](69-agent-teams-and-orchestration.md)'s `Agent/v1` identity), `started_at`, `ended_at`, `outcome` (enum: `ok` | `error` | `refused` | `budget` | `aborted`), `denial_count` (denormalized — the header badge reads one column).

**`agent_events`** — ordered events within a run: `run_id`, `seq`, `kind` (enum: `model-call` | `retrieval` | `tool-call` | `tool-denied` | `proposal-staged` | `proposal-approved` | `proposal-discarded` | `mcp-call` | `error`), `tool` (verb or provider/model), `target_entity_id` (nullable), `capability` (the cap checked; for `tool-denied`, **the cap that was missing** — the row that makes a denial actionable), `outcome`, `duration_ms`.

Token/cost accounting stays in `ai_usage`, which gains a **nullable `run_id`** (OQ-AO-5 resolved: no `model-call` event kind exists — the timeline derives its model steps from the join, so token/cost numbers have exactly one home). Retention is a bounded window — **both** count- and age-capped, with periodic pruning like `AiUsageRepo.prune`: events ~30 days, run rows ~12 months (OQ-AO-1 resolved). The trace is an operational record, not an archive; `agentProvenance` on the entity carries the permanent half.

## The surfaces

Four consumers of the one substrate, in value order:

1. **Per-turn timeline (Agent app)** — each assistant message gains an expandable "what I did" disclosure: the run's events in order — searched, read, called, staged, and *was denied* — with denials named ("couldn't call `open`: this conversation doesn't grant `intents.dispatch:open`") and wired to the existing Agent-5 escalation prompt. This upgrades the transient `toolCalls` chips into an honest, durable account. The chat renders its *own* runs — no new read capability, the data mirrors what the conversation already displayed.
2. **Automation run detail (Automations app)** — a `WorkflowRun/v1` drill-in showing the run's trace: which steps called which tools with what outcome. Turns "the automation ran / failed" into "the automation did *this*".
3. **Vault-level activity (Settings → AI)** — beside the usage panel: filter runs by surface / app / date / outcome, "denials only" as a first-class filter, click-through to the entity or conversation. This is the [69](69-agent-teams-and-orchestration.md) "what this agent did is a query" surface, shipped before agent teams need it. Per-entity history ("what agents did to *this* object") rides the `agentProvenance` back-link plus a `target_entity_id` query. Renders in the privileged shell renderer — no new app-facing capability.
4. **Live activity (dashboard chip)** — an in-flight agent run registers with `BackgroundActivityStore` like any indexing/sync operation: visible while running, named, cleared on completion. No new mechanism.

## Security posture

No new trust primitive. The trace is written by the shell at existing chokepoints; reads are shell-renderer surfaces plus each app's view of its own runs. Three properties are load-bearing and pinned by tests: **non-forgeability** (identity comes from the broker-verified envelope, never caller input), **metadata-only** (no prompt/completion/arg-value bytes in any row — a property test over the record codec, not a code-review hope), and **injection-inertness** (every stored string that originated in model output or tool results — tool names are ours, but error strings are not — is bounded, control-stripped, and rendered as text, never markup). Trace rows *are* sensitive metadata (they name entities and habits): they live inside the vault's at-rest posture like every other per-vault DB, and they never cross IPC in raw form — surfaces get bounded, paginated projections. New read surface ⇒ security-review + pentest gate per the workflow standards.

## Non-goals

- **External tracing / eval SaaS** (LangSmith-style) — violates the local-only decision and the sovereignty pitch.
- **Engineering telemetry** — this is a product surface for the user; the dev-side story stays the shell log + `ai-usage-log` JSONL.
- **Full prompt/response recording by default** — see OQ-AO-3; the substrate is deliberately complete without it.
- **Deterministic replay** — recording enough to *re-execute* a run is the code-runner's problem (OQ-AH-4) and out of scope here; the trace records what happened, not how to reproduce it.
- **Cross-vault aggregation** — a vault is the boundary, as everywhere.

## Open questions

**All five resolved 2026-08-01** — the track's gate is clear and `Agent-12a` builds to these positions. **OQ-AO-1** (retention): tiered — `agent_events` ~30 days, `agent_runs` ~12 months, **both** additionally count-capped, pruned on the `AiUsageRepo.prune` shape; `agentProvenance` is permanent regardless. **OQ-AO-2** (app-facing reads): shell-surfaces-only — no `agent.trace:read` capability is built. **OQ-AO-3** (debug capture): no — metadata-only is absolute in v1. **OQ-AO-4** (denial posture): active-but-coalesced in chat via the existing Agent-5 escalation prompt, passive badge for automations. **OQ-AO-5** (`model-call` granularity): no `model-call` rows at all; `ai_usage` gains a nullable `run_id` and the timeline derives model steps from the join. Ledger: [11-open-questions.md](../reference/11-open-questions.md).

## What this doc does **not** cover

- The agent loop, tools, or context assembly — [55](../apps/55-agent-app.md) / [62](62-agent-harness.md).
- Token accounting and budgets — [22 §Provenance](22-ai-foundations.md), `ai_usage` (14.8).
- Agent identity as a principal — [69](69-agent-teams-and-orchestration.md); this doc only keeps an `agent` column ready for it.
- The security audit log's non-AI events — [09](../security/09-security-and-sandbox.md).
