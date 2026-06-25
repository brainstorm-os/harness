/**
 * Session 181 — Tasks detail layout audit (polish pass). Opens a task on its
 * detail route and captures the full inspector so the layout (title, chips,
 * sections, inputs, spacing) can be judged + polished; also captures a project
 * view to check the header `⋯` vs any near-title duplicate.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Tasks detail + project layout capture (181)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("181-tasks-detail-polish");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "01-list");

		// Open the first task on its detail route (the name button is the stable
		// detail-open target per session 154).
		await tasks
			.locator("[data-task-id] .task-row__name")
			.first()
			.click()
			.catch(() => undefined);
		await tasks
			.locator(".tasks-detail__titlerow")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await tasks.waitForTimeout(900);
		await s.shot(tasks, "02-detail");
		s.note(
			`detail title text="${await tasks
				.locator(".tasks-detail__titlerow")
				.first()
				.innerText()
				.catch(() => "")}"`,
		);

		// The body editor + subtasks live further down; scroll to capture them.
		await tasks.mouse.wheel(0, 700);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "03-detail-lower");

		// Cursor on the title label (should be pointer now) + header ⋯ count.
		const titleCursor = await tasks
			.locator(".tasks-detail__title-group .task-row__name-label")
			.first()
			.evaluate((el) => getComputedStyle(el).cursor)
			.catch(() => "n/a");
		s.note(`detail title cursor=${titleCursor}`);

		// Back to the list, open a project to inspect the header ⋯ placement.
		await tasks.keyboard.press("Escape").catch(() => undefined);
		await tasks.waitForTimeout(500);
		const projectRow = tasks.locator(".tasks-sidebar [class*='project'], [data-project-id]").first();
		await projectRow.click().catch(() => undefined);
		await tasks.waitForTimeout(800);
		const headerMore = await tasks.locator(".tasks-header .bs-object-menu__more").count();
		const nearTitleMore = await tasks
			.locator(".tasks-header__title-menu .bs-object-menu__more")
			.count();
		s.note(`header ⋯ buttons total=${headerMore}; attached to title-menu=${nearTitleMore}`);
		await s.shot(tasks, "04-project-header");
	} finally {
		await s.finish();
	}
});
