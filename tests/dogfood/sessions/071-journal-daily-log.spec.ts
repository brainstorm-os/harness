/**
 * Session 071 — Mira writes today's daily log in Journal.
 *
 * The last cadence piece of the core operating area: a daily log. She jumps to
 * today, starts the entry, and writes a short end-of-day log — what shipped,
 * what's next. This is the FIRST dogfood of writing into the Journal day
 * editor: it needed a keystroke-safe path (raw keystrokes corrupt the Yjs-bound
 * editor in headless Electron), so this session also exercises the new
 * window.__brainstormJournalDev hook (the Journal mirror of __brainstormNotesDev,
 * built on the shared @brainstorm/editor dev primitives).
 *
 * An empty day shows a placeholder with no live editor until the entry is
 * minted; picking an icon mints it keystroke-free (the journal's own "start the
 * day" affordance), after which the live editor mounts and the hook installs.
 * Idempotent: if today's log is already written, it's left alone.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type JournalDev = {
	appendParagraph: (text: string) => Promise<void>;
	currentEntryId: () => string | null;
};

const SENTINEL = "Shipped the editorial pipeline";
const LOG_LINES = [
	"Shipped the editorial pipeline — Content Calendar now carries publish dates + status lanes (Published / Scheduled / Drafting).",
	"Set up the file workspace (Research / Drafts / Brand / Clients) and put this period's drafts on the task list.",
	"Tomorrow: draft Issue #1 ahead of Monday's send; nudge Vertex Labs on the intro call.",
];

test("write today's daily log in Journal", async () => {
	test.setTimeout(180_000);
	const s = await startSession("071-journal-daily-log");
	try {
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1500);

		// Jump to today.
		await journal.locator(".bs-date-pager__today").first().click();
		await journal.waitForTimeout(800);
		await s.shot(journal, "01-today");

		// An empty today shows a write placeholder, not a live editor. Mint the
		// entry keystroke-free by picking an icon (the journal's "start the day"
		// affordance), which mounts the live editor + installs the dev hook.
		if ((await journal.locator(".journal__entry-editor").count()) === 0) {
			await journal.locator(".bs-icon-pick").first().click();
			await journal.waitForTimeout(400);
			await journal.locator(".icon-picker__cell").first().click();
			await journal.waitForTimeout(900);
			s.note("minted today's entry via icon-pick");
		}

		await expect(journal.locator(".journal__entry-editor").first()).toBeVisible();
		await journal.waitForFunction(
			() =>
				Boolean((window as unknown as { __brainstormJournalDev?: unknown }).__brainstormJournalDev),
			undefined,
			{ timeout: 15_000 },
		);

		const already = (
			(await journal.locator(".journal__entry-editor").first().innerText()) ?? ""
		).includes(SENTINEL);
		if (already) {
			s.note("today's log already written — skipping");
		} else {
			const entryId = await journal.evaluate(async (lines) => {
				const dev = (window as unknown as { __brainstormJournalDev?: JournalDev })
					.__brainstormJournalDev;
				if (!dev) return null;
				for (const line of lines) await dev.appendParagraph(line);
				return dev.currentEntryId();
			}, LOG_LINES);
			s.note(`wrote ${LOG_LINES.length} log lines into entry ${entryId}`);
		}
		await journal.waitForTimeout(500);
		await s.shot(journal, "02-logged");

		const body = (await journal.locator(".journal__entry-editor").first().innerText()) ?? "";
		s.note(`journal body length: ${body.length}`);

		for (const line of LOG_LINES) {
			const stub = line.slice(0, 28);
			expect(body.includes(stub), `log line present: "${stub}…"`).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
