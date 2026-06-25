/**
 * Session 129 — Marcus design-reviews the Calendar surface.
 *
 * Calendar carries interviews, publishing dates and advisory calls, so Marcus
 * scrutinizes it across views: the resting month, the view switcher
 * (month/week/day/agenda), the toolbar, and whether events read consistently.
 * Spec posts intent/neutral only — the design verdict is decided from the
 * captures after the run.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Calendar surface (129)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("129-marcus-calendar-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Reviewing Calendar — it holds interviews and publish dates, so the views have to be legible and consistent. Walking month → week → day → agenda.",
		);

		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2000);
		await s.shot(cal, "01-resting");

		const toolbar = await cal
			.locator(".cal-toolbar")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 8),
			)
			.catch(() => [] as string[]);
		s.note(`Calendar toolbar text: ${JSON.stringify(toolbar)}`);

		for (const view of ["month", "week", "day", "agenda"]) {
			const tab = cal.locator(`.cal-toolbar__tab[data-view="${view}"]`).first();
			if (await tab.count()) {
				await tab.click().catch(() => undefined);
				await cal.waitForTimeout(1100);
				await s.shot(cal, `02-view-${view}`);
			} else {
				s.note(`view tab not found: ${view}`);
			}
		}

		const events = await cal
			.locator("[class*='event'], [class*='chip'], .cal-week__slot")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`Event/chip text sample: ${JSON.stringify(events)}`);

		s.chat(SPEAKER.Marcus, "Walked all four views — pulling my notes from the captures.");
		s.note("Marcus reviewed the Calendar surface; verdict from captures.");
	} finally {
		await s.finish();
	}
});
