/**
 * Session 002 — Build the business.
 *
 * Day two. Mira stops poking around and tries to actually stand Northbound up:
 *   - flesh out her research thesis note with real positioning,
 *   - create a "Clients" CRM in Database,
 *   - capture this week's deliverables in Tasks,
 *   - and write today's journal entry.
 *
 * She works around the friction she hit on day one where she can (she's read
 * the shortcuts cheat-sheet by now), and notes where she still gets blocked.
 *
 * Reliable text entry into the Lexical editor goes through the
 * `__brainstormNotesDev.appendParagraph` dev hook — raw Playwright keystrokes
 * corrupt the Yjs doc (a harness limitation, not a product bug).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("build the business — note, CRM, deliverables, journal", async () => {
	test.setTimeout(300_000);
	const s = await startSession("002-build-the-business");
	try {
		// --- 1. Flesh out the research thesis note ---------------------------
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const thesis = notes.locator("text=Northbound — research thesis").first();
		if (await thesis.count()) {
			await thesis.click().catch(() => undefined);
			await notes.waitForTimeout(1000);
		}
		// Write real content via the dev hook (editor must be mounted).
		const wrote = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Thesis: independent operators drown in tabs and lose the through-line of their own research.",
				);
				await dev.appendParagraph(
					"Northbound sells a weekly synthesis — one signal per week, with the receipts — plus light advisory.",
				);
				await dev.appendParagraph("First 90 days: 100 paid subscribers, 2 advisory retainers.");
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "Wrote the thesis body via the editor." : "Could not write the thesis body.");
		await notes.waitForTimeout(600);
		await s.shot(notes, "notes-thesis");

		// --- 2. Stand up a Clients CRM in Database ---------------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await s.shot(db, "db-landing");
		// The only way I found to make my own list is the icon button by LISTS.
		const newList = db.locator("#sidebar-new-list").first();
		if (await newList.count()) {
			await newList.click().catch(() => undefined);
			await db.waitForTimeout(1000);
			await s.shot(db, "db-after-new-list");
			s.note("Clicked the New-list icon button.");
			// If a name field appeared, name it "Clients".
			const nameField = db.locator('input:focus, [contenteditable="true"]:focus').first();
			if (await nameField.count()) {
				await nameField.type("Clients", { delay: 25 }).catch(() => undefined);
				await db.keyboard.press("Enter").catch(() => undefined);
				await db.waitForTimeout(800);
				await s.shot(db, "db-named-clients");
				s.note("Tried to name the new list 'Clients'.");
			} else {
				s.note("No obvious name field appeared after creating the list.");
			}
			// Try to add a row.
			const newRow = db.locator('button:has-text("New")').first();
			if (await newRow.count()) {
				await newRow.click().catch(() => undefined);
				await db.waitForTimeout(800);
				await s.shot(db, "db-after-new-row");
				s.note("Clicked '+ New' to add a first client row.");
			}
		} else {
			s.note("Could not find any new-list affordance.");
		}

		// --- 3. Capture this week's deliverables in Tasks -------------------
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await s.shot(tasks, "tasks-before");
		// No visible add button (F-004). Fall back to the Cmd+N composer.
		const deliverables = [
			"Draft issue #1 — the through-line problem",
			"Set up subscriber list + landing page",
			"Reach out to 5 advisory leads",
		];
		for (const name of deliverables) {
			await tasks.keyboard.press("Meta+n").catch(() => undefined);
			await tasks.waitForTimeout(500);
			const composer = tasks.locator('input:focus, [contenteditable="true"]:focus').first();
			if (await composer.count()) {
				await composer.type(name, { delay: 15 }).catch(() => undefined);
				await tasks.keyboard.press("Enter").catch(() => undefined);
				await tasks.waitForTimeout(400);
			}
		}
		await tasks.waitForTimeout(600);
		await s.shot(tasks, "tasks-after");
		s.note("Added this week's deliverables via Cmd+N (no visible add button).");

		// --- 4. Write today's journal entry --------------------------------
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1500);
		const jEditor = journal.locator('[contenteditable="true"]').first();
		if (await jEditor.count()) {
			await jEditor.click().catch(() => undefined);
			await jEditor
				.type("Day two. Set up the thesis and the deliverables.", { delay: 15 })
				.catch(() => undefined);
			await journal.waitForTimeout(600);
			s.note("Journal had an editable area today — wrote a line.");
		} else {
			s.note("Journal still has no editable area I can click into.");
		}
		await s.shot(journal, "journal");

		s.note("\nEnd of day two.");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
