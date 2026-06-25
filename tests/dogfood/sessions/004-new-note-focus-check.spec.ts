/**
 * Session 004 — verify F-001's real behavior.
 *
 * F-001 claimed a new note's title text lands in the body. But the editor has
 * an InitialFocusPlugin that focuses the TitleNode on mount — and session 001
 * *clicked into the body* before typing, which would override that. This tests
 * the honest behavior: create a note, DON'T click, type immediately, and see
 * whether the title or the body captured the text.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("new note focuses the title (F-001 honest repro)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("004-new-note-focus-check");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const newNote = notes.locator('[aria-label="New note"]').first();
		await newNote.click();
		// Let the editor mount + InitialFocusPlugin's rAF run.
		await notes.waitForTimeout(1200);
		await s.shot(notes, "fresh-note");

		// Type WITHOUT clicking anywhere — wherever the editor put the cursor.
		const TYPED = "My research thesis title";
		await notes.keyboard.type(TYPED, { delay: 20 });
		await notes.waitForTimeout(800);
		await s.shot(notes, "after-typing");

		const titleText = (await notes.locator(".notes__title").first().textContent()) ?? "";
		const firstPara =
			(await notes.locator('.notes__doc p, [contenteditable="true"] p').first().textContent()) ?? "";
		s.note(`title="${titleText}"  firstPara="${firstPara}"`);

		// The honest expectation: text lands in the TITLE, not the body.
		expect(titleText, "typed text should land in the title on a fresh note").toContain(TYPED);
	} finally {
		await s.finish();
	}
});
