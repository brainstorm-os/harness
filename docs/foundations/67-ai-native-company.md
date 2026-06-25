# 67 — North star: the OS for an AI-native company

**Status: long-horizon north star, not a stage.** This doc names where Brainstorm is *headed* and why the architecture already points there. It deliberately does **not** add scope to v1 or reorder any stage — the agent-orchestration surface it describes is gated to its natural place (post-AI-broker, Stage 11+). Its job here is to give the foundation work a sharper *why*, not to pull engineering forward. See [implementation-plan.md §North star](../implementation-plan.md#north-star-the-os-for-an-ai-native-company-long-horizon).

## The thesis

A new kind of company is appearing: small teams where humans and AI agents do the work side by side. The tools they have were built for human-only orgs with AI bolted on top — agents are a button in someone else's cloud, acting on data the company doesn't own, with no scoped permissions and no audit trail. That is the wrong shape for a company that *runs on* agents.

Brainstorm is positioned to be the operating system for that company: **humans and their AI agents share one knowledge base, one identity system, and one capability ledger — so agents do real work with scoped, audited, revocable permissions, on data the company actually owns.**

This is not a pivot. Knowledge management and project management are not dropped — they become *what the agents operate on*: the knowledge base is the agents' shared memory; project management is how human + agent work is coordinated and attributed.

> **Decision:** the long-horizon product is a **governed-agent platform**, not a suite of business apps. We do not build "Brainstorm Payroll / CRM / Helpdesk". The capability-governed agent model + Block Protocol data interop + automations *are* the product; first-party apps stay thin. Vertical business apps, if any, come from third parties on the same SDK.

## Why this codebase, specifically

The hard parts of an AI-native company OS are exactly the parts already built or designed here:

1. **The capability ledger is agent governance.** The unsolved problem in "let AI run operations" is least-privilege + audit — what an agent may touch, who granted it, what it did. The per-vault `CapabilityLedger`, fail-closed broker, and per-app identity verification ([09](../security/09-security-and-sandbox.md), [02](02-architecture.md)) are the substrate that need, not a KM feature being repurposed. This is the moat, not the apps.
2. **Agents can be first-class principals.** Collab-C6 gave signed `Profile/v1`, sovereign-pubkey-as-author everywhere, and roster-scoped @-mentions ([16](../security/16-identity-orgs-encryption.md)). An AI teammate with its own identity, its own capability grants, and an audit trail of what it authored is a stronger primitive than "there is an AI button".
3. **Local-first + sovereign identity is the trust story.** A company will not route payroll, contracts, or customer data through agents living in someone else's cloud. The data-ownership + at-rest-encryption posture ([16](../security/16-identity-orgs-encryption.md), [29](../security/29-credentials-storage.md)) is the wedge into the buyers who care.
4. **The agent harness + action surface + MCP client already exist as designs.** [62 Agent harness](../platform/62-agent-harness.md) (context/tools/skills/artifacts), [63 Action surface](../platform/63-action-surface.md) (install an app → its actions appear elsewhere), and [64 MCP integrations](../platform/64-mcp-integrations.md) (agents act beyond the vault) are the orchestration spine this north star runs on. [69 Agent teams and orchestration](../platform/69-agent-teams-and-orchestration.md) makes that spine concrete for *multiple* agents — `Agent/v1` as a roster-peer principal, a Team surface with grant/revoke + audit, and delegation/assignment/Chat orchestration built from shipped primitives (resolves OQ-AINC-1, positions OQ-AINC-2).

## The segment we actually win

"There will be many AI-native companies" is true but it is a rising tide that lifts incumbents too — Notion, Linear, and the rest will all chase it. Demand volume is not the edge. The edge is the slice the cloud-AI incumbents **structurally cannot serve**:

- teams that can't or won't send operational data to a third-party model,
- regulated / sovereignty-sensitive / IP-paranoid orgs,
- anyone who wants agents acting on data they own, with a revocable audit trail.

We aim at that slice, not at "every AI-native company". The positioning sentence ([46 marketing](../platform/46-marketing-and-promotion.md)) for this horizon: *encrypted data + on-device agents + a capability audit trail* — one coherent claim no cloud incumbent can make without lying.

## The local↔cloud routing constraint

Open-weight models keep getting smaller-and-better, and "your agents run on-device, your data never leaves" is a story cloud players cannot tell. To keep that a strength and not a liability:

> **Decision:** model selection is a **governed, per-task choice on a local↔cloud spectrum**, not a binary. The [22](../platform/22-ai-foundations.md) AI broker's multi-provider routing is the seam: "local-first, cloud-when-the-user-chooses" must be a *configuration*, not a rewrite. Treat this as a first-class design constraint from the moment Stage 11 work begins — it is the hinge the entire "offline + new local models" thesis swings on.

Honest caveats this constraint exists to manage:

- **Don't promise frontier-from-local.** Much company-ops agent work is retrieval + structured extraction + routing + drafting — within a good local model's reach. The claim is "the right model for each job, on your hardware when it matters," never "local matches the largest cloud model".
- **Hardware variance is the UX risk.** Local inference quality tracks the user's machine. The product must degrade gracefully and be legible about it (model picker; clear "runs locally / needs cloud" per task) or "offline AI" becomes "slow, dumb AI" on the wrong laptop and poisons perception.
- **Encryption + local models are one claim, two angles.** The [3b](../implementation-plan.md) at-rest swap and the local-model path are the same trust promise, not two features.

## Why polish is the present-tense work

An AI-native company OS lives or dies on **trust**. A buyer routing real operations through agents forgives a missing feature but not a flaky one — every "small problem here and there" is, in this framing, a trust leak. So the current dogfood-and-fix loop is not a detour from this vision; it is the part of it we can build *today* without committing engineering to Stage 11+ surfaces. Foundation polish *is* the north star, expressed in the present tense.

## What this does and does not change

- **Does** give the foundation/quality work a sharper rationale, and fix the long-horizon positioning so later design decisions (Stage 11 broker, agent harness, identity) are made with it in view.
- **Does not** add anything to v1 scope, change the beta date, or reorder Stages 5→11. The agent-as-employee / capability-audit surfaces land in their natural stage and are tracked there, not pulled forward.

## Open questions

- **OQ-AINC-1** — At what stage does an explicit **agent-as-roster-member** type land (an agent profile distinct from a human `Profile/v1`, with its grants surfaced in Settings → Identity and an "what this agent did" audit view)? Candidate: rides the post-Collab identity work after the Stage 11 broker. ~80% of the substrate exists (C6 + the ledger).
- **OQ-AINC-2** — Does the capability **grant/revoke surface for agents** become a first-class, legible UI in v1's Settings, or is it v2? (It is the core product demo for this horizon.)
- **OQ-AINC-3** — Local↔cloud routing: per-task policy granularity — per-call, per-automation, per-capability, or per-vault default with overrides? Gates the [22](../platform/22-ai-foundations.md) broker UI.
- **OQ-AINC-4** — Is the "AI-native company" positioning surfaced publicly at beta, or held until the governed-agent surfaces actually ship? (Marketing-sequence question for [46](../platform/46-marketing-and-promotion.md).)

Tracked in [reference/11-open-questions.md](../reference/11-open-questions.md).
