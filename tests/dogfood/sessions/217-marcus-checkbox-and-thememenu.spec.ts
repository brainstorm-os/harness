/**
 * Session 217 — Marcus: (1) confirm bookmarks boolean props now render as
 * checkboxes (not switches) in the property panel, and (2) diagnose the
 * Theme-editor ⋯ menu — click it and capture whether a menu actually opens.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus verifies bookmark checkboxes + theme-editor menu (217)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("217-marcus-checkbox-and-thememenu");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Two checks: bookmark booleans should read as checkboxes now, and the theme-editor ⋯ should actually open a menu.",
		);

		// (1) Bookmarks — open, select the first bookmark, reveal the inspector,
		// shoot the property panel so the read/archived affordance is visible.
		try {
			const page = await s.openApp(APP.Bookmarks);
			await page.waitForTimeout(2500);
			await page
				.locator("[data-testid='bookmark-card'], .bookmarks__card, article, li")
				.first()
				.click()
				.catch(() => {});
			await page.waitForTimeout(800);
			// Inspector toggle if present.
			await page
				.locator("button[aria-label*='nspector'], button[aria-label*='roperties'], .bs-panel-toggle")
				.last()
				.click()
				.catch(() => {});
			await page.waitForTimeout(800);
			await s.shot(page, "bookmarks-inspector");
			const switches = await page
				.locator("[role='switch']")
				.count()
				.catch(() => -1);
			const checks = await page
				.locator("[role='checkbox'], input[type='checkbox'], .bs-checkbox, .bs-cell-checkbox")
				.count()
				.catch(() => -1);
			s.note(`bookmarks: role=switch count=${switches}, checkbox-ish count=${checks}`);
		} catch (e) {
			s.note(`bookmarks check failed: ${(e as Error).message.slice(0, 120)}`);
		}

		// (2) Theme-editor — open, screenshot, click the ⋯, screenshot again.
		try {
			const page = await s.openApp(APP.ThemeEditor);
			await page.waitForTimeout(2500);
			await s.shot(page, "theme-editor-before");
			const more = page
				.locator(".te-header__more, .bs-object-menu__more, button[aria-label*='ore']")
				.first();
			const present = await more.count().catch(() => 0);
			s.note(`theme-editor ⋯ present: ${present}`);
			if (present > 0) {
				await more.click().catch((e) => s.note(`⋯ click threw: ${(e as Error).message.slice(0, 80)}`));
				await page.waitForTimeout(700);
				const menuOpen = await page
					.locator(".bs-object-menu, .fm-menu, [role='menu']")
					.count()
					.catch(() => 0);
				s.note(`theme-editor menu open after click: ${menuOpen}`);
				await s.shot(page, "theme-editor-menu-clicked");
			}
		} catch (e) {
			s.note(`theme-editor check failed: ${(e as Error).message.slice(0, 120)}`);
		}

		s.chat(SPEAKER.Marcus, "Captures in.");
	} finally {
		await s.finish();
	}
});
