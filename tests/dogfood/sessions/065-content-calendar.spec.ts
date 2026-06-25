/**
 * Session 065 — Mira builds her editorial calendar (core startup area).
 *
 * Northbound sells a weekly newsletter, so she needs a place to plan issues.
 * She creates a "Content Calendar" collection in Database and lines up her
 * first three issues as rows. A new operating-data surface (beyond the Clients
 * CRM), built entirely through the Database UI (menus + inline rename — no
 * Lexical typing). Column types (publish date / status) are a follow-up; the
 * issues list is the artifact here.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const COLLECTION = "Content Calendar";
const ISSUES = [
	"Issue #1 — The case for dev-tools infra",
	"Issue #2 — Pricing power at seed",
	"Issue #3 — When to raise",
];

test("create a Content Calendar collection with the first issues", async () => {
	test.setTimeout(180_000);
	const s = await startSession("065-content-calendar");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		// New blank collection.
		await db.locator("#sidebar-new-list").first().click();
		await db.waitForTimeout(400);
		await db
			.locator('.fm-menu [role="option"]', { hasText: /Blank collection/i })
			.first()
			.click();
		await db.waitForTimeout(900);
		await s.shot(db, "01-new-collection");

		// Rename the collection via the contenteditable heading (#stage-title IS
		// the rename field — click in and type; #active-list-name is a mirror).
		const title = db.locator("#stage-title").first();
		await title.click();
		await db.keyboard.press("Meta+a");
		await db.keyboard.type(COLLECTION, { delay: 15 });
		await db.keyboard.press("Enter");
		await db.waitForTimeout(700);
		const named = ((await title.textContent()) ?? "").trim();
		s.note(`collection name after rename: "${named}"`);

		// Add a row per issue and name it inline (always rename the first
		// still-"Untitled" row — naming re-renders, so index would drift).
		for (const issue of ISSUES) {
			await db.locator("#toolbar-new").first().click();
			await db.waitForTimeout(700);
			const untitled = db
				.locator(".dbv-grid__title-label--editable", { hasText: /^Untitled$/ })
				.first();
			await untitled.dblclick();
			await db.waitForTimeout(250);
			const input = db.locator(".dbv-grid__title-input").first();
			await input.fill(issue);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
		}
		await s.shot(db, "02-issues");

		const rowLabels = (await db.locator(".dbv-grid__title-label").allInnerTexts()).map((t) =>
			t.trim(),
		);
		s.note(`row titles: ${JSON.stringify(rowLabels)}`);

		expect(named, "the collection is named Content Calendar").toMatch(/Content Calendar/i);
		for (const issue of ISSUES) {
			expect(
				rowLabels.some((l) => l.includes(issue.slice(0, 12))),
				`issue present: ${issue}`,
			).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
