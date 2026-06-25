/**
 * Session 330 — settings-polish visual sweep.
 *
 * Opens Settings on the real shell, walks every sidebar section, and shoots
 * each panel so the polish pass has ground-truth screenshots (the renderer
 * can't be eyeballed from unit tests). Also opens the AI provider credential
 * dialog (the surface this pass started from) and the MCP add-server dialog so
 * the content-fit popover change is visible.
 *
 * Not an assertion suite — it's a screenshot harness. It hard-fails only if
 * Settings never opens or a section logs a console error.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("settings polish sweep (330)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("330-settings-polish-sweep");
	const { errors } = collectConsoleErrors(s.dashboard);

	try {
		// Open Settings from the dashboard header (IconButton aria-label = "Settings").
		await s.dashboard.getByRole("button", { name: "Settings", exact: true }).first().click();
		const panel = s.dashboard.locator('[data-testid="settings"]');
		await expect(panel).toBeVisible({ timeout: 10_000 });
		await s.dashboard.waitForTimeout(600);

		const navItems = s.dashboard.locator(".settings__nav-item");
		const count = await navItems.count();
		s.note(`Settings has ${count} sidebar sections.`);

		for (let i = 0; i < count; i++) {
			const item = navItems.nth(i);
			const label = (await item.textContent())?.trim() ?? `section-${i}`;
			const slug = label
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "");
			await item.click();
			await s.dashboard.waitForTimeout(500);
			await s.shot(s.dashboard, `section-${String(i).padStart(2, "0")}-${slug}`, panel);
			s.note(`[shot] ${label}`);
		}

		// AI section → open the Anthropic credential dialog (the content-fit popover).
		const aiNav = s.dashboard.locator(".settings__nav-item", { hasText: "AI" }).first();
		if (await aiNav.isVisible().catch(() => false)) {
			await aiNav.click();
			await s.dashboard.waitForTimeout(400);
			const tile = s.dashboard.locator('[data-testid="ai-provider-anthropic"]');
			if (await tile.isVisible().catch(() => false)) {
				await tile.click();
				const dialog = s.dashboard.locator('[data-testid="ai-key-popover-anthropic"]');
				await expect(dialog).toBeVisible({ timeout: 5_000 });
				await s.dashboard.waitForTimeout(400);
				await s.shot(s.dashboard, "dialog-ai-key-anthropic", dialog);
				s.note("[shot] AI key dialog (Anthropic)");
				await s.dashboard.keyboard.press("Escape");
				await s.dashboard.waitForTimeout(300);
			}
		}

		if (errors.length > 0) {
			s.note(`Console errors during sweep:\n${errors.join("\n")}`);
		}
		expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
	} finally {
		await s.finish();
	}
});
