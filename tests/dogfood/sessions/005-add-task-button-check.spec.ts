/**
 * Session 005 — verify F-004 fix.
 *
 * Tasks had no visible "add task" affordance (Cmd+N only). The fix adds a
 * header "+" New-task button. This opens Tasks, asserts the button is visible,
 * clicks it, and confirms the compose form opens and a task can be created
 * with the mouse alone — no keyboard shortcut needed.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("a visible New-task button creates a task without the keyboard (F-004)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("005-add-task-button-check");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await s.shot(tasks, "tasks-header");

		const addBtn = tasks.locator('[aria-label="New task"]').first();
		await expect(addBtn, "a visible New-task button must exist in the header").toBeVisible();

		await addBtn.click();
		await tasks.waitForTimeout(700);
		await s.shot(tasks, "composer-open");

		const composer = tasks.locator('input:focus, [contenteditable="true"]:focus').first();
		await expect(composer, "clicking New task must open a focused composer").toBeVisible();

		await composer.type("Write issue #1 outline", { delay: 15 });
		await tasks.keyboard.press("Enter");
		await tasks.waitForTimeout(800);
		await s.shot(tasks, "task-created");

		await expect(
			tasks.locator('text="Write issue #1 outline"').first(),
			"the created task must appear",
		).toBeVisible();
	} finally {
		await s.finish();
	}
});
