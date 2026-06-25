/**
 * Session 323 — editor slash-command insert sweep (2026-06-21).
 *
 * The 3-column resize bug prompted "test everything — some things still don't
 * work." This sweeps the editor's insertable blocks via the slash menu and
 * records, for each, whether the expected DOM node appears and whether the
 * renderer console stays clean. Factual capture — no product assertions beyond
 * "did the node mount + no console error during insert".
 */

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Probe = { filter: string; expect: string; label: string };

// filter: text typed after "/" to single out the command (unique keyword).
// expect: a CSS selector the inserted node should match.
const PROBES: Probe[] = [
	{
		filter: "checkbox",
		expect: ".notes__checkbox-field, [data-lexical-decorator]",
		label: "checkbox",
	},
	{ filter: "callout", expect: ".notes__callout", label: "callout" },
	{ filter: "toggle", expect: ".notes__toggle", label: "toggle" },
	{ filter: "divider", expect: "hr, .notes__divider", label: "divider" },
	{ filter: "quote", expect: "blockquote", label: "quote" },
	{ filter: "table", expect: "table", label: "table" },
];

async function nodeCount(page: Page, selector: string): Promise<number> {
	return page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
}

test("editor block insert sweep (323)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("323-editor-block-sweep");
	const consoleErrors: string[] = [];
	try {
		const page = await s.openApp(APP.Notes);
		page.on("console", (m) => {
			if (m.type() === "error") consoleErrors.push(m.text());
		});
		await page.waitForTimeout(2400);
		s.note("\n### editor — slash-command insert sweep");

		for (const probe of PROBES) {
			const newNote = page.locator('[aria-label="New note"]').first();
			await newNote.click();
			await page.waitForTimeout(900);
			const editor = page.locator(".notes__contenteditable").first();
			await editor.click();
			await page.waitForTimeout(300);

			const before = await nodeCount(page, probe.expect);
			const errBefore = consoleErrors.length;
			await page.keyboard.type(`/${probe.filter}`);
			await page.waitForTimeout(700);
			await page.keyboard.press("Enter");
			await page.waitForTimeout(800);
			const after = await nodeCount(page, probe.expect);
			const errDuring = consoleErrors.length - errBefore;
			const mounted = after > before;
			s.note(`${probe.label}: mounted=${mounted} (count ${before}→${after}) consoleErr=${errDuring}`);
			await s.shot(page, `${probe.label}-${mounted ? "ok" : "MISSING"}`);
		}

		s.note(`\ntotal console errors during sweep: ${consoleErrors.length}`);
		for (const e of consoleErrors.slice(0, 10)) s.note(`  err: ${e.slice(0, 140)}`);
	} finally {
		await s.finish();
	}
});
