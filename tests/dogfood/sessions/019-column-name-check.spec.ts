/**
 * Session 019 — F-017 fix check: a created column shows the name I gave it, not
 * its internal id. Mira's Clients collection already carries the "Status" column
 * she made in session 018 (a generated key `prop_…` with display name "Status"
 * in the catalog). With the header fix, the grid header must read "Status".
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("a created column's header shows its display name (F-017)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("019-column-name-check");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(1000);

		const headers = await db
			.locator(".dbv-grid__cell--head[data-prop]")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Column headers (non-title): ${JSON.stringify(headers.map((t) => t.trim()))}`);
		await s.shot(db, "01-clients-headers");

		const showsName = headers.some((t) => /status/i.test(t));
		const showsRawKey = headers.some((t) => /prop[_ ]/i.test(t));
		s.note(`Header shows "Status": ${showsName}`);
		s.note(`Header still shows a raw prop_ key: ${showsRawKey}`);

		expect(showsName).toBe(true);
		expect(showsRawKey).toBe(false);
	} finally {
		await s.finish();
	}
});
