/**
 * Session 320 — POLISH-APP-11..14 evidence: Preview, Notes, Form designer,
 * and Bookmarks in both themes.
 *
 * The rubric's §1 both-themes pass for the last four measured drains — with
 * these, the design-drift baseline is EMPTY fleet-wide. One resting capture
 * per app per appearance; the deliberate literals (PDF/paper pages, the
 * Notes media scrim constants) are design-ok'd, everything else rides
 * tokens.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-11..14 — small drains both-themes evidence", async () => {
	test.setTimeout(420_000);
	const s = await startSession("320-polish-small-drains-both-themes");
	try {
		const apps = [
			{ id: APP.Preview, name: "preview" },
			{ id: APP.Notes, name: "notes" },
			{ id: APP.FormDesigner, name: "form-designer" },
			{ id: APP.Bookmarks, name: "bookmarks" },
		] as const;

		const setAppearance = async (mode: ThemePass) => {
			await s.dashboard.evaluate(
				async (m) => {
					type BW = {
						brainstorm: {
							dashboard: {
								setAppearanceMode: (x: string) => Promise<void>;
								setTheme: (t: string) => Promise<void>;
							};
						};
					};
					const bs = (window as unknown as BW).brainstorm;
					await bs.dashboard.setAppearanceMode(m);
					await bs.dashboard.setTheme(m === "light" ? "default-light" : "default-dark");
				},
				mode === ThemePass.Light ? "light" : "dark",
			);
			await s.dashboard.waitForTimeout(1500);
		};

		const pages = new Map<string, Awaited<ReturnType<typeof s.openApp>>>();
		for (const a of apps) {
			pages.set(a.name, await s.openApp(a.id));
			await s.dashboard.waitForTimeout(600);
		}

		for (const pass of [ThemePass.Dark, ThemePass.Light]) {
			await setAppearance(pass);
			for (const a of apps) {
				const p = pages.get(a.name);
				if (!p) continue;
				await p.waitForTimeout(300);
				await s.shot(p, `${pass}-${a.name}`);
			}
		}

		await setAppearance(ThemePass.Dark);
		s.note("POLISH-APP-11..14 both-themes evidence captured (4 apps × 2 themes)");
	} finally {
		await s.finish();
	}
});
