/**
 * Session 243 — control for F-251: does NOTES (same resolver + editor, but no
 * body re-seed, React app) lose its body on reopen the way the Journal does?
 * Append a marker to the open note via the dev hook, reopen the app, assert the
 * marker survives. If Notes survives and Journal doesn't, the bug is
 * journal-specific; if both blank, it's the core CRDT hydration path.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (t: string) => Promise<void>;
	currentNoteId: () => string | null;
};

const append = (page: Page, text: string) =>
	page
		.evaluate(
			(t) =>
				(
					window as unknown as { __brainstormNotesDev?: NotesDev }
				).__brainstormNotesDev?.appendParagraph(t),
			text,
		)
		.then(() => "ok")
		.catch((e) => `ERR:${(e as Error).message}`);

const noteId = (page: Page) =>
	page
		.evaluate(
			() =>
				(
					window as unknown as { __brainstormNotesDev?: NotesDev }
				).__brainstormNotesDev?.currentNoteId() ?? "NO_HOOK",
		)
		.catch(() => "ERR");

const bodyText = (page: Page) =>
	page
		.locator('.notes__body [contenteditable="true"], .notes__contenteditable')
		.first()
		.innerText()
		.catch(() => "(none)");

test("notes body persists across reopen (243 — F-251 control)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("243-notes-persistence");
	try {
		const n = await s.openApp(APP.Notes);
		await n.waitForTimeout(2800);
		const id = await noteId(n);
		s.note(`open note id: ${id}`);
		await s.shot(n, "01-open");
		const marker = "NOTES-PERSIST-243-qowzix";
		s.note(`append: ${await append(n, marker)}`);
		await n.waitForTimeout(1500);
		const afterWrite = await bodyText(n);
		s.note(`after write contains marker: ${afterWrite.includes(marker)} (len ${afterWrite.length})`);
		await s.shot(n, "02-after-write");

		const reopened = await s.openApp(APP.Notes);
		await reopened.waitForTimeout(2600);
		// Select the same note id in the reopened window via its sidebar.
		await reopened
			.locator(`.notes__sidebar-item:has-text("${marker.slice(0, 6)}")`)
			.first()
			.click()
			.catch(() => undefined);
		await reopened.waitForTimeout(1500);
		const afterReopen = await bodyText(reopened);
		s.note(
			`after REOPEN contains marker: ${afterReopen.includes(marker)} (len ${afterReopen.length})`,
		);
		s.note(`reopen body: ${JSON.stringify(afterReopen.slice(0, 120))}`);
		await s.shot(reopened, "03-after-reopen");

		expect(afterWrite.includes(marker), "marker present after write").toBe(true);
		expect(afterReopen.includes(marker), "marker survives reopen").toBe(true);
	} finally {
		await s.finish();
	}
});
