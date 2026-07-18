/**
 * Session 907l — rebuilding Northbound, part 3j (endgame): the three missing
 * deal values, one full panel cycle per row: stage-cell click retargets the
 * inspector → dismiss menu → click the value pill → VERIFY an input has
 * focus → replace → Enter → close the panel → verify the value in the grid.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; deal: string; re: RegExp }> = [
	{ client: "Vertex Labs", deal: "48000", re: /48[,. ']?000/ },
	{ client: "Acme Analytics", deal: "25000", re: /25[,. ']?000/ },
	{ client: "Halcyon Research", deal: "18000", re: /18[,. ']?000/ },
	{ client: "Beacon Ventures", deal: "32000", re: /32[,. ']?000/ },
];

test("Clients: last three deal values, panel cycle per row (907l)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907l-deal-per-row");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);

		const bodyText = async () =>
			(((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " "));
		const inputFocused = () =>
			db.evaluate(() => document.activeElement?.tagName === "INPUT").catch(() => false);
		const closePanel = async () => {
			await db.locator('[class*="inspector"] [aria-label*="close" i], [class*="details"] [aria-label*="close" i]').first().click().catch(() => undefined);
			await db.waitForTimeout(500);
		};

		const stageHeader = await db.getByText(/^stage$/i).first().boundingBox();
		const stageX = stageHeader ? stageHeader.x + stageHeader.width / 2 + 40 : 700;

		for (const v of VALUES) {
			if (v.re.test(await bodyText())) {
				s.note(`[db] ${v.client}: value already in grid — skipped`);
				continue;
			}
			let done = false;
			for (let attempt = 0; attempt < 3 && !done; attempt++) {
				await closePanel();
				// Cell clicks ACCUMULATE selection (the 907l "4 selected" finding) —
				// clear it so this row becomes the single selected target.
				await db.locator('button:has-text("Clear")').first().click().catch(() => undefined);
				await db.waitForTimeout(400);
				const rbox = await db.locator(`text="${v.client}"`).first().boundingBox().catch(() => null);
				if (!rbox) break;
				await db.mouse.click(stageX, rbox.y + rbox.height / 2);
				await db.waitForTimeout(700);
				await db.keyboard.press("Escape"); // stage menu away, panel stays
				await db.waitForTimeout(400);
				const selBanner = ((await db.locator("text=/\\d+ selected/").first().textContent().catch(() => "")) ?? "").trim();
				if (selBanner && !selBanner.startsWith("1 ")) {
					s.note(`[db] ${v.client}: selection banner says "${selBanner}" — clearing and retrying`);
					continue;
				}
				const pill = db.locator('[aria-label^="Edit value for Deal value"]').first();
				if ((await pill.count()) === 0) continue;
				await pill.click({ timeout: 4000 }).catch(() => undefined);
				await db.waitForTimeout(500);
				if (!(await inputFocused())) {
					s.note(`[db] ${v.client}: pill click gave no input (attempt ${attempt})`);
					continue;
				}
				await db.keyboard.press("Meta+A");
				await db.keyboard.type(v.deal);
				await db.keyboard.press("Enter");
				await db.waitForTimeout(600);
				await closePanel();
				await db.waitForTimeout(400);
				done = v.re.test(await bodyText());
				s.note(`[db] ${v.client}: typed ${v.deal}, in grid: ${done} (attempt ${attempt})`);
			}
			if (!done) await s.shot(db, `stuck-${v.client.split(" ")[0]?.toLowerCase()}`);
		}

		await s.shot(db, "grid-final");
		const body = await bodyText();
		const sum = /123[,. ']?000/.test(body);
		s.note(
			`[db] final: 48k=${/48[,. ']?000/.test(body)} 25k=${/25[,. ']?000/.test(body)} 18k=${/18[,. ']?000/.test(body)} 32k=${/32[,. ']?000/.test(body)} SUM123k=${sum}`,
		);
		if (sum)
			s.chat(SPEAKER.Dana, "Pipeline worth is back on screen: Deal value sums to 123,000 across 4 clients. That's the number I open this app for.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
