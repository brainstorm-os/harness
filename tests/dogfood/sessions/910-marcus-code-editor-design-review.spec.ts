/**
 * Session 910 — Marcus design-reviews the Code editor (Launch-2 sweep, 3/12).
 *
 * The "New file" CTA was his second unsized-button sighting (F-441) — first
 * stop is verifying the enforced hero face landed here too. Then the real
 * surfaces: create-file flow, the editing surface with content (highlight +
 * diagnostics), and the nav/refs panels. Capture + inventory only; verdicts
 * from the screenshots afterward.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Marcus design-reviews the Code editor — empty CTA, create flow, editing surface (910)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("910-marcus-code-editor-design-review");
	s.chat(
		SPEAKER.Marcus,
		"Code editor next. Its New-file button was my exhibit B for the shrunken-CTA epidemic — let's see if the cure took, then whether the editing surface itself holds to the system.",
	);
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});
	try {
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(1800);
		await s.shot(ce, "01-first-impression");
		const hasShared = await ce.evaluate(() => document.querySelector(".bs-empty-state") !== null);
		s.note(`shared EmptyState on first screen: ${hasShared}`);

		// Create a file (empty-state CTA or the header + affordance).
		const newBtn = ce.locator("button", { hasText: "New file" }).first();
		if ((await newBtn.count().catch(() => 0)) > 0) {
			await newBtn.click().catch(() => undefined);
		} else {
			await ce.locator('[aria-label*="New" i]').first().click().catch(() => undefined);
		}
		await ce.waitForTimeout(1200);
		await s.shot(ce, "02-after-new-file");

		// Type a snippet that exercises highlight + the linter.
		const surface = ce.locator(".cm-content, [contenteditable=true], textarea").first();
		if ((await surface.count().catch(() => 0)) > 0) {
			await surface.click().catch(() => undefined);
			await ce.keyboard.type(
				"function greet(name) {\n  console.log('hello ' + name)\n}\nconst unused = 42\ngreet('Marcus'",
				{ delay: 4 },
			);
			await ce.waitForTimeout(2500);
			await s.shot(ce, "03-editing-with-diagnostics");
		} else {
			s.note("no editing surface found after New file");
		}

		// Panels: nav + refs toggles if present.
		for (const [sel, name] of [
			['[aria-label*="sidebar" i], [aria-label*="files" i]', "04-nav-panel"],
			['[aria-label*="problem" i], [aria-label*="refs" i], [aria-label*="inspector" i]', "05-side-panel"],
		] as const) {
			const btn = ce.locator(sel).first();
			if ((await btn.count().catch(() => 0)) > 0) {
				await btn.click().catch(() => undefined);
				await ce.waitForTimeout(700);
				await s.shot(ce, name);
			}
		}

		s.note(`=== console errors (${errors.length}) ===`);
		for (const e of errors.slice(0, 15)) s.note(e);
		s.chat(SPEAKER.Marcus, "Code editor captured — empty CTA, a fresh file with live diagnostics, and the panels. Verdicts incoming.");
	} finally {
		await s.close();
	}
});
