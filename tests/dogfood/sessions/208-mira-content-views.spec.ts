/**
 * Session 208 — Mira works her real pipelines and looks for the saved-views
 * story (9.12.4 saved-List membership / 9.12.5 ListView tab-strip / 9.12.6
 * view-config landed as core slices — does ANY of it surface yet?).
 *
 * Also a quick pass over the Tasks board (the uniform-column-width fix)
 * since the week's planning lives there.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira plans the week across Database views and the Tasks board (208)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("208-mira-content-views");
	try {
		s.chat(
			SPEAKER.Mira,
			"Editorial planning day. I keep re-applying the same filter on the Content Calendar every single session — if saved views shipped, today I find them.",
		);

		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await s.shot(db, "01-database-open");

		// Find the Content Calendar collection in the sidebar.
		const contentCal = db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/content/i")
			.first();
		if (await contentCal.isVisible().catch(() => false)) {
			await contentCal.click().catch(() => undefined);
			await db.waitForTimeout(1500);
			await s.shot(db, "02-content-calendar");
		} else {
			s.note("Content Calendar not found in sidebar — listing what's there");
			const sidebarText = await db
				.locator("aside, nav, [class*='sidebar']")
				.first()
				.textContent()
				.catch(() => null);
			s.note(`sidebar: ${sidebarText?.slice(0, 300) ?? "(none)"}`);
		}

		// Saved views: any tab strip / view switcher / "save view" affordance?
		const viewControls = await db
			.locator(
				'[role="tablist"], [class*="view-strip"], [class*="view-tab"], [aria-label*="view" i], button:has-text("Save view"), button:has-text("New view")',
			)
			.evaluateAll((els) =>
				els.map(
					(el) =>
						`${el.tagName}:${el.getAttribute("aria-label") ?? el.textContent?.trim()?.slice(0, 40)}`,
				),
			)
			.catch(() => [] as string[]);
		s.note(`view-switcher candidates: ${JSON.stringify(viewControls)}`);
		await s.shot(db, "03-view-controls-area", db.locator(".app-header").first());

		// Apply a filter the way she does every week (status = planned), then
		// check whether anything offers to remember it.
		const filterBtn = db.locator('[aria-label*="filter" i], button:has-text("Filter")').first();
		if (await filterBtn.isVisible().catch(() => false)) {
			await filterBtn.click().catch(() => undefined);
			await db.waitForTimeout(900);
			await s.shot(db, "04-filter-open");
			await db.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("no filter button visible on this view");
		}

		// The Candidates board — her hiring pipeline, a board-mode list.
		const candidates = db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/candidate/i")
			.first();
		if (await candidates.isVisible().catch(() => false)) {
			await candidates.click().catch(() => undefined);
			await db.waitForTimeout(1500);
			await s.shot(db, "05-candidates-board");
		}

		// ---- Tasks board: column-width fix ---------------------------------
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2500);
		// Switch to board mode if there's a toggle.
		const boardToggle = tasks.locator('[aria-label*="board" i], button:has-text("Board")').first();
		if (await boardToggle.isVisible().catch(() => false)) {
			await boardToggle.click().catch(() => undefined);
			await tasks.waitForTimeout(1200);
		}
		await s.shot(tasks, "06-tasks-board");
		// Measure column widths — they shipped a uniform-width fix; verify.
		const widths = await tasks
			.locator('[class*="column"]')
			.evaluateAll((els) =>
				els
					.filter((el) => (el as HTMLElement).offsetWidth > 80)
					.map((el) => (el as HTMLElement).offsetWidth),
			)
			.catch(() => [] as number[]);
		s.note(`tasks board column widths: ${JSON.stringify(widths)}`);

		s.chat(
			SPEAKER.Mira,
			"Planning pass done. If I still can't save a view after three core slices shipped, that's the loudest line in today's log.",
		);
	} finally {
		await s.finish();
	}
});
