/**
 * Session 038 — Mira schedules a meeting with her top lead. Opens Calendar,
 * creates "Vertex Labs — intro call" via the New-event surface, saves, and
 * confirms it lands on the calendar. Dogfoods the Calendar create flow.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("schedule a meeting on the calendar", async () => {
	test.setTimeout(180_000);
	const s = await startSession("038-schedule-meeting");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);
		await s.shot(cal, "01-calendar-open");

		const newBtn = cal.locator(".cal-toolbar__new").first();
		s.note(`New-event button present: ${(await newBtn.count()) > 0}`);
		await newBtn.click();
		await cal.waitForTimeout(600);

		const title = cal.locator(".cal-detail__input--title").first();
		s.note(`Create surface opened: ${(await title.count()) > 0}`);
		await title.fill("Vertex Labs — intro call");
		// Set an explicit start time if a datetime field is present.
		const dt = cal.locator('.cal-detail input[type="datetime-local"]');
		const nDt = await dt.count();
		s.note(`datetime-local inputs: ${nDt}`);
		if (nDt > 0) {
			await dt
				.first()
				.fill("2026-06-18T14:00")
				.catch(() => undefined);
		}
		await s.shot(cal, "02-event-form");

		await cal.locator("[data-bs-primary]").first().click();
		await cal.waitForTimeout(900);
		await s.shot(cal, "03-after-save");

		const body =
			(await cal
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		const created = /Vertex Labs — intro call/.test(body);
		s.note(`Meeting visible on calendar: ${created}`);
		if (!created) {
			// It may be on a different day/view; note the current heading.
			const heading =
				(await cal
					.locator(".cal-toolbar, .cal-header, h1, h2")
					.first()
					.innerText()
					.catch(() => "")) ?? "";
			s.note(
				`Current view heading: ${JSON.stringify(heading.replace(/\s+/g, " ").trim().slice(0, 80))}`,
			);
		}

		expect(created).toBe(true);
	} finally {
		await s.finish();
	}
});
