/**
 * Session 091 — Mira moves candidates through the hiring pipeline.
 *
 * Third piece of the first-hire arc: she adds a **Stage** Select column to the
 * Candidates collection (089 brief → 090 roster → here) and places each
 * applicant in the funnel — Applied / Screen / Interview / Offer. Turns the flat
 * roster into a working pipeline. Reuses the proven add-column (066) +
 * inline-cell-set (067) mechanics; the inspector reopens on every row select, so
 * it's re-closed before each Stage cell (F-023).
 *
 * No app-source change → SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Stage = { name: string; key: string; stage: string };
const STAGES: Stage[] = [
	{ name: "Priya Nair", key: "Priya Nair", stage: "Interview" },
	{ name: "Marcus Lee", key: "Marcus Lee", stage: "Screen" },
	{ name: "Sofia Alvarez", key: "Sofia Alvarez", stage: "Offer" },
	{ name: "Tom Becker", key: "Tom Becker", stage: "Applied" },
];

test("add a Stage column and place candidates in the funnel", async () => {
	test.setTimeout(180_000);
	const s = await startSession("091-candidate-stages");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		const closeInspectorIfOpen = async (): Promise<void> => {
			if ((await db.locator('.db-main[data-inspector-open="true"]').count()) === 0) return;
			await db.locator("#header-btn-inspector").first().click();
			await expect(db.locator('.db-main[data-inspector-open="true"]')).toHaveCount(0);
			await db.waitForTimeout(300);
		};

		await closeInspectorIfOpen();
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Candidates/i })
			.first()
			.click();
		await db.waitForTimeout(800);
		// Grid view (091 runs before the board in 092).
		await db.locator(".db-tab", { hasText: /Grid/i }).first().click();
		await db.waitForTimeout(400);

		const headerHas = async (name: string): Promise<boolean> => {
			const heads = (await db.locator(".dbv-grid__cell--head").allInnerTexts()).map((t) => t.trim());
			return heads.some((h) => h.toLowerCase().includes(name.toLowerCase()));
		};

		// Add the "Stage" Select column if missing (066 flow).
		if (!(await headerHas("Stage"))) {
			await db.locator("#toolbar-settings").first().click();
			await db.waitForTimeout(500);
			await db.locator('[data-testid="db-view-settings-add-column"]').first().click();
			await db.waitForTimeout(400);
			await db
				.locator('.fm-menu [role="option"]', { hasText: /create new property/i })
				.first()
				.click();
			await db.waitForTimeout(500);
			const form = db.locator(".bs-inline-property-form").first();
			await expect(form, "property form opened").toBeVisible();
			await form.locator(".bs-inline-property-form__name").fill("Stage");
			await form
				.locator(".bs-inline-property-form__tile", { hasText: /^Select$/i })
				.first()
				.click();
			await db.waitForTimeout(200);
			await form.locator(".bs-inline-property-form__action--primary").first().click();
			await db.waitForTimeout(1100);
			await db.keyboard.press("Escape");
			await expect(db.locator(".db-popover__backdrop")).toHaveCount(0);
			await db.waitForTimeout(300);
			s.note("added the Stage column");
		} else {
			s.note("Stage column already present");
		}

		for (const c of STAGES) {
			const row = db
				.locator("[data-entity-id]", { has: db.locator(".dbv-grid__title-label", { hasText: c.key }) })
				.first();
			await expect(row, `row for ${c.key}`).toHaveCount(1);
			if ((await row.locator(".bs-cell-tag-set").count()) > 0) {
				s.note(`${c.key} already staged — skipping`);
				continue;
			}
			await closeInspectorIfOpen();
			await row.locator(".bs-cell-tag-trigger").first().click();
			await db.waitForTimeout(300);
			await db.locator(".bs-cell-pop-input").first().fill(c.stage);
			await db.waitForTimeout(250);
			const create = db.locator(".bs-cell-pop-row--create");
			if ((await create.count()) > 0) {
				await create.first().click();
			} else {
				await db
					.locator(".bs-cell-pop-row", { hasText: new RegExp(c.stage, "i") })
					.first()
					.click();
			}
			await db.waitForTimeout(500);
			await db.keyboard.press("Escape").catch(() => undefined);
			await db.waitForTimeout(200);
			s.note(`${c.key} → ${c.stage}`);
		}
		await closeInspectorIfOpen();
		await s.shot(db, "01-staged");

		for (const c of STAGES) {
			const row = db
				.locator("[data-entity-id]", { has: db.locator(".dbv-grid__title-label", { hasText: c.key }) })
				.first();
			await expect(row.locator(".bs-cell-tag-set"), `${c.key} has a stage`).toHaveCount(1);
		}
	} finally {
		await s.finish();
	}
});
