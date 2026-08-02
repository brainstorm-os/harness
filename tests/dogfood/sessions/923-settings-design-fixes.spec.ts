/**
 * Probe 923 — after-shots for the 2026-08-02 settings design fixes (F-481).
 *
 * Captures the surfaces the strict design pass touched: Backup & Migration
 * (de-glossed Neutral chooser buttons, space-3 button padding, no hover
 * elevation on static cards) and Network (Md fields beside Md buttons,
 * centered add-rows). Screenshot harness — hard-fails only if Settings
 * doesn't open or the sections error.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("923 — settings design-fix after-shots", async () => {
	test.setTimeout(300_000);
	const s = await startSession("923-settings-design-fixes");
	try {
		const dash = s.dashboard;
		await dash.getByRole("button", { name: "Settings", exact: true }).first().click();
		const panel = dash.locator('[data-testid="settings"]');
		await expect(panel).toBeVisible({ timeout: 10_000 });
		await dash.waitForTimeout(600);

		const openSection = async (label: string) => {
			await dash.locator(".settings__nav-item", { hasText: label }).first().click();
			await dash.waitForTimeout(800);
		};

		await openSection("Backup & Migration");
		const pad = await dash
			.locator(".backup-migration .button--neutral")
			.first()
			.evaluate((el) => {
				const cs = getComputedStyle(el);
				return { left: cs.paddingLeft, bg: cs.backgroundImage, shadow: cs.boxShadow };
			});
		s.note(`neutral chooser: padding-left=${pad.left} background-image=${pad.bg}`);
		expect(pad.left, "md button side padding is space-3").toBe("12px");
		expect(pad.bg, "neutral face carries no gloss gradient").toBe("none");
		await s.shot(dash, "01-backup-migration", panel);

		await openSection("Network");
		await s.shot(dash, "02-network", panel);
	} finally {
		await s.finish();
	}
});
