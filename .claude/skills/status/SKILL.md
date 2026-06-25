---
name: status
description: Show a clear "what's done / what's next" status table for the Brainstorm implementation plan — beta gates, Phase 1 shell+infra remaining, and the Phase 2 app serial order. Trigger when the user says "/status", "where are we", "what's done", "what's next", "show progress", "status report", or otherwise asks for a project progress snapshot.
---

# Status

Produce a clear, scannable **done / next** snapshot of the Brainstorm implementation plan. This is read-only reporting — do not edit any plan files.

## Sources of truth (read in this order)

1. `docs/implementation-plan-table.md` — the at-a-glance companion. The **"Last updated"** line, the **Beta gates** table (G0→G4), the **"Next up" → Phase 1** table, and the **Phase 2 apps** table are the primary inputs.
2. `docs/implementation-plan.md` — authoritative for any pending/in-flight detail the table summarizes; consult only when the table is ambiguous.
3. `docs/implementation-log.md` — completed narrative + test counts; consult only if the user asks "what shipped recently".

These three move together every turn an iteration lands, so the table is normally current. If `git log -1` shows a feature commit newer than the table's "Last updated" date, note that the table may be one iteration behind.

## What to output

A short headline, two compact top-level tables, then **one separate table per app**:

1. **Headline** — one line: current stage, beta target date, and the single most-recent landed item (from the table's "Last updated").
2. **Beta gates (G0→G4)** — gate · state (✅/🟡) · what's left to exit. One compact table.
3. **Phase 1 — shell + infra** — item · status · what's left. One compact table. Drain-first work before any app slot opens.
4. **Apps — one table per app** — do **NOT** cram an app's remaining work into one cell, and do **NOT** stop at the apps that are already in progress. Cover **every app that has a `## <App>` section in `implementation-plan.md`** — that includes the not-yet-started ones (Theme-editor, Books, Contacts, Form-designer, Automations, Mailbox, Web Browser, Agent app, Connector framework) and the v2 apps (Community-board, Chats). An app being unbuilt (`⚪`) is not a reason to omit it — its whole ladder is "what's next" and the user wants to see it.

   Emit a short intro line for the serial order, then render **a separate `###` sub-section and table for each app**, one row per remaining task:

   - Heading per app: `### App — stage · status-emoji`. Prefix the active Phase-2 serial apps with their slot number and mark the one that's **next**; group the rest under sub-headers `#### Later apps (not yet started)` and `#### v2`.
   - Columns: **`ID` · `Task` · `Pri`** — one row per remaining iteration. `ID` = the iteration id (e.g. `9.14.7`, `B11.3`, `Mailbox-2`, `11b.4`). `Task` = a 3–8 word title. `Pri` = `🔴`/`🟢`/`⚪`/`◑` or a one-word gate (`gate 9.4`, `dep pdf.js`).
   - Pull the rows from that app's section in `implementation-plan.md` (the `⚪`/`🟡`/`◑` bullets — both the tracked iterations and any "Mission-gap backlog" block). Don't list the `✅` done bullets.
   - Keep each row to a single short line. List every remaining iteration — that's the point of splitting into per-app tables. Only collapse a long contiguous run of same-status bundled ids that the plan itself bundles into one bullet (e.g. `9.13.4–.14`) into a single row.
   - For the v2 apps that have no `## ` ladder of their own (Community-board, Chats appear only in the table file), emit a one-line note with their iteration range (`Community-1–8`, `Chats-1–7`) instead of a full table.
   - Skip an app's table only if it genuinely has nothing left, and say so in one line.

Keep the legend handy: ✅ done · 🟡 in flight · ◑ preview-drop only · ⚪ pending · ❌ rejected · 🔴 release-blocking · 🟢 GA-only (not beta-blocking).

## Style

- Terse, scannable rows — not paragraphs. This is the contents page, not the record.
- **One task per row.** Never pack multiple iterations into a single cell with `·` separators — that's the unreadable format this skill exists to avoid. Each remaining iteration is its own row in its app's table.
- Don't dump the table file's verbose "Last updated" paragraph; distill it to one sentence.
- If the user passes an argument (e.g. `/status notes`, `/status phase1`, `/status sync`), scope the report to that app/section/domain: emit just that app's per-task table (and go one level deeper using `implementation-plan.md`), skipping the gates/Phase-1 overview.
- End with a one-line pointer to what would be picked up next if work resumed now (top of Phase 1 if anything's left there, else the next Phase 2 app slot).
