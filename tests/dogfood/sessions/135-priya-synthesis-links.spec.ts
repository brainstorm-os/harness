/**
 * Session 135 — Priya writes a reading-list synthesis that links her research.
 *
 * Now that note cross-links materialize as graph edges (F-067), Priya does the
 * connective work her role is about: a short synthesis note that `@`-mentions
 * the existing research pieces, weaving them into one thread. Real keystrokes
 * (so autosave persists the refs). Spec posts intent/neutral; verdict from the
 * captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

async function insertMention(
	page: Awaited<ReturnType<typeof startSession>>["dashboard"],
	query: string,
) {
	await page.keyboard.type(query, { delay: 60 });
	await page.waitForTimeout(800);
	await page.keyboard.press("Enter");
	await page.waitForTimeout(300);
}

test("Priya writes a synthesis note linking her research (135)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("135-priya-synthesis-links");
	try {
		s.chat(
			SPEAKER.Priya,
			"Writing a short synthesis that ties the research threads together — linking the pieces so the thinking connects, not just sits in separate docs.",
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
		await notes.keyboard.type("Reading-list synthesis — the through-line", { delay: 12 });
		await notes.waitForTimeout(300);
		await notes.keyboard.press("Enter");

		await notes.keyboard.type("The thread across our research: ", { delay: 18 });
		await insertMention(notes, "@Research");
		await notes.keyboard.type(" feeds the case in ", { delay: 18 });
		await insertMention(notes, "@Issue #1");
		await notes.keyboard.type(" and the pricing angle in ", { delay: 18 });
		await insertMention(notes, "@Issue #2");
		await notes.keyboard.type(". Distribution is the common moat.", { delay: 18 });
		await notes.waitForTimeout(1500);
		await s.shot(notes, "01-synthesis");

		s.chat(
			SPEAKER.Priya,
			"Synthesis is down with the pieces linked inline — pulling my read from the capture.",
		);
		s.note("Priya wrote a synthesis note with inline @-mentions; verdict from captures.");
	} finally {
		await s.finish();
	}
});
