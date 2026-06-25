/**
 * Session 028 — conclusive, residue-free repro of F-021. Build a brand-new
 * collection with a single plain Number column + one row, then inspect the
 * cell's resting DOM (editable PillCell button vs read-only paint) and whether
 * clicking it opens an editor. Isolates the number-cell question from the
 * duplicate-column residue in Clients.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("fresh plain-Number cell: resting DOM + does it open an editor", async () => {
	test.setTimeout(180_000);
	const s = await startSession("028-fresh-number-cell");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// New blank collection.
		await db.locator("#sidebar-new-list").first().click();
		await db.waitForTimeout(400);
		await db.locator('text="Blank collection"').first().click();
		await db.waitForTimeout(1200);
		await expect(db.locator("#stage-title")).toContainText(/New collection/i);

		// Add a plain Number column "Amount".
		await db.locator("#toolbar-settings").click();
		await db.waitForTimeout(500);
		const add = db.locator('[data-testid="db-view-settings-add-column"]').first();
		await add.scrollIntoViewIfNeeded().catch(() => undefined);
		await add.click();
		await db.waitForTimeout(350);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /Create new property/ })
			.first()
			.click();
		await db.waitForTimeout(400);
		await db.locator(".bs-inline-property-form__name").fill("Amount");
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Number$/ })
			.first()
			.click();
		await db.locator(".bs-inline-property-form__action--primary").first().click();
		await db.waitForTimeout(900);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);

		// Add a row.
		await db
			.locator("#toolbar-new, .db-stage__view-bar button", { hasText: /New/ })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);

		const rows = db.locator(".dbv-grid__row:not(.dbv-grid__row--head)");
		s.note(`Rows after + New: ${await rows.count()}`);
		const cell = rows.first().locator(".dbv-grid__cell--editable").first();

		// Resting DOM: editable PillCell button (.bs-cell-pill) vs read-only paint.
		const resting = await cell.evaluate((el) => ({
			html: el.innerHTML.slice(0, 160),
			hasPill: !!el.querySelector(".bs-cell-pill, .bs-cell-plain"),
			hasButton: !!el.querySelector("button"),
		}));
		s.note(`Amount cell resting DOM: ${JSON.stringify(resting)}`);

		await cell.click();
		await db.waitForTimeout(150);
		const opened = await db.evaluate(() => ({
			input: document.querySelector(".bs-cell-plain-input, .bs-cell-input")?.className ?? null,
			active: (document.activeElement as HTMLElement | null)?.className ?? null,
		}));
		s.note(`After click: ${JSON.stringify(opened)}`);
		s.note(`Editor opened: ${opened.input !== null}`);
		await s.shot(db, "01-fresh-number-cell");

		expect(await rows.count()).toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
