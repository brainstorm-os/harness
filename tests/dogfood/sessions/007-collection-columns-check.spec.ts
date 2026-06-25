/**
 * Session 007 — verify Mira can add a custom column to a collection (the CRM
 * payoff). The column-adder + "create new property" flow shipped in 9.3.5.U.b,
 * but it was only ever exercised on type-filter lists. This confirms it's
 * reachable on a brand-new *manual* collection — i.e. Mira can give her Clients
 * collection its own Company / Status / Deal-size columns.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("custom columns are reachable on a manual collection (F-008a)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("007-collection-columns-check");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// Make a fresh blank collection (the CRM container).
		await db.locator("#sidebar-new-list").first().click();
		await db.waitForTimeout(500);
		await db.locator('text="Blank collection"').first().click();
		await db.waitForTimeout(1500);
		await expect(db.locator("#stage-title")).toContainText("New collection");

		// Open View settings. The Columns section + "Add column…" must now be
		// present on a brand-new EMPTY collection (was hidden before the fix), so
		// Mira can give her Clients collection its first custom column. The menu
		// the button opens (incl. "Create new property") is covered by the
		// column-adder unit tests; here we verify the entry point is reachable.
		await db.locator("#toolbar-settings").click();
		await db.waitForTimeout(600);
		await s.shot(db, "view-settings-open");
		const addColumn = db.locator('[data-testid="db-view-settings-add-column"]').first();
		await expect(
			addColumn,
			"the 'Add column…' affordance must be reachable on an empty manual collection",
		).toBeVisible();
		await expect(addColumn, "and it must be enabled").toBeEnabled();
	} finally {
		await s.finish();
	}
});
