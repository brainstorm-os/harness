/**
 * Session 083 — Mira sees her editorial pipeline as a Kanban board.
 *
 * The Content Calendar grid (065–067) is fine for data entry, but to *work* the
 * pipeline she wants lanes: Drafting → Scheduled → Published. So she adds a
 * second view to the collection, switches it to Board, and groups by Status.
 * The three issues fan out into status columns. A new, genuinely useful lens on
 * data she already built — exercises add-view + the view-type segmented control
 * + board group-by (all uncovered).
 *
 * No app-source change → runs against the existing bundles (SKIP_BUILD).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("view the Content Calendar as a status board", async () => {
	test.setTimeout(180_000);
	const s = await startSession("083-pipeline-board");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		const closeInspectorIfOpen = async (): Promise<void> => {
			if ((await db.locator('.db-main[data-inspector-open="true"]').count()) === 0) return;
			await db.locator("#header-btn-inspector").first().click();
			await db.waitForTimeout(300);
		};
		await closeInspectorIfOpen();

		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click();
		await db.waitForTimeout(800);

		const customTabs = db.locator(".db-tab:not(.db-tab--add)");
		const tabCount = await customTabs.count();
		s.note(`existing views on Content Calendar: ${tabCount}`);

		// Use a dedicated extra view (create one if the collection only has the
		// default Grid; otherwise reuse the last extra view — self-heals a
		// prior run that grouped it wrong).
		if (tabCount <= 1) {
			await db.locator(".db-tab--add").first().click();
			await db.waitForTimeout(700);
			s.note("added a new view");
		} else {
			await customTabs.last().click();
			await db.waitForTimeout(600);
			s.note("reusing the existing extra view");
		}

		// Make it a Board grouped by Status (idempotent — fine if already so).
		await db.locator("#toolbar-settings").first().click();
		await db.waitForTimeout(500);
		await db
			.locator(".db-popover__segment", { hasText: /^Board$/ })
			.first()
			.click();
		await db.waitForTimeout(500);
		const groupBy = db.locator('select[aria-label="Group by"]').first();
		await expect(groupBy, "the board group-by picker appeared").toBeVisible();
		const opts = await groupBy
			.locator("option")
			.evaluateAll((os) =>
				(os as HTMLOptionElement[]).map((o) => [o.value, (o.textContent ?? "").trim()]),
			);
		s.note(`group-by options: ${JSON.stringify(opts)}`);
		// Prefer a Status-named option; else the last non-empty property (Status
		// was the last column added, after Publish date).
		const statusPair =
			opts.find(([, t]) => /status/i.test(t)) ?? opts.filter(([v]) => v !== "").slice(-1)[0];
		const statusValue = statusPair ? statusPair[0] : null;
		s.note(`chosen group-by value: ${statusValue}`);
		if (statusValue) await groupBy.selectOption(statusValue);
		await db.waitForTimeout(600);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);

		await closeInspectorIfOpen();
		await db.waitForTimeout(400);
		await s.shot(db, "01-board");

		await expect(db.locator(".dbv-board").first(), "the board view rendered").toBeVisible();
		const labels = (await db.locator(".dbv-board__label").allInnerTexts()).map((t) => t.trim());
		s.note(`board columns: ${JSON.stringify(labels)}`);
		expect(labels.length, "the board has status columns").toBeGreaterThanOrEqual(2);
		expect(
			labels.some((l) => /Drafting|Scheduled|Published/i.test(l)),
			"the columns are the editorial pipeline lanes",
		).toBe(true);
	} finally {
		await s.finish();
	}
});
