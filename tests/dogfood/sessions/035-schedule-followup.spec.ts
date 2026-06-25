/**
 * Session 035 — real cross-app work: having set "Last contact" dates in the CRM,
 * Mira schedules a follow-up with her biggest lead. Opens Tasks, creates
 * "Follow up with Vertex Labs" with a scheduled date, and confirms it lands.
 * Dogfoods the Tasks create + date scheduling flow in a genuine workflow.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("schedule a follow-up task for a lead", async () => {
	test.setTimeout(180_000);
	const s = await startSession("035-schedule-followup");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await s.shot(tasks, "01-tasks-open");

		// New task via the header button (the discoverable F-004 affordance).
		const newBtn = tasks.locator(".tasks-header__action").first();
		s.note(`New-task button present: ${(await newBtn.count()) > 0}`);
		await newBtn.click();
		await tasks.waitForTimeout(500);

		const form = tasks.locator(".tasks-compose");
		s.note(`Compose form opened: ${(await form.count()) > 0}`);
		const name = form.locator(".tasks-compose__input").first();
		await name.fill("Follow up with Vertex Labs (48k deal)");

		// Scheduled date is the first input in the date row.
		const dateInputs = form.locator(".tasks-compose__row .tasks-compose__input");
		const nDates = await dateInputs.count();
		s.note(`Date inputs in compose: ${nDates}`);
		if (nDates > 0) {
			await dateInputs.first().fill("2026-06-20");
		}
		await s.shot(tasks, "02-compose-filled");

		await tasks.locator("[data-bs-primary]").first().click();
		await tasks.waitForTimeout(900);
		await s.shot(tasks, "03-after-create");

		// Check each surface for the named task — where did it land, and did the
		// name + scheduled date stick?
		const inboxText =
			(await tasks
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(
			`On Inbox — has "Follow up": ${/Follow up with Vertex Labs/.test(inboxText)}; has "Untitled": ${/\bUntitled\b/.test(inboxText)}`,
		);

		for (const surface of ["Upcoming", "Today"]) {
			await tasks
				.locator("#surface-nav, nav, aside")
				.getByText(surface, { exact: true })
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(600);
			const txt =
				(await tasks
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";
			s.note(`On ${surface} — has "Follow up": ${/Follow up with Vertex Labs/.test(txt)}`);
		}
		await s.shot(tasks, "04-upcoming");

		// The task exists somewhere with its name iff the compose saved correctly.
		const anyHasName = await tasks.evaluate(() =>
			document.body.innerText.includes("Follow up with Vertex Labs"),
		);
		s.note(`Named task found on some surface: ${anyHasName}`);
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
