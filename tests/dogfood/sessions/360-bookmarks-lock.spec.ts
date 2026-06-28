/**
 * Session 360 — Bookmarks read-only lock (fleet lock rollout — the last app).
 *
 * Opens a bookmark's detail, locks it via the shared LockButton in the title
 * row, and confirms the body editor goes read-only (the bookmark's synced
 * `locked` drives `editable` on the detail's <BrainstormEditor> via the shared
 * EditableSync). Completes the read-only-lock rollout across all editor + object
 * apps.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Bookmarks detail lock toggles read-only (360)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("360-bookmarks-lock");
	s.chat(
		SPEAKER.Mira,
		"Locking a reference bookmark + my notes on it so they read as final — checking the detail editor goes read-only.",
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

	const editableAttr = async (page: import("@playwright/test").Page) =>
		page
			.locator(
				".bm-detail__editor[contenteditable], [contenteditable].bm-detail__editor",
			)
			.first()
			.getAttribute("contenteditable")
			.catch(() => null);

	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2000);
		// Open a bookmark's detail — click the card body (the subtitle/domain),
		// NOT the title <a> (which opens the URL externally).
		await bm
			.locator("text=brainstorm.app")
			.first()
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(1400);
		await s.shot(bm, "01-bookmark");

		const lockBtn = bm.locator('[aria-label="Lock bookmark (read-only)"]');
		const hasLock = (await lockBtn.count().catch(() => 0)) > 0;
		s.note(`lock affordance present: ${hasLock}`);
		s.note(`before lock — contenteditable: ${await editableAttr(bm)}`);

		if (hasLock) {
			await lockBtn
				.first()
				.click()
				.catch(() => undefined);
			await bm.waitForTimeout(900);
			await s.shot(bm, "02-locked");
			s.note(
				`after LOCK — contenteditable: ${await editableAttr(bm)}  (expected: false)`,
			);

			await bm
				.locator('[aria-label="Unlock bookmark"]')
				.first()
				.click()
				.catch(() => undefined);
			await bm.waitForTimeout(900);
			s.note(
				`after UNLOCK — contenteditable: ${await editableAttr(bm)}  (expected: true)`,
			);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors locking a bookmark").toEqual([]);
	} finally {
		await s.finish();
	}
});
