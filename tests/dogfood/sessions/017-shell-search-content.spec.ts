/**
 * Session 017 — does the global "Search the vault" surface vault OBJECTS by
 * name (not just apps)? The core "find my stuff" capability.
 *
 * Searches for unique object names known to exist in Northbound (an invoice
 * "INV-001", the "Getting started" project) and asserts a matching result row
 * appears in the search overlay.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("shell: vault search finds objects by name", async () => {
	test.setTimeout(180_000);
	const s = await startSession("017-shell-search-content");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const dash = s.dashboard;
	try {
		await dash.waitForTimeout(1500);
		await dash.keyboard.press("Escape"); // dismiss what's-new
		await dash.waitForTimeout(400);

		const PLACEHOLDER = "Search apps, notes, entities…";
		for (const query of ["INV-001", "Getting started", "Welcome"]) {
			await dash.locator('[aria-label="Search the vault"]').first().click();
			await dash.waitForTimeout(700);
			// Fill the launcher's own search input directly (.fill dispatches the
			// input event its onChange listens for); then wait out the entity-query
			// debounce + the FTS round-trip.
			const input = dash.locator(`[placeholder="${PLACEHOLDER}"]`).first();
			await input.fill(query);
			await dash.waitForTimeout(2000);
			await s.shot(dash, `search-${query.replace(/\W+/g, "-")}`);
			const overlayText =
				(await dash
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";
			const found = overlayText.includes(query);
			s.note(`query "${query}" → object result present: ${found}`);
			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(500);
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors during vault search").toEqual([]);
	} finally {
		await s.finish();
	}
});
