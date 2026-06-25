/**
 * Session 159 — Priya reopens her journal cold and checks the live references
 * she dropped (sessions 157/158) survived and resolve to a readable page.
 *
 * Rung (c) let her insert a "Reference" to a live page in a daily log. The
 * question her work actually depends on is the next one: after she closes the
 * app and comes back another day, is the reference STILL there, and does it
 * resolve to the page it points at (a readable card with the page's title), or
 * has it gone stale / blank? This is a fresh shell boot against the persistent
 * vault — a true cold round-trip, not an in-session re-render. Verdict from the
 * captures + the resolved label/text the transclusion node renders.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya's journal references survive a cold reopen and resolve (159)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("159-priya-reference-roundtrip");
	try {
		s.chat(
			SPEAKER.Priya,
			"Back in my log a day later. The real test of an embed isn't inserting it — it's whether it's still there and still points at the live page when I come back. Checking.",
		);

		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(2000);
		await s.shot(journal, "01-journal-reopened");

		// Count transclusion/embed nodes that survived the reopen.
		const nodeCount = await journal
			.locator('[class*="transclusion"], [data-transclusion], [class*="block-embed"]')
			.count()
			.catch(() => 0);
		s.note(`transclusion/embed nodes present after cold reopen: ${nodeCount}`);

		// What do they render? Pull the visible text of each — a resolved
		// reference should show the target page's title, not an empty/placeholder
		// shell or a raw id.
		const renderedTexts = await journal
			.locator('[class*="transclusion"], [data-transclusion], [class*="block-embed"]')
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`reference rendered labels/text: ${JSON.stringify(renderedTexts)}`);

		const anyResolved = renderedTexts.some((t) => t.length > 0 && !/^untitled$/i.test(t));
		const anyBlank = nodeCount > 0 && renderedTexts.length < nodeCount;
		s.note(`at least one reference resolves to a non-empty title: ${anyResolved}`);
		s.note(`some reference nodes render blank (no text): ${anyBlank}`);

		// Scroll the first reference into view and shoot it close-up so the verdict
		// (live card vs. dead placeholder) is legible.
		const firstRef = journal
			.locator('[class*="transclusion"], [data-transclusion], [class*="block-embed"]')
			.first();
		await firstRef.scrollIntoViewIfNeeded().catch(() => undefined);
		await journal.waitForTimeout(300);
		await s.shot(journal, "02-reference-rendered", firstRef).catch(() => undefined);
		await s.shot(journal, "03-journal-full");

		s.chat(
			SPEAKER.Priya,
			"Pulled my read on whether the references held and resolved from the captures — that's the bit my issues live or die on.",
		);
		s.note(
			"Priya cold-reopen round-trip on the rung-(c) Reference — does the embed persist + resolve; verdict from captures + rendered text.",
		);
	} finally {
		await s.finish();
	}
});
