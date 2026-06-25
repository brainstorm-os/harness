/**
 * Session 022 — F-017 (inspector surface) check: a created property reads by its
 * display name in the Details inspector too, not its generated key. Open a
 * client that has a Status set and confirm the property row label is "Status".
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("the inspector labels a created property by its name, not its key (F-017)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("022-inspector-label-check");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		// Select the first client so the inspector shows its properties.
		await db.locator(".dbv-grid__row:not(.dbv-grid__row--head)").first().click();
		await db.waitForTimeout(800);

		const labels = await db
			.locator("#db-inspector .db-inspector__props dt")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Inspector property labels: ${JSON.stringify(labels.map((t) => t.trim()))}`);
		await s.shot(db, "01-inspector");

		const showsName = labels.some((t) => /status/i.test(t));
		const showsRawKey = labels.some((t) => /prop[_ ]/i.test(t));
		s.note(`Inspector shows "Status": ${showsName}`);
		s.note(`Inspector still shows a raw prop_ key: ${showsRawKey}`);

		expect(showsName).toBe(true);
		expect(showsRawKey).toBe(false);
	} finally {
		await s.finish();
	}
});
