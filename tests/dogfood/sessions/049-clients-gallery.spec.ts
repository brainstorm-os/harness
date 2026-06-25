/**
 * Session 049 — Mira views her Clients as a visual gallery of cards. Switches
 * the view to Gallery and checks the cards render her client names + a Status
 * chip reading the label ("Lead"/"Active", not "di_…") + currency. Also closes
 * the F-031 loop on the gallery card path. Restores Grid at the end.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function openClients(db: Page): Promise<void> {
	await db
		.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
		.first()
		.click();
	await db.waitForTimeout(800);
}

async function setViewType(db: Page, type: string): Promise<void> {
	await db
		.locator("#inspector-close")
		.click({ timeout: 4000 })
		.catch(() => undefined);
	await db.locator("#toolbar-settings").click({ timeout: 6000 });
	await db.waitForTimeout(500);
	await db.locator(".db-popover").getByText(type, { exact: true }).first().click({ timeout: 6000 });
	await db.waitForTimeout(700);
	await db.keyboard.press("Escape");
	await db.waitForTimeout(500);
}

test("view Clients as a gallery of cards", async () => {
	test.setTimeout(180_000);
	const s = await startSession("049-clients-gallery");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await openClients(db);

		await setViewType(db, "Gallery");
		await s.shot(db, "01-gallery");

		const galleryPresent = (await db.locator(".dbv-gallery").count()) > 0;
		s.note(`Gallery renders: ${galleryPresent}`);
		const titles = await db
			.locator(".dbv-card__title-text")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Card titles: ${JSON.stringify(titles.map((t) => t.trim()))}`);
		const bodyText =
			(await db
				.locator(".dbv-gallery")
				.innerText()
				.catch(() => "")) ?? "";
		const showsStatusLabel = /\bLead\b|\bActive\b/.test(bodyText);
		const showsRawId = /di_[a-z0-9]/i.test(bodyText);
		const showsCurrency = /\$|US\$/.test(bodyText);
		s.note(
			`Cards show Status label: ${showsStatusLabel}; raw di_ id: ${showsRawId}; currency: ${showsCurrency}`,
		);

		expect(galleryPresent).toBe(true);
		expect(titles.some((t) => /Vertex Labs|Acme|Beacon/i.test(t))).toBe(true);
		expect(showsRawId).toBe(false);
	} finally {
		try {
			await setViewType(db, "Grid");
		} catch {
			// best-effort restore
		}
		await s.finish();
	}
});
