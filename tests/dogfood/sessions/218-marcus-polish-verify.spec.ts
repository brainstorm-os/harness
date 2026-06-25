/**
 * Session 218 — Marcus verifies the polish batch: tasks board card ⋯ floats
 * top-start without a hover-jump, and the database title icon / empty icon
 * slot read correctly. Hover-driven, so we capture mid-hover.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus verifies the polish batch (218)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("218-marcus-polish-verify");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Polish check: board card hover shouldn't jump, the ⋯ should sit at the card start, and the db title icons + empty icon slot should read right.",
		);

		// Tasks — switch to a board view if one exists, then hover the first card.
		try {
			const page = await s.openApp(APP.Tasks);
			await page.waitForTimeout(2500);
			// Try to reach a board view via the sidebar (best-effort).
			await page
				.locator("[data-surface='board'], button:has-text('Board'), [aria-label*='oard']")
				.first()
				.click()
				.catch(() => {});
			await page.waitForTimeout(1200);
			const card = page.locator(".tasks-board__card").first();
			const hasBoard = (await card.count().catch(() => 0)) > 0;
			s.note(`tasks board cards present: ${hasBoard}`);
			if (hasBoard) {
				await card.hover().catch(() => {});
				await page.waitForTimeout(500);
				await s.shot(page, "tasks-board-card-hover", card);
				const more = card.locator(".bs-object-menu__more");
				s.note(`board card ⋯ present on hover: ${await more.count().catch(() => 0)}`);
			}
			await s.shot(page, "tasks-full");
		} catch (e) {
			s.note(`tasks check failed: ${(e as Error).message.slice(0, 120)}`);
		}

		// Database — capture the grid (title icons) and open an object's inspector
		// (empty icon slot plus sign).
		try {
			const page = await s.openApp(APP.Database);
			await page.waitForTimeout(2500);
			await s.shot(page, "database-grid");
			await page
				.locator(".dbv-grid__row, [role='row']")
				.nth(1)
				.click()
				.catch(() => {});
			await page.waitForTimeout(900);
			await s.shot(page, "database-inspector");
		} catch (e) {
			s.note(`database check failed: ${(e as Error).message.slice(0, 120)}`);
		}

		s.chat(SPEAKER.Marcus, "Captures in.");
	} finally {
		await s.finish();
	}
});
