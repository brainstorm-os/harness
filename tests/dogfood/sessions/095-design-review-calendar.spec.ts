/**
 * Session 095 — Marcus reviews the Calendar app.
 *
 * Third design review by the designer persona — a different surface (temporal
 * layout, no right-panel-over-content issue to re-find). He judges the month
 * grid, the agenda list, and how events vs tasks read. Captures the states;
 * the critique (substantiated, his voice) lands in the friction log.
 *
 * No app-source change → SKIP_BUILD.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("design review — Calendar (Marcus)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("095-design-review-calendar");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);

		// Month — density, event-chip truncation, events vs tasks, today marker.
		await cal.locator('.cal-toolbar__tab[data-view="month"]').first().click();
		await cal.waitForTimeout(600);
		await s.shot(cal, "01-month");

		// Agenda — the date-group label format + how untimed items read.
		await cal.locator('.cal-toolbar__tab[data-view="agenda"]').first().click();
		await cal.waitForTimeout(600);
		await s.shot(cal, "02-agenda");
		const chips = (await cal.locator(".cal-chip").allInnerTexts()).map((t) => t.trim());
		s.note(`agenda chips: ${JSON.stringify(chips)}`);

		// Week — the hourly grid + all-day band + how a no-time task renders.
		await cal.locator('.cal-toolbar__tab[data-view="week"]').first().click();
		await cal.waitForTimeout(600);
		await s.shot(cal, "03-week");

		s.note("captured month/agenda/week for Marcus's review (critique in friction-log)");
	} finally {
		await s.finish();
	}
});
