/**
 * Session 907h — rebuilding Northbound, part 3f (final): deal values.
 * The DEAL VALUE cell opens an inline number input on click (907g shot).
 * Click → wait for the input → type → Enter → verify. No Escape afterwards.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; deal: string }> = [
	{ client: "Vertex Labs", deal: "48000" },
	{ client: "Acme Analytics", deal: "25000" },
	{ client: "Halcyon Research", deal: "18000" },
	{ client: "Beacon Ventures", deal: "32000" },
];

test("Clients: deal values, inline input (907h)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907h-crm-deal-final");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);

		const dealHeader = await db.getByText(/^deal value$/i).first().boundingBox();
		if (!dealHeader) {
			s.note("[db] no Deal value header");
			return;
		}
		const dealX = dealHeader.x + dealHeader.width / 2 + 40;

		const inputFocused = () =>
			db.evaluate(() => document.activeElement?.tagName === "INPUT").catch(() => false);

		for (const v of VALUES) {
			let done = false;
			for (let attempt = 0; attempt < 4 && !done; attempt++) {
				const rbox = await db.locator(`text="${v.client}"`).first().boundingBox().catch(() => null);
				if (!rbox) break;
				const y = rbox.y + rbox.height / 2;
				if (attempt === 0) await db.mouse.click(dealX, y);
				else if (attempt === 1) {
					// select the row first, then edit its cell
					await db.locator(`text="${v.client}"`).first().click();
					await db.waitForTimeout(400);
					await db.mouse.click(dealX, y);
				} else if (attempt === 2) {
					await db.mouse.click(dealX, y);
					await db.waitForTimeout(300);
					await db.keyboard.press("Enter");
				} else await db.mouse.dblclick(dealX, y);
				await db.waitForTimeout(800);
				if (!(await inputFocused())) continue;
				s.note(`[db] ${v.client}: editor opened via ${attempt === 0 ? "click" : attempt === 1 ? "click+Enter" : "dblclick"}`);
				await db.keyboard.type(v.deal);
				await db.waitForTimeout(200);
				if (v.client === "Vertex Labs") await s.shot(db, "typing-48000");
				await db.keyboard.press("Enter");
				await db.waitForTimeout(900);
				done = true;
			}
			s.note(`[db] ${v.client}: ${done ? `typed ${v.deal}` : "never got an inline input"}`);
		}

		await db.waitForTimeout(800);
		await s.shot(db, "grid-final");
		const body = ((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		s.note(
			`[db] values: 48000=${/48[,. ']?000/.test(body)} 25000=${/25[,. ']?000/.test(body)} 18000=${/18[,. ']?000/.test(body)} 32000=${/32[,. ']?000/.test(body)}; SUM 123000=${/123[,. ']?000/.test(body)}`,
		);
		if (/123[,. ']?000/.test(body))
			s.chat(SPEAKER.Dana, "Pipeline worth is back on screen: Deal value sums to 123,000 across the 4 clients. That's the number I open this app for.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
