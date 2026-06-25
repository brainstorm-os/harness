/**
 * Session 017 — F-014 fix check: rename a client by double-clicking the grid
 * title cell (spreadsheet-style inline rename), the CRM-natural path. Mira's
 * client rows are generic Objects with no own app, so the title column is now
 * inline-editable: double-click the name → type → Enter commits it.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("rename a client inline in the grid title cell (F-014)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("017-rename-client-inline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		const before = await db
			.locator('.dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell[data-col="title"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Before names: ${JSON.stringify(before.map((t) => t.trim()))}`);
		await s.shot(db, "01-clients-before");

		// The editable title button — the inline-rename affordance for a generic
		// Object row. Double-click swaps it for a text input.
		const titleBtn = db.locator(".dbv-grid__title-label--editable").first();
		s.note(`Inline-editable title present: ${(await titleBtn.count()) > 0}`);
		await titleBtn.dblclick();
		await db.waitForTimeout(400);

		const input = db.locator(".dbv-grid__title-input");
		s.note(`Inline input opened: ${(await input.count()) > 0}`);
		await input.fill("Acme Research Co.");
		await s.shot(db, "02-typing-name");
		await db.keyboard.press("Enter");
		await db.waitForTimeout(900);

		const after = await db
			.locator('.dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell[data-col="title"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`After names: ${JSON.stringify(after.map((t) => t.trim()))}`);
		s.note(`Renamed inline: ${after.some((t) => t.includes("Acme Research Co."))}`);
		await s.shot(db, "03-clients-after");

		expect(after.some((t) => t.includes("Acme Research Co."))).toBe(true);
	} finally {
		await s.finish();
	}
});
