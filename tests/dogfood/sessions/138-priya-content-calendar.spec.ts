/**
 * Session 138 — Priya checks the editorial pipeline (Content Calendar).
 *
 * Her "is the pipeline coherent" lens: open the Content Calendar collection and
 * confirm the issues she's been drafting are tracked there with status/dates —
 * the editorial through-line, not scattered docs. Reliable open + read + capture.
 * Spec posts intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya reviews the Content Calendar pipeline (138)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("138-priya-content-calendar");
	try {
		s.chat(
			SPEAKER.Priya,
			"Checking the Content Calendar — making sure the issues I'm drafting are actually tracked in the editorial pipeline, not just floating as docs.",
		);

		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1400);
		await s.shot(db, "01-content-calendar");

		const rows = await db
			.locator(".dbv-grid__cell[data-col='title'], [class*='card'] [class*='title'], [class*='row']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 16),
			)
			.catch(() => [] as string[]);
		s.note(`content calendar entries: ${JSON.stringify(rows)}`);

		const headerMeta = await db
			.locator(".db-stage__header, [class*='stage'] [class*='meta'], [class*='count']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 6),
			)
			.catch(() => [] as string[]);
		s.note(`header/meta: ${JSON.stringify(headerMeta)}`);

		s.chat(SPEAKER.Priya, "Walked the editorial pipeline — pulling my read from the capture.");
		s.note("Priya reviewed the Content Calendar; verdict from capture.");
	} finally {
		await s.finish();
	}
});
