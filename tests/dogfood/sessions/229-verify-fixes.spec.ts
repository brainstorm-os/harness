/**
 * Session 229 — verify the three polish fixes shipped this session:
 *  1. Bookmarks detail: a coverless bookmark shows a slim "+ Add cover"
 *     affordance, NOT a giant full-bleed gradient band (F-002 parity). A
 *     bookmark WITH a cover uses Notes' slim 16/3.5 aspect.
 *  2. Bookmarks flat list: a centered ~72ch reading column, not full-bleed.
 *  3. Calendar: the view-switcher tabs are 28px tall (aligned with the
 *     sibling header buttons), not the old 24px.
 * Measures the real DOM + captures shots for the record.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("verify bookmarks cover/list + calendar tab fixes (229)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("229-verify-fixes");
	try {
		// ── Bookmarks ──────────────────────────────────────────────────────
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2400);
		await s.shot(bm, "01-bookmarks-list");

		// List column should be constrained + centered, not full-bleed.
		const listGeom = await bm
			.evaluate(() => {
				const cards = document.querySelector(".bookmarks__cards") as HTMLElement | null;
				const scroll = document.querySelector(".bookmarks__card-scroll") as HTMLElement | null;
				if (!cards || !scroll) return null;
				const c = cards.getBoundingClientRect();
				const left = Math.round(c.left);
				const right = Math.round(scroll.getBoundingClientRect().right - c.right);
				return { cardsWidth: Math.round(c.width), gapLeft: left, gapRight: right };
			})
			.catch(() => null);
		s.note(
			`list column geom (centered if width≪window & gaps both sides): ${JSON.stringify(listGeom)}`,
		);

		// Open the first bookmark → detail. Check cover gating.
		await bm
			.locator(".bookmarks__card-title")
			.first()
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(1500);
		const detail = await bm
			.evaluate(() => {
				const addCover = document.querySelector(".bm-detail__add-cover");
				const band = document.querySelector(".bm-detail__cover") as HTMLElement | null;
				const bandH = band ? Math.round(band.getBoundingClientRect().height) : null;
				const winW = window.innerWidth;
				return {
					coverlessAddAffordance: !!addCover,
					coverBandPresent: !!band,
					coverBandHeight: bandH,
					windowWidth: winW,
					// A 16/3.5 full-bleed band would be ~winW/4.57; the old 16/5 was ~winW/3.2.
					expectedSlimHeight: Math.round(winW / (16 / 3.5)),
				};
			})
			.catch((e) => `(eval failed: ${(e as Error).message})`);
		s.note(`bookmark detail cover state: ${JSON.stringify(detail)}`);
		await s.shot(bm, "02-bookmark-detail");

		// ── Calendar ───────────────────────────────────────────────────────
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2200);
		const tabGeom = await cal
			.evaluate(() => {
				const tabs = document.querySelector(".cal-toolbar__tabs") as HTMLElement | null;
				const newBtn = document.querySelector(".cal-toolbar__new") as HTMLElement | null;
				const search = document.querySelector(".cal-toolbar__search") as HTMLElement | null;
				return {
					tabsHeight: tabs ? Math.round(tabs.getBoundingClientRect().height) : null,
					newBtnHeight: newBtn ? Math.round(newBtn.getBoundingClientRect().height) : null,
					searchHeight: search ? Math.round(search.getBoundingClientRect().height) : null,
				};
			})
			.catch((e) => `(eval failed: ${(e as Error).message})`);
		s.note(`calendar tab heights (tabs should == new/search == 28): ${JSON.stringify(tabGeom)}`);
		await s.shot(cal, "03-calendar-header");
	} finally {
		await s.finish();
	}
});
