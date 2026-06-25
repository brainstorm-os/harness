/**
 * Session 012 — Mira expands across the workspace.
 *
 * The CRM works, so Mira pushes into the apps she hasn't really used: capturing
 * research (Bookmarks), planning her content calendar (Calendar), seeing her
 * knowledge map (Graph), and naming the client rows she added. Exploratory —
 * captures + console over assertions; friction distilled afterward.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Mira expands — research, calendar, graph, name a client", async () => {
	test.setTimeout(300_000);
	const s = await startSession("012-mira-expands");
	try {
		// 1. Bookmarks — capture a research URL.
		const bookmarks = await s.openApp(APP.Bookmarks);
		await bookmarks.waitForTimeout(1500);
		await s.shot(bookmarks, "bookmarks-open");
		const addBm = bookmarks
			.locator(
				'[aria-label*="add" i], button:has-text("Add"), [title*="add" i], [aria-label*="new" i]',
			)
			.first();
		if (await addBm.count()) {
			await addBm.click().catch(() => undefined);
			await bookmarks.waitForTimeout(600);
			const urlField = bookmarks.locator('input:focus, input[type="url"], input[type="text"]').first();
			if (await urlField.count()) {
				await urlField
					.type("https://example.com/research/through-line", { delay: 8 })
					.catch(() => undefined);
				await bookmarks.keyboard.press("Enter").catch(() => undefined);
				await bookmarks.waitForTimeout(800);
			}
		}
		await s.shot(bookmarks, "bookmarks-after-add");
		s.note("Tried to capture a research bookmark.");

		// 2. Calendar — plan a content item.
		const calendar = await s.openApp(APP.Calendar);
		await calendar.waitForTimeout(1500);
		await s.shot(calendar, "calendar-open");
		s.note("Opened Calendar to plan the content schedule.");

		// 3. Graph — look at the knowledge map.
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(2500);
		await s.shot(graph, "graph-open");
		s.note("Opened Graph — does my work show as a connected map?");

		// 4. CRM — name a client row.
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(800);
		const firstRow = db.locator('text="Untitled"').first();
		if (await firstRow.count()) {
			await firstRow.dblclick().catch(() => undefined);
			await db.waitForTimeout(500);
			const cell = db.locator('input:focus, [contenteditable="true"]:focus').first();
			if (await cell.count()) {
				await cell.type("Acme Research Co.", { delay: 15 }).catch(() => undefined);
				await db.keyboard.press("Enter").catch(() => undefined);
				await db.waitForTimeout(700);
			}
		}
		await s.shot(db, "client-named");
		s.note("Tried to rename the first client row.");

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
