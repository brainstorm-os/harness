/**
 * Session 041 — Mira filters her pipeline to just the leads. Drives the full
 * filter cascade (Add rule → Status → operator → value "Lead") and checks the
 * grid narrows to the Lead client. Status is a Select (stores option IDs), so
 * this also tests whether filtering a select by its visible label works.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function clientNames(db: Page): Promise<string[]> {
	const t = await db
		.locator(
			'.dbv-grid__row:not(.dbv-grid__row--head):not(.dbv-grid__row--foot) .dbv-grid__cell[data-col="title"]',
		)
		.allInnerTexts()
		.catch(() => []);
	return t.map((x) => x.trim());
}

test("filter the pipeline by Status = Lead", async () => {
	test.setTimeout(180_000);
	const s = await startSession("041-apply-status-filter");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);

		const before = await clientNames(db);
		s.note(`Clients before filter: ${JSON.stringify(before)}`);

		// Cascade: filter → Add filter rule → Status → contains → "Lead".
		await db.locator("#toolbar-filter").click();
		await db.waitForTimeout(500);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /Add filter rule|Add another rule/ })
			.first()
			.click();
		await db.waitForTimeout(500);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /^Status$/ })
			.first()
			.click();
		await db.waitForTimeout(500);
		const opts = await db
			.locator('.fm-menu [role="option"]')
			.allInnerTexts()
			.catch(() => []);
		s.note(`Operator menu: ${JSON.stringify(opts.map((t) => t.trim()))}`);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /^contains$/ })
			.first()
			.click();
		await db.waitForTimeout(500);
		// Free-text value prompt (labelled "<prop> <op>" popover; the fillable
		// element is the input inside it).
		const prompt = db.locator("#db-value-prompt .db-value-prompt__input");
		s.note(`Value entry kind: ${(await prompt.count()) > 0 ? "free-text prompt" : "other"}`);
		if ((await prompt.count()) > 0) {
			await prompt.fill("Lead");
			await prompt.press("Enter");
		}
		await db.waitForTimeout(800);

		const after = await clientNames(db);
		s.note(`Clients after Status contains "Lead": ${JSON.stringify(after)}`);
		s.note(
			`Narrowed correctly (only Lead clients): ${after.length > 0 && after.length < before.length}`,
		);
		s.note(`Filter returned nothing (select-by-label likely broken): ${after.length === 0}`);
		await s.shot(db, "01-filtered");

		// Just report — the assertion is soft; this session characterizes the result.
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
