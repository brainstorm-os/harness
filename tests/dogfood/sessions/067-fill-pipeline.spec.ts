/**
 * Session 067 — Mira fills the editorial pipeline.
 *
 * Session 066 gave the Content Calendar typed Publish-date + Status columns;
 * they're empty. Now Mira works the calendar like a real editor: she dates each
 * issue (a weekly cadence) and drops each into its pipeline lane —
 * Published → Scheduled → Drafting. This dogfoods inline grid CELL editing for
 * two value types end-to-end:
 *   - the Select cell: open → type a new lane → "Create" (the shared
 *     tag-cell create-on-the-fly path; each lane is a fresh dictionary option)
 *   - the Date cell: open → type an ISO date → Set
 *
 * All through the live grid cells (the same SDK cells the inspector + editor
 * blocks use). Idempotent: a row already dated + laned is left alone, so reruns
 * don't double-set or mint duplicate lane options.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Issue = { match: string; status: string; date: string };
const ISSUES: Issue[] = [
	{ match: "Issue #1", status: "Published", date: "2026-06-09" },
	{ match: "Issue #2", status: "Scheduled", date: "2026-06-16" },
	{ match: "Issue #3", status: "Drafting", date: "2026-06-23" },
];

test("date + lane every issue in the Content Calendar", async () => {
	test.setTimeout(180_000);
	const s = await startSession("067-fill-pipeline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// The Details inspector reopens whenever a row/cell is selected
		// (onSelectEntity forces inspectorOpen = true), and while open its glass
		// overlay intercepts clicks on the rightmost column. So it has to be
		// re-closed before each Status (rightmost-column) interaction — strong,
		// repeated F-023 evidence. Helper closes it iff open.
		const closeInspectorIfOpen = async (): Promise<boolean> => {
			if ((await db.locator('.db-main[data-inspector-open="true"]').count()) === 0) return false;
			await db.locator("#header-btn-inspector").first().click();
			await expect(db.locator('.db-main[data-inspector-open="true"]')).toHaveCount(0);
			await db.waitForTimeout(300);
			return true;
		};

		// Select the Content Calendar collection.
		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click();
		await db.waitForTimeout(900);

		if (await closeInspectorIfOpen()) {
			s.note("closed the Details inspector overlay so the Status column is reachable (F-023)");
		}
		await s.shot(db, "01-empty-pipeline");

		for (const issue of ISSUES) {
			const row = db
				.locator("[data-entity-id]", {
					has: db.locator(".dbv-grid__title-label", { hasText: issue.match }),
				})
				.first();
			await expect(row, `row for ${issue.match} exists`).toHaveCount(1);

			// Publish date — open the date cell, type an ISO date, Set.
			if ((await row.locator(".bs-cell-date-value").count()) === 0) {
				await row.locator(".bs-cell-date-trigger").first().click();
				await db.waitForTimeout(300);
				await db.locator(".bs-cell-date-pop .bs-cell-pop-input").first().fill(issue.date);
				await db.waitForTimeout(200);
				await db.locator(".bs-cell-date-set").first().click();
				await db.waitForTimeout(500);
				s.note(`${issue.match}: dated ${issue.date}`);
			} else {
				s.note(`${issue.match}: already dated — skipping`);
			}

			// Status lane — open the select cell, type the lane, Create (or pick
			// the existing option if a prior run already minted it). Dating the
			// row just selected it, which reopened the inspector over the Status
			// column — close it again first.
			if ((await row.locator(".bs-cell-tag-set").count()) === 0) {
				await closeInspectorIfOpen();
				await row.locator(".bs-cell-tag-trigger").first().click();
				await db.waitForTimeout(300);
				await db.locator(".bs-cell-pop-input").first().fill(issue.status);
				await db.waitForTimeout(250);
				const create = db.locator(".bs-cell-pop-row--create");
				if ((await create.count()) > 0) {
					await create.first().click();
					s.note(`${issue.match}: created + set lane "${issue.status}"`);
				} else {
					await db
						.locator(".bs-cell-pop-row", { hasText: new RegExp(issue.status, "i") })
						.first()
						.click();
					s.note(`${issue.match}: set existing lane "${issue.status}"`);
				}
				await db.waitForTimeout(500);
				// Dismiss the popover if it stayed open (multi-select cells don't auto-close).
				await db.keyboard.press("Escape").catch(() => undefined);
				await db.waitForTimeout(200);
			} else {
				s.note(`${issue.match}: already laned — skipping`);
			}
		}
		await s.shot(db, "02-filled-pipeline");

		// Every issue now has a date value and a lane chip.
		for (const issue of ISSUES) {
			const row = db
				.locator("[data-entity-id]", {
					has: db.locator(".dbv-grid__title-label", { hasText: issue.match }),
				})
				.first();
			await expect(
				row.locator(".bs-cell-date-value"),
				`${issue.match} has a publish date`,
			).toHaveCount(1);
			await expect(row.locator(".bs-cell-tag-set"), `${issue.match} has a status lane`).toHaveCount(1);
		}
	} finally {
		await s.finish();
	}
});
