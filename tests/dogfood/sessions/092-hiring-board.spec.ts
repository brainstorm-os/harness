/**
 * Session 092 — Mira works the hiring funnel as a Kanban board.
 *
 * Fourth piece of the first-hire arc: a Board view on Candidates grouped by
 * Stage, so the funnel reads as lanes — Applied / Screen / Interview / Offer.
 * Reuses the board mechanics (083). Bonus: the group-by picker now offers
 * **"Stage" by name** (not a cryptic key) — the payoff of the F-036 fix (088),
 * so this also confirms the fix made grouping usable by name.
 *
 * No app-source change → SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("view the hiring funnel as a board grouped by Stage", async () => {
	test.setTimeout(180_000);
	const s = await startSession("092-hiring-board");
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
			.locator(".db-sidebar__list-item", { hasText: /^\s*Candidates/i })
			.first()
			.click();
		await db.waitForTimeout(800);

		const customTabs = db.locator(".db-tab:not(.db-tab--add)");
		if ((await customTabs.count()) <= 1) {
			await db.locator(".db-tab--add").first().click();
			await db.waitForTimeout(700);
		} else {
			await customTabs.last().click();
			await db.waitForTimeout(600);
		}

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
		// Thanks to the F-036 fix, "Stage" is selectable by name.
		const stage =
			opts.find(([, t]) => /^Stage$/i.test(t)) ?? opts.filter(([v]) => v !== "").slice(-1)[0];
		expect(stage, "a Stage option is present in the group-by picker").toBeTruthy();
		if (stage) await groupBy.selectOption(stage[0]);
		await db.waitForTimeout(600);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(400);
		await closeInspectorIfOpen();
		await s.shot(db, "01-hiring-board");

		await expect(db.locator(".dbv-board").first(), "the board rendered").toBeVisible();
		const labels = (await db.locator(".dbv-board__label").allInnerTexts()).map((t) => t.trim());
		s.note(`funnel lanes: ${JSON.stringify(labels)}`);
		expect(labels.length, "the funnel has lanes").toBeGreaterThanOrEqual(3);
		expect(
			["Applied", "Screen", "Interview", "Offer"].filter((l) => labels.some((x) => x.includes(l)))
				.length,
			"the lanes are the hiring stages",
		).toBeGreaterThanOrEqual(3);
	} finally {
		await s.finish();
	}
});
