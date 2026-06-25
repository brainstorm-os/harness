/**
 * Session 088 — verifying the F-036 fix: view-settings pickers show names.
 *
 * F-036 (found 083/086/087): the board group-by, gallery cover/subtitle, and
 * calendar/timeline date pickers labelled custom properties by their opaque key
 * ("Prop mpye0tff 8acd19") instead of the display name, because the shared
 * `propertyOptions()` used `humanize(key)`. The fix resolves names from the
 * catalog (`vaultProperties`), falling back to humanize only for built-ins.
 *
 * This session re-opens two of those pickers and asserts they now read as
 * proper names with NO cryptic "Prop …" entries:
 *   - Content Calendar → Calendar view → "Place on" date-axis
 *   - Clients → Gallery view → "Cover"
 *
 * Runs against a database bundle rebuilt with the fix (SKIP_BUILD install).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const CRYPTIC = /^Prop [a-z0-9]/i;

async function pickerOptions(
	db: import("@playwright/test").Page,
	ariaLabel: string,
): Promise<string[]> {
	const sel = db.locator(`select[aria-label="${ariaLabel}"]`).first();
	if ((await sel.count()) === 0) return [];
	return (await sel.locator("option").allInnerTexts()).map((t) => t.trim());
}

test("view-settings property pickers show names, not cryptic keys (F-036)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("088-property-names-fix");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		const closeInspectorIfOpen = async (): Promise<void> => {
			if ((await db.locator('.db-main[data-inspector-open="true"]').count()) === 0) return;
			await db.locator("#header-btn-inspector").first().click();
			await db.waitForTimeout(300);
		};
		const openExtraViewSettings = async (collection: RegExp): Promise<void> => {
			await closeInspectorIfOpen();
			await db.locator(".db-sidebar__list-item", { hasText: collection }).first().click();
			await db.waitForTimeout(700);
			await db.locator(".db-tab:not(.db-tab--add)").last().click();
			await db.waitForTimeout(500);
			await db.locator("#toolbar-settings").first().click();
			await db.waitForTimeout(500);
		};

		// Content Calendar → its extra view (Calendar after 087) → "Place on".
		await openExtraViewSettings(/Content Calendar/i);
		const placeOn = await pickerOptions(db, "Place on");
		s.note(`Calendar "Place on" options: ${JSON.stringify(placeOn)}`);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(300);

		// Clients → its extra view (Gallery after 086) → "Cover".
		await openExtraViewSettings(/^\s*Clients/i);
		const cover = await pickerOptions(db, "Cover");
		s.note(`Gallery "Cover" options: ${JSON.stringify(cover)}`);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(300);
		await s.shot(db, "01-clients-settings");

		// Neither picker should contain a cryptic "Prop …" label any more.
		const crypticPlaceOn = placeOn.filter((o) => CRYPTIC.test(o));
		const crypticCover = cover.filter((o) => CRYPTIC.test(o));
		s.note(
			`cryptic remaining — Place on: ${JSON.stringify(crypticPlaceOn)}, Cover: ${JSON.stringify(crypticCover)}`,
		);

		expect(placeOn.length, "the Place-on picker has options").toBeGreaterThan(0);
		expect(crypticPlaceOn, "no cryptic Prop-key labels in the date-axis picker").toEqual([]);
		expect(cover.length, "the Cover picker has options").toBeGreaterThan(0);
		expect(crypticCover, "no cryptic Prop-key labels in the gallery cover picker").toEqual([]);
		// And the real names are present.
		expect(
			placeOn.some((o) => /Publish date|Status/i.test(o)),
			"the date-axis picker shows the real property names",
		).toBe(true);
	} finally {
		await s.finish();
	}
});
