/**
 * Session 093 — Marcus (designer candidate) reviews the Database app.
 *
 * Second dogfood persona: Marcus Lee, the Product Designer Mira's hiring. His
 * craft trial is to review Brainstorm's design and find flaws — he's skeptical
 * of new tools and strict on detail. This session is a CRITICAL DESIGN REVIEW,
 * not a build-an-artifact workflow: it captures the exact states he scrutinizes
 * (a collection grid with the Details panel open; the view tabs) and the
 * deliverable is his sharp design critique in the friction log, grounded in
 * these screenshots.
 *
 * No app-source change → SKIP_BUILD.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("design review — Database (Marcus)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("093-design-review-database");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// 1. A collection in the grid with a row selected → the Details panel
		//    open over the grid (the state every CRM/pipeline edit lands in).
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Clients/i })
			.first()
			.click();
		await db.waitForTimeout(700);
		await db.locator(".db-tab", { hasText: /Grid/i }).first().click();
		await db.waitForTimeout(400);
		await db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(600);
		await s.shot(db, "01-grid-with-inspector");

		// 2. Nothing selected — does the panel still occupy / clip the grid?
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(400);
		await s.shot(db, "02-grid-empty-inspector");

		// 3. The view tabs — names of user-created views (the "+ New view").
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Candidates/i })
			.first()
			.click();
		await db.waitForTimeout(700);
		await s.shot(db, "03-view-tabs");
		const tabLabels = (
			await db.locator(".db-tab:not(.db-tab--add) .db-tab__label").allInnerTexts()
		).map((t) => t.trim());
		s.note(`Candidates view tab labels: ${JSON.stringify(tabLabels)}`);

		// 4. The board, full-bleed — column rhythm, header weight, card density.
		const board = db.locator(".db-tab:not(.db-tab--add)").last();
		await board.click();
		await db.waitForTimeout(700);
		await s.shot(db, "04-board");

		s.note("captured 4 states for Marcus's design review (critique filed in friction-log)");
	} finally {
		await s.finish();
	}
});
