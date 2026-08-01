/**
 * Session 314 — POLISH-APP-5 evidence: Graph in both themes.
 *
 * The rubric's §1 both-themes pass for the Graph drain (11 dead fallbacks
 * dropped; presence chrome tokenized/annotated). The judgment target here is
 * the CANVAS: node/edge colors resolve from `--graph-*` tokens at runtime and
 * a MutationObserver reconciles the scene on theme change — the light pass
 * must show the light graph palette, not dark-resolved leftovers.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-5 — Graph both-themes evidence", async () => {
	test.setTimeout(300_000);
	const s = await startSession("314-polish-graph-both-themes");
	try {
		const gr = await s.openApp(APP.Graph);
		await gr.waitForTimeout(2500);

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
			await gr.waitForTimeout(2000);
		};

		await setAppearance(ThemePass.Dark);
		await s.shot(gr, "dark-01-canvas");

		await setAppearance(ThemePass.Light);
		await s.shot(gr, "light-01-canvas");

		await setAppearance(ThemePass.Dark);

		s.note("POLISH-APP-5 both-themes evidence captured (canvas recolor on theme flip)");
	} finally {
		await s.finish();
	}
});
