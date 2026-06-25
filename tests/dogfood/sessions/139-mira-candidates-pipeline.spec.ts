/**
 * Session 139 — Mira reviews the Candidates hiring pipeline (post-hire).
 *
 * With Priya hired, Mira checks the Candidates collection — the funnel she ran
 * (Applied → … → Hired). Reliable open + read + capture; confirms the hire is
 * reflected and the pipeline reads cleanly. Spec posts intent/neutral; verdict
 * from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira reviews the Candidates pipeline (139)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("139-mira-candidates-pipeline");
	try {
		s.chat(
			SPEAKER.Mira,
			"Closing out the hiring funnel — checking the Candidates pipeline now that Priya's onboard. Want to see the stages read cleanly.",
		);

		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		await db
			.locator(".db-sidebar__list-item", { hasText: /Candidates/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1400);
		await s.shot(db, "01-candidates");

		const labels = await db
			.locator("[class*='card'], [class*='column'] [class*='title'], .dbv-grid__cell, [class*='chip']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 20),
			)
			.catch(() => [] as string[]);
		s.note(`candidates / stages: ${JSON.stringify(labels)}`);

		s.chat(SPEAKER.Mira, "Walked the funnel — pulling my read from the capture.");
		s.note("Mira reviewed the Candidates pipeline; verdict from capture.");
	} finally {
		await s.finish();
	}
});
