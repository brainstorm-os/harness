# Business use-case audit — "run business work via an agent + automations"

_Session 914-mira-business-automation-audit · 2026-07-23 · Track B verification_

Ground-truth read of `apps/automations`, `apps/agent`, and
`packages/shell/src/main/ai/`, plus an **in-process end-to-end test** that fires
the full trigger → AI → action path. Test:
`packages/shell/src/main/integration/business-triage-flow.test.ts` (shell branch
`verify/business-automation-flow`) — green.

---

## TL;DR — the one use-case to lead with

**"Inbound support email → AI triages its priority → drafts a ready-to-send
reply in Mailbox."** This is the single flow that is (a) authorable in the
builder UI today, (b) proven to run end-to-end in-process, and (c) tells a
crisp business story with a built-in trust property: **the agent drafts, the
human sends.** It exercises every headline capability — an event trigger, a
real AI classification through the broker, and an AI-agent step that *acts* via
an intent — without depending on any of the gaps below.

---

## How the automation cycle actually works (verified)

The engine is **shell-side** — a workflow runs whether or not the Automations
window is open. The spine, all confirmed by reading the source and driving it:

```
Trigger fires ─▶ AutomationsHost ─▶ WorkflowRunner ─▶ core StepInterpreters
                    │                                       │
       (scheduler / entity-change /                  side effects via injected
        webhook / file-watch / manual)               InterpreterPorts ─▶ broker
                                                      service handlers ─▶ providers
```

- **Triggers (engine-wired):** `Manual` (Run now), `Time` (recurrence), and
  `EntityEvent` (type + create/update/delete verb) are the builder's palette
  (`BUILDER_TRIGGER_KINDS`). `Webhook`, `FileWatch`, and `Startup` also exist in
  the engine. An `EntityEvent` trigger routes through
  `AutomationsHost.onEntityChange`.
- **Steps (all authorable in the builder — `BUILDER_STEP_KINDS`):** `Intent`,
  `Entity` (get/create/update/delete/query), `Notify`, `Wait`, `Branch`,
  `ForEach`, `Code` (sandboxed expression), `Export`, `SubWorkflow`, **`AICall`**
  (single-shot classify/summarize/rewrite), and **`AIAgent`** (the shared
  tool-calling loop). HTTP is engine-only (wired via Net-1 egress).
- **The AI path is real, not stubbed.** `createBrokerInterpreterPorts` always
  wires the `ai` port; `createCoreInterpreters` registers `AICall`/`AIAgent`
  whenever that port is present. The port calls the registered `ai` broker
  service (`makeAiServiceHandler`), which resolves a `ModelProvider`. Providers
  registered in `index.ts`: **Ollama (local, the default), Anthropic, OpenAI,
  Mistral, Gemini** — cloud ones via **BYO keys** (Settings → AI), plus per-app
  **quota/budget** and **usage provenance**.
- **One agent loop, two front-ends.** `runAgentLoop` (sdk-types, dependency-free)
  is driven by both the Automations `AIAgent` step and the Agent app's chat turn
  — identical behaviour and identical fail-closed **three-tier capability
  ceiling** (`agent-tools ⊆ workflow/conversation-caps ⊆ app-caps`). Tool calls
  ride a single auditable **JSON convention in the assistant text** (`{"tool":…}`
  / `{"final":…}`), so tool-calling works even on providers with no native
  tool API (e.g. local Ollama).
- **Save-as-automation** (Agent-6) generalizes a chat that used tools into a
  Manual-trigger + single `AIAgent` workflow, parameterizing run-specific ids to
  `{{input}}` — with the cap-subset invariant enforced.

### What the end-to-end test proves

`business-triage-flow.test.ts` drives an `EntityEvent(Email, create)` fire
through the **real** `AutomationsHost` → `WorkflowRunner` → core interpreters →
`createBrokerInterpreterPorts` → real `ai` service handler → a stub provider:

1. `Code: input.entityId` → `Entity Get(Email)` loads the email,
2. `AICall` classifies it (→ `"urgent"`, recorded in the run's provenance),
3. `AIAgent` drafts a reply and **dispatches the `compose` intent** (the draft
   action), and the run is persisted `Succeeded`.

---

## (a) What works end-to-end today

- **Event → AI → action** as a shell-side workflow, app window closed. Verified.
- **AICall classification / summarization / extraction** through the broker to
  any configured provider (local Ollama or BYO cloud key).
- **AIAgent step taking an action** by dispatching a curated intent — proven
  with `compose` (draft a Mailbox reply). The send stays a human gesture.
- **The builder UI can author all of it:** EntityEvent trigger, AICall
  (instructions + provider), AIAgent (instructions + provider + a tools list of
  intent verbs + iteration bound), Branch/ForEach/Code/Notify/Entity.
- **Capability safety is real and fail-closed** at every tier (static aggregate
  check before a run; tool intersection inside the loop; per-fire live-ledger
  ceiling; entity-type scope on Entity steps).
- **Agent chat** grounds on hybrid retrieval, cites real vault ids, can **draft
  an email** and **save the conversation as an automation**.
- **Provenance:** every run persists a `WorkflowRun/v1` step log; every AI call
  records usage. A user can see what fired and what it did (Runs view).

## (b) What's broken / stubbed / missing for a real business flow

1. **No write-back of AI output onto an object** (F-458, **biggest gap**). An
   `AICall` returns text; the `Entity` step takes properties only from the
   pipeline operand and the `Code` grammar has **no object-literal construction**.
   So "classify **and label/file** the email" isn't achievable with the pure
   step set — only "draft a reply" (compose intent) or a **static** "notify" land
   as terminal actions. The intended escape hatch (an `AIAgent` mutating-intent
   tool) needs a first-party create/set intent that doesn't exist yet.
2. **EntityEvent → Entity impedance** (F-459). The trigger payload is
   `{ entityId }`; the Entity step wants a bare id / `{ id }`. Every
   entity-triggered workflow needs a hand-inserted `Code: input.entityId` glue
   step. Non-obvious; a builder-level papercut.
3. **Agent chat can only `open`** (F-460). Curated tools = the read-only `open`
   verb; mutating verbs are deferred to the (not-yet-shipped) Agent-5
   per-conversation grant UI. Worse, the model can *narrate* an action it can't
   perform. So the "chief-of-staff that files things for me" story is not true
   from chat yet (it **is** true from a workflow's AIAgent step).
4. **Provider must be configured** — no bundled cloud key; a fresh install with
   no Ollama running and no BYO key makes every AI step fail `Unavailable`. The
   demo needs a provider connected first; there's no first-run nudge.
5. **Notify text is static** — a "new urgent email" alert can't include the
   subject or the AI's verdict.
6. **Real inbound email needs a connected mailbox** (Mailbox-9 OAuth still
   pending per memory). For a self-contained demo, seed the `Email` entity or use
   a `Webhook`/`Manual` trigger.

## (c) The single best business use-case — as a user story

> **Mira runs a small studio. Support requests land in her shared inbox.**
> She builds one automation in the Automations app:
>
> - **Trigger — "When a new Email arrives"** (`EntityEvent`, `brainstorm/Email/v1`,
>   `create`).
> - **Step 1 — load the email** (get its subject + body).
> - **Step 2 — AICall "Triage":** _"You are a support triage classifier. Reply
>   with one word: urgent, normal, or spam."_ → the model returns the priority
>   (recorded in the run log).
> - **Step 3 — AIAgent "Draft reply":** _"Draft a brief, friendly reply
>   acknowledging the customer's report."_ with one tool, **`compose`** → the
>   agent writes a reply and hands it to Mailbox's composer, **pre-filled**.
>
> Mira opens the draft, reads it, and hits send. **The AI triaged and wrote;
> Mira approved and sent.** Runs are logged so she can audit every one.

Why this one: it is authorable today, proven end-to-end, needs no missing step
kind, and the human-in-the-loop send is a *feature* (trust), not a limitation.
A compelling one-line pitch: **"Your inbox triages and drafts itself; you stay
in control of send."**

## (d) Smallest gap-list to make this one flow bulletproof

Ordered by leverage; none is large.

1. **Accept `entityId` in `operandId`** (or alias the EntityEvent payload's id) so
   the **Email arrives → load email** wiring needs no glue `Code` step (F-459).
   ~one-line; removes the single most confusing authoring step.
2. **First-run "connect an AI provider" gate** + surface a clear run failure when
   a step hits `Unavailable`, so the demo can't silently no-op (gap 4).
3. **Dynamic Notify** — allow the notify title/body to interpolate prior step
   outputs, so a "new urgent email: <subject>" alert is possible (gap 5). Small,
   and gives a fully-working *notify-only* variant that needs no compose/Mailbox.
4. **(Stretch, unblocks "file it")** pick ONE of: a static/template `properties`
   field on Entity Create/Update that interpolates prior outputs, **or** a
   first-party "create Task / set priority" intent the AIAgent can call. Either
   turns the flow into "triage **and file**" (F-458). Recommend the Entity
   template field — smallest and most legible in the builder.
5. **Honesty fix for Agent chat** — state in the system prompt that its tools are
   read-only so it stops implying it filed something (F-460). (The full Agent-5
   grant UI is the larger, separate feature.)

Items 1–3 are the true "bulletproof the demo" set; 4 is the upgrade from
_draft_ to _draft-and-file_; 5 is a chat-side honesty fix.

---

_Evidence: `packages/shell/src/main/integration/business-triage-flow.test.ts`
(green). Friction filed: F-458 (write-back gap), F-459 (EntityEvent glue-step),
F-460 (agent chat read-only)._
