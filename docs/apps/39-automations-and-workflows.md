# 39 — Automations and workflows

This doc introduces a first-party **automations app** (`brainstorm.automations`) and the canonical entity types it brings: `brainstorm/Workflow/v1`, `brainstorm/WorkflowRun/v1`, `brainstorm/Reminder/v1`, and `brainstorm/Trigger/v1`. It closes a gap common in prior local-first tools: no reminders and no automations, so the product can't be used as a task tracker or a workflow tool. Brainstorm fixes that — not by bolting reminders into the shell, but by adding **one app whose job is to connect every other app**.

It builds on [03-app-model.md](03-app-model.md) (apps as packages, no background daemons), [08-app-sdk.md](08-app-sdk.md) (host services + intents), [17-interoperability.md](../platform/17-interoperability.md) (intents are *the* cross-app vocabulary), [22-ai-foundations.md](../platform/22-ai-foundations.md) (AI surfaces — the AI broker is what lets a workflow step call a model), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capabilities — a workflow can only do what its containing app may do), [25-settings.md](../shell/25-settings.md) (per-workflow settings live in the user's vault), and [38-network-and-proxy.md](../security/38-network-and-proxy.md) (webhooks / outbound HTTP go through the network broker).

## Why a dedicated app, not a shell feature

Two failure modes to avoid:

- **The prior-local-first miss** — no reminders, no automations, so the product can't serve "I need to be nudged on Thursday" or "when a Task is marked Done, archive it." Users fall back to other tools and the knowledge graph fragments.
- **The "automations bolted onto every database" approach** common in cloud workspaces — reminders live on tasks, automations live on databases, each surface invents its own builder. Users learn three half-grammars instead of one full one.

> **Decision:** **all** scheduled, triggered, and chained behavior in Brainstorm goes through one app with one builder and one mental model. A reminder is a degenerate workflow (one time-trigger → one notification step). A multi-step n8n-style automation uses the same primitives. Apps that need "remind me" or "when X happens, do Y" don't ship their own builders — they dispatch intents *into* the automations app, which surfaces the builder.

> **Decision:** the automations app is **first-party** (bundled with the shell, like file-manager and theme-editor — see [03 §Multiple windows / kinds](03-app-model.md)). It is not "owned" by the shell — the shell *executes* triggers, the *app* designs and visualizes them. Same split as file-manager and the Folder type (per [30-file-manager-and-folders.md](30-file-manager-and-folders.md)).

## The four mechanisms it composes

The automations app is interesting because it doesn't introduce new primitives — it composes the four interop mechanisms from [17 §Mechanisms](../platform/17-interoperability.md):

| Mechanism | How the automations app uses it |
|-----------|---------------------------------|
| Shared entities | Workflow / WorkflowRun / Reminder / Trigger are entity types; other apps read+write them through the entities service. |
| Intents | Every action a workflow takes is an intent dispatch (`open`, `process`, `convert`, `export`, etc.). The app issues no special-case "automations API". |
| Block embedding | Workflows render as embedded blocks inside Notes / docs ("here's the workflow that drives this task list"). |
| Format I/O | Workflows export to/import from JSON (round-trip) and from n8n-style format (lossy) — see [§Import/export](#importexport) below. |

That's the architectural point: **the automations app is not a new surface, it is a new orchestrator over the existing surface**.

## Entity types

### `brainstorm/Workflow/v1`

The user-authored automation. Lives in the vault, syncs across the user's devices like any other entity.

| Property | Type | Notes |
|----------|------|-------|
| `name` | text, count `{1,1}` | Required, user-visible. |
| `description` | richText, count `{0,1}` | Optional notes. |
| `icon` | entityRef or text, count `{0,1}` | For the launcher / sidebar. |
| `enabled` | boolean, count `{1,1}` | Disable without deleting. Personal-by-default. |
| `trigger` | entityRef → `brainstorm/Trigger/v1`, count `{1,1}` | What fires the workflow. |
| `steps` | richText (Lexical doc), count `{1,1}` | The body. Each step is a Lexical custom node. See [§The step model](#the-step-model). |
| `capabilities` | text[], count `{0,∞}` | Frozen at save-time: the capability set the workflow's steps need. The app prompts the user to grant. |
| `tags` | entityRefs, count `{0,∞}` | Personal taxonomy. |

> **Decision:** the workflow body is a **Lexical document with custom nodes** (one node = one step), not a JSON tree. Reasons: (a) the editing surface is already there — [`brainstorm-editor`](../editing/07-editing-lexical.md) gives us cursor, undo, copy/paste, comments, suggestions; (b) workflows compose with Notes — embed a workflow in a meeting note and the user can comment on individual steps; (c) Yjs convergence is the same model the rest of the product uses, so concurrent edits on the same workflow Just Work (per [06 §Convergence](../editing/06-collaboration-yjs.md)).

### `brainstorm/Trigger/v1`

A trigger is its own entity so the same trigger can fire multiple workflows (one Cron, many subscribers) and so triggers are introspectable (Settings → Automations shows you "this trigger fires three workflows").

| Property | Type | Notes |
|----------|------|-------|
| `kind` | text + vocabulary, count `{1,1}` | See [§Trigger kinds](#trigger-kinds). |
| `config` | jsonValue, count `{1,1}` | Kind-specific. (For `time`: cron expression + timezone + one-shot date. For `entity-event`: type URL + event verb + filter.) |
| `enabled` | boolean, count `{1,1}` | Independent of workflows that reference it. |
| `lastFiredAt` | dateTime, count `{0,1}` | Updated by the scheduler; useful for debugging. |
| `nextFireAt` | dateTime, count `{0,1}` | Computed by the scheduler for time triggers; null for event triggers. |

### `brainstorm/WorkflowRun/v1`

Every execution leaves a record. Surfaced in the app's "Runs" view; counts toward Provenance per [22 §Provenance](../platform/22-ai-foundations.md). Auto-pruned (default: 90 days, configurable per workflow).

| Property | Type | Notes |
|----------|------|-------|
| `workflow` | entityRef → `Workflow/v1`, count `{1,1}` | The source. |
| `triggeredAt` | dateTime, count `{1,1}` | |
| `triggeredBy` | entityRef → `Trigger/v1`, count `{1,1}` | |
| `status` | text + vocabulary, count `{1,1}` | `queued` \| `running` \| `succeeded` \| `failed` \| `cancelled` \| `timed-out`. Use the `WorkflowRunStatus` enum. |
| `stepLog` | richText (timeline), count `{0,1}` | Each step's input snapshot, output snapshot, duration, and any AI-step provenance (model, prompt-hash, cost). |
| `error` | richText, count `{0,1}` | Populated on failure. |
| `costCents` | integer, count `{0,1}` | Aggregate AI cost for the run. |

### `brainstorm/Reminder/v1`

Sugar around a single-step workflow that emits a notification. Listed separately because the UI affordances are very different — "Remind me Thursday 9am" is a one-line interaction, not a builder session.

| Property | Type | Notes |
|----------|------|-------|
| `subject` | text, count `{1,1}` | The reminder message. |
| `target` | entityRef, count `{0,1}` | Optional — entity the reminder is *about*. Clicking the notification opens it. |
| `dueAt` | dateTime, count `{1,1}` | When to fire. |
| `recurrence` | text (RRULE), count `{0,1}` | RFC 5545. Optional; absent = one-shot. |
| `snoozedUntil` | dateTime, count `{0,1}` | Set by the "Snooze" notification action. Overrides `dueAt` for the next fire. |
| `completedAt` | dateTime, count `{0,1}` | Set by "Done". Stops further fires of non-recurring; clears for next occurrence on recurring. |

> **Decision:** a `Reminder` is sugar but **not** layered on top of `Workflow/v1` at the schema level — it's its own type. Why: reminders are by far the highest-volume automation; a user will have hundreds of them; we don't want every quick `Cmd+R` to spawn a full Workflow+Trigger+Run trio in `entities.db`. The reminder runner is internally a degenerate workflow executor; from the data side they're distinct rows.

> **Decision:** `Reminder/v1` is canonical — registered by the automations app but **not owned by it** (same model as Folder per [30](30-file-manager-and-folders.md)). Any app can read/write reminders if it holds `entities.write:brainstorm/Reminder/v1`. A future Tasks app, a calendar app, or even the text-editor's "remind me about this paragraph" slash-command all use the same type.

## The step model

A workflow body is a sequence (or DAG, see [§Branching](#branching)) of **steps**. Each step is a Lexical custom node with the following discriminator (per the CLAUDE.md enum convention):

```ts
enum StepKind {
  Trigger = "trigger",         // pseudo-step: the workflow's trigger, always first
  Intent = "intent",           // dispatch an intent to another app
  Entity = "entity",           // create/update/query/delete an entity (sugar over entities.* host service)
  AIAgent = "ai-agent",        // an AI agent with tools (see §AI-agent steps below)
  AICall = "ai-call",          // a single-shot ai.generate / ai.extract / ai.transform
  Notify = "notify",           // OS notification (uses the notifications host service from Stage 7)
  Wait = "wait",               // delay for a duration, or until a condition
  HTTP = "http",               // outbound HTTP via the network broker (per 38)
  Code = "code",               // small expression in a dedicated non-JS expression language (sandboxed; no shell, no fs, no fetch — only locals + curated built-ins, OQ-167)
  Branch = "branch",           // if / else-if / else
  ForEach = "for-each",        // iterate over a collection
  SubWorkflow = "sub-workflow",// invoke another Workflow as a step
}
```

> **Decision:** the step kind set is **curated** (same rationale as the intent verb namespace per [17 §The standard intent verbs](../platform/17-interoperability.md)). New kinds are added in shell releases. Workflows are data the user can audit; an open extension surface here would make audits intractable.

Each step has:

- **Inputs.** Reference outputs of prior steps by **stable per-step uuid id** (OQ-166): the linear v1 builder picks a prior step and references its output by id (member-access into that output via the `Code`/expression grammar of OQ-167). Reorders/renames stay stable because the id is independent of position; copy/paste mints a fresh uuid and any input referencing a now-absent step id resolves to `<unbound>`, surfaced by the save-time validation pass.
- **Output schema.** The kind dictates it. `Intent` returns the intent result; `AIAgent` returns a structured (JSON-schema-validated) or unstructured payload; `Branch` returns nothing but routes execution.
- **Capability footprint.** Static: derivable from the kind and config. `Intent { verb: "open", entityType: "Note/v1" }` requires `entities.read:Note/v1`. The app aggregates these and prompts at save-time.

### AI-agent steps (n8n-style)

The user's follow-up: *"some automations can use AI agents in the middle, like n8n."* This is what `StepKind.AIAgent` is for. An agent step is more than a single LLM call — it can use **tools**, loop, and produce structured output.

| Field | Type | Notes |
|-------|------|-------|
| `instructions` | text | The agent's system prompt / role. |
| `inputBinding` | reference | Where prior-step output flows in as the user message. |
| `provider` / `model` | enum / text | Via the AI broker (per [22 §Architecture](../platform/22-ai-foundations.md)). Inherits the workflow's `ai.provider` capability. |
| `tools` | entityRef[] | Each tool is **an intent the workflow may dispatch**, plus an optional `outputSchema`. Tools are not arbitrary code — they are the user's installed apps' capabilities. |
| `maxIterations` | integer | Cap on tool-call loops. Default 5. Hard ceiling enforced by the AI broker. |
| `outputSchema` | jsonValue (JSON Schema) | When set, the agent's final output is validated against the schema; failure → step fails with `output-schema-violation`. |
| `memory` | enum `MemoryMode` | `none` (default, per-step) \| `per-run` (shared with other agent steps in the same run) \| `per-workflow` (persists across runs of this workflow, stored as a private entity). |

> **Decision:** **an AI agent's tools are intents the workflow already has caps for.** No additional surface. This is the security-critical decision: an agent inside a workflow cannot do anything the workflow itself cannot do. The user grants caps once, at workflow save, by reviewing the aggregate. The agent loop is then free to compose tools within that envelope.

> **Decision:** agent loops live in the **AI broker** (shell main process), not in the renderer. The broker iterates: send messages to the provider, observe tool-call responses, dispatch the named intent through the intents bus, return the result, repeat until the model produces a final answer or `maxIterations` is hit. The workflow runner is the consumer of the agent step; the renderer-side automations app shows progress via streaming events.

> **Decision:** an agent's tools are **a flat set of intents, not arbitrary functions**. This avoids the "function-calling-as-RCE" failure mode where an agent invents a tool the user didn't grant. Each tool registration in the agent step is a `{ verb, entityType?, format?, label, outputSchema? }` quartet — all four discoverable from the same registry the launcher uses (per [17 §Discoverability surfaces](../platform/17-interoperability.md)).

### Step composition examples

```
[Trigger: time / weekly Mon 9am]
  → [Entity: query Task where status="open" AND due < today+7d]
  → [AIAgent: "Summarize this week's outstanding work in 3 bullets.",
              tools=[ai.generate, entities.query:Task/v1],
              outputSchema={bullets: string[]}]
  → [Notify: title="Week ahead", body=agent.bullets.join("\n")]
```

```
[Trigger: entity-event onCreate brainstorm/Email/v1]
  → [AIAgent: "Classify: action-required | informational | spam.",
              tools=[],
              outputSchema={class: enum}]
  → [Branch: agent.class === "action-required"]
      → [Intent: extract Tasks from email body → into Tasks DB]
      → [Notify: "1 task created from email"]
    [Branch: agent.class === "spam"]
      → [Entity: update Email.spam=true]
```

The second example is the **prior-tools-can't-do-this** demonstration: a user receives an email entity (from a hypothetical email-bridge app), an agent classifies it, structured downstream actions happen — all without writing code, all auditable, all bounded by capabilities the user explicitly granted to the automations app.

## Trigger kinds

```ts
enum TriggerKind {
  Time = "time",                  // cron expression + timezone + optional one-shot date
  EntityEvent = "entity-event",   // onCreate | onUpdate | onDelete on a type, with filter
  Intent = "intent",              // when intent verb V is dispatched, fire (rare; for system-level)
  Manual = "manual",              // "Run now" button only — useful for testing
  Webhook = "webhook",            // inbound HTTP via the network broker; user-controlled secret
  FileWatch = "file-watch",       // a granted FileHandle changes on disk
  Startup = "startup",            // fires on shell launch (for housekeeping workflows)
}
```

> **Decision:** webhook triggers are **opt-in per workflow** and require the `network.ingress` capability. The network broker (per [38-network-and-proxy.md](../security/38-network-and-proxy.md)) gates inbound connections; we don't open a port "because there's a workflow somewhere." A workflow without `network.ingress` cannot define a `webhook` trigger; the save fails with `capability-missing`.

> **Resolved (11b.8, OQ-163 → a):** ONE shared endpoint, **path-routed** `/wh/<routeId>/<secret>`, per-workflow **rotating secret** (the builder mints `routeId` + `secret` on first save; the secret rotates in place, the route stays stable so a pasted URL keeps working). Two ingress planes share this topology:
>
> - **Loopback listener** (`127.0.0.1`, live): a long-lived shell-main HTTP server (the durable sibling of the Connector-2 OAuth loopback) path-routes `POST /wh/<routeId>/<secret>` → the bound workflow. `127.0.0.1`-only bind; POST-only; unauthenticated requests (unknown route OR wrong secret) get an identical `404` (no route/secret oracle); the secret is compared constant-time; body capped (256 KiB → `413`). Reachable by same-machine tools or a user-run tunnel (cloudflared / ngrok).
> - **Relay plane** (for NAT'd desktops): the hosted relay terminates the public `https://<relay>/wh/<routeId>/<secret>`, wraps `{method, headers, body}`, and forwards it down the connection the desktop already holds; the desktop **re-verifies the secret constant-time** before firing. The relay is **untrusted for auth** and holds **no vault keys** — it only forwards. This rides its own transport, NOT the DEK-sealed sync `RelayPort` (which is relay-blind and routes only encrypted vault frames). The relay-node route + deployment are ops (like the official OAuth-client registration, `Mailbox-9`); the desktop client is written against the transport interface and is inert until a relay is paired.
>
> Both planes are gated by `network.ingress` (a runtime ledger grant via Settings → Privacy → Network — never a static manifest cap); without it no route registers (fail-closed) and the save surfaces `capability-missing`.

## Scheduler — where triggers actually fire

Apps are not background processes (per [03 §Lifecycle](03-app-model.md)). So the automations app **cannot itself run timers**. The scheduler lives in the **shell main process** (specifically: a `SchedulerService` registered alongside the broker / installer in `packages/shell/src/main/`):

- **Time triggers**: the scheduler maintains a sorted heap of `{nextFireAt, workflowId}` tuples. On each fire it computes the next occurrence (RRULE or cron-next) and re-heaps. Survives shell restart via persistence in `registry.db`.
- **Entity-event triggers**: the entities service emits change events (it already does, for the Yjs ↔ SQL projection per [20 §Initial / selective / incremental sync](../data/20-database-growth-and-sync.md)). The scheduler subscribes; on a match (type + filter), it enqueues a run.
- **Webhook triggers** (11b.8): an ingress plane (loopback listener and/or relay client) authenticates the inbound (constant-time secret match) and hands the `AutomationsHost` a verified hit, which runs the bound workflow under its own frozen caps — the same dispatch shape as an entity-event trigger. Only the designated automation-host device runs the ingress plane.
- **File-watch triggers**: the files host service (Stage 9) emits change events on granted handles; same enqueue path.
- **Startup / manual**: trivial.

A fire emits a `WorkflowRunRequested` event. The scheduler hands the run to a **workflow runner** — also in the main process — which interprets the steps, dispatching intents through the existing intents bus, AI calls through the AI broker, notifications through the notifications service.

> **Decision:** **the workflow runner is shell-side, not renderer-side.** Renderer surfaces (the automations app's "Runs" view) subscribe to runner events for display. If the user closes the automations app's window, workflows continue to run; that's the whole point. Same as how a scheduled OS task doesn't need its configuration app open.

> **Decision:** runs are serialized **per workflow** by default — a workflow firing on a 1-second cron with a 30-second step does not produce 30 concurrent runs; the second fire either queues (default) or is dropped (configurable). Cross-workflow concurrency is bounded by a shell-level worker pool (size: 4 by default, per [12 §Worker pools](../shell/12-shell-architecture.md)).

## Capabilities & security

This is the part that has to be right.

### Aggregate capabilities, not per-step grants

When the user saves a workflow, the automations app computes the union of capabilities the steps need (a static analysis: `Intent { verb, entityType }` → `entities.read:<type>` + `entities.write:<type>` if mutating; `AICall` → `ai.use` + `ai.provider:<id>`; `HTTP` → `network.egress:<origin>`; etc.). The user reviews **the aggregate** at save-time. Same prompt UI as install-time capability review (per [03 §Install](03-app-model.md)).

> **Decision:** capability prompts happen at **workflow-save**, not at first-run. Reasons: (a) the user wants to know what a workflow can do before clicking "save", not when it surprises them at 3am; (b) prompting at fire-time is incompatible with the workflow running while the app's window is closed.

### Workflows inherit the automations app's capabilities only

The automations app holds the union of capabilities used across all workflows it executes. A workflow cannot do anything the *app* lacks. **The user reviewing the app's capability sheet** sees `ai.use`, `entities.read:Task/v1, Email/v1, Note/v1, …`, `intents.dispatch:open`, `intents.dispatch:process`, etc. This is the audit surface — and it's the same surface the user already sees for every other app.

### AI agent tools = intents = capabilities

Already noted, repeating because it's load-bearing: an AI agent inside a workflow can only invoke intents the workflow lists in the agent's `tools` field, AND each of those intents must be in the workflow's capability set, AND each of those must be in the automations app's capability set. Three-tier intersection, fail-closed at every tier (per [09 §Fail-closed](../security/09-security-and-sandbox.md)).

### No code-execution capability

`StepKind.Code` is **expression-level only**: a small expression in a **dedicated non-JavaScript expression language** (OQ-167 — a tokenizer→parser→AST evaluator, `code-expression.ts`, with no `eval`/`Function`, no host globals, no I/O, no assignment, no statements, no prototype access, so the audit surface is exactly the published grammar) with access to: (a) prior step outputs + `input` as locals, (b) curated pure built-ins (`len/upper/lower/trim/contains/replace/split/join/round/min/max/number/string/coalesce/now/…`). It cannot `import`, `require`, touch the file system, make network calls, or invoke shell; regex is deliberately deferred (ReDoS surface). It exists for "convert this number to a string with units", not for "shell out to my Python script".

> **Decision:** v1 does not expose an arbitrary-code step. Users who need code use `HTTP` to call their own script, or write a small Brainstorm app whose intent they dispatch from the workflow. This keeps the audit surface tractable. Revisit in v2 if a clear demand emerges.

## Editing surface — the builder

The app's main window is a **Lexical-based workflow editor** with a custom node per `StepKind`. Inserting a step is a slash command (`/intent`, `/agent`, `/branch`) — same UX as the text-editor's block-insertion (per [07 §Slash commands](../editing/07-editing-lexical.md)). Each custom node renders an inline form (verb selector, entity-type picker, prompt textarea, tool list).

Three views in the app:

1. **Workflows** — list of `Workflow/v1` entities, columns for name / trigger / last-run / status / enabled-toggle.
2. **Reminders** — list of `Reminder/v1` entities, designed for quick-capture (one-line "remind me Thursday 9am to call X"). Inbox-style. The launcher (per [04-shell.md](../shell/04-shell.md)) also accepts natural-language reminder strings and dispatches `intent.create` to the automations app.
3. **Runs** — `WorkflowRun/v1` records, filterable by workflow / status / date. Click a run, see the step-by-step timeline with inputs and outputs and any AI provenance.

> **Decision:** the builder ships with a **gallery of pre-built templates** (per Iteration 11b.7 in the implementation plan): "Daily standup summary", "Tag inbox items via AI", "Archive completed tasks weekly", "Reminder from selected text". Templates are seeded `Workflow/v1` entities the user can run as-is or fork.

## Import/export

`Workflow/v1` round-trips losslessly to JSON — the format is the entity's serialized form. The automations app registers as the `import` / `export` handler for the format `application/x-brainstorm-workflow+json` per [17 §Format I/O](../platform/17-interoperability.md).

> **Decision:** an **n8n importer** ships as a separate optional capability (a one-way bridge). It maps n8n nodes → Brainstorm steps where possible, surfaces a diff of unmapped nodes, and inserts a `Code` step stub the user must review. Round-trip back to n8n is not supported.

> **Open:** does Brainstorm also import from Zapier / Make? Tentative leaning: only n8n (open format, no scraping). Other vendors revisit in v2.

## Discoverability — how users encounter automations

Following [17 §Discoverability surfaces](../platform/17-interoperability.md):

- **Right-click on entity** → "Automate…" submenu listing workflows that can be triggered by this entity (those whose trigger is `entity-event` on this type).
- **Launcher** → typing "remind me" or "automate" returns reminder-create and workflow-create actions; typing a date phrase ("Thursday 9am call mom") inserts a reminder.
- **Settings → Automations** → shows the scheduler's view of upcoming fires, recent runs, and any disabled workflows.
- **Inside the text-editor** → selected text + slash `/remind` inserts a reminder linked to the entity. Selected paragraph + slash `/automate` opens the builder pre-seeded with an `EntityEvent` trigger on the containing entity's type.

## Performance budgets

| Metric | Budget |
|--------|--------|
| Reminder fire latency (from `dueAt`) | < 5s p95 |
| Workflow run end-to-end overhead (excluding AI/HTTP steps) | < 50ms per step p95 |
| Scheduler heap operation | < 1ms p95 |
| Builder open → first paint | < 200ms p95 (per [13 §Performance budgets](../shell/13-frontend-stack.md)) |
| Max active workflows per vault | 1000 (soft); 10000 (hard) |
| Max steps per workflow | 200 (hard) |
| Default `WorkflowRun` retention | 90 days |

## Failure modes

- **Trigger fires while shell is offline** → the next launch checks `nextFireAt < now()`, fires the most recent missed occurrence, advances. *Why one and not all*: a reminder set for "every weekday 9am" should not fire 50 times after a two-week absence. Configurable per workflow (`onMissed: "fire-once" | "fire-all" | "skip"`).
- **Workflow step throws** → run status = `failed`, step log records the exception, downstream steps skipped. The user sees a desktop notification (default; opt-out per workflow).
- **AI agent exceeds `maxIterations`** → step fails with `agent-loop-limit`. Run continues to subsequent steps if any are configured `onError: continue`; otherwise the whole run fails.
- **Capability revoked mid-run** → the broker's fail-closed path returns `capability-denied` (per [09 §Fail-closed](../security/09-security-and-sandbox.md)); step fails; run fails. The user sees a clear "this workflow needed capability X which is no longer granted" message.
- **Two devices both run the same trigger** → the scheduler stamps a fire id; the entities service rejects duplicate `WorkflowRun` writes with the same fire id. Last-writer-wins on the run record; both devices' step dispatches are idempotent because Brainstorm's writes are CRDT-merged on the entity layer.

> **Decision:** triggers are **owned by the device the user designates as the "automation host"** (Settings → Automations → "Run automations on this device"). Default: the first device. The chosen device is the only one whose scheduler is active. Other devices' schedulers are dormant. This avoids the "every device fires the same cron" duplication without requiring a coordination protocol.

> **Open:** does the chosen device's failure auto-fall-back to another device after N minutes of unreachability? Tentative leaning: no in v1 (simple); add a "this device hasn't reported in 24h" warning surface that prompts the user to switch the host. Tracked as OQ-164.

## Non-goals

- **A general scripting environment.** No arbitrary code execution. Workflows are data; data is auditable.
- **Cross-vault workflows.** Workflows operate on the active vault. Cross-vault automation is a future need; for v1, the user picks a vault and the workflows in it operate there.
- **A visual graph editor.** Steps are a Lexical document, edited as a vertical list. Branching renders as nested blocks. We are not building a node-and-edge canvas in v1 — it's beautiful in demos and fragile in practice once workflows exceed ~10 nodes. Revisit for v2 once we have real usage telling us what fails to scale.
- **Built-in connectors to external SaaS.** No third-party integrations bundled. Those are *other apps* — the automations app composes them via intents. Store-verified third-party bridge apps ship separately and expose intents the workflows app can dispatch.

## Phasing

| Capability | v1 | v2 |
|------------|----|----|
| Reminder/v1 (one-shot + RRULE) | ✓ | — |
| Workflow/v1 with `Time` / `EntityEvent` / `Manual` triggers | ✓ | — |
| `Intent` / `Entity` / `Notify` / `Wait` / `Branch` / `ForEach` / `SubWorkflow` steps | ✓ | — |
| `AICall` + `AIAgent` steps (depends on Stage 11) | ✓ (lands in Stage 11b) | — |
| `HTTP` + `Webhook` trigger (depends on network broker) | ✓ | — |
| `Code` step (sandboxed expression) | ✓ | — |
| `FileWatch` / `Startup` triggers | ✓ | — |
| n8n importer | — | ✓ |
| Cross-vault workflows | — | ✓ |
| Visual graph editor | — | ✓ (if user-validated) |
| Multi-device scheduler with failover | — | ✓ |

## Summary

- One first-party app handles all reminders, automations, and AI-assisted workflows.
- Closes the reminder-and-automation gap common in prior tools, directly, in the same shell.
- Workflows are entities with a Lexical body; reminders are sugar (their own type) for the common case.
- Triggers are entities so they're introspectable and shareable across workflows.
- Steps are a curated enum; AI-agent steps are n8n-style and can call **intents-as-tools** within the workflow's capability set.
- The scheduler and the runner live in the shell main process; the app is "just" the designer + the visualizer.
- Capabilities are aggregated at save-time; three-tier intersection (agent-tools ⊆ workflow-caps ⊆ app-caps) prevents privilege escalation through workflows.
- No arbitrary code, no cross-vault, no visual graph — all deliberate v1 simplifications.
