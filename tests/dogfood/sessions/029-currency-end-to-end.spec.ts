/**
 * Session 029 — full currency end-to-end on a fresh collection (residue-free):
 * create a Deal size CURRENCY column, add a row, click the cell, type an amount,
 * and confirm it renders as "$25,000". Verifies the F-021 click-target fix +
 * the F-019 currency creation + currency display together.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("create a currency column, enter an amount, see it formatted", async () => {
	test.setTimeout(180_000);
	const s = await startSession("029-currency-end-to-end");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// Fresh blank collection.
		await db.locator("#sidebar-new-list").first().click();
		await db.waitForTimeout(400);
		await db.locator('text="Blank collection"').first().click();
		await db.waitForTimeout(1200);

		// Add a Deal size CURRENCY column.
		await db.locator("#toolbar-settings").click();
		await db.waitForTimeout(500);
		const add = db.locator('[data-testid="db-view-settings-add-column"]').first();
		await add.scrollIntoViewIfNeeded().catch(() => undefined);
		await add.click();
		await db.waitForTimeout(350);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /Create new property/ })
			.first()
			.click();
		await db.waitForTimeout(400);
		await db.locator(".bs-inline-property-form__name").fill("Deal size");
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Number$/ })
			.first()
			.click();
		await db.waitForTimeout(150);
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Currency$/ })
			.first()
			.click();
		await db.locator(".bs-inline-property-form__action--primary").first().click();
		await db.waitForTimeout(900);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);

		// Add a row.
		await db
			.locator(".db-stage__view-bar button", { hasText: /New/ })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);

		const cell = db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.locator(".dbv-grid__cell--editable")
			.first();
		// Click the CELL CENTER (not the tiny text) — the F-021 fix makes the
		// whole cell the edit target.
		await cell.click();
		await db.waitForTimeout(250);
		const input = db.locator(".bs-cell-input, .bs-cell-plain-input").first();
		s.note(`Editor opened on cell-center click: ${(await input.count()) > 0}`);
		if ((await input.count()) > 0) {
			await input.fill("25000");
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
			s.note("Typed 25000 + Enter");
		}
		await s.shot(db, "01-amount-entered");

		const rendered = (await cell.innerText().catch(() => "")) ?? "";
		s.note(`Cell renders: ${JSON.stringify(rendered.replace(/\s+/g, " ").trim())}`);
		const isCurrency = /\$\s?25,?000|US\$\s?25,?000/.test(rendered);
		s.note(`Renders as currency ($25,000): ${isCurrency}`);

		// Re-edit must reload the raw number, not "$25,000" (F-020).
		await cell.click();
		await db.waitForTimeout(250);
		const reEdit = await db.evaluate(() => {
			const i = document.querySelector<HTMLInputElement>(".bs-cell-input, .bs-cell-plain-input");
			return i?.value ?? null;
		});
		s.note(`Re-edit prefill (want "25000"): ${JSON.stringify(reEdit)}`);
		await db.keyboard.press("Escape");

		expect(isCurrency).toBe(true);
		expect(reEdit).toBe("25000");
	} finally {
		await s.finish();
	}
});
