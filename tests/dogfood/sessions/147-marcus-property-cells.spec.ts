/**
 * Session 147 — Marcus re-checks property-cell rendering (sdk cell WIP).
 *
 * The shared property-cell system has live source WIP (`cell-popover.tsx`,
 * `tag-cell.tsx`, `cells.css`). Marcus reviews how those cells RENDER — grid
 * cells inline + the record inspector's property rows — read-only (no flaky
 * popover driving, per the F-125 caveat). Spec posts intent/neutral; verdict
 * from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus re-checks property-cell rendering (147)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("147-marcus-property-cells");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Re-checking the property cells — the shared cell code's in flight. Looking at how the pills, tags and values render across the grid and inspector.",
		);

		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		await db
			.locator(".db-sidebar__list-item", { hasText: /Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1200);
		await s.shot(db, "01-cells-grid");

		const pills = await db
			.locator(".bs-cell-pill, .bs-cell-pill-text")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`rendered pill cells: ${JSON.stringify(pills)}`);

		// Best-effort: open a record to see the inspector's property rows.
		await db
			.locator("text=/Beacon Analytics/i")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1200);
		await s.shot(db, "02-inspector-cells");

		const inspectorCells = await db
			.locator(".inspector__body .bs-cell-pill, .inspector__body [class*='bs-cell']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`inspector cell values: ${JSON.stringify(inspectorCells)}`);

		s.chat(
			SPEAKER.Marcus,
			"Walked the cells across grid + inspector — pulling my read from the captures.",
		);
		s.note("Marcus re-checked property-cell rendering; verdict from captures.");
	} finally {
		await s.finish();
	}
});
