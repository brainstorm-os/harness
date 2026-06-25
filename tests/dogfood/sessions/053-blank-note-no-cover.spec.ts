/**
 * Session 053 — Mira makes a new note and it no longer shouts at her.
 *
 * F-002: a brand-new note used to open with a giant id-seeded gold cover
 * banner she never chose. The fix (per the user's "Notion-style" call): a
 * coverless note shows NO band in its own editor — just a quiet, discoverable
 * "Add cover" affordance — while the seeded gradient still backs every
 * reserved-space surface (gallery cards, list, search, dashboard pins).
 *
 * This session verifies the editor side of that: a fresh note has no cover
 * band, the "Add cover" affordance is present, and clicking it opens the
 * cover picker so a cover is still one click away.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("a brand-new note opens with no unchosen cover banner (F-002)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("053-blank-note-no-cover");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const newNote = notes.locator('[aria-label="New note"]').first();
		await newNote.click();
		await notes.waitForTimeout(1200); // editor mount
		await s.shot(notes, "01-fresh-note");

		const band = await notes.locator(".notes__doc-cover").count();
		const addCover = await notes.locator(".notes__doc-add-cover").count();
		s.note(`cover band on a blank note: ${band}`);
		s.note(`"Add cover" affordance present: ${addCover}`);

		expect(band, "a coverless note shows no full-bleed seeded-gradient band").toBe(0);
		expect(addCover, "the discoverable 'Add cover' affordance is shown instead").toBe(1);

		// A cover is still one click away — the affordance opens the picker.
		await notes.locator(".notes__doc-add-cover").first().click();
		await notes.waitForTimeout(500);
		const pickerOpen = await notes.locator('.cover-picker[role="dialog"]').count();
		s.note(`cover picker opens from the affordance: ${pickerOpen}`);
		await s.shot(notes, "02-cover-picker-open");

		expect(pickerOpen, "clicking 'Add cover' opens the cover picker").toBe(1);
	} finally {
		await s.finish();
	}
});
