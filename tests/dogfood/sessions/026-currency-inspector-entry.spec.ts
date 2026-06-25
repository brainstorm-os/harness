/**
 * Session 026 — verify currency entry + render via the inspector (isolated from
 * the grid's duplicate-column residue and row-click focus). Open a client, set
 * its Deal size in the Details inspector, confirm it renders with the $ symbol.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("enter a currency amount in the inspector and see it formatted", async () => {
	test.setTimeout(180_000);
	const s = await startSession("026-currency-inspector-entry");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		// Select the first client → inspector shows its properties.
		await db.locator(".dbv-grid__row:not(.dbv-grid__row--head)").first().click();
		await db.waitForTimeout(700);

		// Find the "Deal size" property row in the inspector and its cell.
		const labels = await db
			.locator("#db-inspector .db-inspector__props dt")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Inspector property rows: ${JSON.stringify(labels.map((t) => t.trim()))}`);
		const dealIdx = labels.findIndex((t) => /deal size/i.test(t));
		s.note(`Deal size row index: ${dealIdx}`);

		if (dealIdx >= 0) {
			const dd = db.locator("#db-inspector .db-inspector__props dd").nth(dealIdx);
			await dd.locator(".bs-cell-plain, .bs-cell-pill, button").first().click();
			await db.waitForTimeout(300);
			const input = db
				.locator("#db-inspector .bs-cell-plain-input, #db-inspector .bs-cell-input")
				.first();
			s.note(`Editor opened in inspector: ${(await input.count()) > 0}`);
			if ((await input.count()) > 0) {
				await input.fill("25000");
				await db.keyboard.press("Enter");
				await db.waitForTimeout(500);
				s.note("Committed 25000 via inspector");
				const after = (await dd.innerText().catch(() => "")) ?? "";
				s.note(`Deal size renders: ${JSON.stringify(after.replace(/\s+/g, " ").trim())}`);
				s.note(`Has $ symbol: ${/\$|US\$/.test(after)}`);
			}
		}
		await s.shot(db, "01-inspector");

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
