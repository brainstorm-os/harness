/**
 * Session 333 — settings frost-in verification.
 *
 * The Settings panel suspends its backdrop-filter during the slide-in (perf),
 * then the frost was *snapping* on at settle — the look the user flagged as
 * bad. The fix transitions `backdrop-filter: none` → the resting `blur()` once
 * the panel is stationary. This spec proves the transition actually
 * INTERPOLATES (smooth) rather than jumping: it opens Settings and samples the
 * panel's computed backdrop-filter every animation frame, expecting to observe
 * intermediate blur radii between 0 and the resting value. Hard-fails if the
 * frost never interpolates (a snap) or never reaches the resting blur.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

function blurRadius(backdropFilter: string): number | null {
	if (!backdropFilter || backdropFilter === "none") return 0;
	const m = backdropFilter.match(/blur\(([\d.]+)px\)/);
	return m?.[1] ? Number.parseFloat(m[1]) : null;
}

test("settings frost-in interpolates (333)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("333-settings-frost-in");
	const { errors } = collectConsoleErrors(s.dashboard);

	try {
		await s.dashboard.waitForTimeout(600);
		await s.dashboard.getByRole("button", { name: "Settings", exact: true }).first().click();
		const panel = s.dashboard.locator('[data-testid="settings"] .settings__panel');
		await expect(panel).toBeVisible({ timeout: 10_000 });

		// Sample computed backdrop-filter every frame for ~1.4s, spanning the
		// slide (none) → settle → frost-in (none → blur) window.
		const samples: string[] = await panel.evaluate(
			(el) =>
				new Promise((resolve) => {
					const out: string[] = [];
					const start = performance.now();
					function tick() {
						out.push(getComputedStyle(el as Element).backdropFilter || "none");
						if (performance.now() - start < 1400) requestAnimationFrame(tick);
						else resolve(out);
					}
					requestAnimationFrame(tick);
				}),
		);

		const radii = samples.map(blurRadius).filter((r): r is number => r !== null);
		const distinct = [...new Set(radii)].sort((a, b) => a - b);
		const resting = Math.max(...radii);
		// Intermediate = a radius strictly between 0 and the resting value. A
		// snap would only ever show {0, resting}; interpolation shows in-betweens.
		const intermediates = distinct.filter((r) => r > 0.01 && r < resting - 0.01);

		s.note(`[frost] resting blur = ${resting}px`);
		s.note(`[frost] distinct radii observed = [${distinct.join(", ")}]`);
		s.note(`[frost] intermediate (interpolating) radii = [${intermediates.join(", ")}]`);

		await s.dashboard.waitForTimeout(400);
		await s.shot(s.dashboard, "01-settings-settled", panel);

		expect(resting, "panel never reached a resting blur").toBeGreaterThan(1);
		expect(
			intermediates.length,
			`frost snapped instead of interpolating — radii seen: [${distinct.join(", ")}]`,
		).toBeGreaterThan(0);
		expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
	} finally {
		await s.finish();
	}
});
