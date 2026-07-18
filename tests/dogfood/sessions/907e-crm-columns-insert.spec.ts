/**
 * Session 907e — rebuilding Northbound, part 3c: finish the CRM columns.
 *
 * 907d learned the model: "Add collection property…" creates a property
 * members inherit (Stage now exists), but a grid COLUMN needs the separate
 * "+ Insert property" step on the Properties page. This session: create
 * "Deal value" (Number), then insert both as columns, then fill the rows.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Record<string, { stage: string; deal: string }> = {
	"Vertex Labs": { stage: "Proposal", deal: "48000" },
	"Acme Analytics": { stage: "Qualified", deal: "25000" },
	"Halcyon Research": { stage: "Lead", deal: "18000" },
	"Beacon Ventures": { stage: "Won", deal: "32000" },
};

test("Clients: insert Stage + Deal value columns, fill rows (907e)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907e-crm-columns-insert");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1200);

		const headerText = async () =>
			((await db.locator("thead, [class*='grid'] [class*='head']").first().textContent().catch(() => "")) ?? "").toUpperCase();

		const openPropertiesPage = async () => {
			await db.locator('#toolbar-settings, [aria-label*="settings" i]').first().click();
			await db.waitForTimeout(600);
			await db.locator("text=Properties").first().click();
			await db.waitForTimeout(600);
		};

		// 1. Create "Deal value" if it doesn't exist yet (Stage exists from 907d).
		await openPropertiesPage();
		await s.shot(db, "properties-page-start");
		const pageText = ((await db.evaluate(() => document.body.textContent ?? "")) ?? "").replace(/\s+/g, " ");
		if (!/deal value/i.test(pageText)) {
			await db.locator('[data-testid="db-view-settings-add-collection-property"]').first().click();
			await db.waitForTimeout(700);
			await db.locator('input[placeholder="Property name"]').fill("Deal value");
			await db.locator('button:has-text("Number")').first().click();
			await db.waitForTimeout(300);
			await db.locator('button:has-text("Create")').first().click();
			await db.waitForTimeout(1000);
			await s.shot(db, "after-create-deal");
			s.note("[db] created Deal value (Number)");
		} else {
			s.note("[db] Deal value already exists");
		}

		// 2. Insert both as grid columns via "+ Insert property".
		for (const prop of ["Stage", "Deal value"]) {
			if ((await headerText()).includes(prop.toUpperCase())) {
				s.note(`[db] column "${prop}" already in the grid — skipped`);
				continue;
			}
			// The properties page should still be open; if not, reopen.
			const insert = db.locator("text=Add column").first();
			if ((await insert.count()) === 0 || !(await insert.isVisible().catch(() => false))) {
				await db.locator('[aria-label="Close settings"]').click().catch(() => undefined);
				await db.waitForTimeout(300);
				await openPropertiesPage();
			}
			await db.locator("text=Add column").first().click();
			await db.waitForTimeout(600);
			await s.shot(db, `insert-menu-${prop.toLowerCase().replace(/\s+/g, "-")}`);
			const opt = db.locator(`.fm-menu >> text="${prop}"`).first();
			if ((await opt.count()) > 0) {
				await opt.click();
				await db.waitForTimeout(800);
				s.note(`[db] inserted "${prop}" — header now "${(await headerText()).slice(0, 120)}"`);
			} else {
				const menuText = await db
					.evaluate(() => (document.querySelector(".fm-menu")?.textContent ?? "").replace(/\s+/g, " ").slice(0, 200));
				s.note(`[db] "${prop}" not in insert menu — menu reads: "${menuText}"`);
				await db.keyboard.press("Escape").catch(() => undefined);
			}
		}
		await db.locator('[aria-label="Close settings"]').click().catch(() => undefined);
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(400);
		await s.shot(db, "grid-with-columns");

		// 3. Fill values.
		const header = await headerText();
		if (header.includes("STAGE") && header.includes("DEAL")) {
			const headerCells = db.locator("thead th");
			const hTexts: string[] = [];
			for (let i = 0; i < (await headerCells.count()); i++)
				hTexts.push(((await headerCells.nth(i).textContent()) ?? "").trim().toUpperCase());
			const stageIdx = hTexts.findIndex((t) => t.includes("STAGE"));
			const dealIdx = hTexts.findIndex((t) => t.includes("DEAL"));
			s.note(`[db] headers ${JSON.stringify(hTexts)} stage@${stageIdx} deal@${dealIdx}`);
			let shotOnce = false;
			for (const [client, v] of Object.entries(VALUES)) {
				const row = db.locator("tbody tr", { hasText: client }).first();
				if ((await row.count()) === 0) continue;
				for (const [idx, text] of [
					[stageIdx, v.stage],
					[dealIdx, v.deal],
				] as Array<[number, string]>) {
					if (idx < 0) continue;
					await row.locator("td").nth(idx).click().catch(() => undefined);
					await db.waitForTimeout(500);
					if (!shotOnce) {
						await s.shot(db, "cell-edit-open");
						shotOnce = true;
					}
					const option = db.locator(`.fm-menu >> text="${text}"`).first();
					if ((await option.count()) > 0) await option.click();
					else {
						await db.keyboard.type(text);
						await db.keyboard.press("Enter");
					}
					await db.waitForTimeout(500);
					await db.keyboard.press("Escape").catch(() => undefined);
				}
			}
			await s.shot(db, "grid-filled");
			const gridText = ((await db.locator("body").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
			s.note(
				`[db] grid contains: Proposal=${gridText.includes("Proposal")} Won=${gridText.includes("Won")} Lead=${gridText.includes("Lead")} 48000=${/48[,.]?000|48000/.test(gridText)}`,
			);
			s.chat(SPEAKER.Mira, "Clients pipeline has stages and deal values again — the CRM is a funnel, not a flat list.");
		} else {
			s.note(`[db] columns still not in grid — header "${header.slice(0, 120)}"`);
		}
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
