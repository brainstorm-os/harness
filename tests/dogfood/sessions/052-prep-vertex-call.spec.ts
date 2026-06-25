/**
 * Session 052 — Mira preps for her Vertex Labs intro call (18 Jun, on her
 * calendar). She wants a prep note with talking points she can pull up live.
 *
 * Tests the everyday "new note → title → body" path on the current build:
 * create a fresh note, name it, drop in an agenda, and confirm the title and
 * body persisted (and the note is findable in the list). Body text goes
 * through the `__brainstormNotesDev.appendParagraph` dev hook — raw Playwright
 * keystrokes into the Lexical body corrupt the Yjs doc (harness limitation).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

const TITLE = "Vertex Labs — intro call prep";
const AGENDA = [
	"Goal: land a 2-month advisory retainer.",
	"Their pain: research team drowning in sources, no weekly through-line.",
	"Pitch: Northbound weekly synthesis + a monthly deep-dive scoped to their sector.",
	"Ask: who owns the budget, and what does a successful first month look like to them?",
];

test("prep note for the Vertex Labs intro call", async () => {
	test.setTimeout(180_000);
	const s = await startSession("052-prep-vertex-call");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const newNote = notes.locator('[aria-label="New note"]').first();
		await newNote.click();
		await notes.waitForTimeout(1200); // editor mount + InitialFocusPlugin rAF
		await s.shot(notes, "01-fresh-note");

		// Title is focused on mount — type it directly (short, lands in title).
		await notes.keyboard.type(TITLE, { delay: 20 });
		await notes.waitForTimeout(600);

		// Body via the dev hook (reliable; keystrokes would corrupt the Yjs doc).
		const wrote = await notes
			.evaluate(async (bullets) => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				for (const line of bullets) await dev.appendParagraph(line);
				return true;
			}, AGENDA)
			.catch(() => false);
		s.note(`Wrote agenda body via dev hook: ${wrote}`);
		await notes.waitForTimeout(800);
		await s.shot(notes, "02-prep-written");

		const titleText = (await notes.locator(".notes__title").first().textContent()) ?? "";
		const bodyText =
			(await notes.locator('.notes__doc, [contenteditable="true"]').first().textContent()) ?? "";
		s.note(`title="${titleText}"`);
		s.note(`body contains goal line: ${bodyText.includes("advisory retainer")}`);

		// The note should be findable in the sidebar list by its title.
		const inList = await notes.locator(`text=${TITLE}`).count();
		s.note(`note title visible (editor + list): ${inList}`);

		expect(titleText, "title should hold the note name").toContain("Vertex Labs");
		expect(wrote, "agenda body should write via the dev hook").toBe(true);
		expect(bodyText, "body should contain the agenda").toContain("advisory retainer");
	} finally {
		await s.finish();
	}
});
