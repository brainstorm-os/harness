/**
 * Session 306 — journal body persistence on day-navigate (re-examines F-251),
 * real Electron. F-251 was "journal entry body renders BLANK on reopen"; its
 * triage said the fix was the journal's React migration — which has since
 * landed (journal is now app.tsx). This drives the exact repro to see whether
 * the body now survives navigating away and back.
 *
 * Writes the body via the sanctioned `__brainstormJournalDev.appendParagraph`
 * dev hook (Yjs/Lexical bodies can't take raw keystrokes — see
 * continuous-loop.md). Records only factual captures; verdict decided in triage.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function appendParagraph(page: Page, text: string): Promise<string> {
	return page
		.evaluate(async (t) => {
			const dev = (
				window as unknown as { __brainstormJournalDev?: { appendParagraph(s: string): Promise<void> } }
			).__brainstormJournalDev;
			if (!dev) return "(no dev hook)";
			await dev.appendParagraph(t);
			return "ok";
		}, text)
		.catch((e) => `(threw: ${(e as Error).message})`);
}

async function bodyText(page: Page): Promise<string> {
	return page
		.locator(".journal__entry-editor")
		.first()
		.innerText()
		.catch(() => "(no editor)");
}

test("journal persistence on day-navigate (306)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("306-journal-persistence");
	try {
		const page = await s.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		s.note("\n### journal — body persistence across day-navigate (F-251)");

		const marker = "Dogfood persist marker 306";
		const appended = await appendParagraph(page, marker);
		s.note(`appendParagraph: ${appended}`);
		await page.waitForTimeout(900);
		const afterWrite = await bodyText(page);
		s.note(`body after write contains marker: ${afterWrite.includes(marker)}`);
		await s.shot(page, "journal-01-after-write");

		// Navigate to the previous day, then back to today.
		await page
			.locator(".journal__day-pager .bs-date-pager__arrow--prev")
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(900);
		await s.shot(page, "journal-02-prev-day");
		await page
			.locator(".journal__day-pager .bs-date-pager__today")
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(1300);

		const afterReturn = await bodyText(page);
		s.note(`body after navigate-back contains marker: ${afterReturn.includes(marker)}`);
		s.note(`body after navigate-back length: ${afterReturn.trim().length}`);
		await s.shot(page, "journal-03-back-to-today");
	} finally {
		await s.finish();
	}
});
