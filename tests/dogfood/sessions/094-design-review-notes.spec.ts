/**
 * Session 094 — Marcus reviews the Notes app.
 *
 * Second design review by the designer persona. Notes is where Mira lives, so
 * Marcus judges the reading/writing experience: title + body typography and
 * rhythm, the empty/affordance states, the note-list rows, the properties
 * panel. Captures the states; the critique (his voice, substantiated) lands in
 * the friction log.
 *
 * No app-source change → SKIP_BUILD.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("design review — Notes (Marcus)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("094-design-review-notes");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// 1. A real, prose-heavy note open — judge reading typography + rhythm.
		const issue = notes.locator("text=Issue #1 — The case for dev-tools").first();
		if ((await issue.count()) > 0) {
			await issue.click();
			await notes.waitForTimeout(800);
		}
		await s.shot(notes, "01-reading");

		// 2. Open the properties panel — its design + how it sits over the doc.
		const propsToggle = notes
			.locator('[aria-label*="properties" i], [aria-label*="inspector" i]')
			.first();
		if ((await propsToggle.count()) > 0) {
			await propsToggle.click().catch(() => undefined);
			await notes.waitForTimeout(500);
		}
		await s.shot(notes, "02-properties");

		// 3. A fresh, empty note — the first-moment / affordance state Marcus is
		//    most skeptical about (does it earn his trust on a blank page?).
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1000);
		await s.shot(notes, "03-empty-note");

		s.note("captured 3 Notes states for Marcus's review (critique in friction-log)");
	} finally {
		await s.finish();
	}
});
