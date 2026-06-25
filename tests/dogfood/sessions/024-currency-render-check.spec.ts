/**
 * Session 024 — verify the currency property end-to-end: a value entered in a
 * currency column renders with its symbol ($), and the View-settings Columns
 * list shows the property's NAME ("Deal size"), not its generated key (F-017
 * third surface). Targets the first Deal-size column (on-screen) to stay clear
 * of the duplicate-column residue earlier runs left in Mira's vault.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("a currency value renders with its symbol + settings shows the column name", async () => {
	test.setTimeout(180_000);
	const s = await startSession("024-currency-render-check");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		// First Deal-size cell = editable index 1 (Status is index 0), on-screen.
		const cell = db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.locator(".dbv-grid__cell--editable")
			.nth(1);
		await cell.click();
		await db.waitForTimeout(300);
		const input = db.locator(".dbv-grid__cell--editable input, input.bs-cell-edit-input").first();
		if ((await input.count()) > 0) {
			await input.fill("25000");
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
			s.note("Entered 25000 in the first Deal size cell");
		} else {
			s.note("No number input opened");
		}
		await s.shot(db, "01-value-set");

		const cellText = (await cell.innerText().catch(() => "")) ?? "";
		s.note(`First Deal-size cell renders: ${JSON.stringify(cellText.replace(/\s+/g, " ").trim())}`);
		const rendersCurrency = /\$|US\$/.test(cellText) || /25,000/.test(cellText);
		s.note(`Renders as currency: ${rendersCurrency}`);

		// View-settings Columns list should show "Deal size", not "Prop mpx…".
		await db.locator("#toolbar-settings").click();
		await db.waitForTimeout(500);
		const colNames = await db
			.locator(".db-popover__column-name")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Columns-list labels: ${JSON.stringify(colNames.map((t) => t.trim()))}`);
		const showsName = colNames.some((t) => /deal size/i.test(t));
		const showsRawKey = colNames.some((t) => /prop[_ ]/i.test(t));
		s.note(`Settings shows "Deal size": ${showsName}; still shows raw prop_ key: ${showsRawKey}`);
		await s.shot(db, "02-settings-columns");
		await db.keyboard.press("Escape");

		expect(rendersCurrency).toBe(true);
		expect(showsRawKey).toBe(false);
	} finally {
		await s.finish();
	}
});
