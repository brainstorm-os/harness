# Founder-filed development tasks

The **founder role** (running Northbound for real) files concrete, pick-up-able
development tasks here; a **separate developer agent** claims and implements them
(and triages each into `implementation-plan.md` as part of the build, per the
[README](README.md) two-role split — the founder files, the dev plans).

Each task carries: the **business need** (with the session evidence that surfaced
it), the **build direction** (the mechanism the owner picked — see
[`business-wishlist.md`](business-wishlist.md) "How we'll close these"), **acceptance**
(what "done" looks like from the founder's chair), and a **priority**.

**Status:** `open` → `claimed` → `in-progress` → `done`. Claim via the dev MCP
lease ledger (`orchestration.claim` on the task id) and work in an isolated
worktree; don't race on `main`.

**Priority:** `P0` business-critical (the commercial spine) · `P1` real lift ·
`P2` important-but-later.

---

## DT-1 — Automations app v1: status workflows · **P0** · status: engine done / authoring UX open

- **Update (session 192):** the **Automations app is real and runs** —
  Workflows / Reminders / Runs tabs + a template gallery (Daily planning nudge,
  Weekly review nudge, New bookmark alert, Test notification) firing against the
  11b engine. What's *not* there is the **pipeline-rule authoring UX**: only
  "New from template" is exposed; there's no custom
  *when a property changes to X → then set/create* builder, so the acceptance
  below ("when a Client's *Stage* becomes *Proposal*, create a task") still
  can't be authored. Remaining = the rule-builder surface, not the engine.

- **Need (sessions 110/111):** the CRM is a flat list — a "deal" is just
  `{Status, Deal size}` with no managed funnel; statuses only change by hand.
  The whole point of a pipeline is that records **move when something happens.**
- **Build (owner direction):** stand up the scaffolded **`automations`** app as a
  cross-app workflow engine — *rules* of the shape **when ‹trigger› then
  ‹action›**, configured per property / per app. v1 scope:
  - Triggers: a property changes to a value (e.g. `Stage → Won`), a record is
    created/linked, a date arrives.
  - Actions: set a property (status transition), create a follow-up task,
    move a record between collection views/lanes.
  - Surfaced where it's authored (the Automations app) and runs against the
    entities pipeline (respecting capabilities; no new privilege a rule can't
    already do by hand).
- **Acceptance:** Mira can author "when a Client's *Stage* becomes *Proposal*,
  create a 'Send proposal' task" and it fires on the real record. A deal's
  status changes without her editing the cell.
- **Unblocks:** the CRM funnel, engagement lifecycle transitions
  (active→delivered→invoiced→paid), content pipeline state.

## DT-2 — Form Designer v1 + PDF export · **P0** · status: invoice→PDF SHIPPED (iter 1, session 330); breadth open

> **Update (2026-06-22):** the invoice→PDF slice is **done** — Form Designer
> evolved additively into the **Designer** with a "Documents" surface that models
> an `Invoice/v1`, edits line items with computed totals + a live preview, and
> exports a real PDF via the existing `export.printToPdf` path. Verified
> real-shell (session 330: a 91,922-byte `%PDF-` written to disk). See
> [`docs/platform/68-designer-app.md`](../platform/68-designer-app.md) and the
> [business-wishlist Session 330 entry](business-wishlist.md). Remaining: seed
> bill-to from a linked Client (DT-3), proposals/SOWs on the same render core,
> and the DT-7 Finances rollup over invoices. The note below is the original
> (pre-build) framing.

- **Re-confirmed (session 192):** the `form-designer` app is still a
  **COMING-SOON stub** ("WYSIWYG layout editor… coming soon"). The billing chain
  remains entirely absent. Per the session-192 reconciliation in
  [`business-wishlist.md`](business-wishlist.md), this is the deepest-red gap and
  the highest-leverage thing to build next — it unblocks the whole
  invoice→send→paid loop (and DT-7 money downstream of it).

- **Need (session 111):** **no billing chain.** A studio that can't invoice
  can't operate — there's no path from an engagement to an invoice document to
  a record of payment. Zero billing/payment surface anywhere.
- **Build (owner direction):** build the scaffolded **`form-designer`** app to
  compose document/form templates (invoice, proposal, SOW) bound to entity
  properties, plus **PDF export** of the rendered document. That covers
  *create → send* of an invoice. (Accepting payments is genuinely possible on
  our app/capability infra but is **out of v1 scope** unless the owner says
  otherwise — flag, don't build.)
- **Acceptance:** Mira fills an invoice form for the Vertex engagement (line
  items, fee, dates, pulled from the deal where possible) and exports a clean
  PDF she could send. A proposal/SOW uses the same builder.
- **Unblocks:** invoicing, proposals, SOWs, any document-from-data need.

## DT-3 — Richer property settings (model an engagement) · **P0** · status: buildable scope done (rollups → DT-4)

- **Progress (2026-06-04, slice 1 — Hours):** landed `B5.12` — a `Duration`
  number format so a collection column can carry **Hours** (renders `40h 30m`,
  not `40.5`), offered in the property-creation picker and summed in the grid's
  aggregation footer (so an Engagements view can total hours).
- **Progress (2026-06-04, slice 2 — linking):** landed `B5.13` — a **Relation**
  tile in the property-creation form, so a collection column can now *link* to
  notes (single or multi). This closes the **F-008** "a client links to its
  research notes" front-door gap (the link cell + Link preset already existed;
  only the create affordance was missing).
- **Progress (2026-06-05, slice 3 — typed relations + lifecycle):** landed
  `B5.14` — the two remaining buildable lifts. A relation now has a **"Links to"
  target-type picker** (Any + each vault type) that pins `allowedTypes`, and the
  shared link cell scopes its candidate list by it — so an Engagements column
  can link to **Clients / People / Tasks**, not just notes (Database derives the
  type list from the live vault). And a **Select** seeds its options inline at
  creation (one-per-line or comma-separated), so a **lifecycle**
  ("Lead → Qualified → Proposal → Won → Lost", or active → delivered → invoiced
  → paid) is one-shot instead of an empty dictionary + a Settings → Data trip.
- **Status:** the buildable DT-3 scope is **done** — an "Engagements" collection
  can be modelled as typed columns: a relation → Client, a `Duration` Hours
  column, a lifecycle Select, fees via Currency, dates. The remaining engagement
  *totals* (rollups across the engagement→deliverables relation) are **DT-4**,
  which now has its dependency (typed relations) in place. See the plan's
  `B5.12` / `B5.13` / `B5.14`.


- **Need (session 111):** advisory **engagements aren't modeled** — there's no
  client-linked project with a fee, deliverables, hours, and a lifecycle. The
  biggest-cheque half of revenue is invisible.
- **Build (owner direction):** deepen **property types + settings** so a
  Database collection *is* the engagement model — relations (engagement→client,
  engagement→deliverables), a currency/number with rollup-able semantics, a
  duration/hours type, a lifecycle Select, and date fields. No new app; make
  the property system expressive enough that "Engagements" is just a collection.
- **Acceptance:** Mira creates an "Engagements" collection where a row links to
  a Client, carries a Fee, a set of Deliverables, Hours, and a Stage — and it
  reads as a real engagement, not a flat note.
- **Pairs with:** DT-1 (engagement stage transitions) + DT-4 (totals).

## DT-4 — Surface Database aggregation / rollups · **P1** · status: ✅ done (2026-07-18 — shell PR #183, CI green; merge awaits the required owner review)

- **Need (session 110):** Clients carry deal values but there's **no pipeline
  total** — Mira can't answer "what's my pipeline worth?" The engine has
  `aggregations.ts`; it isn't surfaced.
- **Build:** a column **aggregation footer** (sum / count / avg) on the grid,
  and **rollups** across a relation (e.g. total fee across an engagement's
  deliverables; total open-pipeline value across Clients). Wire the existing
  aggregation logic to a visible control.
- **Progress (footer, 9.12.18):** the column **aggregation footer** ships — the
  grid has a sticky footer whose per-column cell cycles Sum/Count/Avg/… so a
  Clients **pipeline total** is visible today (the choice is session-local; a
  durable per-view persist + menu picker are the 9.12.18 polish remainder).
- **Progress (2026-06-05, rollups slice 1 — engine, `9.12.17`):** landed the
  pure **rollup engine** (`logic/rollup.ts`) now that DT-3 gave us typed
  relations. `computeRollup(row, {relation, targetProp, aggregation}, byId)`
  walks a row's relation to its linked entities, reads a target property on
  each, and aggregates through the **same `computeAggregation`** reducers the
  footer uses — so "total fee across an engagement's deliverables" computes
  (formatted in the target's units, e.g. `$4,000`); dangling/deleted links skip.
  **Remaining:** a rollup **property kind** + creation affordance (relation →
  target-property → aggregation picker, extending the B5.14 inline form) + a
  read-only rollup **cell** + grid wiring so the Engagements view shows the
  rolled-up fee column live.
- **Progress (2026-06-06 → 06-10, rollups slice 2 + formulas, `9.12.17`):** the
  engine became a usable column on `main` — the `ColumnSpec.rollup` property
  kind, the three-step **"Add rollup…"** creation picker (relation → target
  property → aggregation), the read-only grid `RollupCell`, full-vault grid
  wiring, and the formula twin (engine + column + authoring). The footer's
  durable **per-view aggregation persistence** (`ColumnSpec.aggregation`
  through the view override + menu picker) closed the 9.12.18 polish remainder.
- **Done (2026-07-18, card surfaces — shell PR #183, CI green, merge pending
  owner review):** the last gap — computed
  columns silently vanished on board/gallery/list cards (and the list strip
  mounted a phantom *editable* cell for the synthetic propertyId) — closed via
  shared read-only computed cells (`react/computed-cells.tsx`:
  `RollupCell`/`FormulaCell` + a rollup-lookup context) rendered by every card
  view with the grid's full-vault `allRows` wiring. A board card now shows
  "Total fee $3,500" live, matching the grid.
- **Acceptance:** the Clients grid shows a summed **pipeline total** ✅ (footer);
  an Engagements view rolls up fees ✅ (grid cell + board/gallery/list cards).
  Numbers Mira would otherwise compute by hand. OQ-40 re-marked
  RESOLVED-in-practice the same turn.

## DT-5 — Website builder + content pipeline · **P1** · status: open

- **Need (session 110):** the newsletter has **no audience and no published
  surface** — the Content Calendar plots issues but tracks no subscribers,
  opens, or revenue, and there's nowhere to actually publish.
- **Build (owner direction):** a **website-builder** app that publishes content
  (a newsletter issue) to a web surface, turning the existing apps into a
  pipeline: draft in Notes → schedule on the Content Calendar → publish to the
  site → audience/metrics flow back. Audience + metrics gaps largely resolve
  once there's a published surface to measure.
- **Acceptance:** Mira publishes Issue #1 from its Notes draft to a site, and
  the issue's status + a basic audience/metric reads back into the calendar.
- **Note:** bigger than DT-1..4; layers on top of them. Likely a later sprint.

---

## DT-9 — Contacts app v1 (people/team) + task assignment · **P1** · status: people-model done / assignee open

- **Update (session 192):** the **Contacts app shipped and is populated** —
  Person records for teammates (Marcus, Priya @ Northbound) and client contacts,
  a 23-row People list in Database. The **people-model half is done.** Still
  open: the **Assignee/Owner person-relation on Tasks** (F-152 — ownership still
  lives in title strings), the per-person "Marcus's work" view, and the
  review-state flow. Also surfaced: Contacts has **no de-dup/merge** and is
  accumulating duplicate + "Unnamed" rows (F-158, visibly bad — 7× "Dana
  Whitfield"); a cleanup affordance belongs in this app's v1.

- **Need (session 112):** Northbound is a *team* now and Mira can't delegate —
  tasks have no **Assignee**, and there's no **people model** to assign to.
  Marcus exists only as a Candidate row, not an assignable teammate; there's no
  way to see "Marcus's tasks" or to relate clients to their contacts.
- **Build:** stand up the scaffolded **`contacts`** app as the people model —
  one `Person` entity used for *both* teammates and client contacts. Then add a
  **person-relation property** (Assignee/Owner) usable on tasks + any collection
  (rides on DT-3 property settings), and a per-person filtered view ("Marcus's
  tasks"). A lightweight **review-state** (Select: draft → needs-review →
  approved) on docs/deliverables, with the transitions driven by DT-1
  Automations ("submitted → needs-review", "assigned → notify").
- **Acceptance:** Mira assigns the four Sprint-1 deliverables to Marcus, opens a
  "Marcus's work" view, and moves his brand-system doc through
  needs-review → approved at the weekly review.
- **Pairs with:** DT-1 (flow), DT-3 (the assignee property). The eventual
  *real* two-vault teammate (sync) is separate — this is the in-vault people +
  assignment model.

## Backlog (filed, lower priority)

- **DT-6 · P2** — Mailbox v1: client threads + the newsletter send (the comms
  half). **Update (session 192):** no longer a coming-soon stub — the Mailbox
  *shell* shipped (inboxes / flagged / search / reading pane) and the vault
  carries Messages (18) + Conversations (6) entities, but it's **unwired** ("mail
  appears once it syncs" — no account, no send). Remaining = the account/sync +
  send wiring on top of the existing shell. Pairs with DT-5's audience.
- **DT-7 · P2** — Money/finances pattern: once DT-1/2/3/4 land, a "Finances"
  collection (revenue lines from invoices + expenses, runway rollup) — likely a
  *pattern over the new primitives*, not a new app. Re-evaluate after the spine.
- **DT-8 · P2** — Payment acceptance (post-v1, owner to confirm): on the app /
  capability infra. Out of scope until the owner greenlights.
