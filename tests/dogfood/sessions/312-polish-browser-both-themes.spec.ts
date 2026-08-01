/**
 * Session 312 — POLISH-APP-3 evidence: Browser in both themes.
 *
 * The rubric's §1 both-themes pass for the Browser drain (17 dead light-hex
 * `var(--x, #…)` fallbacks dropped from the chrome). The dropped fallbacks
 * were all light-theme values, so the dark pass is the one that would expose
 * a live fallback: any chrome that leaned on a `#111`/`#555`/`#e3e3e3`
 * fallback would now render unthemed. Captures the start page + tab strip
 * and the history menu under both appearances. No external navigation — the
 * start page and chrome are the judgment surfaces.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-3 — Browser both-themes evidence", async () => {
	test.setTimeout(300_000);
	const s = await startSession("312-polish-browser-both-themes");
	try {
		const br = await s.openApp(APP.Browser);
		await br.waitForTimeout(1500);

		const setAppearance = async (pass: ThemePass) => {
			await s.dashboard.evaluate(
				async (mode) => {
					type BW = {
						brainstorm: {
							dashboard: {
								setAppearanceMode: (m: string) => Promise<void>;
								setTheme: (t: string) => Promise<void>;
							};
						};
					};
					const bs = (window as unknown as BW).brainstorm;
					await bs.dashboard.setAppearanceMode(mode);
					await bs.dashboard.setTheme(mode === "light" ? "default-light" : "default-dark");
				},
				pass === ThemePass.Light ? "light" : "dark",
			);
			await br.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			await s.shot(br, `${pass}-01-start-page`);

			const historyBtn = br.getByRole("button", { name: /history/i }).first();
			if ((await historyBtn.count()) > 0) {
				await historyBtn.click();
				await br.waitForTimeout(400);
				await s.shot(br, `${pass}-02-history-menu`);
				await br.keyboard.press("Escape");
				await br.waitForTimeout(300);
			}
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);

		s.note("POLISH-APP-3 both-themes evidence captured (start page / history menu)");
	} finally {
		await s.finish();
	}
});
