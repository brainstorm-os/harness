# Northbound war room

A two-way working channel between the **founder** (Mira) and the **developer**
role. The [friction log](friction-log.md) is one-way (Mira files, dev triages);
this is where the two *talk* — the dev asks what Mira actually needs, Mira
answers from Northbound's reality, and they converge on a scoped solution
before code gets written. Feature-scale friction (anything that isn't an
obvious bug) should get a thread here first.

**How it reads:** newest threads on top; within a thread, oldest message first.
Each message is attributed **Mira:** or **Dev:**. A thread ends in a
**Resolution** line that points at the fix, plan iteration, or OQ it became.

> The user IS the founder — if Mira's answers below don't match what you
> actually want, edit her lines (or just say so) and the dev side will re-scope.

---

## Thread: F-008 — a CRM / custom collection for Northbound

**Dev:** This is feature-scale, so before I build anything I want to understand
what "CRM" means for *you*, not Salesforce. Four questions:
1. What are your must-have columns?
2. Is a "client" genuinely its own kind of thing, or would tagging existing
   Notes (a saved view over `#client` notes) be enough?
3. Roughly how many clients in year one — tens, hundreds?
4. Do you need each client linked to its notes and deliverables, or is a flat
   table fine?

**Mira:** Good questions.
1. Company, Contact person, Status (Lead / Active / Past), Deal size, Last
   contact (date), Next step.
2. It's its own thing. A client is not a note — I don't want my CRM rows
   bleeding into my Notes list, and I want to add a client without writing a
   document. (This is the same instinct behind F-005/F-008 — "New list" only
   filters existing types; I need to *define a new type*.)
3. Tens this year — call it ~50. Small, but real.
4. Linked. Each client should open to its own page and link to the research
   notes and deliverables for that account. That linking is half the point of
   keeping it in Brainstorm instead of a spreadsheet.

**Dev:** That scopes cleanly. The smallest thing that satisfies it is
**user-defined Collections**: a new object type with custom properties, sitting
alongside today's "New list" (which stays a *view* over existing types). Phase
it so you get value fast:
- **Phase 1 (build first):** "New collection" → name it, define columns of type
  *text / select(colored) / number / date / relation*, a grid to edit rows, and
  a per-row detail page. That covers all six of your columns (Status = colored
  select, Deal size = number, Last contact = date, links = relation).
- **Defer:** formulas, rollups, multiple views per collection, import.

Does text/select/number/date/relation cover your must-haves, or is anything
missing?

**Mira:** That covers it. Three notes: Status must be a *colored* select (I read
the pipeline by colour at a glance), Deal size should format as currency, and
the relation needs to point both ways — from the client to its notes *and* show
up on the note. If Phase 1 nails those, I can run the whole pipeline.

**Dev:** Agreed. Currency = a number column with a format option (Phase 1).
Bidirectional relation is the one real lift; I'll confirm the entity model
supports back-references before committing the estimate, but it's in scope.

**Dev (update — after digging through the data model):** Course-correction, and
it's mostly good news. Most of what you asked for **already exists**, it's just
hidden:
- **Custom columns**: already shipped (plan 9.3.5.U.b, 2026-05-28). A list's
  View settings → "Add column…" → "Create new property" lets you define a new
  column of type text / **colored select** / **currency number** / date — the
  same property constructor Settings uses. You never found it because it's
  buried in View settings, and the column-types you wanted (colored Status,
  currency Deal-size, date Last-contact) are all already supported.
- **A custom collection that's its own thing**: also already shipped (plan
  9.3.5.V, 2026-05-31) — user lists persist as real `brainstorm/List/v1`
  entities. The reason it *felt* impossible is the create dialog is titled
  "New list — choose what to show", which reads as "filter existing types",
  not "make a new collection".

So two of the three are **discoverability fixes**, not builds. But the third is
a real gap I won't paper over: **adding a brand-new *Client row*.** Today "+ New"
(`app.ts:1934`) only works on a list whose source is a concrete type — it
creates one of *that* type. A custom collection has no type, so "+ New" just
says "open a typed list to create an object here." And the underlying model
(single object space) expects a collection to *overlay extra columns onto
existing objects* — which fights your "a client is **not** a note, and I don't
want clients bleeding into my Notes list."

**Mira:** Right — overlaying columns onto notes is not what I want. A client is
its own thing. I add a client, I don't write a document that happens to be a
client.

**Dev:** Then we need a position on what a "blank client" *is* at the data level
— there's no user-defined type primitive, so the options are (a) introduce one
generic "Object/Item" type that custom collections instantiate, (b) build true
user-defined types, or (c) accept the overlay model and make *that* obvious.
This has lasting data-model consequences (OQ-DM territory), so it goes to the
founder/owner to decide before I build. Parked here pending that call.

**Resolution (revised):** F-008 splits →
- **F-008a (discoverability, buildable now):** surface "create your own
  collection + columns" — rename/reframe the "New list" entry, and lift the
  custom-column creator out of View settings into the collection-creation flow.
  No data-model change. *Safe to build.*
- **F-008b (needs an owner decision + likely an OQ):** what a new row in a
  user-defined collection *is* — generic Object type vs true user-types vs
  overlay model. **Blocked on the founder/owner's call** (see the question put
  to them 2026-06-02). Bidirectional relations stay Phase 2 regardless.

**Owner decision (2026-06-02): generic `Object` type.** A new row in a
user-defined collection is a `brainstorm/Object/v1` — a blank object that
carries only its collection's columns, is its own thing, and never appears in
Notes/Tasks lists. True user-defined types deferred; bidirectional relations
stay Phase 2. **Build slices:** (1) declare `brainstorm/Object/v1` + caps and
make "+ New" create one in a non-typed collection, adding it to the collection's
members; (2) a "Blank collection" creation path; (3) F-008a discoverability of
the custom-column creator. *Needs a formal OQ-DM entry + plan iteration once the
in-flight plan edits settle.*

---

## Thread: F-002 — default cover on a blank note

**Mira:** Every brand-new note opens with a big gold banner across the top
before I've written a word. On an empty page it dominates — it feels like the
note is shouting before it has anything to say.

**Dev:** Heads-up that this is *intentional*, not a bug: the cover renderer
deliberately gives every cover-less object an id-seeded gradient (a per-object
visual identity, like a generated avatar), and there's an explicit "none" mode
for no band at all. So this is a taste call, not a defect — which is why I'm
bringing it here instead of just ripping it out. Options:
- **(a) keep** the seeded gradient (every object gets visual identity);
- **(b) make it subtler** — shorter band on an empty note, full height once
  there's a cover or content;
- **(c) opt-out default** — no band until you add a cover (closest to Mira's
  ask; consistent with the "no default type-icon" rule already in the codebase).

**Mira:** I lean (c) — a clean page until I choose a cover. But (b) I could live
with if the band were ~half the height when empty.

**Resolution (2026-06-03):** owner picked **(c)** — no band until a cover is
added, closest to Mira's ask and consistent with the "no default type-icon"
rule. Shipped in session 053: the Notes editor shows the cover band only when
`properties.cover` is set; a coverless note shows a quiet "+ Add cover"
affordance (opens the picker). The id-seeded gradient still backs every
reserved-space surface (gallery cards, list, search, dashboard pins) per
`50-object-covers.md §56` (layout owns whether a context shows the band), so
the covers-everywhere invariant is untouched. Closed — see F-002 in the
friction log.

## Thread: F-043 — discoverability of a task row's set-priority/date/project affordances

**Marcus (filed):** At rest a task row is a checkbox + title. The priority / date / project affordances are hidden until you hover that exact row — a cold first-time user never learns they exist. Show a quiet always-on affordance (a faint "+ set" or a persistent chip rail), or at least reveal on row *focus*. Hover-to-exist is a power-user shortcut masquerading as the primary UI.

**Dev:** Two parts here, and they split cleanly:
1. **Keyboard path — already covered.** The empty affordances reveal on `.task-row:focus-within` and `:focus-visible`, not only `:hover` (`apps/tasks/src/styles.css` ~L795). So tabbing into a row already surfaces them; the "keyboard users get nothing" half is addressed.
2. **Cold discoverability — a real, deliberate tradeoff.** The empty stubs are `display: none` (not `opacity: 0`) *on purpose* — a documented decision (same CSS block) so an unset field reserves **no** width and doesn't leave a phantom gap before the populated chips. Making them always-visible (even faint) reverses that: every unset row would carry up to three dim stubs ("Set priority", "Schedule", "Inbox"), which is exactly the resting-row noise Notion/Things avoid and which the team chose against. That's a taste call with a real cost on the other side, so it's the owner's to make — not a unilateral CSS flip.

Options for the owner:
- **(a) keep hidden** — accept that set-on-hover/focus is the model; rely on the empty-state + onboarding to teach it once.
- **(b) faint always-on rail** — show the empty affordances at low opacity always (Marcus's ask); cleaner discoverability, busier resting list, reintroduces the reserved width.
- **(c) single always-on entry** — one quiet "+" per row that expands to the chip rail on click/focus; discoverable without three permanent stubs, but adds a click for power users.

**Mira/owner:** _(pending — which of a/b/c, or a variant?)_

**Resolution:** _(pending owner call; no code until then. The keyboard-reveal half is already in place.)_

<!-- New threads land above this line, newest first. -->
