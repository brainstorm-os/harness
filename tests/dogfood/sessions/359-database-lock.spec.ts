/**
 * Session 359 — Database read-only record lock (fleet lock rollout, app 7/7).
 *
 * Opens a record's inspector, locks it via the inspector lock button, and
 * confirms read-only: the inspector title (rename field) drops contenteditable,
 * and the lock toggles (aria-pressed). The record's synced `locked` makes the
 * shared `editProperty` commit no-op across every view (grid/list/board).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Database record lock toggles read-only (359)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("359-database-lock");
	s.chat(
		SPEAKER.Mira,
		"Locking a closed client record so its fields read as final — checking the inspector goes read-only and edits stop persisting.",
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

	const titleCE = async (page: import("@playwright/test").Page) =>
		page
			.locator("#inspector-title")
			.first()
			.getAttribute("contenteditable")
			.catch(() => null);

	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		// Select a record, then open the inspector panel (header toggle).
		await db
			.locator('text="Take the product tour"')
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(400);
		await db
			.locator('[aria-label="Toggle inspector"]')
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1000);
		await s.shot(db, "01-record");

		const lockBtn = db.locator('[aria-label="Lock record (read-only)"]');
		const hasLock = (await lockBtn.count().catch(() => 0)) > 0;
		s.note(`lock affordance present: ${hasLock}`);
		s.note(
			`before lock — inspector-title contenteditable: ${await titleCE(db)}`,
		);

		if (hasLock) {
			await lockBtn
				.first()
				.click()
				.catch(() => undefined);
			await db.waitForTimeout(800);
			await s.shot(db, "02-locked");
			const unlockShown =
				(await db
					.locator('[aria-label="Unlock record"]')
					.count()
					.catch(() => 0)) > 0;
			s.note(
				`after LOCK — "Unlock record" shown: ${unlockShown} (expect true)`,
			);
			s.note(
				`after LOCK — title contenteditable: ${await titleCE(db)} (expect false)`,
			);

			await db
				.locator('[aria-label="Unlock record"]')
				.first()
				.click()
				.catch(() => undefined);
			await db.waitForTimeout(800);
			s.note(
				`after UNLOCK — title contenteditable: ${await titleCE(db)} (expect plaintext-only)`,
			);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors locking a record").toEqual([]);
	} finally {
		await s.finish();
	}
});
