/**
 * Session 189 — Priya's findability audit (Thu).
 *
 * She just filed the Issue #4 outline (188). Her knowledge-integrity question:
 * can she FIND what she just wrote, and do the threads she leans on resolve?
 * She searches the notes for terms she knows are in the new draft ("Issue #4",
 * "rented distribution") and for a long-standing theme ("Beacon"), and reads
 * back whether the right pieces surface. A search that misses a doc she *knows*
 * exists is the exact failure she hunts. Verdict from the per-query results.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const QUERIES: { term: string; expectHint: string }[] = [
	{ term: "Issue #4", expectHint: "the outline I just wrote" },
	{ term: "rented distribution", expectHint: "the #4 angle (phrase from the body)" },
	{ term: "Beacon", expectHint: "the advisory thread / one-pager" },
];

test("Priya audits findability of the knowledge base (189)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("189-priya-findability-audit");
	try {
		s.chat(
			SPEAKER.Priya,
			"Audit: if I can't find what I filed yesterday, the knowledge base is a write-only hole. Searching for the Issue #4 draft, a body phrase, and the Beacon thread.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const search = notes.getByPlaceholder(/search notes/i).first();

		let shot = 0;
		for (const q of QUERIES) {
			await search.click().catch(() => undefined);
			await search.fill("").catch(() => undefined);
			await notes.waitForTimeout(200);
			await search.fill(q.term).catch(() => undefined);
			await notes.waitForTimeout(1000);
			const results = await notes
				.locator(".notes__sidebar-title, [class*='sidebar'] [class*='title']")
				.allInnerTexts()
				.then((xs) =>
					xs
						.map((t) => t.replace(/\s+/g, " ").trim())
						.filter(Boolean)
						.slice(0, 12),
				)
				.catch(() => [] as string[]);
			s.note(
				`search "${q.term}" (${q.expectHint}) → ${results.length} hits: ${JSON.stringify(results)}`,
			);
			await s.shot(
				notes,
				`${String(++shot).padStart(2, "0")}-search-${q.term.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
			);
		}

		// Body-phrase findability is the hard case: full-text vs. title-only search.
		const bodyPhraseHits = await notes
			.locator(".notes__sidebar-title, [class*='sidebar'] [class*='title']")
			.count()
			.catch(() => 0);
		s.note(
			`final query body-phrase hit count: ${bodyPhraseHits} (0 = title-only search, a real gap for full-text findability)`,
		);

		s.chat(
			SPEAKER.Priya,
			"Ran the three queries — reading the hit lists from the captures to see if search reaches into bodies or only matches titles.",
		);
		s.note(
			"Priya audited findability; verdict from per-query hit lists (esp. whether the body-phrase query returns the #4 doc).",
		);
	} finally {
		await s.finish();
	}
});
