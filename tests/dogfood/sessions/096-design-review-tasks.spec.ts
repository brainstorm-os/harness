/**
 * Session 096 — Marcus reviews the Tasks app.
 *
 * Fourth design review by the designer persona. Tasks is a list surface — rows,
 * checkboxes, the priority/date/project chips, the surfaces nav. Marcus is
 * especially interested in **discoverability**: the row chips are opacity:0
 * until you hover the exact row (he'd never find them cold). Captures the
 * default list and a hovered row to show the contrast; critique in the log.
 *
 * No app-source change → SKIP_BUILD.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("design review — Tasks (Marcus)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("096-design-review-tasks");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);

		// Upcoming — a populated list, chips in their resting (hidden) state.
		await tasks.locator('[data-surface="upcoming"]').first().click();
		await tasks.waitForTimeout(600);
		await s.shot(tasks, "01-list-resting");

		// Hover a row — the priority/date/project chips appear only now.
		const row = tasks.locator("[data-task-id]").first();
		if ((await row.count()) > 0) {
			await row.hover();
			await tasks.waitForTimeout(300);
		}
		await s.shot(tasks, "02-row-hovered");

		// Today — the empty/near-term surface + its date treatment.
		await tasks.locator('[data-surface="today"]').first().click();
		await tasks.waitForTimeout(600);
		await s.shot(tasks, "03-today");

		const surfaces = (await tasks.locator(".tasks-sidebar__row").allInnerTexts()).map((t) =>
			t.trim(),
		);
		s.note(`sidebar surfaces/projects: ${JSON.stringify(surfaces)}`);
		s.note("captured Tasks states for Marcus's review (critique in friction-log)");
	} finally {
		await s.finish();
	}
});
