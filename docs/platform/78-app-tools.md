# 78 — App tools (installed apps as typed tool providers)

Builds on [17-interoperability.md](17-interoperability.md) (the interop mechanisms; "cross-app communication is request/response **or** fire-and-forget by intent"), [63-action-surface.md](63-action-surface.md) (contributed actions in other apps' menus, `AS-1`→`AS-4` ✅), [62-agent-harness.md](62-agent-harness.md) (the Tools layer), [64-mcp-integrations.md](64-mcp-integrations.md) (external MCP servers as a tool source — the model this doc copies), [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md) (`AgentTool`, the closed `StepKind` vocabulary), [75-agent-notes-seam.md](75-agent-notes-seam.md) (propose→approve) and [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capabilities, fail-closed broker).

> **Decision:** an installed app is a **tool provider**, exactly as a connected MCP server already is. An app declares typed, named, individually-addressable **tools** in its manifest; the shell registers them, validates their arguments, and routes calls to the providing app's sandbox. **One registry, three consumers** — other apps' menus, the agent's tool layer, and automation steps — all see the same declarations.

The user-facing story is unchanged from [63](63-action-surface.md): *install the Agent app, and "Rewrite" appears when you select a paragraph in a Journal entry.* What changes is the mechanism. Instead of teaching menus about a new kind of target, an app publishes `rewrite(text, tone) → text`, and every consumer — a menu, the agent, a workflow — discovers and calls the same thing.

## Why this, and not more of the intent surface

Brainstorm already has a tool surface. [64 §Architecture](64-mcp-integrations.md) states it as `tools = grantedIntents ∪ enabledMcpTools ∪ codeRunner`. The first source is the weak one, and its weakness is shipped and documented:

- **A tool is addressed by its verb alone, so two tools collide.** From `apps/agent/src/logic/agent-tools.ts`: *"The shared loop addresses a tool by its `verb` alone, so two tools sharing a verb collide."* That is why the Agent exposes exactly one curated `open` tool rather than one per type. Any design that gives apps more actions on the *intent* namespace makes this worse.
- **There is no input schema.** `AgentTool` is `{ verb, entityType?, format?, label, outputSchema? }` — the model receives a verb name and a prose label. (`outputSchema` is typed `unknown` and no validator consumes it; doc 39's promised `output-schema-violation` has no implementation.)
- **The verb namespace is closed by design** (13 verbs, `INTENT_VERBS`), and correctly so — it exists so the shell can *route* "somebody handle this" without knowing the handler. App methods don't need routing; the caller has already chosen the app. Forcing them through a closed routing vocabulary is what produced the `process` + free-text `kind` idiom the Agent app uses today (`process:summarize`, `process:ask`) — a method name smuggled through a routing field.

Meanwhile [64](64-mcp-integrations.md) already solved every one of these for *external* servers: namespaced ids (`mcp.<serverId>.<toolName>`, so two servers can each expose a `search`), a discovery call, an invocation call, per-tool capability scopes, and a worked-out untrusted-text posture. **This doc gives installed apps the same treatment.** The symmetry is the design:

```
tools  =  grantedIntents  ∪  appTools  ∪  enabledMcpTools  ∪  codeRunner
                             ↑ this doc      ↑ doc 64
       app.<appId>.<toolName>            mcp.<serverId>.<toolName>
```

A tool provider is an installed app or a connected MCP server; consumers do not care which. One is in-vault and sandboxed, the other is external and egress-gated — and the in-vault one can additionally render as a menu action.

## The model

### Declaration — `registrations.tools`

As shipped through `Tool-3` (this block is the real contract, not a sketch —
`AppToolRegistration` / `AppToolInput` in `packages/sdk-types/src/app-tools.ts`):

```jsonc
"registrations": {
  "tools": [
    {
      "name": "rewrite",                          // app-scoped ⇒ app.io.brainstorm.agent.rewrite
      "title": "Rewrite",                         // t()-translatable; the menu label
      "description": "Rewrite text in a different tone or length.",
      "input": [
        { "name": "text", "description": "The text to rewrite.",
          "required": true, "valueType": "text" },
        { "name": "tone", "description": "How the rewrite should read.",
          "required": false, "valueType": "text",
          "choices": ["concise", "formal", "plain"] }
      ],
      "effect": "pure",                           // pure · reads-vault · proposes-write · external
      "appliesTo": ["brainstorm/Note/v1"],        // declared entity types; empty/absent = any
      "surfaces": ["menu", "agent", "automation"] // absent = registered but never presented
    }
  ]
}
```

Per-argument modifiers each bind to one `valueType` and are refused elsewhere
(a silently-ignored modifier is a provider believing in a bound the broker
never enforces): `pattern` + `choices` + `format` on `text`, `range` on
`number`, `granularity` on `date`, `allowedTypes` on `entityRef`, and `count`
(`{min,max}`) on any of them to make the argument a list. `valueType:
"richText"` is refused outright — see the `Tool-3` note under the decision
below.

> **Drift, filed honestly:** an earlier sketch of this block carried `output`,
> `icon`, `group`, `priority`, an object-shaped `appliesTo` (`contentKinds`)
> and selection/object surfaces. None of those shipped in `Tool-2`. Result
> typing is `Tool-8`'s, and menu presentation (`icon`/`group`/`priority`,
> selection vs object placement) is `Tool-7`'s — they are not lost, but the
> manifest does not accept them today.

Registered in `registry.db` as an `app_tools` table with its own repo, following the existing registration pattern (`openers`, `blocks`, `entity_types`, `widgets`, `intents`).

> **Decision:** tool arguments are described with **`PropertyDef`, not raw JSON Schema.** The repo has no JSON-Schema validator (no `ajv`), and the two places it reads inline schemas today only *distill* them (`propertiesFromSchema`, `extractFieldsFromTypeSchema`) — nothing validates a value against one. `PropertyDef` is the one typed-value system with a real validator (`validatePropertyDef` / `validateValue`) that the broker already re-runs defense-in-depth. Reusing it buys **argument validation at the broker, before the call reaches the providing app** — a property MCP's deliberately-opaque `inputSchema` does not have. The model still receives a JSON-Schema *projection* of the `PropertyDef` list, since that is what an LLM tool definition wants.
>
> *Ratified 2026-08-02 (OQ-TOOL-1) and built as `Tool-3`.* As shipped it adopts `PropertyDef`'s **value-type system and validator**, not its record shape — `key`/`icon`/`display`/`unique` describe a stored column, not a value in flight — so an argument is an `AppToolInput`, and `validateAppToolArgs` synthesizes a real `PropertyDef` to run the shared `validateValue` against. Two consequences worth stating plainly: **`richText` is not a callable argument type** (its `validateValue` arm is a deliberate no-op, so it would have been the one type crossing the broker unchecked), and **tool arguments are checked strictly while stored property values are not** — `pattern`/`range`/`choices`/`format` are enforced in the tool-argument layer rather than pushed into the shared validator, which would retroactively reject stored values across every vault.

### Discovery and invocation

Two broker methods, deliberately MCP-shaped:

- **`tools.list({ appliesTo?, surface? })`** — the tools this caller may see, filtered by applicability, capability, and the per-app disable switch from `AS-4`.
- **`tools.call({ tool, args })`** — validate args against the declared `PropertyDef`s, check capabilities, route to the provider, return the typed result.

Capabilities reuse the existing `(appId, capability, scope)` ledger shape with no new machinery, because `scope` is a free string:

| Capability | Grants |
|---|---|
| `tools.provide` | The app may publish tools at all (provider side). |
| `tools.call:<appId>` | The caller may invoke any tool of that provider. |
| `tools.call:<appId>/<toolName>` | Per-tool narrowing (mirrors `mcp.tool:<id>/<tool>`). |

### The missing wire: a reverse channel

**Every shell→app message today is fire-and-forget.** All ~20 channels are `webContents.send`; the app-side `LifecycleEmitter` discards handler return values; and `menu:invoke` — the one channel explicitly designed as a trusted shell→app dispatch — was never subscribed to by the app preload, so it is dead. There is no correlation id, no reply path, no timeout.

So the first thing to build is an `AppCallHost`: correlation-id request/response from the shell into an app renderer. Three shipped precedents to copy rather than invent:

- **`OpenWithPromptHost`** — correlation map, 60 s timeout, `MAX_PENDING = 16`, per-key dedup, drain-on-detach, **fail-closed default decision**. The closest architectural sibling.
- **`WorkerBridge`** — the canonical pending map: 30 s timeout → *reject*, `dispose()` → *resolve with an `Unavailable` reply*. That asymmetry is deliberate and worth preserving.
- **Block-frame transport's six inbound gates** — identity, channel id, phase, direction, payload cap, rate limit, with silent drops and per-reason counters ("logging a spoofing attempt would itself be a DoS vector").

App side, the runtime gains a real handler registry — not a lifecycle event, since `on()` cannot return a value:

```ts
brainstorm.tools.handle("rewrite", async ({ text, tone }) => ({ text: await rewrite(text, tone) }));
```

## Security and capabilities

**The reply-identity check does not exist today and must.** The existing prompt hosts (`open-with`, `os-handoff`, `capability`) accept replies without checking `event.sender`, which is safe only because those channels are exposed exclusively by the *dashboard* preload. App preloads are shared across every app, so a reply from an app must be run through `RendererIdentityRegistry` and matched against the app the request was sent to. This is the single most important new invariant.

**A tool's name and description are untrusted text that reaches the model.** Exactly the MCP vector doc 64 calls "the under-appreciated one" — a sideloaded app authoring `description` is authoring part of the agent's prompt. The mitigations already exist and are reused wholesale: `sanitizeToolDescriptor`, length caps (`MCP_TOOL_NAME_MAX` / `MCP_TOOL_DESCRIPTION_MAX`), rendering in a quarantined region and never as `<system>` text, the rug-pull re-prompt (`toolDescriptorFingerprint` / `detectRugPull`), and **no tool may claim an id colliding with a curated intent verb or an `mcp.*` id**.

**A tool never writes the caller's data.** It receives values and returns values — it is never told *where* the data came from, so it cannot aim a write. A tool declaring `effect: "proposes-write"` returns a proposal the caller renders and the user approves ([75](75-agent-notes-seam.md)/OQ-ANS-4, generalized from the agent to every app). This is what makes it safe to let an arbitrary installed app offer to rewrite your journal, and it is a property of the signature rather than of any anchor machinery.

**Effect is declared, and friction follows from it** — `pure` (no vault read, no side effects) may auto-run; `reads-vault` and `external` follow the existing capability and egress paths; `proposes-write` can never persist. As with MCP's `readOnlyHint`, **a provider's declared effect lowers friction but is never a security boundary** — the capability check is. `decideToolFriction` already encodes this policy.

**Fail-closed everywhere else is inherited:** the broker capability check per call, `Unavailable` on any throw, `intersectAgentTools`' three-tier `tools ⊆ conversation grants ⊆ app caps`, per-app disable, and `AS-4`'s trust tiers for what renders inline.

**Lifetime hazards are real and shell-owned.** The app preload deliberately returns never-settling promises after `pagehide` to avoid dying-page errors — a provider could therefore hang a call forever, so the *shell* owns the timeout. Window close ≠ renderer death (containers are parked, LRU-evicted at 3), and crash handling today is observe-only and settles nothing pending.

## Performance budgets

- `tools.list` is a registry read on menu open — it must not touch content, and applicability matches on declared `contentKinds` only. Argument values are materialized on activation, never on menu open.
- `tools.call` adds one broker hop plus one renderer round trip; the shell-side budget is the existing sub-2 ms routing, with user-visible latency dominated by the provider (doc 17's spinner rule applies).
- Shell-owned deadline per call (proposed 30 s, mirroring `WorkerBridge`), a pending cap per caller, and argument/result size caps.
- A cold provider costs a renderer launch — see `Tool-8`.

## Non-goals

- **A general app-to-app RPC or message bus.** Calls are shell-mediated, capability-gated, size- and time-bounded, and addressed to a declared tool. Doc 17's non-goals hold unchanged.
- **A new `StepKind`.** The automations vocabulary is closed on purpose ("an open extension surface would make workflow audits intractable"); app tools ride the existing `AgentTool` path.
- **Replacing intents.** Intents remain the *routing* layer — open, quick-look, compose, share; one-way, curated, "somebody handle this". Tools are the *calling* layer — app-namespaced, typed, request/response, "this app compute this". Both stay.
- **Provider code in the host process.** Still never; the shell mediates every call.
- **Arbitrary code as a tool.** That is the post-v1 code-runner ([62](62-agent-harness.md)), with its own sandbox and open questions.

## Phasing

| Capability | v1 | post-v1 |
|---|---|---|
| Shell→app request/response (`AppCallHost`) | ✓ (`Tool-1`) | streaming / progress |
| Manifest `registrations.tools` + registry + `tools.list` | ✓ (`Tool-2`) | — |
| `PropertyDef` argument typing + broker-side validation | ✓ (`Tool-3`) | richer value types |
| `tools.call` + capability scopes + effect-driven friction | ✓ (`Tool-4`) | per-tool user policy |
| Untrusted-descriptor hardening + rug-pull re-prompt | ✓ (`Tool-5`) | per-tool review at install |
| Projection into the agent's tool layer | ✓ (`Tool-6`) | subsumes intent-derived tools |
| Menu presentation (selection / block / slash / object) | ✓ (`Tool-7`) | canvas + cell surfaces |
| Headless provider invocation | — | ✓ (`Tool-8`, OQ-TOOL-3) |
| Automations `AgentTool` carrying id + input schema | ✓ (`Tool-9`) | `outputSchema` enforcement |

## Cross-doc reconciliation needed

- **[62-agent-harness.md](62-agent-harness.md)** — Layer B's "two families" becomes a third source; the `skills` manifest registration floated there is superseded by this (a skill remains a saved `Workflow/v1`; an app-contributed *procedure* is a tool). Note that the verb-collision constraint is lifted for app tools.
- **[64-mcp-integrations.md](64-mcp-integrations.md)** — the Tools-layer union gains `appTools`; the untrusted-descriptor posture is factored out so both sources share it rather than copying it.
- **[63-action-surface.md](63-action-surface.md)** — contributed actions become the *menu presentation of tools that declare a UI surface*. Its `AS-1`→`AS-4` anti-rot policy (group / dedupe / rank / inline cap / trust quarantine / per-app disable) applies unchanged and is not rebuilt. Its phasing row claiming selection-menu adoption is stale — `Tool-7` is the honest pickup (`useContributedActions` has **zero callers**; only `openObjectMenu` does a suggest pass).
- **[17-interoperability.md](17-interoperability.md)** — the four-mechanism table gains the calling/routing split under Mechanism 2; its own non-goals already promise request/response.
- **[39-automations-and-workflows.md](../apps/39-automations-and-workflows.md)** — `AgentTool` gains a namespaced id and a real input schema; `outputSchema`'s unimplemented validation is filed honestly rather than assumed.
- **[08-app-sdk.md](../apps/08-app-sdk.md)** + **[09-shared-sdk-catalog.md](../apps/09-shared-sdk-catalog.md)** — document `brainstorm.tools.handle` / `tools.list` / `tools.call`, and add the still-missing `useContributedActions` entry.
- **`menu:invoke`** — the dead, half-built trusted shell→app channel is either subscribed by `Tool-1`'s machinery or deleted; leaving it as-is is worse than either.

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md): **OQ-TOOL-1** (argument schema language — `PropertyDef` vs JSON Schema), **OQ-TOOL-2** (do app tools subsume intent-derived agent tools, or coexist), **OQ-TOOL-3** (may a tool call launch a headless provider), **OQ-TOOL-4** (may a sideloaded provider's tool text reach the model at all), **OQ-TOOL-5** (effect-driven auto-run vs always-confirm), **OQ-TOOL-6** (shared trace substrate with [77](77-agent-observability.md)).

## Summary

- **Apps become tool providers, exactly like MCP servers already are** — typed, namespaced (`app.<appId>.<toolName>`), discoverable, callable. The symmetry with [64](64-mcp-integrations.md) is the whole design; consumers stop caring whether a tool came from an installed app or an external server.
- It **corrects a shipped limitation** rather than adding a surface: today a tool is addressed by verb alone so two tools collide, and the model gets a prose label instead of a signature.
- **One registry, three consumers** — menus ([63](63-action-surface.md)), the agent loop ([62](62-agent-harness.md)), automation steps ([39](../apps/39-automations-and-workflows.md)). An app declares a capability once and it appears everywhere it applies.
- The **first rung is a reverse channel that does not exist**: every shell→app message today is fire-and-forget, and the one channel designed for trusted dispatch was never wired up on the app side.
- Safety is inherited, not invented: a tool takes values and returns values (so it cannot aim a write), writes are proposals a human approves, provider-authored text is untrusted input reusing MCP's hardening, and the capability check — never the provider's declared effect — is the boundary.
