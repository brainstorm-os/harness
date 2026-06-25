/**
 * Session 199 — focused probe: does the F-152 Assignee picker actually open
 * and offer the team? 198 clicked the row LABEL (a no-op) and concluded
 * "Priya not offered" — this drives the VALUE cell, the real affordance.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("the Assignee value cell opens a people picker and a pick persists (199)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("199-assignee-picker-probe");
	try {
		s.chat(
			SPEAKER.Mira,
			"Second try on the assignee — this time actually clicking the field, not its label.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2000);

		const row = tasks.locator(".task-row, [data-task-id], .tasks-list li").first();
		await row.click().catch(() => undefined);
		await tasks.waitForTimeout(1500);

		// Make sure the Properties panel is up.
		const assigneeLabel = tasks.locator("text=Assignee").first();
		if (!(await assigneeLabel.isVisible().catch(() => false))) {
			await tasks
				.locator('[aria-label*="roperties"], [aria-label*="Info"]')
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(1000);
		}

		// Click the VALUE cell of the Assignee row (the sibling of the label).
		const valueCell = tasks.locator("text=Assignee").first().locator("xpath=following-sibling::*[1]");
		await valueCell.click().catch(() => undefined);
		await tasks.waitForTimeout(1000);
		await s.shot(tasks, "01-picker-open");

		// The picker should list vault people; search narrows like other pickers.
		await tasks.keyboard.type("Priya", { delay: 30 }).catch(() => undefined);
		await tasks.waitForTimeout(800);
		await s.shot(tasks, "02-picker-filtered");

		const candidate = tasks.locator("text=Priya Nair").first();
		const offered = await candidate.isVisible().catch(() => false);
		s.note(`Priya Nair offered as assignee candidate: ${offered}`);

		if (offered) {
			await candidate.click().catch(() => undefined);
			await tasks.waitForTimeout(1500);
			await s.shot(tasks, "03-assignee-set");
			const renders = await tasks
				.locator("text=Priya Nair")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`assignee renders after pick: ${renders}`);
			expect(renders).toBe(true);
		}

		s.chat(
			SPEAKER.Mira,
			offered
				? "There she is — Priya Nair straight from Contacts, one click and the task is hers."
				: "The field opens nothing I can use — the picker either doesn't open from the value cell or my people aren't in it. Back to Kai.",
		);
	} finally {
		await s.finish();
	}
});
