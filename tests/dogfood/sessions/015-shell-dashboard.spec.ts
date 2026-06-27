/**
 * Session 015 — shell-level dogfood: dashboard, search, pins, settings.
 *
 * Discovery + interaction pass over the shell renderer itself (the
 * `s.dashboard` page), the surface the per-app sweeps don't touch. Captures
 * the dashboard, dumps its interactive testids/aria affordances for triage,
 * exercises the app-grid search, and collects console/page errors.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("shell: dashboard renders, search works, no console errors", async () => {
	test.setTimeout(180_000);
	const s = await startSession("015-shell-dashboard");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(1500);
		await s.shot(dash, "dashboard");

		// Inventory the interactive affordances so the next pass can target them.
		const inventory = await dash.evaluate(() => {
			const testids = new Set<string>();
			for (const el of Array.from(document.querySelectorAll("[data-testid]"))) {
				testids.add(el.getAttribute("data-testid") ?? "");
			}
			const labels = new Set<string>();
			for (const el of Array.from(document.querySelectorAll("[aria-label]")).slice(0, 60)) {
				labels.add(el.getAttribute("aria-label") ?? "");
			}
			return { testids: [...testids], labels: [...labels] };
		});
		s.note("=== dashboard data-testids ===");
		for (const t of inventory.testids.sort()) s.note(`  ${t}`);
		s.note("\n=== dashboard aria-labels (first 60) ===");
		for (const l of inventory.labels.sort()) s.note(`  ${l}`);

		// Exercise the app-grid search (Spotlight-style launcher/search).
		const search = dash.locator('[data-testid="app-grid-search"]');
		if ((await search.count()) > 0) {
			await search.click();
			await search.fill("task");
			await dash.waitForTimeout(800);
			await s.shot(dash, "search-task");
			const cellCount = await dash.locator("[data-app-grid-cell]").count();
			s.note(`\napp-grid cells visible for query "task": ${cellCount}`);
		} else {
			s.note("\nno app-grid-search found on dashboard");
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors on the dashboard").toEqual([]);
	} finally {
		await s.finish();
	}
});
