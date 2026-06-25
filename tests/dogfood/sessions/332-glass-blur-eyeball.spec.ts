/**
 * Session 332 — glass-blur eyeball pass.
 *
 * Captures the three glass surfaces affected by the `--glass-blur` 20px → 10px
 * reduction so the look can be eyeballed on the real shell: the dashboard
 * chrome (header/footer glass over the wallpaper), an app window header
 * (`.app-header` glass), and the Settings panel (`.glass--strong`, which also
 * suspends its backdrop-filter during the slide-in). Screenshot harness, not an
 * assertion suite — hard-fails only if a surface never appears or logs a
 * console error.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("glass blur eyeball (332)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("332-glass-blur-eyeball");
	const { errors } = collectConsoleErrors(s.dashboard);

	try {
		// Dashboard chrome — header + footer glass over the wallpaper.
		await s.dashboard.waitForTimeout(600);
		await s.shot(s.dashboard, "01-dashboard-chrome");
		s.note("[shot] dashboard chrome (glass header/footer at 10px)");

		// App window — `.app-header` glass.
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(800);
		await s.shot(notes, "02-app-header-notes");
		s.note("[shot] Notes app-header glass at 10px");

		// Settings panel — `.glass--strong`, blur suspended during slide-in then
		// restored on settle. Capture after the entrance completes.
		await s.dashboard.getByRole("button", { name: "Settings", exact: true }).first().click();
		const panel = s.dashboard.locator('[data-testid="settings"]');
		await expect(panel).toBeVisible({ timeout: 10_000 });
		await s.dashboard.waitForTimeout(700);
		await s.shot(s.dashboard, "03-settings-panel", panel);
		s.note("[shot] Settings panel glass--strong at 10px (settled)");

		if (errors.length > 0) s.note(`Console errors:\n${errors.join("\n")}`);
		expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
	} finally {
		await s.finish();
	}
});
