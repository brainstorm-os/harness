/**
 * Session 913b — two verification captures.
 *
 * (1) F-461 — the dashboard widget ⋯ menu was "visibly two different menus
 *     stacked": the Size group carried no leading glyph while Open app /
 *     Remove widget each did, so the icon gutter was empty for the top half.
 *     shell #296 reserves the gutter in the shared runtime; this is the
 *     after-shot the owner asked for.
 *
 * (2) F-405 wall 1 — Notes lists pages inline for a `/` query while Journal
 *     was reported to dismiss the menu and leave the text behind. #298 pinned
 *     the Embed/Reference *commands*; the page-listing half was never
 *     verified. This looks at what Journal's `/` menu actually offers.
 *
 * Journal typing is cleaned up (Escape + backspaces) so the owner's real
 * entry isn't left with stray slash text.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("F-461 widget menu + F-405 Journal slash (913b)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("913b-f461-menu-f405-slash");
	try {
		// ---------- (1) F-461: the dashboard widget ⋯ menu ----------
		const dash = s.dashboard;
		await dash.waitForTimeout(2500);
		await s.shot(dash, "dashboard");

		// The What's-New popover opens over the dashboard after an update and
		// blocks every widget interaction — dismiss it before touching anything.
		for (const label of ["Got it", "Close"]) {
			const btn = dash.locator(`button:has-text("${label}")`).first();
			if ((await btn.count()) > 0 && (await btn.isVisible().catch(() => false))) {
				await btn.click().catch(() => undefined);
				await dash.waitForTimeout(700);
				s.note(`[dash] dismissed the What's-New popover via "${label}"`);
				break;
			}
		}
		await dash.keyboard.press("Escape").catch(() => undefined);
		await dash.waitForTimeout(500);
		await s.shot(dash, "dashboard-clear");

		// The ⋯ is hover-revealed, so hover the card first.
		const card = dash.locator(".dashboard-widgets__header").first();
		if ((await card.count()) > 0) {
			await card.hover().catch(() => undefined);
			await dash.waitForTimeout(500);
		}
		const widgetMore = dash.locator(".dashboard-widgets__action--menu");
		const widgets = await widgetMore.count();
		s.note(`[dash] widget ⋯ triggers found: ${widgets}`);
		if (widgets > 0) {
			await widgetMore.first().click();
			await dash.waitForTimeout(900);
			await s.shot(dash, "widget-menu-open");
			// Every ACTION row should now occupy the icon gutter — either a real
			// glyph or the no-op spacer #296 injects. Report what's there.
			const rows = dash.locator(".fm-row, [role=\"menuitem\"], .bs-object-menu__item");
			const nRows = await rows.count();
			const report: string[] = [];
			for (let i = 0; i < nRows; i++) {
				const row = rows.nth(i);
				const label = ((await row.textContent()) ?? "").trim().slice(0, 24);
				// Distinguish a RESERVED gutter slot (blankMenuIcon renders an empty
				// icon container — this is what makes labels align) from a row that
				// actually paints a visible glyph. Conflating them would report the
				// F-461 fix as doing more than it does.
				const slot = await row.locator(".fm-row__icon").count();
				const svg = await row.locator("svg").count();
				const cls = (await row.getAttribute("class")) ?? "";
				const selected = /fm-row--selected/.test(cls);
				report.push(
					`${label} [slot:${slot} svg:${svg}${selected ? " SELECTED" : ""}]`,
				);
			}
			s.note(`[dash] widget menu rows (${nRows}): ${report.join(" | ")}`);
			const menu = dash.locator(".fm-menu, [role=\"menu\"]").first();
			if ((await menu.count()) > 0) await s.shot(dash, "widget-menu-zoom", menu);
			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(500);
		} else {
			s.note("[dash] no dashboard widget present — cannot capture the F-461 menu");
		}

		// ---------- (2) F-405 wall 1: Journal's `/` menu ----------
		const j = await s.openApp(APP.Journal);
		await j.waitForTimeout(3000);
		await s.shot(j, "journal-open");

		// Focus the day body. The editor is contenteditable; click into it.
		const body = j.locator('[contenteditable="true"]').first();
		if ((await body.count()) === 0) {
			s.note("[journal] no contenteditable body found — cannot test the slash menu");
		} else {
			await body.click();
			await j.waitForTimeout(600);
			await j.keyboard.press("End");
			// A fresh paragraph so we never disturb existing prose.
			await j.keyboard.press("Enter");
			await j.waitForTimeout(300);

			await j.keyboard.type("/");
			await j.waitForTimeout(1200);
			await s.shot(j, "journal-slash-menu");
			const slashRows = j.locator(".fm-row, [role=\"menuitem\"]");
			const n1 = await slashRows.count();
			const first = (await slashRows.allTextContents().catch(() => [])).slice(0, 14);
			s.note(`[journal] "/" menu rows: ${n1} → ${first.join(" | ").slice(0, 400)}`);

			// Does `/emb` reach the Embed command in the real app (the #298 claim)?
			await j.keyboard.type("emb");
			await j.waitForTimeout(1000);
			await s.shot(j, "journal-slash-emb");
			const embRows = await j
				.locator('.fm-row, [role="menuitem"]')
				.allTextContents()
				.catch(() => [] as string[]);
			s.note(`[journal] "/emb" rows: ${embRows.length} → ${embRows.join(" | ").slice(0, 300)}`);
			s.note(
				embRows.some((r) => /embed|reference/i.test(r))
					? "[verdict:f405-emb] OK — /emb surfaces an embed row in Journal"
					: "[verdict:f405-emb] NOT SURFACED — /emb matched nothing in the real app",
			);

			// Clean up: dismiss, then remove the 4 typed chars + the new paragraph.
			await j.keyboard.press("Escape");
			await j.waitForTimeout(400);
			for (let i = 0; i < 5; i++) {
				await j.keyboard.press("Backspace");
				await j.waitForTimeout(120);
			}
			await j.waitForTimeout(600);
			await s.shot(j, "journal-cleaned");
			const leftover = ((await body.textContent().catch(() => "")) ?? "").includes("/emb");
			s.note(`[journal] stray "/emb" left in the entry: ${leftover ? "YES — needs manual fix" : "no"}`);
		}
	} finally {
		await s.finish();
	}
});
