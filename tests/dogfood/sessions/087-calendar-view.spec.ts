/**
 * Session 087 — Mira sees the editorial calendar on an actual calendar.
 *
 * Fitting capstone for the Content Calendar: a Database **Calendar** view with
 * the date-axis = Publish date, so the issues land on their ship dates in a
 * month grid. Completes the Database view-type coverage (grid / board 083 /
 * gallery 086 / calendar here). The date-axis picker shares `propertyOptions()`,
 * so it's another F-036 site.
 *
 * No app-source change → SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("view the Content Calendar as a calendar", async () => {
	test.setTimeout(180_000);
	const s = await startSession("087-calendar-view");
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
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click();
		await db.waitForTimeout(800);

		// Reuse the extra view (083 created one), else add it.
		const customTabs = db.locator(".db-tab:not(.db-tab--add)");
		if ((await customTabs.count()) <= 1) {
			await db.locator(".db-tab--add").first().click();
			await db.waitForTimeout(700);
		} else {
			await customTabs.last().click();
			await db.waitForTimeout(600);
		}

		await db.locator("#toolbar-settings").first().click();
		await db.waitForTimeout(500);
		await db
			.locator(".db-popover__segment", { hasText: /^Calendar$/ })
			.first()
			.click();
		await db.waitForTimeout(600);

		// Date-axis "Place on" — pick the first custom (prop_*) property, which is
		// Publish date (added before Status). Picker shows cryptic keys (F-036).
		const placeOn = db.locator('select[aria-label="Place on"]').first();
		await expect(placeOn, "the date-axis picker appeared").toBeVisible();
		const opts = await placeOn
			.locator("option")
			.evaluateAll((os) =>
				(os as HTMLOptionElement[]).map((o) => [o.value, (o.textContent ?? "").trim()]),
			);
		s.note(`date-axis options: ${JSON.stringify(opts)}`);
		const dateProp = opts.find(([v]) => v.startsWith("prop_"));
		if (dateProp) {
			await placeOn.selectOption(dateProp[0]);
			s.note(`date-axis set to ${dateProp[1]} (${dateProp[0]})`);
		}
		await db.waitForTimeout(600);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);
		await closeInspectorIfOpen();
		await s.shot(db, "01-calendar");

		await expect(db.locator(".dbv-calendar").first(), "the calendar view rendered").toBeVisible();
		// The month grid is present (toolbar + a title).
		await expect(db.locator(".dbv-cal__title").first(), "calendar has a month title").toBeVisible();
		const chips = await db.locator(".dbv-calendar .dbv-card, .dbv-calendar [data-entity-id]").count();
		s.note(`issue chips visible on the calendar (current month): ${chips}`);
	} finally {
		await s.finish();
	}
});
