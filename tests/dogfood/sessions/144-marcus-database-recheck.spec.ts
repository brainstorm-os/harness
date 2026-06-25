/**
 * Session 144 — Marcus re-checks the Database surface (it has live source WIP).
 *
 * Database is the one app with active uncommitted source changes (app.ts /
 * styles.css), so Marcus re-reviews the surface he last saw in 118: grid
 * legibility, the footer (where F-065 lived), and overall consistency — to catch
 * any regression the WIP may have introduced. Spec posts intent/neutral; verdict
 * from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus re-checks the Database surface (144)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("144-marcus-database-recheck");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Re-checking Database — it's got live changes in flight. Looking at the grid, the footer and overall consistency for any regression.",
		);

		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		// A grid-backed list (Projects) so the footer + columns are in view.
		await db
			.locator(".db-sidebar__list-item", { hasText: /Projects/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1200);
		await s.shot(db, "01-grid");

		const footer = await db
			.locator(".dbv-grid__foot-total")
			.first()
			.innerText()
			.then((t) => t.replace(/\s+/g, " ").trim())
			.catch(() => "");
		s.note(`grid footer total (F-065 check): ${JSON.stringify(footer)}`);

		const headers = await db
			.locator(".dbv-grid__cell--head")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 10),
			)
			.catch(() => [] as string[]);
		s.note(`column headers: ${JSON.stringify(headers)}`);

		s.chat(SPEAKER.Marcus, "Walked the grid again — pulling my read from the capture.");
		s.note("Marcus re-checked Database; verdict from captures.");
	} finally {
		await s.finish();
	}
});
