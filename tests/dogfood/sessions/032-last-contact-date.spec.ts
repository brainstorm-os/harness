/**
 * Session 032 — real CRM work: Mira adds a "Last contact" DATE column to Clients
 * and records when she last spoke to a client. Exercises the date cell (calendar
 * popover + natural-language input) — a different surface than Select/number.
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

test("add a Last contact date column and set a date", async () => {
	test.setTimeout(180_000);
	const s = await startSession("032-last-contact-date");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await openClients(db);

		// Add a Date column "Last contact".
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
		await db.locator(".bs-inline-property-form__name").fill("Last contact");
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Date$/ })
			.first()
			.click();
		await db.locator(".bs-inline-property-form__action--primary").first().click();
		await db.waitForTimeout(900);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);
		await openClients(db);

		const headers = await db
			.locator(".dbv-grid__cell--head[data-prop]")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Headers: ${JSON.stringify(headers.map((t) => t.trim()))}`);

		// Set a date on the first client (last editable cell = Last contact).
		const editables = db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.locator(".dbv-grid__cell--editable");
		const n = await editables.count();
		const dateCell = editables.nth(n - 1);
		await dateCell.scrollIntoViewIfNeeded().catch(() => undefined);
		await dateCell.click();
		await db.waitForTimeout(400);
		const popInput = db.locator(".bs-cell-pop-input, .bs-cell-plain-input, .bs-cell-input").first();
		s.note(`Date editor opened: ${(await popInput.count()) > 0}`);
		if ((await popInput.count()) > 0) {
			await popInput.fill("2026-06-15");
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
			s.note("Entered 2026-06-15");
		}
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(300);
		await s.shot(db, "01-date-set");

		const rendered = (await dateCell.innerText().catch(() => "")) ?? "";
		s.note(`Last contact cell renders: ${JSON.stringify(rendered.replace(/\s+/g, " ").trim())}`);
		const hasDate = /2026|Jun|15/.test(rendered);
		s.note(`Shows the date: ${hasDate}`);

		expect(headers.some((h) => /last contact/i.test(h))).toBe(true);
	} finally {
		await s.finish();
	}
});
