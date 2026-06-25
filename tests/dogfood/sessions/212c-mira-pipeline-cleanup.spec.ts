/**
 * Session 212c — Mira cleans the Untitled flood out of the Candidates
 * pipeline (the 212/212b composer misses), then adds Dana + Felix properly
 * via the inline name cell. Doubles as the repro record for the friction
 * entries: where DID a typed name go after "+ New"?
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira cleans the pipeline and names her candidates (212c)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("212c-mira-pipeline-cleanup");
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

		// ---- Remove every Untitled row ---------------------------------------
		let shotMenu = false;
		for (let i = 0; i < 16; i++) {
			const untitled = db
				.locator("[data-entity-id]")
				.filter({ hasText: /^Untitled$/ })
				.first();
			if (!(await untitled.isVisible().catch(() => false))) break;
			await untitled.click({ button: "right" }).catch(() => undefined);
			await db.waitForTimeout(700);
			if (!shotMenu) {
				await s.shot(db, "01-row-context-menu");
				const rows = await db
					.locator('[role="menuitem"], .fm-menu button, .fm-menu [role="option"]')
					.allTextContents()
					.catch(() => [] as string[]);
				s.note(`row menu offers: ${JSON.stringify(rows.slice(0, 10))}`);
				shotMenu = true;
			}
			// Prefer a real Delete if the menu has one; fall back to Remove/Hide.
			const del = db.locator('.fm-menu :text("Delete")').first();
			const remove = db.locator('.fm-menu :text-matches("(Remove|Hide) from", "i")').first();
			if (await del.isVisible().catch(() => false)) {
				await del.click().catch(() => undefined);
			} else if (await remove.isVisible().catch(() => false)) {
				await remove.click().catch(() => undefined);
			} else {
				s.note("no delete/remove row in the menu — stopping cleanup");
				await db.keyboard.press("Escape").catch(() => undefined);
				break;
			}
			await db.waitForTimeout(900);
		}
		await s.shot(db, "02-after-cleanup");

		// ---- Add Dana + Felix, naming via the inline cell --------------------
		for (const name of ["Dana Okafor — Operations & Growth", "Felix Brandt — Growth Marketer"]) {
			const newBtn = db.getByRole("button", { name: "New", exact: true }).first();
			if (!(await newBtn.isVisible().catch(() => false))) {
				s.note("no + New button; skipping adds");
				break;
			}
			await newBtn.click();
			await db.waitForTimeout(1000);
			const focused = await db
				.evaluate(() => {
					const el = document.activeElement;
					return el ? `${el.tagName}.${(el as HTMLElement).className}` : "none";
				})
				.catch(() => "?");
			s.note(`activeElement after + New: ${focused}`);
			// Click the fresh Untitled row's name cell to open the inline editor.
			const row = db
				.locator("[data-entity-id]")
				.filter({ hasText: /^Untitled$/ })
				.first();
			const nameCell = row.locator('[class*="cell"]').first();
			await nameCell.click().catch(() => undefined);
			await db.waitForTimeout(600);
			const focused2 = await db
				.evaluate(() => {
					const el = document.activeElement;
					return el ? `${el.tagName}.${(el as HTMLElement).className}` : "none";
				})
				.catch(() => "?");
			s.note(`activeElement after name-cell click: ${focused2}`);
			await db.keyboard.type(name, { delay: 20 });
			await db.keyboard.press("Enter");
			await db.waitForTimeout(1000);
		}
		await s.shot(db, "03-candidates-final");
		const countLabel = await db
			.locator("text=/^\\d+ rows$/")
			.first()
			.textContent()
			.catch(() => null);
		s.note(`row count after rebuild: ${countLabel}`);
		const names = await db
			.locator("[data-entity-id]")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`rows now: ${JSON.stringify(names.slice(0, 12))}`);

		s.chat(
			SPEAKER.Mira,
			"Pipeline scrubbed. Eleven blank cards from one typed name is going straight in the log — but Dana and Felix are finally on the board with their names on.",
		);
	} finally {
		await s.finish();
	}
});
