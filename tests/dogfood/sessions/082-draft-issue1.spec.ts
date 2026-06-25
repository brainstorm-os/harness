/**
 * Session 082 — Mira drafts Issue #1 of the newsletter.
 *
 * She planned the editorial calendar (065–067), scheduled the sends (069/073);
 * now she writes the actual content. A real Notes artifact — the drafted
 * newsletter issue, several paragraphs of genuine copy — titled to match the
 * Content Calendar row. Closes the loop plan → schedule → write.
 *
 * Body via window.__brainstormNotesDev.appendParagraph (keystroke-safe). No app
 * source change, so it runs against the existing built bundles (SKIP_BUILD).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	currentNoteId: () => string | null;
};

const TITLE = "Issue #1 — The case for dev-tools infra";
const DRAFT = [
	"Every team I talk to is drowning in tools that don't talk to each other. The wedge isn't another app — it's the connective layer underneath them.",
	"The shift: infrastructure is eating dev-tools. The winners of the last decade sold features; the winners of the next decade sell the substrate features compose on — data interop, identity, sync.",
	"Why now: the building blocks finally exist off the shelf (CRDTs, local-first sync, capability security), so a small team can ship substrate-grade reliability that used to need a platform org.",
	"What it means for founders: stop pitching a destination app. Pitch the rails. Your moat is the data model everyone else has to build on, and the switching cost that creates.",
	"Next week: pricing power at seed — why charging more, earlier, is a forcing function for focus. Reply and tell me what you're wrestling with.",
];

test("draft the Issue #1 newsletter content", async () => {
	test.setTimeout(180_000);
	const s = await startSession("082-draft-issue1");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// If the draft already exists (rerun), open it; else create it.
		const existing = notes.locator(`text=${TITLE}`).first();
		if ((await existing.count()) > 0) {
			await existing.click();
			await notes.waitForTimeout(800);
			s.note("draft already exists — opened it");
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
				}, DRAFT)
				.catch(() => false);
			s.note(`wrote ${DRAFT.length} draft paragraphs: ${wrote}`);
			expect(wrote, "the draft body composed").toBe(true);
		}
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-draft");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const body = (await notes.locator('[contenteditable="true"]').first().innerText()) ?? "";
		s.note(`title="${title}" body length=${body.length}`);

		expect(title, "the draft is titled to match the calendar row").toMatch(
			/case for dev-tools infra/i,
		);
		for (const p of DRAFT) {
			const stub = p.slice(0, 24);
			expect(body.includes(stub), `draft contains: "${stub}…"`).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
