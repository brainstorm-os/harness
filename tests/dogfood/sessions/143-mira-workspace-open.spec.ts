/**
 * Session 143 — Mira opens her workspace (and we re-check F-069).
 *
 * A founder's start-of-day glance at the home screen — natural for Mira, and it
 * lets us re-check F-069 (were the app-icon glyphs showing initials-fallback, and
 * did the `build:app-icons` step bring them back?). Captures the dashboard. Spec
 * posts intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { SPEAKER, startSession } from "../lib/founder";

test("Mira opens her workspace; re-check dashboard icons (143)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("143-mira-workspace-open");
	try {
		s.chat(SPEAKER.Mira, "Opening up for the day — quick glance at the home screen.");

		await s.dashboard.waitForTimeout(1500);
		await s.shot(s.dashboard, "01-dashboard");

		const initials = await s.dashboard
			.locator(".app-icon__initials")
			.count()
			.catch(() => 0);
		const glyphStats = await s.dashboard
			.locator("[class*='app-icon'] img")
			.evaluateAll((imgs) => ({
				total: imgs.length,
				loaded: imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length,
			}))
			.catch(() => ({ total: 0, loaded: 0 }));
		s.note(
			`dashboard icons — initials spans: ${initials}, glyph imgs: ${glyphStats.total}, of which LOADED: ${glyphStats.loaded}`,
		);

		s.note("Mira opened the workspace; F-069 verdict from capture + counts.");
	} finally {
		await s.finish();
	}
});
