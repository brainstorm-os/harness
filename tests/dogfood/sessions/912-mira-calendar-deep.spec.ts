/**
 * Session 912 — Mira does a DEEP single-app pass on the Calendar.
 *
 * One app, all of it: every view (month/week/day/year/agenda), navigation
 * (prev/next/today), opening a seeded event's detail, creating a new event,
 * the actions menu, search, and the sidebar. Capture + console-error watch
 * only; verdicts come from the screenshots afterward and land in the
 * friction log.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Mira deep-checks the Calendar — views · nav · event detail · create · menu (912)", async () => {
	test.setTimeout(360_000);
	const s = await startSession("912-mira-calendar-deep");
	s.chat(
		SPEAKER.Mira,
		"My whole week lives in the calendar, so today it gets the full treatment — every view, moving around, opening an event, making a new one, the lot. If something's off, I'll feel it here.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const cal = await s.openApp(APP.Calendar);
	await cal.waitForTimeout(1800);
	await s.shot(cal, "01-first-impression");

	// 1. Every view tab in turn.
	const viewLabels: Array<[string, string]> = [
		["month", "02-view-month"],
		["week", "03-view-week"],
		["day", "04-view-day"],
		["year", "05-view-year"],
		["agenda", "06-view-agenda"],
	];
	for (const [view, label] of viewLabels) {
		const tab = cal
			.locator(`.cal-toolbar__tab`, { hasText: new RegExp(view, "i") })
			.first();
		if ((await tab.count().catch(() => 0)) > 0) {
			await tab.click().catch(() => undefined);
			await cal.waitForTimeout(900);
			await s.shot(cal, label);
		} else {
			s.note(`view tab not found: ${view}`);
		}
	}

	// 2. Back to month, then navigate prev / next / today.
	const monthTab = cal.locator(".cal-toolbar__tab", { hasText: /month/i }).first();
	if ((await monthTab.count().catch(() => 0)) > 0) await monthTab.click().catch(() => undefined);
	await cal.waitForTimeout(700);
	for (const [aria, label] of [
		['[aria-label*="Next" i], [aria-label*="next" i]', "07-nav-next"],
		['[aria-label*="Previous" i], [aria-label*="prev" i]', "08-nav-prev"],
		['[aria-label*="Today" i], [aria-label*="today" i]', "09-nav-today"],
	] as const) {
		const btn = cal.locator(`.cal-toolbar__nav ${aria}, ${aria}`).first();
		if ((await btn.count().catch(() => 0)) > 0) {
			await btn.click().catch(() => undefined);
			await cal.waitForTimeout(700);
			await s.shot(cal, label);
		} else {
			s.note(`nav control not found: ${label}`);
		}
	}

	// 3. Open a seeded event → its detail / inspector.
	const event = cal.locator(".cal-month__item, .cal-month__ribbon-title").first();
	if ((await event.count().catch(() => 0)) > 0) {
		await event.click().catch(() => undefined);
		await cal.waitForTimeout(1000);
		await s.shot(cal, "10-event-detail");
		// Peek at the detail fields (title / date / status / reminders).
		const fieldCount = await cal
			.locator('[aria-label*="calendar.detail" i], .cal-detail, [class*="detail"]')
			.count()
			.catch(() => 0);
		s.note(`event-detail field-ish nodes: ${fieldCount}`);
		// Actions (⋯) menu on the event.
		const menu = cal.locator('[aria-label*="actions" i], [aria-label*="menu" i]').first();
		if ((await menu.count().catch(() => 0)) > 0) {
			await menu.click().catch(() => undefined);
			await cal.waitForTimeout(600);
			await s.shot(cal, "11-event-actions-menu");
			await cal.keyboard.press("Escape").catch(() => undefined);
		}
		await cal.keyboard.press("Escape").catch(() => undefined);
		await cal.waitForTimeout(400);
	} else {
		s.note("no seeded month event found to open");
	}

	// 4. Create a new event via the toolbar.
	const newBtn = cal
		.locator('.cal-toolbar__new, [aria-label*="new event" i], [aria-label*="New" i]')
		.first();
	if ((await newBtn.count().catch(() => 0)) > 0) {
		await newBtn.click().catch(() => undefined);
		await cal.waitForTimeout(1000);
		await s.shot(cal, "12-new-event-detail");
		// Type a title into the detail's title field.
		const title = cal
			.locator('[aria-label*="title" i], input[type="text"], [contenteditable="true"]')
			.first();
		if ((await title.count().catch(() => 0)) > 0) {
			await title.click().catch(() => undefined);
			await cal.keyboard.type("Q3 planning with Marcus", { delay: 12 });
			await cal.waitForTimeout(600);
			await s.shot(cal, "13-new-event-titled");
		} else {
			s.note("no title field in new-event detail");
		}
		await cal.keyboard.press("Escape").catch(() => undefined);
		await cal.waitForTimeout(500);
		await s.shot(cal, "14-after-new-event");
	} else {
		s.note("no New-event control found");
	}

	// 5. Search + sidebar toggle.
	const search = cal.locator('.cal-toolbar__search, [aria-label*="search" i]').first();
	if ((await search.count().catch(() => 0)) > 0) {
		await search.click().catch(() => undefined);
		await cal.waitForTimeout(600);
		await s.shot(cal, "15-search");
		await cal.keyboard.press("Escape").catch(() => undefined);
	}
	const sidebar = cal.locator('[aria-label*="sidebar" i]').first();
	if ((await sidebar.count().catch(() => 0)) > 0) {
		await sidebar.click().catch(() => undefined);
		await cal.waitForTimeout(600);
		await s.shot(cal, "16-sidebar-toggled");
	}

	// 6. Console-error tally.
	s.note(`console/page errors during the pass: ${errors.length}`);
	for (const e of errors.slice(0, 25)) s.note(`  ${e}`);
	s.chat(
		SPEAKER.Mira,
		errors.length === 0
			? "No errors in the console the whole way through — good. Now to eyeball the shots."
			: `Caught ${errors.length} console error(s) while poking around — flagged them in my notes.`,
	);
});
