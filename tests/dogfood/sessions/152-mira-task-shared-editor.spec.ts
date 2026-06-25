/**
 * Session 152 — Mira adds working notes to a deliverable (Tasks detail editor).
 *
 * The other half of the shared-editor unification: a task's detail body now
 * mounts `@brainstorm/editor`'s `FullEditorPlugins` (`tasks-detail__editor`),
 * the same rich stack Notes/Journal use. Mira opens one of this week's
 * deliverables, drops into the body, jots a working note, and checks whether
 * the block menu (`/`) is reachable in the task detail like it is in Notes.
 * No Tasks dev hook exists, so writing is light synthetic keyboard (a short
 * line + a single `/` probe) — kept minimal so the Yjs-bound editor isn't
 * stressed. Verdict from captures + console (watch for
 * `[tasks/inspector-editor]` errors / seed-plant failures).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira adds notes in the shared-editor task detail (152)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("152-mira-task-shared-editor");
	try {
		s.chat(
			SPEAKER.Mira,
			"Tasks got the shared editor too — opening a deliverable to jot working notes and see if I get real blocks in the task body now, not just a flat notes field.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "01-tasks-list");

		// Open the first task on its detail route (mirrors the Bookmarks detail
		// pattern — clicking a row swaps the content area to the task detail).
		const rowCount = await tasks
			.locator("[data-task-id]")
			.count()
			.catch(() => 0);
		s.note(`task rows visible: ${rowCount}`);
		await tasks
			.locator("[data-task-id]")
			.first()
			.click()
			.catch(() => undefined);

		// Wait for the shared body editor on the detail route.
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await tasks.waitForTimeout(800);
		const detailEditorMounted = await tasks
			.locator(".tasks-detail__editor")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`shared task-detail editor mounted: ${detailEditorMounted}`);
		await s.shot(tasks, "02-task-detail");

		// Drop into the body and jot a short working note (light keyboard).
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(300);
		await tasks.keyboard
			.type("Working notes: draft outline, then send for review.", { delay: 15 })
			.catch(() => undefined);
		await tasks.waitForTimeout(300);
		await s.shot(tasks, "03-task-note-written");

		// Probe the slash menu in the task body — a single "/" on a new line.
		await tasks.keyboard.press("Enter").catch(() => undefined);
		await tasks.keyboard.type("/", { delay: 20 }).catch(() => undefined);
		await tasks.waitForTimeout(700);
		const slashMenuVisible = await tasks
			.locator('[class*="typeahead"], [class*="slash"], [class*="block-menu"], [role="listbox"]')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`slash-menu in task detail after "/": visible=${slashMenuVisible}`);
		await s.shot(tasks, "04-task-slash-probe");
		await tasks.keyboard.press("Backspace").catch(() => undefined);

		s.chat(
			SPEAKER.Mira,
			"Jotted notes on the deliverable straight in the task — pulling my read on whether the task body is real rich text now from the captures.",
		);
		s.note(
			"Mira added working notes in the shared-editor task detail; verdict from captures + console.",
		);
	} finally {
		await s.finish();
	}
});
