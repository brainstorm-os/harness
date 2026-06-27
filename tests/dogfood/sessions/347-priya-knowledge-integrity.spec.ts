/**
 * Session 347 — Priya Nair audits the knowledge layer (specialist turn).
 *
 * The 012–028 sweep was Mira breadth (open every app, CRUD, dark-mode). Priya's
 * lens is different: "is the knowledge trustworthy, findable, well-connected?"
 * So this turn deep-probes the connective tissue the breadth pass skipped —
 * (1) can she cross-reference / embed from the editor (slash + @-mention
 * discoverability), (2) is what she writes findable through vault search,
 * (3) does the Graph render the knowledge as a connected surface. She BUILDS a
 * small cited note, then AUDITS the seams. Per the loop protocol the spec only
 * records intent + neutral observations + console errors — the verdict is
 * decided from the captures afterward, never computed here.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	insertTransclusion?: (
		entityId: string,
		entityType: string,
		label: string,
	) => Promise<void>;
};

const TITLE = "347 — Priya: knowledge-integrity audit";

test("Priya audits the knowledge layer — cross-links, search, graph (347)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("347-priya-knowledge-integrity");
	s.chat(
		SPEAKER.Priya,
		"Taking the knowledge layer this turn — can I cross-reference cleanly, find what I wrote, and see it connected in the graph? Building a small cited note then auditing the seams.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		// ── Build: a small cited note ───────────────────────────────────────
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
		await notes.keyboard.press("Meta+ArrowUp").catch(() => undefined);
		await notes.waitForTimeout(200);
		await notes.keyboard.type(TITLE, { delay: 10 });
		await notes.waitForTimeout(300);

		const wrote = await notes
			.evaluate(async (title) => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev })
					.__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph(
					`Thesis (${title}): a knowledge base is only as good as its connective tissue — a fact you can't find or link to may as well not exist.`,
				);
				await dev.appendParagraph(
					"Claim: every captured source should be reachable from at least two surfaces — search and a link from a related note.",
				);
				return true;
			}, TITLE)
			.catch(() => false);
		s.note(
			wrote
				? "cited note written via dev hook"
				: "notes dev hook unavailable (capture-only)",
		);
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-cited-note");

		// ── Audit 1: slash-menu reference/embed discoverability ─────────────
		const editor = notes.locator('[contenteditable="true"]').first();
		await editor.click().catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await notes.keyboard.press("Enter").catch(() => undefined);
		await notes.keyboard.type("/embed", { delay: 30 });
		await notes.waitForTimeout(700);
		await s.shot(notes, "02-slash-embed");
		const slashItems = (
			await notes
				.locator('.fm-menu [role="option"]')
				.allInnerTexts()
				.catch(() => [])
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 15);
		s.note(`"/embed" slash-menu results: ${JSON.stringify(slashItems)}`);
		await notes.keyboard.press("Escape").catch(() => undefined);
		await notes.waitForTimeout(200);

		// ── Audit 2: @-mention cross-link typeahead ─────────────────────────
		await notes.keyboard.type(" ", { delay: 20 }).catch(() => undefined);
		await notes.keyboard.type("@", { delay: 60 }).catch(() => undefined);
		await notes.waitForTimeout(700);
		await s.shot(notes, "03-mention-typeahead");
		const mentionItems = (
			await notes
				.locator(
					'[role="option"], [class*="typeahead"] [class*="item"], [class*="mention"] [class*="item"]',
				)
				.allInnerTexts()
				.catch(() => [])
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 15);
		s.note(
			`"@" mention typeahead offered ${mentionItems.length} option(s): ${JSON.stringify(mentionItems)}`,
		);
		await notes.keyboard.press("Escape").catch(() => undefined);
		await notes.waitForTimeout(300);

		// ── Audit 3: is the note findable through vault search? ─────────────
		const dash = s.dashboard;
		const PLACEHOLDER = "Search apps, notes, entities…";
		await dash.keyboard.press("Escape").catch(() => undefined);
		await dash
			.locator('[aria-label="Search the vault"]')
			.first()
			.click()
			.catch(() => undefined);
		await dash.waitForTimeout(700);
		await dash
			.locator(`[placeholder="${PLACEHOLDER}"]`)
			.first()
			.fill("knowledge-integrity")
			.catch(() => undefined);
		await dash.waitForTimeout(2000);
		await s.shot(dash, "04-vault-search");
		const overlayText =
			(await dash
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(
			`vault search "knowledge-integrity" surfaces the note title: ${overlayText.includes("347")}`,
		);
		await dash.keyboard.press("Escape").catch(() => undefined);
		await dash.waitForTimeout(400);

		// ── Audit 4: does the Graph render the knowledge as connected? ──────
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(2000);
		await s.shot(graph, "05-graph-connectivity");
		const canvasPresent =
			(await graph
				.locator("canvas")
				.count()
				.catch(() => 0)) > 0;
		s.note(`graph canvas present: ${canvasPresent}`);

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		// Non-asserting on individual seams (one weak seam shouldn't fail the
		// audit); fail only on a hard console/page error regression.
		expect(
			errors,
			"no console/page errors during the knowledge-layer audit",
		).toEqual([]);
	} finally {
		await s.finish();
	}
});
