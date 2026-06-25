/**
 * Session 322 — verify the 3-column layout RESIZE fix (2026-06-21).
 *
 * Bug report: "3 columns layout resize does not work." Root cause was two
 * compounding faults — `flex-basis:200px` made the grow-only resizer barely
 * move anything, and the grab target was a 2px pseudo sliver sitting in the
 * inter-column gap with a dead zone (closest(".notes__column") → null). Fix:
 * `flex:1 1 0` (proportional widths) + gap-midpoint hit-testing in
 * columns-plugin. This session inserts a 3-column layout in a real note,
 * records the three column widths, drags the MIDDLE divider, and records the
 * widths again — they must change for the fix to be real.
 */

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function columnWidths(page: Page): Promise<number[]> {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll(".notes__column")).map((el) =>
			Math.round(el.getBoundingClientRect().width),
		),
	);
}

async function columnRects(page: Page): Promise<DOMRect[]> {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll(".notes__column")).map((el) => {
			const r = el.getBoundingClientRect();
			return {
				x: r.x,
				y: r.y,
				width: r.width,
				height: r.height,
				right: r.right,
				left: r.left,
			} as DOMRect;
		}),
	);
}

test("3-column resize works (322)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("322-column-resize");
	try {
		const page = await s.openApp(APP.Notes);
		await page.waitForTimeout(2600);
		s.note("\n### notes — 3-column resize verification");

		// Fresh note so we start from a clean body.
		const newNote = page.locator('[aria-label="New note"]').first();
		await newNote.click();
		await page.waitForTimeout(1200);

		const editor = page.locator(".notes__contenteditable").first();
		await editor.click();
		await page.waitForTimeout(400);

		// Insert a 3-column layout via the slash menu ("three" is unique to
		// block.columns3), selecting the highlighted match with Enter.
		await page.keyboard.type("/three");
		await page.waitForTimeout(900);
		await s.shot(page, "slash-three");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(1000);

		const cols = await columnWidths(page);
		s.note(`columns after insert: count=${cols.length} widths=[${cols.join(", ")}]`);
		await s.shot(page, "after-insert");

		if (cols.length !== 3) {
			s.note(`FAIL: expected 3 columns, got ${cols.length}`);
			return;
		}

		// Drag the MIDDLE divider — the boundary between column index 1 and 2,
		// the exact one the report said was unhittable.
		const rects = await columnRects(page);
		const a = rects[1];
		const b = rects[2];
		if (!a || !b) {
			s.note("FAIL: could not read middle column rects");
			return;
		}
		const midX = (a.right + b.left) / 2;
		const midY = a.y + a.height / 2;
		s.note(`middle divider at x=${Math.round(midX)} y=${Math.round(midY)}`);

		// Drag it left by 90px — col index 1 should shrink, col index 2 grow.
		await page.mouse.move(midX, midY);
		await page.waitForTimeout(150);
		await page.mouse.down();
		await page.mouse.move(midX - 45, midY, { steps: 8 });
		await page.mouse.move(midX - 90, midY, { steps: 8 });
		await page.waitForTimeout(150);
		await page.mouse.up();
		await page.waitForTimeout(600);

		const after = await columnWidths(page);
		s.note(`columns after MIDDLE drag -90px: widths=[${after.join(", ")}]`);
		await s.shot(page, "after-middle-drag");

		const c1Before = cols[1] ?? 0;
		const c2Before = cols[2] ?? 0;
		const c1After = after[1] ?? 0;
		const c2After = after[2] ?? 0;
		const c1Delta = c1After - c1Before;
		const c2Delta = c2After - c2Before;
		s.note(`middle col Δ=${c1Delta} right col Δ=${c2Delta}`);
		const middleWorks = Math.abs(c1Delta) > 20 && Math.sign(c1Delta) !== Math.sign(c2Delta);
		s.note(
			middleWorks
				? "PASS: middle divider resizes (cols retracked)"
				: "FAIL: middle divider did NOT resize",
		);

		// Also exercise the FIRST divider (between col 0 and 1).
		const r2 = await columnRects(page);
		const f0 = r2[0];
		const f1 = r2[1];
		if (f0 && f1) {
			const fx = (f0.right + f1.left) / 2;
			const fy = f0.y + f0.height / 2;
			const before2 = await columnWidths(page);
			await page.mouse.move(fx, fy);
			await page.mouse.down();
			await page.mouse.move(fx + 70, fy, { steps: 10 });
			await page.mouse.up();
			await page.waitForTimeout(500);
			const after2 = await columnWidths(page);
			s.note(`first divider: before=[${before2.join(", ")}] after=[${after2.join(", ")}]`);
			await s.shot(page, "after-first-drag");
			const d0 = (after2[0] ?? 0) - (before2[0] ?? 0);
			s.note(d0 > 20 ? "PASS: first divider resizes" : "FAIL: first divider did NOT resize");
		}
	} finally {
		await s.finish();
	}
});
