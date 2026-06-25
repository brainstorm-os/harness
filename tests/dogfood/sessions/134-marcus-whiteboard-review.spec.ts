/**
 * Session 134 — Marcus design-reviews the Whiteboard surface.
 *
 * The planning/strategy surface. Marcus checks the resting canvas, the tool
 * palette, the frame header, and the empty-nav state for consistency with the
 * rest of the product (chrome, spacing, affordance clarity). Spec posts
 * intent/neutral only; the design verdict is decided from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Whiteboard surface (134)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("134-marcus-whiteboard-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Reviewing the Whiteboard — the planning surface. Looking at the tool palette, the canvas chrome and whether it reads consistently with everything else.",
		);

		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(2200);
		await s.shot(wb, "01-resting");

		const tools = await wb
			.locator(".whiteboard__tool")
			.evaluateAll((els) =>
				els.map((e) => (e as HTMLElement).getAttribute("aria-label") || (e as HTMLElement).title || ""),
			)
			.catch(() => [] as string[]);
		s.note(`tool palette (${tools.length}): ${JSON.stringify(tools.filter(Boolean).slice(0, 16))}`);

		const headerRight = await wb
			.locator(".app-header__right, [class*='header__right']")
			.first()
			.locator("button")
			.evaluateAll((els) => els.map((e) => (e as HTMLElement).getAttribute("aria-label") || ""))
			.catch(() => [] as string[]);
		s.note(`header right-group: ${JSON.stringify(headerRight)}`);

		const frameHeader = await wb
			.locator(".whiteboard__frame-header")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 8),
			)
			.catch(() => [] as string[]);
		s.note(`frame header text: ${JSON.stringify(frameHeader)}`);

		s.chat(SPEAKER.Marcus, "Walked the canvas and palette — pulling my notes from the captures.");
		s.note("Marcus reviewed the Whiteboard surface; verdict from captures.");
	} finally {
		await s.finish();
	}
});
