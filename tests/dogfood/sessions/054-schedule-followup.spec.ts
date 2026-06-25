/**
 * Session 054 — Mira puts a due date on a follow-up.
 *
 * After prepping for the Vertex call she wants her follow-up task to actually
 * land on a day, not float in the Inbox. She clicks the task's date chip,
 * picks a Due date next month, and applies it. Exercises the date-popover
 * path (shared mini-calendar, Scheduled/Due tabs, Apply) — a core CRUD action
 * not yet dogfooded — and confirms the chip reflects the new due date.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("set a Due date on a task via the date popover", async () => {
	test.setTimeout(180_000);
	const s = await startSession("054-schedule-followup");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await tasks
			.locator("nav, aside")
			.getByText("Inbox", { exact: true })
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(600);

		// First task row that exposes an editable date chip.
		const chip = tasks
			.locator('.task-row__chip[data-kind="date"], .task-row__chip[data-kind="date-overdue"]')
			.first();
		const haveChip = (await chip.count()) > 0;
		s.note(`editable date chip found: ${haveChip}`);
		const before = haveChip ? ((await chip.textContent()) ?? "").trim() : "";
		s.note(`date chip before: "${before}"`);
		await s.shot(tasks, "01-before");

		await chip.click();
		await tasks.waitForTimeout(400);
		const popover = tasks.locator('.tasks-date-popover[role="dialog"]').first();
		s.note(`date popover opened: ${(await popover.count()) > 0}`);

		// Switch to the Due tab and move to next month (all days future).
		await popover.getByText("Due", { exact: true }).first().click();
		await tasks.waitForTimeout(200);
		await popover.locator('[aria-label="Next month"]').first().click();
		await tasks.waitForTimeout(200);

		// Pick the 15th of next month (an in-month day, appears once).
		const day = popover
			.locator(".bs-cal-month__cell:not(.bs-cal-month__cell--other-month) .bs-cal-month__date", {
				hasText: /^15$/,
			})
			.first();
		s.note(`day cell (15) present: ${(await day.count()) > 0}`);
		await day.click();
		await tasks.waitForTimeout(200);
		await s.shot(tasks, "02-picker-day-picked");

		await popover.getByText("Apply", { exact: true }).first().click();
		await tasks.waitForTimeout(800);
		await s.shot(tasks, "03-after");

		const after = ((await chip.textContent()) ?? "").trim();
		s.note(`date chip after: "${after}"`);
		const popoverClosed = (await tasks.locator('.tasks-date-popover[role="dialog"]').count()) === 0;
		s.note(`popover closed on apply: ${popoverClosed}`);

		expect(haveChip, "a task with an editable date chip exists").toBe(true);
		expect(after, "the chip should now read a Due date, not the empty 'Schedule'").not.toBe(
			"Schedule",
		);
		expect(after, "the chip should reflect a due date").toMatch(/Due|15/i);
	} finally {
		await s.finish();
	}
});
