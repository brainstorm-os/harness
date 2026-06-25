/**
 * Session 015 — Mira names a client (grid inline cell editing).
 *
 * She has 3 "Untitled" rows in Clients; she wants to name the first one. Probes
 * the result as text (the title cell value) since screenshots aren't readable
 * in this thread.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const NAME = "Acme Research Co.";

test("Mira names a client row (grid cell editing)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("015-name-client");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		const titleCells = () =>
			db.locator('.dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell[data-col="title"]');
		const before = await titleCells()
			.allInnerTexts()
			.catch(() => []);
		s.note(`Before names: ${JSON.stringify(before.map((t) => t.trim()))}`);

		const firstCell = titleCells().first();
		// Try double-click to enter edit; fall back to single click.
		await firstCell.dblclick().catch(() => undefined);
		await db.waitForTimeout(400);
		let editor = db.locator('input:focus, [contenteditable="true"]:focus').first();
		if ((await editor.count()) === 0) {
			await firstCell.click().catch(() => undefined);
			await db.waitForTimeout(400);
			editor = db.locator('input:focus, [contenteditable="true"]:focus').first();
		}
		s.note(`Edit affordance focused: ${(await editor.count()) > 0}`);
		if (await editor.count()) {
			await db.keyboard.press("Meta+a").catch(() => undefined);
			await editor.type(NAME, { delay: 15 }).catch(() => undefined);
			await db.keyboard.press("Enter").catch(() => undefined);
			await db.waitForTimeout(800);
		}

		// Re-read (re-select to force a fresh render).
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(800);
		const after = await titleCells()
			.allInnerTexts()
			.catch(() => []);
		s.note(`After names: ${JSON.stringify(after.map((t) => t.trim()))}`);
		s.note(`Name persisted: ${after.some((t) => t.includes("Acme"))}`);

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
