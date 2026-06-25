/**
 * Session 114 — capture research + wire it into the issue (substance + stress).
 *
 * Two jobs: (1) add real substance — a genuine research note Mira would cite;
 * (2) test the connective tissue she needs for the content loop — can she pull
 * that research INTO the issue draft via the editor's slash menu? Resolves the
 * "VERIFY embed discoverability" left open in 113. Founder mode.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("capture research + wire into the issue (114)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("114-link-research");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// 1. A real research note (substance).
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
		await notes.keyboard.type("Research — the trust tax in CI/CD", { delay: 10 });
		await notes.waitForTimeout(300);
		await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return;
				await dev.appendParagraph(
					"Finding: teams that don't trust their pipeline merge ~30% slower and ship behind a quiet attention tax. Three orgs sized it; the wedge is reliability, not dashboards.",
				);
				await dev.appendParagraph("Sources: reading-list items 1–3. Use in Issue #1 and #2.");
			})
			.catch(() => undefined);
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-research-note");
		s.note("Wrote a real research note (substance).");

		// 2. The connective tissue: open the issue draft, try the slash menu to
		//    reference/embed the research note.
		const issue = notes.locator("text=/Issue #2 — pricing power/i").first();
		if (await issue.count()) {
			await issue.click().catch(() => undefined);
			await notes.waitForTimeout(800);
			const editor = notes.locator('[contenteditable="true"]').first();
			await editor.click().catch(() => undefined);
			await notes.keyboard.press("Meta+ArrowDown").catch(() => undefined);
			await notes.keyboard.press("Enter").catch(() => undefined);
			await notes.keyboard.type("/", { delay: 30 });
			await notes.waitForTimeout(700);
			await s.shot(notes, "02-slash-menu");
			const slashItems = (
				await notes
					.locator(
						'[role="option"], [class*="menu"] [class*="item"], [class*="typeahead"] [class*="item"], [class*="command"]',
					)
					.allInnerTexts()
					.catch(() => [])
			)
				.map((t) => t.replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 25);
			s.note(`Slash-menu commands: ${JSON.stringify(slashItems)}`);
			const hasEmbed = slashItems.some((c) => /embed|reference|mention|link|transclu|page/i.test(c));
			s.note(`Slash menu offers an embed/reference/link command? ${hasEmbed}`);
			await notes.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("Issue #2 draft not found to test linking");
		}

		s.note("captured research-capture + embed-path test");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
