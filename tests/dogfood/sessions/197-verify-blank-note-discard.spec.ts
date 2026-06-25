/**
 * Session 197 — verify the F-196 fix: a blank note discarded on leaving Notes.
 *
 * 196 surfaced a sidebar full of "Untitled" ghosts: the F-066 auto-discard only
 * fired when you switched note→note, so creating a blank and then closing /
 * leaving the window left it forever. The fix discards an abandoned-empty
 * session-created note when the app is parked/hidden (the shell's
 * `brainstorm:app-visibility` event). This drives that path directly: create a
 * blank note, dispatch the hide event the shell emits on park, and confirm the
 * blank is gone from the sidebar while a sibling note with content survives.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("a blank note is discarded when Notes is parked (197)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("197-verify-blank-note-discard");
	try {
		s.chat(
			SPEAKER.Kai,
			"Verifying the Untitled-ghost fix (F-196): a blank note created this session should evaporate when you leave Notes, not pile up in the sidebar.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// Count Note-type entities straight from the shared store — the sidebar
		// is virtualized (rendered rows are viewport-capped), so a row count
		// can't see a single note appear/vanish in a large vault.
		const NOTE_TYPE = "io.brainstorm.notes/Note/v1";
		const countNotes = async () =>
			await notes.evaluate(async (type) => {
				const bs = (
					window as unknown as {
						brainstorm?: {
							services?: { vaultEntities?: { list: () => Promise<{ entities: { type: string }[] }> } };
						};
					}
				).brainstorm;
				const snap = await bs?.services?.vaultEntities?.list();
				return (snap?.entities ?? []).filter((e) => e.type === type).length;
			}, NOTE_TYPE);

		// 1) A note WITH content — the control that must survive.
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1000);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowUp");
		await notes.keyboard.type("Keep me — has content", { delay: 8 });
		await notes.waitForTimeout(800);

		// 2) A brand-new BLANK note, left selected and untouched.
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1200);
		const beforeNotes = await countNotes();
		s.note(`Note entities after content-note + blank-note: ${beforeNotes}`);
		await s.shot(notes, "01-before-park");

		// 3) Park the window the way the shell does — dispatch the visibility
		// event Notes listens for. (Real shells emit this on window close/park.)
		await notes.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent("brainstorm:app-visibility", { detail: { visible: false } }),
			);
		});
		await notes.waitForTimeout(1800);

		const afterNotes = await countNotes();
		s.note(`Note entities after park (blank should be discarded): ${afterNotes}`);
		await s.shot(notes, "02-after-park");

		const keepPresent = await notes
			.locator("text=Keep me — has content")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`content note still present after park: ${keepPresent}`);

		// The blank evaporates (one fewer Note entity); the content note survives.
		expect(afterNotes).toBe(beforeNotes - 1);
		expect(keepPresent).toBe(true);

		s.chat(
			SPEAKER.Kai,
			afterNotes < beforeNotes
				? "Confirmed: the blank note is discarded on park, the content note stays. No more Untitled pile-up. F-196 closed."
				: "Blank note survived the park — fix didn't take; reopening F-196.",
		);
	} finally {
		await s.finish();
	}
});
