/**
 * Session 310 — POLISH-APP-1 evidence: Whiteboard in both themes.
 *
 * The rubric's §1 both-themes pass for the Whiteboard drain (drift → tokens,
 * accent-soft nav selection, shared EmptyState in nav + layers, lock coverage
 * on rename/icon). Captures the same surfaces under the dark and light
 * appearance so the before/after evidence in the plan links here.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-1 — Whiteboard both-themes evidence", async () => {
	test.setTimeout(300_000);
	const s = await startSession("310-polish-whiteboard-both-themes");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(1500);

		// Give the board judgeable content: a sticky (tint + dark ink) and a
		// selected node (accent ring), and open the nav so the accent-soft
		// active row is visible.
		const canvas = wb.locator(".whiteboard__canvas-wrap");
		if ((await wb.locator(".whiteboard__node").count()) === 0) {
			await wb.getByRole("button", { name: "Sticky note", exact: true }).first().click();
			await canvas.click({ position: { x: 420, y: 260 } });
			await wb.keyboard.press("Escape");
			await wb.waitForTimeout(300);
			await wb.getByRole("button", { name: "Text", exact: true }).first().click();
			await canvas.click({ position: { x: 640, y: 380 } });
			await wb.keyboard.press("Escape");
			await wb.waitForTimeout(300);
		}
		await wb.locator(".whiteboard__node").first().click();
		await wb.waitForTimeout(200);
		const navToggle = wb.getByRole("button", { name: "Show board list" });
		if ((await navToggle.count()) > 0) {
			await navToggle.click();
			await wb.waitForTimeout(400);
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
			await wb.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			// Resting board: nodes (sticky tints, shapes), nav with the active
			// accent-soft row, floating toolbar + zoom capsules.
			await s.shot(wb, `${pass}-01-board`);

			// Layers panel — rows (or the shared compact empty state on a bare board).
			await wb.getByRole("button", { name: /layer/i }).first().click();
			await wb.waitForTimeout(400);
			await s.shot(wb, `${pass}-02-layers`);
			await wb.getByRole("button", { name: /layer/i }).first().click();
			await wb.waitForTimeout(300);

			// Nav search with no hits — the shared compact EmptyState (Search glyph).
			const search = wb.locator(".whiteboard__search input");
			await search.fill("zzz-no-such-board");
			await wb.waitForTimeout(400);
			await s.shot(wb, `${pass}-03-nav-empty-search`);
			await search.fill("");
			await wb.waitForTimeout(300);
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		// Leave the vault the way the fleet expects it.
		await setAppearance(ThemePass.Dark);

		s.note("POLISH-APP-1 both-themes evidence captured (board / layers / nav empty-search)");
	} finally {
		await s.finish();
	}
});
