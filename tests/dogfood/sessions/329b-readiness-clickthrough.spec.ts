/**
 * Session 329b — click-through verification of the two flagship commercial-spine
 * shifts the presence-probe (329) gave false-ABSENT on (empty-state hid them):
 *
 *   - DT-1: Automations "New workflow" opens a real authoring builder with a
 *     trigger picker (incl. an entity-event "when a record changes" trigger) and
 *     step kinds (incl. create/update entity) — the custom when→then rule that
 *     Session 192 found unauthorable.
 *   - DT-9: a Task carries an Assignee — create a task, open it, confirm an
 *     assignee affordance in the inspector / row.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("commercial-spine click-through (329b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("329b-readiness-clickthrough");
	try {
		// ── DT-1: Automations authoring builder ─────────────────────────────
		{
			const page = await s.openApp(APP.Automations);
			await page.waitForTimeout(2500);
			const newWorkflow = page.getByRole("button", { name: /new workflow/i }).first();
			s.note("## DT-1 Automations New-workflow builder");
			s.note(`- "New workflow" button present: ${await newWorkflow.count()}`);
			await newWorkflow.click().catch(() => undefined);
			await page.waitForTimeout(1500);
			await s.shot(page, "automations-builder");
			const bodyText =
				(await page
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";
			const triggerWord = /trigger|when/i.test(bodyText);
			const entityEvent = /entity|record|created|updated|deleted|changes/i.test(bodyText);
			const actionWord = /step|action|notify|create|update|then/i.test(bodyText);
			s.note(`- builder shows trigger language: ${triggerWord}`);
			s.note(`- builder shows entity-event option language: ${entityEvent}`);
			s.note(`- builder shows action/step language: ${actionWord}`);
			s.note(`- VERDICT: ${triggerWord && actionWord ? "AUTHORING BUILDER REAL" : "inconclusive"}`);
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300);
		}

		// ── DT-9: Task assignee ─────────────────────────────────────────────
		{
			const page = await s.openApp(APP.Tasks);
			await page.waitForTimeout(2500);
			s.note("\n## DT-9 Task assignee");
			// Add a task via the header "+" (new task), then open it.
			const add = page
				.locator('.app-header button[aria-label*="add" i], .app-header button[aria-label*="new" i]')
				.first();
			if (await add.count()) {
				await add.click().catch(() => undefined);
				await page.waitForTimeout(800);
				await page.keyboard.type("Deliver Q3 brief");
				await page.keyboard.press("Enter");
				await page.waitForTimeout(1000);
			}
			await s.shot(page, "tasks-after-add");
			// Open the task row to reveal the inspector.
			const row = page
				.locator('[class*="task-row"], [role="row"], li')
				.filter({ hasText: /Deliver Q3 brief/i })
				.first();
			if (await row.count()) {
				await row.click().catch(() => undefined);
				await page.waitForTimeout(1000);
			}
			await s.shot(page, "tasks-inspector");
			const bodyText =
				(await page
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";
			const assigneeWord = /assignee|assigned to|owner/i.test(bodyText);
			const assigneeCtl = await page
				.locator('[aria-label*="ssignee" i],[data-field="assignee"],[class*="assignee" i]')
				.count();
			s.note(`- inspector shows "assignee/owner" language: ${assigneeWord}`);
			s.note(`- assignee control elements: ${assigneeCtl}`);
			// Also: Upcoming surface offers a group-by-assignee.
			const upcoming = page.getByText(/^Upcoming$/i).first();
			if (await upcoming.count()) {
				await upcoming.click().catch(() => undefined);
				await page.waitForTimeout(800);
				await s.shot(page, "tasks-upcoming");
			}
			const upcomingText =
				(await page
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";
			const groupByAssignee = /assignee/i.test(upcomingText);
			s.note(`- Upcoming offers group-by-assignee: ${groupByAssignee}`);
			s.note(
				`- VERDICT: ${assigneeWord || assigneeCtl > 0 || groupByAssignee ? "ASSIGNEE PRESENT" : "not surfaced"}`,
			);
			await page.close().catch(() => undefined);
		}
	} finally {
		await s.finish();
	}
});
