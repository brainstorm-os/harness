/**
 * Session 205c — final connector-styling probe: switch to the flowchart
 * board via the nav row, click the edge segment between the two shape
 * nodes, open Style. Also: does the whiteboard restore the last-open board?
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("connector style on the flowchart board (205c)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("205c-edge-style-probe2");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);
		const titleText = await wb
			.locator(".app-header")
			.first()
			.textContent()
			.catch(() => "");
		s.note(
			`board on open: "${titleText?.trim().slice(0, 60)}" (205's board was Untitled whiteboard)`,
		);

		const navRow = wb.locator(".whiteboard__nav-row", { hasText: "Untitled whiteboard" }).first();
		s.note(`nav row visible: ${await navRow.isVisible().catch(() => false)}`);
		await navRow.click().catch(() => undefined);
		await wb.waitForTimeout(1500);
		await s.shot(wb, "01-switched");

		const shapes = await wb
			.locator(".whiteboard__node--shape, .whiteboard__node--sticky")
			.evaluateAll((els) =>
				els.map((el) => {
					const r = el.getBoundingClientRect();
					return { x: r.x, y: r.y, w: r.width, h: r.height, cls: el.className.toString() };
				}),
			)
			.catch(() => []);
		s.note(`nodes on board: ${JSON.stringify(shapes)}`);
		const sorted = shapes.filter((n) => n.w > 50).sort((a, b) => a.x - b.x);
		if (sorted.length >= 2) {
			const n1 = sorted[0];
			const n2 = sorted.find((n) => n.x > n1.x + n1.w);
			if (n2) {
				const mx = (n1.x + n1.w + n2.x) / 2;
				const my = n1.y + n1.h / 2;
				s.note(`edge click at ${Math.round(mx)},${Math.round(my)}`);
				await wb.mouse.click(mx, my);
				await wb.waitForTimeout(700);
				await s.shot(wb, "02-edge-clicked");
				await wb
					.locator('[aria-label="Style"]')
					.first()
					.click()
					.catch(() => undefined);
				await wb.waitForTimeout(900);
				await s.shot(wb, "03-style-menu");
				const items = await wb
					.locator("[class*='menu']")
					.last()
					.textContent()
					.catch(() => "");
				s.note(`style menu text: ${items?.slice(0, 300)}`);
				await wb.keyboard.press("Escape").catch(() => undefined);
			}
		}
		await s.shot(wb, "04-final");
	} finally {
		await s.finish();
	}
});
