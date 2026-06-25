/**
 * Session 116 — verify the right panel closes when nothing is selected.
 *
 * Reported friction: the Database Details inspector, once open, stayed open
 * showing "Select an item…" after the selection cleared — an empty panel eating
 * horizontal space. The fix: nothing selected → the inspector closes. The
 * header toggle still opens it (seeding the first row so it's never an empty
 * shell).
 *
 * Reliable deselect path = switching lists (`selectList` clears the selection
 * and re-renders the inspector). Records `#db-main[data-inspector-open]`.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const open = (db: Page) => db.locator("#db-main").first().getAttribute("data-inspector-open");

test("the Details inspector closes when nothing is selected (116)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("116-verify-inspector-close");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		const lists = db.locator(".db-sidebar__list-item");
		await lists
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(800);
		await s.shot(db, "01-grid");

		// 1. Open a row peek via the title-cell "Open" affordance.
		await db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.hover()
			.catch(() => undefined);
		await db
			.locator(".dbv-grid__open")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(500);
		const afterPeek = await open(db);
		await s.shot(db, "02-peek-open");
		s.note(`After opening a row peek: data-inspector-open=${afterPeek}`);

		// 2. Deselect by switching to another list → the peek should CLOSE.
		await lists
			.nth(1)
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		const afterSwitch = await open(db);
		await s.shot(db, "03-after-list-switch");
		s.note(`After switching lists (selection cleared): data-inspector-open=${afterSwitch}`);

		// 3. The header toggle opens it on the first row (never an empty shell).
		await db
			.locator("#header-btn-inspector")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(500);
		const afterToggle = await open(db);
		await s.shot(db, "04-toggle-open");
		s.note(
			`After clicking the header inspector toggle (no prior selection): data-inspector-open=${afterToggle}`,
		);

		// Key invariants (hard assertions so the run reports pass/fail clearly).
		expect(afterPeek, "peek opens the inspector").toBe("true");
		expect(afterSwitch, "clearing the selection closes the inspector (the fix)").toBe("false");
		expect(afterToggle, "the header toggle opens it on the first row").toBe("true");
		s.note("verified: no selection → inspector closes; toggle reopens on the first row.");
	} finally {
		await s.finish();
	}
});
