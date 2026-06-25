/**
 * Session 100 — Mira makes the offer.
 *
 * Capstone of the SOLO hiring arc: after the strong trial + scorecard (099 →
 * Offer), Mira writes Marcus's **offer & onboarding plan** — terms, the first
 * 30 days on the brand system, and the explicit handoff to what comes next.
 * That closes the hiring *process* she runs alone (brief 089 → roster 090 →
 * stages 091 → board 092 → trial reviews 093–097 → scorecard 099 → offer here).
 *
 * The next beat — Marcus as a real collaborator on a second paired vault, with
 * shared editing / permissions — is the sync-gated collaboration phase, and it
 * waits on the sync / identity-orgs stages. A Notes artifact (reliable),
 * titling via the TitleNode caret fix from 099. SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

const TITLE = "Hiring — Marcus offer & onboarding";
const OFFER = [
	"Decision: hire. Marcus's trial (a design review of Brainstorm) was exactly the bar — eight specific, substantiated defects across five apps, two already fixed off the back of it. Offer out.",
	"Terms: part-time design contract to start — 2–3 days/week, day rate + meaningful early equity on conversion to full-time as revenue grows. Remote, async-first.",
	"First 30 days: own the brand system. A coherent type/color/layout shipped across the newsletter template + the marketing site, a reusable advisory-deck template, and one full newsletter issue designed end to end. Weekly product-design review where he holds the bar on the app surface.",
	"What's next (and what's blocked): once he's in, real collaboration — a shared workspace, live editing, permissions — is how we actually work together. That needs the second paired vault over sync; until the sync / identity-orgs work lands, I bring him in through exported artifacts and a shared review cadence, not a live shared vault.",
	"Status: offer accepted. Move Marcus to Hired in the pipeline; kick off the brand-system work next week.",
];

test("write Marcus's offer & onboarding plan", async () => {
	test.setTimeout(180_000);
	const s = await startSession("100-designer-hired");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const existing = notes.locator(`text=${TITLE}`).first();
		if ((await existing.count()) > 0) {
			await existing.click();
			await notes.waitForTimeout(800);
			s.note("offer note already exists — opened it");
		} else {
			await notes.locator('[aria-label="New note"]').first().click();
			await notes.waitForTimeout(1400);
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
				}, OFFER)
				.catch(() => false);
			s.note(`wrote ${OFFER.length} offer sections: ${wrote}`);
			expect(wrote, "the offer note composed").toBe(true);
		}
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-offer");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const body = (await notes.locator('[contenteditable="true"]').first().innerText()) ?? "";
		s.note(`title="${title}" body length=${body.length}`);

		expect(title, "the offer note is titled").toMatch(/offer & onboarding/i);
		expect(body.includes("offer accepted"), "the offer is accepted").toBe(true);
	} finally {
		await s.finish();
	}
});
