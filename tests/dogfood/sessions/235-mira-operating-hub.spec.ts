/**
 * Session 235 — Mira rebuilds Northbound's operating hub (product-artifact turn).
 *
 * PRODUCT mode, not a functional sweep: Mira does genuine founder work and
 * leaves behind a SUBSTANTIAL, composed artifact that stresses the seams
 * between apps. She:
 *   1. writes two source docs in Notes — the investment thesis and a
 *      "this week" plan — capturing each note's id live;
 *   2. builds a "Northbound HQ" hub note whose body TRANSCLUDES both source
 *      docs (the live cross-entity composition seam — the hub shows the real
 *      thesis/plan bodies inline, not copies);
 *   3. files this week's deliverables as real Tasks (the cadence);
 *   4. logs the day in Journal.
 *
 * The result is a one-page operating home that references the rest of the
 * business across Notes + Tasks + Journal — the README's "operating system
 * inside Brainstorm" core-area artifact, on a fresh vault.
 *
 * All editor input goes through the keystroke-safe dev hooks
 * (`__brainstormNotesDev` / `__brainstormJournalDev`); note ids are captured
 * live via `currentNoteId()`. Per the loop protocol this is an OBSERVATION
 * harness — the spec records what it did via `s.note()` and screenshots; the
 * friction verdict is decided afterwards from the captures, not computed here.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const NOTE_TYPE = "io.brainstorm.notes/Note/v1";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	insertTransclusion: (entityId: string, entityType: string, label: string) => Promise<void>;
	currentNoteId: () => string | null;
};

type JournalDev = {
	appendParagraph: (text: string) => Promise<void>;
};

async function newNote(notes: Page, title: string, body: string[]): Promise<string | null> {
	await notes.locator('[aria-label="New note"]').first().click();
	await notes.waitForTimeout(1200);
	await notes.keyboard.type(title, { delay: 20 });
	await notes.waitForTimeout(500);
	await notes
		.evaluate(async (paras) => {
			const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
			if (!dev) return;
			for (const p of paras) await dev.appendParagraph(p);
		}, body)
		.catch(() => undefined);
	await notes.waitForTimeout(600);
	return notes.evaluate(() => {
		const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
		return dev?.currentNoteId() ?? null;
	});
}

test("Mira rebuilds the Northbound operating hub (thesis + plan transcluded, tasks, log)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("235-mira-operating-hub");
	s.chat(
		SPEAKER.Mira,
		"Fresh desk today — rebuilding Northbound HQ from the ground up. I want one page that holds the whole business: the thesis, this week's plan, both living inline. Then I'll file the week's deliverables and log the day.",
	);
	try {
		// --- Notes: two source docs, ids captured live ---------------------
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const thesisId = await newNote(notes, "Northbound — Investment Thesis", [
			"Northbound sells clarity: a paid research newsletter plus advisory work for operators making a hard call under uncertainty.",
			"Wedge: the weekly issue is the funnel. Free readers self-select; the sharpest become advisory clients.",
			"Moat: a compounding, cross-linked knowledge base that makes every new issue faster to write and harder to copy.",
			"This quarter's bet: scale output without diluting the thesis — hence the first two hires (design, research).",
		]);
		s.note(`thesisId=${thesisId}`);
		await s.shot(notes, "01-thesis");

		const weekId = await newNote(notes, "Northbound — This Week", [
			"Goal: ship Issue #1 of the relaunched newsletter and lock the Q3 hiring loop.",
			"Draft Issue #1 (research → outline → draft → edit).",
			"Finalize the designer + research-editor role briefs and open the candidate pipeline.",
			"Refresh the Clients pipeline and confirm two advisory renewals.",
		]);
		s.note(`weekId=${weekId}`);
		await s.shot(notes, "02-this-week");

		// --- Notes: the hub doc that transcludes both source docs ----------
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);
		await notes.keyboard.type("Northbound HQ", { delay: 20 });
		await notes.waitForTimeout(500);

		const composed = await notes
			.evaluate(
				async ({ thesisId, weekId, noteType }) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					await dev.appendParagraph(
						"The operating home for Northbound — the whole business one click away.",
					);
					await dev.appendParagraph("The thesis");
					if (thesisId) await dev.insertTransclusion(thesisId, noteType, "Investment Thesis");
					await dev.appendParagraph("This week");
					if (weekId) await dev.insertTransclusion(weekId, noteType, "This Week");
					await dev.appendParagraph("Cadence: deliverables live in Tasks, the daily log in Journal.");
					return true;
				},
				{ thesisId, weekId, noteType: NOTE_TYPE },
			)
			.catch(() => false);
		s.note(`hub composed: ${composed}`);
		await notes.waitForTimeout(800);

		const hubTitle =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const transclusions = await notes.locator(".notes__transclusion").count();
		s.note(`hubTitle="${hubTitle}" transclusions=${transclusions}`);
		await s.shot(notes, "03-hub");

		// --- Tasks: this week's deliverables as real cadence ---------------
		const deliverables = [
			"Draft Issue #1 — outline to first draft",
			"Finalize designer + research-editor role briefs",
			"Confirm two advisory renewals this week",
		];
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1200);
		let created = 0;
		for (const name of deliverables) {
			try {
				await tasks.locator('[aria-label="New task"]').first().click();
				await tasks.waitForTimeout(500);
				await tasks.locator(".tasks-compose__input").first().fill(name);
				await tasks.waitForTimeout(200);
				await tasks
					.locator("button", { hasText: "Create task" })
					.first()
					.click()
					.catch(() => undefined);
				await tasks.waitForTimeout(900);
				const appeared = await tasks
					.locator(".task-row__name-label", { hasText: name.slice(0, 16) })
					.count();
				if (appeared > 0) created += 1;
			} catch {
				// keep going — one stuck compose shouldn't drop the rest
			}
		}
		s.note(`tasks created: ${created}/${deliverables.length}`);
		await s.shot(tasks, "04-tasks");

		// --- Journal: log the day ------------------------------------------
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1500);
		const logged = await journal
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormJournalDev?: JournalDev })
					.__brainstormJournalDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Rebuilt Northbound HQ today: a single hub note that transcludes the thesis and the week plan, so the business reads as one page again.",
				);
				await dev.appendParagraph(
					"Filed the week's deliverables in Tasks. Next: draft Issue #1 and open the candidate pipeline.",
				);
				return true;
			})
			.catch(() => false);
		s.note(`journal logged: ${logged}`);
		await s.shot(journal, "05-journal");

		s.chat(
			SPEAKER.Mira,
			"HQ is back — thesis and the week both render live inside the hub, deliverables are in Tasks, day's logged. Tomorrow I start on Issue #1.",
		);

		// One lenient signal that the core artifact exists; everything else is
		// observed via notes()/shots and triaged from the captures.
		expect(hubTitle, "the hub note is titled").toMatch(/Northbound HQ/i);
	} finally {
		await s.finish();
	}
});
