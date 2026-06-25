/**
 * Session 148 — Priya checks findability (search across the knowledge base).
 *
 * Her "is the knowledge findable" lens: search the notes for a recurring theme
 * ("moat") and confirm the relevant pieces surface. Reliable search-box read.
 * Spec posts intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya checks search findability (148)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("148-priya-findability");
	try {
		s.chat(
			SPEAKER.Priya,
			"Sanity-checking findability — if I search a theme like 'moat', do the right pieces come up? That's the test of whether the knowledge base actually works.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const search = notes.getByPlaceholder(/search notes/i).first();
		await search.click().catch(() => undefined);
		await search.fill("moat").catch(() => undefined);
		await notes.waitForTimeout(900);
		await s.shot(notes, "01-search-moat");

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
		s.note(`"moat" search results: ${JSON.stringify(results)}`);

		s.chat(SPEAKER.Priya, "Ran the search — pulling my read from the capture.");
		s.note("Priya checked findability; verdict from capture.");
	} finally {
		await s.finish();
	}
});
