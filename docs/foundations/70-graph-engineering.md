# Graph engineering — making our own work traceable

How we orchestrate multi-agent work on this repo, and why. Adapted from
*Graph Engineering: The Karpathy Loop, Improved 1000x by Itself* (independently
compiled July 2026; explicitly **not** endorsed by Anthropic or Karpathy — read
it as a well-organised playbook, not as authority).

The bar it sets, which we adopt verbatim:

> Every important output can be traced to an objective, a plan, an artifact, a
> source, a graph path, an evaluator decision, and a bounded execution record.

Today roughly half our outputs can't. This doc is the plan to close that, and —
more importantly — the record of *why*, so nobody re-litigates it from taste.

## The argument in one paragraph

Each architecture externalises a different bottleneck: a **loop** externalises
iteration and evaluation, a **chain** task order, a **swarm** parallel search, a
**DAG** lineage, a **knowledge graph** shared facts and provenance. The failure
mode is choosing an architecture whose bottleneck isn't yours. **Ours is not
parallel search** — we are not short of agents or throughput. Ours is *lineage
and evaluation provenance*: work whose ancestry gets destroyed, and claims with
no attached evidence.

## The evidence (2026-07-26, one session)

Not hypothetical. Every significant failure in the LAN security-gate session was
a lineage or provenance failure:

| What happened | What was missing |
|---|---|
| PR #313 squash-merged ~13 min before the wiring commit was pushed; the commit was **orphaned** and only found when a code anchor didn't match | Parent links. Squash-merge destroys them, so nothing can detect the loss — the paper's "convergence abstraction" cost, exactly |
| Three stacked PRs (#311, #313, #315) conflicted; #315 would have **deleted** merged work if resolved naively | `stacked-on` edges; a stale-base check |
| A PR claimed "both gates run" **while the pentest was still executing**; it returned three blocking findings | An Evaluation object with a rubric and a verdict, and an edge from the rung |
| A rung was called blocked on a prerequisite that had shipped weeks earlier (stale memory asserted as fact) | Claim provenance — a source edge that invalidates when the source moves |
| Three tests passed while asserting nothing (vacuous red-checks) | "passes" and "fails when reverted" recorded as two distinct evaluations |
| A defense measured as broken was actually a Bun-vs-Node runtime gap | Sourced claim vs marked inference |

## What we adopt

**The node types we already have, unlinked.** This is the key realisation: we do
not need a new store. The plan holds **Task** nodes, git holds **Commit** nodes,
`docs/_review/*` holds **Evaluation** nodes, the friction log and the agent
memory dir hold **Claim** nodes, the dev-MCP lease ledger holds **AgentRun**
nodes. What's missing is **typed edges, invariants, and a checker**.

**The four invariants**, adopted as ratchets rather than aspirations:

1. Every claim has a source, or is marked inference.
2. Every artifact has an authoring run and a version.
3. Every evaluation identifies a rubric.
4. Every superseded object remains addressable.

**Edge types we actually need** (a deliberate subset of the paper's):
`DEPENDS_ON` (typed: `gates` / `blocked-by-decision` / `stacked-on`),
`EVALUATES`, `SUPERSEDES`, `DERIVED_FROM`, `PRODUCED`.

## What we refuse, and why

- **No entity extraction / resolution pipeline** (paper §IV.C). That is for
  document corpora. The paper itself calls false merges catastrophic and
  contaminating; we have no corpus problem to justify that risk.
- **No swarm scaling.** Table IV says use a swarm when the task is
  embarrassingly parallel and a reducer is defined. Our bottleneck is lineage,
  so more agents would add correlated errors without touching the actual
  constraint.
- **No dropping PRs.** AgentHub deletes the main branch, PRs and the merge queue
  because "the primary operation is no longer *merge this into main*". We can't:
  the owner merges, review is required. So we take the *insight* (lineage must
  survive) and adapt it (record pre-squash commit ids), rather than the mechanism.
- **No graph for its own sake.** The paper: *do not introduce a knowledge graph
  merely because the system has agents.* A graph earns its cost when connected
  queries, provenance, or shared world state are central. For us provenance is
  central and connected queries are not — so we build the provenance half only.

## Slices

**Slice 1 — Evaluation ledger + gate reachability. ✅ SHIPPED.**
`docs/_review/evaluations.jsonl` is an append-only record, one object per gate
**run**. `tools/mcp-server/src/tools/plan-gate-check.ts` makes a ✅ rung
*unreachable* while a gate it declared lacks a passing, rubric-bearing
evaluation. Opt-in via a `<gates: …>` marker on the bullet, so it ratchets from
zero violations instead of failing the plan on day one.

Two design choices worth keeping:

- **Latest run wins, in both directions.** Not "any run passed" — a later
  failure must be able to un-bless a rung, or the ledger only ever ratchets
  toward optimism and a regression could never remove a ✅.
- **Failed runs stay.** Superseding means appending, never editing. The LAN-4b
  pentest failure is in the ledger permanently, next to the later pass. "We
  tried, it failed, we fixed it, it passed" is the useful shape; a ledger that
  only shows successes is a marketing document.

**Slice 2 — squash-survivable lineage. ✅ SHIPPED.**
`tools/check-orphaned-commits.mjs` (logic in
`tools/mcp-server/src/tools/orphaned-commit-check.ts`, `bun run check:lineage`)
reports branches carrying commits their merged PR could not have included —
the #313 failure, detected instead of stumbled over.

The design turned on one correction, and it is the transferable part:

- **The signal that survives a squash is TIME, not topology.** The plan above
  said "record pre-squash commit ids as an edge at merge time" — that needs a
  merge-time hook nobody will install. A commit dated after the PR merged
  *cannot* have been in the squash; that is arithmetic, needs no cooperation
  from the merge, and holds however history was rewritten.
- **Content diffing does not work here, and fails in the flattering
  direction.** `git diff main...branch` measures from the merge-base, so it is
  non-empty for every squash-merged branch in the repo. The first draft used it
  and its first live run "found" a branch that was fine. A check whose failure
  mode is a confident false alarm is worse than no check.
- **Two tiers, because late work is often re-landed.** If main has since touched
  the same files, the commit was probably superseded — say so quietly. If it has
  not, nothing could have re-landed it and the work exists nowhere else. Across
  80 merged PRs the live run reports exactly two branches, both correctly tiered;
  a lineage check that cried wolf would be ignored within a week, and then the
  slice is worthless.

**Slice 3 — typed `DEPENDS_ON` between rungs.** `gates` / `blocked-by-decision`
/ `stacked-on`, so "what is genuinely unblocked" is a query. LAN-4a sat
described-as-blocked for several turns while it was in fact free.

**Slice 4 — claim provenance for agent memory.** Each memory file edges to a
file plus commit; flag when the source moves. Would have caught the stale
ROT-3a claim before it was asserted as fact.

## Using it

Declare gates on a rung when it goes ✅:

```
- ✅ LAN-4b — the real external bind `<gates: packaging, pentest>`
```

Append a run per gate execution:

```json
{"rung":"LAN-4b","gate":"pentest","verdict":"fail","rubric":"…what was checked…","evidence":"…where to look…","date":"2026-07-26"}
```

A verdict with no rubric is rejected by the checker. That is invariant 3, and it
is the one that would have caught the premature "both gates passed" claim —
because there was no rubric to write down, since nothing had been run yet.

**It has already earned its keep, and then closed the loop.** Declaring
`<gates: security-review>` on `11b.18` to smoke-test the checker made it fail
with `no-evaluation` — correctly: a reviewer had flagged the Entity-step
expression-evaluation surface as needing its own security pass, and it never
happened. The marker came off (claiming a gate you haven't run is the thing this
prevents) and the owed review went on the rung as residue.

That review [then ran](../_review/2026-07-27-entity-step-expressions.md), on
2026-07-27, and found a privilege escalation in shipped code: a workflow could
rewrite its own `capabilities` sheet and inherit the whole automations app
ceiling. The marker is now back on `11b.18` with a passing record behind it.

That is the full arc the slice was built for — **the ratchet found a real gap
before it had a single passing record in it, the gap turned out to be a live
vulnerability, and the same marker now certifies the fix.** Note the honest
shape: the checker did not find the bug. It found the *missing evidence*, which
is all a structural gate can ever do, and that was enough to get a human to look.

## Limitations to keep in view

The paper's own warnings apply to us directly. **Metrics can be gamed**: a
ratchet improves the metric it can see, and this one can only see *declared*
gates — a rung that declares nothing is unconstrained, by design. **The graph
amplifies builder judgment**: if the rubric is wrong, the checker enforces the
wrong thing with more confidence than prose would. And **fragmentation reduces
quality** — architecture, narrative and tightly-coupled refactors degrade when
split across isolated contexts, so this machinery is for *tracking* work, never
for deciding how finely to divide it.
