/**
 * Session 013 — text probe of session 012's outcomes (screenshots are
 * unreadable in this context, so gather DOM text signals instead).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe — clients, bookmarks, graph state", async () => {
	test.setTimeout(180_000);
	const s = await startSession("013-probe");
	try {
		// Clients rows — did the rename land, or still "Untitled"?
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(900);
		const rowNames = await db
			.locator(
				'.db-grid__row .db-grid__cell:first-child, [role="row"] [role="gridcell"]:first-child, .db-row',
			)
			.allInnerTexts()
			.catch(() => []);
		const count =
			(await db
				.locator("#stage-count")
				.textContent()
				.catch(() => "?")) ?? "?";
		s.note(`Clients count=${count}; row cells=${JSON.stringify(rowNames.slice(0, 8))}`);

		// Bookmarks count.
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		const bmText =
			(await bm
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(
			`Bookmarks body (first 200): ${JSON.stringify(bmText.replace(/\s+/g, " ").slice(0, 200))}`,
		);

		// Graph — does it render nodes (canvas present + any count)?
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(2500);
		const hasCanvas = await graph.locator("canvas").count();
		const graphText =
			(await graph
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(
			`Graph canvas=${hasCanvas}; body (first 160): ${JSON.stringify(graphText.replace(/\s+/g, " ").slice(0, 160))}`,
		);

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
