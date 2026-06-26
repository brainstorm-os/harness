/**
 * Session 026 — pin an object to the dashboard, verify the tile, unpin.
 *
 * Exercises the cross-app "Pin to dashboard" object-menu action + the
 * dashboard pin resolver: pin a Files object, confirm a dashboard icon
 * appears for it, then unpin so the dashboard is left as found. Console/page
 * errors captured across both windows.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Dashboard: pin an object then unpin it", async () => {
	test.setTimeout(180_000);
	const s = await startSession("026-dashboard-pin");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const dash = s.dashboard;
	const pinCount = () => dash.locator('[data-testid^="dashboard-icon-"]').count();

	try {
		await dash.waitForTimeout(1200);
		await dash.keyboard.press("Escape"); // dismiss what's-new
		const before = await pinCount();
		s.note(`dashboard icons before: ${before}`);

		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1800);

		const row = files.locator('[data-testid="content-row"]').first();
		await expect(row).toBeVisible({ timeout: 10_000 });
		const rowName = (await row.locator(".content-row__name").textContent())?.trim();

		// Right-click the row and click the menu option matching `re`. The
		// pin/unpin toggle label is "Pin to dashboard" / "Remove from dashboard".
		const menuClick = async (re: RegExp): Promise<boolean> => {
			await row.click({ button: "right" });
			await files.waitForTimeout(500);
			const opt = files.getByRole("option", { name: re }).first();
			if ((await opt.count()) === 0) {
				await files.keyboard.press("Escape");
				return false;
			}
			await opt.click();
			await files.waitForTimeout(1100);
			return true;
		};

		// Self-heal: if a prior run left it pinned, unpin first to get a clean base.
		if (await menuClick(/remove from dashboard/i)) {
			s.note("(self-heal) cleared a pre-existing pin");
			await dash.waitForTimeout(600);
		}
		const baseline = await pinCount();
		s.note(`dashboard icons baseline: ${baseline}`);

		// Pin.
		const pinned = await menuClick(/pin to dashboard/i);
		s.note(`pinned "${rowName}": ${pinned}`);
		await dash.waitForTimeout(800);
		const after = await pinCount();
		s.note(`dashboard icons after pin: ${after}`);
		await s.shot(dash, "after-pin");

		// Unpin (leave the dashboard as found).
		const unpinned = await menuClick(/remove from dashboard/i);
		s.note(`unpinned: ${unpinned}`);
		await dash.waitForTimeout(800);
		const final = await pinCount();
		s.note(`dashboard icons after unpin: ${final}`);

		expect(pinned, "the Pin-to-dashboard option should be present").toBe(true);
		expect(after, "pinning should add a dashboard icon").toBeGreaterThan(baseline);
		expect(unpinned, "the Remove-from-dashboard option should be present after pinning").toBe(true);
		expect(final, "unpinning should restore the baseline count").toBe(baseline);
		expect(errors, "no console/page errors during pin/unpin").toEqual([]);
	} finally {
		await s.finish();
	}
});
