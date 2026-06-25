/**
 * Session 031 — verify F-022 (remove a column) by using it to clean the
 * duplicate "Deal size" columns the currency verification runs left in Clients.
 * Confirms a column can be removed from a collection, leaving exactly one.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("remove duplicate Deal size columns from Clients (F-022)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("031-remove-column-cleanup");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		const headersBefore = await db
			.locator(".dbv-grid__cell--head[data-prop]")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Headers before: ${JSON.stringify(headersBefore.map((t) => t.trim()))}`);

		// Open settings → remove all but one "Deal size" column.
		const dealCount = () => headersBefore.filter((t) => /deal size/i.test(t)).length;
		let removed = 0;
		while (removed < 10) {
			await db.locator("#toolbar-settings").click();
			await db.waitForTimeout(450);
			// Column rows for "Deal size" in the settings list.
			const dealRows = db.locator(".db-popover__column-row", { hasText: /Deal size/i });
			const n = await dealRows.count();
			s.note(`Deal-size column rows in settings: ${n}`);
			if (n <= 1) {
				await db.keyboard.press("Escape");
				break;
			}
			// Remove the last duplicate.
			const removeBtn = dealRows.last().locator('[data-testid="db-view-settings-remove-column"]');
			await removeBtn.scrollIntoViewIfNeeded().catch(() => undefined);
			await removeBtn.click();
			await db.waitForTimeout(500);
			await db.keyboard.press("Escape");
			await db.waitForTimeout(300);
			removed += 1;
		}
		s.note(`Columns removed: ${removed}`);

		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(700);
		const headersAfter = await db
			.locator(".dbv-grid__cell--head[data-prop]")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Headers after: ${JSON.stringify(headersAfter.map((t) => t.trim()))}`);
		const dealAfter = headersAfter.filter((t) => /deal size/i.test(t)).length;
		s.note(`Deal size columns remaining: ${dealAfter}`);
		await s.shot(db, "01-cleaned");

		expect(dealAfter).toBe(1);
	} finally {
		await s.finish();
	}
});
