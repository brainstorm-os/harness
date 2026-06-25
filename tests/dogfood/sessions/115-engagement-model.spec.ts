/**
 * Session 115 — modelling an advisory engagement (Hours + a client link).
 *
 * Session 111 found Northbound has no engagement model: a deal is a flat
 * {Status, Deal size} with no hours and no link to its client/notes. Two new
 * primitives just shipped to close that (DT-3): a **Duration** number format
 * (a column of *Hours*, B5.12) and a **Relation** property kind (link a row to
 * its notes, B5.13). Mira puts them to work — she opens a collection's column
 * constructor and tries to add an "Hours" column and a "Research notes" link.
 *
 * The test isn't a hard assertion — it's "does the app now LET her model this,
 * and is it discoverable?" Captures the property-constructor tiles (does
 * "Relation" appear? does Number offer "Duration"?) and any friction. Gaps land
 * in the friction log, read back after.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("model an engagement: Hours + a client link (115)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("115-engagement-model");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// 1. Land on a real collection (Clients is the CRM Mira built).
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(800);
		await s.shot(db, "01-clients-grid");
		const columns = (
			await db
				.locator(".dbv-grid__cell--head, [class*='grid__head'], [class*='column-head']")
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`Clients columns at rest: ${JSON.stringify(columns.slice(0, 20))}`);

		// 2. Open View settings → the column-adder → "Create new property".
		await db
			.locator("#toolbar-settings")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(600);
		await s.shot(db, "02-view-settings");
		// The "Add column" affordance, then "Create new property".
		await db
			.getByText(/Add column|Add a column|New column/i)
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(400);
		await s.shot(db, "03-add-column-picker");
		await db
			.getByText(/Create new property|Create new|New property/i)
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(500);

		// 3. The property constructor — capture which KIND tiles are offered.
		//    This is the core validation: "Relation" should now be present.
		await s.shot(db, "04-property-constructor");
		const kindTiles = (await db.locator(".bs-inline-property-form__tile").allInnerTexts())
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`Property-constructor KIND tiles offered: ${JSON.stringify(kindTiles)}`);
		s.note(
			`Relation tile present? ${kindTiles.some((t) => /relation/i.test(t))} · ` +
				`File tile present? ${kindTiles.some((t) => /file/i.test(t))}`,
		);

		// 4. Pick Number → does it now offer a "Duration" (Hours) format?
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Number$/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(350);
		await s.shot(db, "05-number-formats");
		const numberFormats = (await db.locator(".bs-inline-property-form__tile").allInnerTexts())
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`After picking Number, format tiles: ${JSON.stringify(numberFormats)}`);
		s.note(`Duration (Hours) format present? ${numberFormats.some((t) => /duration/i.test(t))}`);

		// 5. Name it "Hours", pick Duration, and create the column.
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Duration$/i })
			.first()
			.click()
			.catch(() => undefined);
		await db
			.locator(".bs-inline-property-form__name, input[type='text']")
			.first()
			.fill("Hours")
			.catch(() => undefined);
		await db.waitForTimeout(200);
		await s.shot(db, "06-hours-ready");
		await db
			.getByRole("button", { name: /^Create$/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);
		await s.shot(db, "07-after-hours-column");
		const afterHours = (
			await db
				.locator(".dbv-grid__cell--head, [class*='grid__head'], [class*='column-head']")
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`Columns after adding Hours: ${JSON.stringify(afterHours.slice(0, 20))}`);

		// 6. Add a Relation column — "Research notes" linking to her notes.
		await db
			.locator("#toolbar-settings")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(500);
		await db
			.getByText(/Add column|Add a column|New column/i)
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(350);
		await db
			.getByText(/Create new property|Create new|New property/i)
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(450);
		await db
			.locator(".bs-inline-property-form__tile", { hasText: /^Relation$/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(250);
		await s.shot(db, "08-relation-selected");
		// Multi toggle should be available for Relation (link many notes).
		const multiToggle = await db
			.locator(".bs-inline-property-form__multi")
			.count()
			.catch(() => 0);
		s.note(`Relation: "Allow multiple values" toggle present? ${multiToggle > 0}`);
		await db
			.locator(".bs-inline-property-form__name, input[type='text']")
			.first()
			.fill("Research notes")
			.catch(() => undefined);
		await s.shot(db, "09-relation-ready");
		await db
			.getByRole("button", { name: /^Create$/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);
		await s.shot(db, "10-after-relation-column");
		const afterRelation = (
			await db
				.locator(".dbv-grid__cell--head, [class*='grid__head'], [class*='column-head']")
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(
			`Columns after adding Research-notes relation: ${JSON.stringify(afterRelation.slice(0, 20))}`,
		);

		s.note(
			"goal: an engagement row can now carry Hours (Duration) + link to its notes (Relation). " +
				"Captured the constructor tiles + the resulting columns for gap analysis.",
		);
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
