/**
 * Session 907c — rebuilding Northbound, part 3: CRM columns (Stage, Deal value).
 * Probe-first: walks the Clients view-settings popover with a screenshot at
 * every step so the column-adder flow is legible before we commit values.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Clients columns probe + add (907c)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907c-crm-columns");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1200);

		// The toolbar gear opens the per-view settings popover.
		const gear = db.locator('#toolbar-settings, [aria-label*="settings" i]').first();
		if ((await gear.count()) === 0) {
			s.note("[db] no settings gear found on the toolbar");
			await s.shot(db, "no-gear");
			return;
		}
		await gear.click();
		await db.waitForTimeout(700);
		await s.shot(db, "view-settings-root");
		const popText = await db
			.evaluate(() => (document.querySelector('[aria-label="View settings"]')?.textContent ?? "").replace(/\s+/g, " ").slice(0, 400));
		s.note(`[db] view-settings text: "${popText}"`);

		// Try to reach the columns page.
		const columnsNav = db.locator('[aria-label="View settings"] >> text=/column/i').first();
		if ((await columnsNav.count()) > 0) {
			await columnsNav.click();
			await db.waitForTimeout(600);
			await s.shot(db, "columns-page");
			const colText = await db
				.evaluate(() => (document.querySelector('[aria-label="View settings"]')?.textContent ?? "").replace(/\s+/g, " ").slice(0, 500));
			s.note(`[db] columns page text: "${colText}"`);

			for (const want of [
				{ name: "Stage", hint: /select|choice|status/i },
				{ name: "Deal value", hint: /number|currency|amount/i },
			]) {
				const add = db.locator('[aria-label="View settings"] >> text=/add column|add property|new column|create/i').first();
				if ((await add.count()) === 0) {
					s.note(`[db] no add-column affordance visible for "${want.name}"`);
					break;
				}
				await add.click();
				await db.waitForTimeout(700);
				await s.shot(db, `add-column-${want.name.toLowerCase().replace(/\s+/g, "-")}`);
				const pickerText = await db
					.evaluate(() => (document.body.textContent ?? "").replace(/\s+/g, " ").slice(0, 100));
				s.note(`[db] add-column step for "${want.name}" — body head: "${pickerText}"`);
				// If a create-new path exists, prefer it; screenshot whatever opened.
				const createNew = db.locator("text=/create new/i").first();
				if ((await createNew.count()) > 0) {
					await createNew.click();
					await db.waitForTimeout(700);
					await s.shot(db, `create-new-${want.name.toLowerCase().replace(/\s+/g, "-")}`);
				}
				const nameInput = db.locator('input[type="text"]:visible, input:not([type]):visible').last();
				if ((await nameInput.count()) > 0) {
					await nameInput.fill(want.name).catch(() => undefined);
					await db.waitForTimeout(400);
					await s.shot(db, `named-${want.name.toLowerCase().replace(/\s+/g, "-")}`);
					await db.keyboard.press("Enter");
					await db.waitForTimeout(800);
				} else {
					s.note(`[db] no name input surfaced for "${want.name}" — stopping here for readback`);
					break;
				}
				await s.shot(db, `after-${want.name.toLowerCase().replace(/\s+/g, "-")}`);
			}
		} else {
			s.note("[db] no Columns entry in view settings — see view-settings-root shot");
		}
		await db.keyboard.press("Escape").catch(() => undefined);
		await s.shot(db, "grid-after");
	} finally {
		await s.finish();
	}
});
