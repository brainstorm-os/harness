/**
 * Session 128 — Mira checks the Northbound HQ operating hub.
 *
 * Her operator habit: open the home doc and make sure the business is still one
 * click from one page — the links/embeds to the thesis, the Clients pipeline,
 * the content plan and deliverables all resolve. Reliable open + read + capture.
 * Spec posts intent/neutral only; the verdict is decided from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira checks the Northbound HQ hub (128)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("128-mira-hub-check");
	try {
		s.chat(
			SPEAKER.Mira,
			"Quick check on Northbound HQ — making sure the hub still links out to everything cleanly before the week ramps.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// Find the hub the way Mira would — search (it's an older note, below the
		// sidebar fold). If search can't surface an existing note, that's real
		// friction worth catching.
		const search = notes.getByPlaceholder(/search notes/i).first();
		await search.click().catch(() => undefined);
		await search.fill("Northbound HQ").catch(() => undefined);
		await notes.waitForTimeout(800);
		await s.shot(notes, "01-search");
		const hub = notes.locator("text=/Northbound HQ/i").first();
		const found = (await hub.count()) > 0;
		s.note(`Northbound HQ surfaced by search: ${found}`);
		if (found) {
			await hub.click().catch(() => undefined);
			await notes.waitForTimeout(1200);
		}
		await s.shot(notes, "02-hub");

		// Read the hub's body: how many links / embed cards does it carry, and do
		// any look broken (empty card, "not found")?
		const links = await notes
			.locator(
				'[contenteditable="true"] a, [contenteditable="true"] [class*="mention"], [contenteditable="true"] [class*="embed"], [contenteditable="true"] [class*="entity-card"]',
			)
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 20),
			)
			.catch(() => [] as string[]);
		s.note(`Hub links / embed labels: ${JSON.stringify(links)}`);

		const brokenMarkers = await notes
			.locator(
				'[contenteditable="true"] :text("not found"), [contenteditable="true"] :text("Untitled"), [contenteditable="true"] [class*="broken"], [contenteditable="true"] [class*="missing"]',
			)
			.count()
			.catch(() => 0);
		s.note(`possible broken/embed markers in hub body: ${brokenMarkers}`);

		s.chat(SPEAKER.Mira, "Walked the hub — pulling my read from the captures.");
		s.note("Mira reviewed the Northbound HQ hub; verdict from captures.");
	} finally {
		await s.finish();
	}
});
