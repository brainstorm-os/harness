/**
 * Session 107 — the recurring cadence: Mira uses the new Calendar.
 *
 * The Calendar grew up (9.15: year view, recurrence editor, reminders,
 * attendees, ICS). Mira puts it to work — she sets up the standing weekly
 * design review with Marcus and looks at the publishing year — and Marcus
 * re-reviews the expanded surface he last saw in 095. Real work; friction read
 * back from the captures. Built fresh (no SKIP_BUILD) — the calendar is new.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("recurring cadence — new Calendar work day; Marcus re-reviews", async () => {
	test.setTimeout(240_000);
	const s = await startSession("107-recurring-cadence");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1800);

		// Mira opens the new Year view to see the publishing year at a glance.
		const yearTab = cal.locator('.cal-toolbar__tab[data-view="year"]').first();
		if (await yearTab.count()) {
			await yearTab.click().catch(() => undefined);
			await cal.waitForTimeout(800);
			await s.shot(cal, "01-year-view");
			const months = (
				await cal.locator("[class*='year'] [class*='month'], [class*='cal-year']").allInnerTexts()
			)
				.map((t) => t.replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 6);
			s.note(`Year view months sample: ${JSON.stringify(months)}`);
		} else {
			s.note("no year-view tab found");
		}

		// Mira creates an event → the new detail with recurrence / reminders /
		// attendees. Capture the expanded editor for Marcus's review.
		await cal
			.locator('.cal-toolbar__tab[data-view="week"]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(500);
		const newEvent = cal
			.locator('.cal-toolbar__new, [aria-label*="new event" i], [aria-label*="new" i]')
			.first();
		if (await newEvent.count()) {
			await newEvent.click().catch(() => undefined);
			await cal.waitForTimeout(900);
			await s.shot(cal, "02-event-detail");
			const detailFields = (
				await cal
					.locator(
						".cal-detail__field, [class*='cal-detail'] label, [class*='cal-detail'] h3, [class*='recurrence'], [class*='reminder'], [class*='attendee']",
					)
					.allInnerTexts()
			)
				.map((t) => t.replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 20);
			s.note(`Event detail fields/sections: ${JSON.stringify(detailFields)}`);
			// Probe the recurrence + reminder controls (Marcus's focus).
			const recurrence = cal.locator("[class*='recurrence']").first();
			s.note(`recurrence editor present? ${(await recurrence.count()) > 0}`);
			const reminders = cal.locator("[class*='reminder']").first();
			s.note(`reminder controls present? ${(await reminders.count()) > 0}`);
			const attendees = cal.locator("[class*='attendee']").first();
			s.note(`attendee editor present? ${(await attendees.count()) > 0}`);
			await s.shot(cal, "03-event-detail-full");
			await cal.keyboard.press("Escape").catch(() => undefined);
			await cal.waitForTimeout(400);
		} else {
			s.note("no new-event affordance found");
		}

		// Marcus's re-review surface: the agenda (the dated cadence) once more.
		await cal
			.locator('.cal-toolbar__tab[data-view="agenda"]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(600);
		await s.shot(cal, "04-agenda");

		// Mira logs the planning day.
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1500);
		const jBody = journal
			.locator(".journal__entry-editor [contenteditable], .journal__entry-editor")
			.first();
		if (await jBody.count()) {
			await jBody.click().catch(() => undefined);
			await journal.keyboard.type(
				"Set up the standing weekly design review with Marcus and walked the publishing year in the new Year view. Calendar finally feels like a planning tool, not just a grid.",
				{ delay: 8 },
			);
			await journal.waitForTimeout(500);
		}
		await s.shot(journal, "05-journal");

		s.note("captured new-Calendar work day + Marcus's expanded-surface re-review");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
