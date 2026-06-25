/**
 * Session 151 — Priya writes in the Journal now that it shares the full editor.
 *
 * The build is mid-unification: Tasks + Journal now mount the shared
 * `FullEditorPlugins` from `@brainstorm/editor` (was an "intentionally light"
 * journal editor). Priya — the knowledge-layer stress-tester — opens today's
 * entry and writes a real, structured daily log, then probes whether the
 * richer surface (slash menu) is reachable where it used to be a plain
 * paragraph box. The point is a regression sweep on the shared-editor mount:
 * does the journal body still take writing cleanly, no #83 / decorator /
 * Y.Doc errors? Reliable dev-hook writing for the body; a light, caught
 * keyboard probe for the slash affordance. Verdict from captures + console.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type JournalDev = {
	appendParagraph: (text: string) => Promise<void>;
	currentEntryId: () => string | null;
};

test("Priya writes in the shared-editor Journal (151)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("151-priya-journal-shared-editor");
	try {
		s.chat(
			SPEAKER.Priya,
			"Journal's on the shared editor now — writing today's log in it to see if it still takes structured writing cleanly, no surprises.",
		);

		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await s.shot(journal, "01-journal-open");

		// Today's empty day renders a plain placeholder editable, NOT the live
		// editor. The first input mints the entry and swaps in the mounted
		// `JournalEntryEditor` (FullEditorPlugins + the dev hook). Seed one
		// character to fire that handoff, then wait for the live editor's
		// contenteditable (`.journal__entry-editor`) before probing the shared
		// surface — otherwise we'd be testing the placeholder, not the editor.
		await journal
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await journal.keyboard.type("Daily log", { delay: 20 }).catch(() => undefined);
		await journal
			.locator(".journal__entry-editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await journal.waitForTimeout(800);
		const liveEditorMounted = await journal
			.locator(".journal__entry-editor")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`live JournalEntryEditor mounted after seed keystroke: ${liveEditorMounted}`);

		const entryId = await journal
			.evaluate(() => {
				const dev = (window as unknown as { __brainstormJournalDev?: JournalDev })
					.__brainstormJournalDev;
				return dev?.currentEntryId() ?? null;
			})
			.catch(() => null);
		s.note(entryId ? `journal entry id: ${entryId}` : "FRICTION? no journal dev hook / entry id");

		const wrote = await journal
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormJournalDev?: JournalDev })
					.__brainstormJournalDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Output ledger — shipped Issue #3 (distribution moats) to draft; pulled the competitive note's analytics-moat thread into the thesis.",
				);
				await dev.appendParagraph(
					"Open threads: does the owned-channel wedge generalize past dev-tools? Need two more advisory data points before it ships in an issue.",
				);
				await dev.appendParagraph(
					"Tomorrow: cite-check the reading list against Issue #3 claims; confirm every [reading-list #N] resolves to a real source.",
				);
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "journal body written via dev hook" : "FRICTION? journal appendParagraph failed");
		await journal.waitForTimeout(500);
		await s.shot(journal, "02-journal-written");

		// Probe the slash menu — on the old light journal editor there was no
		// block menu; the unification should make "/" open the shared menu.
		// Caught + light: a single "/" keystroke, screenshot whatever appears.
		await journal
			.locator(".journal__entry-editor")
			.first()
			.click()
			.catch(() => undefined);
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.keyboard.type("/", { delay: 20 }).catch(() => undefined);
		await journal.waitForTimeout(700);
		const slashMenuVisible = await journal
			.locator('[class*="typeahead"], [class*="slash"], [class*="block-menu"], [role="listbox"]')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`slash-menu after "/": visible=${slashMenuVisible}`);
		await s.shot(journal, "03-journal-slash-probe");
		// Clean up the stray "/" so the entry body stays tidy.
		await journal.keyboard.press("Backspace").catch(() => undefined);

		s.chat(
			SPEAKER.Priya,
			"Logged the day in the journal — structured body went in fine. Pulling my read on the shared-editor behavior from the captures.",
		);
		s.note(
			"Priya wrote a structured daily log on the shared-editor journal; verdict from captures + console.",
		);
	} finally {
		await s.finish();
	}
});
