/**
 * Session 018 — deep dogfood of Database: switch through every view type.
 *
 * Database is the most complex app (grid / board / gallery / calendar /
 * timeline renderers + cells/filters). The riskiest interaction is switching
 * views — each is a distinct renderer. This opens the default collection,
 * inventories its view tabs, clicks each in turn, screenshots, and asserts no
 * console/page errors across the whole tour.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Database: switch through all view types without errors", async () => {
	test.setTimeout(180_000);
	const s = await startSession("018-database-deep");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		await s.shot(db, "db-initial");

		// Inventory the view tabs by their visible labels (the imperative tab
		// strip near the top of the collection header).
		const tabLabels = await db.evaluate(() => {
			const out: string[] = [];
			// View tabs are short text controls in the header row; collect distinct
			// candidate labels from buttons / tab-like elements.
			for (const el of Array.from(
				document.querySelectorAll('button, [role="tab"], [class*="view-tab"], [class*="tab"]'),
			)) {
				const txt = (el.textContent ?? "").trim();
				if (txt && txt.length <= 14 && /^[A-Z][a-z]+$/.test(txt)) out.push(txt);
			}
			return [...new Set(out)];
		});
		s.note(`candidate view tabs: ${tabLabels.join(", ")}`);

		const KNOWN = [
			"Grid",
			"Board",
			"Gallery",
			"Calendar",
			"Timeline",
			"List",
			"Upcoming",
			"Schedule",
		];
		const present = KNOWN.filter((v) => tabLabels.includes(v));
		s.note(`switching through: ${present.join(", ")}`);

		// Each view body must render SOMETHING — a blank stage is the
		// regression we're guarding (a Calendar/Board view with no layout
		// property used to paint a silent void; it now shows a guiding
		// empty-state). Collect the stage-body text length per view.
		const bodyTextLen: Record<string, number> = {};
		for (const view of present) {
			const tab = db.getByText(view, { exact: true }).first();
			if ((await tab.count()) === 0) continue;
			try {
				await tab.click({ timeout: 5000 });
				await db.waitForTimeout(1200);
				await s.shot(db, `view-${view.toLowerCase()}`);
				const len = (
					(await db
						.locator("#stage-body")
						.innerText()
						.catch(() => "")) ?? ""
				).trim().length;
				bodyTextLen[view] = len;
				s.note(`✓ switched to ${view} (body text len: ${len})`);
			} catch (e) {
				s.note(`✗ ${view}: ${(e as Error).message.split("\n")[0]}`);
			}
		}
		// No view may render a blank body (the Schedule/Calendar void regression).
		const blank = Object.entries(bodyTextLen).filter(([, len]) => len === 0);
		s.note(`\nviews rendering a BLANK body: ${blank.map(([v]) => v).join(", ") || "none"}`);
		expect(blank, "no Database view should render a blank body").toEqual([]);

		s.note(`\nconsole/page errors across the view tour: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 25)) s.note(`  ${e}`);
		expect(present.length, "the collection should expose view tabs").toBeGreaterThan(0);
		expect(errors, "no console/page errors switching Database views").toEqual([]);
	} finally {
		await s.finish();
	}
});
