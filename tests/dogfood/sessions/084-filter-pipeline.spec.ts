/**
 * Session 084 — Mira filters the Content Calendar to "what's left to ship".
 *
 * On the Grid view she builds a filter rule — Status **is not** Published — so
 * only the unshipped issues remain. Exercises the filter-builder cascade
 * (#toolbar-filter → Add filter rule → property → operator → value), all via
 * fancy menus, on a real Select property. Uncovered; friction-prone cascade.
 *
 * Idempotent: clears any existing filter first, then builds the rule fresh.
 * No app-source change → SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const opt = (page: import("@playwright/test").Page, text: RegExp) =>
	page.locator('.fm-menu [role="option"]', { hasText: text }).last();

test("filter the pipeline to unshipped issues", async () => {
	test.setTimeout(180_000);
	const s = await startSession("084-filter-pipeline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click();
		await db.waitForTimeout(700);
		// Filter the Grid view (so rows are assertable).
		await db.locator(".db-tab", { hasText: /Grid/i }).first().click();
		await db.waitForTimeout(500);

		// Clear any pre-existing filter (idempotent).
		await db.locator("#toolbar-filter").first().click();
		await db.waitForTimeout(400);
		const clear = opt(db, /Clear filter/i);
		if ((await clear.count()) > 0) {
			await clear.click();
			await db.waitForTimeout(500);
			s.note("cleared a pre-existing filter");
		} else {
			await db.keyboard.press("Escape");
		}

		// Build: Status is not Published.
		await db.locator("#toolbar-filter").first().click();
		await db.waitForTimeout(400);
		await opt(db, /Add (filter rule|another rule)/i).click();
		await db.waitForTimeout(450);
		await opt(db, /^Status$/).click();
		await db.waitForTimeout(450);
		await opt(db, /^is not$/).click();
		await db.waitForTimeout(450);
		await opt(db, /^Published$/).click();
		await db.waitForTimeout(800);
		s.note("applied filter: Status is not Published");
		await s.shot(db, "01-filtered");

		const rows = (await db.locator(".dbv-grid__title-label").allInnerTexts()).map((t) => t.trim());
		s.note(`rows after filter: ${JSON.stringify(rows)}`);

		expect(
			rows.some((r) => r.includes("Issue #2")) && rows.some((r) => r.includes("Issue #3")),
			"the unshipped issues (Scheduled + Drafting) remain",
		).toBe(true);
		expect(
			rows.some((r) => r.includes("Issue #1")),
			"the Published issue is filtered out",
		).toBe(false);
	} finally {
		await s.finish();
	}
});
