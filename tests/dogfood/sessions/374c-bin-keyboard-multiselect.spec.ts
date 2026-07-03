/**
 * Session 374c — bin purge variants: Delete key + multi-select bulk purge.
 *
 * The bin was emptied by 374b, so first re-seed it: create two scratch notes
 * and delete both via the Notes object ⋯ menu. Then:
 *   1. Keyboard: focus the bin list, press Delete on the active row, confirm.
 *   2. Multi-select: check the remaining row, footer "Delete forever", confirm.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Bridge = {
	brainstorm: {
		bin: { list(): Promise<Array<{ id: string; title: string }>> };
		dev: { notes: { createAndOpenScratchNote(): Promise<unknown> } };
	};
};

test("bin: Delete key and multi-select purge work", async () => {
	test.setTimeout(300_000);
	const s = await startSession("374c-bin-kbd-multi");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});
	const dash = s.dashboard;
	const listBin = () => dash.evaluate(() => (window as unknown as Bridge).brainstorm.bin.list());

	try {
		await dash.waitForTimeout(1500);
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		// ── Seed: two scratch notes, deleted via the Notes object menu ──
		for (let i = 0; i < 2; i++) {
			await dash.evaluate(() =>
				(window as unknown as Bridge).brainstorm.dev.notes.createAndOpenScratchNote(),
			);
			await dash.waitForTimeout(2000);
			const notes = await s.openApp(APP.Notes);
			await notes.waitForTimeout(1200);
			// Notes is the fleet's one header-namespace exception (.notes__header-right).
			await notes.locator(".notes__header-right button, .app-header__right button").last().click();
			await notes.waitForTimeout(600);
			await s.shot(notes, `note${i + 1}-object-menu`);
			const menuText = await notes
				.locator('[role="menu"]')
				.innerText()
				.catch(() => "(no menu)");
			s.note(`object menu rows: ${JSON.stringify(menuText)}`);
			const del = notes
				.locator('[role="menu"] .fm-row')
				.filter({ hasText: /^Delete( note)?$|^Move to Bin$/ })
				.first();
			expect(await del.count(), `Delete item in Notes menu (note ${i + 1})`).toBeGreaterThan(0);
			await del.click({ force: true });
			await notes.waitForTimeout(1000);
		}
		let items = await listBin();
		s.note(`bin items after seeding: ${items.length}`);
		expect(items.length).toBeGreaterThanOrEqual(2);

		// ── 1. Delete key on the active row ──
		await dash.locator('[aria-label="Open Bin"]').first().click();
		await dash.waitForTimeout(1200);
		await dash.locator('[data-testid="bin"] .bin__list').focus();
		await dash.waitForTimeout(300);
		await dash.keyboard.press("Delete");
		await dash.waitForTimeout(800);
		await s.shot(dash, "kbd-delete-confirm");
		const confirmBtn = dash.locator("button", { hasText: /^Delete forever$/ }).first();
		s.note(`Delete-key confirm dialog visible: ${(await confirmBtn.count()) > 0}`);
		expect(await confirmBtn.count(), "Delete key opens the purge confirm").toBeGreaterThan(0);
		await confirmBtn.click({ force: true });
		await dash.waitForTimeout(1500);
		const afterKbd = await listBin();
		s.note(`bin after Delete-key purge: ${afterKbd.length} (was ${items.length})`);
		expect(afterKbd.length, "Delete key purges the active row").toBe(items.length - 1);

		// ── 2. Multi-select bulk purge ──
		items = afterKbd;
		// The checkbox input is visually hidden — force the click.
		const selectAll = dash.locator('[data-testid="bin"] [aria-label="Select all"]');
		await selectAll.click({ force: true });
		await dash.waitForTimeout(500);
		await s.shot(dash, "all-selected");
		const bulkPurge = dash
			.locator('[data-testid="bin"] .bin__selection-actions button', {
				hasText: /^Delete forever$/,
			})
			.first();
		expect(await bulkPurge.count(), "bulk Delete-forever button present").toBeGreaterThan(0);
		await bulkPurge.click();
		await dash.waitForTimeout(700);
		const confirm2 = dash.locator("button", { hasText: /^Delete forever$/ }).last();
		await confirm2.click({ force: true });
		await dash.waitForTimeout(2000);
		await s.shot(dash, "after-bulk-purge");
		const afterBulk = await listBin();
		s.note(`bin after bulk purge: ${afterBulk.length}`);
		expect(afterBulk.length, "multi-select purge drains the selection").toBe(0);

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
	} finally {
		await s.finish();
	}
});
