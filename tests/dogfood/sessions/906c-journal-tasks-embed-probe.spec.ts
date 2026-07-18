/**
 * Session 906c — the last two F-070 unknowns from the 906/906b tour.
 *
 * - Journal: does "/" open the command menu on a fresh empty block? (Mid-line
 *   "/" after a space did nothing in 906; Notes opens on a fresh block.)
 * - Tasks: the F-070 editor lives in the task INSPECTOR body
 *   (`.tasks-detail__body`, mounted by `mountTaskInspectorEditor`). Select a
 *   task, open the inspector, find the editor, probe "/".
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("journal + tasks embed probe (906c)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("906c-journal-tasks-embed-probe");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(1500);

		// ---- Journal: "/" on a fresh empty block --------------------------
		const journal = await s.openApp(APP.Journal);
		const jErrs = collectConsoleErrors(journal);
		await journal.waitForTimeout(2500);
		try {
			const editor = journal.locator('[contenteditable="true"]').first();
			await editor.click();
			await journal.keyboard.press("End");
			await journal.keyboard.press("Enter");
			await journal.keyboard.type("/");
			await journal.waitForTimeout(1100);
			await s.shot(journal, "journal-slash-fresh-block");
			const menu = await journal.evaluate(() => {
				const el = document.querySelector('[class*="typeahead"], [class*="slash-menu"], [role="listbox"]');
				return el ? (el.textContent ?? "").replace(/\s+/g, " ").slice(0, 200) : null;
			});
			s.note(
				menu
					? `[journal] slash on a fresh block OPENS: "${menu.slice(0, 140)}"`
					: "[journal] slash does NOT open on a fresh empty block either — Journal has no reachable slash menu at all",
			);
			if (menu) {
				await journal.keyboard.type("Stunde");
				await journal.waitForTimeout(900);
				await s.shot(journal, "journal-slash-stunde");
				await journal.keyboard.press("Enter");
				await journal.waitForTimeout(1200);
				const embed = await journal.evaluate(() => {
					const el = document.querySelector(
						'[class*="embed"], [class*="entity-card"], [data-entity-ref], [class*="mention"]',
					);
					return el ? { cls: el.className.toString().slice(0, 80), text: (el.textContent ?? "").slice(0, 100) } : null;
				});
				s.note(
					embed
						? `[journal] embed landed: ${embed.cls} — "${embed.text}"`
						: "[journal] Enter inserted no embed/reference node",
				);
				await s.shot(journal, "journal-embed-landed");
				// leave the entry tidy: remove what we inserted
				await journal.keyboard.press("Backspace");
				await journal.keyboard.press("Backspace");
			} else {
				await journal.keyboard.press("Backspace");
				await journal.keyboard.press("Backspace");
			}
		} catch (e) {
			s.note(`[journal] probe broke: ${String(e).slice(0, 200)}`);
		}
		if (jErrs.errors.length > 0) for (const e of jErrs.errors.slice(0, 4)) s.note(`    journal console: ${e}`);
		await journal.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ---- Tasks: inspector body editor ----------------------------------
		const tasks = await s.openApp(APP.Tasks);
		const tErrs = collectConsoleErrors(tasks);
		await tasks.waitForTimeout(3000);
		try {
			const name = tasks.locator(".task-row__name").first();
			await name.click();
			await tasks.waitForTimeout(800);
			let body = tasks.locator(".tasks-detail__body [contenteditable='true']");
			if ((await body.count()) === 0) {
				// inspector may need the right-panel toggle
				const toggle = tasks
					.locator('[aria-label*="inspector" i], [aria-label*="panel" i], [data-testid*="inspector"]')
					.last();
				if ((await toggle.count()) > 0) {
					await toggle.click().catch(() => undefined);
					await tasks.waitForTimeout(900);
				}
				body = tasks.locator(".tasks-detail__body [contenteditable='true']");
			}
			await s.shot(tasks, "tasks-after-select");
			const n = await body.count();
			if (n > 0) {
				await body.first().click();
				await tasks.keyboard.type("/");
				await tasks.waitForTimeout(1100);
				const menu = await tasks.evaluate(
					() => document.querySelector('[class*="typeahead"], [class*="slash-menu"], [role="listbox"]') !== null,
				);
				s.note(
					`[tasks] inspector body editor found; slash menu ${menu ? "OPENS — F-070 parity reachable in Tasks" : "does NOT open in the task body"}`,
				);
				await s.shot(tasks, "tasks-body-slash");
				await tasks.keyboard.press("Escape").catch(() => undefined);
				await tasks.keyboard.press("Backspace");
			} else {
				const hasDetail = await tasks.locator(".tasks-detail__body").count();
				s.note(
					`[tasks] selected a task; .tasks-detail__body present: ${hasDetail}; editable inside: 0 — the F-070 editor never mounted for me (see tasks-after-select)`,
				);
			}
		} catch (e) {
			s.note(`[tasks] probe broke: ${String(e).slice(0, 200)}`);
		}
		if (tErrs.errors.length > 0) for (const e of tErrs.errors.slice(0, 4)) s.note(`    tasks console: ${e}`);
		await tasks.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
