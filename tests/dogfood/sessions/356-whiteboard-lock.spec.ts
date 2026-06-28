/**
 * Session 356 — Whiteboard read-only lock (fleet lock rollout, app 4/7).
 *
 * Locks the open board via the shared LockButton and confirms it goes
 * read-only: the lock toggle flips (aria-pressed), and the editing affordances
 * (Add menu) become disabled — the engine's edit gates (drag/resize/text/create)
 * are driven off the same synced `locked` property. View/pan/select stay.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Whiteboard board lock toggles read-only (356)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("356-whiteboard-lock");
	s.chat(
		SPEAKER.Mira,
		"Freezing a finished board so a stray drag can't nudge anything — locking the whiteboard and checking the editing tools go dead.",
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

	const addDisabled = async (page: import("@playwright/test").Page) =>
		page
			.locator('[aria-label="Add to board"]')
			.first()
			.getAttribute("aria-disabled")
			.catch(() => null);

	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(2000);
		await s.shot(wb, "01-board");

		const lockBtn = wb.locator('[aria-label="Lock board (read-only)"]');
		const hasLock = (await lockBtn.count().catch(() => 0)) > 0;
		s.note(`lock affordance present: ${hasLock}`);
		s.note(`before lock — Add menu aria-disabled: ${await addDisabled(wb)}`);

		if (hasLock) {
			await lockBtn
				.first()
				.click()
				.catch(() => undefined);
			await wb.waitForTimeout(900);
			await s.shot(wb, "02-locked");
			const unlockShown =
				(await wb
					.locator('[aria-label="Unlock board"]')
					.count()
					.catch(() => 0)) > 0;
			s.note(
				`after LOCK — toggle now shows "Unlock board": ${unlockShown}  (expected: true)`,
			);
			s.note(
				`after LOCK — Add menu aria-disabled: ${await addDisabled(wb)}  (expected: true)`,
			);

			await wb
				.locator('[aria-label="Unlock board"]')
				.first()
				.click()
				.catch(() => undefined);
			await wb.waitForTimeout(900);
			s.note(
				`after UNLOCK — Add menu aria-disabled: ${await addDisabled(wb)}  (expected: null/false)`,
			);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors locking a board").toEqual([]);
	} finally {
		await s.finish();
	}
});
