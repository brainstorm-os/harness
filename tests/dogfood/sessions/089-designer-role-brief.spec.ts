/**
 * Session 089 — Mira opens the first-hire arc: the Designer role brief.
 *
 * Northbound's at the point where design is the bottleneck (newsletter, site,
 * advisory decks), so Mira's first hire is a designer. The hiring *process* is
 * solo founder work she runs in her own vault — this is the foundational
 * artifact: the role brief (why now, the role, what good looks like, comp, the
 * interview process). Later sessions build the Candidates pipeline, interview
 * events, and scorecards on top of it.
 *
 * (The actual teammate-as-collaborator onboarding — the hired designer on a
 * second paired vault — stays gated on sync; the funnel + artifacts are built
 * now.) Body via window.__brainstormNotesDev. SKIP_BUILD (no app-source change).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	currentNoteId: () => string | null;
};

const TITLE = "Hiring — Designer (first hire)";
const BRIEF = [
	"Why now: design is the bottleneck. The newsletter, the site, and the advisory decks all need a consistent hand, and I'm the constraint. First hire = a designer who owns the brand surface end to end.",
	"The role: brand + product design for Northbound. Newsletter template + issue art, the marketing site, the advisory deck system, and the in-product polish as we build. Part-time to start (2–3 days/week), with a path to full-time as revenue grows.",
	"What good looks like (first 90 days): a coherent visual system (type, color, layout) shipped across newsletter + site; a reusable advisory-deck template; and one full issue designed end to end. Opinionated, fast, comfortable owning ambiguity.",
	"Comp: part-time contract to start — day rate + meaningful early equity once we convert to full-time. Remote, async-first, my timezone-ish overlap.",
	"Process: portfolio review → 45-min craft conversation → a small paid trial (design one newsletter issue) → reference + offer. Keep it to two weeks end to end.",
];

test("write the Designer role brief (first-hire arc)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("089-designer-role-brief");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const existing = notes.locator(`text=${TITLE}`).first();
		if ((await existing.count()) > 0) {
			await existing.click();
			await notes.waitForTimeout(800);
			s.note("role brief already exists — opened it");
		} else {
			await notes.locator('[aria-label="New note"]').first().click();
			await notes.waitForTimeout(1200);
			await notes.keyboard.type(TITLE, { delay: 14 });
			await notes.waitForTimeout(500);
			const wrote = await notes
				.evaluate(async (paras) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					for (const p of paras) await dev.appendParagraph(p);
					return true;
				}, BRIEF)
				.catch(() => false);
			s.note(`wrote ${BRIEF.length} brief sections: ${wrote}`);
			expect(wrote, "the brief composed").toBe(true);
		}
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-brief");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const body = (await notes.locator('[contenteditable="true"]').first().innerText()) ?? "";
		s.note(`title="${title}" body length=${body.length}`);

		expect(title, "the brief is titled for the designer hire").toMatch(/Designer \(first hire\)/i);
		for (const p of BRIEF) {
			const stub = p.slice(0, 18);
			expect(body.includes(stub), `brief contains: "${stub}…"`).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
