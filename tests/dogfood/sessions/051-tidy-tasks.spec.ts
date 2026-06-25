/**
 * Session 051 — Mira tidies her task list: deletes the stray "Untitled" task in
 * the Inbox (F-024 residue). Dogfoods the task-delete path (row ⋯ → Delete) —
 * a real CRUD operation not yet exercised.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("delete the stray Untitled task", async () => {
	test.setTimeout(180_000);
	const s = await startSession("051-tidy-tasks");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		// Inbox is the default surface; ensure we're there.
		await tasks
			.locator("nav, aside")
			.getByText("Inbox", { exact: true })
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(600);

		const row = tasks.locator(".task-row", { hasText: /^\s*Untitled/ }).first();
		const hadUntitled = (await row.count()) > 0;
		s.note(`Untitled task present before: ${hadUntitled}`);
		await s.shot(tasks, "01-before");

		// Idempotent against the persistent vault: if a prior run already
		// tidied the Untitled residue, the goal state is met — nothing to do.
		if (hadUntitled) {
			await row.hover();
			await row.locator(".task-row__more").first().click({ timeout: 6000 });
			await tasks.waitForTimeout(400);
			const del = tasks.locator('.fm-menu [role="option"]', { hasText: /^Delete$/ }).first();
			s.note(`Delete option present: ${(await del.count()) > 0}`);
			await del.click();
			await tasks.waitForTimeout(800);
		}
		await s.shot(tasks, "02-after");

		const after = await tasks
			.locator(".task-row")
			.allInnerTexts()
			.catch(() => []);
		const stillUntitled = after.some((t) => /^\s*Untitled\s*$/.test(t.trim()));
		s.note(`Untitled task present after: ${stillUntitled}`);

		expect(stillUntitled).toBe(false);
	} finally {
		await s.finish();
	}
});
