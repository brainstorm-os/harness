/**
 * Session 202 — Day 3: Mira reads the week by person (F-164 verify).
 *
 * Yesterday she could finally ASSIGN work (F-152); the missing half was the
 * read. Today the Upcoming header grew a "Group by assignee" toggle and rows
 * carry an assignee chip — this session is its first real-shell look.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Upcoming groups by assignee and rows show owners (202)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("202-read-week-by-person");
	try {
		s.chat(
			SPEAKER.Mira,
			"Kai says Upcoming can group by person now. If I can see Priya's plate as its own section, the ownership loop is closed.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2000);

		await tasks
			.locator("text=Upcoming")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(1200);
		await s.shot(tasks, "01-upcoming-by-date");

		// Assignee chip on a row (the deliverable assigned in session 200).
		const chipOnRow = await tasks
			.locator(".task-row__assignee")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`assignee chip visible on an Upcoming row: ${chipOnRow}`);

		// The new header toggle.
		const groupToggle = tasks.locator('button:has-text("Group by assignee")').first();
		const toggleVisible = await groupToggle.isVisible().catch(() => false);
		s.note(`"Group by assignee" toggle present on Upcoming header: ${toggleVisible}`);
		expect(toggleVisible).toBe(true);

		await groupToggle.click().catch(() => undefined);
		await tasks.waitForTimeout(1200);
		await s.shot(tasks, "02-upcoming-by-assignee");

		const pressed = await groupToggle.getAttribute("aria-pressed").catch(() => null);
		s.note(`toggle aria-pressed after click: ${pressed}`);

		const priyaSection = await tasks
			.locator(".tasks-section__heading", { hasText: "Priya Nair" })
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`"Priya Nair" section heading appears: ${priyaSection}`);

		const headings = await tasks
			.locator(".tasks-section__heading")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`section headings under assignee grouping: ${JSON.stringify(headings)}`);

		// Toggle back — same tasks, date sections again.
		await groupToggle.click().catch(() => undefined);
		await tasks.waitForTimeout(1000);
		await s.shot(tasks, "03-back-to-dates");

		s.chat(
			SPEAKER.Mira,
			priyaSection
				? "There it is — 'Priya Nair' as her own section on Upcoming. I can finally ask what's on someone's plate instead of parsing titles."
				: "Toggle exists but my people aren't headlining sections — noting what I saw for Kai.",
		);
	} finally {
		await s.finish();
	}
});
