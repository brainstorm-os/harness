/**
 * Session 938 — the decisive F-488 gate for 0.13.0, on the REAL user path.
 *
 * Session 936 wrote through `__brainstormJournalDev.appendParagraph`, which
 * injects straight into the captured Lexical editor. That bypasses
 * `EntryBody`'s `onFocus: () => void onPlaceholderCreate(focus)` (app.tsx:1856)
 * — the handler that starts the day's implicit `entities.create`. With no
 * create ever started, `entities.applyDoc` rejects "not found" forever and
 * shell #460's backoff can never succeed. That made 936 a probe artifact, not
 * evidence about users.
 *
 * A real user FOCUSES the editor (starting the async create) and types within
 * milliseconds — the create is still in flight, so the first persists reject.
 * That is precisely the race #460 heals by re-shipping full state on a backoff.
 *
 * This drives that: click into the editor on a day with no row, type
 * immediately with real keystrokes, wait out the backoff, then close the shell
 * and reopen the same vault cold.
 *
 * Records factual captures only.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const MARKER = "F488 real typing durability 938";
/** Far enough back to be a day the Northbound vault has no row for, and clear
 *  of the days sessions 936/937 touched. */
const DAYS_BACK = 12;

async function bodyText(page: Page): Promise<string> {
	return page
		.locator(".journal__entry-editor")
		.first()
		.innerText()
		.catch(() => "(no editor)");
}

async function pageBack(page: Page, days: number): Promise<void> {
	for (let i = 0; i < days; i += 1) {
		await page
			.locator(".journal__day-pager .bs-date-pager__arrow--prev")
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(120);
	}
}

test("journal survives real typing on a fresh day (938)", async () => {
	test.setTimeout(900_000);

	// ---- Launch 1: focus + type immediately, racing the implicit create.
	const a = await startSession("938-journal-real-typing-write");
	try {
		const page = await a.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		a.note("\n### launch 1 — real focus + keystrokes on a day with no row");

		await pageBack(page, DAYS_BACK);
		await page.waitForTimeout(600);
		a.note(`body before: ${JSON.stringify((await bodyText(page)).slice(0, 80))}`);
		await a.shot(page, "journal-01-fresh-day");

		// Click the contenteditable itself — this fires the onFocus that starts
		// `ensureEntry`. Then type with NO wait, so the keystrokes race the
		// create exactly as a fast user would.
		const editable = page.locator(".journal__entry-editor [contenteditable='true']").first();
		await editable.click({ timeout: 15_000 }).catch(async () => {
			await page.locator(".journal__entry-editor").first().click().catch(() => undefined);
		});
		await page.keyboard.type(MARKER, { delay: 12 });
		a.note("typed marker immediately after focus (no settle wait)");

		await page.waitForTimeout(1200);
		const afterType = await bodyText(page);
		a.note(`body after typing contains marker: ${afterType.includes(MARKER)}`);
		await a.shot(page, "journal-02-after-typing");

		// Outlast the full 250/500/1000/2000/4000ms healing schedule.
		await page.waitForTimeout(9000);
		a.note("waited out the full persist-retry backoff");
	} finally {
		await a.finish();
	}

	// ---- Launch 2: cold reopen — did it reach disk?
	const b = await startSession("938-journal-real-typing-verify");
	try {
		const page = await b.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		b.note("\n### launch 2 — cold reopen of the same vault");

		await pageBack(page, DAYS_BACK);
		await page.waitForTimeout(1400);
		const reopened = await bodyText(page);
		b.note(`body after restart: ${JSON.stringify(reopened.slice(0, 200))}`);
		b.note(`MARKER SURVIVED RESTART: ${reopened.includes(MARKER)}`);
		await b.shot(page, "journal-03-after-restart");
	} finally {
		await b.finish();
	}
});
