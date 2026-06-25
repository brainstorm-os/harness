/**
 * Session 188 — Priya drafts the Issue #4 research outline (Wed).
 *
 * Mira scheduled "Priya — Issue #4 research outline + sources" for this week
 * (session 185). Priya turns it into a real cited outline in Notes: the angle,
 * the evidence sections, the sources, and — critically for her knowledge lens —
 * she tries to @-mention a teammate and link the document into the existing
 * thread so the outline is *connected*, not an island. Whether the mention /
 * link affordances actually fire from a fresh note is the test. Verdict from
 * the captures + the mention/link evidence.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("Priya drafts the Issue #4 research outline (188)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("188-priya-issue4-outline");
	try {
		s.chat(
			SPEAKER.Priya,
			"Picking up Issue #4 from Mira's list. Drafting the cited outline — angle, evidence, sources — and I want it linked into the thread, not a loose note.",
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
		await notes.keyboard.type("Issue #4 — research outline: the cost of rented distribution", {
			delay: 8,
		});
		await notes.waitForTimeout(300);

		const wrote = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Angle: last issue argued FOR owned distribution. #4 is the inverse — what rented distribution actually costs you, priced out, so the choice isn't ideology, it's a number.",
				);
				await dev.appendParagraph(
					"Section 1 — the rent: platform take-rates, algorithm risk, and the audience you don't keep when you stop paying. Need 2 concrete take-rate figures [reading-list].",
				);
				await dev.appendParagraph(
					"Section 2 — from our desk: a Northbound advisory client who rebuilt on owned channels and what it cost to switch vs. the rent they were paying [see: Beacon].",
				);
				await dev.appendParagraph(
					"Section 3 — the reader's calculation: a back-of-envelope a founder can run this week to price their own rent.",
				);
				await dev.appendParagraph(
					"Open: owner is Priya; review by Mira before it goes to Marcus for the issue layout. Sources to confirm before draft.",
				);
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "Issue #4 outline body written" : "FRICTION: notes dev hook unavailable");
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-outline");

		// Knowledge-lens test: try to @-mention a teammate at the end of the doc.
		// The mention typeahead should open on "@" and offer a person.
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowDown");
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("Assigned reviewer: @", { delay: 30 });
		await notes.waitForTimeout(900);
		const typeahead = notes.locator(
			"[class*='typeahead'], [class*='mention'], [role='listbox'], .notes__mention-menu",
		);
		const mentionOpen = await typeahead
			.first()
			.isVisible()
			.catch(() => false);
		const mentionOptions = await typeahead
			.locator("[role='option'], li, [class*='item']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 8),
			)
			.catch(() => [] as string[]);
		s.note(`@-mention typeahead opened: ${mentionOpen}; options: ${JSON.stringify(mentionOptions)}`);
		await s.shot(notes, "02-mention-typeahead");

		// If it opened, pick the first person and confirm a chip landed.
		if (mentionOpen && mentionOptions.length) {
			await notes.keyboard.type("Mira", { delay: 30 });
			await notes.waitForTimeout(600);
			await notes.keyboard.press("Enter");
			await notes.waitForTimeout(500);
		} else {
			await notes.keyboard.press("Escape").catch(() => undefined);
		}
		const mentionChip = await notes
			.locator("[class*='mention'][class*='chip'], .notes__mention, [data-mention]")
			.first()
			.innerText()
			.catch(() => "");
		s.note(`mention chip after pick: "${mentionChip}"`);
		await s.shot(notes, "03-after-mention");

		s.chat(
			SPEAKER.Priya,
			mentionOpen
				? `Outline's down and the @-mention fired (${mentionOptions.length} people offered). If the chip resolves to a real person record, the doc is actually connected to the roster.`
				: "Outline's down, but @-mentioning a teammate from a fresh note didn't open a picker — that's a connection gap; filing it.",
		);
		s.note("Priya drafted Issue #4 outline + tested mention/link; verdict from captures.");
	} finally {
		await s.finish();
	}
});
