/**
 * Probe 922 — reproduce the owner's dead light/dark toggle (2026-08-02).
 *
 * The owner's vault has light-slot theme "porcelain" (merged 12:15:15) while
 * the running shell's renderer bundle predates the theme. Hypothesis: an
 * unknown theme name makes `applyThemeVars` throw (`FLATTENED[name]` is
 * undefined), killing the repaint before `dataset.theme` is written — the
 * toggle looks dead. This probe mirrors that exact state against whatever
 * renderer build is on disk and records whether the flip survives.
 *
 * Restores the Northbound vault's appearance state on exit (permanent vault).
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("922 — toggle with a porcelain light slot (owner's vault state)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("922-probe-porcelain-toggle-skew");
	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(2000);

		const pageErrors: string[] = [];
		dash.on("pageerror", (err) => pageErrors.push(err.message));

		type BW = {
			brainstorm: {
				dashboard: {
					setAppearanceMode: (m: string) => Promise<void>;
					setAppearancePair: (
						slot: string,
						pair: { theme: string; wallpaper: { kind: string; value: string } },
					) => Promise<void>;
				};
			};
		};

		// Mirror the owner's state: dark=nord (known), light=porcelain (new).
		await dash.evaluate(async () => {
			const bs = (window as unknown as BW).brainstorm;
			await bs.dashboard.setAppearancePair("dark", {
				theme: "nord",
				wallpaper: { kind: "solid", value: "#161616" },
			});
			await bs.dashboard.setAppearancePair("light", {
				theme: "porcelain",
				wallpaper: { kind: "solid", value: "#f7f7f7" },
			});
			await bs.dashboard.setAppearanceMode("dark");
		});
		await dash.waitForTimeout(1500);

		const theme = () => dash.evaluate(() => document.documentElement.dataset.theme ?? "(unset)");
		const before = await theme();
		s.note(`before: theme=${before}`);
		await s.shot(dash, "01-dark-nord");

		const toggle = dash.getByRole("button", { name: /Switch to (Light|Dark) appearance/ });
		await toggle.click();
		await dash.waitForTimeout(1500);
		const after = await theme();
		s.note(`after click to light: theme=${after} pageErrors=${JSON.stringify(pageErrors)}`);
		await s.shot(dash, "02-after-toggle-to-light");

		expect(after, "toggle into the porcelain slot must repaint the shell").toBe("porcelain");
		expect(pageErrors, "no renderer exceptions during the flip").toEqual([]);
	} finally {
		// Leave Mira's desk as the default pair, dark mode (matches probe 921's end state).
		try {
			await s.dashboard.evaluate(async () => {
				const bs = (
					window as unknown as {
						brainstorm: {
							dashboard: {
								setAppearanceMode: (m: string) => Promise<void>;
								setTheme: (t: string) => Promise<void>;
							};
						};
					}
				).brainstorm;
				await bs.dashboard.setTheme("default-light");
				await bs.dashboard.setTheme("default-dark");
				await bs.dashboard.setAppearanceMode("dark");
			});
		} catch {
			// best-effort restore
		}
		await s.finish();
	}
});
