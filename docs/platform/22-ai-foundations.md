# 22 — AI foundations

This doc establishes AI as a **first-class architectural concern from day one** in Brainstorm. Earlier drafts (in [01-vision.md](../foundations/01-vision.md)) listed "Not an AI-first interface" as a non-goal — that position has been **reversed**. The market reality is that a knowledge-management product without integrated AI is not viable; trying to bolt it on later means rebuilding the security model, the provenance model, the storage subsystem, and the SDK surface.

This doc covers AI from every angle: surfaces, architecture, privacy/security, provenance, streaming, embeddings, the shell-vs-app split, the cost model, and phasing.

It builds on [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) (the BP Service Module is *the* AI integration path), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (the trust model AI rides on), [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (AI's complicated relationship with E2E), [17-interoperability.md](17-interoperability.md) (the `intent.process` verb), and [18-storage-and-search.md](../data/18-storage-and-search.md) (vector indexing).

## Why AI from day one

A pure "users opt their apps in to AI" approach has three failure modes:
- Each app reinvents provider config, streaming, retry, key management. The duplication grows; quality stays low.
- AI's interaction with the encryption model is the kind of thing that has to be designed early. Retrofitting "but the LLM needs to see plaintext" without compromising E2E is harder than designing for it.
- Provenance — distinguishing AI-generated content from human-authored content — must be a *property of every entity* if it's to mean anything. Adding it later means a data migration across everything.

So AI is integrated at the shell level, surfaced consistently in the SDK, with privacy and provenance baked into the data model.

## Principles

1. **AI is mediated by the shell, not by individual apps.** Apps invoke AI through standardized channels; the shell handles provider routing, key management, streaming, retries, audit.
2. **The user controls AI access.** Which provider, which model, which data is exposed — all explicit. No quiet defaults.
3. **AI runs on the trusted side of the encryption boundary.** When AI sees content, it sees plaintext on the user's device (or a server they explicitly trust). The relay never sees AI prompts or responses.
4. **Provenance is universal.** Every entity, every property value, every block can be marked as AI-generated. Confidence and source travel with the data.
5. **On-device first where possible.** For privacy-sensitive operations (semantic search, simple completions, classification), local models are preferred. Cloud is opt-in.
6. **AI capability requests are explicit per app.** No app gets AI access ambiently; it's a capability like any other.
7. **AI-generated content is editable.** Suggestions are suggestions. The user is the author; AI is a tool they use.
8. **AI ships as an installable app, not baked into the shell.** The broker is infrastructure, but the *surfaces* arrive with apps the user installs (the Agent app for conversation; any app's `process` contributions for in-context actions). Don't install them and there is no AI in the product — the shell does not embed AI into Notes, Database, or any other app.

> **Decision:** AI in Brainstorm is **opt-in by installation**. The shell owns the broker (provider routing, streaming, context, audit) but exposes no AI UI of its own; AI features reach the user as **contributed actions** ([63 — action surface](63-action-surface.md)) and the **Agent app** ([55](../apps/55-agent-app.md)/[62](62-agent-harness.md)). Installing the Agent app makes "Summarize", "Generate image", and chat appear across relevant menus; uninstalling it makes them vanish. This is not just positioning — it is the architecture, and it is the credibility claim for the privacy-conscious user: *no AI runs unless you installed something that does.*

## The five surfaces of AI

Different things people mean when they say "AI in a knowledge product". Brainstorm names them so the SDK and UI can address them distinctly.

### 1. Generation

Produce new content from a prompt or context: autocomplete, drafting, summarization, expansion. Output is text, structured data, or both.

| Examples                                                              | SDK shape                              |
|-----------------------------------------------------------------------|-----------------------------------------|
| "Continue this paragraph"                                              | `ai.generate({ prompt, context })`     |
| "Summarize these notes"                                                | `intent.process` with `kind: summarize` |
| "Draft an email reply"                                                 | `ai.generate({ template, vars })`      |
| "Generate a kanban-board structure for this project"                   | `ai.generate({ schema, context })`     |

### 2. Extraction

Pull structured data from unstructured: action items from a meeting note, properties from an email, entity references from prose.

| Examples                                                              | SDK shape                              |
|-----------------------------------------------------------------------|-----------------------------------------|
| Notes app: "Find tasks in this note" → creates Task entities           | `ai.extract({ source, intoType })`     |
| Person app: "Parse this signature into Person fields"                  | `ai.extract({ source, schema })`       |
| Database app: "Auto-fill the Priority field based on the description"  | `ai.fillProperties({ entity, properties })` |

> **Decision:** extraction outputs are **suggestions**, not direct writes. The user (or app, on the user's behalf) accepts, rejects, or edits the suggestion before it persists.

### 3. Search

Semantic search and hybrid (keyword + semantic) search across the user's data.

| Examples                                                              | SDK shape                              |
|-----------------------------------------------------------------------|-----------------------------------------|
| "Find notes about project X" — semantic match, not just keywords      | `search.semantic({ query, scope })`    |
| "Find entities similar to this one"                                    | `search.similar({ entityId })`         |
| "Hybrid: keyword AND semantic"                                         | `search.hybrid({ query, scope })`      |

This requires **embeddings** for entities. See "Embeddings and vector search" below.

### 4. Transformation

Rewrite or convert content while preserving meaning: translate, change tone, format-shift (markdown → outline → bullet points).

| Examples                                                              | SDK shape                              |
|-----------------------------------------------------------------------|-----------------------------------------|
| "Translate this note to German"                                       | `ai.transform({ source, kind: translate, params })` |
| "Make this more formal"                                                | `ai.transform({ source, kind: rewrite })`  |
| "Convert to bullet points"                                            | `ai.transform({ source, kind: format })`   |

Transformations live under `intent.process` (per [17-interoperability.md](17-interoperability.md)) with `kind` values for each transformation.

### 5. Conversation

Chat with an agent that has access to (parts of) the user's data. The most user-facing AI surface; also the most complex (context, memory, action-taking).

| Examples                                                              | SDK shape                              |
|-----------------------------------------------------------------------|-----------------------------------------|
| "Hey, what did I commit to in last week's meetings?"                  | A dedicated chat app or shell surface    |
| "Plan my week based on my open tasks"                                 | Conversation + transformation + extraction |
| "Watch for new entities tagged Urgent and notify me"                  | Conversation that yields a saved query  |

> **Decision:** conversation is a primary use case but **not bundled into the shell** in v1. A first-party chat app provides it. The shell exposes infrastructure (provider, streaming, context fetch); the chat app provides UX.

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  APPS                                                                  │
│   call ai.generate / ai.extract / ai.transform / search.semantic       │
│   register intent.process handlers (BP Service Module)                 │
│   render AI suggestions, streaming tokens, accept/reject UX            │
└────────────────────────┬───────────────────────────────────────────────┘
                         │ via SDK ai.* / search.*
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  SHELL — AI BROKER                                                     │
│   - capability checks (ai.use, ai.context:<scope>)                      │
│   - provider routing (which model, which endpoint)                      │
│   - key management (BYO keys / org-managed)                             │
│   - streaming / abort / retry plumbing                                  │
│   - prompt injection mitigations                                        │
│   - context assembly (entity content + property hints)                  │
│   - audit logging                                                       │
│   - cost / quota tracking                                               │
└──────┬──────────────────────┬─────────────────────────────────────┬────┘
       │                      │                                     │
       ▼                      ▼                                     ▼
┌───────────────┐    ┌─────────────────┐                  ┌─────────────────┐
│ Local model   │    │ User-configured │                  │ Embedding model │
│ (small)       │    │ cloud provider  │                  │ (local default) │
│ - llama.cpp / │    │ - Anthropic     │                  │ for vector      │
│ - on-device   │    │ - OpenAI        │                  │ index           │
│ - private     │    │ - others        │                  └─────────────────┘
└───────────────┘    └─────────────────┘
```

### The AI broker

A **core service** in the shell — call it the **AI broker** — owns:

- **Capability check** — apps must hold `ai.use` plus more granular scopes (`ai.context:entityType:io.example/Note/v1`, `ai.cost:budget:50/mo`, etc.).
- **Provider abstraction** — apps don't pick providers; they call standardized verbs. The shell routes per the user's configuration (default provider, per-feature overrides).
- **Streaming** — token-by-token responses surface via the SDK as `AsyncIterable<Token>`. Abort signals propagate.
- **Context assembly** — when an app says "summarize this entity", the shell decides what content to pack into the prompt, applying the user's privacy preferences and the app's capability scope.
- **Prompt injection mitigations** — the shell sanitizes user content before merging with system prompts, distinguishes trusted (system) vs. untrusted (user content) regions, and logs anomalies.
- **Audit log** — every AI call is recorded with entity id (if any), provider, model, token count, cost, app, and timestamp.

### BP Service Module as the integration path

Per [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), Block Protocol's **Service Module** lets a block call external services through the host without holding credentials. This is exactly the right shape for AI.

> **Decision:** AI access from blocks goes through BP's Service Module. The shell implements service handlers for the standard AI verbs (generate, extract, transform, search). Blocks call them; credentials and routing stay in the shell.

> **Decision:** Brainstorm-specific AI verbs not yet in BP's Service Module (e.g. `extract` with structured-output schema) are documented as Brainstorm extensions; we contribute them upstream where they generalize.

### Provider abstraction

The shell ships with a **provider registry** — a set of provider plugins that implement a small interface:

```ts
interface ModelProvider {
  id: string;                                  // "anthropic" | "openai" | "ollama-local" | ...
  capabilities: { generate: boolean, embed: boolean, chat: boolean, vision: boolean, ... };
  generate(prompt, options, signal): AsyncIterable<Token>;
  embed(text, options): Promise<Float32Array>;
  // ...
}
```

The user configures providers in shell settings:
- Default provider for each surface (generate / extract / search / chat).
- API keys (BYO).
- Per-app overrides (an app can request a specific provider; user approves).

> **Decision:** provider plugins are part of the shell's bundled set. Adding a new provider requires a shell update (we don't allow third-party provider plugins in v1 — the trust surface is too sensitive).

> **Open:** in v2, are third-party providers possible (e.g. an enterprise that wants to plug in their internal LLM gateway)? Probably yes via an org-managed provider config. Tracked as OQ-56.

### On-device vs. cloud

> **Decision:** the shell ships with **a small bundled local model** (e.g. a 1–4B-parameter Llama-class model, or platform-native via macOS Foundation Models / Windows Phi Silica when available) for privacy-sensitive operations: semantic search embeddings, classification, simple extraction. Cloud providers are opt-in and the user picks their preferred one.

Reasoning:
- A local model means semantic search works on E2E content without leaking to a cloud.
- Cloud quality is much higher for generation; users who want it can plug in their key.
- Hybrid: local for routine work (search, classification, low-stakes completions); cloud for high-value generation.

> **Open:** which local model(s) ship by default, and what's the disk-size budget? Llama 3.2 1B is ~700MB; 3B is ~2GB. The user should be able to disable / swap. Tracked as OQ-57.

> **Open:** when a user is offline and only the local model is available, do features that requested cloud silently fall back to local, fail explicitly, or queue for later? Tracked as OQ-58.

## Privacy and security

### AI on the trusted side of the encryption boundary

Per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md), Brainstorm's relay is operationally blind. AI fundamentally needs plaintext to do its work. So:

> **Decision:** for E2E content, AI invocations happen **on the user's own device** (using the local model) **or to a cloud endpoint configured by the user with their own credentials**. Brainstorm's hosted infrastructure does **not** broker AI calls for E2E content.
>
> For server-readable spaces (per [16](../security/16-identity-orgs-encryption.md)), the org's server can run AI on its plaintext copy — that is the whole point of opting into server-readable mode.

Practical implications:
- Default provider configurations are local-first.
- The cloud-provider flow surfaces a clear privacy notice ("Data sent in this prompt will be visible to {provider}.").
- Audit logs record provider per-call for transparency.

### Prompt injection

User content (notes, emails, comments) can contain text that tries to manipulate the AI ("Ignore previous instructions and …"). Brainstorm mitigates this at the broker level:

- **Region tagging** — the prompt sent to the model has explicit `<system>`, `<user>`, and `<content>` regions. System instructions are never derived from user content.
- **Sanitization** — known injection patterns (e.g. literal "ignore previous instructions") are flagged for the user before the call goes out (configurable: warn / block / pass).
- **Output filtering** — model outputs are parsed structurally where possible; free-form output is not granted the same trust as user input.
- **Capability narrowing** — an AI call cannot perform side effects beyond its declared scope. "Summarize" cannot also "delete entity".

> **Open:** how aggressive should default prompt-injection filtering be? Too aggressive blocks legitimate prompts ("can you ignore the typos in this draft and …"). Tracked as OQ-59.

### Key management

> **Decision:** v1 supports **bring-your-own-key (BYO)** only. Users supply their API keys for cloud providers; keys are stored in the OS keychain (per [09-security-and-sandbox.md](../security/09-security-and-sandbox.md)) and never leave the device.
>
> v2 adds **org-managed keys**: an organization can configure a single API key (or relay endpoint) for all members. This is part of the consumer/org/account stack in [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

> **Open:** does Brainstorm offer a hosted relay-style "pay-as-you-go" AI brokering for users who don't want to manage keys? This is a real product surface but blurs the local-first principle. Tracked as OQ-60.

### Audit and rate limits

- Every AI call is recorded in the per-app audit log: provider, model, prompt size (token count), response size, cost estimate, success/failure, originating intent.
- Per-app rate limits prevent runaway costs. The shell enforces them; apps see `Unavailable` when exceeded.
- The user can review AI activity in a settings panel and revoke or restrict per-app.

## Provenance

Every AI-generated piece of content carries provenance metadata.

> **Decision:** every entity has an optional `aiProvenance` block recording AI's role in its creation:

```jsonc
{
  "type": "io.example/Note/v1",
  "properties": {
    "title": "Q3 review takeaways",
    "body": { "$ref": "doc://..." },
    "aiProvenance": {
      "kind": "extracted",                 // generated | extracted | transformed | suggested | partial
      "byApp": "io.example.notes",
      "via": "anthropic/claude-opus-4-7",
      "atUtc": 1700000000000,
      "confidence": 0.82,                   // optional, model-provided where available
      "userAccepted": true                  // did the user accept this output as-is?
    }
  }
}
```

- `kind: "generated"` — fully created by AI.
- `kind: "extracted"` — pulled out of source content by AI.
- `kind: "transformed"` — AI rewrote or converted existing content.
- `kind: "suggested"` — AI proposed; pending user accept/reject.
- `kind: "partial"` — mixed authorship (some AI, some user).

For finer granularity, individual properties can carry their own `aiProvenance`:

```jsonc
"properties": {
  "title": "Manually written",
  "summary": "AI-generated summary...",
  "_provenance": {
    "summary": { "kind": "generated", "via": "...", "atUtc": ... }
  }
}
```

UI surfaces show provenance as a small marker (an AI dot, an "AI-suggested" pill on suggestions). The user can request "show only AI-generated content" or "show only my own writing".

> **Decision:** AI provenance is part of the entity's data and syncs like any property. It is never silently stripped on edit. If a user manually overwrites an AI suggestion, the provenance updates to `partial` or clears, depending on the edit's scope.

## Streaming UI

AI responses arrive as token streams. Brainstorm standardizes this.

> **Decision:** the SDK exposes AI calls as `AsyncIterable<Token>`. Apps render incrementally, support abort via `AbortSignal`, support regenerate, and accept/reject as discrete actions:

```ts
const stream = brainstorm.services.ai.generate({
  prompt,
  context,
  signal: abortController.signal,
});
for await (const token of stream) {
  appendToUI(token);
}
```

Standard UI primitives for AI surfaces (provided by the SDK):
- Typing indicator while waiting.
- Token-by-token rendering with live cursor.
- Abort button.
- Regenerate button (with optional modifier: "shorter", "different angle").
- Accept / reject affordances (with modifier persistence: don't ask again, always accept this app's suggestions, etc.).

These primitives compose with `fancy-menus` for command-palette-style AI launchers.

## Embeddings and vector search

Earlier, [18-storage-and-search.md](../data/18-storage-and-search.md) had vector search as OQ-36 with a "defer indefinitely" lean. **That's reversed.**

> **Decision:** Brainstorm v1 ships local **vector indexing** of entity content alongside the FTS5 lexical index. Both indexes are queried; results are hybrid-ranked.

Specifics:
- **Index target** — for each entity, a single embedding computed from its title + body / primary text properties (per the entity type's display hints).
- **Update pipeline** — the search worker (per [18-storage-and-search.md](../data/18-storage-and-search.md)) computes embeddings on entity write/update, using the local embedding model. Lag is bounded by the same change-log mechanism as FTS5.
- **Storage** — `sqlite-vec` (or `sqlite-vss`) extension stores vectors in `search.db` alongside FTS5 indexes. Same encryption-at-rest envelope.
- **Query** — `search.semantic` returns top-k by cosine similarity; `search.hybrid` blends with FTS5 BM25 scores.

> **Open:** which vector extension — `sqlite-vec` (newer, simpler) or `sqlite-vss` (more mature)? Both have trade-offs. Tracked as OQ-61.

> **Open:** which local embedding model? Has to be small enough to ship (a few hundred MB max), good enough for English at minimum, with multilingual being a strong bonus. Candidates: bge-small, all-MiniLM, or platform-native. Tracked as OQ-62.

## Shell vs. apps

The split:

| Concern                                                       | Shell                                                | Apps                                            |
|---------------------------------------------------------------|------------------------------------------------------|-------------------------------------------------|
| Provider config, keys, defaults                               | ✓                                                    | request via capability                          |
| Local model bundling, embedding pipeline                      | ✓                                                    | use via SDK                                     |
| Streaming plumbing, abort, retry                              | ✓                                                    | render via SDK primitives                       |
| Audit logging, rate limits, cost tracking                     | ✓                                                    | observe via `ai.usage`                          |
| Prompt injection mitigations (broker level)                   | ✓                                                    | additional app-level checks if relevant         |
| Provenance metadata application                                | ✓ (the broker stamps provenance on outputs)          | app may augment with its own provenance         |
| **Generation, extraction, transformation, conversation UI**    | bare primitives (chat-like helper components)         | the actual product features                     |
| The chat / agent app                                          | not in shell                                         | a first-party app                                |

The shell deliberately does not own the AI *experience* (chat panel, autocomplete UI, etc.) — those live in apps. The shell owns the *infrastructure*.

## Cost model

> **Decision:** the user pays for cloud AI through their own provider keys. Local model use has no marginal cost.

For v2, when consumer accounts and orgs land:
- Optional **platform-managed AI**: pay-as-you-go billing through the consumer account, hosted relay-style. Full economics (margin, bundled credits, rollover) in [43-monetisation-strategy.md §AI monetisation](43-monetisation-strategy.md) and [44-pricing.md §Bundled AI credits](44-pricing.md). Quota / capability / billing wiring in [45-payments-architecture.md §Capability surface](45-payments-architecture.md) and §Quota enforcement.
- **Org-managed quotas**: orgs set per-member budgets, override per-app. Org-pooled bundled credits per [44 §Bundled AI credits](44-pricing.md).

Per-app quotas (set by the user) cap exposure: "this app may use up to $5/mo of cloud AI". Over budget: app sees `Unavailable`; user is surfaced a "raise budget?" prompt.

> **Open:** how granular are quotas — per-app, per-feature within an app, per-time-window? Tracked as OQ-63.

## Phasing

> **Decision:** v1 ships AI infrastructure broadly, AI features narrowly. The infrastructure must be in place from day one; the features grow incrementally on top.

| Capability                                              | v1   | v2  |
|---------------------------------------------------------|------|-----|
| AI broker (provider routing, streaming, capability checks) | ✓    | ✓   |
| Provider abstraction with bundled providers (Anthropic, OpenAI, local) | ✓ | ✓ |
| BYO API keys                                             | ✓    | ✓   |
| Local embedding model + vector index in search.db         | ✓    | ✓   |
| Local generation model (small)                           | ✓ (basic) | ✓ |
| BP Service Module integration                            | ✓    | ✓   |
| Standard AI verbs (generate, extract, transform, search) | ✓    | ✓   |
| Streaming UI primitives                                   | ✓    | ✓   |
| Provenance metadata (entity + property level)             | ✓    | ✓   |
| Prompt injection mitigations (broker level)               | ✓    | ✓   |
| Per-app rate limits and audit                             | ✓    | ✓   |
| First-party chat / agent app                              | post-v1 | ✓ |
| Org-managed keys / quotas                                 | —    | ✓   |
| Platform-managed pay-as-you-go AI                         | —    | ✓   |
| Server-side AI for org-readable spaces                    | —    | ✓   |
| Third-party provider plugins                              | —    | ✓   |
| Hosted relay AI brokering (privacy-conscious)              | —    | optional, per OQ-60 |

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-56** — Third-party provider plugins (v2 enterprise scenarios).
- **OQ-57** — Default local model and disk-size budget.
- **OQ-58** — Offline fallback policy when cloud providers are unreachable.
- **OQ-59** — Default aggressiveness of prompt-injection filtering.
- **OQ-60** — Platform-managed AI brokering vs. strict BYO-only stance.
- **OQ-61** — Vector extension choice (`sqlite-vec` vs `sqlite-vss`).
- **OQ-62** — Local embedding model choice and bundling.
- **OQ-63** — Quota granularity (per-app, per-feature, per-window).

## Cross-doc reconciliation needed

This doc reverses several earlier positions. The following docs need updates to stay consistent:

- **01-vision.md** — remove "Not an AI-first interface" from non-goals; add an AI-first principle.
- **09-security-and-sandbox.md** — add prompt-injection threat model; add `ai.*` capabilities to the naming convention.
- **16-identity-orgs-encryption.md** — note that AI on E2E content runs on-device; server-readable spaces enable server-side AI.
- **17-interoperability.md** — `intent.process` is the user-facing surface for many AI verbs; cross-link.
- **18-storage-and-search.md** — vector index is part of v1 (was OQ-36 deferred); update accordingly.
- **OQ-36** — close as resolved (vector search is in v1).

These updates are tracked as a follow-up task.

## Summary

- AI is a **first-class concern** integrated at the shell, surfaced consistently in the SDK.
- **Five surfaces**: generation, extraction, search, transformation, conversation. Each with standardized SDK shape.
- **AI broker** in the shell handles provider routing, key management, streaming, prompt injection, audit, cost.
- **BP Service Module** is the standard path for blocks/apps to call AI; Brainstorm-specific verbs are documented extensions.
- **Local model + cloud opt-in.** Local for privacy-sensitive, fast, offline-capable; cloud for high-quality generation when the user wants it.
- **Vector index in v1** — `sqlite-vec`/`sqlite-vss` for semantic search; promoted from OQ-36's prior "defer" lean.
- **Provenance is universal** — every entity / property can be marked AI-generated with kind, model, time, confidence, user-acceptance status.
- **AI sees plaintext on the trusted side of the encryption boundary**: on-device for E2E content; server-side only in opt-in server-readable spaces.
- **BYO API keys in v1**; org-managed and platform-managed in v2.
- **Per-app capabilities and quotas** prevent runaway cost and uncontrolled data exposure.
- v1 ships infrastructure; v2 ships richer features (chat app, server AI, third-party providers, hosted brokering).
