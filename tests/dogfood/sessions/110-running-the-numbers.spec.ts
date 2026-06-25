/**
 * Session 110 — Northbound Monday: running the numbers (real operations).
 *
 * Mode shift: run the business for REAL and note what's missing — no fixing.
 * Mira does a Monday operations review: how's the pipeline, how's the money,
 * how's content tracking? She walks Clients, tries to total the pipeline, looks
 * for revenue/runway, checks the content calendar + this week's work. The
 * captures show what the app lets her answer vs where she's stuck — those gaps
 * become `business-wishlist.md` entries (read back afterward).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Northbound Monday — running the numbers (110)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("110-running-the-numbers");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// 1. The Clients pipeline — deal values, and is there a total?
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		await db
			.locator(".db-tab", { hasText: /Grid/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(500);
		await s.shot(db, "01-clients-grid");
		const clientCells = (
			await db.locator(".dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell").allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 30);
		s.note(`Clients grid cells: ${JSON.stringify(clientCells)}`);
		// Is there any aggregation/total footer in the grid?
		const footer = (
			await db
				.locator("[class*='footer'], [class*='aggregat'], [class*='summary'], [class*='total']")
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 10);
		s.note(`Grid totals/aggregation footer: ${JSON.stringify(footer)}`);

		// 2. Money — does a "Finances" / revenue surface exist at all?
		const lists = (await db.locator(".db-sidebar__list-item").allInnerTexts())
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`All Database lists Mira has: ${JSON.stringify(lists)}`);
		const moneyList = db
			.locator(".db-sidebar__list-item", { hasText: /financ|revenue|money|invoice|income/i })
			.first();
		s.note(`A money/finances surface exists? ${(await moneyList.count()) > 0}`);

		// 3. Content calendar — issues + any subscriber/metric column.
		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		await s.shot(db, "02-content-calendar");
		const ccCols = (
			await db
				.locator(".dbv-grid__cell--head, [class*='column-head'], [class*='grid__head']")
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 15);
		s.note(`Content Calendar columns: ${JSON.stringify(ccCols)}`);

		// 4. This week's work — Tasks Today.
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await tasks
			.locator('text="Today"')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "03-tasks-today");
		const todayCount =
			(await tasks
				.locator('text="Today"')
				.first()
				.textContent()
				.catch(() => "")) ?? "";
		s.note(`Tasks Today label: ${JSON.stringify(todayCount.trim())}`);

		// 5. The operating hub — does one doc tie the business together?
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const noteTitles = (await notes.locator(".notes__sidebar-title").allInnerTexts())
			.map((t) => t.trim())
			.filter(Boolean)
			.slice(0, 20);
		s.note(`Notes Mira has: ${JSON.stringify(noteTitles)}`);
		await s.shot(notes, "04-notes-list");

		s.note("captured a real Monday operations review for gap analysis");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
