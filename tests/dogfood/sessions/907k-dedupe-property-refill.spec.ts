/**
 * Session 907k — rebuilding Northbound, part 3i: kill the duplicate property,
 * then fill deal values through the verified inspector routine (stage-cell
 * click retargets the panel — the 907j finding).
 *
 * Root cause of the fill chaos: TWO "Deal value" defs exist (a silent
 * duplicate); the grid column binds one, the inspector's first pill the
 * other. Settings → Data is the sanctioned place to delete one.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; deal: string }> = [
	{ client: "Vertex Labs", deal: "48000" },
	{ client: "Acme Analytics", deal: "25000" },
	{ client: "Halcyon Research", deal: "18000" },
	{ client: "Beacon Ventures", deal: "32000" },
];

test("dedupe Deal value + verified refill (907k)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907k-dedupe-property-refill");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(2000);

		// ---- Settings → Data: delete the duplicate def ----------------------
		await d.keyboard.press("Meta+,");
		await d.waitForTimeout(1200);
		if ((await d.locator('text="Settings sections"').count().catch(() => 0)) === 0) {
			await d.locator('[aria-label*="settings" i], [data-testid*="settings"]').first().click().catch(() => undefined);
			await d.waitForTimeout(1200);
		}
		await d.locator('[role="option"]', { hasText: /^Data$/ }).first().click()
			.catch(async () => d.locator('text="Data"').first().click());
		await d.waitForTimeout(1000);
		await s.shot(d, "settings-data");
		const dupRows = d.locator("text=/^Deal value$/");
		const dupCount = await dupRows.count();
		s.note(`[settings] "Deal value" rows visible: ${dupCount}`);
		if (dupCount >= 2) {
			await dupRows.last().click();
			await d.waitForTimeout(700);
			await s.shot(d, "dup-def-detail");
			const del = d.locator("text=/^Delete/").last();
			if ((await del.count()) > 0) {
				await del.click();
				await d.waitForTimeout(600);
				await s.shot(d, "delete-confirm");
				const confirm = d.locator('[role="dialog"] button, [class*="popover"] button').filter({ hasText: /^Delete/ }).last();
				if ((await confirm.count()) > 0) await confirm.click();
				else await d.locator("text=/^Delete/").last().click().catch(() => undefined);
				await d.waitForTimeout(800);
				s.note(`[settings] deleted one "Deal value" def; remaining rows: ${await d.locator("text=/^Deal value$/").count()}`);
			} else s.note("[settings] no Delete affordance on the def detail — see dup-def-detail");
		}
		await d.keyboard.press("Escape").catch(() => undefined);
		await d.keyboard.press("Escape").catch(() => undefined);
		await d.waitForTimeout(500);

		// ---- Database: verify column, refill values -------------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);
		const headerHasDeal = /deal value/i.test(
			((await db.locator("body").textContent().catch(() => "")) ?? "").slice(0, 4000),
		);
		s.note(`[db] DEAL VALUE column still present: ${headerHasDeal}`);

		const inspectorShows = async (name: string) =>
			(await db.locator(`[class*="inspector"] >> text="${name}"`).count().catch(() => 0)) > 0;

		const stageHeader = await db.getByText(/^stage$/i).first().boundingBox();
		const stageX = stageHeader ? stageHeader.x + stageHeader.width / 2 + 40 : 700;
		for (const v of VALUES) {
			let targeted = false;
			for (let attempt = 0; attempt < 3 && !targeted; attempt++) {
				const rbox = await db.locator(`text="${v.client}"`).first().boundingBox().catch(() => null);
				if (!rbox) break;
				await db.mouse.click(stageX, rbox.y + rbox.height / 2);
				await db.waitForTimeout(600);
				await db.keyboard.press("Escape").catch(() => undefined); // dismiss the stage menu
				await db.waitForTimeout(300);
				targeted = await inspectorShows(v.client);
			}
			if (!targeted) {
				s.note(`[db] ${v.client}: inspector never showed this row — skipped`);
				continue;
			}
			const pills = db.locator('[aria-label^="Edit value for Deal value"]');
			const pillCount = await pills.count();
			await pills.first().click({ timeout: 5000 }).catch(() => undefined);
			await db.waitForTimeout(400);
			await db.keyboard.press("Meta+A");
			await db.keyboard.type(v.deal);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(400);
			await db.keyboard.press("Escape").catch(() => undefined);
			await db.waitForTimeout(300);
			s.note(`[db] ${v.client}: set ${v.deal} (pills=${pillCount}, want 1)`);
		}

		const closeBtn = db.locator('[class*="inspector"] [aria-label*="close" i]').first();
		await closeBtn.click().catch(() => undefined);
		await db.waitForTimeout(700);
		await s.shot(db, "grid-final");
		const body = ((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		const sum = /123[,. ']?000/.test(body);
		s.note(
			`[db] final: 48000=${/48[,. ']?000/.test(body)} 25000=${/25[,. ']?000/.test(body)} 18000=${/18[,. ']?000/.test(body)} 32000=${/32[,. ']?000/.test(body)}; SUM 123000=${sum}`,
		);
		if (sum)
			s.chat(SPEAKER.Dana, "Pipeline worth is back on screen: Deal value sums to 123,000 across 4 clients.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
