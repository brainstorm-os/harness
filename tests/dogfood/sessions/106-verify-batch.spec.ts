/**
 * Session 106 — Marcus re-verifies the merged fix batch (real shell).
 *
 * Closes the loop on the fixes that only had unit/typecheck verification:
 * F-040 (Calendar no "0:00"), F-039 (Notes untitled ordinals), F-047 (Files no
 * empty placeholder sections), F-050 (Bookmarks "Tag board"), F-051 (Code Editor
 * no schema jargon). Captures the evidence; the verdict is read back afterward.
 * Built fresh (no SKIP_BUILD) so the merged code is what runs.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("verify the fix batch in the real shell (106)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("106-verify-batch");
	try {
		// F-040 — Calendar agenda chips should not lead with "0:00".
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);
		await cal.locator('.cal-toolbar__tab[data-view="agenda"]').first().click();
		await cal.waitForTimeout(700);
		await s.shot(cal, "01-calendar-agenda");
		const chips = (await cal.locator(".cal-chip").allInnerTexts()).map((t) =>
			t.replace(/\s+/g, " ").trim(),
		);
		s.note(`F-040 agenda chips: ${JSON.stringify(chips)}`);
		s.note(`F-040 any "0:00"? ${chips.some((t) => /\b0:00\b/.test(t))}`);

		// F-039 — Notes untitled rows sharing a minute should be numbered.
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await s.shot(notes, "02-notes-list");
		const titles = (await notes.locator(".notes__sidebar-title").allInnerTexts()).map((t) =>
			t.trim(),
		);
		const untitled = titles.filter((t) => /^Untitled/.test(t));
		s.note(`F-039 untitled labels: ${JSON.stringify(untitled.slice(0, 12))}`);
		s.note(`F-039 distinct of ${untitled.length}: ${new Set(untitled).size}`);

		// F-047 — Files sidebar should NOT show empty "Smart folders"/"Tags" sections.
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1500);
		await s.shot(files, "03-files");
		const sections = (
			await files
				.locator(".sidebar [class*='section'], .sidebar h3, .sidebar [role='heading']")
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`F-047 Files sidebar sections: ${JSON.stringify(sections)}`);

		// F-050 — Bookmarks surface nav should read "Tag board", not a 2nd "Tags".
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "04-bookmarks");
		const navLabels = (await bm.locator(".bookmarks__nav-label").allInnerTexts()).map((t) =>
			t.trim(),
		);
		s.note(`F-050 Bookmarks surfaces: ${JSON.stringify(navLabels)}`);

		// F-051 — Code Editor empty-state should not mention "CodeFile entities".
		const code = await s.openApp(APP.CodeEditor);
		await code.waitForTimeout(1500);
		await s.shot(code, "05-code");
		const sub = await code
			.locator(".editor__empty-sub")
			.first()
			.textContent()
			.catch(() => "");
		s.note(`F-051 code empty sub: ${JSON.stringify((sub ?? "").trim())}`);

		s.note("captured the fix-batch verification surfaces");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
