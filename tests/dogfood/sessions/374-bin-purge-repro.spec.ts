/**
 * Session 374 — repro: "deleting from bin stopped working".
 *
 * Bisects the purge path in one run:
 *   1. Ensure the Bin holds an item (create + delete a scratch note if empty).
 *   2. Drive the REAL UI: open Bin → row "Permanently delete …" → confirm
 *      "Delete forever" → assert the row disappears.
 *   3. If the UI purge fails, probe the same id over raw IPC
 *      (`window.brainstorm.bin.purge`) to split renderer vs main-process.
 * Console/page errors are collected across every window for diagnostics.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("bin: delete-forever removes the object", async () => {
	test.setTimeout(300_000);
	const s = await startSession("374-bin-purge-repro");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const dash = s.dashboard;
	const listBin = () =>
		dash.evaluate(
			() =>
				(
					window as unknown as {
						brainstorm: { bin: { list(): Promise<Array<{ id: string; title: string }>> } };
					}
				).brainstorm.bin.list(),
		);

	try {
		await dash.waitForTimeout(1500);
		await dash.keyboard.press("Escape"); // dismiss "What's new"
		await dash.waitForTimeout(500);

		// ── 1. Ensure something is in the Bin ──
		let items = await listBin();
		s.note(`bin items at start: ${items.length}`);
		if (items.length === 0) {
			await dash.evaluate(() =>
				(
					window as unknown as {
						brainstorm: { dev: { notes: { createAndOpenScratchNote(): Promise<unknown> } } };
					}
				).brainstorm.dev.notes.createAndOpenScratchNote(),
			);
			await dash.waitForTimeout(2500);
			const notes = await s.openApp(APP.Notes);
			await notes.waitForTimeout(1500);
			// Object ⋯ menu is the LAST button in .app-header__right; Delete moves to Bin.
			await notes.locator(".app-header__right button").last().click();
			await notes.waitForTimeout(600);
			await s.shot(notes, "notes-object-menu");
			const del = notes
				.locator('[role="menu"] .fm-row')
				.filter({ hasText: /^(Delete|Move to Bin)$/ })
				.first();
			expect(await del.count(), "Notes object menu has a Delete item").toBeGreaterThan(0);
			await del.click({ force: true });
			await notes.waitForTimeout(1200);
			items = await listBin();
			s.note(`bin items after deleting scratch note: ${items.length}`);
		}
		expect(items.length, "bin must hold at least one item to test purge").toBeGreaterThan(0);
		const target = items[0];
		if (!target) throw new Error("unreachable: bin empty after guard");
		s.note(`purge target: ${target.id} "${target.title}"`);

		// ── 2. UI purge ──
		await dash.locator('[aria-label="Open Bin"]').first().click();
		await dash.waitForTimeout(1200);
		await s.shot(dash, "bin-open");
		// Row actions are hover-revealed (display:none → flex on .bin__row:hover).
		const row = dash.locator('[data-testid="bin"] .bin__row').first();
		await row.hover();
		await dash.waitForTimeout(400);
		await s.shot(dash, "row-hovered");
		const purgeBtn = dash.locator('[data-testid="bin"] [aria-label^="Permanently delete"]').first();
		expect(await purgeBtn.count(), "bin row has a Permanently-delete button").toBeGreaterThan(0);
		s.note(`purge button visible after hover: ${await purgeBtn.isVisible()}`);
		await purgeBtn.click({ force: true });
		await dash.waitForTimeout(800);
		await s.shot(dash, "purge-confirm");
		const confirmBtn = dash.locator("button", { hasText: /^Delete forever$/ }).first();
		s.note(`confirm dialog visible: ${(await confirmBtn.count()) > 0}`);
		if (await confirmBtn.count()) {
			await confirmBtn.click({ force: true });
			await dash.waitForTimeout(1500);
		}
		await s.shot(dash, "after-ui-purge");

		let after = await listBin();
		const uiPurged = !after.some((it) => it.id === target.id);
		s.note(`UI purge removed the item: ${uiPurged} (bin now ${after.length})`);

		// ── 3. IPC bisect if the UI failed ──
		if (!uiPurged) {
			const ok = await dash.evaluate(
				(id) =>
					(
						window as unknown as {
							brainstorm: { bin: { purge(id: string): Promise<boolean> } };
						}
					).brainstorm.bin.purge(id),
				target.id,
			);
			after = await listBin();
			s.note(`IPC bin.purge returned: ${ok}; item still listed: ${after.some((it) => it.id === target.id)}`);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);

		expect(uiPurged, "delete-forever must remove the object from the Bin").toBe(true);
	} finally {
		await s.finish();
	}
});
