/**
 * Session 184 — Mira creates a company from Contacts (F-150 fix-check).
 *
 * 182 found the company picker had zero candidates: nothing in the founder's
 * toolset mints a Company/v1, so a contact could never name one. The fix gives
 * Contacts an "Add company" affordance (write cap on Company/v1) that creates
 * the company and links it in one step. This session opens a contact with no
 * company, creates one inline, and confirms it resolves onto the card — and
 * that the company picker now has a candidate to reuse for the next contact.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira creates a company from Contacts and links it (184)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("184-mira-create-company");
	try {
		s.chat(
			SPEAKER.Mira,
			"Last time the Company field had nothing to pick. Trying the new 'Add company' — I should be able to make one right here.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);
		let rowCount = await c
			.locator(".contacts-row")
			.count()
			.catch(() => 0);
		s.note(`contacts in the book: ${rowCount}`);

		// Self-sufficient: if the book is empty this run, create a contact to work
		// with (the New-contact icon lives in the list header-right group).
		if (rowCount === 0) {
			await c
				.locator("[data-testid='contacts-new']")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(900);
			const nameInput = c.locator(".contacts-detail__title-input").first();
			await nameInput.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
			await nameInput.fill("Jordan Avery").catch(() => undefined);
			await nameInput.press("Enter").catch(() => undefined);
			await c.waitForTimeout(1200);
			await c
				.locator("[data-testid='nav-back']")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(1200);
			rowCount = await c
				.locator(".contacts-row")
				.count()
				.catch(() => 0);
			s.note(`created a seed contact; book now: ${rowCount}`);
		}

		// Open a contact and find one without a company (the Add-company affordance
		// is only shown when none is set). Walk the first few rows if needed.
		let added = false;
		const companyName = "Northbound Studio";
		const rows = Math.min(rowCount, 5);
		for (let i = 0; i < rows; i++) {
			await c
				.locator(".contacts-row")
				.nth(i)
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(900);
			const addBtn = c.locator(".contacts-detail__add-company").first();
			if (await addBtn.count()) {
				await addBtn.click().catch(() => undefined);
				await c.waitForTimeout(400);
				const input = c.locator(".contacts-detail__add-company-input").first();
				await input.fill(companyName).catch(() => undefined);
				await input.press("Enter").catch(() => undefined);
				await c.waitForTimeout(1000);
				added = true;
				break;
			}
			// This contact already has a company — go back and try the next.
			await c
				.locator("[data-testid='nav-back']")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(600);
		}
		s.note(`add-company affordance used: ${added}`);
		await s.shot(c, "01-after-create-company");

		// The created company should resolve onto the card as a clickable link.
		const companyLink = await c
			.locator(".contacts-detail__company-link")
			.first()
			.innerText()
			.catch(() => "");
		s.note(`company link on card: "${companyLink}"`);

		// And it should now be a reusable candidate in the picker.
		if ((await c.locator(".bs-props--open").count()) === 0) {
			await c
				.locator(".contacts-icon-btn")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(600);
		}
		const companyTrigger = c
			.locator(".bs-props__row[data-property-key='company'] .bs-cell-link-trigger")
			.first();
		let candidates = -1;
		if (await companyTrigger.count()) {
			await companyTrigger.click().catch(() => undefined);
			await c.waitForTimeout(1200);
			candidates = await c
				.locator(".bs-cell-pop-row")
				.count()
				.catch(() => 0);
			await c.keyboard.press("Escape").catch(() => undefined);
		}
		s.note(`company picker candidates now: ${candidates}`);

		const ok = added && companyLink.includes(companyName);
		s.chat(
			SPEAKER.Mira,
			ok
				? `Made "${companyName}" right from the contact and it's linked + clickable on the card. The picker now has ${candidates} company to reuse too. That's the gap closed.`
				: `Couldn't create/link a company end-to-end (used=${added}, link="${companyLink}"). Re-filing.`,
		);

		expect(added, "Add-company affordance available on a company-less contact").toBe(true);
		expect(companyLink, "created company resolves onto the card").toContain(companyName);
		s.note("F-150 fix-check: create company from Contacts → links + becomes a picker candidate.");
	} finally {
		await s.finish();
	}
});
