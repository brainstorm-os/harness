# Humans + agents, one shared vault (VID-agent-team)

An episode of the app-showcase series (`VID-*` in
[`../implementation-plan.md`](../implementation-plan.md)): the flagship vision —
**a team of people and a team of agents working the same shared vault.** Humans
grant agents *scoped* permissions the way they'd grant a teammate, agents
generate artifacts into the shared object space, and every human reviews and
commits. Not one user + one copilot — a **permissioned collaboration between
people and AI, on one local-first vault.** Target length **~2:15**.

The differentiator this reel has to land: **agents are members you permission,
not omniscient bots.** You decide which collections an agent can see and whether
it may propose. It drafts real objects everyone shares; a *human* always commits.
So a team scales its output with agents without handing them the keys — and it
all runs on the team's own infrastructure (LAN or their own relay), their keys.

> **⚠️ PRODUCTION STATUS — do NOT capture the full vision yet.** This combines
> three things, and only the middle one ships today:
> - **Shipped:** single-user **Agent-11** (agent proposes artifacts → human
>   approves, the three-tier permission ceiling), the **sharing** service + **LAN
>   P2P sync** + signed **`Profile/v1` roster** identity.
> - **Not built (the vision's core):** *agents as first-class vault **members***
>   with their own identity + **per-agent, human-granted scoped permissions**;
>   **multiple** agents; agents proposing into a **shared** object space all human
>   members see; provenance that says *which agent* proposed + *which human*
>   approved. This is the **0.12.0 "Share for real" collab train × multi-agent**
>   — the owner's own Agent-11 note defers multi-human shared agent chat to
>   0.12.0, "reusing this."
>
> **Staging:** film order = **VID-build-apps' foundations after it, this last.**
> Two cuts: a **"foundations" cut now** (single-user Agent-11 artifacts + honest
> two-human shared-vault B-roll over LAN, no agent-as-member claims) and the
> **full "team-of-teams" cut** once the `AGENTS-AS-MEMBERS` rungs + 0.12.0 collab
> land. Script now so the build aims at the demo.

Capture runs against the synthetic **Northbound Studio** world (`seedMarketing­
Entities` — never the live dogfood vault, owner rule 2026-07-19) — extended to a
**multi-member** seed (Mira + Marcus + Priya as human members; a Research agent +
an Ops agent as agent members). Shared promo pipeline; scene drivers will live in
`tests/dogfood/promo/vid-agent-team.spec.ts`.

## Voiceover script (full vision cut · ~2:15)

> **[S0 slide]** A vault your whole team shares. People — and agents — working the
> same objects, side by side.
> **[S1]** Northbound is three people now. Mira, Marcus, Priya — one vault, the
> same projects, the same clients. You can see who's here.
> **[S2]** The team has agents too. A research agent. An ops agent. They're
> members of the vault — with names, and with limits.
> **[S3]** Mira gives the research agent access to the research collection, and
> permission to *propose* — not to delete, not to touch billing. She's scoping an
> agent exactly like she'd scope a new hire.
> **[S4]** Now it works alongside them. The research agent drafts a batch of
> briefs into the shared space. The ops agent lines up the tasks and the calendar
> to ship them. Everyone sees the proposals.
> **[S5]** And a human always commits. Priya approves the briefs she wants;
> Mira approves the ops plan. Every object carries its story — proposed by the
> research agent, approved by Priya.
> **[S6]** This is the whole idea: a team of people and a team of agents, one
> shared vault, the same objects — and every agent sees only what it was granted.
> They propose. You decide. On your machines, your keys.
> **[S7 slide]** Your team, plus a team of agents. Free beta at getbrainstorm.online.

## Scene table

| # | Screen | On-screen action | VO / caption |
|---|--------|------------------|--------------|
| S0 | Title slide over the shared Northbound vault, presence avatars visible | Fade in | "One vault. People and agents." |
| S1 | Dashboard / a shared project board | Three human presence dots (Mira/Marcus/Priya); a live edit from Marcus lands on a shared object | VO S1 · caption: "One vault, shared" |
| S2 | Members / roster panel | The roster shows humans **and** two agent members (Research agent, Ops agent) with distinct agent badges | VO S2 · caption: "Agents are members too" |
| S3 | Grant sheet for the Research agent | Mira toggles: collection = **Research** (not Billing); permission = **Propose** (Read on; Delete off) — the same scoping UI as sharing with a person | VO S3 · caption: "Permission an agent like a teammate" |
| S4 | Shared Research space + a projects board | Research agent proposes a batch of **Note/brief** cards; Ops agent proposes **Task** + **Event** cards — all appearing as shared proposals with an agent-authored marker | VO S4 · caption: "Agents draft into the shared space" |
| S5 | Two members reviewing | Priya approves several briefs; Mira approves the ops plan → objects go live; hover shows provenance chip: *proposed by Research agent · approved by Priya* | VO S5 · caption: "A human always commits" |
| S6 | Pull back to the whole vault: humans + agents active, presence + provenance visible; a quick beat where an agent's ungranted reach (Billing) is simply absent | VO S6 · caption: "Scoped. Local. Yours." |
| S7 | Title slide | Logo + URL | VO S7 · "getbrainstorm.online" |

## Notes for the edit

- **The grant sheet (S3) is the thesis of the video.** Scoping an agent with the
  *same* control you'd use to share with a person is the whole positioning:
  agents are permissioned collaborators. Linger there.
- **Provenance (S5) makes it trustworthy at team scale.** "Proposed by *which*
  agent, approved by *which* human" is what lets a team let agents work without
  losing accountability. Show the chip clearly.
- **Presence sells "side by side."** People dots + agent members active in the
  same frame is the emotional core — the team-of-teams. Don't cut to a lone chat
  window; that's the *old* single-copilot framing this video is replacing.
- **Never imply the agent can commit or reach past its grant.** The refusal /
  absence beat in S6 protects the claim.

## What's filmable *now* (the honest "foundations" cut, ~1:20)

If a cut is needed before the vision ships, this is truthful today:
- Single-user **Agent-11**: ask → the agent proposes a Contact/Task/Note → edit a
  card → approve/discard → it goes live (the shipped propose→approve loop).
- **Two humans, one vault over LAN**: Marcus edits a shared object, Mira sees it —
  real shared objects, no relay.
- Frame it as *"today it's you + your agent; next, your whole team + a team of
  agents"* — a roadmap tease, not a claim the multi-agent membership exists.

## Dependencies to land before the full vision can be filmed

| Rung | What it unblocks |
|------|------------------|
| `0.12.0` collab train (`Collab-C5` sharing UX finish · `Collab-C6` human identity · presence) | S1 shared vault + presence |
| `AGENTS-AS-MEMBERS-1` — agent identity in the roster (an agent is a `Profile`-like member) | S2 agent members |
| `AGENTS-AS-MEMBERS-2` — per-agent scoped grants (collection + verb ceiling), reusing the sharing ACL + Agent-11 three-tier model | S3 grant sheet |
| `AGENTS-AS-MEMBERS-3` — agents propose into the **shared** object space (Agent-11 buffer becomes a shared, per-member-reviewable queue) | S4/S5 shared proposals |
| `AGENTS-AS-MEMBERS-4` — provenance: proposed-by-agent / approved-by-human on every object | S5 provenance chip |

## One-line hooks (for the post / thumbnail)

- "Your team, plus a team of agents — one shared vault, the same objects."
- "Permission an AI agent the way you'd share with a teammate. It proposes; a human commits."
- Thumbnail: a members panel showing people *and* agents, with a grant sheet scoping one agent to a single collection.
