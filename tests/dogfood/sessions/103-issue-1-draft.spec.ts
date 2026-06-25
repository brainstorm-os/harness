/**
 * Session 103 — Mira drafts Issue #1; Marcus reviews the Graph.
 *
 * A content work day: Mira writes the first newsletter issue end to end in
 * Notes (the deliverable she set herself in 102), then Marcus — holding the
 * design bar — reviews the **Graph**, an app he hasn't scrutinised yet. Real
 * work; friction distilled from the captures afterward.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

const ISSUE_TITLE = "Issue #1 — the case for dev-tools infra (draft)";
const ISSUE = [
	"Hook: every team ships software; almost none of them trust their own pipeline. That gap — between shipping and trusting — is where the next decade of dev-tools value gets created.",
	"Section 1 — the trust tax. A team that can't trust its CI pays for it in slower merges, flakier deploys, and a quiet tax on every engineer's attention. We size that tax and show where it hides.",
	"Section 2 — substrate over features. The winners aren't the flashiest dashboards; they're the boring substrate — reliable, observable, composable — that everything else stands on. Three companies getting this right.",
	"Section 3 — what to watch. The leading indicators that a dev-tools company is building substrate and not theatre: where they spend reliability budget, how they treat their own dogfooding, who they hire first.",
	"Close: if you're building here, build the floor, not the fireworks. Reply and tell me what your team stopped trusting — that's usually where the opportunity is.",
];

test("Issue #1 draft — Mira writes, Marcus reviews the Graph", async () => {
	test.setTimeout(240_000);
	const s = await startSession("103-issue-1-draft");
	try {
		// ── Mira: draft Issue #1 (Notes) ───────────────────────────────────
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1400);
		await notes.locator('[contenteditable="true"]').first().click();
		await notes.keyboard.press("Meta+ArrowUp");
		await notes.waitForTimeout(200);
		await notes.keyboard.type(ISSUE_TITLE, { delay: 10 });
		await notes.waitForTimeout(400);
		const wrote = await notes
			.evaluate(async (paras) => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				for (const p of paras) await dev.appendParagraph(p);
				return true;
			}, ISSUE)
			.catch(() => false);
		await notes.waitForTimeout(500);
		await s.shot(notes, "01-issue-draft");
		const body = (await notes.locator('[contenteditable="true"]').first().innerText()) ?? "";
		s.note(`issue draft body-len=${body.length} wrote=${wrote}`);

		// ── Marcus: review the Graph ───────────────────────────────────────
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(2500); // let the force sim settle / Pixi paint
		await s.shot(graph, "02-graph-resting");
		// Try a zoom + a re-fit if there are controls, to judge interaction.
		const controls = (
			await graph.locator("[class*='control'], [class*='toolbar'], button").allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 12);
		s.note(`Graph controls/labels visible: ${JSON.stringify(controls)}`);
		await graph.mouse.move(550, 400);
		await graph.mouse.wheel(0, -300).catch(() => undefined); // zoom in
		await graph.waitForTimeout(800);
		await s.shot(graph, "03-graph-zoomed");

		s.note("captured Issue #1 draft + Graph for Marcus's review");
		expect(body.length, "the issue draft has a real body").toBeGreaterThan(300);
	} finally {
		await s.finish();
	}
});
