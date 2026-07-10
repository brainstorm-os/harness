# 69 — Agent teams and orchestration

The [agent harness](62-agent-harness.md) makes *one* agent competent — it gives the Agent app ([55](../apps/55-agent-app.md)) a self-model, tools, skills, and typed artifacts. The [north star](../foundations/67-ai-native-company.md) says the product is an **OS for an AI-native company: humans and agents sharing one knowledge base, one identity, one capability ledger**. The gap between those two is this doc: going from *a chat agent* to *a team of agents you manage and orchestrate* the way the dogfood team works — each with a name, a personality, a specialty, and scoped permissions.

The mental model is load-bearing and we already live it every day:

> **The dogfood team is the spec.** Mira, Marcus, Priya, Dana, Sol, Kai — each a persona with a lens (Sol = interaction/a11y), each booting its own vault and sovereign identity, each a *speaker* in `team-chat.md`, coordinating by **claim → work-in-isolation → handoff → release** through the orchestration lease ledger (per [CLAUDE.md §Multi-agent orchestration](../../CLAUDE.md)). Strip a persona to its essence and it is four things — an **identity**, a **specialty (skills)**, a **voice in a shared channel**, and a **coordination discipline**. Productize those four and you have agent teams. This doc productizes them onto primitives that already exist.

It builds on [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (sovereign Ed25519 identity, signed `Profile/v1`, the roster service — *reused, not reinvented*), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) + [02 §IPC](../foundations/02-architecture.md) (the `CapabilityLedger`, the fail-closed broker — the governance object), [62-agent-harness.md](62-agent-harness.md) + [55-agent-app.md](../apps/55-agent-app.md) (the single-agent loop, `intersectAgentTools`, the three-tier intersection — *the per-agent execution engine*), [39-automations-and-workflows.md](../apps/39-automations-and-workflows.md) (`Workflow`/`Trigger`/`WorkflowRun` — the coordination substrate), [22-ai-foundations.md](22-ai-foundations.md) (the broker, local↔cloud routing), and [63-action-surface.md](63-action-surface.md) (agents as contributors). It is **post-beta** and explicitly **iterative** — the goal here is to set the model and the security boundary before any code lands, not to freeze a v1.

## The thesis: a vault is a company, members are humans *and* agents

> **Decision:** agents are **roster peers, not a chat feature.** A vault already has a roster — the signed `Profile/v1` members the [16](../security/16-identity-orgs-encryption.md) roster service resolves. An agent joins that *same* roster as a different *kind* of principal. You open a **Team** surface and see Mira (human), Marcus (human), a "Researcher" (agent), an "a11y Reviewer" (agent) side by side — same profile shell, same @-mention in Chat, same capability grants, same "what did they do" audit view. This is the literal realization of the [67](../foundations/67-ai-native-company.md) thesis, and it is **mostly assembly** of shipped parts, not new infrastructure.

The payoff of treating agents as roster peers rather than a bolted-on panel: *every* primitive the product already has for collaborators — identity, mentions, assignment, sharing, the audit log, revocation — applies to agents for free. The governance moat isn't a feature we add later; it is the machinery we already built, now pointed at a second kind of member.

## The agent — `Agent/v1`

> **Decision (resolves [OQ-AINC-1](../reference/11-open-questions.md)):** an agent is a first-class entity type, `brainstorm/Agent/v1` — a **persona shell over a capability ceiling.** The ceiling lives where every principal's permissions already live (the `CapabilityLedger`); `Agent/v1` is the human-facing configuration over it. Shape:

```ts
type AgentDef = {
  // identity (see §Identity)
  pubkey: string;            // own Ed25519 public key — a distinct principal
  fingerprint: string;       // fingerprintOf(pubkey), the roster anchor

  // persona — the PERSONALITY
  displayName: string;       // "Researcher"
  avatarRef: string | null;  // encrypted media blob ref
  theme?: ThemeName;         // cosmetic identity (mirrors the dogfood per-persona theme)
  persona: string;           // system-prompt preamble prepended to the harness self-model

  // skills — what it CAN DO
  skills: SkillRef[];        // granted intents + saved Workflow/v1 procedures (62 §Layer C)

  // traits — HOW it works
  routing: RoutingPolicy;    // local-only | cloud-allowed; + cost ceiling (OQ-AINC-3)
  autonomy: AutonomyLevel;   // ConfirmOnWrite | AutonomousWithinCaps
  memoryScope: MemoryScope;  // PerConversation | LongTerm (own Memory/v1 partition)
};
```

The four fields map one-to-one onto what makes a dogfood persona a persona:

| Persona trait | `Agent/v1` field | Where it plugs in |
|---|---|---|
| Personality / voice | `persona` (+ `displayName`, `avatarRef`, `theme`) | prepended to the [62 §Layer A](62-agent-harness.md) self-model preamble |
| Specialty / lens | `skills` | the [62 §Layer B/C](62-agent-harness.md) tool + skill set offered to *this* agent's loop |
| Permissions | the agent's grants in the `CapabilityLedger` | the **frozen capability ceiling** (`frozenCapabilities`) the loop never widens |
| Coordination discipline | `routing` / `autonomy` / `memoryScope` | broker routing, confirm-on-write posture, memory partition |

> **Decision:** `Agent/v1` is a **system-adjacent but user-authored** type — created deliberately (like `Note`, not like `WorkflowRun`), but its *grants* are never editable as raw data; they only change through the consenting grant/revoke gesture (§Management). The persona prose, skills selection, and traits are ordinary editable fields; the capability ceiling is not a field, it is ledger state.

## Identity — each agent is a real principal

> **Decision:** every agent gets its **own Ed25519 keypair, generated locally at creation.** An agent's actions are attributable to *the agent*, not blurred into the owner — distinct author key on every Yjs update, distinct principal in the `CapabilityLedger`, distinct line in the audit log, **independently revocable.** This is the entire governance story ("who did this, under whose delegation, with what capabilities, can I revoke *just them*"), and it only holds if the agent is a separate principal. Acting-under-the-owner's-key was considered and rejected: it throws away attribution and revocability to save plumbing the [16](../security/16-identity-orgs-encryption.md) Collab-C6 work already built (signed profiles, the roster, the ledger's principal column).

The cost calculus that makes this the *cheap* choice, not the expensive one:

> **Generating a keypair is trivial; syncing and recovering identities is the hard part — so we do the cheap thing now and defer only the hard thing.** Local key-gen + roster registration + per-agent grants + audit are **v1**. **Cross-device sync and recovery of agent identities ride the Collab identity track** ([16 §Identity tiers](../security/16-identity-orgs-encryption.md), Collab-C5 distribution) when it matures — no v1 demo needs a multi-device agent. North star is "own sovereign key"; the only thing phased is multi-device.

> **Decision:** the ledger's principal generalizes from *app* to *member*. Today a `CapabilityGrant.appId` names an app bundle ([`main/capabilities/ledger.ts`](../../packages/shell/src/main/capabilities/ledger.ts)); an agent is just a different principal value in that column — **no schema change**, the digest confirms. The broker's existing fail-closed check (`ledger.has(principal, required)`, any throw → `Unavailable`) protects agent calls identically to app calls. The audit `onDenied` path already exists; agent denials route to the same sheet.

## Orchestration — three patterns, all assembly

> **Decision (per the design fork taken):** multi-agent coordination **reuses tasks + automations + chat — no new coordination ledger.** The dogfood team needs the git lease ledger because raw OS processes race on a shared *file tree*; product agents edit **Yjs/CRDT entities, which merge**, so the *technical* need for locks is gone. What remains is *semantic* coordination ("don't have two agents both writing the Q3 report"), and the product already has the primitives for that. Three patterns:

### O.1 — Delegation (manager → specialist)

> **Decision:** a lead agent delegates with **one new tool**, `delegate(agentId, subtask)`, which spawns a child [`runAgentLoop`](../../packages/sdk-types/src/agent-loop.ts) for the named agent with **the child's own frozen capability ceiling.** The security keystone falls straight out of the `intersectAgentTools` invariant the loop already enforces:

> **Recursive capability intersection is the orchestration security boundary.** A delegated child's effective tools are `child-grants ∩ delegator-grants` — **a manager can never hand out authority it does not itself hold**, transitively, to any depth. Arbitrary agent org-charts are safe *by construction* because the same per-turn static intersection that stops a prompt-injecting page from widening the tool set ([55 §Capabilities](../apps/55-agent-app.md)) stops a manager agent from escalating a worker. No new trust primitive; the keystone is the one already shipped in [11b.7](../implementation-plan.md), applied agent-to-agent.

Delegation is itself a capability (`agents.delegate`, scoped to the agent ids a principal may delegate to), so "this agent may run a team" is a grant like any other, revocable on the same sheet.

### O.2 — Assignment / claim (the lease analog, done with data)

> **Decision:** the product-native "claim a task" is **task `assignee` pointing at an agent identity** (the [Tasks](../apps/03-app-model.md) `assignee` field — DT-9) plus a **`Trigger/v1`** ("entity assigned to Agent X → run X's loop on it"). Assign → the agent picks it up → it works → `status` flips → handoff is *re-assignment*, release is *done*. Claim / renew / handoff / release — the whole dogfood lease protocol — collapses into two fields (`assignee`, `status`) that already exist, driven by the automations engine that already exists. CRDT merge means two agents touching the same object converge rather than clobber, so no lock is needed; `assignee` is the *semantic* single-owner signal, not a mutex.

> **Open:** [OQ-AT-1](../reference/11-open-questions.md) — is single-`assignee` semantic exclusivity enough, or do overlapping autonomous agents need a soft-claim (a short-TTL "working on this" marker) to avoid duplicated effort before `status` flips? Lean: start with `assignee`; add a soft-claim only if real contention shows up. See [11-open-questions.md](../reference/11-open-questions.md).

### O.3 — Communication (humans ↔ agents ↔ agents)

> **Decision:** the shared channel is **Chat** — agents are roster members, so they are already @-mentionable, and a thread can hold humans and multiple agents at once. The transcript is the team's working memory (the productized `team-chat.md`). An @-mention of an agent is the conversational twin of an assignment: it invites that agent's loop into the thread.

> **Open:** [OQ-AT-2](../reference/11-open-questions.md) — when agent A @-mentions agent B in Chat, does B auto-run, or does an agent→agent mention require a human turn to actuate (a human-in-the-loop throttle against agent chatter / runaway cost)? Lean: human-in-the-loop by default, with an explicit per-thread "let them collaborate" grant. See [11-open-questions.md](../reference/11-open-questions.md).

## Management — the Team surface

> **Decision (takes a position on [OQ-AINC-2](../reference/11-open-questions.md)):** the grant/revoke + audit UI for agents **ships with the Team surface, not deferred to a later cut** — it is the core demo of the governed-agent thesis, and there is no agent-team product without it. Three jobs on one surface:

| Surface | What it does | Built from |
|---|---|---|
| **Team directory** | human + agent roster members side by side; status, last activity | the [16](../security/16-identity-orgs-encryption.md) roster service, widened to render agent members |
| **Create / configure agent** | name, avatar, theme, persona prose, pick skills, set traits | an `Agent/v1` editor (ordinary entity form) |
| **Grant / revoke + audit** | per-agent capability sheet; "what this agent did" log | the `CapabilityLedger` grant/revoke + the existing audit sheet, filtered to the agent principal |

The "what this agent did" view is **free**: every agent action is already a broker call with a capability check and an audit row keyed on the principal — filter the audit log by the agent's fingerprint and you have a complete, legible activity history. Legibility is a query, not a feature build.

## Seeded starter agents

> **Decision:** the vault ships with **2–3 starter agents mirroring dogfood lenses** so the team is *alive on first boot* rather than an empty directory — e.g. a **Builder** (create/compose intents), a **Reviewer** (read + comment, an a11y/quality lens à la Sol), a **Researcher** (search/retrieve + draft). They are ordinary `Agent/v1` entities seeded at OOBE, fully editable and deletable, with conservative default traits (`ConfirmOnWrite`, local-routing-preferred). The seed is the demo *and* the template a user copies to make their own.

> **Open:** [OQ-AT-3](../reference/11-open-questions.md) — exact starter roster + whether seeding is opt-in at OOBE or always-on (and whether starter personas carry the dogfood names/themes or neutral role names). See [11-open-questions.md](../reference/11-open-questions.md).

## Marketplace distribution — agent & team templates

The [phasing table](#phasing) defers marketplace distribution to post-v1; this section fixes the *model* now so the v1 starter-seed format is forward-compatible with it. Distribution composes with the [47-marketplace.md](../apps/47-marketplace.md) content-kind registry — the signed catalog, install pipeline, consent sheet, and library surface are reused as-is. Agent distribution adds **kinds, not infrastructure**.

> **Decision:** the marketplace unit is a **template, not an agent.** Of the four things that make an agent (§The agent), two are non-portable *by design*: the keypair is generated locally at creation (§Identity) and grants only ever come from the user's consent gesture, never as data (§Management). Everything else ships:

```ts
type AgentTemplate = {
  // persona shell — third-party PROMPT TEXT, see threat note below
  displayName: string;
  avatarRef: string | null;
  theme?: ThemeName;
  persona: string;

  // specialty — may bundle Workflow/v1 definitions (composes with WorkflowPack via `references`)
  skills: SkillRef[];

  // trait DEFAULTS — user-editable at instantiation
  traits: { routing: RoutingPolicy; autonomy: AutonomyLevel; memoryScope: MemoryScope };

  // a REQUEST manifest, exactly like an app manifest — never a grant
  requestedCapabilities: Capability[];
};
```

**Installing is instantiating**: local key-gen → roster registration → the standard consent sheet rendered over `requestedCapabilities` — the same flow an app install already runs, pointed at an agent principal. The resulting `Agent/v1` is an ordinary editable entity; the template is provenance, not a live link (no auto-update of persona prose under a user's feet — template updates surface as an update offer with a diff, like a cap-adding app update).

> **Decision:** **starter agents ARE templates.** The OOBE seed (§Seeded starter agents) uses the same `AgentTemplate` format and the same instantiation path, just from a bundled source instead of the catalog. The seed is the format's first consumer, which is what keeps the marketplace rung cheap later.

> **Decision:** the **team template** is the second kind — a bundle of agent templates plus their coordination wiring: delegation edges (`agents.delegate` requests scoped to sibling template ids), `Trigger/v1` definitions, and optionally a shared Chat thread scaffold. "Install a content studio: researcher + writer + reviewer, writer leads." One consent sheet shows the **union** of what the team requests, per-member itemised — the [47 §Cross-kind composition](../apps/47-marketplace.md) transitive-dependency prompt, reused. Safety is inherited, not new: delegation edges are subject to the same recursive capability intersection, so an installed team can never exceed what the user granted at the sheet, regardless of its internal org-chart.

**Threat delta — persona prose is a new review surface.** A marketplace app ships sandboxed *code*; an agent template ships third-party *text that is prepended to a system prompt* holding capabilities. The frozen ceiling caps the blast radius (a template cannot request its way past the consent sheet), but a malicious persona can still *misuse* what was granted — bias what it writes, quietly exfiltrate through a granted network tool. The 47 registry's threat profiles (`active-code` / `passive-data` / `metadata-only`) don't have a slot for this: prompt text is not active code, but it is nowhere near passive data. Leaning: review agent templates as **active-code-equivalent** (behavioral review model, mandatory signature), with the review being prompt-level — whether the registry grows a distinct `active-prompt` profile is [OQ-AT-5](../reference/11-open-questions.md).

> **Open:** [OQ-AT-5](../reference/11-open-questions.md) — content-kind mechanics for templates: a new `active-prompt` threat profile vs. reusing `active-code`; what prompt-level review concretely checks; team templates as one bundle vs. composition via `references`. Blocks marketplace *distribution* only, not agent-teams v1. See [11-open-questions.md](../reference/11-open-questions.md).

## Capabilities & security

No new trust primitive — agent teams are the existing identity + capability + audit machinery with a second principal kind. The deltas:

| Surface | Posture |
|---|---|
| Agent identity | Own Ed25519 key; distinct author + ledger principal + audit subject; independently revocable. |
| Per-agent grants | Ordinary `CapabilityLedger` rows (principal = agent fingerprint); fail-closed; granted via the Team consent gesture, never as editable data. |
| Delegation (`delegate`) | A capability (`agents.delegate:<id>`); child caps = `child ∩ delegator`, recursively — a manager can never escalate a worker. |
| Assignment / triggers | Reuses [39](../apps/39-automations-and-workflows.md) `Trigger`/`WorkflowRun`; the triggered loop runs under the *agent's* frozen ceiling, re-checked at dispatch. |
| Memory | Per-agent `Memory/v1` partition ([55](../apps/55-agent-app.md)); one agent never reads another's memory without a grant. |
| Audit | Every agent hop is a broker call → capability check → audit row; "what this agent did" is a filter, not a build. |

Prompt-injection posture is inherited unchanged from [62](62-agent-harness.md)/[55](../apps/55-agent-app.md): retrieved bodies and tool results are untrusted `<content>` and cannot widen any agent's frozen ceiling — and now, **cannot escalate a delegated child past its delegator**, the same intersection extended one level.

> **Open:** [OQ-AT-4](../reference/11-open-questions.md) — delegation-tree resource governance: max delegation depth, cycle detection (A delegates to B delegates to A), and how the cost ceiling ([OQ-AINC-3](../reference/11-open-questions.md) routing budget) is *shared* across a delegated tree vs. per-agent. **Blocks** autonomous multi-hop delegation; non-blocking for single-hop manager→worker. See [11-open-questions.md](../reference/11-open-questions.md).

## Performance budgets

| Metric | Budget |
|--------|--------|
| Agent create (key-gen + roster register + seed grants) | < 150ms p95 |
| Team directory render (≤ 20 members) | < 100ms p95 |
| `delegate` child-loop spawn (cap intersection + context assembly) | < 120ms p95 over the harness preamble budget |
| Audit-by-agent query (50k-event log) | < 80ms p95 (rides the principal index) |

## Non-goals (post-beta v1)

- **A second coordination ledger.** Coordination is `assignee` + `Trigger` + Chat; if a need can't be met, the fix is those primitives, not a new lease store.
- **A second agent engine.** Every agent runs the *one* shared [`runAgentLoop`](../../packages/sdk-types/src/agent-loop.ts); delegation spawns children of it, never a fork.
- **Cross-device / multi-user agent identity sync.** Local key-gen now; sync + recovery ride the Collab identity track ([16](../security/16-identity-orgs-encryption.md)).
- **Fully-autonomous agent swarms.** Default posture stays human-in-the-loop (`ConfirmOnWrite`, human-actuated agent→agent mentions); autonomy is an opt-in trait, capped by routing budget.
- **Agents managing other vaults / external systems.** An agent's reach is its vault grants + connected MCP tools ([64](64-mcp-integrations.md)); it is not a cross-vault operator.

## Phasing

| Capability | v1 (post-beta) | later |
|------------|----|----|
| `Agent/v1` type + own keypair + roster registration | ✓ | — |
| Per-agent grants in the ledger (principal generalized) | ✓ | — |
| Team surface: directory + create/configure + grant/revoke + audit | ✓ | — |
| Single-hop delegation (`delegate` tool, cap intersection) | ✓ | multi-hop trees (OQ-AT-4) |
| Assignment-driven runs (`assignee` agent + Trigger) | ✓ | soft-claim (OQ-AT-1) |
| Chat as the agent channel (@-mention an agent) | ✓ | autonomous agent↔agent (OQ-AT-2) |
| Seeded starter agents (in the `AgentTemplate` format) | ✓ | — |
| Agent + team templates in the marketplace (§Marketplace distribution) | — | ✓ (OQ-AT-5) |
| Cross-device agent identity | — | ✓ (rides Collab-C5) |

## Cross-doc reconciliation needed

Tracked as follow-ups, not edited here (same pattern as [62 §Cross-doc reconciliation](62-agent-harness.md)):

- **[67-ai-native-company.md](../foundations/67-ai-native-company.md)** — back-reference: this doc is the concrete design of the "orchestration spine" the north star names; it resolves OQ-AINC-1 and takes a position on OQ-AINC-2.
- **[16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)** — note the roster widens from human-only `Profile/v1` to include `Agent/v1` members; the roster service resolves both kinds.
- **[55-agent-app.md](../apps/55-agent-app.md)** — the Agent app's single conversation is *one agent's* surface; the Team surface and `delegate` tool introduced here are the multi-agent layer above it.
- **[39-automations-and-workflows.md](../apps/39-automations-and-workflows.md)** — note the `assignee → run agent` trigger pattern and that a saved `Workflow/v1` is an agent skill ([62 §Layer C](62-agent-harness.md)).
- **[47-marketplace.md](../apps/47-marketplace.md)** — reserve `ContentKind.AgentTemplate` / `ContentKind.TeamTemplate` slots in the content-kind registry + per-kind table rows (threat profile pending OQ-AT-5); templates compose with `WorkflowPack` via `references`; store-verification ([32](../apps/32-store-verification.md)) gains the prompt-level review lane.
- **impl-plan** — file the rungs as a **post-beta** group (Agent-Teams-1..N): `Agent/v1` + identity, Team surface + grants, `delegate`, assignment triggers, seeds.

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-AT-1** — Assignment exclusivity: single-`assignee` semantic ownership vs. an added soft-claim TTL marker for overlapping autonomous agents. Lean: `assignee` first.
- **OQ-AT-2** — Agent→agent Chat actuation: auto-run on mention vs. human-in-the-loop with an opt-in collaborate grant. Lean: human-in-the-loop default.
- **OQ-AT-3** — Starter roster: which lenses, opt-in vs. always-on, dogfood names vs. neutral roles.
- **OQ-AT-4** — Delegation-tree governance: max depth, cycle detection, shared vs. per-agent cost budget. **Blocks** multi-hop autonomy.
- **OQ-AT-5** — Template content-kind mechanics: `active-prompt` threat profile vs. active-code-equivalent review, what prompt-level review checks, team-template packaging (one bundle vs. `references` composition). Blocks marketplace distribution only.

It also **resolves [OQ-AINC-1](../reference/11-open-questions.md)** (agent principal = `Agent/v1` with its own Ed25519 key) and **takes a position on [OQ-AINC-2](../reference/11-open-questions.md)** (grant/revoke + audit ships *with* the Team surface).

## Summary

- **The dogfood team is the spec.** A persona is an *identity*, a *specialty*, a *voice in a shared channel*, and a *coordination discipline* — productize those four and you have agent teams.
- **A vault is a company; agents are roster peers**, not a chat feature — so identity, mentions, assignment, audit, and revocation all apply to them for free.
- **`Agent/v1` is a persona shell over a capability ceiling**: persona prose (personality), skills (specialty), traits (routing/autonomy/memory), with the real permissions living in the `CapabilityLedger`.
- **Each agent is a real principal** — own Ed25519 key from day one (cheap), attributable and independently revocable; only multi-device sync is deferred (hard).
- **Orchestration is assembly**: delegation (one `delegate` tool, made safe by *recursive capability intersection*), assignment (`assignee` agent + Trigger, no lease ledger because CRDTs merge), and Chat (agents as @-mentionable members).
- **Governed by construction**: every agent hop is broker → capability check → audit row, so "what this agent did" is a query, and a manager can never escalate a worker.
- **Distribution ships templates, not agents** — identity and grants never leave the vault; installing a template instantiates locally through the standard consent sheet. Team templates ("install a content studio") ride the same rails, safe via the same recursive intersection; the one new review surface is persona prose as third-party prompt text (OQ-AT-5).
- **No new trust primitive** — agent teams are the shipped identity + capability + audit machinery pointed at a second kind of member. Post-beta, deliberately iterative.
