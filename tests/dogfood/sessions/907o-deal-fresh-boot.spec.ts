/**
 * Session 907o — the last deal values, exploiting the one reliable pattern:
 * the FIRST deal-cell click after the Database window opens edits inline.
 * ONE fresh shell boot fixes ONE missing value (page.close()+relaunch leaves
 * a zombie window — the documented trap), then verifies. Run the spec
 * repeatedly until the final note reports SUM123k=true.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const WANTED: Array<{ client: string; deal: string; re: RegExp }> = [
	{ client: "Vertex Labs", deal: "48000", re: /48[,. ']?000/ },
	{ client: "Acme Analytics", deal: "25000", re: /25[,. ']?000/ },
	{ client: "Halcyon Research", deal: "18000", re: /18[,. ']?000/ },
	{ client: "Beacon Ventures", deal: "32000", re: /32[,. ']?000/ },
];

test("Clients: deal values, one fix per boot (907o)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907o-deal-fresh-boot");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);
		const body0 = (((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " "));
		const v = WANTED.find((w) => !w.re.test(body0));
		if (!v) {
			s.note("[db] nothing missing — going straight to verification");
		} else {
			const dealHeader = await db.getByText(/^deal value$/i).first().boundingBox();
			const rbox = await db.locator(`text="${v.client}"`).first().boundingBox().catch(() => null);
			if (!dealHeader || !rbox) {
				s.note(`[db] ${v.client}: header/row not found`);
			} else {
				await db.mouse.click(dealHeader.x + dealHeader.width / 2 + 40, rbox.y + rbox.height / 2);
				await db.waitForTimeout(800);
				const focused = await db.evaluate(() => document.activeElement?.tagName === "INPUT").catch(() => false);
				if (focused) {
					await db.keyboard.press("Meta+A");
					await db.keyboard.type(v.deal);
					await db.keyboard.press("Enter");
					await db.waitForTimeout(800);
					const after = (((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " "));
					s.note(`[db] ${v.client}: typed ${v.deal} on fresh boot — in grid: ${v.re.test(after)}`);
				} else {
					s.note(`[db] ${v.client}: even the fresh-boot first click gave no editor`);
					await s.shot(db, `noedit-${v.client.split(" ")[0]?.toLowerCase()}`);
				}
			}
		}

		await db.waitForTimeout(800);
		await s.shot(db, "grid-final");
		const body = (((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " "));
		const sum = /123[,. ']?000/.test(body);
		s.note(
			`[db] FINAL: 48k=${/48[,. ']?000/.test(body)} 25k=${/25[,. ']?000/.test(body)} 18k=${/18[,. ']?000/.test(body)} 32k=${/32[,. ']?000/.test(body)} SUM123k=${sum}`,
		);
		if (sum)
			s.chat(SPEAKER.Dana, "Pipeline worth is back on screen: US$123k across 4 clients, summed live in the grid footer.");
	} finally {
		await s.finish();
	}
});
