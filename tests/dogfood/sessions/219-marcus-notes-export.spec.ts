/**
 * Session 219 — Marcus verifies Notes export now goes through the shared
 * export popover: open the note ⋯ menu, click "Export…", capture the popover.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus verifies the Notes export popover (219)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("219-marcus-notes-export");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Notes export should open the shared popover now — checking the ⋯ → Export… flow.",
		);
		const page = await s.openApp(APP.Notes);
		await page.waitForTimeout(2600);
		// Open the header object ⋯ menu.
		await page
			.locator(".app-header .bs-object-menu__more, .app-header button[aria-label*='ore']")
			.first()
			.click()
			.catch((e) => s.note(`⋯ click: ${(e as Error).message.slice(0, 60)}`));
		await page.waitForTimeout(700);
		await s.shot(page, "notes-object-menu");
		// Click the Export… row.
		const exportRow = page
			.locator("[role='menuitem']:has-text('Export'), .bs-object-menu__item:has-text('Export')")
			.first();
		s.note(`Export… row present: ${await exportRow.count().catch(() => 0)}`);
		await exportRow
			.click()
			.catch((e) => s.note(`Export row click: ${(e as Error).message.slice(0, 60)}`));
		await page.waitForTimeout(700);
		const popover = await page
			.locator(".bs-popover")
			.count()
			.catch(() => 0);
		s.note(`export popover open: ${popover}`);
		await s.shot(page, "notes-export-popover");
		s.chat(SPEAKER.Marcus, "Captures in.");
	} finally {
		await s.finish();
	}
});
