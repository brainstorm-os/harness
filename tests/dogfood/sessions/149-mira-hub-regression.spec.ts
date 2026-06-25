/**
 * Session 149 — Mira re-checks the Northbound HQ hub (regression on the keystone).
 *
 * After a week of new notes/issues/links, confirm the operating hub still
 * composes cleanly — transclusions render, nothing dangling. Reliable search +
 * open + capture. Spec posts intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira re-checks the Northbound HQ hub (149)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("149-mira-hub-regression");
	try {
		s.chat(
			SPEAKER.Mira,
			"Quick regression glance at Northbound HQ — after a week of new docs, is the hub still composing cleanly?",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const search = notes.getByPlaceholder(/search notes/i).first();
		await search.click().catch(() => undefined);
		await search.fill("Northbound HQ").catch(() => undefined);
		await notes.waitForTimeout(700);
		await notes
			.locator("text=/Northbound HQ/i")
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1200);
		await s.shot(notes, "01-hub");

		const transclusions = await notes
			.locator(
				'[contenteditable="true"] [class*="transclu"], [contenteditable="true"] [class*="embed"], [contenteditable="true"] [class*="entity-card"]',
			)
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`hub transclusion/embed labels: ${JSON.stringify(transclusions)}`);

		const broken = await notes
			.locator(
				'[contenteditable="true"] :text("not found"), [contenteditable="true"] [class*="broken"], [contenteditable="true"] [class*="missing"]',
			)
			.count()
			.catch(() => 0);
		s.note(`broken/missing markers in hub: ${broken}`);

		s.chat(SPEAKER.Mira, "Looked the hub over — pulling my read from the capture.");
		s.note("Mira re-checked the hub; verdict from capture.");
	} finally {
		await s.finish();
	}
});
