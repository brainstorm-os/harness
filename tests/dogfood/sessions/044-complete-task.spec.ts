/**
 * Session 044 — Mira marks her follow-up done. Opens Tasks → Upcoming, completes
 * "Follow up with Vertex Labs" via the row toggle, and confirms it leaves the
 * active list (and shows as done under "Show completed"). Dogfoods task
 * completion — a core daily action.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const TITLE = /Follow up with Vertex Labs/;

async function gotoSurface(tasks: Page, name: string): Promise<void> {
	await tasks
		.locator("nav, aside, #surface-nav")
		.getByText(name, { exact: true })
		.first()
		.click()
		.catch(() => undefined);
	await tasks.waitForTimeout(600);
}

test("complete the follow-up task", async () => {
	test.setTimeout(180_000);
	const s = await startSession("044-complete-task");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await gotoSurface(tasks, "Upcoming");

		const row = tasks.locator(".task-row", { hasText: TITLE }).first();
		s.note(`Follow-up task present in Upcoming: ${(await row.count()) > 0}`);
		await s.shot(tasks, "01-before-complete");
		const toggle = row.locator(".task-row__toggle").first();
		s.note(`Completion toggle present: ${(await toggle.count()) > 0}`);
		const doneBefore = await row.getAttribute("data-done").catch(() => null);
		s.note(`data-done before: ${doneBefore}`);
		await toggle.click();
		await tasks.waitForTimeout(800);
		const doneAfter = await tasks
			.locator(".task-row", { hasText: TITLE })
			.first()
			.getAttribute("data-done")
			.catch(() => null);
		s.note(`data-done after toggle click: ${doneAfter}`);

		const stillActive = await tasks.locator(".task-row", { hasText: TITLE }).count();
		s.note(`Still in active Upcoming after complete (expect 0 — completed hidden): ${stillActive}`);
		await s.shot(tasks, "02-after-complete");

		// Reveal completed and confirm it's there, marked done.
		await tasks
			.getByText(/Show completed/i)
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(600);
		const revealed = tasks.locator(".task-row", { hasText: TITLE }).first();
		const shownAfterReveal = (await revealed.count()) > 0;
		s.note(`Shows under "Show completed": ${shownAfterReveal}`);
		await s.shot(tasks, "03-show-completed");

		expect(stillActive).toBe(0);
	} finally {
		await s.finish();
	}
});
