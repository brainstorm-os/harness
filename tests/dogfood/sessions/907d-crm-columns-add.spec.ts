/**
 * Session 907d — rebuilding Northbound, part 3b: add Stage + Deal value to
 * Clients via Grid settings → Properties → "Add collection property…", then
 * fill the values per client row. The dialog (probed in the first 907d run):
 * NAME input (placeholder "Property name"), KIND tiles, OPTIONS textarea for
 * Select, a Create button.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const VALUES: Record<string, { stage: string; deal: string }> = {
	"Vertex Labs": { stage: "Proposal", deal: "48000" },
	"Acme Analytics": { stage: "Qualified", deal: "25000" },
	"Halcyon Research": { stage: "Lead", deal: "18000" },
	"Beacon Ventures": { stage: "Won", deal: "32000" },
};

test("Clients: add Stage + Deal value columns and fill them (907d)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907d-crm-columns-add");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1200);

		const headerText = async () =>
			((await db.locator("thead, [class*='grid'] [class*='head']").first().textContent().catch(() => "")) ?? "").toUpperCase();

		for (const col of [
			{ name: "Stage", kind: "Select", options: "Lead, Qualified, Proposal, Won, Lost" },
			{ name: "Deal value", kind: "Number", options: null },
		]) {
			if ((await headerText()).includes(col.name.toUpperCase())) {
				s.note(`[db] column "${col.name}" already present — skipped`);
				continue;
			}
			try {
				await db.locator('#toolbar-settings, [aria-label*="settings" i]').first().click();
				await db.waitForTimeout(600);
				await db.locator("text=Properties").first().click();
				await db.waitForTimeout(600);
				await db.locator('[data-testid="db-view-settings-add-collection-property"]').first().click();
				await db.waitForTimeout(700);
				const dialog = db.locator("text=New collection property");
				if ((await dialog.count()) === 0) {
					s.note(`[db] property dialog did not open for "${col.name}"`);
					await s.shot(db, `no-dialog-${col.name.toLowerCase().replace(/\s+/g, "-")}`);
					await db.keyboard.press("Escape");
					continue;
				}
				await db.locator('input[placeholder="Property name"]').fill(col.name);
				await db.locator(`button:has-text("${col.kind}")`).first().click();
				await db.waitForTimeout(400);
				if (col.options) {
					const ta = db.locator("textarea").first();
					if ((await ta.count()) > 0) await ta.fill(col.options);
				}
				await s.shot(db, `dialog-ready-${col.name.toLowerCase().replace(/\s+/g, "-")}`);
				await db.locator('button:has-text("Create")').first().click();
				await db.waitForTimeout(1000);
				await db.keyboard.press("Escape").catch(() => undefined);
				await db.waitForTimeout(400);
				s.note(`[db] after adding "${col.name}": header = "${(await headerText()).slice(0, 120)}"`);
			} catch (e) {
				s.note(`[db] adding "${col.name}" broke: ${String(e).slice(0, 180)}`);
				await db.keyboard.press("Escape").catch(() => undefined);
			}
		}
		await s.shot(db, "grid-with-columns");

		// ---- Fill values: click the cell at the column's header index ------
		const header = await headerText();
		if (header.includes("STAGE") && header.includes("DEAL")) {
			const headerCells = db.locator("thead th, [class*='head'] [class*='cell']");
			const hTexts: string[] = [];
			const hCount = await headerCells.count();
			for (let i = 0; i < hCount; i++) hTexts.push(((await headerCells.nth(i).textContent()) ?? "").trim().toUpperCase());
			const stageIdx = hTexts.findIndex((t) => t.includes("STAGE"));
			const dealIdx = hTexts.findIndex((t) => t.includes("DEAL"));
			s.note(`[db] header cells: ${JSON.stringify(hTexts)} (stage@${stageIdx}, deal@${dealIdx})`);

			let shotOnce = false;
			for (const [client, v] of Object.entries(VALUES)) {
				const row = db.locator("tbody tr", { hasText: client }).first();
				if ((await row.count()) === 0) {
					s.note(`[db] row "${client}" not found for value fill`);
					continue;
				}
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
					// A Select cell opens an option menu; a Number cell an input.
					const option = db.locator(`.fm-menu >> text="${text}"`).first();
					if ((await option.count()) > 0) {
						await option.click();
					} else {
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
				`[db] grid contains: Proposal=${gridText.includes("Proposal")} 48k=${gridText.includes("48")} Won=${gridText.includes("Won")} Lead=${gridText.includes("Lead")}`,
			);
			s.chat(SPEAKER.Mira, "Clients pipeline has stages and deal values again.");
		} else {
			s.note(`[db] columns still missing after add pass — header: "${header.slice(0, 120)}"`);
		}
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
