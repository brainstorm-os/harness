/**
 * Session 205b — focused probe: can Mira actually select a connector and
 * restyle it (9.17.16)? Clicks the straight segment between the two
 * flowchart-template nodes (edges render in Pixi, so no DOM target), then
 * opens Style. Also identifies the mystery blank right-side panel.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("edge selection + connector style menu (205b)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("205b-edge-style-probe");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);

		// Identify the large blank panel on the right, if present.
		const panelInfo = await wb
			.evaluate(() => {
				const hits: string[] = [];
				for (const el of Array.from(document.querySelectorAll("body *"))) {
					const r = el.getBoundingClientRect();
					if (r.width > 180 && r.height > 350 && r.left > window.innerWidth * 0.55) {
						const e = el as HTMLElement;
						hits.push(
							`${e.tagName}.${e.className} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)} children=${e.children.length} text="${e.textContent?.trim().slice(0, 40)}"`,
						);
					}
				}
				return hits;
			})
			.catch(() => [] as string[]);
		s.note(`right-side large elements: ${JSON.stringify(panelInfo, null, 1)}`);

		// Open the template board made in 205.
		await wb
			.getByText("Untitled whiteboard")
			.first()
			.click()
			.catch(() => undefined);
		await wb.waitForTimeout(1500);
		await s.shot(wb, "01-board");

		// Find the template nodes in DOM and click between the first two.
		const nodes = await wb
			.locator("[data-node-id], [class*='wb-node'], [class*='node']")
			.evaluateAll((els) =>
				els
					.map((el) => {
						const r = el.getBoundingClientRect();
						return { x: r.x, y: r.y, w: r.width, h: r.height, cls: el.className?.toString() };
					})
					.filter((r) => r.w > 60 && r.w < 600 && r.h > 40),
			)
			.catch(() => []);
		s.note(`candidate node boxes: ${JSON.stringify(nodes.slice(0, 6))}`);
		if (nodes.length >= 2) {
			const sorted = [...nodes].sort((a, b) => a.x - b.x);
			const n1 = sorted[0];
			const n2 = sorted.find((n) => n.x > n1.x + n1.w) ?? sorted[1];
			const mx = (n1.x + n1.w + n2.x) / 2;
			const my = n1.y + n1.h / 2;
			s.note(`clicking edge segment at ${Math.round(mx)},${Math.round(my)}`);
			await wb.mouse.click(mx, my);
			await wb.waitForTimeout(700);
			await s.shot(wb, "02-after-edge-click");

			const styleBtn = wb.locator('[aria-label="Style"]').first();
			await styleBtn.click().catch(() => undefined);
			await wb.waitForTimeout(900);
			await s.shot(wb, "03-style-menu-with-edge");
			const items = await wb
				.locator("[role='menu'] *, [class*='menu'] button, [class*='menu'] [class*='item']")
				.evaluateAll((els) =>
					Array.from(
						new Set(
							els.map((el) => el.textContent?.trim()).filter((t) => t && t.length > 2 && t.length < 40),
						),
					),
				)
				.catch(() => [] as (string | undefined)[]);
			s.note(`style menu entries: ${JSON.stringify(items)}`);
			const dashed = wb.getByText(/dash/i).first();
			if (await dashed.isVisible().catch(() => false)) {
				await dashed.click().catch(() => undefined);
				await wb.waitForTimeout(700);
				await s.shot(wb, "04-after-dash");
				s.chat(SPEAKER.Mira, "Connector restyled dashed — the GTM map can mark tentative paths now.");
			} else {
				await wb.keyboard.press("Escape").catch(() => undefined);
				s.note("no dash entry visible in Style menu after edge click");
			}
		} else {
			s.note("could not locate two template node boxes in DOM");
		}
		await s.shot(wb, "05-final");
	} finally {
		await s.finish();
	}
});
