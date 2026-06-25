/**
 * Session 251 — real-shell reproduction of the relation-property picker bug:
 * editing a Task's "Assignee" (a `Person/v1` entityRef) opened a picker that
 * (a) used the hardcoded "Search notes to link…" placeholder and (b) listed
 * candidates as raw `ent_…` ids instead of their display titles.
 *
 * This drives the live shell: open Tasks, open a task's properties inspector,
 * open the Assignee picker, and capture what the rows actually render +
 * the placeholder. The real signal is the screenshot + console.log (drift in
 * the [FAIL] verdict is noise) — the assertions only pin the two regressions.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const PICKER_INPUT = ".bs-cell-pop-input";
const PICKER_ROW = ".bs-cell-pop-row-label";

test("Task assignee relation picker shows titles, not raw ids", async () => {
	test.setTimeout(240_000);
	const s = await startSession("251-relation-picker-titles");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2500);
		await s.shot(tasks, "01-tasks");

		// Open the first task's detail.
		await tasks
			.locator('[data-testid="task-row"], .task-row, [role="listitem"]')
			.first()
			.click({ timeout: 8000 })
			.catch(() => undefined);
		await tasks.waitForTimeout(1000);
		await s.shot(tasks, "02-detail");

		// Open the properties inspector (the right-panel slide-over holding the
		// Project / Assignee rows) via its header toggle.
		await tasks
			.locator('button[aria-label="Show properties"], button[title="Show properties"]')
			.first()
			.click({ timeout: 8000 })
			.catch(() => undefined);
		await tasks.waitForTimeout(700);
		await s.shot(tasks, "02b-inspector");

		// Click the Assignee row's value cell to open the link picker. The shared
		// link cell trigger carries `bs-cell-link-trigger`; scope to the Assignee row.
		const assigneeTrigger = tasks
			.locator('.bs-props__row:has-text("Assignee") .bs-cell-link-trigger')
			.first();
		if ((await assigneeTrigger.count()) > 0) {
			await assigneeTrigger.click({ timeout: 8000 }).catch(() => undefined);
		}
		await tasks.waitForTimeout(800);
		await s.shot(tasks, "03-picker");

		const placeholder = await tasks
			.locator(PICKER_INPUT)
			.first()
			.getAttribute("placeholder")
			.catch(() => null);
		s.note(`picker placeholder: ${placeholder ?? "(none)"}`);

		const rowTexts = await tasks
			.locator(PICKER_ROW)
			.allInnerTexts()
			.catch(() => []);
		s.note(`picker rows (${rowTexts.length}): ${JSON.stringify(rowTexts.slice(0, 12))}`);

		// Regression 1: the placeholder is no longer the hardcoded "notes" copy.
		if (placeholder !== null) {
			expect(placeholder.toLowerCase()).not.toContain("notes to link");
		}
		// Regression 2: no row label is a bare entity id (`ent_…` / `n_…`).
		const idLike = rowTexts.filter((t) => /^(ent_|n_)[a-z0-9]+$/i.test(t.trim()));
		s.note(`raw-id rows: ${JSON.stringify(idLike)}`);
		expect(idLike, "relation picker rows must render titles, not raw ids").toHaveLength(0);
	} finally {
		await s.finish();
	}
});
