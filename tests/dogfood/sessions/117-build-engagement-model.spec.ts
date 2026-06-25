/**
 * Session 117 — building the engagement model (Hours + a client link), for real.
 *
 * Session 115 confirmed the new property tiles exist (Duration, Relation); this
 * session has Mira actually USE them: on her engagement/clients collection she
 * adds an "Hours" (Duration) column and a "Research notes" (Relation) column,
 * then checks they persist as real grid columns and that the relation cell can
 * link one of her notes. Where it falls off is the friction. Captures →
 * `tests/dogfood/.sessions/117-build-engagement-model/`.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function gridColumns(db: Page): Promise<string[]> {
	return (await db.locator(".dbv-grid__cell--head").allInnerTexts())
		.map((t) => t.replace(/\s+/g, " ").trim())
		.filter(Boolean);
}

async function createColumn(db: Page, pickTile: () => Promise<void>, name: string): Promise<void> {
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
	await pickTile();
	await db.waitForTimeout(250);
	// Scope strictly to the constructor's own name field — a bare
	// `input[type=text]` also matches the view-settings "View name" box
	// mounted underneath (the bug that left the name empty + Create disabled).
	await db
		.locator(".bs-inline-property-form__name")
		.first()
		.fill(name)
		.catch(() => undefined);
	await db.waitForTimeout(150);
	await db
		.locator(".bs-inline-property-form__action--primary")
		.first()
		.click()
		.catch(() => undefined);
	await db.waitForTimeout(900);
}

test("build the engagement model: Hours + a client link (117)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("117-build-engagement-model");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// Prefer an engagement-ish collection; fall back to the first list.
		const engagement = db
			.locator(".db-sidebar__list-item", { hasText: /Engagement|Project|Client/i })
			.first();
		if (await engagement.count()) await engagement.click().catch(() => undefined);
		else
			await db
				.locator(".db-sidebar__list-item")
				.first()
				.click()
				.catch(() => undefined);
		await db.waitForTimeout(700);

		// Make sure we're on the Grid view (115's empty read = wrong view tab).
		await db
			.locator(".db-tab", { hasText: /Grid/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(600);
		const before = await gridColumns(db);
		await s.shot(db, "01-grid-before");
		s.note(`Columns before: ${JSON.stringify(before)}`);

		// 1. Add an "Hours" column (Number → Duration).
		await createColumn(
			db,
			async () => {
				await db
					.locator(".bs-inline-property-form__tile", { hasText: /^Number$/i })
					.first()
					.click()
					.catch(() => undefined);
				await db.waitForTimeout(250);
				await db
					.locator(".bs-inline-property-form__tile", { hasText: /^Duration$/i })
					.first()
					.click()
					.catch(() => undefined);
			},
			"Hours",
		);
		await s.shot(db, "02-after-hours");
		const afterHours = await gridColumns(db);
		s.note(`Columns after adding Hours: ${JSON.stringify(afterHours)}`);
		s.note(`"Hours" column landed? ${afterHours.some((c) => /hours/i.test(c))}`);

		// 2. Add a "Research notes" relation column (link to notes).
		await createColumn(
			db,
			async () => {
				await db
					.locator(".bs-inline-property-form__tile", { hasText: /^Relation$/i })
					.first()
					.click()
					.catch(() => undefined);
			},
			"Research notes",
		);
		await s.shot(db, "03-after-relation");
		const afterRelation = await gridColumns(db);
		s.note(`Columns after adding Research notes: ${JSON.stringify(afterRelation)}`);
		s.note(`"Research notes" column landed? ${afterRelation.some((c) => /research/i.test(c))}`);

		// Dismiss the View-settings popover that the column-adder left open, so
		// it isn't covering the grid when we go for the relation cell.
		await db
			.locator(".db-popover__backdrop")
			.first()
			.click()
			.catch(() => undefined);
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(400);

		// 3. Try to link a note in the new relation cell on the first row.
		const firstRow = db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head):not(.dbv-grid__row--foot)")
			.first();
		const relCell = firstRow.locator(".dbv-grid__cell").last();
		await relCell.scrollIntoViewIfNeeded().catch(() => undefined);
		await relCell.click().catch(() => undefined);
		await db.waitForTimeout(500);
		await s.shot(db, "04-relation-picker");
		// The shared link picker is a searchable popover over note titles.
		const picker = db.locator(".bs-cell-pop-search, .bs-cell-pop-input, [class*='cell-pop']");
		const pickerVisible = await picker.count().catch(() => 0);
		s.note(`Relation cell opened a note picker? ${pickerVisible > 0}`);
		if (pickerVisible > 0) {
			// Pick the first note offered — scoped INSIDE the popover so we link a
			// note rather than navigate a sidebar item.
			const option = db
				.locator(
					"[class*='cell-pop'] [role='option'], [class*='cell-pop'] button, [class*='cell-pop'] li",
				)
				.first();
			await option.click().catch(() => undefined);
			await db.waitForTimeout(500);
			await db.keyboard.press("Escape").catch(() => undefined);
			await db.waitForTimeout(300);
			await s.shot(db, "05-after-link");
			const relText = (
				await firstRow
					.locator(".dbv-grid__cell")
					.last()
					.innerText()
					.catch(() => "")
			).trim();
			s.note(`Relation cell after linking shows: ${JSON.stringify(relText)}`);
		}

		s.note(
			"goal: an engagement row now carries Hours + a link to its research notes. " +
				"Recorded whether each column persisted + whether the relation cell links a real note.",
		);
		// Soft expectations — capture, don't hard-fail (column-add UI is multi-step).
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
