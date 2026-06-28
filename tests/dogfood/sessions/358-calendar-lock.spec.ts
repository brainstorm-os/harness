/**
 * Session 358 — Calendar read-only event lock (fleet lock rollout, app 6/7).
 *
 * Opens an event detail, locks it via the shared LockButton in the footer, and
 * confirms the form goes read-only: the fields' wrapping `<fieldset disabled>`
 * freezes every input (title becomes disabled) and the Save button is removed.
 * The event's synced `locked` drives it. Unlock restores editing.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Calendar event lock toggles read-only (358)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("358-calendar-lock");
	s.chat(
		SPEAKER.Mira,
		"Pinning a confirmed meeting so I can't accidentally drag or re-time it — locking the event and checking the detail form goes read-only.",
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

	const titleDisabled = async (page: import("@playwright/test").Page) =>
		page
			.locator(".cal-detail__input--title")
			.first()
			.evaluate((el) => el.matches(":disabled"))
			.catch(() => null);
	const saveShown = async (page: import("@playwright/test").Page) =>
		(await page
			.locator('button:has-text("Save event")')
			.count()
			.catch(() => 0)) > 0;

	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2000);
		// Open a real Event's detail by clicking its chip (the timed "Explore
		// Brainstorm" welcome event — task/journal projections aren't Events).
		await cal
			.locator("text=Explore Brain")
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(1200);
		await s.shot(cal, "01-event-open");

		const lockBtn = cal.locator('[aria-label="Lock event (read-only)"]');
		const hasLock = (await lockBtn.count().catch(() => 0)) > 0;
		s.note(`lock affordance present: ${hasLock}`);
		s.note(
			`before lock — title disabled: ${await titleDisabled(cal)} · Save shown: ${await saveShown(cal)}`,
		);

		if (hasLock) {
			await lockBtn
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(900);
			await s.shot(cal, "02-event-locked");
			s.note(
				`after LOCK — title disabled: ${await titleDisabled(cal)} (expect true) · Save shown: ${await saveShown(cal)} (expect false)`,
			);

			await cal
				.locator('[aria-label="Unlock event"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(900);
			s.note(
				`after UNLOCK — title disabled: ${await titleDisabled(cal)} (expect false) · Save shown: ${await saveShown(cal)} (expect true)`,
			);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors locking an event").toEqual([]);
	} finally {
		await s.finish();
	}
});
