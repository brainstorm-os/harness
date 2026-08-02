/**
 * Probe 921 — the dashboard light/dark toggle, end to end in the real shell.
 *
 * Owner report (2026-08-02, 5th recurrence): clicking the light/dark switch
 * "does not work". Unit suites for the chain are green, so this drives the
 * REAL click path — header button → IPC → dashboard store → broadcast →
 * ThemeProvider repaint — and records exactly which link breaks, instead of
 * patching blind.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("921 — clicking the appearance toggle flips the shell theme, twice", async () => {
	test.setTimeout(240_000);
	const s = await startSession("921-probe-appearance-toggle");
	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(2000);

		const state = () =>
			dash.evaluate(() => ({
				theme: document.documentElement.dataset.theme ?? "(unset)",
				bg: getComputedStyle(document.documentElement).getPropertyValue("--color-bg-base").trim(),
			}));

		const before = await state();
		s.note(`before: theme=${before.theme} bg=${before.bg}`);

		const toggle = dash.getByRole("button", { name: /Switch to (Light|Dark) appearance/ });
		await expect(toggle, "the appearance toggle button must be present").toHaveCount(1);
		const label1 = await toggle.getAttribute("aria-label");
		s.note(`toggle label: ${label1}`);
		await s.shot(dash, "01-before");

		await toggle.click();
		await dash.waitForTimeout(1500);
		const after = await state();
		s.note(`after 1st click: theme=${after.theme} bg=${after.bg}`);
		await s.shot(dash, "02-after-first-click");
		expect(after.theme, "first click must change the :root theme").not.toBe(before.theme);

		await toggle.click();
		await dash.waitForTimeout(1500);
		const restored = await state();
		s.note(`after 2nd click: theme=${restored.theme} bg=${restored.bg}`);
		await s.shot(dash, "03-after-second-click");
		expect(restored.theme, "second click must flip back").toBe(before.theme);
	} finally {
		await s.finish();
	}
});
