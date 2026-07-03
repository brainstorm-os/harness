/**
 * Session 374b — bin purge persistence + Empty Bin.
 *
 * Test 1: boot — the item purged by 374 must still be gone; then Empty Bin
 * via the real footer button + confirm, assert the list drains to zero.
 * Test 2: fresh boot — the Bin must STILL be empty (purges persist across
 * restart; a resurrected row means something re-materializes entity rows).
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

const PURGED_BY_374 = "task-e6ed7ade-2951-434c-acf1-03ad7ab73d47";

type BinBridge = {
	brainstorm: { bin: { list(): Promise<Array<{ id: string; title: string }>> } };
};

test("bin: empty-bin drains the list", async () => {
	test.setTimeout(300_000);
	const s = await startSession("374b-bin-empty");
	const dash = s.dashboard;
	const listBin = () =>
		dash.evaluate(() => (window as unknown as BinBridge).brainstorm.bin.list());
	try {
		await dash.waitForTimeout(1500);
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		const items = await listBin();
		s.note(`bin items at boot: ${items.length}`);
		expect(
			items.some((it) => it.id === PURGED_BY_374),
			"item purged in session 374 must stay purged across restart",
		).toBe(false);

		await dash.locator('[aria-label="Open Bin"]').first().click();
		await dash.waitForTimeout(1000);
		await dash.locator("button", { hasText: /^Empty Bin$/ }).first().click();
		await dash.waitForTimeout(600);
		await s.shot(dash, "empty-confirm");
		const confirmBtn = dash.locator("button", { hasText: /^Empty Bin$/ }).last();
		await confirmBtn.click({ force: true });
		await dash.waitForTimeout(2500);
		await s.shot(dash, "after-empty");

		const after = await listBin();
		s.note(`bin items after Empty Bin: ${after.length}`);
		expect(after.length, "Empty Bin must drain the list").toBe(0);
	} finally {
		await s.finish();
	}
});

test("bin: stays empty on a fresh boot", async () => {
	test.setTimeout(180_000);
	const s = await startSession("374b-bin-empty-reboot");
	const dash = s.dashboard;
	try {
		await dash.waitForTimeout(2000);
		const items = await dash.evaluate(() =>
			(window as unknown as BinBridge).brainstorm.bin.list(),
		);
		s.note(`bin items on fresh boot: ${items.length}`);
		for (const it of items.slice(0, 10)) s.note(`  resurrected: ${it.id} "${it.title}"`);
		expect(items.length, "purged objects must not resurrect across restart").toBe(0);
	} finally {
		await s.finish();
	}
});
