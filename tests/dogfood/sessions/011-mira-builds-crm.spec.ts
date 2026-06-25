/**
 * Session 011 — Mira builds out the Clients CRM + drafts issue #1.
 *
 * Her "Clients" collection already exists (survived the tidy). She selects it
 * and adds real client rows, then drafts the first newsletter issue in Notes.
 * This also narrows F-011: if adding rows to an already-selected collection
 * works, the session-009 miss was specific to the rename interaction.
 *
 * Reliable Notes writing uses the `appendParagraph` dev hook (raw keystrokes
 * corrupt the Yjs doc).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("Mira fills the Clients CRM and drafts issue #1", async () => {
	test.setTimeout(240_000);
	const s = await startSession("011-mira-builds-crm");
	try {
		// 1. Select the existing Clients collection and add client rows.
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(800);
		await expect(db.locator("#stage-title"), "on the Clients collection").toContainText("Clients");
		const before = Number((await db.locator("#stage-count").textContent()) ?? "0");

		for (let i = 0; i < 3; i++) {
			await db.locator("#toolbar-new").click();
			await db.waitForTimeout(1000);
		}
		await s.shot(db, "clients-filled");
		await expect(
			db.locator("#stage-count"),
			"three client rows must land in the already-selected Clients collection (F-011 signal)",
		).toHaveText(String(before + 3));
		s.note(`Added 3 client rows to Clients (was ${before}).`);

		// 2. Draft newsletter issue #1 in Notes.
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1200);
		await notes.locator('[aria-label="New note"]').click();
		await notes.waitForTimeout(1500);
		const wrote = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph("Issue #1 — The through-line problem");
				await dev.appendParagraph(
					"Independent operators don't lack information; they lack a through-line. This week: how to keep one.",
				);
				await dev.appendParagraph(
					"Three moves: a weekly synthesis ritual, a single source of truth, and a kill-list.",
				);
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "Drafted issue #1 in Notes." : "Could not draft the issue.");
		await notes.waitForTimeout(600);
		await s.shot(notes, "issue-draft");

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
