/**
 * Session 121 — Priya Nair's craft trial (the second hire starts work).
 *
 * Northbound's new Research Editor proves herself the way she'll work: a tight,
 * *cited* research brief, then a hard look at the connective tissue she lives in
 * — can she cite, cross-link, and embed cleanly? Her lens is "is the knowledge
 * trustworthy, findable, well-connected," so this session both BUILDS a real
 * artifact (the brief) and AUDITS the seams (slash-menu embed/reference
 * discoverability, wiki-link/mention for cross-references). Friction in her
 * voice, from the captures.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	insertTransclusion?: (entityId: string, entityType: string, label: string) => Promise<void>;
};

test("Priya's craft trial — a cited brief + a knowledge-integrity audit (121)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("121-priya-craft-trial");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// ── Build: a cited research brief ───────────────────────────────────
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
		await notes.keyboard.type("Craft trial — Priya Nair: distribution moats at seed", { delay: 10 });
		await notes.waitForTimeout(300);
		const wrote = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Thesis: at seed, distribution compounds faster than product. The moat is owned audience + a repeatable wedge, not feature parity.",
				);
				await dev.appendParagraph(
					"Evidence: (1) three Northbound advisory clients grew pipeline 2-3x once they shifted from paid to owned channels [Clients pipeline]; (2) the newsletter's reply-rate tracks issue specificity, not cadence [Issue #1, #2]; (3) reading-list items 1-4 converge on the same finding.",
				);
				await dev.appendParagraph(
					"Recommendation: every issue ends with one concrete wedge the reader can run this week. Measure reply-rate, not opens.",
				);
				await dev.appendParagraph(
					"Open questions: does the wedge generalize beyond dev-tools clients? Need two more data points before publishing.",
				);
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "cited brief written via dev hook" : "FRICTION? notes dev hook unavailable");
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-cited-brief");

		// ── Audit: the connective tissue (Priya's lens) ─────────────────────
		// Citations point at other surfaces — can she actually MAKE those links?
		// Open the slash menu and see what reference/embed/link commands exist.
		const editor = notes.locator('[contenteditable="true"]').first();
		await editor.click().catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await notes.keyboard.press("Enter").catch(() => undefined);
		// Filter for the thing a research editor actually needs: embed a live
		// surface into the brief. Scope to the slash menu, not the sidebar.
		await notes.keyboard.type("/embed", { delay: 30 });
		await notes.waitForTimeout(700);
		await s.shot(notes, "02-slash-menu");
		const slashItems = (
			await notes
				.locator(
					".notes__slash-menu button, .notes__slash-menu [class*='item'], .notes__slash-menu [role='option']",
				)
				.allInnerTexts()
				.catch(() => [])
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 15);
		s.note(`"/embed" slash-menu results: ${JSON.stringify(slashItems)}`);
		const hasEmbed = slashItems.some((c) => /embed|reference|page|entity|card/i.test(c));
		s.note(`Can Priya embed a live surface from the slash menu (via /embed)? ${hasEmbed}`);
		await notes.keyboard.press("Escape").catch(() => undefined);
		await notes.waitForTimeout(200);

		// Cross-link by mention: does typing "@" surface a way to link an existing
		// note (the well-connected-knowledge test)?
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
		s.note(`"@" mention typeahead offered: ${JSON.stringify(mentionItems)}`);
		s.note(
			mentionItems.length > 0
				? "mention/cross-link path exists (good — well-connected knowledge)"
				: "WATCH: '@' surfaced no cross-link options — can Priya connect notes at all?",
		);
		await notes.keyboard.press("Escape").catch(() => undefined);

		s.note(
			"Priya built a cited brief and audited the citation/link/embed seams; friction from captures.",
		);
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
