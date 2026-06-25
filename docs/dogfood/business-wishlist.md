# Northbound — what the business needs next

A running, **forward-looking** roadmap derived from *running Northbound as a real
company inside Brainstorm* — distinct from the [friction log](friction-log.md)
(which records bugs + clumsy interactions in shipped features). This file
answers a different question: **what can't Mira do at all yet that a real
research-&-advisory studio needs**, and **what works but is too weak to run a
business on.**

The method (per the founder loop, now in its "run-it-for-real" phase): Mira
operates Northbound through the app — clients moving through a pipeline, money
in and out, content shipping on a cadence, a team to coordinate. Wherever she
hits a wall or a workaround, it lands here as a **NEED** (missing capability) or
a **WEAK** (exists but too thin to rely on), tagged by business function and a
rough impact. We **accumulate** these over several real-operations sessions, then
triage the highest-impact ones into `implementation-plan.md` iterations.

> Nothing here is a task yet. It's the evidence we'll base tasks on. Fixes wait
> until a batch has accumulated.

**Tags:** `NEED` (can't do it) · `WEAK` (can, but not really) · impact
`★★★` business-critical / `★★` real friction / `★` nice-to-have.

---

## The business, for reference

**Northbound** — Mira Anand's one-person (now two, with Marcus) research &
advisory micro-studio. Revenue = a paid research newsletter (subscriptions) +
advisory engagements (project fees). The operating loops a real version must
support:

1. **Content engine** — research → draft → publish a newsletter issue on a
   cadence → grow + retain subscribers → revenue.
2. **Advisory** — lead → proposal → signed engagement → deliver → invoice →
   get paid.
3. **Money** — track revenue (subs + advisory), expenses, runway; know if the
   business is healthy.
4. **Team** — coordinate Marcus (and future hires); reviews, handoffs.
5. **Operations** — the planning, the cadence, the knowledge base that ties it
   together.

---

## How we'll close these — product direction (owner, 2026-06-04)

The "no commercial spine" gaps are **not new primitives to invent** — they map onto the planned apps + the existing app/property infrastructure. Several of the apps already exist as scaffolded stubs (`automations`, `form-designer`, `mailbox`, …) waiting to be built. The direction:

- **CRM is a flat list → AUTOMATIONS.** The funnel isn't solved by hand-adding a "Stage" property; it's solved by the **Automations app** — *workflows configured per property / per app* where a record's status changes **when something happens** (a deal moves to Proposal when a proposal is linked; a task flips Done when its deliverable is signed; an engagement → Invoiced when the invoice is sent). Status transitions become rules, not manual edits. This is the cross-app workflow engine.

- **No engagements → richer PROPERTY SETTINGS.** Modelling an engagement (fee / deliverables / hours / relations / lifecycle) is a **property-configuration** job, not a new app — the property system needs to be expressive enough that a Database collection *is* the engagement model. So the work is on property types + settings, and engagements fall out of it.

- **No billing chain → FORM BUILDER + PDF EXPORT.** Invoices (and proposals/SOWs) are produced by the **Form Designer app** (build the invoice form) + **PDF export** (render the document). That covers create → send. **Accepting payments** is *genuinely possible* on our app/capability infrastructure but is likely **post-v1** — TBD whether v1 ships it.

- **Newsletter has no audience/publishing → WEBSITE BUILDER + a content pipeline.** A **website-builder app** lets the newsletter be **published to a website**, and — *because we already have all the apps* — that becomes a real content pipeline (draft in Notes → schedule on the Content Calendar → publish to the site → audience/metrics flow back). The audience/subscriber + metrics gaps largely resolve once there's a published surface to measure.

> Net: the first build-batch of this phase isn't "add a money type" — it's **stand up Automations + Form Designer (+ PDF export) and deepen property settings**, then layer the website builder. The CRM/engagement/billing gaps are downstream of those.

---

## Gaps & weaknesses (newest sessions on top)

<!-- Entries land below this line, newest session first. -->

## Session 331 — Formula properties: calculation columns on databases AND objects (2026-06-22)

The next business primitive after invoices: **formula properties** — a read-only
computed value over an entity's other properties (`{qty} * {rate}`), usable as a
calculation column. The formula *engine* already existed but was trapped in the
Database app as a per-view column; this **promotes it to a first-class property**.

- the pure formula engine moved to the SDK (`@brainstorm/sdk/formula`) — now
  importable by every app, including the **Designer** (invoice line totals are a
  formula special-case — the dots connect);
- a `Formula` property kind (number + `format=formula` + an `expression`),
  authored through the shared add-property picker (a Formula tile + expression
  input);
- a shared read-only `FormulaCell` that evaluates against the entity's siblings,
  so the value computes in the **Database grid AND the object inspector** — not
  just one Database view.

**Verified real-shell (session 331):** added a `Calc = 10 + 5` Formula property
to a collection; the grid's Calc column computes **15** in every row. ~80 unit
tests across the engine, cell, draft + the dogfood gate.

> Connects several wishlist dots: it **subsumes a standalone Finances app
> (DT-7)** — revenue / outstanding become *formula or rollup properties over
> `Invoice/v1`* (each invoice already carries `total` + `status`), not a new
> primitive; it generalises **DT-4** (calculation beyond the aggregation footer);
> and the Designer can compute document fields (invoice totals) through the same
> engine. Next slices: a property-reference picker in the formula input (today
> you type `{key}`), then string/conditional/date functions, then rollups across
> relations.

## Session 330 — DT-2 invoice → PDF shipped (2026-06-22)

The readiness re-check (329, below) named **DT-2 (a billing-document generator)**
the deepest remaining red. It now has its first vertical slice. Per
[`docs/platform/68-designer-app.md`](../platform/68-designer-app.md), Form
Designer evolved **additively** into the **Designer** — a "Documents" surface
beside the existing "Forms":

- model an `Invoice/v1` (parties, line items, tax, draft/sent/paid status);
- edit it with a **live preview that *is* the PDF** (computed subtotal/tax/total);
- **Export PDF** through the existing `export.printToPdf` + `requestSaveBytes`
  path — a real sendable file.

**Verified real-shell (session 330):** an invoice for Vertex Labs (10 × $250)
renders **US$2,500.00** in the preview and exports a **91,922-byte `%PDF-`** file
to disk. 54 form-designer unit tests + the 330 dogfood gate green.

> **DT-2 verdict: 🟡 → ✅ for the invoice→PDF acceptance.** The lead→paid loop is
> no longer blocked at "can't produce an invoice." Remaining DT-2 breadth
> (proposals/SOWs reuse the render core; generic `Document/v1`) and the
> downstream gaps stay open: seed bill-to from a linked **Client** (DT-3
> relation), then a **Finances rollup** over invoices (**DT-7** — the
> denormalised `total` + `status` on each invoice are already there for it),
> then **publishing** (DT-5). The "all-in-one Designer" north star (forms +
> documents + pages, one model, swappable output targets) is now seeded by a
> shipping slice rather than a paper plan.

## Session 329 — readiness re-check: the commercial spine after the app fleet shipped (2026-06-22)

The Session-192 reconciliation (below) left the commercial spine's hard center
mostly ❌/🟡 — Form Designer a stub, Mailbox unwired, no automation *authoring*,
no task assignee, no rollups surfaced. Three months of build later, this session
re-verified each DT against the current product — by **driving the apps in the
real shell** (`tests/dogfood/sessions/329-*` + `329b-*`, captures under
`tests/dogfood/.sessions/329*/`) and by **reading the shipped code** where an
empty starter vault hid an affordance behind state. Verdict legend unchanged:
**✅ ready** · **🟡 partial** · **❌ open**.

### ✅ Now ready (shifted since 192)
- **DT-9 — task assignment / ownership → ✅.** Tasks carry an **Assignee** now
  (`apps/tasks/src/app.tsx`: `assigneeId`, `onPickAssignee`, `assigneeName`), and
  the **Upcoming** surface offers **group-by-assignee** (verified real-shell,
  329b). Ownership is a first-class person-relation, not a title string. [was ❌]
- **DT-1 — automation *authoring* (when→then) → ✅.** Automations now has a
  **"New workflow"** path opening a real **"Build workflow"** dialog — Name, a
  **Trigger "Fires on"** picker, and an **"Add step"** palette (verified
  real-shell, 329b). The trigger kinds include **`EntityEvent`** (onCreate /
  onUpdate / onDelete on a type, *with a filter* — `packages/sdk-types/src/automations.ts`)
  and the step kinds include **`Entity`** (create / update an entity). So the
  exact rule Session 192 couldn't author — *"when a Client's Stage → Proposal,
  create a 'Send proposal' task"* — is now composable. [was 🟡 engine-only]
- **DT-4 — Database rollups → ✅.** Computed **rollup** columns ship (`list.ts`
  9.12.17: a column that rolls a property across a relation) on top of the
  existing Sum/Count/Avg aggregation footer. Engagement→deliverables / pipeline
  totals are now expressible. [was in-progress]
- **DT-6 — Mailbox wiring → ✅ (connect side).** Mailbox now connects **real
  accounts** — **IMAP/SMTP** and **Gmail OAuth** (`apps/mailbox/src/app.tsx`
  `connectImap`, OAuth client flow; verified the connect UI is present, 329).
  Client threads can flow in. [was 🟡 unwired] *Caveat:* bulk **newsletter send**
  to an audience is still downstream of DT-5.

### 🟡 Partial — big progress, not yet turnkey for the money loop
- **DT-2 — billing chain (invoice → send → paid) → 🟡.** The Session-192 blocker
  (Form Designer a COMING-SOON stub) is **gone**: Form Designer is a **real
  builder** (verified — Builder/Fill tabs, name, "Creates entities of type",
  Add-field, Save). And **PDF export exists** (`packages/shell/src/main/export/print-to-pdf.ts`,
  `packages/sdk/src/pdf-engine/`, the `export` service + automations `Export`
  step). **But** Form Designer builds **data-collection forms** ("create one to
  collect entities"), not a **document/invoice generator** — there is no invoice
  / proposal / SOW template, no line-items-with-totals document, no "send +
  mark-paid" lifecycle. The *pieces* (form + entity + PDF) are assemblable; the
  **turnkey invoice→paid loop is not built.** This is now the spine's deepest
  remaining red. [was ❌]
- **DT-3 — model an engagement → ✅ buildable / 🟡 not modelled.** Typed
  relations + rollups + currency/duration/lifecycle property settings make an
  "Engagements" collection fully buildable; it's still not seeded as a real
  modelled collection. [unchanged]

### ❌ Still open — the parts with no surface yet
- **DT-7 — money / finances / P&L → ❌.** Still **no revenue/expense/runway
  surface**. (Note: the shipped `account.db` billing spine bills the *product's
  own* subscription — it is **not** Mira's business P&L.) No "Finances" app in
  the registry.
- **DT-5 — website builder + audience / MRR metrics → ❌.** No website/publishing
  app exists, so there's still nowhere to publish the newsletter and nothing to
  measure subscribers / open-rate / MRR against.
- **DT-8 — payment acceptance → ❌ (post-v1).** Unchanged.

> **Readiness verdict (2026-06-22):** the **team + CRM + automation + comms-in**
> half of the spine is now **business-ready** — assignee (DT-9), custom workflow
> authoring (DT-1), rollups (DT-4), and real mail-account connect (DT-6) all
> shipped and verified. The **money loop is not yet ready**: the studio still
> **cannot produce an invoice** (DT-2 is generic forms, not a billing document),
> **cannot see a P&L / runway** (DT-7), and **cannot publish / measure an
> audience** (DT-5). Highest leverage next is unchanged in *shape* but narrower
> in *scope* than 192 thought: not "stand up Form Designer" (done) but **add an
> invoice/document generator on top of it + a Finances surface** — that pair
> closes the lead→paid loop the whole commercial case rests on.

## Session 192 — reconciliation: which gaps the shipped apps actually closed (2026-06-09)

The wishlist stalled at session 114 while the build shipped the whole planned
app fleet. Mira toured the commercial + team spine (sessions 192/193, captures
in `tests/dogfood/.sessions/192-mira-commercial-spine-tour/`) to mark each
accumulated NEED/WEAK against what's now real. Verdict legend: **✅ closed** ·
**🟡 partial** (built but not enough to run on) · **❌ still open**.

### ✅ Closed by shipped work
- **NEED ★★ — a People / Team model (s.112) → ✅.** The **Contacts** app is real
  and populated — Person records for teammates (Marcus, Priya) *and* client
  contacts, a 23-row People list in Database. People are now first-class, not
  "a Candidate row". (The *assignee-on-tasks* half is still open — see below.)
- **NEED ★★ — contacts on a deal (s.110/111) → ✅.** A client's people exist as
  Person records and a Companies list (4) is modelled; the relation plumbing
  (DT-3 typed relations) to link a deal → its contact is in place.
- **WEAK ★★★ — no pipeline total / forecast (s.110) → ✅.** The Database grid
  **aggregation footer** (Sum/Count/Avg) ships, so a Clients pipeline total is
  visible (DT-4 footer slice). *Caveat:* the gold cover band on the Clients grid
  currently obscures the columns (filed on the friction side).
- **The vault is thin (meta, s.110/113) → ✅.** No longer a fixture — People 23,
  Companies 4, Clients 3, Candidates 4, Content Calendar 3, Messages 18,
  Conversations 6. The gaps now surface under realistic volume.

### 🟡 Partial — built, but not yet enough to run the business on
- **CRM funnel via AUTOMATIONS (the s.110/111 theme) → 🟡.** The **Automations**
  app is real (Workflows / Reminders / Runs + a running template gallery), so
  the *engine* exists. But the **pipeline rule Mira needs** — "when a Client's
  *Stage* → *Proposal*, create a 'Send proposal' task" — isn't author-able: only
  "New from template" (personal-productivity nudges), no custom
  when-property-changes → then-set-property builder. Status transitions are
  still manual. (Tracked as **DT-1**, now "engine done / authoring UX open".)
- **NEED ★★★ — client + audience comms (s.110) → 🟡.** The **Mailbox** app is a
  real surface (inboxes / flagged / search / reading pane) and the data model is
  staged (Messages 18, Conversations 6), but it's **unwired** — "appears once it
  syncs", no account, no newsletter send. (Tracked as **DT-6**.)

### ❌ Still open — the commercial spine's hard center
- **NEED ★★★ — the billing chain: invoice → send → paid (s.110/111) → ❌.** The
  **Form Designer** app is still a **COMING-SOON stub**, so there is still **no
  way to produce an invoice / proposal / SOW** and no PDF export. This remains
  the single most business-critical gap. (Tracked as **DT-2**.)
- **NEED ★★★ — a money / finances surface (s.110) → ❌.** Still no
  revenue/expense/runway primitive (DT-7, downstream of DT-2's billing).
- **NEED ★★ — subscription / MRR + audience metrics (s.110) → ❌.** Still no
  subscriber/MRR model; resolves with the website-builder + published surface
  (DT-5).
- **NEED ★★★ — model an engagement (s.111) → ❌ (modellable, not modelled).**
  DT-3 made the *property system* expressive enough (typed relations, Hours
  duration, lifecycle Select, currency) that an "Engagements" collection is now
  *buildable* — but no such collection exists in the vault yet, and rollups
  across engagement→deliverables are still UI-pending (DT-4). Founder action +
  DT-4 wiring.
- **NEED ★★ — task assignment / ownership (s.112) → ❌.** Contacts gave us the
  *who*, but Tasks still has **no Assignee** (F-152) — ownership lives in title
  strings. (Tracked as **DT-9**, people-model half done, assignee half open.)
- **WEAK ★★ — no review / approval flow (s.112) → ❌.** Still no review-state on
  docs/deliverables (part of DT-9).

> Net: the **team + knowledge + CRM-data** side has largely filled in (Contacts,
> rollup footer, a rich vault, a real Automations engine). The **commercial
> spine's hard center is still missing** — billing (Form Designer/PDF, DT-2),
> money (DT-7), and the automation *authoring* UX (DT-1) are the unchanged
> blockers, plus the assignee property (DT-9). The next fix-batch's highest
> leverage is **DT-2 (Form Designer + PDF)** — it's the deepest red and unblocks
> the whole invoice→paid loop.

## Session 114 — wiring research into the issue: the link path works (2026-06-04)

Resolves the 113 "VERIFY". Typing **`/`** in the draft surfaces existing pages to reference/embed (the menu listed the research note, both Issue drafts, Northbound HQ, etc., plus block commands like "Text Plain paragraph"). So **embed/reference is discoverable and works** — *not* a gap. The empty graph in 113 was unused linking, not missing capability. Also added real substance (a "Research — the trust tax in CI/CD" note Mira would cite).

**Confirmed strong (so the dev agent doesn't over-invest here):** drafting, page-reference/embed via `/`, transclusion, the graph render. Brainstorm's **knowledge + planning half is solid.** The roadmap (DT-1..DT-9) is rightly all on the **commercial + team spine**, which is where every real-operations wall stood.

## Session 113 — research → Issue #2: the content engine works, the vault is empty (2026-06-04)

Good news first: Brainstorm's **knowledge half is real**. The editor exposes transclusion (a draft *can* pull in another entity), Notes drafting is smooth, the Graph renders. So the content-*production* tooling isn't the gap. Captures: `tests/dogfood/.sessions/113-research-to-issue/`.

What's missing is **substance + connective tissue**, not tools:
- **Vault is empty of real research.** The Bookmarks reading list is *only* the seed "Example Domain" placeholder — Mira has nothing real to draw an issue from. The content engine has no input because no research has been captured. (Action, not an app gap: build real substance — see meta note in session 110.)
- **WEAK ★ — nothing is linked.** The Graph shows **82 nodes, 0 edges**: research, issues, clients, tasks all float unconnected. Partly thin-vault (Mira hasn't linked things), but also a hint that **linking isn't a natural part of any workflow** — relations have to be sought out, so a knowledge graph that should be the payoff is empty. (Ties to F-048's dot-field and the "relationship inference" idea.)
- **VERIFY (not filed) — embed/cite discoverability.** No always-visible "embed/reference" affordance in the editor; embeds appear to be slash-menu-driven (standard, not tested here). Re-check the slash path before calling it a gap.

> Takeaway: the next stretch of founder work is **building Northbound out for real** — capture real research, link it into issues, fill the pipeline — both to make the dogfood vault a true company and so the *strong* tools (transclusion, graph, search) get exercised under realistic data. Gap-finding on missing *capabilities* has largely saturated for the current app state (the queue, DT-1..DT-9, holds the structural needs); the remaining founder value is substance + testing each dev task as it lands.

## Session 112 — working with Marcus: running a team (2026-06-04)

Northbound is two people now, and Mira found she can't actually *delegate*. Captures: `tests/dogfood/.sessions/112-working-with-marcus/`.

- **NEED ★★ — task assignment / ownership.** A task carries Priority / Status / Scheduled / Due / Project — but **no Assignee**. Mira can't hand the four Sprint-1 deliverables to Marcus, can't see "Marcus's tasks", can't tell who owns what. A team can't run on an unassignable to-do list.
- **NEED ★★ — a People / Team model.** There's **no people surface** at all (`Database lists` has no People/Team/Members/Contacts). Marcus exists only as a *Candidate row* in the hiring pipeline — not as a team member you assign to, @mention, or relate work to. The **`contacts` stub app** is the natural home (people = clients' contacts *and* teammates).
- **WEAK ★★ — no review / approval flow.** Reviewing Marcus's output = opening his doc and reading it; the header offers nav / icon / delete / lock / properties — **no sign-off, approval, or review-state**. "Needs review → approved" doesn't exist, so the weekly design-review cadence has no teeth in the app.

> These fold into the same machinery: **Contacts** (a people model — `contacts` stub) for *who*, **property settings** (a person-relation Assignee property — DT-3) for *assign*, and **Automations** (DT-1, e.g. "assigned → notify", "submitted → needs-review") for the *flow*. Filed as **DT-9** below.

## Session 111 — the Vertex engagement, end to end (2026-06-04)

Mira tried to run one advisory deal through its whole life — and fell off a cliff at "get paid." What the captures showed:

### The deal record is bare
- **WEAK ★★ — a "deal" is just `{Status, Deal size}`.** Vertex Labs carries a generic Status Select + a US$48,000 currency value, and nothing else. A real deal needs a **pipeline stage** (Lead → Qualified → Proposal → Won/Lost — distinct from a free "Status"), a **close / decision date**, a rough **probability**, the **contact person**, and a **link to the engagement** it becomes. Today the CRM can't tell Mira *what stage anything is at* or *when it'll close*.

### The advisory engagement has no home
- **NEED ★★★ — model an engagement.** "Projects" has exactly one row (the seed "Getting started"). There is no structured **engagement**: a project tied to a *client*, with a **fee**, **deliverables / milestones**, **hours**, and a lifecycle status (active → delivered → invoiced → paid). The advisory half of Northbound's revenue — the half with the biggest cheques — is invisible to the app.

### Proposal → SOW → invoice → paid: the chain doesn't exist
- **NEED ★★★ — the billing chain.** The proposal lives as an ad-hoc "intro call prep" note; there is **no path** from an accepted proposal to a billable engagement to an **invoice** to a recorded **payment**. Re-confirmed: zero billing/payment/revenue surface in the whole app. This is the single most business-critical gap — a studio that can't invoice can't operate.

> Pattern across 110 + 111: Brainstorm is a strong **knowledge + planning** tool (Notes/DB/Calendar/Tasks) but has **no commercial spine** — no money, no billing, no deal pipeline, no engagements. That's the theme the first fix-batch of this phase should probably target.

## Session 110 — Monday operations review: "how's the business doing?" (2026-06-04)

Mira sat down to run the numbers and found she mostly **can't**. The knowledge base (Notes) is genuinely strong — HQ, weekly + June reviews, an investor brief, the thesis, issue drafts. But the *operating* layer is thin and the **money layer doesn't exist**. Captures: `tests/dogfood/.sessions/110-running-the-numbers/`. First batch of needs:

### Money — the biggest hole
- **NEED ★★★ — a money/finances surface.** There is *no* way to track revenue (newsletter subscriptions + advisory fees), expenses, or runway. A founder cannot see whether the business is healthy. No "Finances" list exists; there's no money/currency-aware *account* or *ledger* primitive — only a currency *property* on a row. Running a company without a P&L or a runway number is a non-starter.
- **NEED ★★★ — invoicing.** Advisory engagements need invoices: create → send → mark paid → chase overdue. No invoice concept anywhere.
- **NEED ★★ — subscription / MRR tracking.** The newsletter is the core revenue line; there's nothing to record subscriber count, churn, or recurring revenue over time.

### CRM / pipeline
- **WEAK ★★★ — no pipeline total or forecast.** Clients carry a deal value (Vertex US$48k, Acme US$25k…) but there's no column **rollup / sum** surfaced, so Mira can't answer "what's my pipeline worth?" — she'd add it on a calculator. (The DB engine has `aggregations.ts`; if a column total exists it's not discoverable from the grid.)
- **WEAK ★★ — Clients don't model a sales pipeline.** No Stage (Lead → Proposal → Negotiation → Won/Lost) or probability on Clients (Candidates has stages; Clients doesn't), so the CRM is a flat list, not a funnel you can manage.
- **NEED ★★ — contacts.** A client is a company with *people*; there's no person/contact link on a deal beyond a name string.

### Content engine
- **WEAK ★★ — the Content Calendar tracks no metrics.** It plots 3 issues on a Tue cadence (works), but records no subscribers, open rate, or revenue per issue — the numbers a newsletter business actually runs on. No published-archive vs draft distinction visible on the chips either.
- **NEED ★★ — an audience / subscriber list.** There's no model of the audience at all — the people the whole business serves are invisible in the app.

### Comms & operations
- **NEED ★★★ — client + audience comms.** Mailbox is a stub. A research/advisory studio lives in email — client threads, the newsletter send, logged correspondence. Today none of that touches the app.
- **WEAK ★★ — advisory engagements aren't modeled.** "Projects" has 1 item; there's no engagement with a client link, a fee, milestones/deliverables, and hours. The advisory half of the business has no home.

### Meta
- **The vault is thin** — 3 clients, 3 issues, 1 project. Not an app gap, an *action*: upcoming sessions should build Northbound out with real substance (a fuller lead pipeline, a content backlog + archive, real financials) so the gaps surface under realistic volume, not a fixture.
- **Recurring bug** (already on the friction side): the Clients "Grid" tab rendered the **gallery** card view, and data cards wear big decorative gradient covers (Marcus's 093 notes). Flagging here too since it bit a real review.

