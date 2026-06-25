/**
 * Session 127 — Priya drafts Issue #3 ("distribution moats at seed").
 *
 * The topic's been threading through the channel (Mira's standup, the Beacon
 * one-pager). Priya turns it into the next newsletter issue: a cited draft that
 * pulls the thesis, the evidence, and a concrete reader wedge together. Reliable
 * dev-hook writing. Spec posts intent/neutral only — the design verdict is
 * decided from the captures after the run.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("Priya drafts Issue #3 (127)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("127-priya-issue-3-draft");
	try {
		s.chat(
			SPEAKER.Priya,
			"Turning the distribution-moats thread into Issue #3 — drafting the cited version now.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1300);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowUp");
		await notes.waitForTimeout(200);
		await notes.keyboard.type("Issue #3 — Distribution moats at seed (draft)", { delay: 10 });
		await notes.waitForTimeout(300);

		const wrote = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"The one-line: at seed, the durable advantage isn't your feature set — it's an owned audience and a wedge you can run again and again. Distribution compounds; features get copied.",
				);
				await dev.appendParagraph(
					"Why it holds: founders over-index on parity and under-index on reach. The teams that win build a channel they control and a repeatable motion to fill it [reading-list #2, #4].",
				);
				await dev.appendParagraph(
					"From our desk: across Northbound's advisory work, the clients who shifted from rented to owned channels grew pipeline 2-3x — the same pattern behind moving Beacon from Lead to Active [see: Beacon one-pager].",
				);
				await dev.appendParagraph(
					"The wedge to run this week: pick one owned channel, publish one specific thing your buyer can act on, and measure reply-rate — not opens. Specificity beats cadence.",
				);
				await dev.appendParagraph(
					"Sources & next: reading-list items 1-4; open question — does the wedge generalize past dev-tools? Need two more data points before this ships.",
				);
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "Issue #3 draft body written" : "FRICTION? notes dev hook unavailable");
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-issue-3-draft");

		s.chat(
			SPEAKER.Priya,
			"Issue #3 draft is down — thesis, evidence, the weekly wedge, sources. Parking it as a draft for review.",
		);
		s.note("Priya drafted Issue #3; verdict from captures.");
	} finally {
		await s.finish();
	}
});
