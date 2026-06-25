/**
 * Session 085 — Mira sorts the Content Calendar by publish date.
 *
 * So the issues read in ship order, she sorts the grid ascending by Publish
 * date. Completes the grid's query-control coverage (filter 084, group/board
 * 083, sort here). Also clears 084's lingering filter first, so all three
 * issues sort chronologically (9 → 16 → 23 June).
 *
 * The sort menu labels columns by display name (propertyDisplayName, the F-017
 * fix) — so, like the filter cascade, it's NOT subject to F-036. No app-source
 * change → SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const opt = (page: import("@playwright/test").Page, text: RegExp) =>
	page.locator('.fm-menu [role="option"]', { hasText: text }).last();

test("sort the pipeline by publish date", async () => {
	test.setTimeout(180_000);
	const s = await startSession("085-sort-pipeline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click();
		await db.waitForTimeout(700);
		await db.locator(".db-tab", { hasText: /Grid/i }).first().click();
		await db.waitForTimeout(500);

		// Clear 084's filter so all three issues are present.
		await db.locator("#toolbar-filter").first().click();
		await db.waitForTimeout(400);
		const clearFilter = opt(db, /Clear filter/i);
		if ((await clearFilter.count()) > 0) {
			await clearFilter.click();
			await db.waitForTimeout(500);
			s.note("cleared the lingering filter");
		} else {
			await db.keyboard.press("Escape");
		}

		// Clear any existing sort (deterministic Asc), then sort by Publish date.
		await db.locator("#toolbar-sort").first().click();
		await db.waitForTimeout(400);
		const clearSort = opt(db, /Clear sort/i);
		if ((await clearSort.count()) > 0) {
			await clearSort.click();
			await db.waitForTimeout(500);
			await db.locator("#toolbar-sort").first().click();
			await db.waitForTimeout(400);
		}
		await opt(db, /Publish date/i).click();
		await db.waitForTimeout(800);
		s.note("sorted by Publish date (ascending)");
		await s.shot(db, "01-sorted");

		const rows = (await db.locator(".dbv-grid__title-label").allInnerTexts()).map((t) => t.trim());
		s.note(`row order: ${JSON.stringify(rows)}`);

		const idx = (n: string) => rows.findIndex((r) => r.includes(n));
		const i1 = idx("Issue #1");
		const i2 = idx("Issue #2");
		const i3 = idx("Issue #3");
		expect(i1, "all three issues present").toBeGreaterThanOrEqual(0);
		expect(
			i1 < i2 && i2 < i3,
			`ascending by publish date: #1 (9 Jun) → #2 (16) → #3 (23); got ${JSON.stringify(rows)}`,
		).toBe(true);
	} finally {
		await s.finish();
	}
});
