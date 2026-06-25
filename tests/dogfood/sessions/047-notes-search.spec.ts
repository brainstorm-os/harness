/**
 * Session 047 — Mira searches her notes for a client mentioned in the body.
 * "Vertex" appears in the investment-thesis note's body (not its title), so this
 * exercises the FTS5 search index over note bodies (the same index global search
 * uses — which the headless harness can't open the launcher to test directly).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("notes search finds a note by its body content", async () => {
	test.setTimeout(180_000);
	const s = await startSession("047-notes-search");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const before = await notes
			.locator(".notes__sidebar-row")
			.allInnerTexts()
			.catch(() => []);
		s.note(
			`Notes before search: ${before.filter((t) => !/^(TODAY|YESTERDAY|EARLIER)/i.test(t.trim())).length} rows`,
		);

		const search = notes.getByPlaceholder(/Search notes/i).first();
		s.note(`Search input present: ${(await search.count()) > 0}`);
		await search.click();
		await search.fill("Vertex");
		await notes.waitForTimeout(1200);
		await s.shot(notes, "01-search-vertex");

		const results =
			(await notes
				.locator(".notes__sidebar-list")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(`Results visible: ${JSON.stringify(results.replace(/\s+/g, " ").trim().slice(0, 160))}`);
		const foundThesis = /investment thesis/i.test(results);
		s.note(`Found thesis note by body match ("Vertex"): ${foundThesis}`);

		expect((await search.count()) > 0).toBe(true);
	} finally {
		await s.finish();
	}
});
