/**
 * Session 901 — repro for the inline Select field design bugs (verification).
 *
 * Reproduces the exact state from the bug report: a Select field inserted on an
 * empty body line. Captures:
 *   - slash-menu-open    : the "/" command menu (scrollbar / padding)
 *   - field-inserted     : the chip placeholder (must NOT be overlaid by the
 *                          "Type ‘/’ for commands" ghost)
 *   - picker-open        : the options dropdown ("No options yet" + "Add option…"
 *                          footer padding)
 *
 * Also asserts the paragraph holding the chip is NOT flagged with the
 * empty-paragraph hint attribute (the overlay's mechanism).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Notes: inline Select field — placeholder + menu padding", async () => {
	test.setTimeout(180_000);
	const s = await startSession("901-notes-select-placeholder");

	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1000);

		await notes.keyboard.type("Select field repro", { delay: 12 });
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(300);

		// Open the slash menu with no filter so the full (scrollable) command list
		// shows — this is the scrollbar/padding surface.
		await notes.keyboard.type("/", { delay: 20 });
		await notes.waitForTimeout(700);
		await s.shot(notes, "slash-menu-open");

		// Filter to the Select command and commit it.
		await notes.keyboard.type("select", { delay: 25 });
		await notes.waitForTimeout(600);
		await s.shot(notes, "slash-menu-filtered");
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(700);
		await s.shot(notes, "field-inserted");

		const chip = notes.locator(".notes__select-field-chip").first();
		s.note(`select chip present: ${await chip.count()}`);
		s.note(`chip text: "${(await chip.textContent()) ?? ""}"`);

		// The overlay bug: the chip's paragraph getting the empty-hint attribute.
		const hintedInBody = await notes
			.locator('.notes__contenteditable [data-empty-hint="true"]')
			.count();
		s.note(`paragraphs flagged with empty-hint while a field is present: ${hintedInBody}`);

		// Open the options picker.
		if ((await chip.count()) > 0) {
			await chip.click();
			await notes.waitForTimeout(600);
			await s.shot(notes, "picker-open");
			s.note(`add-option input present: ${await notes.locator(".notes__select-field-input").count()}`);
		}

		// A field-bearing paragraph must never carry the slash ghost.
		expect(hintedInBody, "no empty-hint ghost should overlay a paragraph holding a field").toBe(0);
	} finally {
		await s.finish();
	}
});
