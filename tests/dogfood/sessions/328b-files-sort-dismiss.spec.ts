/**
 * Session 328b — verify the Files "Sort by" popover dismisses on outside-press.
 *
 * The 328 every-button sweep flagged the Files sort/view popover as not closing
 * on an outside click (esc=true, outside=false). The shared `<Popover>` renders
 * a full-viewport `.bs-popover__backdrop` button with `onClick={onClose}`, so an
 * outside press SHOULD dismiss it. This isolates that one interaction to settle
 * whether it's a real dismiss bug or a sweep artifact — it screenshots the open
 * popover, presses the backdrop at a known-outside point, and reports.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Files sort popover dismisses on backdrop press (328b)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("328b-files-sort-dismiss");
	try {
		const page = await s.openApp(APP.Files);
		await page.waitForTimeout(2500);

		// The sort/view control lives in the toolbar row (NOT `.app-header`).
		const trigger = page.locator('[data-testid="toolbar-sort"]').first();
		await trigger.click();
		await page.waitForTimeout(500);

		const popover = page.locator(".bs-popover").first();
		const openedOk = await popover.isVisible().catch(() => false);
		s.note(`sort popover opened: ${openedOk}`);
		await s.shot(page, "sort-open");

		// Geometry: where is the panel vs the backdrop?
		const geo = await page.evaluate(() => {
			const root = document.querySelector(".bs-popover");
			const backdrop = document.querySelector(".bs-popover__backdrop");
			const panel = document.querySelector(".bs-popover__panel");
			const r = (el: Element | null) => {
				if (!el) return null;
				const b = el.getBoundingClientRect();
				return {
					x: Math.round(b.x),
					y: Math.round(b.y),
					w: Math.round(b.width),
					h: Math.round(b.height),
				};
			};
			return { root: r(root), backdrop: r(backdrop), panel: r(panel) };
		});
		s.note(`geometry: ${JSON.stringify(geo)}`);

		// Press a point that is on the backdrop but clearly OUTSIDE the panel.
		const vp = page.viewportSize() ?? { width: 1100, height: 720 };
		let px = 24;
		let py = vp.height - 24;
		if (geo.panel) {
			// Pick the gap above the panel if the panel is centred low, else below.
			py = geo.panel.y > 80 ? Math.round(geo.panel.y / 2) : geo.panel.y + geo.panel.h + 40;
			px = Math.round(vp.width / 2);
		}
		s.note(`pressing backdrop at (${px}, ${py})`);
		const topAtPoint = await page.evaluate(
			({ x, y }) => {
				const el = document.elementFromPoint(x, y);
				return el ? `${el.tagName}.${el.className}` : "none";
			},
			{ x: px, y: py },
		);
		s.note(`elementFromPoint(${px},${py}) = ${topAtPoint}`);

		await page.mouse.click(px, py);
		await page.waitForTimeout(400);
		const stillOpen = await popover.isVisible().catch(() => false);
		s.note(`popover still open after backdrop press: ${stillOpen}`);
		await s.shot(page, "after-backdrop-press");

		// Also confirm Escape closes (control).
		if (stillOpen) {
			await page.keyboard.press("Escape");
			await page.waitForTimeout(400);
			s.note(`popover open after Escape: ${await popover.isVisible().catch(() => false)}`);
		}

		expect(openedOk, "sort popover should open").toBe(true);
		expect(stillOpen, "sort popover should dismiss on backdrop/outside press").toBe(false);
	} finally {
		await s.finish();
	}
});
