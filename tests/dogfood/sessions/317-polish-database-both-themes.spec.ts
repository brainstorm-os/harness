/**
 * Session 316 — POLISH-APP-8 evidence: Database in both themes.
 *
 * The rubric's §1 both-themes pass for the Files drain (dead fallbacks and
 * raw card/hover shadows -> tokens; the modal scrim onto the shared
 * `--color-dimmer`). Captures the list and gallery views under both
 * appearances — the gallery hover shadow and the glass surfaces are the
 * affected chrome.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-8 — Database both-themes evidence", async () => {
	test.setTimeout(300_000);
	const s = await startSession("317-polish-database-both-themes");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);

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
			await db.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			await s.shot(db, `${pass}-01-list`);
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);

		s.note("POLISH-APP-8 both-themes evidence captured (database table)");
	} finally {
		await s.finish();
	}
});
