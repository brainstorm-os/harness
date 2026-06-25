/**
 * Session 086 — Mira views her Clients as a gallery.
 *
 * A visual roster: she adds a Gallery view to the Clients CRM so each lead is a
 * card. Completes the Database view-type coverage (grid / board 083 / gallery
 * here). Also peeks at the gallery Cover/Subtitle pickers — which share the
 * same `propertyOptions()` as the board group-by, so they should show the same
 * cryptic property keys (F-036 reinforcement).
 *
 * No app-source change → SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("view the Clients CRM as a gallery", async () => {
	test.setTimeout(180_000);
	const s = await startSession("086-clients-gallery");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		const closeInspectorIfOpen = async (): Promise<void> => {
			if ((await db.locator('.db-main[data-inspector-open="true"]').count()) === 0) return;
			await db.locator("#header-btn-inspector").first().click();
			await db.waitForTimeout(300);
		};
		await closeInspectorIfOpen();

		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Clients/i })
			.first()
			.click();
		await db.waitForTimeout(800);

		const customTabs = db.locator(".db-tab:not(.db-tab--add)");
		if ((await customTabs.count()) <= 1) {
			await db.locator(".db-tab--add").first().click();
			await db.waitForTimeout(700);
			s.note("added a new view to Clients");
		} else {
			await customTabs.last().click();
			await db.waitForTimeout(600);
			s.note("reusing the existing extra view");
		}

		await db.locator("#toolbar-settings").first().click();
		await db.waitForTimeout(500);
		await db
			.locator(".db-popover__segment", { hasText: /^Gallery$/ })
			.first()
			.click();
		await db.waitForTimeout(600);

		// F-036 check: the gallery Cover/Subtitle pickers share propertyOptions().
		const coverSelect = db.locator('select[aria-label="Cover"]').first();
		if ((await coverSelect.count()) > 0) {
			const labels = await coverSelect
				.locator("option")
				.evaluateAll((os) => (os as HTMLOptionElement[]).map((o) => (o.textContent ?? "").trim()));
			s.note(`gallery Cover picker options: ${JSON.stringify(labels)}`);
			const cryptic = labels.some((l) => /^Prop [a-z0-9]/i.test(l));
			s.note(`cover picker shows cryptic property keys (F-036): ${cryptic}`);
		}

		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);
		await closeInspectorIfOpen();
		await s.shot(db, "01-gallery");

		await expect(db.locator(".dbv-gallery").first(), "the gallery view rendered").toBeVisible();
		const cards = await db.locator(".dbv-gallery .dbv-card[data-entity-id]").count();
		s.note(`gallery cards: ${cards}`);
		expect(cards, "the clients show as gallery cards").toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
