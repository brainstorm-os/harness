# 62 — Agent harness (context, tools, skills, artifacts)

The Agent app ([55](../apps/55-agent-app.md)) ships a conversation surface over the shared agent-loop, with **intents-as-tools** and **broker-assembled retrieval** already specified. What [55](../apps/55-agent-app.md) does *not* yet specify is the thing that makes the agent **competent rather than blind**: a structured account of *what Brainstorm is, what apps are installed, and what data exists* — assembled by the shell and handed to the loop on every turn. Today's agent (Stage 11c, `packages/shell/src/main/ai/`) is plain chat with no self-model; it cannot answer "what can you do here?" because nothing tells it. This doc specifies that layer — the **agent harness** — and extends the agent's *output* surface from text to **first-class artifacts** and (post-v1) a **sandboxed code-runner**.

The mental model is deliberate and load-bearing: **the harness is to the Agent app what Claude Code's system-prompt + tools + skills are to a coding agent — except the "filesystem" is the user's knowledge graph.** Brainstorm is a desktop OS for knowledge; the agent is a power user who knows every installed app and can see the whole graph. Artifacts are the files it creates; the code-runner is it opening a terminal. That metaphor tells you where each capability belongs.

It builds on [55-agent-app.md](../apps/55-agent-app.md) (the conversation surface, intents-as-tools, the three-tier intersection, save-as-automation — **reused, not reinvented**), [22-ai-foundations.md](22-ai-foundations.md) (the broker owns context assembly and applies the user's privacy scope), [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md) (the shared agent-loop; the code-runner generalizes a workflow step), [17-interoperability.md](17-interoperability.md) (intents are the tool vocabulary and the discoverability registry), [03-app-model.md](../apps/03-app-model.md) + [08-app-sdk.md](../apps/08-app-sdk.md) (the manifest / registry the app-catalog reads from), [18-storage-and-search.md](../data/18-storage-and-search.md) (the entities + search the graph-shape summary reads from), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capabilities; the code-runner sandbox), and [31-linking-protocol.md](31-linking-protocol.md) (artifacts are addressable `brainstorm://` objects).

## The three layers of the harness

> **Decision:** the harness has three layers — **Context** (what the agent knows before it acts), **Tools** (what it can do), **Skills** (packaged procedures it can reach for). [55](../apps/55-agent-app.md) already specifies the Tools layer (intents) and a degenerate form of Skills (save-as-automation). This doc specifies the **Context layer in full** — the genuinely missing piece — and adds **Artifacts** (a typed output discipline over the Tools layer) and a **code-runner** (a new tool kind). Context is assembled by the **broker**, never by the app, holding the [22 §Architecture](22-ai-foundations.md) invariant that the shell decides what enters a prompt within the user's privacy scope.

| Layer | What it is | Source of truth | Status |
|-------|-----------|-----------------|--------|
| **Context** | Self-model + installed-app catalog + graph-shape summary | this doc | **new** |
| **Tools** | Granted intents, three-tier fail-closed | [55](../apps/55-agent-app.md) / [39](../apps/39-automations-and-workflows.md) | specified |
| **Skills** | Saved automations + app-contributed agent skills | [39](../apps/39-automations-and-workflows.md) + this doc | extended |
| **Artifacts** | Agent output as typed vault entities, opened in their app | this doc | **new** |
| **Code-runner** | Sandboxed agent-authored script as a tool | this doc | **new (post-v1)** |

## Layer A — Context: the self-model

The broker assembles a **context preamble** from three providers, each scoped by the conversation's `ai.context:<scope>` capability, prepended as `<system>` region content ([22 §Prompt injection](22-ai-foundations.md) region tagging). None of this exists today; it is the core of this doc.

### A.1 — What Brainstorm is (static)

> **Decision:** a small, curated, versioned **self-model preamble** — the agent's `CLAUDE.md` — ships in the broker: the OS metaphor, that everything is a typed Block-Protocol entity connected by typed links, that the agent *acts by calling apps through intents*, and that answers about the vault must cite their sources ([55](../apps/55-agent-app.md)). It is hand-written prose, not generated, kept under ~400 tokens, and versioned with the shell. This is the difference between an agent that says "I don't have access to your files" and one that says "I can search your notes, build a database view, and draft a doc — what do you need?"

### A.2 — What's installed (generated live)

> **Decision:** the broker generates an **app + capability catalog** from the registry on each conversation open (cached, invalidated on install/uninstall/grant change). It reads `RegistryRepositories` (`packages/shell/src/main/storage/registry-repo/`) — `apps.listActive()` joined with `openers`, `entityTypes`, `intents`, `widgets` — intersected with the `CapabilityLedger` (`main/capabilities/ledger.ts`). The result is a compact catalog: per app, its name + description (from the manifest), the entity types it owns, the openers it provides (type → app), and **the intents the conversation may actually dispatch** (post three-tier intersection). This is what tells the model *which tools exist and what each is for* — the tool schemas are a projection of this catalog, not a hand-maintained list.

The catalog is the join the research already proved out:

```
for app in registry.apps.listActive():
  manifest   = manifestCache.get(app.id)            // name, description
  grants     = ledger.listActive(app.id)            // granted capabilities
  openers    = registry.openers.listForApp(app.id)  // type/mime/scheme → app
  entityTypes= registry.entityTypes.listForApp(app.id).filter(!orphaned)
  intents    = registry.intents.listForApp(app.id)  // the tool surface
→ AppCatalogEntry { id, name, description, capabilities, openers, entityTypes, intents }
```

Because the catalog is *derived*, a newly installed app is automatically known to the agent the moment it registers — no harness edit, no retraining.

### A.3 — What data exists (shape, not contents)

> **Decision:** the context preamble carries the **shape of the graph, never its contents**. From `EntitiesRepository` (`main/storage/entities-repo/`): counts by type, the well-known types present ([`@brainstorm/sdk/system-entities`](../../packages/sdk/src/system-entities.ts) plus user types like `Person`/`Company`/`Task`/`Note`/`Entry`), the entity-type catalog, and a small recent-activity window (the N most-recently-updated non-system entities, titles only). The agent learns the *grammar* of the vault — "≈40 Notes, 12 People, a Tasks list, a Calendar" — without a dump of thousands of entities. Specifics are pulled on demand by the retrieval tools ([55 §Retrieval](../apps/55-agent-app.md)). **System/structural entity types are excluded** (the same filter `vaultEntities.list` applies).

This is the load-bearing privacy line of the whole design:

> **The graph *shape* is context. The graph *contents* are retrieval.** Shape is cheap, non-sensitive, and always in-prompt; contents are scoped, cited, and fetched per turn. Putting contents in the preamble would blow the token budget and leak entities the conversation's `ai.context` scope never authorized.

### A.4 — Budget

| Context provider | Budget | Refresh |
|------------------|--------|---------|
| Self-model (static) | < 400 tokens | shell version |
| App catalog (A.2) | < 1.5k tokens, elided to granted+relevant apps | on registry/grant change |
| Graph shape (A.3) | < 800 tokens (counts + recent titles) | on conversation open; coarse-invalidated by `vaultEntities.onChange` |

> **Open:** OQ-AH-1 — does the app catalog list *all* installed apps or only those whose intents the conversation has been granted? All apps = the agent can *propose* enabling a tool (good discoverability); granted-only = a smaller, safer prompt. See [11-open-questions.md](../reference/11-open-questions.md).

## Layer B — Tools (reference)

Specified in [55 §One agent loop](../apps/55-agent-app.md) and [39](../apps/39-automations-and-workflows.md); summarized here because the Context layer's A.2 catalog *is* the tool surface. Two families:

- **Read / retrieve** — `search.query` (FTS5 today; hybrid vector at 11.1), `vaultEntities.query`, and the standout **`vaultEntities.queryPattern`** (a `GraphPattern` compiled to a single SQL JOIN — the agent's knowledge-graph reasoning primitive), plus get-entity and read-body (Yjs `universalBody.toDelta()` → plaintext).
- **Write / act** — create/update entities and **dispatch app intents** (`open`, `compose`, `insert`).

All bounded by **tools ⊆ conversation grants ⊆ app caps**, audited on the one capability sheet. Nothing here is new; it is the substrate the next two layers stand on.

## Layer C — Skills

> **Decision:** a **skill is a saved automation** — Brainstorm does not grow a second packaged-procedure system. [39](../apps/39-automations-and-workflows.md)'s `Workflow/v1` is already "the agent-loop on a trigger," and [55](../apps/55-agent-app.md)'s save-as-automation already promotes a useful conversation into one. Skills close the loop: a saved `Workflow/v1` is **discoverable by the agent as a callable procedure** — the agent can reach for "weekly review" the way a coding agent reaches for a skill, run it, and cite the result. Apps may additionally *contribute* skills by declaring them in the manifest alongside intents (a `skills` registration), so a freshly installed app can teach the agent a procedure (Calendar → "schedule from this thread"). Same registry mechanism, same fail-closed gating, no new trust primitive.

> **Open:** OQ-AH-2 — skill discovery surface: does the agent see *all* saved workflows as skills (broad, noisy), only user-pinned ones, or only those whose tool-set is a subset of the conversation's grants (safe, self-limiting)? Lean: subset-of-grants, so a skill the agent can't actually execute is never offered. See [11-open-questions.md](../reference/11-open-questions.md).

## Artifacts — the agent's output is a typed object, not a wall of text

This is the native payoff of the harness and the v1 demo.

> **Decision:** when an agent produces something durable, it produces a **first-class vault entity — an artifact — not chat prose.** "Summarize my reading into a doc" creates a `Note/v1`; "build a board of everyone I met this quarter" creates a `List/v1` with a board view; "draft a project brief from these eight notes" creates a `Note/v1` linked to its sources. The mechanism is **already in Layer B**: graph query → synthesize → `entities.create` of the chosen type → dispatch the `open` intent, which the opener registry resolves to the owning app. An artifact is therefore *addressable* (`brainstorm://entity/<id>`), *editable* (it opens in a real app), *linkable*, and *cited* (it carries `brainstorm://` links back to the entities it drew from, per [55](../apps/55-agent-app.md)). No new infrastructure — artifacts fall out of "create an entity + open it."

> **Decision:** artifact creation is a **named, user-visible step**, not a silent side effect. The agent proposes the artifact ("I'll create a Note titled *Q2 Reading Notes* — create it?"), the user confirms (or it is auto-confirmed under a granted `entities.write` scope), and the created object appears as a clickable card in the transcript. This keeps the [55](../apps/55-agent-app.md) "no autonomous action" posture: an artifact is a write, and writes are bounded by the conversation's grants.

The artifact discipline is what makes "the agent operates your apps" concrete and reviewable rather than magical: every output is an object you can open, edit, and trace.

> **Open:** OQ-AH-3 — artifact type inference: does the agent *choose* the artifact type (Note vs. List vs. Whiteboard) from the task, offer the user a pick, or default to Note and let the user convert? Interacts with [21 §Collections](../data/21-objects-and-collections.md) and the opener registry. See [11-open-questions.md](../reference/11-open-questions.md).

## Code-runner — the universal tool (post-v1)

The fixed intent set cannot express every data transform; arbitrary code can. Brainstorm already has the sandbox primitives to run it safely — this is a deliberate post-v1 extension, designed here so the security boundary is set before any code lands.

> **Decision:** agent-authored code runs in a **capability-budgeted sandbox that is itself bounded by the three-tier intersection — never a raw shell, never above the conversation's grants.** The code-runner is a new tool whose body is a script the agent wrote; the script's *only* surface is the SDK calls the conversation has granted (entities query/create, search), executed in a locked-down runtime modeled on the existing app sandbox / `utilityProcess` worker (`main/workers.ts`): **no filesystem, no network unless `connectors.request` is granted, hard CPU/time/memory caps, and every run audited** like any other AI call ([22 §Audit](22-ai-foundations.md)). The model writes code; the sandbox — not the model — enforces what that code may touch. A prompt-injecting page cannot widen the sandbox, exactly as it cannot widen the tool set ([55 §Capabilities](../apps/55-agent-app.md)).

> **Decision:** the code-runner composes with the rest of the harness rather than forking it. A script step is the programmable sibling of a [39](../apps/39-automations-and-workflows.md) declarative step; **save-as-automation** ([55](../apps/55-agent-app.md)) then means *the agent writes code, runs it sandboxed, the user reviews the diff, and saves it as a reusable automation* — the same Skills loop (Layer C) with code as the body instead of an intent trace.

> **Decision:** **sequencing — the code-runner ships after the read/artifact loop, not with it.** v1 is Context + read tools + graph-query + artifact creation: a complete, safe, demoable loop that maps directly onto [55](../apps/55-agent-app.md)'s Agent-3/Agent-4 rungs. The code-runner is a separate rung with its own threat model.

> **Open:** OQ-AH-4 — code-runner runtime + isolation: a Node-less sandboxed `WebContentsView` (reuses the app-sandbox primitive, heavier), a hardened `utilityProcess` worker with an SDK-only bridge (lighter, no DOM), or a constrained in-process VM (lightest, weakest boundary — likely rejected). Plus the resource-cap schedule (wall-clock, memory, max entity writes) and whether a run is deterministic/replayable for audit. **Blocking** the code-runner rung; non-blocking for v1. See [11-open-questions.md](../reference/11-open-questions.md).

> **Open:** OQ-AH-5 — code-runner capability mapping: does the script inherit the conversation's full tool grants, or a *narrower* explicitly-scoped budget granted per-run (so "run a script" is a distinct, smaller consent than "use my tools")? Lean: per-run narrowed budget — code is higher-risk than a single intent call and deserves its own gesture. See [11-open-questions.md](../reference/11-open-questions.md).

## Capabilities & security

The harness adds **no new trust primitive** — it is read-mostly context assembly plus the existing write path. The deltas:

| Surface | Posture |
|---------|---------|
| Context assembly (A) | Broker-side; reads registry + entity *metadata* (counts, titles, types). Bounded by `ai.context:<scope>`; never bulk-reads bodies into the preamble. |
| App catalog (A.2) | Reflects only granted, installed apps' intents as callable; listing an app ≠ granting its tools (OQ-AH-1). |
| Artifacts | A write; bounded by `entities.write:<type>` in the conversation's grants; always a visible, confirmable step. |
| Code-runner | Sandboxed, capability-budgeted, audited; **fail-closed** — an ungranted call from inside a script returns `Unavailable`, never executes (same invariant as the IPC broker, [02 §IPC](../foundations/02-architecture.md)). |

Prompt-injection mitigation is unchanged and inherited: retrieved entity bodies and any fetched web content are untrusted `<content>` ([22 §Prompt injection](22-ai-foundations.md)); they cannot escalate the tool set, mint an artifact the user didn't confirm, or widen the code sandbox, because all three are gated by the static per-turn capability intersection, not by anything the model reads.

## Performance budgets

| Metric | Budget |
|--------|--------|
| Context preamble assembly (A.1–A.3, cached) | < 60ms p95 on conversation open |
| App-catalog rebuild (on registry/grant change) | < 100ms p95 |
| Graph-shape summary (counts + recent titles, 50k-entity vault) | < 80ms p95 (rides the type index) |
| Artifact create → opened in owning app | < 300ms p95 (entity write + intent dispatch) |
| Code-runner cold-start (sandbox spin-up) | budget set with OQ-AH-4 |

## Non-goals (v1)

- **Contents-in-context.** The preamble never carries entity bodies; that is retrieval's job. A harness that inlines the vault is a token-budget and privacy failure.
- **A code-runner in the first cut.** Deliberately sequenced after the artifact loop (above).
- **A second agent engine or a second tool dispatcher.** The harness wraps the one shared loop ([55](../apps/55-agent-app.md)/[39](../apps/39-automations-and-workflows.md)); if a need can't be met, the fix is that loop.
- **Repo / dev-filesystem access.** That is the dev MCP server ([49 §self-hosting](../foundations/49-self-hosting.md)), out of the shipped product; the harness sees the *vault graph*, not the source tree.
- **Autonomous artifact creation.** Artifacts are writes on a user turn; scheduled/triggered creation is Automations' territory ([39](../apps/39-automations-and-workflows.md)).

## Phasing

| Capability | v1 (Stage 11c) | post-v1 |
|------------|----|----|
| Self-model preamble (A.1) | ✓ | — |
| Live app + capability catalog (A.2) | ✓ | — |
| Graph-shape summary (A.3) | ✓ | — |
| Artifacts (typed entity output, opened in-app) | ✓ | richer types / multi-artifact |
| Skills = saved automations, agent-callable (C) | ✓ (basic) | app-contributed skills |
| Code-runner (sandboxed script tool) | — | ✓ (own rung, OQ-AH-4/5) |

## Cross-doc reconciliation needed

Tracked as follow-ups, not edited here (same pattern as [55 §Cross-doc reconciliation](../apps/55-agent-app.md)):

- **[55-agent-app.md](../apps/55-agent-app.md)** — add a back-reference: the broker-assembled context (its §Retrieval companion) is specified here; the Agent app renders the artifact cards and the skill picker this doc introduces.
- **impl-plan Stage 11c** — file the harness rungs: **context-assembly** (A) ahead of or alongside Agent-3, **artifacts** as a rung after Agent-4, **code-runner** as a distinct later rung gated on OQ-AH-4/5.
- **[39-automations-and-workflows.md](../apps/39-automations-and-workflows.md)** — note that a script step (the code-runner body) is the programmable sibling of a declarative step, and that agent-callable skills are saved `Workflow/v1`s.
- **[63-action-surface.md](63-action-surface.md)** — the Agent app is the **marquee contributor** to the action surface: its `process` contributions ("Summarize", "Generate image") are how the harness reaches *into other apps' menus*, and uninstalling it is what makes those actions disappear (the concrete form of "AI is optional").

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-AH-1** — App catalog scope in the preamble: all installed apps (discoverable) vs. granted-only (smaller, safer).
- **OQ-AH-2** — Skill discovery surface: all saved workflows vs. pinned vs. subset-of-grants. Lean: subset-of-grants.
- **OQ-AH-3** — Artifact type inference: agent-chosen vs. user-picked vs. default-Note-then-convert.
- **OQ-AH-4** — Code-runner runtime + isolation + resource caps + replayability. **Blocks** the code-runner rung.
- **OQ-AH-5** — Code-runner capability mapping: inherit conversation grants vs. per-run narrowed budget. Lean: per-run narrowed.

## Summary

- The harness is the agent's **self-model** — the missing layer that turns plain chat into a power user of the vault. Three layers: **Context**, **Tools** ([55](../apps/55-agent-app.md)), **Skills**.
- **Context** is broker-assembled and three-part: *what Brainstorm is* (static preamble), *what's installed* (live app + capability catalog from the registry), *what data exists* (graph **shape**, not contents). The privacy line: **shape is context, contents are retrieval.**
- **Artifacts** make the agent's output a **typed, addressable, editable vault object opened in its app** — falling out of "create an entity + open it," no new infrastructure. This is the v1 demo.
- **Skills** are saved automations the agent can call — closing [55](../apps/55-agent-app.md)'s save-as-automation loop, not a new system.
- The **code-runner** is the universal tool: agent-authored script in a **capability-budgeted, audited sandbox**, bounded by the same three-tier intersection — a deliberate **post-v1** rung after the artifact loop, with its threat model set here first.
- No new trust primitive: context is read-mostly, artifacts and code are the existing write path, and everything stays fail-closed under the one capability sheet.
</content>
</invoke>
