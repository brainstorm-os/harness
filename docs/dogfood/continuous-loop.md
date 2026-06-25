# Continuous dogfood loop — protocol

This is the per-turn playbook for the **self-paced `/loop`** that keeps Mira and
Marcus exercising the shipped app as it changes. One turn = one full cycle. Read
[`README.md`](README.md) for the personas and roles; this file is just the
mechanical loop.

**Serial, never parallel.** Mira and Marcus share one persistent SQLite vault
(`tests/dogfood/.data`). Two processes on it contend, and a hard kill mid-write
hangs the vault on next boot. Run exactly one session at a time, in the
foreground, to completion. Never background + `pkill`. Don't touch the user's
separate `bun run dev` shell.

## One turn

1. **Pick the persona.** Three founder-side personas (see `README.md`): **Mira**
   (operator, breadth — the default), **Marcus** (design review), **Priya**
   (research editor — knowledge-layer rigor). Mira-heavy with the two specialists
   rotated in: look at the last few `tests/dogfood/sessions/` specs — if **2+
   consecutive were Mira**, this turn is a **specialist**; pick whichever of
   Marcus / Priya ran *least recently* (so they alternate). Then back to Mira.

2. **Decide the build.** `git log` / `git status` since the last session: if
   `packages/shell/**` or `apps/**` source changed, do a real build
   (`bun run dogfood:build`). Otherwise run with
   `BRAINSTORM_DOGFOOD_SKIP_BUILD=1` to reuse disk bundles.

2b. **Open the channel.** Make the turn legible in the live team chat (see
   `README.md` → "The team chat"). The acting persona posts what they're setting
   out to do (`s.chat(SPEAKER.X, "…")` inside the spec, in their voice); the more
   natural and conversational, the better the watch-along. Hand-offs between
   personas ("Priya, can you take Issue #3?") are encouraged.

3. **Author the session.** New thin spec `tests/dogfood/sessions/NNN-<slug>.spec.ts`
   (next number after the highest on disk). It encodes *what the persona sets out
   to do today*, per the growth-arc in `README.md` (Mira: build/compose real
   artifacts across app seams; Marcus: scrutinize one app's design and file
   specific, substantiated friction; Priya: build a *cited* deliverable or run a
   knowledge-integrity audit — references, cross-links, transclusion/embeds,
   search, the graph). Prefer continuing/extending real work over one-off pokes.

4. **Run it serially in the foreground:**
   `BRAINSTORM_DOGFOOD_SKIP_BUILD=1 bun run dogfood -- -g "NNN"` (drop the env
   var when step 2 said rebuild — but `dogfood:build` first, then run with skip).

5. **Read the captures** in `tests/dogfood/.sessions/<name>/` — screenshots,
   renderer console, audit log. Distill every bug / awkward interaction /
   missing capability into [`friction-log.md`](friction-log.md) (next `F-NNN`,
   `status: open`).

6. **Developer pass (full cycle).** Triage the new friction:
   - **Bug** → reproduce in the in-process pipeline / a perf spec (watch it fail
     first), fix, verify, flip the log entry to `done`.
   - **Design problem** → feedback memory + plan note; log `triaged`.
   - **Missing capability** → a plan iteration or `OQ-N`; log `triaged`.
   Keep fixes scoped to what the session surfaced. If a fix needs a design fork
   the docs don't already position, leave it `triaged` and surface it instead of
   guessing.

6b. **Kai answers in the chat.** As the developer, post the outcome to the team
   chat as Kai (`bun run dogfood:chat Kai "…"`) — acknowledge the friction, name
   the fix/commit or why it's deferred. This closes the loop conversationally so
   the watcher sees friction → fix, not just a one-way log.

7. **Commit from an ISOLATED git worktree, never the shared main tree.** A git
   working tree holds exactly one checked-out branch, and **other agents share
   `/Users/admin/home/brainstorm`**. If you `git checkout -b` and work directly
   in that shared tree, a concurrent agent's `git checkout` can move HEAD out
   from under you *between your branch-create and your commit* — your commit then
   lands on **their** branch, and the branch name you push stays empty. (This
   bit session 196: the fix commit stacked onto an unrelated in-flight refactor;
   the integrator had to cherry-pick it out by hand.) So each turn:
   - Create a throwaway worktree off the current remote tip — e.g.
     `git worktree add -b dogfood-NNN /tmp/bs-dogfood-NNN origin/main` (or use the
     Agent tool's `isolation: "worktree"`). Do **all** of step 7's git work there.
   - Commit the new spec + friction-log update + any fix as **one commit per
     turn**, message `dogfood(NNN): <what the session did / fixed>`.
   - Push that branch and (as the designated integrator) fast-forward it onto
     `origin/main` via `git push origin dogfood-NNN:main` — which updates `main`
     without ever checking it out in a shared tree. Never commit straight to a
     `main` that's checked out somewhere.
   - Remove the worktree + delete the local throwaway branch when done.
   The dogfood **session run itself** (step 4) still uses the persistent vault in
   the main checkout — only the *git* mutations move to the isolated worktree.

## When to pause the loop vs continue

- **Continue** when there's no blocker, or the last blocker was just fixed +
  verified — drive the next turn, don't stop to ask.
- **Pause** (stop the loop, surface to the user) only for: a genuine confirmed
  blocker (vault won't boot, build broken and not trivially fixable), a
  confirmed security/budget finding, or a design fork the docs don't position.

## Vault hygiene

Mira's vault (`tests/dogfood/.data`) is **persistent** and accumulates whatever
sessions write. Two rules:

- **Always author a new session number** — never re-run an old data-creating
  session. Re-running one appends its data again (e.g. session 008 typing "Call
  the printer about the proofs" 5× across historical re-runs shows as 5 duplicate
  Today tasks — that's accumulation, not a product bug).
- **Don't hand-edit the vault** to "clean up" cruft. It's Mira's real desk; if
  duplicate/stale data is genuinely confusing *her*, that's product friction to
  file, not DB surgery to perform.

## Writing into rich-text editors

Raw Playwright `keyboard.type` into a Lexical/Yjs editor (Notes, Journal) races
the CRDT binding and only the first character lands — a **harness artifact, not
product friction**. Write through the app's dev hook instead:
`window.__brainstormNotesDev` (notes: `appendParagraph` / `runBlockCommand` /
`insertTransclusion`) and `window.__brainstormJournalDev.appendParagraph` via
`page.evaluate`. Plain text inputs (Tasks compose, search) take keystrokes fine.

**`@`-mention insertion: type only the pre-space token, then pick.** The mention
typeahead filters on the text after `@` up to the first whitespace — typing a
full multi-word title (`@Issue #1`) closes the dropdown at the space and leaves
plain text (session 135). Type `@Issue`, wait, then `Enter`/arrow-select the
intended row. A single-word query (`@Research`) inserts cleanly.

**Property-cell popovers (Database status/select pills) are flaky to drive from a
synthetic click** — opening a record's inspector and picking an option resolved
inconsistently across runs (session 125). Don't build a turn around asserting a
scripted property-value change.

**Never compute a friction VERDICT inside the spec.** A spec's `s.chat()` lines
must be intent + neutral progress only (e.g. "reviewing X", "pulling notes from
the captures"). Raw selector counts lie — a zero `.foo` match usually means the
selector missed, not that the thing is absent (a "missing favicon" that was just
a fallback element; a "1 rows" that was the wrong cell). Decide the actual
verdict in step 5/6 AFTER viewing the screenshots, and post the persona's finding
then via `dogfood:chat`. This stops false friction reaching the transcript.

## Pacing

Self-paced. Each turn runs to completion (build + session + triage + fix +
commit), then schedules the next. No fixed interval — the work paces itself.
