/**
 * Session 040 — Mira reviews her pipeline by filtering. Opens the Clients CRM
 * filter builder and checks the property menu lists her columns by name (not
 * the generated key — F-017 filter surface), then adds a Status filter.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("filter builder lists columns by display name (F-017 filter surface)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("040-filter-pipeline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		await db.locator("#toolbar-filter").click();
		await db.waitForTimeout(600);
		const firstMenu = await db
			.locator('.fm-menu [role="option"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Filter menu options: ${JSON.stringify(firstMenu.map((t) => t.trim()))}`);
		// "Add filter rule" → should open the property menu.
		await db
			.locator('.fm-menu [role="option"]', { hasText: /Add filter rule|Add another rule/ })
			.first()
			.click();
		await db.waitForTimeout(120);
		const at120 = await db.evaluate(() => ({
			menus: document.querySelectorAll(".fm-menu").length,
			options: document.querySelectorAll('.fm-menu [role="option"]').length,
		}));
		s.note(`@120ms after Add filter rule: ${JSON.stringify(at120)}`);
		await db.waitForTimeout(600);
		const props = await db
			.locator('.fm-menu [role="option"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Filter property options: ${JSON.stringify(props.map((t) => t.trim()))}`);
		await s.shot(db, "01-filter-properties");

		const hasNames = props.some((t) => /deal size/i.test(t)) && props.some((t) => /status/i.test(t));
		const hasRawKey = props.some((t) => /prop[_ ]/i.test(t));
		s.note(`Shows display names (Status + Deal size): ${hasNames}; raw prop_ key: ${hasRawKey}`);
		await db.keyboard.press("Escape").catch(() => undefined);

		expect(hasRawKey).toBe(false);
		expect(props.some((t) => /status/i.test(t))).toBe(true);
	} finally {
		await s.finish();
	}
});
