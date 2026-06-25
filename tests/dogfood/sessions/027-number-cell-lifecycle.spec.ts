/**
 * Session 027 — root-cause F-021. Does a grid number cell's editor never open,
 * or open then immediately blur-close when the row-select steals focus? Probe
 * the editor lifecycle at 80ms vs 500ms after click, and compare against the
 * Select (Status) cell, which opens fine.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function snapshot(db: Page) {
	return db.evaluate(() => {
		const input = document.querySelector<HTMLInputElement>(".bs-cell-plain-input, .bs-cell-input");
		return {
			numberInput: input ? input.className : null,
			pop: document.querySelectorAll(".bs-cell-pop").length,
			active: (document.activeElement as HTMLElement | null)?.className ?? null,
		};
	});
}

test("probe: number-cell editor lifecycle vs Select", async () => {
	test.setTimeout(180_000);
	const s = await startSession("027-number-cell-lifecycle");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		const row = db.locator(".dbv-grid__row:not(.dbv-grid__row--head)").first();
		const editables = row.locator(".dbv-grid__cell--editable");
		const nEditable = await editables.count();
		s.note(`Editable cells in row 0: ${nEditable}`);

		// Control: the Status (Select) cell — index 0.
		await editables.nth(0).click();
		await db.waitForTimeout(120);
		s.note(`Status cell @120ms: ${JSON.stringify(await snapshot(db))}`);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(200);

		// Subject: a Deal-size (number/currency) cell — index 1.
		const numCell = editables.nth(1);
		await numCell.scrollIntoViewIfNeeded().catch(() => undefined);
		await numCell.click();
		// Snapshot quickly, then again later — does the input appear then vanish?
		await db.waitForTimeout(80);
		const early = await snapshot(db);
		s.note(`Number cell @80ms: ${JSON.stringify(early)}`);
		await db.waitForTimeout(450);
		const late = await snapshot(db);
		s.note(`Number cell @530ms: ${JSON.stringify(late)}`);
		s.note(`VERDICT: opens-then-closes = ${early.numberInput !== null && late.numberInput === null}`);
		s.note(`VERDICT: never-opens = ${early.numberInput === null && late.numberInput === null}`);
		await s.shot(db, "01-number-cell");

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
