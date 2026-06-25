---
name: triage-error-log
description: Read the runtime error log (renderer/app/main console errors captured by the shell), root-cause each distinct error, fix it, then clear the log so it stays a live signal. Trigger on "triage logs", "read the error log", "check runtime errors", "what's in the logs", or as a step in /iteration-chores.
---

# Triage error log

The shell captures every renderer / sandboxed-app / main-process `console`
error + crash to one file (`packages/shell/src/main/diagnostics/error-log.ts`),
written to `~/.brainstorm/logs/errors.log`. App + shell bundles build
non-minified, so the captured `source` is real `file:line`. This chore
turns that log into fixes instead of a paste-the-error ping-pong.

## Read first

- `packages/shell/src/main/diagnostics/error-log.ts` — what is captured,
  the NDJSON shape, rotation.
- `CLAUDE.md` → "Reproduce before you patch" — every log entry hittable in
  any vault must get a failing test before the fix.

## Method

1. **Dump it.** `bun run logs` (pretty) or `bun run logs --errors` (errors
   only). Empty / "no log yet" → say so and stop; nothing to triage.
2. **Group.** Collapse identical `scope`+`message`+`source` into one
   issue. A repeated line is one bug, not N. Note frequency.
3. **Rank.** `render-process-gone` / `uncaughtException` / a crash that
   blanks a surface first; recurring warnings next; one-off noise last.
4. **Root-cause each, in order.** Use the real `source` (file:line — it's
   readable now) to find the cause. Per CLAUDE.md, reproduce in the
   in-process pipeline or the relevant `*-service.test.ts` / app test and
   watch it fail **before** patching. Don't pattern-match the message.
5. **Fix + verify.** Land the fix with its regression test. Rebuild the
   affected app (`bun run --filter @brainstorm-app/<id> build`) or shell
   so the running build actually changes (see CLAUDE.md build-sha note).
6. **Surface.** Report per issue: scope, frequency, root cause, fix,
   test. Stop on anything you can't root-cause — don't guess-patch.
7. **Clear it.** Only after the fixes land and verify green:
   `bun run logs --clear`. The log must reflect *current* state — a stale
   entry that's actually fixed is worse than no entry. If some issues are
   deferred (with the user's ok), leave the log intact and say which
   entries remain on purpose.

## Hard rules

- Never `--clear` before the fixes are committed and verified.
- A warning that is expected/benign is not "fixed" by silencing the log —
  either fix the cause or change the code to not warn; justify in the
  report.
- New capability surface / IPC / dependency introduced by a fix still
  goes through `/security-review` (CLAUDE.md per-PR rule).
