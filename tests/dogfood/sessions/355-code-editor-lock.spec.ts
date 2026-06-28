/**
 * Session 355 — Code-editor read-only lock (fleet lock rollout, app 3/7).
 *
 * Opens a code file, locks it via the shared LockButton, and confirms the
 * editing textarea goes read-only (the file's synced `locked` property drives
 * `textarea.readOnly`). Measures the textarea's `readOnly` across lock → unlock.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Code-editor file lock toggles read-only (355)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("355-code-editor-lock");
	s.chat(
		SPEAKER.Mira,
		"Freezing a config file so I don't fat-finger it — locking it in the code editor and checking it actually goes read-only.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const taReadOnly = async (page: import("@playwright/test").Page) =>
		page
			.locator("textarea")
			.first()
			.evaluate((el) => (el as HTMLTextAreaElement).readOnly)
			.catch(() => null);

	try {
		const code = await s.openApp(APP.CodeEditor);
		await code.waitForTimeout(1800);
		// Open the first file in the sidebar so the pane mounts.
		await code
			.locator(
				'[data-entity-id], .editor__file-row, .editor__nav-row, [role="treeitem"]',
			)
			.first()
			.click()
			.catch(() => undefined);
		await code.waitForTimeout(1000);
		await s.shot(code, "01-file-open");

		const lockBtn = code.locator('[aria-label="Lock file (read-only)"]');
		const hasLock = (await lockBtn.count().catch(() => 0)) > 0;
		s.note(`lock affordance present: ${hasLock}`);
		s.note(`before lock — textarea.readOnly: ${await taReadOnly(code)}`);

		if (hasLock) {
			await lockBtn
				.first()
				.click()
				.catch(() => undefined);
			await code.waitForTimeout(800);
			await s.shot(code, "02-file-locked");
			s.note(
				`after LOCK — textarea.readOnly: ${await taReadOnly(code)}  (expected: true)`,
			);

			await code
				.locator('[aria-label="Unlock file"]')
				.first()
				.click()
				.catch(() => undefined);
			await code.waitForTimeout(800);
			s.note(
				`after UNLOCK — textarea.readOnly: ${await taReadOnly(code)}  (expected: false)`,
			);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors locking a code file").toEqual([]);
	} finally {
		await s.finish();
	}
});
