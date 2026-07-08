/**
 * Session 229 — probe for the Contacts page rework (9.23.6): the contact
 * detail is now the standard entity page (hero + inline shared property
 * cells + universal-body editor), the sidebar search is the shared
 * `.bs-searchbar`, list rows carry an inline inset, and the right
 * properties panel starts CLOSED.
 *
 * Verifies interactively what the 228 deep spec (written against the old
 * layout) could not: inline property editing on the page, typing into the
 * body editor and re-reading it after navigating away and back (the Y.Doc
 * replica is released on unmount and re-resolved on select), search through
 * the shared bar, and the closed-by-default inspector.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const TAG = `E${Date.now().toString().slice(-6)}`;
const NAME = `Page Probe ${TAG}`;
const BODY_LINE = `Met about the pilot rollout ${TAG}`;

test("contacts page rework probe (229)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("229-contacts-page-probe");
	try {
		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);

		// Right properties panel must start CLOSED.
		const propsOpen = await c.locator(".bs-props--open").count();
		s.note(
			`[${propsOpen === 0 ? "PASS" : "FAIL"}] right panel closed on launch (open=${propsOpen})`,
		);

		// Ensure the sidebar is open (persisted vault state may have hidden it).
		const sidebarHidden = await c.locator(".contacts__sidebar[aria-hidden='true']").count();
		if (sidebarHidden > 0) {
			await c
				.locator("[aria-label='Show contact list']")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(600);
		}
		const searchbar = await c.locator(".contacts-list__search .bs-searchbar").count();
		s.note(`[${searchbar > 0 ? "PASS" : "FAIL"}] shared .bs-searchbar present (${searchbar})`);
		await s.shot(c, "01-sidebar");

		// Create a contact via compose.
		await c.locator("[data-testid='contacts-new']").first().click();
		await c.waitForTimeout(600);
		await c.locator(".contacts-compose input").first().fill(NAME);
		await c.getByRole("button", { name: "Create contact" }).click();
		await c.waitForTimeout(1200);
		const title = await c
			.locator(".contacts-detail__name-input")
			.inputValue()
			.catch(() => "");
		s.note(`[${title === NAME ? "PASS" : "FAIL"}] detail page open, name="${title}"`);

		// Inline property edit: role via the page's inline block.
		const roleCell = c
			.locator(".contacts-detail__properties .bs-props__row[data-property-key='role']")
			.first();
		await roleCell.click().catch(() => undefined);
		await c.waitForTimeout(400);
		await c.keyboard.type("Advisor");
		await c.keyboard.press("Enter");
		await c.waitForTimeout(800);
		const subtitle =
			(await c
				.locator(".contacts-detail__subtitle")
				.textContent()
				.catch(() => "")) ?? "";
		s.note(
			`[${subtitle.includes("Advisor") ? "PASS" : "FAIL"}] inline role edit → subtitle="${subtitle}"`,
		);

		// Body editor: type a line, confirm it renders.
		const editor = c.locator(".contacts-detail__editor").first();
		const editorCount = await editor.count();
		s.note(`[${editorCount > 0 ? "PASS" : "FAIL"}] body editor mounted (${editorCount})`);
		await editor.click().catch(() => undefined);
		await c.keyboard.type(BODY_LINE);
		await c.waitForTimeout(1500);
		const bodyText = (await editor.textContent().catch(() => "")) ?? "";
		s.note(`[${bodyText.includes(BODY_LINE) ? "PASS" : "FAIL"}] body editor accepts text`);
		await s.shot(c, "02-page-with-body");

		// Navigate away (Back to the list) and re-select — the replica is
		// released on unmount, so the re-open proves the body round-trips
		// through the persisted Y.Doc, not a still-mounted editor.
		await c.locator("[data-testid='nav-back']").first().click();
		await c.waitForTimeout(1000);
		await c
			.locator(`.contacts-row:has(.contacts-row__name:has-text("${NAME}"))`)
			.first()
			.click();
		await c.waitForTimeout(2000);
		const reBody =
			(await c
				.locator(".contacts-detail__editor")
				.first()
				.textContent()
				.catch(() => "")) ?? "";
		s.note(
			`[${reBody.includes(BODY_LINE) ? "PASS" : "FAIL"}] body survives navigate-away-and-back`,
		);
		await s.shot(c, "03-reopened-contact");

		// Search through the shared bar.
		await c.locator(".bs-searchbar__input").first().fill(NAME);
		await c.waitForTimeout(600);
		const rows = await c.locator(".contacts-row:visible").count();
		s.note(`[${rows === 1 ? "PASS" : "FAIL"}] search filters to the probe contact (rows=${rows})`);
		await c.locator(".bs-searchbar__input").first().fill("");
		await c.waitForTimeout(400);

		// Cleanup: delete the probe contact through the header ⋯ → Delete.
		await c
			.locator(".bs-object-menu__more")
			.last()
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(500);
		await c
			.locator("[role='menuitem']")
			.filter({ hasText: /delete/i })
			.first()
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(500);
		await c
			.getByRole("button", { name: "Delete", exact: true })
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(800);
		const residue = await c.locator(`.contacts-row:has-text("${TAG}")`).count();
		s.note(`[${residue === 0 ? "PASS" : "FAIL"}] cleanup — probe contact deleted (residue=${residue})`);
		await s.shot(c, "04-after-cleanup");
	} finally {
		await s.finish();
	}
});
