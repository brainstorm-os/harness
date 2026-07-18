/**
 * Session 907j — rebuilding Northbound, part 3h: deal values, verified.
 *
 * 907i's edits all landed on Vertex Labs — the inspector never retargeted
 * when other row names were clicked (bug evidence). This pass selects each
 * row via its LEFT GUTTER, VERIFIES the inspector header shows that client
 * before editing, replaces the value (select-all first), and closes the
 * panel before the final readback so the grid text is fully visible.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; deal: string }> = [
	{ client: "Vertex Labs", deal: "48000" },
	{ client: "Acme Analytics", deal: "25000" },
	{ client: "Halcyon Research", deal: "18000" },
	{ client: "Beacon Ventures", deal: "32000" },
];

test("Clients: deal values with inspector-target verification (907j)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907j-crm-deal-verified");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);

		const inspectorTitle = async () =>
			((await db.locator('[class*="inspector"] h1, [class*="inspector"] [class*="title"], [class*="panel"] h1').first().textContent().catch(() => "")) ?? "").trim();

		for (const v of VALUES) {
			let targeted = false;
			for (let attempt = 0; attempt < 5 && !targeted; attempt++) {
				const rbox = await db.locator(`text="${v.client}"`).first().boundingBox().catch(() => null);
				if (!rbox) break;
				const y = rbox.y + rbox.height / 2;
				// attempt 0: left gutter; 1: row name; 2: stage cell zone; then repeat
				const x = attempt % 3 === 0 ? 262 : attempt % 3 === 1 ? rbox.x + 10 : 700;
				await db.mouse.click(x, y);
				await db.waitForTimeout(700);
				await db.keyboard.press("Escape").catch(() => undefined); // close any menu the click opened
				await db.waitForTimeout(300);
				const title = await inspectorTitle();
				if (title.includes(v.client)) targeted = true;
				else s.note(`[db] ${v.client}: click@x=${x} → inspector says "${title}" (attempt ${attempt})`);
			}
			if (!targeted) {
				s.note(`[db] ${v.client}: could NOT retarget the inspector — skipping to avoid corrupting another row`);
				await s.shot(db, `untargeted-${v.client.split(" ")[0]?.toLowerCase()}`);
				continue;
			}
			const cell = db.locator('[aria-label^="Edit value for Deal value"]').first();
			await cell.click({ timeout: 5000 }).catch(() => undefined);
			await db.waitForTimeout(400);
			await db.keyboard.press("Meta+A");
			await db.keyboard.type(v.deal);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(400);
			await db.keyboard.press("Escape").catch(() => undefined);
			await db.waitForTimeout(300);
			s.note(`[db] ${v.client}: set ${v.deal} (inspector verified)`);
		}

		// Close the panel, then read the grid.
		const closeBtn = db.locator('[class*="inspector"] [aria-label*="close" i], [class*="panel"] [aria-label*="close" i]').first();
		await closeBtn.click().catch(() => undefined);
		await db.waitForTimeout(700);
		await s.shot(db, "grid-final");
		const body = ((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		const sum = /123[,. ']?000/.test(body);
		s.note(
			`[db] final: 48000=${/48[,. ']?000/.test(body)} 25000=${/25[,. ']?000/.test(body)} 18000=${/18[,. ']?000/.test(body)} 32000=${/32[,. ']?000/.test(body)}; SUM 123000=${sum}`,
		);
		if (sum)
			s.chat(SPEAKER.Dana, "Pipeline worth is back on screen: Deal value sums to 123,000 across 4 clients. That's the number I open this app for.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
