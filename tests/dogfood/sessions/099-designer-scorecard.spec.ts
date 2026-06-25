/**
 * Session 099 — Mira scores Marcus's design trial.
 *
 * Ties the two threads together: Marcus's design reviews (093–097) WERE his
 * craft trial. Now Mira writes his scorecard — evaluating the trial against the
 * role brief's "what good looks like", citing his actual findings (F-037→F-044
 * + the F-023 escalation, one of which already shipped a fix). The hiring
 * artifact that moves him toward an offer.
 *
 * Notes body via window.__brainstormNotesDev. SKIP_BUILD (no app-source change).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	currentNoteId: () => string | null;
};

const TITLE = "Hiring — Marcus Lee scorecard (design trial)";
const CARD = [
	"Trial: review Brainstorm's design and find what's broken. He did — across five apps, two days, unprompted depth.",
	"Craft & rigor (the bar: opinionated, fast, owns ambiguity): strong yes. Eight specific, substantiated design defects — board columns out of funnel order, property pickers showing opaque keys, untimed tasks rendered as 0:00, relative-vs-absolute date labels colliding in one list, a Calendars legend the items ignore, hover-only controls that aren't discoverable, illegible sticky placeholders — plus he escalated the inspector-overlay-clips-content issue from a database quirk to a systemic, cross-app fork. Every finding cited the exact element and what he'd expect.",
	"Signal over noise: high. He praised exactly once (the clean blank note) and it was earned. No vague 'feels off' — every note was actionable. Two of his catches already shipped fixes off the back of the review.",
	"The skepticism: he's slow to trust a new tool and picks at details relentlessly. For most roles that's friction; for the person who owns our brand surface it's the whole point — he'll hold the bar I can't hold alone.",
	"Verdict: strong hire. Move Marcus to Offer. Start part-time on the brand system (newsletter + site), fold him into product-design review weekly.",
];

test("write Marcus's design-trial scorecard", async () => {
	test.setTimeout(180_000);
	const s = await startSession("099-designer-scorecard");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const existing = notes.locator(`text=${TITLE}`).first();
		if ((await existing.count()) > 0) {
			await existing.click();
			await notes.waitForTimeout(800);
			s.note("scorecard already exists — opened it");
		} else {
			await notes.locator('[aria-label="New note"]').first().click();
			await notes.waitForTimeout(1400);
			// Focus the editor and put the caret at the very top (the TitleNode)
			// before typing — relying on initial-focus alone raced to "Untitled".
			await notes.locator('[contenteditable="true"]').first().click();
			await notes.keyboard.press("Meta+ArrowUp");
			await notes.waitForTimeout(200);
			await notes.keyboard.type(TITLE, { delay: 12 });
			await notes.waitForTimeout(500);
			const wrote = await notes
				.evaluate(async (paras) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					for (const p of paras) await dev.appendParagraph(p);
					return true;
				}, CARD)
				.catch(() => false);
			s.note(`wrote ${CARD.length} scorecard sections: ${wrote}`);
			expect(wrote, "the scorecard composed").toBe(true);
		}
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-scorecard");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const body = (await notes.locator('[contenteditable="true"]').first().innerText()) ?? "";
		s.note(`title="${title}" body length=${body.length}`);

		expect(title, "the scorecard is titled for Marcus's trial").toMatch(/Marcus Lee scorecard/i);
		expect(body.includes("Verdict: strong hire"), "the scorecard reaches a verdict").toBe(true);
	} finally {
		await s.finish();
	}
});
