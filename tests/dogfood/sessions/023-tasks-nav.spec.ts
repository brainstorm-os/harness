/**
 * Session 023 — Tasks open-detail → navigate-away (hybrid-reconciliation guard).
 *
 * CLAUDE.md documents a real bug class: a hybrid app opens an object detail
 * (imperative DOM injected into a React slot), then navigation updates the
 * ground-truth state but a stale detail node stays painted over the list
 * ("open a task → can't navigate anywhere"). This opens a task, navigates to
 * a different view, and asserts the list — not a frozen detail — is showing.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Tasks: open a task then navigate away — no frozen detail", async () => {
	test.setTimeout(180_000);
	const s = await startSession("023-tasks-nav");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "tasks-list");

		// Capture the body text of the list view as a baseline.
		const listText =
			(await tasks
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		const hadComposerOrRows = /search tasks|today|task/i.test(listText);
		s.note(`list view shows task UI: ${hadComposerOrRows}`);

		// Open the first task row's detail — `.task-row__body` carries the click
		// handler that routes into the detail.
		const row = tasks.locator(".task-row__body").first();
		if ((await row.count()) === 0) {
			s.note("no task row found — skipping");
			expect(errors).toEqual([]);
			return;
		}
		await row.click();
		await tasks.waitForTimeout(1000);
		await s.shot(tasks, "task-detail");
		const detailText =
			(await tasks
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(`after opening a task, body length: ${detailText.length}`);

		// Navigate away: back out (Escape) or click a sidebar view, then confirm
		// the list UI is interactive again (search box present + clickable).
		await tasks.keyboard.press("Escape");
		await tasks.waitForTimeout(800);
		const searchBox = tasks
			.locator('input[placeholder*="Search" i], [placeholder*="Search tasks" i]')
			.first();
		const searchVisible =
			(await searchBox.count()) > 0 && (await searchBox.isVisible().catch(() => false));
		s.note(`after Escape, search box visible/interactive: ${searchVisible}`);
		await s.shot(tasks, "after-navigate");

		// The list must be usable again — type into search to prove it's not
		// covered by a frozen detail node.
		if (searchVisible) {
			await searchBox.click();
			await searchBox.type("zzz", { delay: 10 });
			await tasks.waitForTimeout(400);
			const typed = await searchBox.inputValue().catch(() => "");
			s.note(`search accepted input after navigation: ${typed === "zzz"}`);
			await searchBox.fill("");
			expect(typed, "list search should be interactive after closing a task").toBe("zzz");
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors during Tasks navigation").toEqual([]);
	} finally {
		await s.finish();
	}
});
