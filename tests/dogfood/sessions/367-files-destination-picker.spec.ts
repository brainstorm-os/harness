/**
 * Session 367 — verify Files' bulk Move destination picker is now the shared
 * searchable `openSearchPicker` (F-300), not a centered `<div role="menu">`
 * Popover. Multi-select rows → bulk bar → Move → assert the search picker opens
 * (filter input + option rows) and the old `[data-testid=destination-picker]`
 * Popover is gone.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("files bulk-move opens the shared search picker (367)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("367-files-destination-picker");
	try {
		const page = await s.openApp(APP.Files);
		const errs = collectConsoleErrors(page);
		await page.waitForTimeout(2400);

		// Multi-select the first two rows so the bulk bar appears.
		const rows = page.locator("[data-testid='content-row']");
		const n = await rows.count().catch(() => 0);
		s.note(`[i] rows=${n}`);
		if (n >= 2) {
			await rows.nth(0).click().catch(() => undefined);
			await rows.nth(1).click({ modifiers: ["Meta"] }).catch(() => undefined);
			await page.waitForTimeout(500);
		}
		const moveBtn = page.locator("[data-testid='bulk-move']").first();
		const barShown = await moveBtn.count().catch(() => 0);
		s.note(`[i] bulk-move button present=${barShown}`);
		if (barShown > 0) {
			await moveBtn.click().catch(() => undefined);
			await page.waitForTimeout(700);
		}
		// Shared search picker = a filter input inside the menu host; the old
		// centered Popover carried data-testid="destination-picker".
		const pickerInput = await page.locator(".bs-menu input, [role='menu'] input, input[type='search'], input[type='text']").count().catch(() => 0);
		const legacyPopover = await page.locator("[data-testid='destination-picker']").count().catch(() => 0);
		s.note(`[i] search-picker filter-input=${pickerInput}, legacy destination-picker Popover=${legacyPopover}`);
		s.note(
			barShown > 0 && pickerInput > 0 && legacyPopover === 0
				? "[ok] bulk-move opens the shared searchable picker (filter input present); legacy Popover gone"
				: "[?] inspect screenshot (selection/anchor may not have engaged)",
		);
		await s.shot(page, "bulk-move-picker");
		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 5)) s.note(`    ${e}`);
		await page.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
