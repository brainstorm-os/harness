/**
 * Session 912b — isolate the Calendar date-anchor drift found in 912.
 *
 * In 912, cycling views left the month grid on "January 2026" while today
 * is July 23 2026. This narrows the trigger: (1) open → Year → Month, does
 * the month return to today or land on January? (2) open → Agenda directly,
 * does it show today or January?
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

async function header(page: import("@playwright/test").Page): Promise<string> {
	return (
		(await page
			.locator(".cal-toolbar__range")
			.first()
			.textContent()
			.catch(() => "")) ?? ""
	).trim();
}

test("Calendar anchor drift — Year→Month + direct Agenda (912b)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("912b-calendar-view-anchor-repro");
	s.chat(SPEAKER.Mira, "Which view switch loses my month? Let me narrow it down.");

	const cal = await s.openApp(APP.Calendar);
	await cal.waitForTimeout(1600);
	const start = await header(cal);
	s.note(`initial (should be current month, July 2026): "${start}"`);
	await s.shot(cal, "01-initial");

	// (1) Year → Month.
	await cal.locator(".cal-toolbar__tab", { hasText: /year/i }).first().click().catch(() => undefined);
	await cal.waitForTimeout(800);
	await s.shot(cal, "02-year");
	await cal.locator(".cal-toolbar__tab", { hasText: /month/i }).first().click().catch(() => undefined);
	await cal.waitForTimeout(800);
	const afterYearMonth = await header(cal);
	s.note(`after Year→Month (BUG if not the current month): "${afterYearMonth}"`);
	await s.shot(cal, "03-after-year-then-month");

	// Recover to today, then test direct Agenda from the current month.
	await cal.locator("button", { hasText: /^today$/i }).first().click().catch(() => undefined);
	await cal.waitForTimeout(600);
	const recovered = await header(cal);
	s.note(`after Today (should be current month): "${recovered}"`);

	// (2) Month → Agenda directly.
	await cal.locator(".cal-toolbar__tab", { hasText: /agenda/i }).first().click().catch(() => undefined);
	await cal.waitForTimeout(800);
	const agenda = await header(cal);
	s.note(`agenda header after direct switch (BUG if not around today): "${agenda}"`);
	await s.shot(cal, "04-direct-agenda");

	s.chat(
		SPEAKER.Mira,
		`Initial "${start}" → after Year→Month "${afterYearMonth}" → agenda "${agenda}". If those aren't all July-ish, the anchor's leaking.`,
	);
});
