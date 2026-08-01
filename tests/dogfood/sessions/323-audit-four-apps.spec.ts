/**
 * Session 323 — POLISH-APP-17..20 audit sweep: Mailbox, Contacts,
 * Automations, Theme editor in both themes.
 *
 * Capture-only; findings come from reviewing the shots against
 * docs/dogfood/app-design-audit.md. One resting capture per app per theme,
 * plus a first-row click where a list is visible so a detail/selected state
 * is in frame.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-17..20 — four-app audit sweep", async () => {
	test.setTimeout(480_000);
	const s = await startSession("323-audit-four-apps");
	try {
		const apps = [
			{ id: APP.Mailbox, name: "mailbox" },
			{ id: APP.Contacts, name: "contacts" },
			{ id: APP.Automations, name: "automations" },
			{ id: APP.ThemeEditor, name: "theme-editor" },
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
			await s.dashboard.waitForTimeout(700);
		}

		for (const pass of [ThemePass.Dark, ThemePass.Light]) {
			await setAppearance(pass);
			for (const a of apps) {
				const p = pages.get(a.name);
				if (!p) continue;
				await p.waitForTimeout(400);
				await s.shot(p, `${pass}-${a.name}`);
			}
		}

		await setAppearance(ThemePass.Dark);
		s.note("POLISH-APP-17..20 audit sweep captured (4 apps × 2 themes)");
	} finally {
		await s.finish();
	}
});
