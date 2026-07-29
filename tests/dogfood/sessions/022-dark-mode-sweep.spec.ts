/**
 * Session 022 — dark-mode sweep across every app.
 *
 * The project has a documented history of dark-theme regressions (phantom CSS
 * tokens collapsing to light-theme rgba fallbacks → unreadable text on dark).
 * This flips the shell to Dark appearance, then opens every app and
 * screenshots it for a contrast/readability review, capturing console errors.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("dark mode: every app renders without console errors (visual review)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("022-dark-mode-sweep");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(1200);
		await dash.keyboard.press("Escape"); // dismiss what's-new

		// Ensure Dark appearance. The toggle's label depends on the current
		// mode ("Switch to Dark…" when light, "Switch to Light…" when already
		// dark), and the shell persists the choice across runs — so only click
		// when we're currently in light mode.
		const toDark = dash.locator('[aria-label="Switch to Dark appearance"]').first();
		if ((await toDark.count()) > 0) {
			await toDark.click();
			await dash.waitForTimeout(1000);
			s.note("flipped to Dark appearance");
		} else {
			s.note("already in Dark appearance");
		}
		await s.shot(dash, "dashboard-dark");

		// Open every app and capture it in dark mode for visual review.
		for (const [name, id] of Object.entries(APP)) {
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(1400);
				await s.shot(page, `dark-${name.toLowerCase()}`);
				s.note(`✓ ${name} captured (dark)`);
			} catch (e) {
				s.note(`✗ ${name}: ${(e as Error).message.split("\n")[0]}`);
			}
		}

		s.note(`\nconsole/page errors in dark mode: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 25)) s.note(`  ${e}`);

		// Restore Light appearance so the shared vault is left as found.
		const toLight = dash.locator('[aria-label="Switch to Light appearance"]').first();
		if ((await toLight.count()) > 0) {
			await toLight.click();
			await dash.waitForTimeout(400);
		}

		expect(errors, "no console/page errors in dark mode").toEqual([]);
	} finally {
		await s.finish();
	}
});
