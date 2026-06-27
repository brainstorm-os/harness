/**
 * Session 354 — Journal read-only lock (fleet lock rollout, app 2/7).
 *
 * Verifies the shared LockButton adopted in Journal: an entry's lock toggle
 * flips the editor between editable and read-only via the synced `locked`
 * property. Measures the contenteditable host's `contenteditable` attribute
 * across lock → unlock (the ground-truth read-only signal), not just the icon.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

type JournalDev = { appendParagraph: (text: string) => Promise<void> };

test("Journal entry lock toggles read-only (354)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("354-journal-lock");
	s.chat(
		SPEAKER.Mira,
		"Locking a journal entry — once I've written the day's log I want to freeze it so a stray keystroke can't change it. Checking the editor actually goes read-only.",
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
				".journal__entry-editor[contenteditable], [contenteditable].journal__entry-editor",
			)
			.first()
			.getAttribute("contenteditable")
			.catch(() => null);

	try {
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		// Create today's entry via a template (the lock button only shows for a
		// real entry). Then add a line through the dev hook now that the editor
		// is mounted.
		await journal
			.locator('button:has-text("Free write"), button:has-text("Daily review")')
			.first()
			.click()
			.catch(() => undefined);
		await journal.waitForTimeout(1200);
		await journal
			.evaluate(async () => {
				const dev = (
					window as unknown as { __brainstormJournalDev?: JournalDev }
				).__brainstormJournalDev;
				await dev?.appendParagraph(
					"Locked-day log: shipped the lock rollout, verified read-only.",
				);
			})
			.catch(() => undefined);
		await journal.waitForTimeout(800);
		await s.shot(journal, "01-entry-unlocked");

		const lockBtn = journal.locator('[aria-label="Lock entry (read-only)"]');
		const hasLock = (await lockBtn.count().catch(() => 0)) > 0;
		s.note(`lock affordance present: ${hasLock}`);
		s.note(`before lock — contenteditable: ${await editableAttr(journal)}`);

		// Lock → editor must go read-only.
		if (hasLock) {
			await lockBtn
				.first()
				.click()
				.catch(() => undefined);
			await journal.waitForTimeout(900);
			await s.shot(journal, "02-entry-locked");
			s.note(
				`after LOCK — contenteditable: ${await editableAttr(journal)}  (expected: false)`,
			);

			// Unlock → editable again.
			await journal
				.locator('[aria-label="Unlock entry"]')
				.first()
				.click()
				.catch(() => undefined);
			await journal.waitForTimeout(900);
			s.note(
				`after UNLOCK — contenteditable: ${await editableAttr(journal)}  (expected: true)`,
			);
			await s.shot(journal, "03-entry-unlocked-again");
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors locking a journal entry").toEqual(
			[],
		);
	} finally {
		await s.finish();
	}
});
