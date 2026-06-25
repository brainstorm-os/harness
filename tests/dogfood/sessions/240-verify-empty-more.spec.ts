/**
 * Session 240 — verify F-249: the trailing object ⋯ is live (opens a menu of
 * view-level actions) in Journal's default empty-today state and Books' default
 * no-selection library state, instead of a dead/disabled ⋯.
 *
 * Opens each app, clicks the header ⋯, and records whether a menu became
 * visible + how many items it has. Captures a screenshot of the open menu.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

const MENU = ".bs-object-menu, .fm-menu, [role='menu']";

async function clickMoreAndCapture(
	s: Awaited<ReturnType<typeof startSession>>,
	page: Page,
	name: string,
): Promise<{ opened: boolean; items: number }> {
	const more = page
		.locator(
			'.bs-object-menu__more, .app-header button[aria-label*="More" i], .app-header button[aria-label*="actions" i]',
		)
		.last();
	await more.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
	await more.click().catch(() => undefined);
	await page.waitForTimeout(700);
	const opened = await page
		.locator(MENU)
		.first()
		.isVisible()
		.catch(() => false);
	const items = await page
		.locator(`${MENU} [role='menuitem'], .fm-menu .fm-row, .bs-object-menu__item`)
		.count()
		.catch(() => 0);
	s.note(`${name}: ⋯ opened=${opened} items=${items}`);
	await s.shot(page, `${name}-more-open`);
	await page.keyboard.press("Escape").catch(() => undefined);
	return { opened, items };
}

test("F-249 — Journal & Books header ⋯ open view-level menus in their default state (240)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("240-verify-empty-more");
	try {
		const journal = await s.openApp(APP.Journal as AppId);
		await journal.waitForTimeout(2500);
		const j = await clickMoreAndCapture(s, journal, "journal");
		expect(j.opened, "journal empty-day ⋯ should open a menu").toBe(true);

		const books = await s.openApp(APP.Books as AppId);
		await books.waitForTimeout(2500);
		const b = await clickMoreAndCapture(s, books, "books");
		expect(b.opened, "books no-selection ⋯ should open a menu").toBe(true);

		// F-250 — Files "+New" opens an anchored fancy-menu dropping from the +
		// button (not a centred bespoke popover).
		const files = await s.openApp(APP.Files as AppId);
		await files.waitForTimeout(2500);
		const newBtn = files.locator('[data-testid="toolbar-new"]');
		await newBtn.click().catch(() => undefined);
		await files.waitForTimeout(600);
		const fMenuVisible = await files
			.locator(MENU)
			.first()
			.isVisible()
			.catch(() => false);
		// The anchored menu drops from the + button (right edge of the header),
		// so its left edge is well past the viewport mid-point — proving it is
		// anchored, not centred.
		const box = await files
			.locator(MENU)
			.first()
			.boundingBox()
			.catch(() => null);
		const anchoredRight = !!box && box.x > 700;
		s.note(`files +New: opened=${fMenuVisible} anchoredRight=${anchoredRight} x=${box?.x ?? "n/a"}`);
		await s.shot(files, "files-new-menu-open");
		expect(fMenuVisible, "files +New should open a menu").toBe(true);
		expect(anchoredRight, "files +New menu should anchor under the + (not centre)").toBe(true);
	} finally {
		await s.finish();
	}
});
