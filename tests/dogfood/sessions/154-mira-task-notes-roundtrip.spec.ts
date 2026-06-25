/**
 * Session 154 — Mira actually USES the new shared editor inside a Task, then
 * leaves and comes back.
 *
 * Sessions 151–153 verified the shared `@brainstorm/editor` mounts in
 * Tasks/Journal and that the block menu matches Notes. This turn pushes past
 * "does it mount" into "can a founder use it for real work, and does the work
 * survive": Mira opens a deliverable, jots structured working notes, inserts a
 * real block from the slash menu (the whole promise of the unification —
 * Tasks used to be a flat notes field), then navigates BACK to the list and
 * REOPENS the same task to confirm her notes are still there. The detail-route
 * round-trip is the exact gap class the editor-navback history shows is
 * fragile, so it's the real test here.
 *
 * Tasks has no dev hook, so writing is light synthetic keyboard (a short line +
 * a single slash-menu pick) — kept minimal so the Yjs-bound editor isn't
 * stressed. Spec is intent + neutral progress only; the friction verdict is
 * decided from the captures + console afterward (watch for
 * `[tasks/inspector-editor]` errors, lost body on reopen, slash-insert no-ops).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira's task working-notes survive a detail round-trip (154)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("154-mira-task-notes-roundtrip");
	try {
		s.chat(
			SPEAKER.Mira,
			"Tasks has the real editor now — going to actually plan a deliverable in the task body with proper blocks, then close it and come back to make sure my notes are still there.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "01-tasks-list");

		const rowCount = await tasks
			.locator("[data-task-id]")
			.count()
			.catch(() => 0);
		s.note(`task rows visible: ${rowCount}`);

		// Capture which task we open so the reopen step targets the same one.
		const firstTaskId = await tasks
			.locator("[data-task-id]")
			.first()
			.getAttribute("data-task-id")
			.catch(() => null);
		s.note(firstTaskId ? `opening task: ${firstTaskId}` : "FRICTION? no task id on first row");

		// Open the deliverable on its detail route (name button is the stable
		// detail-open target; clicking the row root is flakier — per session 153).
		await tasks
			.locator("[data-task-id] .task-row__name")
			.first()
			.click()
			.catch(() => undefined);
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await tasks.waitForTimeout(800);
		await s.shot(tasks, "02-task-detail-open");

		// Jot a short working note (light keyboard — first chars are what matter
		// for the persistence check; the editor races full prose under Playwright).
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(300);
		await tasks.keyboard
			.type("Plan: outline, draft, review by Friday.", { delay: 20 })
			.catch(() => undefined);
		await tasks.waitForTimeout(300);
		await s.shot(tasks, "03-note-typed");

		// Use the slash menu to add a real block (a to-do is the natural thing on
		// a deliverable). Pick the highlighted item with Enter — the unification
		// fix (9ee92c89) made Enter insert the highlighted block.
		await tasks.keyboard.press("Enter").catch(() => undefined);
		await tasks.keyboard.type("/", { delay: 20 }).catch(() => undefined);
		await tasks.waitForTimeout(700);
		const slashVisible = await tasks
			.locator('[class*="typeahead"], [class*="slash"], [class*="block-menu"], [role="listbox"]')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`slash menu opened in task body: ${slashVisible}`);
		await s.shot(tasks, "04-slash-open");
		// Narrow to a to-do, then insert it.
		await tasks.keyboard.type("todo", { delay: 20 }).catch(() => undefined);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "05-slash-todo-filtered");
		await tasks.keyboard.press("Enter").catch(() => undefined);
		await tasks.waitForTimeout(400);
		await tasks.keyboard.type("Send draft to Marcus", { delay: 20 }).catch(() => undefined);
		await tasks.waitForTimeout(400);
		await s.shot(tasks, "06-block-inserted");

		// --- Round-trip: leave the detail, come back, confirm the body persisted.
		await tasks.waitForTimeout(600); // let autosave flush
		// Navigate back to the list. Prefer an explicit back affordance; fall back
		// to the sidebar "Today"/first nav item so we leave the detail route.
		const wentBack = await tasks
			.locator(
				'[class*="back"], [aria-label*="Back" i], .tasks-detail__back, [class*="breadcrumb"] button',
			)
			.first()
			.click()
			.then(() => true)
			.catch(() => false);
		if (!wentBack) {
			await tasks
				.locator('[class*="sidebar"] [class*="nav"], .tasks-sidebar__item')
				.first()
				.click()
				.catch(() => undefined);
		}
		await tasks.waitForTimeout(800);
		s.note(`returned to list via ${wentBack ? "back affordance" : "sidebar fallback"}`);
		await s.shot(tasks, "07-back-to-list");

		// Reopen the SAME task.
		const reopenTarget = firstTaskId
			? tasks.locator(`[data-task-id="${firstTaskId}"] .task-row__name`).first()
			: tasks.locator("[data-task-id] .task-row__name").first();
		await reopenTarget.click().catch(() => undefined);
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await tasks.waitForTimeout(900);
		const bodyText = await tasks
			.locator(".tasks-detail__editor")
			.first()
			.innerText()
			.catch(() => "");
		s.note(
			`task body text after reopen (len=${bodyText.length}): ${JSON.stringify(bodyText.slice(0, 200))}`,
		);
		await s.shot(tasks, "08-reopened-detail");

		s.chat(
			SPEAKER.Mira,
			"Wrote up the deliverable in the task body and went back and forth to it — pulling my read on whether the notes (and the to-do block) held from the captures.",
		);
		s.note(
			"Mira composed structured working notes in the shared task editor and round-tripped the detail route; verdict from captures + console.",
		);
	} finally {
		await s.finish();
	}
});
