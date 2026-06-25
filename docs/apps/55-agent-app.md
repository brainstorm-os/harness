# 55 — Agent app (the conversation surface)

This doc specifies a first-party **Agent app** (`brainstorm.agent`) and the canonical types it brings: `brainstorm/Conversation/v1` and `brainstorm/Message/v1`. It is the fifth AI surface — **conversation** — from [22 §The five surfaces](../platform/22-ai-foundations.md), made concrete. It is the surface that ties the other three "leave the app less" surfaces together: the user asks for something in natural language and the agent operates Mailbox ([53](53-mailbox.md)), the Web Browser ([54](54-web-browser.md)), Notes, Database, Calendar, Tasks, and Files **on their behalf, through intents** — without the user leaving the product or wiring a workflow by hand.

It builds on [22-ai-foundations.md](../platform/22-ai-foundations.md) (the AI broker, the five surfaces, provenance — and the position this doc revises), [39-automations-and-workflows.md](39-automations-and-workflows.md) (the agent-loop, intents-as-tools, the three-tier capability intersection — **reused, not reinvented**), [17-interoperability.md](../platform/17-interoperability.md) (intents are the tool vocabulary and the discoverability registry), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capabilities), [18-storage-and-search.md](../data/18-storage-and-search.md) + [22 §Embeddings](../platform/22-ai-foundations.md) (retrieval over the vault), [31-linking-protocol.md](../platform/31-linking-protocol.md) (citations are `brainstorm://` links), and [21-objects-and-collections.md](../data/21-objects-and-collections.md) (conversations are entities).

## The position this doc revises

[22 §5. Conversation](../platform/22-ai-foundations.md) states: *"conversation is a primary use case but **not bundled into the shell** in v1. A first-party chat app provides it … post-v1."* The infrastructure decision there is unchanged and correct (shell owns provider/streaming/context; the app owns UX). What changes is **timing**:

> **Decision:** the conversation surface ships **in v1**, as the Agent app, gated behind Stage 11 (AI broker) and Stage 11b (the Automations agent-loop). Rationale: once [39](39-automations-and-workflows.md) builds a production agent-loop in the AI broker for workflow steps, a conversational surface over that *same loop* is a thin UX layer, not a second engine — deferring it would mean shipping the agentic substrate with no human-facing way to use it interactively, which is the single highest-leverage "don't leave the app" feature. This **reverses 22's "post-v1" phasing line**, the same way [22](../platform/22-ai-foundations.md) itself reversed an [01-vision.md](../foundations/01-vision.md) non-goal. Reconciliation is flagged below; this doc does not edit 22.

## One agent loop, two front-ends

The load-bearing architectural decision, and the reason this is cheap:

> **Decision:** the Agent app and the Automations `StepKind.AIAgent` ([39 §AI-agent steps](39-automations-and-workflows.md)) are **two front-ends over one agent-loop in the AI broker**. There is no second agent engine, no second tool dispatcher, no second prompt-injection mitigation. Automations drives the loop unattended on a trigger; the Agent app drives the same loop interactively on a user turn. Same `maxIterations` ceiling, same streaming events, same provenance stamping.

> **Decision:** the agent's tools are **intents the user granted the Agent app**, dispatched through the existing intents bus — identical to [39](39-automations-and-workflows.md). The three-tier fail-closed intersection holds: **tools-the-model-may-call ⊆ Agent-app capabilities ⊆ what the user granted at install/turn**. An agent in a conversation can do exactly what the Agent app can do, no more — and the user audits that on the app's one capability sheet, the same surface as every other app ([09 §Fail-closed](../security/09-security-and-sandbox.md)).

This is what makes the "everything inside" claim safe rather than scary: the agent is powerful *because* it can drive Mailbox/Browser/Database/etc., but it is bounded by the same capability model that bounds every app, with no new trust primitive.

## Entity types

### `brainstorm/Conversation/v1`

A chat thread. An entity, so it is searchable, linkable, taggable, and survives like everything else ([21](../data/21-objects-and-collections.md)).

| Property | Type | Notes |
|----------|------|-------|
| `title` | text, count `{1,1}` | Auto-derived from the first turn; user-editable. |
| `messages` | richText (Yjs), count `{1,1}` | The transcript as a Yjs doc — one custom node per `Message`. Yjs so it survives a crash and merges across the user's devices ([06](../editing/06-collaboration-yjs.md)); same substrate as a Note. |
| `toolGrants` | text[], count `{0,∞}` | The intents this conversation may use as tools — a *subset* of the Agent app's caps, chosen by the user when they enabled a capability mid-chat. Frozen per conversation; visible in a sidebar. |
| `model` | text, count `{0,1}` | Provider/model used (via the AI broker; user-configurable per conversation). |
| `memoryMode` | text + vocabulary, count `{1,1}` | `per-conversation` (default) \| `long-term` (opt-in; writes to a private `AgentMemory` entity). Mirrors [39](39-automations-and-workflows.md)'s `MemoryMode`. |
| `costCents` | integer, count `{0,1}` | Aggregate AI cost; per-app quota enforced by the broker ([22 §Cost model](../platform/22-ai-foundations.md)). |
| `tags` | entityRefs, count `{0,∞}` | Personal taxonomy. |

### `brainstorm/Message/v1`

One turn. `{ role: user|assistant|tool, body (richText), citations: entityRef[], toolCalls: jsonValue[], aiProvenance }`. **Citations are real links** ([31](../platform/31-linking-protocol.md)): when the agent answers "you committed to X in the Tuesday standup", the standup note is a `brainstorm://entity/<id>` the user clicks — answers are traceable to vault objects, not unsourced text.

> **Decision:** every assistant message that asserts a fact about the user's data **carries citations to the entities it drew from**, surfaced inline (the same provenance discipline [22 §Provenance](../platform/22-ai-foundations.md) applies to generated content). An uncited factual claim about the vault is rendered with a visible "unsourced" marker. This is the antidote to the trust failure of generic chat: the user can verify, in one click, against their own objects.

## Retrieval — the broker assembles context, not the app

> **Decision:** the Agent app **never bulk-reads the vault to build context**. It sends the user's turn + the conversation to the AI broker; the broker performs hybrid retrieval (`search.hybrid`, FTS5 + vector, [18](../data/18-storage-and-search.md)/[22 §Embeddings](../platform/22-ai-foundations.md)) **scoped by the conversation's `ai.context` capability** and packs the prompt. The app sees the streamed answer + the citation set, never a dump of entities it wasn't entitled to. This keeps the [22 §Architecture](../platform/22-ai-foundations.md) principle intact (the shell decides what content enters a prompt, applying the user's privacy scope) and means the Agent app's own capability footprint is small.

## "Turn this chat into an automation" — the unification payoff

> **Decision:** a conversation that accomplished a useful multi-step task can be **distilled into a `Workflow/v1`** ([39](39-automations-and-workflows.md)). The agent already produced an ordered list of tool calls (intents with arguments); the "Save as automation" action maps that trace to workflow steps and opens the Automations builder pre-seeded. The user *discovers* an automation by doing the task once conversationally, then promotes it to run on a trigger. This is the reason chat and automations share one loop: the boundary between "do it for me now" and "do it for me every Monday" should be a single click, not a separate product.

## Agentic surface — the "everything inside" thesis, concretely

The Agent app is the seam that makes the other three docs add up to "users leave less":

- *"Reply to the three investor emails confirming Thursday, and draft a recap doc"* → `intent.reply` ×3 (Mailbox, [53](53-mailbox.md)) + `intent.create` Note — granted tools, fail-closed.
- *"Research the top open-source CRDT libraries and put a comparison in my Database"* → `web.browse`/`web.capture` ([54](54-web-browser.md)) + `intent.create` rows in a List.
- *"What did I commit to in last week's meetings?"* → broker retrieval over `Note/v1` + `Email/v1`, cited answer, one-click to each source.
- *"Every weekday at 8am do the email triage we just did"* → Save-as-automation → `Workflow/v1` with a `Time` trigger.

Every one of these is a task the user would otherwise have left the product to do (or not done at all).

## Capabilities & security

| Capability | Why |
|------------|-----|
| `ai.use` (+ `ai.context:<scope>`, `ai.cost:budget:<n>`) | The loop runs in the broker; the app holds the user-facing budget ([22](../platform/22-ai-foundations.md)). |
| `intents.dispatch:<verb>` (per granted tool) | Each tool is an intent; scope-carrying (`intents.dispatch:open`, not bare) so the broker matches the scoped grant. |
| `entities.read/write:brainstorm/Conversation/v1` (+ `Message`) | Persist the transcript. |
| App-specific tool caps (e.g. `web.browse`, `entities.write:Email/v1`) | **Only those the user explicitly added** to the Agent app; reviewed on the same sheet as any app. |

- Prompt injection: handled at the broker level for *all* surfaces ([22 §Prompt injection](../platform/22-ai-foundations.md)) — region tagging, system/user separation, output not granted input trust. A web page the agent fetched ([54](54-web-browser.md)) is untrusted `<content>`; it cannot escalate the agent's tools (the tool set is fixed per turn by the capability intersection, not by anything the model "decides" from page text). This is the [39 §AI agent tools = intents = capabilities](39-automations-and-workflows.md) invariant, and it is why a prompt-injecting web page cannot make the agent send mail it wasn't granted.
- The agent **cannot grant itself capabilities**. Enabling a new tool mid-conversation is a user gesture that mutates `Conversation.toolGrants` within the Agent app's ceiling — never above it.
- No autonomous background action: the Agent app acts only on a user turn. Scheduled/triggered autonomy is Automations' job ([39](39-automations-and-workflows.md)); the split is deliberate (a chat app that acts while you sleep is a footgun; a *workflow* that does is reviewed and bounded).

## Performance budgets

| Metric | Budget |
|--------|--------|
| Send turn → first streamed token | network/provider-bound; **< 80ms shell+app overhead** p95 ([22 §Streaming](../platform/22-ai-foundations.md)) |
| Conversation open → transcript paint (cached) | < 200ms p95 ([13](../shell/13-frontend-stack.md)) |
| Retrieval (broker hybrid search) added latency | < 150ms p95 over a 50k-entity vault ([18](../data/18-storage-and-search.md)) |
| Tool-call dispatch overhead (per intent) | < 50ms p95 (same as a workflow step, [39](39-automations-and-workflows.md)) |
| Save-as-automation → builder open | < 300ms p95 |

## Non-goals (v1)

- **A vault-detached general chatbot.** The Agent app is grounded in the user's data and tools; it is not a generic ChatGPT clone. "Help me write a poem" works (it is just generation) but the product thesis is operating *your* knowledge and apps.
- **A second agent engine.** If a need can't be met by the shared broker loop, the fix is the broker loop, not a fork.
- **Autonomous background agents.** Deliberately Automations' territory; see above.
- **Multi-agent orchestration / agent swarms.** One loop, tools-as-intents. Sub-agents are `SubWorkflow` in Automations if needed ([39](39-automations-and-workflows.md)); not a v1 chat feature.
- **The dev/coding agent for this repo.** That is the dev MCP server (`tools/mcp-server/`, out of the shipped product); the Agent app does not get repo/filesystem access.

## Cross-doc reconciliation needed

Same pattern as [22 §Cross-doc reconciliation](../platform/22-ai-foundations.md); tracked as a follow-up, not edited here:

- **[22-ai-foundations.md](../platform/22-ai-foundations.md)** — the phasing-table row "First-party chat / agent app — post-v1" and the §5 Decision become **v1** (gated on 11/11b). Strike-and-clarify, the way [01-vision.md](../foundations/01-vision.md) was updated when 22 reversed it.
- **impl-plan bundled-apps list** — add `agent` to the v1 bundled set; file the Stage **11c** iteration ladder (after 11 broker + 11b loop) via the dev-MCP `plan.update_iteration` path.
- **[39](39-automations-and-workflows.md)** — add a back-reference: the AI-broker agent-loop is shared with the Agent app; "Save as automation" is the documented bridge.

## Phasing

| Capability | v1 (Stage 11c) | v2 |
|------------|----|----|
| `Conversation` / `Message` types; Yjs transcript | ✓ | — |
| Streaming chat over the shared broker agent-loop | ✓ | — |
| Intents-as-tools, three-tier fail-closed intersection | ✓ | — |
| Broker-assembled hybrid retrieval; cited answers | ✓ | — |
| Per-conversation tool grants + model + budget | ✓ | — |
| Save-as-automation → `Workflow/v1` | ✓ | — |
| Long-term memory (opt-in private entity) | ✓ (basic) | ✓ (richer) |
| Voice input / output | — | ✓ |
| Multi-agent / sub-agent orchestration | — | via `SubWorkflow` only |
| Shared/team conversations | — | ✓ (org tier) |

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md) via the dev-MCP `oq.*` path:

- **OQ-AG-1** — Mid-conversation capability escalation UX: inline "Allow the agent to send email?" prompt vs. forcing the user to the Agent app's capability sheet. Lean: inline prompt that writes to `toolGrants`, never above the app ceiling.
- **OQ-AG-2** — Default tool set for a freshly installed Agent app: read-only across installed apps (safe, less useful) vs. nothing until granted (annoying, explicit). Lean: read-only defaults, write/`web.browse`/send require an explicit grant.
- **OQ-AG-3** — Save-as-automation fidelity: replay the exact tool trace (brittle to data changes) vs. generalize arguments into workflow inputs (needs inference). Lean: generalize with a user-reviewed diff.
- **OQ-AG-4** — Long-term memory scope and redaction: per-conversation vs. per-vault; how the user inspects/forgets it (interacts with [22](../platform/22-ai-foundations.md) provenance).
- **OQ-AG-5** — Should agent-driven web browsing be forced read-only ([54 OQ-WV-5](54-web-browser.md))? Lean: yes, form submission needs a user-in-the-loop step.

## Summary

- The Agent app is the **conversation surface** of [22](../platform/22-ai-foundations.md), pulled into **v1** because it is a thin UX over the agent-loop [39](39-automations-and-workflows.md) already builds.
- **One loop, two front-ends**: Automations runs it on a trigger; the Agent app runs it on a turn. No second engine, no new trust primitive.
- Tools are **granted intents**, three-tier fail-closed — the agent can do exactly what the app can, audited on the standard capability sheet.
- Conversations are **entities**; answers **cite vault objects** as clickable links; the broker (not the app) assembles retrieval within the user's privacy scope.
- **"Save as automation"** turns a one-off conversation into a scheduled `Workflow/v1` — the payoff of sharing the loop.
- It is the seam that makes Mailbox + Browser + the rest add up to: the user gets it done **inside the product**.
