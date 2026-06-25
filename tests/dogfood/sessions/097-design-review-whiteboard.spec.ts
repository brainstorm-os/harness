/**
 * Session 097 — Marcus reviews the Whiteboard app.
 *
 * Fifth design review by the designer persona — a canvas surface (toolbar,
 * sticky design, connector affordance), distinct from list/grid/editor. Marcus
 * cares about the resting canvas (what guidance a blank board gives), the tool
 * palette, sticky defaults, and whether connecting is discoverable (the edge
 * handles are opacity:0 until node-hover — an echo of F-043).
 *
 * No app-source change → SKIP_BUILD.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("design review — Whiteboard (Marcus)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("097-design-review-whiteboard");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(1500);

		// The board with its content (stickies from 075) + toolbar + hint bar.
		await s.shot(wb, "01-board");

		// Hover a sticky — do the connection handles only appear now?
		const sticky = wb.locator(".whiteboard__node--sticky").first();
		if ((await sticky.count()) > 0) {
			await sticky.hover();
			await wb.waitForTimeout(300);
		}
		await s.shot(wb, "02-sticky-hovered");

		s.note("captured Whiteboard states for Marcus's review (critique in friction-log)");
	} finally {
		await s.finish();
	}
});
