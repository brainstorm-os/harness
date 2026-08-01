/**
 * Session 324 — POLISH-APP-12 completion: the Notes flagship-editor deep pass.
 *
 * Capture-only; the plan explicitly owes Notes an extra-deep judgment pass
 * beyond the mechanical drain. Surfaces: a content-rich note body (headings,
 * lists, code, todo, quote — seeded live if absent), the slash `/` menu, the
 * inline selection toolbar, and the properties panel — both themes.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-12 — Notes deep audit sweep", async () => {
	test.setTimeout(480_000);
	const s = await startSession("324-audit-notes-deep");
	try {
		const nt = await s.openApp(APP.Notes);
		await nt.waitForTimeout(1800);

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
			await nt.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			// Block-rich body (the first sidebar note is the block-zoo note).
			await s.shot(nt, `${pass}-01-body`);

			// Click into the editor end, open the slash menu.
			const editor = nt.locator(".notes__doc [contenteditable='true']").first();
			if ((await editor.count()) > 0) {
				await editor.click();
				await nt.keyboard.press("Meta+ArrowDown");
				await nt.keyboard.press("Enter");
				await nt.keyboard.type("/", { delay: 50 });
				await nt.waitForTimeout(600);
				await s.shot(nt, `${pass}-02-slash-menu`);
				await nt.keyboard.press("Escape");
				await nt.keyboard.press("Backspace");

				// Inline selection toolbar over a line of text.
				await nt.keyboard.type("audit selection line", { delay: 4 });
				await nt.keyboard.press("Meta+Shift+ArrowLeft");
				await nt.waitForTimeout(600);
				await s.shot(nt, `${pass}-03-selection-toolbar`);
				// Unwind exactly what this sweep typed — never blind backspaces,
				// which once ate the probe note's title (repaired same session).
				await nt.keyboard.press("ArrowRight");
				for (let i = 0; i < 8; i += 1) await nt.keyboard.press("Meta+z");
			}

			// Properties panel (right toggle).
			const inspector = nt.getByRole("button", { name: /propert|inspector/i }).first();
			if ((await inspector.count()) > 0 && (await inspector.isEnabled())) {
				await inspector.click();
				await nt.waitForTimeout(600);
				await s.shot(nt, `${pass}-04-properties`);
				await inspector.click();
				await nt.waitForTimeout(300);
			}
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);
		s.note("POLISH-APP-12 deep sweep captured (body / slash / selection / properties × 2 themes)");
	} finally {
		await s.finish();
	}
});
