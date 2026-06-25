/**
 * Session 042 — verify F-027 fix: filtering a Select column now uses an option
 * picker (labels), stores the option id, and narrows the grid. Clears any stale
 * filter, then applies Status = Lead via the picker and checks the pipeline
 * narrows to the Lead client.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function clientNames(db: Page): Promise<string[]> {
	const t = await db
		.locator(
			'.dbv-grid__row:not(.dbv-grid__row--head):not(.dbv-grid__row--foot) .dbv-grid__cell[data-col="title"]',
		)
		.allInnerTexts()
		.catch(() => []);
	return t.map((x) => x.trim());
}

async function openClients(db: Page): Promise<void> {
	await db
		.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
		.first()
		.click();
	await db.waitForTimeout(800);
}

test("filter a Select column by its label via the option picker (F-027)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("042-filter-select-by-label");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await openClients(db);

		// Clear any stale filter rules from earlier sessions.
		for (let i = 0; i < 4; i++) {
			await db.locator("#toolbar-filter").click();
			await db.waitForTimeout(500);
			const ruleOpt = db
				.locator('.fm-menu [role="option"]', { hasText: /^(Status|Deal size|Last contact|Name)\b/ })
				.first();
			if ((await ruleOpt.count()) === 0) {
				await db.keyboard.press("Escape");
				break;
			}
			await ruleOpt.click(); // removing a rule commits + closes the menu
			await db.waitForTimeout(500);
		}
		await openClients(db);
		const before = await clientNames(db);
		s.note(`Clients (filters cleared): ${JSON.stringify(before)}`);

		// Apply Status is Lead via the new picker.
		await db.locator("#toolbar-filter").click();
		await db.waitForTimeout(500);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /Add filter rule|Add another rule/ })
			.first()
			.click();
		await db.waitForTimeout(500);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /^Status$/ })
			.first()
			.click();
		await db.waitForTimeout(500);
		await db.locator('.fm-menu [role="option"]', { hasText: /^is$/ }).first().click();
		await db.waitForTimeout(500);
		const valueOptions = await db
			.locator('.fm-menu [role="option"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Status value picker options: ${JSON.stringify(valueOptions.map((t) => t.trim()))}`);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /^Lead$/ })
			.first()
			.click();
		await db.waitForTimeout(800);
		await s.shot(db, "01-filtered-lead");

		const after = await clientNames(db);
		s.note(`Clients after Status is Lead: ${JSON.stringify(after)}`);
		const narrowed = after.length > 0 && after.length < before.length;
		s.note(`Narrowed to Lead client(s): ${narrowed}`);

		// Verify the chip reads the label, not a raw id.
		await db.locator("#toolbar-filter").click();
		await db.waitForTimeout(500);
		const chips = await db
			.locator('.fm-menu [role="option"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Filter menu rules/chips: ${JSON.stringify(chips.map((t) => t.trim()))}`);
		await db.keyboard.press("Escape");

		expect(narrowed).toBe(true);
		expect(valueOptions.some((t) => /Lead/i.test(t))).toBe(true);
	} finally {
		await s.finish();
	}
});
