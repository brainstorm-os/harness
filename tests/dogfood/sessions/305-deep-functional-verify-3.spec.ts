/**
 * Session 305 — deep functional verification (round 3), real Electron.
 * Continues the live-CRUD pass. Credential-free.
 *
 * Targets:
 *  - Database: "+ New" (the grid foot row) creates a real entity row.
 *  - Notes: a new note's body accepts programmatic text via the sanctioned
 *    `window.__brainstormNotesDev.appendParagraph` dev hook (Yjs/Lexical bodies
 *    can't take raw Playwright keystrokes — see continuous-loop.md). This is the
 *    working control for the journal blank-body issue (F-251).
 *
 * Records only FACTUAL captures (counts, body text); verdicts decided in triage.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const DATA_ROW = ".dbv-grid__row:not(.dbv-grid__row--head):not(.dbv-grid__row--foot)";

async function appendParagraph(page: Page, text: string): Promise<string> {
	return page
		.evaluate(async (t) => {
			const dev = (
				window as unknown as { __brainstormNotesDev?: { appendParagraph(s: string): Promise<void> } }
			).__brainstormNotesDev;
			if (!dev) return "(no dev hook)";
			await dev.appendParagraph(t);
			return "ok";
		}, text)
		.catch((e) => `(threw: ${(e as Error).message})`);
}

test("deep functional verify round 3 (305)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("305-deep-verify-3");
	try {
		// ── Database: "+ New" foot row creates a data row ────────────────────
		try {
			const page = await s.openApp(APP.Database);
			await page.waitForTimeout(2600);
			s.note("\n### database — + New row (CRUD)");
			const before = await page
				.locator(DATA_ROW)
				.count()
				.catch(() => -1);
			s.note(`data rows before: ${before}`);
			// "+ New" is the view-toolbar button (#toolbar-new), NOT the grid
			// foot row (that's the aggregation summary). Clicking it starts the
			// create→type→Enter keyboard handoff (F-215).
			await page
				.locator("#toolbar-new")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(700);
			await page.keyboard.type("Dogfood db row — 305").catch(() => undefined);
			await page.keyboard.press("Enter").catch(() => undefined);
			await page.waitForTimeout(1200);
			const after = await page
				.locator(DATA_ROW)
				.count()
				.catch(() => -1);
			s.note(`data rows after: ${after}`);
			await s.shot(page, "db-01-after-new-row");
		} catch (err) {
			s.note(`[database] step failed: ${(err as Error).message}`);
		}

		// ── Notes: new note body accepts dev-hook text (F-251 control) ───────
		try {
			const page = await s.openApp(APP.Notes);
			await page.waitForTimeout(2400);
			s.note("\n### notes — new note body edit (F-251 control)");
			await page
				.locator('.app-header button[aria-label*="new note" i]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1500);
			const marker = "Dogfood persist check 305";
			const appended = await appendParagraph(page, marker);
			s.note(`appendParagraph result: ${appended}`);
			await page.waitForTimeout(900);
			const bodyHasMarker = await page
				.locator(".editor-shell, [contenteditable='true'], .notes__editor")
				.first()
				.innerText()
				.then((tx) => tx.includes(marker))
				.catch(() => false);
			s.note(`body contains marker: ${bodyHasMarker}`);
			await s.shot(page, "notes-01-after-append");
		} catch (err) {
			s.note(`[notes] step failed: ${(err as Error).message}`);
		}
	} finally {
		await s.finish();
	}
});
