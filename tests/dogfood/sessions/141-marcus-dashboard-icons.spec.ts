/**
 * Session 141 — Marcus re-reviews the dashboard app-icons (changed surface).
 *
 * The dashboard launcher icons are being reworked (theme-following glossy
 * tiles). Marcus turns his consistency lens on the home screen: do the app
 * tiles read as one coherent set — consistent shape, glyph treatment, spacing?
 * Captures the dashboard directly. Spec posts intent/neutral; verdict from the
 * capture.
 */

import { test } from "@playwright/test";
import { SPEAKER, startSession } from "../lib/founder";

test("Marcus re-reviews the dashboard app-icons (141)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("141-marcus-dashboard-icons");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Re-checking the home screen — the app-icon tiles are mid-rework. Looking at whether they read as one coherent set: shape, glyph, spacing.",
		);

		await s.dashboard.waitForTimeout(1500);
		await s.shot(s.dashboard, "01-dashboard");

		const tileCount = await s.dashboard
			.locator(".app-icon, .app-icon__tile, [class*='app-icon']")
			.count()
			.catch(() => 0);
		s.note(`app-icon tiles found: ${tileCount}`);

		const appLabels = await s.dashboard
			.locator(
				"[class*='app-icon'] , [class*='launcher'] [class*='label'], [class*='icon'] [class*='name']",
			)
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 24),
			)
			.catch(() => [] as string[]);
		s.note(`launcher labels sample: ${JSON.stringify(appLabels)}`);

		s.chat(
			SPEAKER.Marcus,
			"Grabbed the home screen — pulling my read on the icon set from the capture.",
		);
		s.note("Marcus reviewed the dashboard app-icons; verdict from capture.");
	} finally {
		await s.finish();
	}
});
