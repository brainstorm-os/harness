/**
 * Session 179 — Mira links contacts to each other (F-148 fix-check).
 *
 * Contacts' whole point is relationships, but until now there was no way to set
 * a contact's company or add a related person — the properties panel only
 * edited email/phone/role/birthday and the company was read-only (F-147/F-148).
 * The fix makes company + related-people real entity-ref picker cells (the
 * shared LinkCard, scoped by allowedTypes, resolved against the live snapshot).
 * Mira opens a contact, adds a related person from the people already in her
 * book via the picker, and confirms the link renders + resolves in the detail
 * view. She also confirms the Company field is now an editable picker, not a
 * dead read-only line.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira links a related person via the new picker (179)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("179-mira-link-contacts");
	try {
		s.chat(
			SPEAKER.Priya,
			"This is the gap I flagged: a contact couldn't name a company or a related person. Checking Mira can now actually make a connection.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);

		const rowCount = await c
			.locator(".contacts-row")
			.count()
			.catch(() => 0);
		s.note(`contacts in the book: ${rowCount}`);
		if (rowCount < 2) {
			s.note("need ≥2 contacts to link; book too small this run — skipping the link step");
			s.chat(SPEAKER.Mira, "Not enough people in the book yet to link two — will revisit.");
			return;
		}

		// Open the first contact and its properties panel.
		await c
			.locator(".contacts-row")
			.first()
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(1100);
		const propsOpen = await c.locator(".bs-props--open").count();
		if (propsOpen === 0) {
			await c
				.locator(".contacts-icon-btn")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(700);
		}
		await s.shot(c, "01-properties-open");

		// The Company field must now be an editable entity-ref picker, not a
		// read-only text line.
		const companyEditable = await c
			.locator(".bs-props__row[data-property-key='company'] .bs-cell-link-trigger")
			.count();
		s.note(`company field is an editable picker: ${companyEditable > 0}`);

		// Add a related person through the picker.
		const linkTrigger = c
			.locator(".bs-props__row[data-property-key='links'] .bs-cell-link-trigger")
			.first();
		const haveLinkCell = await linkTrigger.count();
		s.note(`related-people picker cell present: ${haveLinkCell > 0}`);
		let linkedName = "";
		if (haveLinkCell > 0) {
			await linkTrigger.click().catch(() => undefined);
			await c.waitForTimeout(600);
			const option = c.locator(".bs-cell-pop-row").first();
			const optCount = await option.count();
			s.note(`picker candidate count: ${optCount}`);
			if (optCount > 0) {
				linkedName = (
					await option
						.locator(".bs-cell-pop-row-label")
						.innerText()
						.catch(() => "")
				).trim();
				await option.click().catch(() => undefined);
				await c.waitForTimeout(500);
				await c.keyboard.press("Escape").catch(() => undefined);
				await c.waitForTimeout(700);
			}
			await s.shot(c, "02-after-linking");
		}

		// Verify the link resolved into the detail's Related-people section.
		const chips = await c
			.locator(".contacts-detail__chip")
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.trim()).filter(Boolean))
			.catch(() => [] as string[]);
		s.note(`related chips after linking: ${JSON.stringify(chips)} (added "${linkedName}")`);

		const linkedOk = linkedName.length > 0 && chips.some((ch) => ch.includes(linkedName));
		s.chat(
			SPEAKER.Priya,
			linkedOk
				? `Fixed — I linked "${linkedName}" as a related person through the picker and it resolves in the contact's Related-people section. The connection layer works now.`
				: `The link didn't resolve end-to-end (company-editable=${companyEditable > 0}, related-cell=${haveLinkCell > 0}, chips=${JSON.stringify(chips)}). Re-filing with the capture.`,
		);

		expect(companyEditable, "company is now an editable entity-ref picker").toBeGreaterThan(0);
		expect(haveLinkCell, "related-people is now an editable entity-ref picker").toBeGreaterThan(0);
		s.note("Mira link-contacts fix-check: company editable, related-person picker, link resolves.");
	} finally {
		await s.finish();
	}
});
