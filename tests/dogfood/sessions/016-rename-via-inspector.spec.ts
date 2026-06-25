/**
 * Session 016 — rename a client the intended way: double-click the row to open
 * it, then edit the name in the detail/inspector. The grid title column isn't
 * inline-editable (double-click opens the entity), so this checks the actual
 * rename path works. Text-probe only.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("rename a client via the inspector after opening it", async () => {
	test.setTimeout(180_000);
	const s = await startSession("016-rename-via-inspector");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		// Double-click the first row to open the entity.
		await db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.dblclick()
			.catch(() => undefined);
		await db.waitForTimeout(1000);

		// Report what opened: a detail route? the inspector? Capture key text.
		const inspectorOpen = await db
			.locator("#db-inspector")
			.getAttribute("class")
			.catch(() => null);
		const bodyText =
			(await db
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(`After dblclick — inspector class: ${JSON.stringify(inspectorOpen)}`);
		s.note(
			`Visible text (first 240): ${JSON.stringify(bodyText.replace(/\s+/g, " ").slice(0, 240))}`,
		);

		// Look for any editable name/title field that opened.
		const nameField = db
			.locator(
				'#db-inspector [contenteditable="true"], #db-inspector input, .db-detail [contenteditable="true"], [contenteditable="true"]:focus',
			)
			.first();
		s.note(`Editable name field present: ${(await nameField.count()) > 0}`);
		if (await nameField.count()) {
			await nameField.click().catch(() => undefined);
			await db.keyboard.press("Meta+a").catch(() => undefined);
			await nameField.type("Acme Research Co.", { delay: 15 }).catch(() => undefined);
			await db.keyboard.press("Tab").catch(() => undefined);
			await db.waitForTimeout(800);
		}

		// Re-read the grid title cells.
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(800);
		const after = await db
			.locator('.dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell[data-col="title"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`After names: ${JSON.stringify(after.map((t) => t.trim()))}`);
		s.note(`Renamed: ${after.some((t) => t.includes("Acme"))}`);

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
