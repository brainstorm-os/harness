/**
 * Session 907n — CRM repair: undo the automation scramble (two rows renamed
 * to raw numbers, deal values on the wrong rows) with strict verification:
 * the `.db-inspector__title` must equal the target row's name before any
 * value edit is allowed to commit.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const REPAIRS: Array<{ currentName: string; properName: string; deal: string }> = [
	{ currentName: "32000", properName: "Halcyon Research", deal: "18000" },
	{ currentName: "18000", properName: "Acme Analytics", deal: "25000" },
	{ currentName: "Vertex Labs", properName: "Vertex Labs", deal: "48000" },
	{ currentName: "Beacon Ventures", properName: "Beacon Ventures", deal: "32000" },
];

test("Clients: repair names + deal values, title-guarded (907n)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907n-crm-repair");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);
		await s.shot(db, "before-repair");

		const clearSel = async () => {
			await db.locator('button:has-text("Clear")').first().click().catch(() => undefined);
			await db.waitForTimeout(300);
		};
		const inspectorTitle = async () =>
			((await db.locator(".db-inspector__title").first().textContent().catch(() => "")) ?? "").trim();
		const inputFocused = () =>
			db.evaluate(() => document.activeElement?.tagName === "INPUT").catch(() => false);
		const stageHeader = await db.getByText(/^stage$/i).first().boundingBox();
		const stageX = stageHeader ? stageHeader.x + stageHeader.width / 2 + 40 : 700;

		for (const r of REPAIRS) {
			// -- rename if needed ------------------------------------------------
			if (r.currentName !== r.properName) {
				const nameEl = db.locator(`text="${r.currentName}"`).first();
				if ((await nameEl.count()) > 0) {
					await clearSel();
					await nameEl.dblclick();
					await db.waitForTimeout(600);
					if (await inputFocused()) {
						await db.keyboard.press("Meta+A");
						await db.keyboard.type(r.properName);
						await db.keyboard.press("Enter");
						await db.waitForTimeout(700);
						s.note(`[db] renamed "${r.currentName}" → "${r.properName}"`);
					} else {
						s.note(`[db] dblclick on "${r.currentName}" gave no rename input`);
						continue;
					}
				}
			}
			// -- deal value, title-guarded ----------------------------------------
			let done = false;
			for (let attempt = 0; attempt < 4 && !done; attempt++) {
				await clearSel();
				const rbox = await db.locator(`text="${r.properName}"`).first().boundingBox().catch(() => null);
				if (!rbox) break;
				await db.mouse.click(stageX, rbox.y + rbox.height / 2);
				await db.waitForTimeout(700);
				await db.keyboard.press("Escape");
				await db.waitForTimeout(400);
				const title = await inspectorTitle();
				if (title !== r.properName) {
					s.note(`[db] ${r.properName}: inspector title is "${title}" — not editing (attempt ${attempt})`);
					continue;
				}
				const pill = db.locator('[aria-label^="Edit value for Deal value"]').first();
				await pill.click({ timeout: 4000 }).catch(() => undefined);
				await db.waitForTimeout(500);
				if (!(await inputFocused())) {
					s.note(`[db] ${r.properName}: pill gave no input (attempt ${attempt})`);
					continue;
				}
				await db.keyboard.press("Meta+A");
				await db.keyboard.type(r.deal);
				await db.keyboard.press("Enter");
				await db.waitForTimeout(600);
				done = true;
				s.note(`[db] ${r.properName}: deal set to ${r.deal} (title-guarded)`);
			}
			await db.locator('[class*="inspector"] [aria-label*="close" i]').first().click().catch(() => undefined);
			await db.waitForTimeout(400);
		}

		await clearSel();
		await db.waitForTimeout(500);
		await s.shot(db, "grid-final");
		const body = (((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " "));
		const sum = /123[,. ']?000/.test(body);
		s.note(
			`[db] final: names ok=${body.includes("Halcyon Research") && body.includes("Acme Analytics")} 48k=${/48[,. ']?000/.test(body)} 25k=${/25[,. ']?000/.test(body)} 18k=${/18[,. ']?000/.test(body)} 32k=${/32[,. ']?000/.test(body)} SUM123k=${sum}`,
		);
		if (sum) s.chat(SPEAKER.Dana, "Pipeline repaired and worth 123,000 on screen. Filed the wrong-target editing as the friction that caused the mess.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
