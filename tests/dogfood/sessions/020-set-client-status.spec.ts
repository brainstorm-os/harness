/**
 * Session 020 — real CRM work (no blocker): Mira sets a Status on each client.
 * The Status column is a Select with an empty dictionary, so this exercises the
 * inline option-create flow (click the cell → type → "Create '…'") that any CRM
 * needs to triage leads. Reports whatever friction the Select editing surfaces.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function setStatusOnRow(db: Page, rowIndex: number, value: string): Promise<boolean> {
	const cell = db
		.locator(".dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell--editable")
		.nth(rowIndex);
	if ((await cell.count()) === 0) return false;
	await cell.click();
	await db.waitForTimeout(400);
	const input = db.locator(".bs-cell-pop-input");
	if ((await input.count()) === 0) return false;
	await input.fill(value);
	await db.waitForTimeout(300);
	// Prefer an existing option with this label; else the "Create '…'" row.
	const exact = db.locator(".bs-cell-pop-row-label", { hasText: new RegExp(`^${value}$`) }).first();
	const create = db.locator(".bs-cell-pop-row--create").first();
	if (await exact.count()) await exact.click();
	else if (await create.count()) await create.click();
	else {
		await db.keyboard.press("Escape");
		return false;
	}
	await db.waitForTimeout(400);
	await db.keyboard.press("Escape");
	await db.waitForTimeout(300);
	return true;
}

test("Mira sets a Status on each client (Select inline option-create)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("020-set-client-status");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(1000);
		await s.shot(db, "01-before");

		const plan = ["Lead", "Active", "Lead"];
		for (let i = 0; i < plan.length; i++) {
			const ok = await setStatusOnRow(db, i, plan[i] ?? "Lead").catch(() => false);
			s.note(`Set row ${i} Status = "${plan[i]}": ${ok}`);
		}
		await s.shot(db, "02-after");

		// Read back the Status cells from the grid.
		const statuses = await db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell--editable")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Status cells after: ${JSON.stringify(statuses.map((t) => t.trim()))}`);
		const filled = statuses.filter((t) => /lead|active/i.test(t)).length;
		s.note(`Clients with a Status set: ${filled}`);

		expect(filled).toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
