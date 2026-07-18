/**
 * Session 907m — deal values via each client's OWN object surface.
 * The Database details panel edits a stale anchor object (907i/l evidence),
 * so this pass double-clicks each row to open the object itself (Quick Look /
 * default app), edits "Deal value" in that surface, and verifies in the grid.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; deal: string; re: RegExp }> = [
	{ client: "Vertex Labs", deal: "48000", re: /48[,. ']?000/ },
	{ client: "Acme Analytics", deal: "25000", re: /25[,. ']?000/ },
	{ client: "Halcyon Research", deal: "18000", re: /18[,. ']?000/ },
	{ client: "Beacon Ventures", deal: "32000", re: /32[,. ']?000/ },
];

test("Clients: deal values via the object window (907m)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907m-deal-object-window");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);

		const bodyText = async () =>
			(((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " "));
		const inputFocused = () =>
			db.evaluate(() => document.activeElement?.tagName === "INPUT").catch(() => false);

		for (const v of VALUES) {
			// Row-scoped check: does this client's ROW already show its value?
			let done = false;
			for (let attempt = 0; attempt < 2 && !done; attempt++) {
				const name = db.locator(`text="${v.client}"`).first();
				if ((await name.count()) === 0) break;
				await name.dblclick();
				await db.waitForTimeout(1500);
				if (v.client === "Vertex Labs" && attempt === 0) await s.shot(db, "after-dblclick");
				// Quick Look / object overlay inside the db window?
				const pill = db.locator('[aria-label^="Edit value for Deal value"]').first();
				if ((await pill.count()) > 0 && (await pill.isVisible().catch(() => false))) {
					await pill.click({ timeout: 4000 }).catch(() => undefined);
					await db.waitForTimeout(500);
					if (await inputFocused()) {
						await db.keyboard.press("Meta+A");
						await db.keyboard.type(v.deal);
						await db.keyboard.press("Enter");
						await db.waitForTimeout(600);
						done = true;
					}
				}
				// Close whatever opened (overlay or window focus shift).
				await db.keyboard.press("Escape").catch(() => undefined);
				await db.waitForTimeout(500);
			}
			s.note(`[db] ${v.client}: ${done ? `set ${v.deal} via object surface` : "object surface gave no editable Deal value"}`);
		}

		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(600);
		await s.shot(db, "grid-final");
		const body = await bodyText();
		const sum = /123[,. ']?000/.test(body);
		s.note(
			`[db] final: 48k=${/48[,. ']?000/.test(body)} 25k=${/25[,. ']?000/.test(body)} 18k=${/18[,. ']?000/.test(body)} 32k=${/32[,. ']?000/.test(body)} SUM123k=${sum}`,
		);
		if (sum)
			s.chat(SPEAKER.Dana, "Pipeline worth is back: Deal value sums to 123,000 across 4 clients.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
