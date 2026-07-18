/**
 * Session 907f — rebuilding Northbound, part 3d: fill Stage + Deal value.
 * The grid is div-based, so cells are targeted by coordinates: the header
 * cell's x-center × the row's y-center. Select cells open the options menu;
 * number cells take typed input.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; stage: string; deal: string }> = [
	{ client: "Vertex Labs", stage: "Proposal", deal: "48000" },
	{ client: "Acme Analytics", stage: "Qualified", deal: "25000" },
	{ client: "Halcyon Research", stage: "Lead", deal: "18000" },
	{ client: "Beacon Ventures", stage: "Won", deal: "32000" },
];

test("Clients: fill Stage + Deal value (907f)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907f-crm-fill-values");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);

		const colX = async (re: RegExp) => {
			const h = db.getByText(re).first();
			const box = await h.boundingBox().catch(() => null);
			return box ? box.x + box.width / 2 + 40 : null; // header labels are left-aligned; nudge into the cell area
		};
		const stageX = await colX(/^stage$/i).catch(() => null);
		const dealX = await colX(/^deal value$/i).catch(() => null);
		s.note(`[db] column x: stage=${stageX} deal=${dealX}`);
		if (stageX === null || dealX === null) {
			s.note("[db] couldn't locate the column headers — aborting");
			await s.shot(db, "no-headers");
			return;
		}

		let shotSelect = false;
		let shotNumber = false;
		for (const v of VALUES) {
			const rowEl = db.locator(`text="${v.client}"`).first();
			const rbox = await rowEl.boundingBox().catch(() => null);
			if (!rbox) {
				s.note(`[db] row "${v.client}" not found`);
				continue;
			}
			const y = rbox.y + rbox.height / 2;

			// Stage — click the cell, expect the select options menu.
			await db.mouse.click(stageX, y);
			await db.waitForTimeout(600);
			if (!shotSelect) {
				await s.shot(db, "stage-cell-open");
				shotSelect = true;
			}
			const opt = db.locator(`.fm-menu >> text="${v.stage}"`).first();
			if ((await opt.count()) > 0) {
				await opt.click();
			} else {
				await db.keyboard.type(v.stage);
				await db.keyboard.press("Enter");
			}
			await db.waitForTimeout(500);
			await db.keyboard.press("Escape").catch(() => undefined);

			// Deal value — click, type, Enter.
			await db.mouse.click(dealX, y);
			await db.waitForTimeout(500);
			if (!shotNumber) {
				await s.shot(db, "deal-cell-open");
				shotNumber = true;
			}
			await db.keyboard.type(v.deal);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
			await db.keyboard.press("Escape").catch(() => undefined);
		}

		await db.waitForTimeout(800);
		await s.shot(db, "grid-filled");
		const body = ((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		const sumVisible = /123[,.]?000|123000/.test(body);
		s.note(
			`[db] filled: Proposal=${body.includes("Proposal")} Won=${body.includes("Won")} Lead=${body.includes("Lead")} Qualified=${body.includes("Qualified")}; SUM 123000 visible=${sumVisible}`,
		);
		if (sumVisible) s.chat(SPEAKER.Dana, "Pipeline worth is finally on screen: the Deal value column sums to US$123k across 4 clients. That's the number I open the app for.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
