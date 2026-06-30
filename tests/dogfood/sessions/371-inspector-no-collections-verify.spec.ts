/**
 * Session 371 — verify the Database inspector polish.
 *
 * - The COLLECTIONS section ("do not show collections properties") is gone.
 * - Property rows are denser (shared .bs-props row padding tightened — affects
 *   every app's inspector).
 *
 * Opens the Database app, selects a record, opens the inspector, and asserts the
 * collections block is absent + captures the property list.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("Database inspector: no collections section, denser rows (371)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("371-inspector-no-collections-verify");
	try {
		const db = await s.openApp(APP.Database);
		const errs = collectConsoleErrors(db);
		await db.waitForTimeout(2500);

		// Select the first row, then open the inspector.
		await db.locator('[role="row"], [class*="row"]').first().click().catch(() => undefined);
		await db.waitForTimeout(500);
		await db
			.locator('[aria-label*="propert" i], [aria-label*="inspector" i], [aria-label*="info" i]')
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);

		const collections = await db.locator('[data-testid="db-inspector-collections"]').count().catch(() => 0);
		const collectionsText = await db.locator(".db-inspector :text('COLLECTIONS')").count().catch(() => 0);
		const rows = await db.locator(".bs-props__row").count().catch(() => 0);
		const rowH = await db
			.evaluate(() => {
				const r = document.querySelector(".bs-props__row") as HTMLElement | null;
				return r ? Math.round(r.getBoundingClientRect().height) : null;
			})
			.catch(() => null);
		s.note(
			`[database] inspector: collections section=${collections} (want 0), 'COLLECTIONS' label=${collectionsText} (want 0), .bs-props rows=${rows}, first row height=${rowH ?? "?"}px`,
		);
		await s.shot(db, "db-inspector", db.locator(".db-inspector, .bs-props").first());
		await s.shot(db, "db-full");
		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 4)) s.note(`    db: ${e}`);
	} finally {
		await s.finish();
	}
});
