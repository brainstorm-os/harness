/**
 * Probe 931 — B11.19 slash-menu sections, end to end in the real shell.
 *
 * A bare `/` in a Notes body must open the shared typeahead menu grouped
 * under block-type section headers (`.fm-section`, taxonomy order: Basic
 * blocks · Lists · Media · Embeds · …); typing a query must collapse the
 * headers into the flat relevance-ranked list so Enter still commits the
 * best match. Run against a side worktree's build via BRAINSTORM_SHELL_DIR.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("931 — bare `/` groups by block type; a query flattens to the ranked list", async () => {
	test.setTimeout(240_000);
	const s = await startSession("931-probe-slash-sections");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// A fresh note so the probe types on an empty body line.
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);
		await notes.keyboard.type("Slash sections probe");
		// Title → body.
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(400);
		// Land the caret in the body paragraph explicitly — typing straight
		// after the title Enter races the editor's focus move.
		const bodyPara = notes.locator('[contenteditable="true"] p').first();
		await bodyPara.waitFor({ state: "visible", timeout: 10_000 });
		await bodyPara.click();
		await notes.waitForTimeout(300);

		await notes.keyboard.type("/");
		const menu = notes.locator(".fm-menu");
		await menu.waitFor({ state: "visible", timeout: 10_000 });
		const headers = notes.locator(".fm-menu .fm-section");
		await expect.poll(() => headers.count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
		const headerText = (await headers.allTextContents()).map((t) => t.trim());
		const rowText = (await notes.locator(".fm-menu .bs-typeahead-row").allTextContents()).map(
			(t) => t.trim().slice(0, 30),
		);
		s.note(`browse-mode headers: ${headerText.join(" | ")}`);
		s.note(`browse-mode rows: ${rowText.join(" | ")}`);
		await s.shot(notes, "01-browse-sections");
		// The list body is virtualized — only the painted window's headers are
		// in the DOM. Top of the list first:
		expect(headerText[0], "Basic blocks leads the taxonomy").toBe("Basic blocks");
		expect(headerText[1], "Lists second").toBe("Lists");
		// ArrowUp wraps the highlight to the LAST command, scrolling the tail
		// sections into the virtual window.
		await notes.keyboard.press("ArrowUp");
		await notes.waitForTimeout(600);
		const tailHeaders = (await headers.allTextContents()).map((t) => t.trim());
		s.note(`browse-mode tail headers: ${tailHeaders.join(" | ")}`);
		await s.shot(notes, "02-browse-tail-sections");
		expect(tailHeaders, "Embeds section present in the tail").toContain("Embeds");

		// Filter mode: headers collapse, ranked flat list, best match first.
		await notes.keyboard.type("head");
		await expect.poll(() => headers.count(), { timeout: 5_000 }).toBe(0);
		const firstRow = notes.locator(".fm-menu .bs-typeahead-row").first();
		await expect(firstRow).toContainText("Heading 1");
		await s.shot(notes, "03-filter-flat");

		// Enter commits the ranked best match even after the sectioned view.
		await notes.keyboard.press("Enter");
		await expect
			.poll(() => notes.locator('[contenteditable="true"] h1, .notes__doc h1').count(), {
				timeout: 5_000,
			})
			.toBeGreaterThan(0);
		await s.shot(notes, "04-h1-inserted");

		// Leave the vault tidy: the probe note stays (personas' vault grows by
		// design), but give it a body line so it reads as a real note.
		await notes.keyboard.type("Sections verified.");
		await notes.waitForTimeout(600);
	} finally {
		await s.finish();
	}
});
