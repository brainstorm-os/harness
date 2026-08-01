/**
 * Session 313 — POLISH-APP-4 evidence: Code editor in both themes.
 *
 * The rubric's §1 both-themes pass for the Code editor drain (14 dead
 * `var(--x, rgba…)` fallbacks dropped — hover/accent-soft fills, popover/xl
 * shadows, the sheet dimmer). Captures the file list + editor surface under
 * both appearances; selection fills and the hover rows are the affected
 * chrome.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-4 — Code editor both-themes evidence", async () => {
	test.setTimeout(300_000);
	const s = await startSession("313-polish-code-editor-both-themes");
	try {
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(1500);

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
			await ce.waitForTimeout(1500);
		};

		// Select the first file row (if the vault has code files) so the
		// accent-soft selection fill and the editor surface are in frame.
		const firstRow = ce.locator("[data-testid='code-file-row'], .code__row, .editor__row").first();
		if ((await firstRow.count()) > 0) {
			await firstRow.click();
			await ce.waitForTimeout(800);
		}

		const capture = async (pass: ThemePass) => {
			await s.shot(ce, `${pass}-01-editor`);
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);

		s.note("POLISH-APP-4 both-themes evidence captured (file list + editor)");
	} finally {
		await s.finish();
	}
});
