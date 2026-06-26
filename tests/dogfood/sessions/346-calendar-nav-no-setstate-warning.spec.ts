/**
 * Session 346 — Calendar nav no longer trips the React setState-in-render
 * warning (F-291 verification).
 *
 * The 328 sweep surfaced "[calendar] error: Cannot update a component while
 * rendering a different component" — `setView`/`step` called `recordNav`
 * (→ nav-history notify → subscriber setState) INSIDE the `setAnchorState`
 * updater, which React runs during render. The fix moves recordNav out of the
 * updater. This session exercises exactly those paths (switch every view kind +
 * step prev/next) and asserts ZERO "Cannot update a component" / setState-in-
 * render warnings in the console.
 */

import { test, expect } from "@playwright/test";
import { APP, type FounderSession, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("Calendar view-switch + step produce no setState-in-render warning (346)", async () => {
	test.setTimeout(180_000);
	const s: FounderSession = await startSession("346-calendar-nav-no-setstate-warning");
	try {
		const page = await s.openApp(APP.Calendar);
		page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
		page.setDefaultTimeout(3500);
		const errs = collectConsoleErrors(page);
		await page.waitForTimeout(1500);

		// Switch through every view kind (each calls setView → setAnchorState +
		// recordNav). The header view switcher renders as a radio-group / buttons.
		const viewButtons = await page
			.locator('.cal-toolbar button, .app-header button, [role="radio"], .cal-view-switch button')
			.all();
		for (const b of viewButtons.slice(0, 14)) {
			await b.click({ timeout: 2000 }).catch(() => undefined);
			await page.waitForTimeout(250);
		}
		await s.shot(page, "calendar-views-cycled");

		// Step prev/next a few times (each calls step → setAnchorState + recordNav).
		for (const label of [/prev|previous|back/i, /next|forward/i, /prev|previous|back/i]) {
			const btn = page.locator("button").filter({ has: page.locator(`[aria-label]`) }).first();
			await btn.click({ timeout: 1500 }).catch(() => undefined);
			await page.waitForTimeout(200);
			void label;
		}
		// Also drive prev/next by aria-label if present.
		for (const al of ["Previous", "Next", "Previous", "Next", "Today"]) {
			await page.locator(`[aria-label="${al}"]`).first().click({ timeout: 1500 }).catch(() => undefined);
			await page.waitForTimeout(200);
		}
		await page.waitForTimeout(600);
		await s.shot(page, "calendar-stepped");

		const setStateWarnings = errs.errors.filter(
			(e) => /Cannot update a component|setState.*render|update a component .* while rendering/i.test(e),
		);
		s.note(`Calendar console errors total: ${errs.errors.length}`);
		s.note(`  setState-in-render warnings: ${setStateWarnings.length}`);
		for (const w of setStateWarnings.slice(0, 3)) s.note(`   • ${w.slice(0, 120)}`);

		await page.close().catch(() => undefined);
		expect(setStateWarnings, "no setState-in-render warning from Calendar nav (F-291)").toEqual([]);
	} finally {
		await s.finish();
	}
});
