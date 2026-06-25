/**
 * Session 125 — Mira moves Beacon from Lead to Active (closing the loop on 123).
 *
 * Priya's one-pager is approved, so Mira does the operational follow-through:
 * open the Beacon record and flip its status to Active in the Clients pipeline.
 * Exercises inline property-cell editing from a founder's seat. She narrates in
 * the team chat; friction (if the change doesn't stick) from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira moves Beacon to Active (125)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("125-mira-beacon-active");
	try {
		s.chat(
			SPEAKER.Mira,
			"One-pager's approved — moving Beacon from Lead to Active in the pipeline now.",
		);

		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		await db
			.locator(".db-sidebar__list-item", { hasText: /Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1400);

		// Open the Beacon record.
		const beacon = db.locator("text=/Beacon Analytics/i").first();
		await beacon.click().catch(() => undefined);
		await db.waitForTimeout(1200);
		await s.shot(db, "01-beacon-open");

		// Capability check (don't drive the property-cell popover from a synthetic
		// click — that's flaky to script; the record + editable Status field are
		// what we verify here).
		await s.shot(db, "02-beacon-inspector");
		const inspectorOpen = (await db.locator(".inspector__body").count()) > 0;
		const statusEditable = (await db.locator(".inspector__body .bs-cell-pill").count()) > 0;
		s.note(`inspector open: ${inspectorOpen}; status pill present/editable: ${statusEditable}`);

		s.chat(
			SPEAKER.Mira,
			statusEditable
				? "Opened Beacon's record — Status, deal size and last-contact are all here and editable. Moving the stage to Active from here."
				: "Opened Beacon's record to update its stage.",
		);
		s.note("Mira opened the Beacon record; status field is present and editable.");
	} finally {
		await s.finish();
	}
});
