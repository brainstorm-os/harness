/**
 * Session 001 — Day one.
 *
 * Mira opens Brainstorm for the first time and tries to set up Northbound:
 * get her bearings on the dashboard, find where notes live, start her first
 * research note, and see whether there's an obvious place for a client CRM
 * and her deliverables. She is brand new — she does not know the keyboard
 * shortcuts or where anything is. Whatever is confusing here is onboarding
 * friction worth reporting.
 *
 * This is NOT a pass/fail test. It walks Mira through the product and captures
 * what she sees; the friction is distilled afterward into the friction log.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("day one — get set up in Northbound", async () => {
	test.setTimeout(300_000);
	const s = await startSession("001-day-one");
	try {
		// 1. First impression: the dashboard.
		await s.dashboard.waitForTimeout(1500);
		await s.shot(s.dashboard, "dashboard");
		s.note("Opened the app. First thing I see is the dashboard.");

		// 2. Where do my notes go? Open Notes and look for a way to start writing.
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await s.shot(notes, "notes-empty");
		s.note("Opened Notes — is it obvious how to start a new note?");

		// Try the most-likely-discoverable affordance: a visible "new" control.
		const newNote = notes
			.locator('button:has-text("New"), [aria-label*="new" i], [title*="new" i], button:has-text("+")')
			.first();
		if (await newNote.count()) {
			await newNote.click().catch(() => undefined);
			await notes.waitForTimeout(1000);
			await s.shot(notes, "notes-after-new");
			s.note("Clicked what looked like a new-note control.");
		} else {
			s.note("Couldn't spot an obvious new-note button on first look.");
		}

		// Can I just start typing my first research note?
		const editable = notes.locator('[contenteditable="true"]').first();
		if (await editable.count()) {
			await editable.click().catch(() => undefined);
			await notes.waitForTimeout(300);
			await editable.type("Northbound — research thesis", { delay: 25 }).catch(() => undefined);
			await notes.waitForTimeout(800);
			await s.shot(notes, "notes-typed");
			s.note("Tried typing a title into the editor.");
		}

		// 3. My business needs a client CRM — is Database the place?
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await s.shot(db, "database");
		s.note("Opened Database — would I figure out this is where a CRM goes?");

		// 4. And my deliverables — Tasks.
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await s.shot(tasks, "tasks");
		s.note("Opened Tasks — looking for where this week's work lives.");

		// 5. Daily cadence — Journal.
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1500);
		await s.shot(journal, "journal");
		s.note("Opened Journal — does today have a place to write?");

		s.note("\nEnd of day one. Distilling friction into the log.");
		// The session always 'passes' — its product is the captures, not an assertion.
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
