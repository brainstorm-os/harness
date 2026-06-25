/**
 * Session 072 — Mira tidies the duplicate collection.
 *
 * Session 065's failed first run left a stray "New collection" (a duplicate of
 * the Content Calendar, 3 rows) in the vault — visible clutter in the Database
 * sidebar. She deletes it the normal way: right-click the collection in the
 * sidebar → Delete. A small workspace-hygiene pass (the founder keeps her own
 * desk clean), and it verifies the sidebar list context-menu delete path.
 *
 * (deleteList removes the collection wrapper + its views; the member objects
 * are generic Objects that persist as unfiled entities — fully purging those
 * orphans is a separate object-level sweep. Removing the mislabelled
 * collection is the visible-clutter win here.) Idempotent: if it's already
 * gone, the session is a no-op that still passes.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const STRAY = "New collection";

test("delete the stray duplicate collection", async () => {
	test.setTimeout(180_000);
	const s = await startSession("072-tidy-vault");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await s.shot(db, "01-before");

		const stray = db.locator(".db-sidebar__list-item", { hasText: new RegExp(`^\\s*${STRAY}`, "i") });
		const beforeCount = await stray.count();
		s.note(`stray "${STRAY}" present before: ${beforeCount}`);

		if (beforeCount === 0) {
			s.note("nothing to tidy — stray collection already gone");
		} else {
			await stray.first().click({ button: "right" });
			await db.waitForTimeout(400);
			await db
				.locator('.fm-menu [role="option"]', { hasText: /^Delete$/i })
				.first()
				.click();
			await db.waitForTimeout(900);
			s.note("deleted the stray collection via the sidebar context menu");
		}
		await s.shot(db, "02-after");

		await expect(
			db.locator(".db-sidebar__list-item", { hasText: new RegExp(`^\\s*${STRAY}`, "i") }),
			"the stray collection is gone from the sidebar",
		).toHaveCount(0);
	} finally {
		await s.finish();
	}
});
