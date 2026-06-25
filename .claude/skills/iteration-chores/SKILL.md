---
name: iteration-chores
description: Run the standard wrap-up after each iteration of docs/implementation-plan.md — code review, design review, security review (defensive), pentest (adversarial), performance review, memory-leak review, error-log triage, then commit and push. Trigger when the user says "/iteration-chores", "/chores", "wrap up the iteration", "run chores", "ship it", or otherwise signals an iteration is done and should be shipped.
---

# Iteration Chores

Wrap-up sequence for a completed iteration of `docs/implementation-plan.md`. Drive the steps below **in order**. Between each step, surface findings to the user — they redirect, you don't auto-fix without explicit go-ahead. Hard-stop on must-fix findings until the user acknowledges them.

## Preconditions

1. There are changes in the working tree (`git status`). If clean, ask whether the iteration was already committed before continuing.
2. `docs/implementation-plan.md` and `docs/implementation-plan-table.md` are already updated for this iteration (row ✓ DONE, status snapshot refreshed, OQs resolved). If not, do that first — it is a workflow rule (CLAUDE.md → "Keep plan current").

## 1. Code review

Invoke the `/review` skill via the Skill tool. Triage the result:
- **Critical / important** — stop and surface to the user.
- **Nits only / clean** — continue.

## 2. Design review

Spawn an agent (subagent_type=`general-purpose`) with this prompt:

> Design/UX review of the changes on the current branch for the Brainstorm project. Read `CLAUDE.md` and `docs/foundations/35-code-conventions.md` first. Check each user-facing change against the project's rules — every user-visible string wraps in `t(key)`; keyboard via the shortcut registry, not raw `e.key`; shared `<Popover>` primitive for dialogs; panel headers 44px with 1px subtle bottom border; macOS header padding reserves 86px on the left for traffic lights; panels open via `transform`, not width/grid; icons via the shared `Icon`, no emoji-as-icons; buttons with `iconLeft` don't double-glyph the label; `font-size` uses token vars, not raw px; long strings clipped at render; focus outline replaces border (no sandwich). Also verify the PR-level requirements: screenshot, keyboard path, screen-reader path, discoverability path. Report under 300 words: must-fix / nice-to-fix / OK.

Surface findings. Stop on must-fix.

## 3. Security review (defensive)

Invoke the `/security-review` skill via the Skill tool. CLAUDE.md mandates this per-PR — new capability surface, new IPC method, or new dependency triggers extra scrutiny. Surface findings. Stop on critical issues.

## 4. Pentest (adversarial)

Invoke the `pentester` skill via the Skill tool — the red-team complement to step 3 (it tries to *break* the new attack surface rather than read it for safety). Surface findings. Stop on any must-fix (exploitable) finding.

## 5. Performance review

Invoke the `performance-review` skill via the Skill tool. It checks the pending diff against the documented budgets (startup / IPC RTT / search latency / dashboard render / bundle size) and the known perf traps, and runs `bun run size`. Surface findings. Stop on budget regressions unless the user explicitly accepts them.

## 6. Memory-leak review

Invoke the `memory-leak-review` skill via the Skill tool. It audits the diff for unreleased listeners/observers/timers, Yjs refcounts, Pixi GPU objects, SQLite statements, and unzeroed secrets. Surface findings. Stop on any must-fix leak.

## 7. Triage error log

Invoke the `triage-error-log` skill via the Skill tool. It dumps the
runtime error log (`bun run logs`), root-causes each distinct
renderer/app/main error, fixes it with a regression test, and only then
clears the log. Surface findings. Stop on anything that can't be
root-caused — don't guess-patch or clear a still-failing log.

## 8. Commit

Once all reviews are clean (or the user has signed off on remaining items):

1. `git status` and `git diff --stat` — confirm scope is just this iteration.
2. Draft a commit message in the project's existing style (see `git log --oneline -10`): single-line title under ~70 chars, present-tense, naming the iteration if applicable (e.g. `Land 9.14–9.20 app scaffolds + 9.13.1.10 Pixi`). Optional body for the *why* and any OQ resolutions.
3. Show the user the message + the file list and ask for go-ahead. Even with chores authorized in advance, the commit message itself is worth a glance.
4. On approval, commit with the project's `Co-Authored-By` trailer (HEREDOC form per the global Bash rules).

## 8. Push

Push affects shared state, so always confirm with the user before pushing — the authorization to "run chores" is not blanket authorization to push every time.

1. Ask: "Push to `origin/<branch>`?"
2. On approval, `git push`.
3. Report result and any remote-side hook output.

## Reporting

End-of-turn summary: which reviews passed, which had findings, whether commit + push happened. One or two sentences, per CLAUDE.md tone rules.
