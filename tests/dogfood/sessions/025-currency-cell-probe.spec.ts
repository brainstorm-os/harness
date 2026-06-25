/**
 * Session 025 — definitive probe of the number/currency cell: what editor opens
 * on click, whether a fresh amount commits, and whether it renders with the
 * currency symbol. Also re-checks editing an already-formatted value.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe: enter + render a currency amount", async () => {
	test.setTimeout(180_000);
	const s = await startSession("025-currency-cell-probe");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		const cell = db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.locator(".dbv-grid__cell--editable")
			.nth(1); // first Deal-size column (Status is 0)
		await cell.scrollIntoViewIfNeeded().catch(() => undefined);
		await cell.click();
		await db.waitForTimeout(400);
		const opened = await db.evaluate(() => {
			const el = document.activeElement as HTMLInputElement | null;
			const anyInput = document.querySelector<HTMLInputElement>(
				".bs-cell-plain-input, .bs-cell-input, .dbv-grid__cell--editable input",
			);
			return {
				activeClass: el?.className ?? null,
				activeType: el?.getAttribute?.("type") ?? null,
				anyInputClass: anyInput?.className ?? null,
				anyInputType: anyInput?.getAttribute("type") ?? null,
			};
		});
		s.note(`On click: ${JSON.stringify(opened)}`);

		const input = db.locator(".bs-cell-plain-input, .bs-cell-input").first();
		if ((await input.count()) > 0) {
			await input.fill("25000");
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
			s.note("Committed 25000");
		} else {
			s.note("No editor input found");
		}
		await s.shot(db, "01-after-commit");

		const display = (await cell.innerText().catch(() => "")) ?? "";
		s.note(`Cell renders: ${JSON.stringify(display.replace(/\s+/g, " ").trim())}`);
		s.note(`Has currency symbol: ${/\$|US\$/.test(display)}`);

		// Re-edit: click again, capture what the input pre-fills with (the known
		// type=number + formatted-display hazard).
		await cell.click();
		await db.waitForTimeout(300);
		const reEdit = await db.evaluate(() => {
			const i = document.querySelector<HTMLInputElement>(".bs-cell-plain-input, .bs-cell-input");
			return { value: i?.value ?? null, type: i?.getAttribute("type") ?? null };
		});
		s.note(`Re-edit input prefill: ${JSON.stringify(reEdit)}`);
		await db.keyboard.press("Escape");

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
