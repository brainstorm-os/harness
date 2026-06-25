/**
 * Session 066 — Mira turns the Content Calendar into a real editorial pipeline.
 *
 * The Content Calendar (session 065) is just a list of issue titles. To plan a
 * weekly newsletter she needs two things per issue: WHEN it ships and WHERE it
 * is in the pipeline. So she adds two columns to the collection:
 *   - "Publish date"  — a Date property
 *   - "Status"        — a Select property (the Drafting→Scheduled→Published lane)
 *
 * Built entirely through the Database schema-editor UI: the view-settings
 * popover → "Add column…" → "Create new property" → the shared
 * <InlinePropertyForm> (name + kind tile + Create). No Lexical typing. The
 * artifact is a typed editorial schema; per-row values are a follow-up (the
 * Select needs its options + each issue dated, driven once cell-editing of a
 * fresh Select lane is dogfooded).
 *
 * Operates on the EXISTING "Content Calendar" collection — explicitly selects
 * it in the sidebar first so the columns land on the right list (session 065's
 * vault also holds a stray "New collection" from its failed first run).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const COLLECTION = "Content Calendar";

type NewColumn = { name: string; kind: string };
const COLUMNS: NewColumn[] = [
	{ name: "Publish date", kind: "Date" },
	{ name: "Status", kind: "Select" },
];

test("add publish-date + status columns to the Content Calendar", async () => {
	test.setTimeout(180_000);
	const s = await startSession("066-editorial-pipeline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// Select the Content Calendar collection (not the stray "New collection").
		const item = db
			.locator(".db-sidebar__list-item", { hasText: new RegExp(COLLECTION, "i") })
			.first();
		await expect(item, "the Content Calendar collection exists in the sidebar").toHaveCount(1);
		await item.click();
		await db.waitForTimeout(900);
		const active = ((await db.locator("#stage-title").first().textContent()) ?? "").trim();
		s.note(`active collection after select: "${active}"`);
		await s.shot(db, "01-calendar-selected");

		const headerHas = async (name: string): Promise<boolean> => {
			const heads = (await db.locator(".dbv-grid__cell--head").allInnerTexts()).map((t) => t.trim());
			return heads.some((h) => h.toLowerCase().includes(name.toLowerCase()));
		};

		for (const col of COLUMNS) {
			// Idempotent: a prior run (or a rerun) may already hold the column.
			if (await headerHas(col.name)) {
				s.note(`column "${col.name}" already present — skipping create`);
				continue;
			}

			// Open view settings → Add column… → Create new property.
			await db.locator("#toolbar-settings").first().click();
			await db.waitForTimeout(500);
			await db.locator('[data-testid="db-view-settings-add-column"]').first().click();
			await db.waitForTimeout(400);
			await db
				.locator('.fm-menu [role="option"]', { hasText: /create new property/i })
				.first()
				.click();
			await db.waitForTimeout(500);

			// Fill the shared InlinePropertyForm: name, kind tile, Create.
			const form = db.locator(".bs-inline-property-form").first();
			await expect(form, `the property form opened for ${col.name}`).toBeVisible();
			await form.locator(".bs-inline-property-form__name").fill(col.name);
			await form
				.locator(".bs-inline-property-form__tile", { hasText: new RegExp(`^${col.kind}$`, "i") })
				.first()
				.click();
			await db.waitForTimeout(200);
			await form.locator(".bs-inline-property-form__action--primary").first().click();
			await db.waitForTimeout(1100);
			s.note(`created property "${col.name}" (${col.kind})`);

			// The form commits on top of the view-settings popover, which stays
			// open — dismiss it (and its backdrop) before the next column add.
			await db.keyboard.press("Escape");
			await expect(db.locator(".db-popover__backdrop")).toHaveCount(0);
			await db.waitForTimeout(300);
		}
		await s.shot(db, "02-columns-added");

		const heads = (await db.locator(".dbv-grid__cell--head").allInnerTexts()).map((t) => t.trim());
		s.note(`column headers: ${JSON.stringify(heads)}`);

		expect(active, "operated on the Content Calendar collection").toMatch(/Content Calendar/i);
		for (const col of COLUMNS) {
			expect(
				heads.some((h) => h.toLowerCase().includes(col.name.toLowerCase())),
				`the ${col.name} column header is present`,
			).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
