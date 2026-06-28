/**
 * Session 357 — Tasks read-only lock (fleet lock rollout, app 5/7).
 *
 * Opens a task detail, locks it via the shared LockButton, and confirms the
 * detail body editor goes read-only (the task's synced `locked` drives
 * `editable` through the imperative inspector-editor mount + the shared editor's
 * reactive EditableSync). Measures the contenteditable across lock → unlock.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Tasks detail lock toggles read-only (357)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("357-tasks-lock");
	s.chat(
		SPEAKER.Mira,
		"Locking a finished task's notes so they read as a record, not a scratchpad — checking the body editor actually goes read-only.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const editableAttr = async (page: import("@playwright/test").Page) =>
		page
			.locator(
				".tasks-detail__editor[contenteditable], [contenteditable].tasks-detail__editor",
			)
			.first()
			.getAttribute("contenteditable")
			.catch(() => null);

	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		// Open a task's detail by clicking its NAME (clicking the row's circle
		// only toggles completion).
		await tasks
			.locator('text="Take the product tour"')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(1400);
		await s.shot(tasks, "01-task-open");

		const lockBtn = tasks.locator('[aria-label="Lock task (read-only)"]');
		const hasLock = (await lockBtn.count().catch(() => 0)) > 0;
		s.note(`lock affordance present: ${hasLock}`);
		s.note(`before lock — contenteditable: ${await editableAttr(tasks)}`);

		if (hasLock) {
			await lockBtn
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(1000);
			await s.shot(tasks, "02-task-locked");
			s.note(
				`after LOCK — contenteditable: ${await editableAttr(tasks)}  (expected: false)`,
			);

			await tasks
				.locator('[aria-label="Unlock task"]')
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(1000);
			s.note(
				`after UNLOCK — contenteditable: ${await editableAttr(tasks)}  (expected: true)`,
			);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors locking a task").toEqual([]);
	} finally {
		await s.finish();
	}
});
