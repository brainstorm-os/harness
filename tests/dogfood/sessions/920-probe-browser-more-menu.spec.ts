/**
 * Probe 920 — "browser more menu does not work" (owner report 2026-07-31).
 *
 * Root cause: the page is a native WebContentsView stacked ABOVE the app's
 * chrome view, so any floating popup (the ⋯ menu, history menu, shield menu,
 * omnibox typeahead) rendered into the chrome DOM below the toolbar was
 * painted over by the page — the menu "opened" in the DOM but the user saw
 * nothing. Fix: while any popup is up the chrome raises itself above the
 * page (`SetChromeOnTop`), and `.browser__region` is a real alpha hole so
 * the page stays visible; the page view is re-stacked on top when the popup
 * stack empties.
 *
 * This probe drives the real shell with a page loaded and asserts the
 * MAIN-process child-view stacking order flips while the menu is open and
 * restores after Escape.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type StackEntry = { url: string; visible: boolean };

test("probe: the browser ⋯ menu opens above a loaded page and restores (920)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("920-probe-browser-more-menu");
	try {
		const br = await s.openApp(APP.Browser);
		const consoleLines: string[] = [];
		br.on("console", (msg) => {
			if (msg.type() === "error" || msg.type() === "warning")
				consoleLines.push(`[${msg.type()}] ${msg.text()}`);
		});
		br.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));
		await br.waitForTimeout(3000);
		await s.shot(br, "01-browser-boot");

		// Load a real page — the occlusion only exists with a page view mounted.
		const omnibox = br.locator('[aria-label="Address bar"]').first();
		await omnibox.click();
		await omnibox.fill("https://example.com");
		await omnibox.press("Enter");
		await br.waitForTimeout(5000);
		await s.shot(br, "02-page-loaded");

		// MAIN-process stacking order of the browser window's child views,
		// bottom → top (last = painted on top).
		const stacking = (): Promise<StackEntry[]> =>
			s.app.evaluate(({ BaseWindow }) => {
				type AnyView = {
					getVisible?: () => boolean;
					webContents?: { getURL(): string; isDestroyed(): boolean };
					children?: AnyView[];
				};
				for (const win of BaseWindow.getAllWindows()) {
					const content = (win as unknown as { contentView: AnyView }).contentView;
					const kids = content.children ?? [];
					const entries = kids.map((child) => ({
						url:
							child.webContents && !child.webContents.isDestroyed()
								? child.webContents.getURL()
								: "<no-wc>",
						visible: child.getVisible ? child.getVisible() : true,
					}));
					if (entries.some((e) => e.url.startsWith("https://example.com"))) return entries;
				}
				return [];
			});

		const isPage = (e: StackEntry) => e.url.startsWith("https://example.com");
		const isChrome = (e: StackEntry) => e.url.includes("io.brainstorm.browser");

		const before = await stacking();
		s.note(`stack before menu: ${JSON.stringify(before)}`);
		// Baseline: page above chrome (normal browsing order).
		expect(before.findIndex(isPage)).toBeGreaterThan(before.findIndex(isChrome));

		await br.locator('button[aria-label="Browser menu"]').click();
		await br.waitForTimeout(800);
		await s.shot(br, "03-menu-open-over-page");

		const menuRows = await br.evaluate(() =>
			Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] .fm-row')).map(
				(row) => (row.textContent ?? "").trim(),
			),
		);
		s.note(`menu rows: ${JSON.stringify(menuRows)}`);
		expect(menuRows.join(" | ")).toContain("New private tab");

		const during = await stacking();
		s.note(`stack with menu open: ${JSON.stringify(during)}`);
		// THE fix: while the popup is up the chrome is above the page, so the
		// menu is actually visible (and the popup dimmer owns input).
		expect(during.findIndex(isChrome)).toBeGreaterThan(during.findIndex(isPage));

		await br.keyboard.press("Escape");
		await br.waitForTimeout(800);
		const after = await stacking();
		s.note(`stack after close: ${JSON.stringify(after)}`);
		// Restore: page back on top so it gets pointer input again.
		expect(after.findIndex(isPage)).toBeGreaterThan(after.findIndex(isChrome));
		expect(after.find(isPage)?.visible).toBe(true);

		await s.shot(br, "04-menu-closed");
		s.note(`console: ${JSON.stringify(consoleLines.slice(-20))}`);
	} finally {
		await s.finish();
	}
});
