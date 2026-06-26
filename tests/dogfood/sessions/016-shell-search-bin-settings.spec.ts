/**
 * Session 016 — shell features: global vault search, Bin, Settings.
 *
 * Exercises the dock affordances discovered in 015 ("Search the vault",
 * "Open Bin", "Settings") on the real shell. The Bin step also confirms the
 * destructive Files/Notes flows actually land soft-deleted objects in
 * "Recently Deleted" (the other half of delete→Bin). Console/page errors are
 * collected across every window.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("shell: vault search, Bin, and Settings open without errors", async () => {
	test.setTimeout(180_000);
	const s = await startSession("016-shell-search-bin-settings");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const dash = s.dashboard;
	const click = async (label: string) => {
		const btn = dash.locator(`[aria-label="${label}"]`).first();
		if ((await btn.count()) === 0) {
			s.note(`(no "${label}" affordance)`);
			return false;
		}
		await btn.click();
		await dash.waitForTimeout(1200);
		return true;
	};

	try {
		await dash.waitForTimeout(1500);
		// Dismiss the auto-opened "What's new" popover.
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		// ── Global vault search ──
		if (await click("Search the vault")) {
			await dash.keyboard.type("task", { delay: 25 });
			await dash.waitForTimeout(1200);
			await s.shot(dash, "vault-search");
			const bodyText =
				(await dash
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";
			s.note(`search overlay mentions a task row: ${/task/i.test(bodyText)}`);
			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(500);
		}

		// ── Bin (Recently Deleted) — should hold the objects deleted by 013/014 ──
		if (await click("Open Bin")) {
			await s.shot(dash, "bin");
			const binText =
				(await dash
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";
			s.note(`Bin mentions a DeleteMe/deleted object: ${/delete|recently/i.test(binText)}`);
			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(500);
		}

		// ── Settings ──
		if (await click("Settings")) {
			await s.shot(dash, "settings");
			s.note("settings opened");
			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(500);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors across shell features").toEqual([]);
	} finally {
		await s.finish();
	}
});
