/**
 * Session 033 — Mira runs her pipeline: fill a deal size for each client, then
 * sort the Clients CRM by Deal size (largest first) to see her biggest deals.
 * Exercises real grid cell editing across rows + the toolbar sort.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function openClients(db: Page): Promise<void> {
	await db
		.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
		.first()
		.click();
	await db.waitForTimeout(900);
}

async function names(db: Page): Promise<string[]> {
	const t = await db
		.locator(
			'.dbv-grid__row:not(.dbv-grid__row--head):not(.dbv-grid__row--foot) .dbv-grid__cell[data-col="title"]',
		)
		.allInnerTexts()
		.catch(() => []);
	return t.map((x) => x.trim());
}

test("Mira fills deal sizes and sorts the pipeline by value", async () => {
	test.setTimeout(180_000);
	const s = await startSession("033-run-the-pipeline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await openClients(db);
		// The Details inspector is a right-side overlay (by design) that covers
		// the right columns — close it so every cell is reachable.
		await db
			.locator("#inspector-close")
			.click({ timeout: 3000 })
			.catch(() => undefined);
		await db.waitForTimeout(400);
		s.note(`Clients order (before): ${JSON.stringify(await names(db))}`);

		// Deal size is editable column index 1 (Status=0, Deal size=1).
		// Give each client a different amount so the sort is observable.
		const amountByName: Record<string, string> = {
			"Acme Research Co.": "25000",
			"Vertex Labs": "48000",
			"Beacon Analytics": "12000",
		};
		const order = await names(db);
		for (let i = 0; i < order.length; i++) {
			const amount = amountByName[order[i] ?? ""] ?? "10000";
			// Selecting a row re-opens the inspector overlay (covers right cells),
			// so close it before each edit.
			await db
				.locator("#inspector-close")
				.click({ timeout: 1500 })
				.catch(() => undefined);
			await db.waitForTimeout(200);
			const cell = db
				.locator(".dbv-grid__row:not(.dbv-grid__row--head):not(.dbv-grid__row--foot)")
				.nth(i)
				.locator(".dbv-grid__cell--editable")
				.nth(1);
			await cell.scrollIntoViewIfNeeded().catch(() => undefined);
			await cell.click();
			await db.waitForTimeout(250);
			const input = db.locator(".bs-cell-input, .bs-cell-plain-input").first();
			if ((await input.count()) > 0) {
				await input.fill(amount);
				await db.keyboard.press("Enter");
				await db.waitForTimeout(350);
				s.note(`${order[i]} → ${amount}`);
			} else {
				s.note(`${order[i]} → editor did not open`);
			}
		}
		await s.shot(db, "01-filled");

		// Sort by Deal size, descending (biggest deals first).
		await db
			.locator("#toolbar-sort")
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(400);
		// Pick "Deal size" in the sort menu, then cycle to descending.
		const dealOpt = db.locator('.fm-menu [role="option"]', { hasText: /Deal size/i }).first();
		s.note(`Sort menu has Deal size: ${(await dealOpt.count()) > 0}`);
		if (await dealOpt.count()) {
			await dealOpt.click();
			await db.waitForTimeout(400);
			// Cycle once more to descending (asc → desc).
			await db
				.locator("#toolbar-sort")
				.click()
				.catch(() => undefined);
			await db.waitForTimeout(300);
			await db
				.locator('.fm-menu [role="option"]', { hasText: /Deal size/i })
				.first()
				.click()
				.catch(() => undefined);
			await db.waitForTimeout(400);
		}
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(300);

		const sorted = await names(db);
		s.note(`Clients order (after sort by Deal size): ${JSON.stringify(sorted)}`);
		await s.shot(db, "02-sorted");

		expect(sorted.length).toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
