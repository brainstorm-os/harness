/**
 * Session 104 — Mira reviews her pipeline; Marcus reviews Bookmarks.
 *
 * A planning work day: Mira opens the Clients CRM and the Content Calendar to
 * check where the business stands this week, then Marcus reviews **Bookmarks**
 * (Mira's captured-research surface) with his design lens. Real work; friction
 * distilled from the captures.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("pipeline check + Marcus reviews Bookmarks", async () => {
	test.setTimeout(240_000);
	const s = await startSession("104-research-and-bookmarks");
	try {
		// ── Mira: check the pipeline (Database) ────────────────────────────
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		await s.shot(db, "01-clients");
		const clientRows = (
			await db.locator(".dbv-grid__row:not(.dbv-grid__row--head), [class*='card']").allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 10);
		s.note(`Clients rows: ${JSON.stringify(clientRows)}`);

		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		await s.shot(db, "02-content-calendar");

		// ── Marcus: review Bookmarks ───────────────────────────────────────
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "03-bookmarks-resting");
		const bmLabels = (
			await bm
				.locator("[class*='card'], [class*='row'], [class*='item'], [class*='tag']")
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 15);
		s.note(`Bookmarks surface labels (for Marcus's review): ${JSON.stringify(bmLabels)}`);
		// Open the first bookmark if present, to judge the detail surface.
		const firstCard = bm.locator("[class*='card'], [class*='row']").first();
		if (await firstCard.count()) {
			await firstCard.click().catch(() => undefined);
			await bm.waitForTimeout(800);
			await s.shot(bm, "04-bookmark-detail");
		}

		s.note("captured pipeline + Bookmarks for Marcus's review");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
