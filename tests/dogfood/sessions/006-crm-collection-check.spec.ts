/**
 * Session 006 — verify F-008 keystone (blank collection + generic Object rows).
 *
 * The owner decision (F-008b): a row in a user-defined collection is a generic
 * brainstorm/Object/v1. Mira should now be able to: create a *blank* collection
 * (the new "New collection → Blank collection" entry), then add a row to it
 * with "+ New" — which previously refused ("open a typed list to create an
 * object here") and now mints a generic Object pinned into the collection.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Mira can create a blank collection and add a row (F-008 keystone)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("006-crm-collection-check");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// New collection → Blank collection.
		await db.locator("#sidebar-new-list").first().click();
		await db.waitForTimeout(600);
		await s.shot(db, "new-collection-menu");
		await db.locator('text="Blank collection"').first().click();
		// Wait past the debounced persist (400ms) + the vault rebuild it triggers,
		// so we catch any selection reset (F-010).
		await db.waitForTimeout(1500);
		await s.shot(db, "blank-collection-created");

		// The new collection must be the ACTIVE surface — not reset to a default.
		await expect(
			db.locator("#stage-title"),
			"the blank collection must stay active after creation (F-010)",
		).toContainText("New collection");

		// The fresh collection starts empty.
		await expect(db.locator("#stage-count"), "fresh collection starts empty").toHaveText("0");

		// Add a row via the grid's "+ New" — previously impossible on a non-typed list.
		await db.locator("#toolbar-new").click();
		await db.waitForTimeout(1800);
		await s.shot(db, "row-added");

		// Still on the collection, and the new Object row landed in IT (count 0 → 1).
		await expect(db.locator("#stage-title"), "still on the collection after +New").toContainText(
			"New collection",
		);
		await expect(
			db.locator("#stage-count"),
			"the new generic Object must land in this collection (count 0 → 1)",
		).toHaveText("1");
		await expect(
			db.locator('text="Untitled"').first(),
			"the new Object row shows in the grid",
		).toBeVisible();
	} finally {
		await s.finish();
	}
});
