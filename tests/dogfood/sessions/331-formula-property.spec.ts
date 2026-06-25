/**
 * Session 331 — verify the Formula PROPERTY end-to-end in the real shell.
 *
 * Mira adds a "Calc" Formula property (expression `10 + 5`, no references so it
 * computes the same in every row) to a populated Database collection, and the
 * grid shows the computed value (15). This exercises the whole promoted path:
 * the add-property picker's Formula tile + expression input, the saved
 * PropertyDef (number + format=formula), and the shared FormulaCell rendering
 * with sibling context in the grid. Compute correctness for {ref} expressions is
 * unit-covered (formula engine + FormulaCell); this is the integration gate.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

async function pickCollectionWithRows(db: Page): Promise<void> {
	// Prefer a collection that has rows so formula cells render.
	const items = db.locator(".db-sidebar__list-item");
	const count = await items.count();
	for (let i = 0; i < count; i++) {
		await items
			.nth(i)
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(500);
		const rows = await db.locator(".dbv-grid__row, [role='row']").count();
		if (rows > 1) return;
	}
}

test("formula property computes in the grid (331)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("331-formula-property");
	try {
		const db = await s.openApp(APP.Database);
		const errors = collectConsoleErrors(db);
		await db.waitForTimeout(1800);
		await pickCollectionWithRows(db);
		await s.shot(db, "collection");

		// Open the add-property constructor: gear → Grid settings → Properties →
		// Add column → Create new property.
		await db
			.locator("#toolbar-settings")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(500);
		await db
			.getByText(/^Properties$/i)
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(400);
		await s.shot(db, "properties-page");
		await db
			.getByText(/Add column|Add a column|New column|Add property|New property/i)
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(400);
		await db
			.getByText(/Create new property|Create new|New property/i)
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(450);
		await s.shot(db, "constructor");

		// Pick the Formula tile.
		const formulaTile = db
			.locator(".bs-inline-property-form__tile", { hasText: /^Formula$/i })
			.first();
		s.note(`Formula tile present: ${await formulaTile.count()}`);
		expect(await formulaTile.count(), "the Formula tile should appear in the picker").toBeGreaterThan(
			0,
		);
		await formulaTile.click().catch(() => undefined);
		await db.waitForTimeout(300);

		// The expression input should appear; fill name + a ref-free expression.
		const expr = db.locator(".bs-inline-property-form__formula").first();
		s.note(`expression input present: ${await expr.count()}`);
		expect(await expr.count(), "the formula expression input should appear").toBeGreaterThan(0);
		await db
			.locator(".bs-inline-property-form__name")
			.first()
			.fill("Calc")
			.catch(() => undefined);
		await expr.fill("10 + 5").catch(() => undefined);
		await s.shot(db, "formula-filled");
		await db
			.locator(".bs-inline-property-form__action--primary")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1400);
		await s.shot(db, "after-create");

		// The grid should now carry a "Calc" column whose cells compute 15.
		const headers = (await db.locator(".dbv-grid__cell--head").allInnerTexts()).join(" | ");
		s.note(`grid headers: ${headers}`);
		const computed = await db.locator(".bs-cell-formula").first();
		const computedText = (await computed.innerText().catch(() => "")) ?? "";
		s.note(`first formula cell text: "${computedText}"`);
		const fifteenOnGrid = (await db.locator(".bs-cell-formula", { hasText: "15" }).count()) > 0;
		s.note(`a formula cell renders 15: ${fifteenOnGrid}`);

		if (errors.errors.length > 0) {
			s.note(`console errors (${errors.errors.length}):`);
			for (const e of errors.errors.slice(0, 6)) s.note(`  ${e}`);
		}

		// Grid headers render uppercased via CSS (innerText reflects it).
		expect(headers.toLowerCase(), "a Calc column should exist").toContain("calc");
		expect(fifteenOnGrid, "the formula cell should compute 10 + 5 = 15").toBe(true);
	} finally {
		await s.finish();
	}
});
