/**
 * Session 019 — deep dogfood of Calendar: create an event, verify it lands.
 *
 * Opens Calendar, inventories its header affordances, drives the "New event"
 * composer (title + save), and checks the event appears on the grid. Cleans
 * up by deleting the created event. Console/page errors collected throughout.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const TITLE = "Dogfood 019 event";

test("Calendar: create an event via the composer", async () => {
	test.setTimeout(180_000);
	const s = await startSession("019-calendar-deep");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1800);
		await s.shot(cal, "calendar-initial");

		const labels = await cal.evaluate(() =>
			[
				...new Set(
					Array.from(document.querySelectorAll("[aria-label]")).map(
						(e) => e.getAttribute("aria-label") ?? "",
					),
				),
			].filter(Boolean),
		);
		s.note(`header aria-labels: ${labels.slice(0, 30).join(" · ")}`);

		// Open the New-event composer.
		const newBtn = cal
			.locator('[aria-label="New event"], [aria-label="New Event"], [aria-label="Add event"]')
			.first();
		if ((await newBtn.count()) === 0) {
			s.note("no New-event button found — aborting create");
			expect(errors, "no console errors").toEqual([]);
			return;
		}
		await newBtn.click();
		await cal.waitForTimeout(1000);
		await s.shot(cal, "composer-open");

		// Fill the title (placeholder "Event title") directly, then commit via the
		// composer's "Save event" button. .fill dispatches the input event the
		// form's state listens for; the start/end dates are pre-filled.
		const title = cal.locator('[placeholder="Event title"]').first();
		if ((await title.count()) > 0) {
			await title.fill(TITLE);
			await cal.waitForTimeout(300);
			await cal.getByRole("button", { name: "Save event" }).first().click();
			await cal.waitForTimeout(1500);
		} else {
			s.note("composer opened but no 'Event title' field found");
		}
		await s.shot(cal, "after-create");

		// Verify via the Agenda view — Month view collapses a day's overflow
		// events into "+N more" (out of the DOM), so a freshly-added 4th event
		// on a busy day wouldn't be found by a text scan there.
		await cal.getByText("Agenda", { exact: true }).first().click();
		await cal.waitForTimeout(1200);
		await s.shot(cal, "agenda");
		const appeared = (
			await cal
				.locator("body")
				.innerText()
				.catch(() => "")
		).includes(TITLE);
		s.note(`event "${TITLE}" visible in Agenda: ${appeared}`);

		// ── Cleanup: delete every "Dogfood 019 event" (this run + any leftover)
		// via Agenda row → event detail → danger Delete (no confirm dialog). ──
		let deleted = 0;
		try {
			for (let i = 0; i < 8; i += 1) {
				const row = cal.locator(".cal-agenda__row", { hasText: TITLE }).first();
				if ((await row.count()) === 0) break;
				await row.click();
				await cal.waitForTimeout(700);
				const del = cal.locator(".bs-btn--danger").first();
				if ((await del.count()) === 0) break;
				await del.click();
				await cal.waitForTimeout(900);
				deleted += 1;
			}
		} catch (e) {
			s.note(`cleanup stopped: ${(e as Error).message.split("\n")[0]}`);
		}
		s.note(`deleted ${deleted} "${TITLE}" event(s)`);
		await s.shot(cal, "after-cleanup");

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(appeared, "the created event should appear on the calendar").toBe(true);
		expect(errors, "no console/page errors during Calendar create").toEqual([]);
	} finally {
		await s.finish();
	}
});
