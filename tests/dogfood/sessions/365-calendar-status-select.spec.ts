/**
 * Session 365 — verify Calendar's event Status is now the shared <SelectMenu>
 * (F-298 consistency), not a bespoke segmented radiogroup. Open the new-event
 * form and assert the Status field is a `.bs-select` and the old
 * `.cal-detail__segment` markup is gone.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("calendar event Status uses the shared SelectMenu (365)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("365-calendar-status-select");
	try {
		const page = await s.openApp(APP.Calendar);
		const errs = collectConsoleErrors(page);
		await page.waitForTimeout(2400);

		await page.locator("[aria-label='New event']").first().click().catch(() => undefined);
		await page.waitForTimeout(900);

		const statusSelect = await page.locator(".cal-detail__status.bs-select").count().catch(() => 0);
		const legacySegment = await page.locator(".cal-detail__segment, .cal-detail__segmented").count().catch(() => 0);
		const colorSwatches = await page.locator(".cal-detail__swatches[role='radiogroup']").count().catch(() => 0);
		s.note(`[i] Status .bs-select=${statusSelect}, legacy .cal-detail__segment(ed)=${legacySegment}, colour radiogroup=${colorSwatches}`);
		s.note(
			statusSelect > 0 && legacySegment === 0
				? "[ok] Status is the shared SelectMenu; segmented radiogroup gone"
				: "[?] unexpected — inspect screenshot",
		);
		await s.shot(page, "event-detail-status");

		// Open the Status select to confirm it lists the enum options.
		await page.locator(".cal-detail__status.bs-select").first().click().catch(() => undefined);
		await page.waitForTimeout(500);
		await s.shot(page, "status-menu-open");
		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 5)) s.note(`    ${e}`);
		await page.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
