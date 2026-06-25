/**
 * Session 105 — Marcus reviews the last two unreviewed apps; Mira logs the day.
 *
 * Marcus closes out his app-surface sweep — the **Code Editor** (where he'll
 * keep the site/template source) and the **Journal** (the daily cadence). Mira
 * writes a quick end-of-day journal line. Real work; friction from captures.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Marcus reviews Code Editor + Journal; Mira logs the day", async () => {
	test.setTimeout(240_000);
	const s = await startSession("105-marcus-editor-journal");
	try {
		// ── Marcus: review the Code Editor ─────────────────────────────────
		const code = await s.openApp(APP.CodeEditor);
		await code.waitForTimeout(1800);
		await s.shot(code, "01-code-resting");
		const codeLabels = await code
			.locator("[class*='tab'], [class*='empty'], [class*='file']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`Code Editor surface labels: ${JSON.stringify(codeLabels)}`);

		// ── Marcus: review the Journal ─────────────────────────────────────
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await s.shot(journal, "02-journal-resting");

		// ── Mira: a quick end-of-day line in the Journal ───────────────────
		const jBody = journal
			.locator(".journal__entry-editor [contenteditable], .journal__entry-editor")
			.first();
		if (await jBody.count()) {
			await jBody.click().catch(() => undefined);
			await journal.keyboard.type(
				"Issue #1 drafted, pipeline checked, Marcus swept the app surfaces. Good first week.",
				{ delay: 8 },
			);
			await journal.waitForTimeout(600);
		}
		await s.shot(journal, "03-journal-written");

		s.note("captured Code Editor + Journal for Marcus's review; Mira logged the day");
	} finally {
		await s.finish();
	}
});
