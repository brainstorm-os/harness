/**
 * Session 079 — Mira scans her agenda.
 *
 * The last uncovered Calendar layout: the Agenda view — a flat, date-bucketed
 * list of what's coming. She switches to it to read her schedule end-to-end
 * (newsletter sends + draft deliverables) in one column. Completes Calendar
 * view coverage (Month 073, Week 077, now Agenda).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("scan the upcoming agenda", async () => {
	test.setTimeout(180_000);
	const s = await startSession("079-agenda-view");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);

		await cal.locator('.cal-toolbar__tab[data-view="agenda"]').first().click();
		await cal.waitForTimeout(700);
		await s.shot(cal, "01-agenda");
		await expect(cal.locator(".cal-agenda").first(), "Agenda view rendered").toBeVisible();

		const items = (await cal.locator(".cal-chip").allInnerTexts()).map((t) => t.trim());
		s.note(`agenda items: ${JSON.stringify(items)}`);

		// Her schedule should surface here — the newsletter sends and/or the
		// draft deliverables she scheduled across this period.
		expect(items.length, "the agenda lists upcoming items").toBeGreaterThanOrEqual(1);
		expect(
			items.some((i) => /Newsletter|Draft Issue/i.test(i)),
			"her newsletter/deliverable schedule shows in the agenda",
		).toBe(true);
	} finally {
		await s.finish();
	}
});
