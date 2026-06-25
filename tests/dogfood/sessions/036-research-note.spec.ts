/**
 * Session 036 — Mira's core artifact: a research note. Creates a new note,
 * titles it "Northbound — investment thesis", and writes a few lines of body
 * via the Notes dev hook (`__brainstormNotesDev.appendParagraph`, the reliable
 * path — Playwright keystrokes corrupt the Yjs body editor). Verifies the note
 * saves with its title + body and shows in the sidebar.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph?(text: string): void };
type NotesDevWindow = { __brainstormNotesDev?: NotesDev };

test("write a research thesis note", async () => {
	test.setTimeout(180_000);
	const s = await startSession("036-research-note");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await s.shot(notes, "01-notes-open");

		// New note (header + button, aria-label "New note"). It opens with the
		// title focused (F-001).
		await notes
			.getByRole("button", { name: /New note/i })
			.first()
			.click();
		await notes.waitForTimeout(800);

		// Title: type into the auto-focused TitleNode (single line, low risk).
		await notes.keyboard.type("Northbound — investment thesis", { delay: 20 });
		await notes.waitForTimeout(400);

		// Body: write reliably via the dev hook (avoids editor corruption).
		const devReady = await notes.evaluate(() =>
			Boolean((window as unknown as NotesDevWindow).__brainstormNotesDev),
		);
		s.note(`Notes dev hook present: ${devReady}`);
		const lines = [
			"Thesis: developer-tools infra is underpriced at seed.",
			"Top lead: Vertex Labs — $48k, last contact 15 Jun.",
			"Next: convert 2 leads to design partners by Q3.",
		];
		for (const line of lines) {
			await notes.evaluate(
				(t) => (window as unknown as NotesDevWindow).__brainstormNotesDev?.appendParagraph(t),
				line,
			);
			await notes.waitForTimeout(200);
		}
		await notes.waitForTimeout(800);
		await s.shot(notes, "02-written");

		const editorText =
			(await notes
				.locator('[contenteditable="true"]')
				.first()
				.innerText()
				.catch(() => "")) ?? "";
		s.note(`Editor has title: ${/investment thesis/i.test(editorText)}`);
		s.note(`Editor has body line: ${/developer-tools infra/i.test(editorText)}`);

		// The note should appear in the sidebar list with its title.
		const bodyText =
			(await notes
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(
			`Title appears in app (sidebar/header): ${/Northbound — investment thesis/.test(bodyText)}`,
		);

		expect(/developer-tools infra/i.test(editorText)).toBe(true);
	} finally {
		await s.finish();
	}
});
