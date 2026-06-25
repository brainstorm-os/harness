/**
 * Session 073 — Mira puts the newsletter publishing schedule on the Calendar.
 *
 * The Content Calendar (065–067) holds the publish dates as data; the Calendar
 * app is where she sees them against the rest of her week. She creates a timed
 * Event for each issue's send (9 / 16 / 23 June, 09:00). Composes with the
 * editorial pipeline (same dates) and exercises the Calendar create path:
 * header "New event" → the shared detail popover (title + start/end
 * datetime-local) → Save. Asserted in Month view. Idempotent: an issue already
 * on the calendar is skipped.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Send = { title: string; key: string; start: string; end: string };
const SENDS: Send[] = [
	{
		title: "Newsletter #1 — dev-tools infra",
		key: "Newsletter #1",
		start: "2026-06-09T09:00",
		end: "2026-06-09T10:00",
	},
	{
		title: "Newsletter #2 — pricing power",
		key: "Newsletter #2",
		start: "2026-06-16T09:00",
		end: "2026-06-16T10:00",
	},
	{
		title: "Newsletter #3 — when to raise",
		key: "Newsletter #3",
		start: "2026-06-23T09:00",
		end: "2026-06-23T10:00",
	},
];

test("schedule the newsletter sends on the calendar", async () => {
	test.setTimeout(180_000);
	const s = await startSession("073-publishing-schedule");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);

		// Month view — June 2026 (today is 3 June, so the sends are all on-screen).
		await cal.locator('.cal-toolbar__tab[data-view="month"]').first().click();
		await cal.waitForTimeout(600);
		await s.shot(cal, "01-month-before");

		const onCalendar = async (key: string): Promise<boolean> => {
			const items = (await cal.locator(".cal-month__item").allInnerTexts()).map((t) => t.trim());
			return items.some((i) => i.includes(key));
		};

		for (const send of SENDS) {
			if (await onCalendar(send.key)) {
				s.note(`"${send.key}" already on the calendar — skipping`);
				continue;
			}
			await cal.locator(".cal-toolbar__new").first().click();
			await cal.waitForTimeout(500);
			const detail = cal.locator(".cal-detail").first();
			await expect(detail, `detail popover opened for ${send.key}`).toBeVisible();
			await detail.locator(".cal-detail__input--title").fill(send.title);
			const dts = detail.locator('input[type="datetime-local"]');
			await dts.nth(0).fill(send.start);
			await dts.nth(1).fill(send.end);
			await cal.waitForTimeout(150);
			// Save lives in the popover footer (a sibling of the .cal-detail form),
			// so target it at page level.
			await cal.locator("[data-bs-primary]").first().click();
			await cal.waitForTimeout(900);
			s.note(`scheduled "${send.key}" on ${send.start.slice(0, 10)}`);
		}

		await cal.locator('.cal-toolbar__tab[data-view="month"]').first().click();
		await cal.waitForTimeout(600);
		await s.shot(cal, "02-month-after");

		const items = (await cal.locator(".cal-month__item").allInnerTexts()).map((t) => t.trim());
		s.note(`month items: ${JSON.stringify(items)}`);

		for (const send of SENDS) {
			expect(
				items.some((i) => i.includes(send.key)),
				`${send.key} is on the calendar`,
			).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
