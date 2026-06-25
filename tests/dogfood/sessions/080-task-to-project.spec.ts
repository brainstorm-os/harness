/**
 * Session 080 — Mira files a deliverable under a project.
 *
 * She wants to group the three "Draft Issue" deliverables under a dedicated
 * "Newsletter" project — but discovers there's **no way to create a project
 * from the Tasks app** (no add button by the Projects heading; the compose
 * form's project picker only lists existing projects). So her workaround is to
 * file a deliverable under the one project that already exists, via the row's
 * project chip → Move-to-project menu.
 *
 * Surfaces the create-project gap (logged) and covers the task→project
 * assignment path (the row project chip + anchored menu). Idempotent: the
 * already-assigned project is disabled in the menu, and the end state (the task
 * living under the project) is what's asserted.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const DELIVERABLE = "Draft Issue #1";

test("file a deliverable under a project (and hit the no-create-project gap)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("080-task-to-project");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);

		// The gap: no add-project affordance anywhere in the Projects sidebar group.
		const projectsGroup = tasks.locator(".tasks-sidebar__group--projects");
		const addAffordances = await projectsGroup
			.locator(
				'button[aria-label*="project" i], button[aria-label*="add" i], button[aria-label*="new" i]',
			)
			.count();
		s.note(`add-project affordances in the Projects group: ${addAffordances} (expected 0 — the gap)`);

		// Pick the first existing project's name to file under.
		const firstProjectRow = projectsGroup.locator(".tasks-sidebar__row").first();
		const projectName = ((await firstProjectRow.textContent()) ?? "").replace(/\d+$/, "").trim();
		s.note(`existing project to file under: "${projectName}"`);

		// Find the deliverable on Upcoming and open its project chip.
		await tasks.locator('[data-surface="upcoming"]').first().click();
		await tasks.waitForTimeout(600);
		const row = tasks
			.locator("[data-task-id]", {
				has: tasks.locator(".task-row__name-label", { hasText: DELIVERABLE }),
			})
			.first();
		await expect(row, `the "${DELIVERABLE}" deliverable exists`).toHaveCount(1);

		// The property chips are hover-revealed (opacity:0 until the row is
		// hovered/selected) — hover first so the project chip is clickable.
		await row.hover();
		await tasks.waitForTimeout(200);
		await row.locator('[aria-label="Move to project"]').first().click();
		await tasks.waitForTimeout(400);
		const item = tasks
			.locator('.fm-menu [role="option"]', { hasText: new RegExp(projectName, "i") })
			.first();
		if ((await item.isEnabled().catch(() => true)) && (await item.count()) > 0) {
			await item.click();
			await tasks.waitForTimeout(700);
			s.note(`filed "${DELIVERABLE}" under "${projectName}"`);
		} else {
			await tasks.keyboard.press("Escape");
			s.note(`"${DELIVERABLE}" already under "${projectName}" — menu item disabled`);
		}

		// Open that project's surface and confirm the deliverable is there.
		await firstProjectRow.click();
		await tasks.waitForTimeout(700);
		await s.shot(tasks, "01-project");
		const names = (await tasks.locator(".task-row__name-label").allInnerTexts()).map((t) => t.trim());
		s.note(`tasks under "${projectName}": ${JSON.stringify(names)}`);
		expect(
			names.some((n) => n.includes(DELIVERABLE)),
			`the deliverable now lives under "${projectName}"`,
		).toBe(true);
	} finally {
		await s.finish();
	}
});
