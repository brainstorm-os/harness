/**
 * Session 118 — Marcus reviews the Database app's recently-grown surface.
 *
 * The engagement/Clients work (relation properties B5.13, the multi-view
 * chrome, the right-panel inspector) is the freshest design surface in the
 * product. Marcus — skeptical, detail-strict, allergic to inconsistency —
 * opens Database and scrutinizes it the way a first-time-but-exacting user
 * would: the view switcher, the grid, the board, the inspector, the object ⋯
 * menu placement, header baselines, cover behavior. He files specific,
 * substantiated friction; the captures back every claim.
 *
 * Not an artifact build — a critical design review. Friction from the captures.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Marcus design-reviews the Database app surface", async () => {
	test.setTimeout(240_000);
	const s = await startSession("118-marcus-database-review");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2200);
		await s.shot(db, "01-database-resting");

		// What does the chrome actually say? Marcus reads the surface labels —
		// view switcher, headers, toolbar — before judging consistency.
		const chrome = await db
			.locator(
				"[class*='header'], [class*='view'], [class*='toolbar'], [class*='tab'], [class*='empty']",
			)
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 24),
			)
			.catch(() => [] as string[]);
		s.note(`Database chrome labels: ${JSON.stringify(chrome)}`);

		// The object ⋯ menu must be the LAST element in the header right group
		// (a standing rule). Marcus checks the header right-group order.
		const headerRight = await db
			.locator("[class*='app-header__right'], [class*='header__right']")
			.first()
			.locator("button")
			.allInnerTexts()
			.catch(() => [] as string[]);
		s.note(`Header right-group buttons (order matters): ${JSON.stringify(headerRight)}`);

		// Open the inspector on a row — relation properties + cover live here.
		const firstRow = db
			.locator("[class*='row'], [class*='card'], [role='row']")
			.filter({ hasText: /.+/ })
			.first();
		if (await firstRow.count()) {
			await firstRow.click().catch(() => undefined);
			await db.waitForTimeout(1400);
			await s.shot(db, "02-inspector-open");

			const props = await db
				.locator("[class*='inspector'] [class*='prop'], .bs-props [class*='prop']")
				.allInnerTexts()
				.then((xs) =>
					xs
						.map((t) => t.replace(/\s+/g, " ").trim())
						.filter(Boolean)
						.slice(0, 20),
				)
				.catch(() => [] as string[]);
			s.note(`Inspector property labels: ${JSON.stringify(props)}`);
		}

		// Cycle the views Marcus expects every database to offer; capture each so
		// inconsistencies between grid/board/gallery/calendar are visible.
		const viewTriggers = db.locator(
			"[class*='view-switch'] button, [class*='views'] button, [role='tab']",
		);
		const vcount = Math.min(await viewTriggers.count().catch(() => 0), 5);
		s.note(`view switcher options found: ${vcount}`);
		for (let i = 0; i < vcount; i++) {
			await viewTriggers
				.nth(i)
				.click()
				.catch(() => undefined);
			await db.waitForTimeout(1100);
			await s.shot(db, `03-view-${i + 1}`);
		}

		s.note(
			"Marcus swept Database: resting grid, header right-group order, inspector (relation props + cover), and each view. Friction distilled from captures.",
		);
	} finally {
		await s.finish();
	}
});
