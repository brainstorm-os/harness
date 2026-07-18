/**
 * Session 907i — rebuilding Northbound, part 3g: deal values via the
 * inspector's property rows (aria-label "Edit value for Deal value"), since
 * the grid's number-cell editor only opens on one row (bug evidence filed).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; deal: string }> = [
	{ client: "Acme Analytics", deal: "25000" },
	{ client: "Halcyon Research", deal: "18000" },
	{ client: "Beacon Ventures", deal: "32000" },
];

test("Clients: deal values via inspector rows (907i)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907i-crm-deal-inspector");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);

		// Ensure the right panel is open.
		let editCell = db.locator('[aria-label^="Edit value for Deal value"]');
		if ((await editCell.count()) === 0) {
			const toggles = db.locator('.app-header__right [aria-label]');
			const n = await toggles.count();
			for (let i = n - 1; i >= 0 && (await editCell.count()) === 0; i--) {
				const label = (await toggles.nth(i).getAttribute("aria-label")) ?? "";
				if (/panel|inspector|details/i.test(label)) {
					await toggles.nth(i).click();
					await db.waitForTimeout(800);
				}
			}
		}
		await db.locator('text="Acme Analytics"').first().click();
		await db.waitForTimeout(900);
		await s.shot(db, "inspector-open");

		for (const v of VALUES) {
			await db.locator(`text="${v.client}"`).first().click();
			await db.waitForTimeout(900);
			const cell = db.locator('[aria-label^="Edit value for Deal value"]').first();
			if ((await cell.count()) === 0) {
				s.note(`[db] no editable Deal value row for ${v.client}`);
				await s.shot(db, `missing-${v.client.split(" ")[0]?.toLowerCase()}`);
				continue;
			}
			await cell.click({ timeout: 5000 }).catch(async () => {
				await db.keyboard.press("Escape").catch(() => undefined);
				await db.waitForTimeout(400);
				await cell.click({ force: true, timeout: 5000 }).catch(() => undefined);
			});
			await db.waitForTimeout(500);
			await db.keyboard.type(v.deal);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(500);
			await db.keyboard.press("Escape").catch(() => undefined);
			await db.waitForTimeout(400);
			s.note(`[db] ${v.client}: typed ${v.deal} in the inspector`);
		}

		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(600);
		await s.shot(db, "grid-final");
		const body = ((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		const sum = /123[,. ']?000/.test(body);
		s.note(
			`[db] values now: 48000=${/48[,. ']?000/.test(body)} 25000=${/25[,. ']?000/.test(body)} 18000=${/18[,. ']?000/.test(body)} 32000=${/32[,. ']?000/.test(body)}; SUM 123000=${sum}`,
		);
		if (sum)
			s.chat(SPEAKER.Dana, "Pipeline worth is back on screen: Deal value sums to 123,000 across the 4 clients. That's the number I open this app for.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
