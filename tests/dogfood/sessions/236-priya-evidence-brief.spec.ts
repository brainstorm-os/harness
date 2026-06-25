/**
 * Session 236 — Priya builds a cited evidence brief (product-artifact turn).
 *
 * Priya (research editor) does the work her lens points at: a SOURCED brief
 * where every claim is backed by a citation. She builds three source/finding
 * notes, then a "Why the wedge works — evidence base" brief whose body
 * TRANSCLUDES each source under the claim it supports (the citation renders
 * live inline — change the source, the brief updates), and finally links back
 * to Mira's investment thesis (built in 235) by transcluding it under a
 * "Connection to the thesis" section. This stresses the knowledge core:
 * cross-entity references, transclusion/embeds, and — observed in the Graph —
 * whether the new docs form a connected literature cluster.
 *
 * Builds on the PERSISTENT vault (Mira's 235 hub + thesis are already there).
 * All editor input via the keystroke-safe `__brainstormNotesDev` hook; ids are
 * captured live via `currentNoteId()`. Observation harness — the verdict is
 * decided from the captures afterwards, not computed here.
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

function devId(notes: Page): Promise<string | null> {
	return notes.evaluate(() => {
		const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
		return dev?.currentNoteId() ?? null;
	});
}

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
	await notes.waitForTimeout(500);
	return devId(notes);
}

async function openByTitle(notes: Page, title: string): Promise<string | null> {
	const row = notes.locator(".notes__sidebar-item", { hasText: title }).first();
	if ((await row.count()) === 0) return null;
	await row.click();
	await notes.waitForTimeout(900);
	return devId(notes);
}

test("Priya builds a cited evidence brief (claims backed by transcluded sources)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("236-priya-evidence-brief");
	s.chat(
		SPEAKER.Priya,
		"Picking up the content engine. Before we scale the newsletter I want the wedge to stand on evidence, not vibes — so I'm writing an evidence brief where every claim cites a source, and I'll tie it back to Mira's thesis so the argument holds end to end.",
	);
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// Link target from Mira's 235 turn (persistent vault).
		const thesisId = await openByTitle(notes, "Investment Thesis");
		s.note(`thesisId (from 235)=${thesisId}`);

		// Three source/finding notes — Priya's citations.
		const src1 = await newNote(notes, "Source — Decision latency in operator teams", [
			"Finding: operators report that the gap between 'a decision is needed' and 'we have a defensible view' is the dominant source of execution risk — not the decision itself.",
			"Implication: the scarce input is synthesis under time pressure, which is exactly what a weekly research cadence supplies.",
		]);
		const src2 = await newNote(notes, "Source — What operators pay for is clarity", [
			"Finding: willingness-to-pay tracks distilled judgement ('here's the call and why'), not raw data access — operators already drown in dashboards.",
			"Implication: the product is a point of view, defensible because it compounds across issues.",
		]);
		const src3 = await newNote(notes, "Source — Newsletter-to-advisory conversion", [
			"Finding: in comparable one-person research studios, the free issue functions as a qualification funnel — a small, self-selected fraction of readers convert to paid advisory.",
			"Implication: issue reach is the top of the advisory funnel, so output cadence and funnel health are the same metric.",
		]);
		s.note(`src1=${src1} src2=${src2} src3=${src3}`);

		// The brief — every claim transcludes the source that backs it.
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);
		await notes.keyboard.type("Brief — Why the wedge works (evidence base)", { delay: 20 });
		await notes.waitForTimeout(500);

		const composed = await notes
			.evaluate(
				async ({ src1, src2, src3, thesisId, noteType }) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					await dev.appendParagraph(
						"Question: does the newsletter wedge rest on something durable, or are we selling content into a commodity?",
					);
					await dev.appendParagraph(
						"Claim 1 — Operators are starved for synthesis under time pressure.",
					);
					if (src1) await dev.insertTransclusion(src1, noteType, "Decision latency");
					await dev.appendParagraph("Claim 2 — They pay for clarity, not for more data.");
					if (src2) await dev.insertTransclusion(src2, noteType, "Pay for clarity");
					await dev.appendParagraph("Claim 3 — The free issue is a qualified advisory funnel.");
					if (src3) await dev.insertTransclusion(src3, noteType, "Conversion");
					await dev.appendParagraph("Connection to the thesis");
					if (thesisId) await dev.insertTransclusion(thesisId, noteType, "Investment Thesis");
					await dev.appendParagraph(
						"What to verify next: real conversion numbers from Issue #1, and at least one operator quote per claim before this goes in an issue.",
					);
					return true;
				},
				{ src1, src2, src3, thesisId, noteType: NOTE_TYPE },
			)
			.catch(() => false);
		s.note(`brief composed: ${composed}`);
		await notes.waitForTimeout(900);

		const briefTitle =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const transclusions = await notes.locator(".notes__transclusion").count();
		s.note(`briefTitle="${briefTitle}" transclusions=${transclusions}`);
		await s.shot(notes, "01-brief-top");

		// Scroll the brief body to capture the lower claims + thesis link.
		await notes.evaluate(() => {
			const scroller = document.querySelector(".notes__body");
			if (scroller) scroller.scrollTop = scroller.scrollHeight;
		});
		await notes.waitForTimeout(600);
		await s.shot(notes, "02-brief-bottom");

		// Graph: does the evidence cluster show up connected?
		try {
			const graph = await s.openApp(APP.Graph);
			await graph.waitForTimeout(2500);
			const nodes = await graph.locator("canvas, svg").count();
			s.note(`graph surface elements=${nodes}`);
			await s.shot(graph, "03-graph");
		} catch (e) {
			s.note(`graph step skipped: ${(e as Error).message}`);
		}

		s.chat(
			SPEAKER.Priya,
			"Evidence brief is up — three claims, each citing its source inline, and it threads back into the thesis. Next I want real numbers from Issue #1 and an operator quote per claim before any of this ships in an issue.",
		);

		expect(briefTitle, "the evidence brief is titled").toMatch(/evidence base/i);
	} finally {
		await s.finish();
	}
});
