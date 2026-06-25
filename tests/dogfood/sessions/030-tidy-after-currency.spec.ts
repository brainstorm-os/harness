/**
 * Session 030 — tidy Mira's vault after the currency verification runs. Removes
 * the junk "New collection" / "New collection 2" collections (test residue) so
 * her sidebar is clean to actually work in. Leaves Clients (her real CRM).
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function deleteCollection(db: Page, name: RegExp): Promise<boolean> {
	const item = db.locator("#list-nav .db-sidebar__list-name", { hasText: name }).first();
	if ((await item.count()) === 0) return false;
	await item.click({ button: "right" });
	await db.waitForTimeout(350);
	const del = db.locator('.fm-menu [role="option"]', { hasText: /^Delete$/ }).first();
	if ((await del.count()) === 0) {
		await db.keyboard.press("Escape");
		return false;
	}
	await del.click();
	await db.waitForTimeout(700);
	return true;
}

test("tidy: remove junk verification collections", async () => {
	test.setTimeout(180_000);
	const s = await startSession("030-tidy-after-currency");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		const before = await db
			.locator("#list-nav .db-sidebar__list-name")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Lists before: ${JSON.stringify(before.map((t) => t.trim()))}`);

		// Delete the exact junk names (not "Clients", not the type-lists).
		for (const name of [/^New collection 2$/, /^New collection$/]) {
			const ok = await deleteCollection(db, name).catch(() => false);
			s.note(`Deleted ${name}: ${ok}`);
		}

		const after = await db
			.locator("#list-nav .db-sidebar__list-name")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Lists after: ${JSON.stringify(after.map((t) => t.trim()))}`);
		await s.shot(db, "01-tidied");

		const stillHasJunk = after.some((t) => /^New collection/.test(t.trim()));
		s.note(`Junk collections remaining: ${stillHasJunk}`);
		expect(after.some((t) => /^Clients$/.test(t.trim()))).toBe(true);
	} finally {
		await s.finish();
	}
});
