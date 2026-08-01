/**
 * Session 315 — POLISH-APP-6 evidence: Tasks in both themes.
 *
 * The rubric's §1 both-themes pass for the Tasks drain (10 dead fallbacks /
 * raw shadows -> tokens) plus the POLISH-DSN-4 follow-up: the Group-by and
 * Sort header triggers now wear the shared `.bs-select` face beside the
 * other toolbar controls instead of the ghost text style.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-6 — Tasks both-themes evidence", async () => {
	test.setTimeout(300_000);
	const s = await startSession("315-polish-tasks-both-themes");
	try {
		const tk = await s.openApp(APP.Tasks);
		await tk.waitForTimeout(1500);

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
			await tk.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			await s.shot(tk, `${pass}-01-list`);
			// Group-by menu open off its new .bs-select trigger.
			const groupBtn = tk.locator(".tasks-surface__picker").first();
			if ((await groupBtn.count()) > 0) {
				await groupBtn.click();
				await tk.waitForTimeout(400);
				await s.shot(tk, `${pass}-02-group-menu`);
				await tk.keyboard.press("Escape");
				await tk.waitForTimeout(200);
			}
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);

		s.note("POLISH-APP-6 both-themes evidence captured (list + bs-select group trigger)");
	} finally {
		await s.finish();
	}
});
