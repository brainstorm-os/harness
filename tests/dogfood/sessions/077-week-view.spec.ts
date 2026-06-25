/**
 * Session 077 — Mira reviews her week in the Calendar's Week view.
 *
 * Having put the newsletter sends on the calendar (073), she switches to Week
 * view and pages forward to the week of the first send to see it laid out by
 * hour against the rest of her schedule. Exercises the uncovered Week view +
 * week-by-week navigation (Month view was covered in 073). A coverage pass over
 * the calendar's other layout — the kind of corner that hides layout friction.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("review the publishing week in Week view", async () => {
	test.setTimeout(180_000);
	const s = await startSession("077-week-view");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);

		await cal.locator('.cal-toolbar__tab[data-view="week"]').first().click();
		await cal.waitForTimeout(600);
		await s.shot(cal, "01-week");
		await expect(cal.locator(".cal-week").first(), "Week view rendered").toBeVisible();

		// Page forward week-by-week until the first newsletter send shows (it's
		// 9 June; today is the 3rd, so it's within a click or two).
		const next = cal.locator(".cal-toolbar__nav .bs-date-pager__arrow--next").first();
		let found = false;
		for (let i = 0; i < 4; i++) {
			const chips = (await cal.locator(".cal-chip").allInnerTexts()).map((t) => t.trim());
			if (chips.some((c) => /Newsletter #1/i.test(c))) {
				found = true;
				s.note(`found Newsletter #1 in week view after ${i} forward step(s)`);
				break;
			}
			await next.click();
			await cal.waitForTimeout(500);
		}
		await s.shot(cal, "02-publishing-week");

		const chips = (await cal.locator(".cal-chip").allInnerTexts()).map((t) => t.trim());
		s.note(`chips in view: ${JSON.stringify(chips)}`);
		expect(found, "the first newsletter send is visible in Week view").toBe(true);
	} finally {
		await s.finish();
	}
});
