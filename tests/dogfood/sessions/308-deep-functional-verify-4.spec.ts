/**
 * Session 308 — deep functional verification (round 4), real Electron.
 * Extends CRUD coverage to the last reliable untested creates. Credential-free.
 *
 * Targets:
 *  - Bookmarks: "Add bookmark" → URL → submit → a card appears (content capture
 *    may fail offline, but the bookmark still saves — F-243).
 *  - Contacts: "New contact" → name → submit → a contact row appears.
 *
 * Records only FACTUAL captures (counts); verdict decided in triage.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep functional verify round 4 (308)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("308-deep-verify-4");
	try {
		// ── Bookmarks: Add bookmark → URL → submit → card appears ────────────
		try {
			const page = await s.openApp(APP.Bookmarks);
			await page.waitForTimeout(2400);
			s.note("\n### bookmarks — add (CRUD)");
			const before = await page
				.locator(".bookmarks__card")
				.count()
				.catch(() => -1);
			s.note(`cards before: ${before}`);
			await page
				.locator('.app-header button[aria-label*="add bookmark" i]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(700);
			await page
				.locator(".bookmarks__form-input")
				.first()
				.fill("https://example.com")
				.catch(() => undefined);
			await s.shot(page, "bm-01-compose");
			// Submit is the non-secondary footer button.
			await page
				.locator(".bookmarks__form-footer .bs-btn:not(.bs-btn--secondary)")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1500);
			const after = await page
				.locator(".bookmarks__card")
				.count()
				.catch(() => -1);
			s.note(`cards after: ${after}`);
			await s.shot(page, "bm-02-after-add");
		} catch (err) {
			s.note(`[bookmarks] step failed: ${(err as Error).message}`);
		}

		// ── Contacts: New contact → name → submit → row appears ──────────────
		try {
			const page = await s.openApp(APP.Contacts);
			await page.waitForTimeout(2400);
			s.note("\n### contacts — create (CRUD)");
			const before = await page
				.locator(".contacts-row")
				.count()
				.catch(() => -1);
			s.note(`contact rows before: ${before}`);
			await page
				.locator('.app-header button[aria-label*="new contact" i]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(700);
			const name = page.locator(".contacts-compose__input").first();
			await name.fill("Dogfood Contact 308").catch(() => undefined);
			await s.shot(page, "ct-01-compose");
			await name.press("Enter").catch(() => undefined);
			await page.waitForTimeout(1300);
			const after = await page
				.locator(".contacts-row")
				.count()
				.catch(() => -1);
			s.note(`contact rows after: ${after}`);
			await s.shot(page, "ct-02-after-create");
		} catch (err) {
			s.note(`[contacts] step failed: ${(err as Error).message}`);
		}
	} finally {
		await s.finish();
	}
});
