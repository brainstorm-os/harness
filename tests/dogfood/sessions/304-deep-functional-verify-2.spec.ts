/**
 * Session 304 — deep functional verification (round 2), real Electron.
 * Continues the 303 deep-CRUD pass. Credential-free.
 *
 * Targets:
 *  - Calendar: create an event via the New-event dialog and check a `.cal-chip`
 *    renders in the view (re-examines the open F-258 "event created, chips=0").
 *  - Files: New → New folder and check a content row appears.
 *
 * Records only FACTUAL captures (counts, titles); the verdict is decided from
 * screenshots + notes in triage, never inside the spec.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep functional verify round 2 (304)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("304-deep-verify-2");
	try {
		// ── Calendar: New event → title → Save → chip renders? (F-258) ───────
		try {
			const page = await s.openApp(APP.Calendar);
			await page.waitForTimeout(2400);
			s.note("\n### calendar — create event (F-258)");
			const chipsBefore = await page
				.locator(".cal-chip")
				.count()
				.catch(() => -1);
			s.note(`cal-chip before: ${chipsBefore}`);
			await page
				.locator('.app-header button[aria-label*="new event" i]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(800);
			const title = page.locator(".cal-detail__input--title");
			const dialogOpen = await title.isVisible().catch(() => false);
			s.note(`event dialog open: ${dialogOpen}`);
			await title.fill("Dogfood verify event — 304").catch(() => undefined);
			await s.shot(page, "cal-01-dialog");
			// Footer primary button commits (save).
			await page
				.locator(".cal-detail__footer .bs-btn[data-bs-primary]")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1400);
			const chipsAfter = await page
				.locator(".cal-chip")
				.count()
				.catch(() => -1);
			s.note(`cal-chip after: ${chipsAfter}`);
			const titles = await page
				.locator(".cal-chip__title")
				.allInnerTexts()
				.then((xs) => xs.map((x) => x.trim()))
				.catch(() => []);
			s.note(`cal-chip titles: ${JSON.stringify(titles.slice(0, 12))}`);
			await s.shot(page, "cal-02-after-create");
		} catch (err) {
			s.note(`[calendar] step failed: ${(err as Error).message}`);
		}

		// ── Files: New → New folder → a content row appears ──────────────────
		try {
			const page = await s.openApp(APP.Files);
			await page.waitForTimeout(2400);
			s.note("\n### files — new folder (CRUD)");
			const rowsBefore = await page
				.locator(".content-row")
				.count()
				.catch(() => -1);
			s.note(`content rows before: ${rowsBefore}`);
			await page
				.locator('.app-header button[aria-label*="new" i]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(700);
			await s.shot(page, "files-01-new-menu");
			// Click the "New folder" row in the anchored menu (F-250).
			await page
				.locator(".fm-menu .fm-row", { hasText: /folder/i })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1200);
			const rowsAfter = await page
				.locator(".content-row")
				.count()
				.catch(() => -1);
			s.note(`content rows after: ${rowsAfter}`);
			await s.shot(page, "files-02-after-new-folder");
			await page.keyboard.press("Escape").catch(() => undefined);
		} catch (err) {
			s.note(`[files] step failed: ${(err as Error).message}`);
		}
	} finally {
		await s.finish();
	}
});
