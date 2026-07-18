/**
 * Session 907g — rebuilding Northbound, part 3e: deal values via the inspector.
 *
 * 907f: stage chips landed via the grid select menu, but the Deal value cell
 * click opens the row inspector — so values go in there. The inspector also
 * showed "Deal value" TWICE (a silent duplicate property from the 907e
 * re-run): fill the first, then probe whether a property row offers any
 * delete/remove affordance (evidence for the friction note).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Array<{ client: string; deal: string }> = [
	{ client: "Vertex Labs", deal: "48000" },
	{ client: "Acme Analytics", deal: "25000" },
	{ client: "Halcyon Research", deal: "18000" },
	{ client: "Beacon Ventures", deal: "32000" },
];

test("Clients: deal values through the inspector (907g)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907g-crm-deal-values");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);

		// Clicking a DEAL VALUE cell opens the row inspector (907f finding).
		const dealHeader = await db.getByText(/^deal value$/i).first().boundingBox();
		const dealX = dealHeader ? dealHeader.x + dealHeader.width / 2 + 40 : 860;

		let shotOnce = false;
		for (const v of VALUES) {
			const rbox = await db.locator(`text="${v.client}"`).first().boundingBox();
			if (!rbox) continue;
			await db.mouse.click(dealX, rbox.y + rbox.height / 2);
			await db.waitForTimeout(900);
			const inspector = db.locator('[class*="inspector"]').last();
			const dealRow = inspector.locator("text=/^deal value$/i").first();
			if ((await dealRow.count()) === 0) {
				s.note(`[db] no Deal value row in the inspector for ${v.client}`);
				await s.shot(db, `no-deal-row-${v.client.split(" ")[0]?.toLowerCase()}`);
				continue;
			}
			const box = await dealRow.boundingBox();
			if (!box) continue;
			// The value area sits to the right of the label.
			await db.mouse.click(box.x + box.width + 120, box.y + box.height / 2);
			await db.waitForTimeout(500);
			if (!shotOnce) await s.shot(db, "deal-value-editing");
			await db.keyboard.type(v.deal);
			await db.keyboard.press("Enter");
			await db.waitForTimeout(600);
			if (!shotOnce) {
				await s.shot(db, "deal-value-committed");
				shotOnce = true;
			}
		}

		// Probe: does a property row offer delete/remove for the duplicate?
		await db.locator('text="Vertex Labs"').first().click();
		await db.waitForTimeout(700);
		const dupRow = db.locator('[class*="inspector"] >> text=/^deal value$/i').last();
		if ((await dupRow.count()) > 0) {
			await dupRow.click({ button: "right" }).catch(() => undefined);
			await db.waitForTimeout(600);
			await s.shot(db, "property-row-context");
			const menuText = await db
				.evaluate(() => (document.querySelector(".fm-menu")?.textContent ?? "").replace(/\s+/g, " ").slice(0, 200));
			s.note(`[db] right-click on the duplicate property row: ${menuText ? `menu "${menuText}"` : "no menu"}`);
			await db.keyboard.press("Escape").catch(() => undefined);
		}

		// Close the inspector, read the footer.
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(600);
		await s.shot(db, "grid-final");
		const body = ((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		const sumVisible = /123[,. ']?000/.test(body);
		s.note(`[db] after fill: 48000=${/48[,. ']?000/.test(body)} SUM 123000 visible=${sumVisible}`);
		if (sumVisible)
			s.chat(SPEAKER.Dana, "Pipeline worth is on screen again: Deal value sums to 123,000 across the 4 clients. That's the number I open this app for.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
