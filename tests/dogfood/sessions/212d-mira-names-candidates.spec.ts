/**
 * Session 212d — Mira names the two remaining Untitled pipeline rows
 * (double-click the title cell = the rename affordance 212c discovered).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira names Dana and Felix on the pipeline (212d)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("212d-mira-names-candidates");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/candidate/i")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1500);
		for (const name of ["Dana Okafor — Operations & Growth", "Felix Brandt — Growth Marketer"]) {
			const title = db
				.locator(".dbv-grid__title-label")
				.filter({ hasText: /^Untitled$/ })
				.first();
			if (!(await title.isVisible().catch(() => false))) {
				s.note(`no Untitled title cell left for: ${name}`);
				break;
			}
			await title.dblclick();
			await db.waitForTimeout(500);
			const active = await db
				.evaluate(() => document.activeElement?.tagName ?? "none")
				.catch(() => "?");
			s.note(`activeElement after dblclick: ${active}`);
			await db.keyboard.type(name, { delay: 20 });
			await db.keyboard.press("Enter");
			await db.waitForTimeout(1000);
		}
		const names = await db
			.locator(".dbv-grid__title-label")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`pipeline rows: ${JSON.stringify(names)}`);
		await s.shot(db, "01-pipeline-named");
		s.chat(
			SPEAKER.Mira,
			"Dana Okafor and Felix Brandt are on the pipeline by name. For the record: that took double-click-to-rename, which nothing on the row tells you.",
		);
	} finally {
		await s.finish();
	}
});
