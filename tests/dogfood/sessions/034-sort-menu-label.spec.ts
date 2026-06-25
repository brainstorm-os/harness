/**
 * Session 034 — F-017 (sort-menu surface) check: the sort menu lists columns by
 * their display name ("Deal size"), not the generated key. Open Clients → sort
 * menu, read the option labels.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("sort menu labels columns by name, not the raw key (F-017)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("034-sort-menu-label");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		await db.locator("#toolbar-sort").click();
		await db.waitForTimeout(400);
		const opts = await db
			.locator('.fm-menu [role="option"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Sort menu options: ${JSON.stringify(opts.map((t) => t.trim()))}`);
		await s.shot(db, "01-sort-menu");
		const hasDeal = opts.some((t) => /deal size/i.test(t));
		const hasRawKey = opts.some((t) => /prop[_ ]/i.test(t));
		s.note(`Sort menu shows "Deal size": ${hasDeal}; raw prop_ key: ${hasRawKey}`);
		await db.keyboard.press("Escape");

		expect(hasDeal).toBe(true);
		expect(hasRawKey).toBe(false);
	} finally {
		await s.finish();
	}
});
