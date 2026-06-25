/**
 * Session 010 — tidy Mira's vault.
 *
 * The F-008 verification runs left junk "New collection N" lists + stray
 * "Untitled" generic Objects in Mira's real workspace. This maintenance pass
 * deletes them through the app (the vault is encrypted — cleanup must run in
 * the live shell), keeping her real "Clients" collection and everything else.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("tidy — remove junk collections and stray Objects", async () => {
	test.setTimeout(240_000);
	const s = await startSession("010-tidy-vault");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await s.shot(db, "before");

		// 1. Delete every "New collection N" list via right-click → Delete.
		let guard = 0;
		while (guard++ < 30) {
			const junk = db
				.locator("#list-nav .db-sidebar__list-name", { hasText: /^New collection/ })
				.first();
			if ((await junk.count()) === 0) break;
			// Force past the count-badge that overlaps the row.
			await junk.click({ button: "right", force: true });
			await db.waitForTimeout(450);
			// Drive the menu by keyboard — clicking fights the entrance animation
			// (never "stable") and a force-click bypasses the lib's pointer handler.
			// Delete is the last of Rename/Duplicate/Delete, so ArrowUp wraps to it.
			if ((await db.locator('[role="menu"] .fm-row', { hasText: "Delete" }).count()) === 0) {
				await db.keyboard.press("Escape").catch(() => undefined);
				break;
			}
			await db.keyboard.press("ArrowUp");
			await db.waitForTimeout(150);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(800);
		}
		await s.shot(db, "collections-cleared");
		s.note(`Deleted junk collections (${guard - 1} passes).`);

		// 2. Delete stray "Untitled" Objects: open the Objects list, right-click
		//    each Untitled row → Delete.
		const objectsList = db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Objects$/ })
			.first();
		if (await objectsList.count()) {
			await objectsList.click();
			await db.waitForTimeout(800);
			let rg = 0;
			while (rg++ < 20) {
				const row = db.locator('text="Untitled"').first();
				if ((await row.count()) === 0) break;
				await row.click({ button: "right", force: true });
				await db.waitForTimeout(400);
				const del = db
					.locator('[role="menu"] .fm-row')
					.filter({ hasText: /^(Delete|Move to Bin|Remove)$/ })
					.first();
				if ((await del.count()) === 0) {
					await db.keyboard.press("Escape").catch(() => undefined);
					break;
				}
				await del.click({ force: true });
				await db.waitForTimeout(700);
			}
			s.note(`Cleared stray Objects (${rg - 1} passes).`);
		}
		await s.shot(db, "after");

		// "Clients" (Mira's real collection) must survive the tidy.
		await expect(
			db.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ }).first(),
			"Mira's real Clients collection must NOT be deleted",
		).toBeVisible();
		// No "New collection" should remain.
		await expect(
			db.locator("#list-nav .db-sidebar__list-name", { hasText: /^New collection/ }),
			"all junk collections removed",
		).toHaveCount(0);
	} finally {
		await s.finish();
	}
});
