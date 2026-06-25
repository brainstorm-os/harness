/**
 * Session 150 — Marcus re-checks the dashboard GRID LAYOUT (changed surface).
 *
 * The launcher grid (`dashboard/grid.ts`) is being reworked. Marcus looks at the
 * layout specifically: are the tiles aligned on a consistent grid, evenly spaced,
 * wrapping cleanly — not the glyphs (covered in 141/143). Captures the dashboard.
 * Spec posts intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { SPEAKER, startSession } from "../lib/founder";

test("Marcus re-checks the dashboard grid layout (150)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("150-marcus-dashboard-grid");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Re-checking the launcher grid — the layout code's changed. Looking at alignment, spacing and wrapping, not the glyphs this time.",
		);

		await s.dashboard.waitForTimeout(1500);
		await s.shot(s.dashboard, "01-dashboard-grid");

		// Read tile bounding boxes to sanity-check alignment (rows share a top,
		// columns share a left, gaps are even).
		const boxes = await s.dashboard
			.locator("[class*='app-icon']")
			.evaluateAll((els) =>
				els
					.slice(0, 24)
					.map((e) => {
						const r = (e as HTMLElement).getBoundingClientRect();
						return {
							x: Math.round(r.x),
							y: Math.round(r.y),
							w: Math.round(r.width),
							h: Math.round(r.height),
						};
					})
					.filter((b) => b.w > 0 && b.h > 0),
			)
			.catch(() => [] as Array<{ x: number; y: number; w: number; h: number }>);
		const rowTops = Array.from(new Set(boxes.map((b) => b.y))).sort((a, b) => a - b);
		const widths = Array.from(new Set(boxes.map((b) => b.w)));
		s.note(
			`tiles measured: ${boxes.length}; distinct row-tops: ${JSON.stringify(rowTops.slice(0, 6))}; distinct widths: ${JSON.stringify(widths)}`,
		);

		s.chat(SPEAKER.Marcus, "Measured the grid — pulling my read from the capture + box metrics.");
		s.note("Marcus re-checked the dashboard grid layout; verdict from capture + metrics.");
	} finally {
		await s.finish();
	}
});
