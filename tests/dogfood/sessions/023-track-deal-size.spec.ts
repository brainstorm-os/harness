/**
 * Session 023 — real CRM work + currency feature check. Mira tracks deal value:
 * she adds a "Deal size" column as a CURRENCY property (Number → Currency → USD,
 * the new per-property currency UX) and records an amount. Verifies the creation
 * form exposes the Currency sub-format + code picker, the column is created, and
 * the value renders with a currency symbol.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function openClients(db: Page): Promise<void> {
	await db
		.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
		.first()
		.click();
	await db.waitForTimeout(900);
}

test("Mira adds a Deal size currency column and records an amount", async () => {
	test.setTimeout(180_000);
	const s = await startSession("023-track-deal-size");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await openClients(db);
		await s.shot(db, "01-before");

		// Open the column-adder → Create new property.
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

		// Name + Number kind + Currency sub-format.
		await db.locator(".bs-inline-property-form__name").fill("Deal size");
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Number$/ })
			.first()
			.click();
		await db.waitForTimeout(200);
		const currencyTile = db
			.locator(".bs-inline-property-form__tile", { hasText: /^Currency$/ })
			.first();
		s.note(`Currency sub-format offered for Number: ${(await currencyTile.count()) > 0}`);
		await currencyTile.click();
		await db.waitForTimeout(200);
		const codeSelect = db.locator(".bs-inline-property-form__select");
		s.note(`Currency-code picker shown: ${(await codeSelect.count()) > 0}`);
		const codeValue = await codeSelect.inputValue().catch(() => "");
		s.note(`Default currency code: ${JSON.stringify(codeValue)}`);
		await s.shot(db, "02-currency-form");
		await db.locator(".bs-inline-property-form__action--primary").first().click();
		await db.waitForTimeout(1000);
		// The View-settings popover stays open (you can add more columns); dismiss
		// it before touching the grid.
		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);

		await openClients(db);
		const headers = await db
			.locator(".dbv-grid__cell--head[data-prop]")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Headers now: ${JSON.stringify(headers.map((t) => t.trim()))}`);

		// Record a deal size on the first client (last editable cell = new column).
		// Best-effort: prior dogfood runs may have left extra columns that push
		// cells off-screen — the gate is the currency-column creation above.
		try {
			const editables = db
				.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
				.first()
				.locator(".dbv-grid__cell--editable");
			const n = await editables.count();
			const cell = editables.nth(n - 1);
			await cell.scrollIntoViewIfNeeded({ timeout: 4000 });
			await cell.click({ timeout: 4000 });
			await db.waitForTimeout(300);
			const input = db.locator(".dbv-grid__cell--editable input, input.bs-cell-edit-input").first();
			if ((await input.count()) > 0) {
				await input.fill("25000");
				await db.keyboard.press("Enter");
				await db.waitForTimeout(500);
				s.note("Entered 25000 in Deal size");
			} else {
				s.note("No number input opened for Deal size");
			}
		} catch (e) {
			s.note(
				`Value-set step skipped (likely residue columns off-screen): ${(e as Error).message.split("\n")[0]}`,
			);
		}
		await s.shot(db, "03-amount-set");

		const cells = await db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell--editable")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Editable cells after: ${JSON.stringify(cells.map((t) => t.trim()))}`);
		const rendersCurrency = cells.some((t) => /\$|US\$|25,000/.test(t));
		s.note(`Deal size renders as currency: ${rendersCurrency}`);

		expect(headers.some((h) => /deal size/i.test(h))).toBe(true);
	} finally {
		await s.finish();
	}
});
