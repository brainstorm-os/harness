/**
 * Session 212b — Mira finishes what 212 fumbled: the applicant rows (the
 * "+ New" she meant to press; the first try hit the "New view" tab — that
 * near-miss is itself logged as friction) and the interview event (Enter
 * didn't submit the dialog; Save event does).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira finishes the ops-hire paperwork (212b)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("212b-mira-hiring-fixup");
	try {
		// ---- Candidates rows -------------------------------------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/candidate/i")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1500);
		// The Grid tab so the new row composer is visible.
		await db
			.locator('[role="tab"]:has-text("Grid"), button:has-text("Grid")')
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(800);
		for (const name of ["Dana Okafor — Operations & Growth", "Felix Brandt — Growth Marketer"]) {
			const newBtn = db.getByRole("button", { name: "New", exact: true }).first();
			if (await newBtn.isVisible().catch(() => false)) {
				await newBtn.click().catch(() => undefined);
				await db.waitForTimeout(900);
				await db.keyboard.type(name, { delay: 20 });
				await db.keyboard.press("Enter");
				await db.waitForTimeout(1000);
				s.note(`row composer used for: ${name}`);
			} else {
				s.note(`exact-"New" button not found for ${name}`);
			}
		}
		await s.shot(db, "01-candidates-after-add");
		const rowCount = await db
			.locator("text=/^\\d+ rows$/")
			.first()
			.textContent()
			.catch(() => null);
		s.note(`candidates row count label: ${rowCount}`);

		// Set Dana's Status to Offer via the grid cell (value-side click).
		const danaRow = db.locator('[class*="row"]').filter({ hasText: "Dana Okafor" }).first();
		if (await danaRow.isVisible().catch(() => false)) {
			const statusCell = danaRow.locator('[class*="cell"]').nth(1);
			await statusCell.click().catch(() => undefined);
			await db.waitForTimeout(800);
			await s.shot(db, "02-status-cell-editor");
			const offer = db.locator('text="Offer"').last();
			if (await offer.isVisible().catch(() => false)) {
				await offer.click().catch(() => undefined);
				await db.waitForTimeout(900);
				s.note("set Dana status → Offer");
			} else {
				s.note("no Offer option surfaced from the status cell");
				await db.keyboard.press("Escape").catch(() => undefined);
			}
			await s.shot(db, "03-after-status");
		}

		// ---- Interview event, saved this time --------------------------------
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2500);
		const newEvent = cal
			.locator('.app-header [aria-label*="new" i], .app-header button:has-text("+")')
			.first();
		await newEvent.click().catch(() => undefined);
		await cal.waitForTimeout(1000);
		await cal.keyboard.type("Interview — Dana Okafor (Ops & Growth)", { delay: 15 });
		const save = cal.locator('button:has-text("Save event")').first();
		if (await save.isVisible().catch(() => false)) {
			await save.click().catch(() => undefined);
			await cal.waitForTimeout(1500);
			s.note("event saved via Save event");
		} else {
			s.note("no Save event button");
		}
		await s.shot(cal, "04-event-saved");

		s.chat(
			SPEAKER.Mira,
			"Paperwork done properly: Dana and Felix are on the pipeline, Dana's card sits on Offer, and the interview is on the calendar. Also filing the two paper cuts that made me do this twice.",
		);
	} finally {
		await s.finish();
	}
});
