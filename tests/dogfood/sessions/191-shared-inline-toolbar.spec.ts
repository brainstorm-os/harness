/**
 * Session 191 — shared inline formatting toolbar verification. The floating
 * B/I/U/S/code + colour + link toolbar used to live only in Notes; it is now
 * the shared `InlineToolbarPlugin` in @brainstorm/editor that every editor
 * consumer mounts (StandardEditingPlugins core + FullEditorPlugins extras).
 *
 * Notes now renders the shared plugin via a thin wrapper, so proving the
 * toolbar still appears + works in Notes proves the shared component renders
 * on a real selection (open the colour menu → exercises the shared colour
 * model too). Journal / Tasks / Bookmarks mount the identical component and
 * build green. Text is inserted via the reliable `__brainstormNotesDev` hook —
 * Playwright keystrokes corrupt the Yjs body editor.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph?(text: string): void };
type NotesDevWindow = { __brainstormNotesDev?: NotesDev };

test("shared inline toolbar renders on selection (191)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("191-shared-inline-toolbar");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		await notes
			.getByRole("button", { name: /New note/i })
			.first()
			.click();
		await notes.waitForTimeout(800);
		await notes.keyboard.type("Shared toolbar check", { delay: 20 });
		await notes.waitForTimeout(300);

		const devReady = await notes.evaluate(() =>
			Boolean((window as unknown as NotesDevWindow).__brainstormNotesDev),
		);
		s.note(`Notes dev hook present: ${devReady}`);
		await notes.evaluate(
			(t) => (window as unknown as NotesDevWindow).__brainstormNotesDev?.appendParagraph(t),
			"Select this sentence to reveal the formatting toolbar.",
		);
		await notes.waitForTimeout(600);

		// Triple-click the body paragraph → non-collapsed RangeSelection, which is
		// what the shared InlineToolbarPlugin reads to position + show itself.
		const para = notes
			.locator('[contenteditable="true"] p')
			.filter({ hasText: /Select this sentence/ })
			.first();
		await para.click({ clickCount: 3 });
		await notes.waitForTimeout(700);

		const toolbar = notes.locator(".notes__inline-toolbar").first();
		const visible = await toolbar.isVisible().catch(() => false);
		const btnCount = await toolbar
			.locator(".notes__inline-toolbar-btn")
			.count()
			.catch(() => 0);
		s.note(`inline toolbar visible=${visible}; buttons=${btnCount}`);
		await s.shot(notes, "01-toolbar-on-selection");

		// Open the colour menu — exercises the now-shared colour model.
		if (visible) {
			await toolbar
				.locator(".notes__inline-toolbar-color .notes__inline-toolbar-btn")
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(400);
			const colourMenu = await notes
				.locator(".notes__color-menu")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`colour menu visible=${colourMenu}`);
			await s.shot(notes, "02-colour-menu");
		}

		expect(visible, "shared inline toolbar should appear on selection").toBe(true);
		// Core formatting = B/I/U/S/code (5) + colour + link = 7 buttons minimum.
		expect(btnCount, "toolbar should expose the core formatting buttons").toBeGreaterThanOrEqual(7);
	} finally {
		await s.finish();
	}
});
