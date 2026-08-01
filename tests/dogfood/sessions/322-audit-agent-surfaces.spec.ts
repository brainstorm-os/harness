/**
 * Session 322 — POLISH-APP-16 audit sweep: Agent app surfaces in both themes.
 *
 * Capture-only; findings come from reviewing the shots against
 * docs/dogfood/app-design-audit.md. Surfaces: conversation sidebar +
 * an existing conversation's thread (assistant markdown, citations,
 * created-chips if present), the composer with a typed draft, and the
 * resting/empty state.
 *
 * No model calls — nothing is sent; the draft is typed and cleared.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-16 — Agent audit sweep", async () => {
	test.setTimeout(420_000);
	const s = await startSession("322-audit-agent-surfaces");
	try {
		const ag = await s.openApp(APP.Agent);
		await ag.waitForTimeout(1800);

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
			await ag.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			await s.shot(ag, `${pass}-01-resting`);

			// The app opens with the sidebar collapsed — open it via its toggle
			// so the conversation rows are visible (and judgeable) first.
			const showSidebar = ag.getByRole("button", { name: "Show conversations" });
			if ((await showSidebar.count()) > 0) {
				await showSidebar.click();
				await ag.waitForTimeout(500);
			}
			const convs = ag.locator(".agent__conv");
			const n = await convs.count();
			if (n > 0 && (await convs.first().isVisible())) {
				await convs.first().click();
				await ag.waitForTimeout(800);
				await s.shot(ag, `${pass}-02-thread-a`);
			}
			if (n > 1 && (await convs.nth(1).isVisible())) {
				await convs.nth(1).click();
				await ag.waitForTimeout(800);
				await s.shot(ag, `${pass}-03-thread-b`);
			}

			// Composer with a typed draft (not sent).
			const input = ag.locator(".agent__input").first();
			if ((await input.count()) > 0) {
				await input.click();
				await ag.keyboard.type("Design audit draft — composer chrome check", { delay: 4 });
				await ag.waitForTimeout(300);
				await s.shot(ag, `${pass}-04-composer-draft`);
				for (let i = 0; i < 45; i += 1) await ag.keyboard.press("Backspace");
				await ag.waitForTimeout(200);
			}
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);
		s.note("POLISH-APP-16 audit sweep captured (threads / composer × 2 themes)");
	} finally {
		await s.finish();
	}
});
