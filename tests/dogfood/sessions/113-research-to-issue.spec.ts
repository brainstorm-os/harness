/**
 * Session 113 — research → Issue #2: the content production workflow.
 *
 * Mira's core weekly loop: turn captured research into a publishable issue. She
 * walks her research (Bookmarks), starts the next issue (Notes), and tries to
 * pull research INTO the draft (transclusion / embeds / links) and see how it
 * all connects (Graph). This exercises Brainstorm's strong knowledge half — so
 * the notes here are as much "what works well" as "what's missing". Founder
 * mode; gaps to the wishlist / dev-tasks, no fixing.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	insertTransclusion?: (entityId: string) => Promise<void>;
};

test("research to Issue #2 — content production (113)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("113-research-to-issue");
	try {
		// 1. Research capture — the Bookmarks reading list.
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "01-research");
		const bmItems = (await bm.locator("[class*='card'], [class*='row']").allInnerTexts())
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 10);
		s.note(`Research captured (Bookmarks): ${JSON.stringify(bmItems)}`);

		// 2. Start Issue #2 in Notes + try to weave research into the draft.
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1400);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowUp");
		await notes.waitForTimeout(200);
		await notes.keyboard.type("Issue #2 — pricing power at seed (draft)", { delay: 10 });
		await notes.waitForTimeout(400);
		const wove = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return { paras: false, transclusion: false };
				await dev.appendParagraph(
					"Thesis: at seed, pricing power comes from a wedge nobody else can price — the 'trust tax' angle from the dev-tools research.",
				);
				await dev.appendParagraph(
					"Pull the three case studies from the reading list and the metrics from last week's research note here.",
				);
				return { paras: true, transclusion: typeof dev.insertTransclusion === "function" };
			})
			.catch(() => ({ paras: false, transclusion: false }));
		await notes.waitForTimeout(400);
		await s.shot(notes, "02-issue-draft");
		s.note(`Draft body written: ${JSON.stringify(wove)}`);
		// Can a research note / bookmark be embedded INTO the draft from the UI?
		const slashAffordance = await notes
			.locator(
				'[aria-label*="embed" i], [aria-label*="transclu" i], button:has-text("Embed"), button:has-text("Reference")',
			)
			.count()
			.catch(() => 0);
		s.note(`Visible embed/reference affordance in the editor? ${slashAffordance}`);

		// 3. The connections — does the Graph show research → issue links?
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(2200);
		await s.shot(graph, "03-graph");
		const matches = (
			await graph
				.locator(".match-summary, [id='match-summary']")
				.allInnerTexts()
				.catch(() => [])
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`Graph match summary: ${JSON.stringify(matches)}`);

		s.note("captured the research-to-issue production workflow");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
