/**
 * Session 008 — verify the small fixes.
 *
 * F-009: adding a task while looking at Today should land ON Today (default
 *        scheduled = today), not silently drop into Inbox.
 * F-006: creating a note must not log "[react-yjs] failed to load Y.Doc …
 *        not found" — the benign create→load race is now swallowed as an
 *        empty doc.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("add-from-Today lands on Today (F-009) + clean note create (F-006)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("008-small-fixes-check");
	try {
		// --- F-009 -----------------------------------------------------------
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		// Make sure we're on Today.
		await tasks.locator('text="Today"').first().click();
		await tasks.waitForTimeout(500);

		await tasks.locator('[aria-label="New task"]').click();
		await tasks.waitForTimeout(600);
		await s.shot(tasks, "compose-from-today");
		const composer = tasks.locator('input:focus, [contenteditable="true"]:focus').first();
		await composer.type("Call the printer about the proofs", { delay: 12 });
		// Submit via the form's primary button.
		await tasks.locator('button:has-text("Create task")').click();
		await tasks.waitForTimeout(1000);
		await s.shot(tasks, "after-create");

		// The new task must be visible on the Today surface.
		await expect(
			tasks.locator('text="Call the printer about the proofs"').first(),
			"a task added from Today must appear on Today, not vanish to Inbox",
		).toBeVisible();

		// --- F-006 -----------------------------------------------------------
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1200);
		await notes.locator('[aria-label="New note"]').click();
		await notes.waitForTimeout(1500);
		await s.shot(notes, "fresh-note");

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}

	// F-006: the create→load race must no longer log a Y.Doc load error.
	const consoleLog = readFileSync(
		join(process.cwd(), "tests/dogfood/.sessions/008-small-fixes-check/console.log"),
		"utf8",
	);
	expect(
		consoleLog,
		"creating a note must not log a 'failed to load Y.Doc … not found' error",
	).not.toMatch(/failed to load Y\.Doc/i);
});
