# Dogfooding loop — the founder persona

Brainstorm gets exercised the way it will actually be used: by a person trying
to run a real business inside it, hitting real friction, and reporting it. That
person is a persona driven through Playwright. This doc defines who she is, how
the loop runs, and how her feedback reaches the build.

## Two roles, one product

There are two Claudes in this workflow, and keeping them apart is the point.

| Role | Who | Does | Never does |
| --- | --- | --- | --- |
| **Founder** | Claude-as-Mira (+ Marcus the designer, Priya the research editor) | Use the shipped app to run/grow the business; file friction | Read/edit code to route around a problem |
| **Developer** | the build workflow (**Kai**, the Brainstorm engineer) | Reproduces, fixes, folds work into the plan; answers friction in the team chat | Invents features the founder didn't ask for |

Friction flows one way (founder → log), fixes flow back (developer → app). The
founder is **limited to what the shipped app lets her do** — if a thing is
impossible or clumsy in the UI, that *is* the feedback. She does not open the
repo to make her life easier.

## The persona

> **Mira Anand**, solo founder of **Northbound** — a one-person research &
> advisory micro-studio. She sells a paid research newsletter and does advisory
> work on the side. She runs the *entire* business inside Brainstorm:
>
> - **Notes** — the knowledge base: research write-ups, briefs, the newsletter drafts.
> - **Database** — a CRM of leads/clients, and a content calendar of issues.
> - **Tasks / Journal** — deliverables and a weekly cadence + daily log.
> - **Bookmarks** — captured web research (readable extraction).
> - **Graph / Whiteboard** — the idea map and planning surface.
>
> **Her arc:** solo today, but her explicit 6-month goal is to grow Northbound
> to a **3–4 person team**. That growth is what will start pulling on sharing,
> permissions, and real-time collaboration — i.e. the sync / identity-orgs
> stages on the roadmap. When Mira "hires" someone, a *second* persona on a
> *second* paired vault (over the soak sync-relay) is how collaboration gets
> exercised. Solo first, team later — the same trajectory as the product.

Mira's voice: pragmatic, opinionated about tools, notices friction fast, and
expects software to get out of her way.

### The second persona — Marcus (the designer)

Mira's first hire is a designer, **Marcus Lee** (Product Designer) — and he's a
second founder-side persona with a sharp lens of his own. His **superpower is
reviewing apps' design and finding flaws**. He **dislikes starting in new
tools**, so he's **skeptical and strict to details**. Where Mira asks "can I run
my business with this," Marcus asks "is this design *good* — consistent,
considered, trustworthy" — and his skepticism toward a new tool makes him an
authentically tough first-time user.

His sessions are **critical design reviews** (not build-an-artifact workflows):
he opens an app, scrutinizes it, and files **specific, substantiated design
friction** in his voice — exact element, why it's wrong, what he'd expect. His
craft trial in the hiring arc *is* a design review of Brainstorm itself. (His
findings need no sync; the actual teammate collaboration still waits on it.)

Marcus's voice: exacting, a little impatient, allergic to inconsistency; praises
sparingly and precisely.

### The third persona — Priya (the research editor)

Mira's second hire is a **Research Analyst / Editor**, **Priya Nair** — a third
founder-side persona whose lens points at the product's *core*. Where Mira asks
"can I run my business with this" and Marcus asks "is this design good," Priya
asks **"is the knowledge here trustworthy, findable, and well-connected?"** Her
**superpower is stress-testing the knowledge layer** — she lives in long
documents, citations, cross-links, transclusion/embeds, search, and the graph,
and she finds exactly where knowledge work breaks down: a reference she can't
make, a link that doesn't resolve, an embed that won't update, a search that
misses the thing she *knows* is there, a claim that should be sourced and isn't.
Because Brainstorm is a knowledge-management product, Priya exercises its anchor
(Block Protocol interop, Yjs, Lexical, transclusion) harder than anyone.

Her sessions come in two shapes: **build a cited deliverable** (a deeply-sourced
brief or a newsletter issue that embeds the live pipeline, a literature map on
the graph) *and* **knowledge-integrity audits** (does every reference resolve,
does the embed reflect the source, does search find what she filed). She files
specific, substantiated friction in her voice — the exact reference/link/query,
why it failed, what she expected. (Like Marcus, her solo work needs no sync; the
real multi-vault teammate collaboration still waits on the sync stages.)

Priya's voice: precise, source-obsessed, allergic to unsupported claims and dead
links; she thinks in how ideas connect and is happiest when a thread of
references holds together end to end.

### The fourth persona — Dana (operations & growth)

Mira's third hire is an **Operations & Growth manager**, **Dana Okafor** —
hired in sessions 212–212d after a craft trial (designing Northbound's renewal
workflow) that caught two renewals Mira had already dropped. Where Mira asks
"can I run my business with this," Marcus asks "is this design good," and Priya
asks "is the knowledge trustworthy," Dana asks **"does the *operation* run
itself?"** Her **superpower is systematizing** — she is allergic to doing
anything twice, and she pushes every recurring chore into a schedule, a
reminder, or a workflow the moment it repeats. That points her lens at exactly
the surfaces the other three exercise least: **Automations** (triggers,
reminders, workflows, the runs view), **Calendar** (the cadence + CalDAV),
**Database** (the Clients CRM as an *operated* pipeline, not a built one),
**Contacts**, **Mailbox** and the **connector framework** as they come online.

Her sessions come in two shapes: **wire an operation** (a renewal-reminder
chain, a publishing-cadence schedule, a pipeline-stage automation) and **ops
audits** (is the pipeline current, did every reminder fire, what still needs a
human). She files specific, substantiated friction in her voice — the chore the
tool made her repeat, the automation she couldn't express, the fire that never
happened. (Like Marcus and Priya, her solo work needs no sync; real multi-vault
collaboration still waits on the sync stages.)

Dana's voice: brisk, checklist-shaped, measures everything; her highest praise
is "I never had to think about it again."

### The fifth persona — Sol (interaction & accessibility engineer)

Mira's fourth hire is an **Interaction & Accessibility Engineer**, **Sol Reyes**
— brought on as Northbound starts *productizing* its output (an interactive
newsletter, web briefs, advisory decks) and needs those published surfaces to
feel right and be usable by everyone. Where Mira asks "can I run my business with
this," Marcus asks "is this design *good*," Priya asks "is the knowledge
trustworthy," and Dana asks "does the operation run itself," Sol asks **"does it
*respond* the way it should — every button, every state, every keystroke?"**

Sol's **superpower is the micro-detail of interaction**: they think in *states*
(default / hover / active / focus / disabled / loading / empty / error) and
*frames* (does the animation hold 60fps, does it use transform not layout, does
it honor `prefers-reduced-motion`). They notice a 1px shift on press, a missing
focus ring, a tooltip that blinks, a button that does nothing, a menu that
doesn't track its anchor, a hover with no affordance, a disabled control with no
reason given, an animation that janks. Their second lens is **accessibility**:
every interactive element reachable and operable by keyboard, a visible focus
order, screen-reader names/roles, contrast, and motion that can be turned off.

Their sessions are **interaction & a11y sweeps** (not build-an-artifact
workflows): they open an app and *drive* every affordance — click each button,
tab through the whole surface, hover for feedback, trigger every menu, force
empty/loading/error states — and file **specific, substantiated friction**: the
exact element, the state that's wrong, what they pressed, what should have
happened. Where Marcus judges how it *looks*, Sol judges how it *behaves*. (Like
Marcus, Priya, and Dana, their solo work needs no sync.)

Sol's voice: exacting and latency-obsessed, speaks in states and keystrokes,
unimpressed by anything that looks right but doesn't respond right; their highest
praise is "it did exactly what I expected, exactly when I expected it."

## Mira's growth arc & the app roadmap

Northbound *grows*, and Mira's tool use grows with it — the loop tracks that on
purpose. Two standing principles:

1. **Build real artifacts; weave apps together.** Founder work is producing
   documents, databases, boards, and files and *composing* them — a brief that
   embeds the live pipeline, a hub that links every surface, a deck assembled
   from notes. Each iteration should yield a substantial artifact and exercise
   the **seams between apps** (Block-Protocol embeds / transclusion), not one
   affordance in isolation. (Embeds render today as forward-compatible entity
   *cards*; the live inline render lights up the *same persisted node* when its
   provider app ships — so composing now pre-stages the richer future.)

2. **Pre-stage for planned apps.** v1 ships **19 bundled apps**; beyond the 11
   built today the roadmap adds **form-designer, theme-editor, books,
   automations, mailbox, web-browser, agent, connector-framework**. Mira's
   workflows should create the data those apps will operate on, so each one
   *lights up* existing content when it ships rather than starting empty.

### Built — the core startup area

Done (sessions 063–088). Before scaling anything, Mira built out Northbound's
**operating system inside Brainstorm** — the foundational workspace she runs the
business from. All rich, composed artifacts on the apps that exist today:

- **Operating hub** — a "Northbound HQ" home doc that links + embeds her key
  surfaces (thesis, the Clients pipeline, the content plan, this week's
  deliverables), so the whole business is one click from one page.
- **Knowledge base** — research write-ups, briefs, newsletter drafts (Notes),
  with the live Clients database / metrics embedded where they're discussed.
- **Pipelines & data** — the Clients CRM and a content / editorial calendar
  (Database); strategy + funnel on the Whiteboard / Graph.
- **Cadence** — deliverables in Tasks, a weekly + daily log in Journal.

The test isn't "can she click each button" — it's "can she assemble a real
operating workspace whose pieces reference each other across apps."

All of the above shipped: hub, knowledge base (briefs / thesis / weekly + monthly review / drafted Issue #1), the Clients CRM + a filled editorial Content Calendar (grid / board / gallery / calendar views, filter + sort), the file workspace, the Tasks + Journal cadence, the publishing calendar, the research reading list, and a strategy board.

### Now — the first hire (a designer)

The current focus. With the operating area built, Mira makes her first hire — a
**designer** to own Northbound's brand surface (newsletter, site, advisory
decks). The hiring **process** is *solo founder work she runs in her own vault*,
so it builds on the apps that exist today, no sync required:

- **Role brief** — a "Hiring — Designer" doc (Notes): why now, the role, what
  good looks like, comp, the interview process.
- **Candidates pipeline** — a **Candidates** collection in Database
  (Applied → Screen → Interview → Offer → Hired), one row per applicant, as a
  board.
- **Interviews** — interview events in Calendar; **scorecard** notes per
  candidate (Notes), linked back to the pipeline.
- **Cadence** — the hiring steps as Tasks.

As this deepens it pre-stages the planned apps: **form-designer** application
forms, **mailbox** candidate comms, **agent** screening, **automations**
stage-change triggers.

### Now also — the second hire (a research editor)

With Marcus owning the brand surface, the team's bottleneck shifts to *output*:
the newsletter and advisory research are still all Mira. So Northbound makes its
second hire — **Priya Nair**, a Research Analyst / Editor — to scale the content
engine. Like the designer hire, the funnel is solo founder work in Mira's vault
(no sync), and Priya's own research/editorial work then exercises the product's
knowledge core:

- **Role brief** — a "Hiring — Research Editor" doc (Notes).
- **Candidates pipeline** — Priya's row moves Applied → … → Hired in the same
  **Candidates** board; her craft trial is a cited research brief.
- **Output, once hired** — issues and briefs (Notes) that **cite sources and
  embed the live pipeline/metrics**, a reading list (Bookmarks), a literature map
  (Graph), the editorial calendar (Database). This is where transclusion,
  cross-links, and search get pushed hard.

Pre-stages: **books** (research library), **agent** (research synthesis),
**web-browser** (source capture), **mailbox** (issue distribution).

### Now also — team collaboration (Collab-C4-live)

The one part of hiring that *isn't* solo: once an offer's accepted, the hired
designer becomes a **second persona on a second paired vault** over the sync
relay — real-time collaboration, sharing, permissions. Sync (G2) and the
multi-user share spine (Collab-C1–C4) have landed, so this is now **live** via
the two-shell collab harness:

```sh
bun run dogfood:collab                                   # all collab sessions
bun run dogfood:collab -- -g "001"                       # one by name
```

`startCollabTeam()` (`tests/dogfood/lib/collab-team.ts`) boots a relay + one
shell **per teammate** — each with its own user-data dir under
`tests/dogfood/.data-collab/`, so a distinct sovereign identity — and drives the
C1/C2 share flow over the dev `dev:collab:*` bridge (gated on
`BRAINSTORM_COLLAB_DEBUG=1`, dev-only). A teammate mints a self-signed invite,
the owner grants + HPKE-wraps the entity DEK + emits, the teammate decrypts and
co-edits, the owner revokes — all through the encrypted wire path, with the
relay seeing ciphertext throughout. Session `collab-001-mira-marcus-share` is
the reference: Mira shares the Q3 operating-hub brief with Marcus, both edit to
convergence, Mira revokes when he rolls off.

> **What's exercised now vs. gated.** The wire path, presence, member-wrap join,
> and revocation are real today. The in-*product* "invite a teammate / share
> this entity" UX is **Collab-C5** (share dialog, member list, presence) and is
> not built — the harness drives the share through the dev bridge, so a session
> that wants that surface should file it as friction. Comments + suggestion mode
> aren't built either.

## How a session runs

1. A session is a thin spec under `tests/dogfood/sessions/NNN-<slug>.spec.ts`.
   It encodes **what Mira sets out to do that day** — not a test assertion.
2. `startSession()` (`tests/dogfood/lib/founder.ts`) boots the production build
   against Mira's **persistent** vault (`tests/dogfood/.data`, gitignored) and
   captures screenshots + renderer console + audit log into
   `tests/dogfood/.sessions/<name>/`.
3. After the run, the captures are read back and every bug / awkward
   interaction / missing capability Mira hit is distilled into
   [`friction-log.md`](friction-log.md).
4. The founder loop is **autonomous**: sessions run, then a report is surfaced
   with the new friction + proposed tasks/fixes for approval *before* anything
   touches the implementation plan or code.

```sh
bun run dogfood:build          # production build (shell + apps)
bun run dogfood                # run all founder sessions
bun run dogfood -- -g "001"    # run one session by name
```

## The team chat (watch them work, live)

The three founder-side personas and **Kai** (the Brainstorm engineer = the build
workflow) talk in one live channel as they work, so the whole collaboration is
legible in real time — Mira hands work off, Priya picks it up, Marcus flags a
design snag, Kai answers with a fix and a commit.

It's a plain append-only file, **not** the vault, on purpose: a file has no
SQLite lock, so you can follow it *while sessions are running* without contending
for Mira's vault.

```sh
bun run dogfood:watch          # tail the live transcript (creates it if absent)
bun run dogfood:chat Kai "…"   # post as Kai (or Mira / Marcus / Priya) by hand
```

Under the hood: founder sessions post via `s.chat(SPEAKER.X, "…")` (see
`tests/dogfood/lib/team-chat.ts`); the developer posts via `dogfood:chat`. The
transcript lives at `tests/dogfood/.sessions/team-chat.md` (gitignored,
ephemeral — the durable record is still `friction-log.md` and the war room).

### July 2026 goal — move the team chat *into* the product *(in progress)*

Today's `tail -f` team chat is a watch-along trick: a plain file *outside* the
vault, the personas visually indistinguishable inside the workspace, the
conversation never touching the shipped app the way Northbound actually would.
The goal for **July 2026** is to make the collaboration *real work inside the
collaborative vault*, legible in the product itself. Status of the three parts:

1. **A first-party Chat app** (`apps/chat`) — ✅ **built (2026-06-20).** Channels
   are an app-owned `io.brainstorm.chat/Channel/v1`; messages reuse the shared
   `brainstorm/Message/v1` substrate with the sender carried as the
   `participant{personRef}` variant of `MessageSender` (the union member reserved
   for this surface; see the Agent app's "messaging-compatible foundation" note
   in the plan). A channel sidebar, author-grouped transcript with avatars +
   day dividers, an Enter-to-send composer, a members roster, and an editable
   display-name identity — all reactive through `@brainstorm/react-yjs`
   `useVaultEntities`, persisted as vault entities. (Channels are a dedicated
   type rather than `Conversation/v1` so they never collide with the Agent app's
   conversation opener.) +30 unit/jsdom tests. Registered in `first-party.ts`.
2. **A distinct theme per employee** — ✅ **wired (2026-06-20).** `CollabPersona`
   grows an optional `theme`, set on the shell at launch via the dashboard
   `setTheme` bridge; `NORTHBOUND_THEMES` in `collab-team.ts` is the default
   mapping (Mira → `nord`, Marcus → `rose`, Priya → `sepia`, Dana → `forest`,
   Sol → `high-contrast`, Kai → `midnight`). Any distinct assignment works.
3. **Drive it through the harness** — ◑ **partial.** A single-vault founder
   session (`sessions/313-chat-northbound.spec.ts`) exercises the real app end to
   end (create channel → post → members → persistence). The **cross-shell synced**
   version — each persona's shell posting into a *shared* channel that converges
   in every vault — is the remaining rung: it needs **in-product channel sharing
   (Collab-C5**, the share-this-entity UX), since today's collab dev bridge shares
   one entity at a time, not an app's growing message set. The themed shells +
   the app are ready for it.

**Why this is feasible now and not blocked on the full v2 Chats GA:** the
building blocks have all landed — the collab sync spine (`10.0`–`10.9`),
`Message/v1` as a first-class reactive entity with the `participant` sender
reserved, the 12 built-in themes, and the two-shell collab harness. The
*dogfood-scoped* slice (one shared Northbound vault, a known set of personas)
does **not** need the v2 org/consumer-account machinery that gates the public,
arbitrary-multi-user Chats app — that distinction is the scope line. This goal
pulls a contained, internal-dogfood slice of Chats forward; the general Chats
surface stays v2 (see the plan's `Chats (v2)` note). **Remaining:** real-shell
verify of 312 (`dogfood:build` then `dogfood -- 313-chat`) + the Collab-C5
cross-shell share rung.

## Looking inside Mira's vault yourself

Her workspace is a real, persistent vault on disk at `tests/dogfood/.data`. To
open it in a normal focused window and see exactly what she's been doing:

```sh
bun run dogfood:open           # opens the Northbound vault in the shipped shell
```

It launches the same build the harness drives, pointed at the same vault, with
the same insecure-dev credentials (so it decrypts). **Don't run a session
(`bun run dogfood`) while this window is open** — two processes opening the same
SQLite vault would contend. Open to look; close before running a session (or run
the session first, then open).

## How feedback reaches the build

The single channel is the git-tracked [`friction-log.md`](friction-log.md).
Entries are triaged by the developer role into the existing machinery:

- **Bug** → reproduce in the in-process pipeline / a perf spec, then fix.
- **Design problem** → a feedback memory + a plan note.
- **Missing capability** → a new `implementation-plan.md` iteration or an `OQ-N`.

The founder does not write the plan directly during a build; she files, the
developer triages. Status flows back into the log (`open` → `triaged` → `done`).

For feature-scale friction (anything that isn't an obvious bug), the two roles
**talk it through first** in the [war room](war-room.md) — the dev asks what
Mira actually needs, Mira answers from Northbound's reality, and they converge
on a scoped solution before any code is written. The thread ends in a
Resolution that points at the fix / plan iteration / OQ it became.

## What is gitignored

- `tests/dogfood/.data/` — Mira's persistent (encrypted) vault. Her real desk.
- `tests/dogfood/.sessions/` — per-session captures (screenshots, console).

The **friction log stays in git** — it is the durable, reviewable record.
