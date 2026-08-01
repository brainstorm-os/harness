/**
 * Session 311 — POLISH-APP-2 evidence: Books in both themes.
 *
 * The rubric's §1 both-themes pass for the Books drain (reader page palettes
 * consolidated to per-mode anchors + color-mix, highlight palette single
 * :root declaration, PDF-page literals annotated). Captures the library +
 * reader with the type panel (mode swatches) and each reading mode, under
 * the dark and light app appearance — the interesting judgment is that the
 * user-picked page surface must NOT follow the app theme.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-2 — Books both-themes evidence", async () => {
	test.setTimeout(300_000);
	const s = await startSession("311-polish-books-both-themes");
	try {
		const bk = await s.openApp(APP.Books);
		await bk.waitForTimeout(1500);

		// The reader needs a book. With an empty library, import the generated
		// sample EPUB by stubbing the native open dialog (there is no in-vault
		// sample affordance — `library.openSample` is an orphaned key).
		if ((await bk.locator(".books__row").count()) === 0) {
			const epub = process.env.BRAINSTORM_POLISH_EPUB;
			if (!epub) throw new Error("set BRAINSTORM_POLISH_EPUB to the sample epub path");
			await s.app.evaluate(({ dialog }, path) => {
				dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
			}, epub);
			await bk.getByRole("button", { name: /import/i }).first().click();
			await bk.waitForTimeout(2500);
		}
		const row = bk.locator(".books__row").first();
		if ((await row.count()) > 0) {
			await row.click();
			await bk.waitForTimeout(1200);
		}

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
			await bk.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			await s.shot(bk, `${pass}-01-reader`);

			// Type panel open — mode swatches (White / Sepia / Night anchors).
			const typeBtn = bk.locator(".books__type-btn");
			if ((await typeBtn.count()) > 0) {
				await typeBtn.click();
				await bk.waitForTimeout(400);
				await s.shot(bk, `${pass}-02-type-panel`);

				// Sepia page under this app theme — the page must stay sepia.
				const sepia = bk.locator(".books__type-swatch--sepia");
				if ((await sepia.count()) > 0) {
					await sepia.click();
					await bk.waitForTimeout(400);
					await s.shot(bk, `${pass}-03-sepia-page`);
				}
				// Back to the theme-following default, then close via Escape —
				// the open panel overlays the toggle, so a second click can't land.
				const themeSwatch = bk.locator(".books__type-swatch--theme");
				if ((await themeSwatch.count()) > 0) await themeSwatch.click();
				await bk.keyboard.press("Escape");
				await bk.waitForTimeout(300);
			}
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);

		s.note("POLISH-APP-2 both-themes evidence captured (reader / type panel / sepia page)");
	} finally {
		await s.finish();
	}
});
