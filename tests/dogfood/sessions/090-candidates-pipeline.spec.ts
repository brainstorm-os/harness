/**
 * Session 090 — Mira stands up the Candidates pipeline.
 *
 * Second piece of the first-hire arc (after the role brief, 089): a
 * **Candidates** collection in Database, one row per designer applicant. The
 * recruiting roster. Built through the Database UI (new blank collection →
 * rename → rows → inline rename), the same flow as the Content Calendar (065).
 * Pipeline status + board view come next (091).
 *
 * Idempotent: reuses an existing "Candidates" collection and only adds the
 * applicants not already present. No app-source change → SKIP_BUILD.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const COLLECTION = "Candidates";
const APPLICANTS = [
	"Priya Nair — Sr. Brand Designer",
	"Marcus Lee — Product Designer",
	"Sofia Alvarez — Brand & Systems",
	"Tom Becker — Design Generalist",
];

test("create the Candidates collection with designer applicants", async () => {
	test.setTimeout(180_000);
	const s = await startSession("090-candidates-pipeline");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

		const existing = db.locator(".db-sidebar__list-item", {
			hasText: new RegExp(`^\\s*${COLLECTION}`, "i"),
		});
		if ((await existing.count()) > 0) {
			await existing.first().click();
			await db.waitForTimeout(800);
			s.note("Candidates collection exists — reusing");
		} else {
			await db.locator("#sidebar-new-list").first().click();
			await db.waitForTimeout(400);
			await db
				.locator('.fm-menu [role="option"]', { hasText: /Blank collection/i })
				.first()
				.click();
			await db.waitForTimeout(900);
			const title = db.locator("#stage-title").first();
			await title.click();
			await db.keyboard.press("Meta+a");
			await db.keyboard.type(COLLECTION, { delay: 15 });
			await db.keyboard.press("Enter");
			await db.waitForTimeout(700);
			s.note(`created collection "${((await title.textContent()) ?? "").trim()}"`);
		}
		await s.shot(db, "01-collection");

		const titlesNow = async (): Promise<string[]> =>
			(await db.locator(".dbv-grid__title-label").allInnerTexts()).map((t) => t.trim());

		for (const name of APPLICANTS) {
			const have = (await titlesNow()).some((t) => t.includes(name.split(" — ")[0] ?? name));
			if (have) {
				s.note(`applicant already present — skipping: ${name}`);
				continue;
			}
			await db.locator("#toolbar-new").first().click();
			await db.waitForTimeout(700);
			const untitled = db
				.locator(".dbv-grid__title-label--editable", { hasText: /^Untitled$/ })
				.first();
			await untitled.dblclick();
			await db.waitForTimeout(250);
			await db.locator(".dbv-grid__title-input").first().fill(name);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
			s.note(`added applicant: ${name}`);
		}
		await s.shot(db, "02-applicants");

		const titles = await titlesNow();
		s.note(`candidate rows: ${JSON.stringify(titles)}`);
		const active = ((await db.locator("#stage-title").first().textContent()) ?? "").trim();
		expect(active, "operated on the Candidates collection").toMatch(/Candidates/i);
		for (const name of APPLICANTS) {
			const key = name.split(" — ")[0] ?? name;
			expect(
				titles.some((t) => t.includes(key)),
				`applicant present: ${key}`,
			).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
