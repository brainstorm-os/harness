/**
 * Session 913 — verification pass for F-417 / F-418.
 *
 * F-417 (sessions 907i / 907l): selecting a row, then typing into the right
 * panel, edited a DIFFERENT record — clicking another row's name or cells did
 * not retarget the open panel and did not move the selection; cell clicks
 * ACCUMULATED into a multi-selection whose panel edited the anchor. Three deal
 * values aimed at three clients all overwrote Vertex Labs.
 *
 * Reading current `main` suggests both halves are fixed (`applyClick` replaces
 * the set on a plain click; row clicks route through `onSelectEntity` →
 * `renderInspector`; the multi-select branch renders a read-only summary). A
 * code read is not a repro, so this session drives the real app.
 *
 * DELIBERATELY NON-DESTRUCTIVE: it verifies *targeting*, which is the root
 * cause, and never types a value. The owner's vault is the real Northbound
 * workspace — proving the panel follows the clicked row is enough, and a
 * failed write-test would corrupt real data exactly the way F-417 describes.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** The inspector's heading — "Details" when empty, the record's title when
 *  one row is inspected, "N selected" for a multi-selection. */
const TITLE = "#inspector-title";

test("F-417: the details panel follows the row I click (913)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("913-f417-inspector-target-verify");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db.locator("#list-nav >> text=Clients").first().click();
		await db.waitForTimeout(1500);
		await s.shot(db, "clients-grid");

		// Open the right panel via the header toggle (the documented affordance;
		// selecting a row deliberately does NOT auto-open it — F-023).
		const toggles = db.locator(".app-header__right [aria-label]");
		const n = await toggles.count();
		for (let i = n - 1; i >= 0; i--) {
			const label = (await toggles.nth(i).getAttribute("aria-label")) ?? "";
			if (/panel|inspector|details/i.test(label)) {
				await toggles.nth(i).click();
				await db.waitForTimeout(900);
				break;
			}
		}
		await s.shot(db, "inspector-open");

		// The row titles present in the grid, in view order.
		const rowTitles = await db
			.locator("[data-entity-id] .dbv-grid__title-label, [data-entity-id]")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`[db] grid rows sampled: ${rowTitles.slice(0, 8).join(" | ").slice(0, 300)}`);

		const readTitle = async (): Promise<string> =>
			((await db.locator(TITLE).first().textContent().catch(() => "")) ?? "").trim();

		// --- Half 1: does the panel RETARGET when I click a different row? ---
		const clients = ["Acme Analytics", "Halcyon Research", "Beacon Ventures"];
		const seen: string[] = [];
		for (const client of clients) {
			const row = db.locator(`text="${client}"`).first();
			if ((await row.count()) === 0) {
				s.note(`[db] row not present, skipping: ${client}`);
				continue;
			}
			await row.click();
			await db.waitForTimeout(900);
			const title = await readTitle();
			seen.push(`${client} -> panel:"${title}"`);
			s.note(`[db] clicked "${client}" — panel title is "${title}"`);
			await s.shot(db, `panel-${client.split(" ")[0]?.toLowerCase()}`);
		}
		s.note(`[verdict:retarget] ${seen.join("  ||  ")}`);

		// --- Half 2: does a plain CELL click accumulate a multi-selection? ---
		// F-417's second half: cell clicks piled up into "4 selected" instead of
		// moving the selection to the clicked row.
		// Close the panel first: it overlays the right of the grid, so cells
		// underneath it can't receive a click (Playwright reports the
		// `#inspector-body` subtree intercepting pointer events). The
		// accumulation question is about the grid's own click handling anyway.
		for (let i = n - 1; i >= 0; i--) {
			const label = (await toggles.nth(i).getAttribute("aria-label")) ?? "";
			if (/panel|inspector|details/i.test(label)) {
				await toggles.nth(i).click();
				await db.waitForTimeout(900);
				break;
			}
		}
		await s.shot(db, "panel-closed");

		const cells = db.locator("[data-entity-id] .dbv-grid__cell");
		const cellCount = await cells.count();
		s.note(`[db] grid cells found: ${cellCount}`);
		if (cellCount > 2) {
			await cells.nth(1).click();
			await db.waitForTimeout(700);
			const afterFirst = await readTitle();
			await cells.nth(2).click();
			await db.waitForTimeout(700);
			const afterSecond = await readTitle();
			s.note(`[db] cell click 1 -> "${afterFirst}"; cell click 2 -> "${afterSecond}"`);
			const accumulated = /\bselected\b/i.test(afterSecond);
			s.note(
				accumulated
					? `[verdict:accumulate] STILL BROKEN — two cell clicks produced "${afterSecond}"`
					: `[verdict:accumulate] OK — cell clicks replace, panel reads "${afterSecond}"`,
			);
			await s.shot(db, "after-cell-clicks");
		}

		// A selection-count bar would be the visible symptom of accumulation.
		const bar = db.locator(".db-selection-bar__count");
		const barText =
			(await bar.count()) > 0 ? ((await bar.first().textContent()) ?? "").trim() : "(absent)";
		s.note(`[db] selection bar: ${barText}`);
		await s.shot(db, "final");
	} finally {
		await s.finish();
	}
});
