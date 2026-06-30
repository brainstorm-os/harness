/**
 * Session 369 — verify the F-304 Files control-face migration.
 *
 * Files migrated its dialogs (bulk-rename, smart-folder-name) + inline rename +
 * the toolbar search wrapper onto the shared `.bs-input` face. Before: the
 * toolbar search input measured 23px next to a 26px button (3 heights in one
 * row). This re-measures input vs button and captures the toolbar + a rename so
 * the heights can be eyeballed against each other.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("Files controls share the .bs-input face (369)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("369-files-control-face-verify");
	try {
		const files = await s.openApp(APP.Files);
		const errs = collectConsoleErrors(files);
		await files.waitForTimeout(2500);

		// Re-measure: the toolbar search field (now a .bs-input wrapper) vs the
		// toolbar buttons. They should now sit on the same control-height scale.
		const m = await files
			.evaluate(() => {
				const h = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().height) : null);
				return {
					searchField: h(document.querySelector(".toolbar__search")),
					searchInput: h(document.querySelector(".toolbar__search-input")),
					bsInput: h(document.querySelector(".bs-input")),
					button: h(document.querySelector(".toolbar .bs-btn") ?? document.querySelector(".toolbar button")),
				};
			})
			.catch(() => null);
		s.note(
			`[files] toolbar — search field=${m?.searchField ?? "?"}px, first .bs-input=${m?.bsInput ?? "?"}px, toolbar button=${m?.button ?? "?"}px (field & button should match the 24/32/40 scale)`,
		);
		await s.shot(files, "files-toolbar", files.locator(".toolbar").first());
		await s.shot(files, "files-full");

		// Inline rename: the row rename input now rides .bs-input--sm (compact)
		// with an accent border. Trigger it via the first row's rename affordance.
		const firstRow = files.locator('[data-testid="content-row"], .content-row, [role="row"]').first();
		await firstRow.click().catch(() => undefined);
		await files.keyboard.press("Enter").catch(() => undefined); // common rename chord
		await files.waitForTimeout(500);
		const renaming = await files.locator(".content-row__rename-input").count().catch(() => 0);
		if (renaming > 0) {
			await s.shot(files, "files-inline-rename", files.locator(".content-row").first());
			s.note("[files] inline-rename input visible (.bs-input--sm + accent border)");
		} else {
			s.note("[files] inline-rename not triggered via Enter — captured list only");
		}
		await files.keyboard.press("Escape").catch(() => undefined);

		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 4)) s.note(`    files: ${e}`);
	} finally {
		await s.finish();
	}
});
