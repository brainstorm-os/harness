/**
 * Session 018 — real work, no blocker. With inline rename shipped (F-014), Mira
 * fleshes out her Clients CRM the way a founder actually would: name the two
 * remaining placeholder clients, then give the collection the columns a CRM
 * needs (a "Status" property). A work session, not a fix-probe — it reports
 * whatever friction the column-creation flow surfaces next.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function renameRowInline(
	db: import("@playwright/test").Page,
	rowIndex: number,
	name: string,
) {
	const title = db.locator(".dbv-grid__title-label--editable").nth(rowIndex);
	if ((await title.count()) === 0) return false;
	await title.dblclick();
	const input = db.locator(".dbv-grid__title-input");
	if ((await input.count()) === 0) return false;
	await input.fill(name);
	await db.keyboard.press("Enter");
	await db.waitForTimeout(600);
	return true;
}

test("Mira fleshes out the Clients CRM — name clients, add a Status column", async () => {
	test.setTimeout(180_000);
	const s = await startSession("018-flesh-out-crm");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		// Name the placeholder clients. The first row may already be "Acme
		// Research Co." from session 017; fill in the still-Untitled ones.
		const wantNames = ["Acme Research Co.", "Beacon Analytics", "Vertex Labs"];
		for (let i = 0; i < wantNames.length; i++) {
			const labels = await db.locator(".dbv-grid__title-label--editable").allInnerTexts();
			const name = wantNames[i] ?? "";
			if ((labels[i] ?? "").trim() === name) continue;
			const ok = await renameRowInline(db, i, name).catch(() => false);
			s.note(`Rename row ${i} → "${name}": ${ok}`);
		}
		const afterNames = await db.locator(".dbv-grid__title-label--editable").allInnerTexts();
		s.note(`Client names: ${JSON.stringify(afterNames.map((t) => t.trim()))}`);
		await s.shot(db, "01-clients-named");

		// Give the CRM a "Status" column.
		await db.locator("#toolbar-settings").click();
		await db.waitForTimeout(600);
		await s.shot(db, "02-view-settings-open");
		const addColumn = db.locator('[data-testid="db-view-settings-add-column"]').first();
		s.note(`'Add column…' reachable: ${(await addColumn.count()) > 0}`);
		// If the settings popover overflows the viewport, Mira would have to
		// scroll to reach "Add column…". Record whether that's needed (friction
		// signal) vs the button sitting in view.
		const inView = await addColumn
			.evaluate((el) => {
				const r = el.getBoundingClientRect();
				return r.top >= 0 && r.bottom <= window.innerHeight;
			})
			.catch(() => null);
		s.note(`'Add column…' fully in viewport without scrolling: ${inView}`);
		await addColumn.scrollIntoViewIfNeeded().catch(() => undefined);
		await addColumn.click();
		await db.waitForTimeout(120);
		await db.waitForTimeout(300);
		await s.shot(db, "02a-add-column-menu");
		// Fancy menu items are listbox options (`role="option"`), not menuitems.
		const menuItems = await db
			.locator('.fm-menu [role="option"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Add-column options: ${JSON.stringify(menuItems.map((t) => t.trim()))}`);
		const createNew = db
			.locator('.fm-menu [role="option"]', { hasText: /Create new property/ })
			.first();
		s.note(`'Create new property' option present: ${(await createNew.count()) > 0}`);
		await createNew.click();
		await db.waitForTimeout(500);
		await s.shot(db, "02b-property-form");

		const nameInput = db.locator(".bs-inline-property-form__name");
		s.note(`Property form opened: ${(await nameInput.count()) > 0}`);
		await nameInput.fill("Status");
		// Pick the "Select" kind tile so Status reads as a colored chip.
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Select$/ })
			.first()
			.click();
		await db.locator(".bs-inline-property-form__action--primary").first().click();
		await db.waitForTimeout(1200);
		await s.shot(db, "03-status-column-added");

		const headers = await db
			.locator(".dbv-grid__cell--head")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Column headers after add: ${JSON.stringify(headers.map((t) => t.trim()))}`);
		const hasStatus = headers.some((h) => /status/i.test(h));
		s.note(`Status column present: ${hasStatus}`);

		// Soft assert: the clients are named (the unblocked baseline). The
		// column-add outcome is reported either way for triage.
		expect(afterNames.filter((t) => t.trim() && t.trim() !== "Untitled").length).toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
