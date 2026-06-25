/**
 * Session 249 — real-shell verification that the Files inspector's Properties
 * tab populates (the "Properties tab renders 0 rows" finding; the fix enumerates
 * an entity's properties via `customPropertyRows`). Opens Files, selects an item,
 * opens the inspector, switches to Properties, and asserts ≥1 property row paints
 * in the live shell. The enumeration logic itself is unit-covered
 * (inspector-properties.test.tsx); this closes the real-render gap.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const ROW = '[data-testid="content-row"]';
const INSPECTOR = '[data-testid="inspector"]';

test("Files inspector Properties tab renders property rows", async () => {
	test.setTimeout(240_000);
	const s = await startSession("249-files-inspector-properties");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(2500);

		// Ensure the inspector pane is open.
		if ((await files.locator(INSPECTOR).count()) === 0) {
			await files
				.locator('[data-testid="toolbar-inspector"]')
				.click()
				.catch(() => undefined);
		}
		// Select the first item so the inspector binds to it.
		await files.locator(ROW).first().click({ timeout: 8000 });
		await files.waitForTimeout(800);
		await s.shot(files, "01-selected");

		// Switch to the Properties tab.
		await files
			.locator(
				`${INSPECTOR} .inspector__tab:has-text("Properties"), .inspector__tab:has-text("Properties")`,
			)
			.first()
			.click({ timeout: 8000 })
			.catch(() => undefined);
		await files.waitForTimeout(800);
		await s.shot(files, "02-properties");

		const rows = await files.locator(".bs-props__row-label").count();
		s.note(`property rows rendered: ${rows}`);
		expect(rows, "Properties tab is not empty (0-rows finding fixed)").toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
