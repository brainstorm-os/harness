/**
 * Session 200c — corrected comment review (200b was a harness miss).
 *
 * 200b's `button:has-text("Comment")` substring-matched the right panel's
 * "Comments" TAB, so the inline action never fired and the typed comment
 * landed in the document body (residue this session repairs first). The real
 * path: select text → inline toolbar → "More" overflow → "Comment" menuitem →
 * panel composer → submit. Then the B11.9 chip check: hover the commented
 * block → "View comments" chip → click → panel scrolls to the thread.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("comment-on-selection via the overflow + B11.9 click-to-thread (200c)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("200c-comment-review-retry");
	try {
		s.chat(
			SPEAKER.Priya,
			"Take two on the review comment — and first cleaning up the line my last attempt accidentally typed into the doc.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(2000);

		const outline = notes.locator("text=Issue #4").first();
		if (await outline.isVisible().catch(() => false)) {
			await outline.click().catch(() => undefined);
		}
		await notes.waitForTimeout(1500);

		// Repair 200b's residue: the stray paragraph typed into the body.
		const residue = notes
			.locator('[contenteditable="true"] p', { hasText: "This claim needs the Beacon numbers" })
			.first();
		if (await residue.isVisible().catch(() => false)) {
			await residue.click({ clickCount: 3 }).catch(() => undefined);
			await notes.keyboard.press("Backspace");
			await notes.keyboard.press("Backspace");
			s.note("200b residue paragraph removed from the outline body");
			await notes.waitForTimeout(800);
		}
		await s.shot(notes, "01-doc-repaired");

		// Select the Section 2 sentence — the claim that actually needs numbers.
		const target = notes.locator('[contenteditable="true"] p', { hasText: "Section 2" }).first();
		await target.click({ clickCount: 3 }).catch(() => undefined);
		await notes.waitForTimeout(800);

		// Inline toolbar → "More" overflow → "Comment" menuitem.
		await notes
			.locator('[aria-label="More"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(600);
		await s.shot(notes, "02-overflow-open");
		const commentRow = notes.locator('[role="menuitem"]', { hasText: "Comment" }).first();
		const rowVisible = await commentRow.isVisible().catch(() => false);
		s.note(`overflow menu offers Comment: ${rowVisible}`);
		if (rowVisible) {
			await commentRow.click().catch(() => undefined);
			await notes.waitForTimeout(1200);
			await s.shot(notes, "03-composer-focused");

			// The Comments tab opens with the composer focused; type + submit
			// (the submit button scoped INSIDE the panel form, not the tab).
			await notes.keyboard.type("This claim needs the Beacon numbers behind it.", { delay: 10 });
			await notes
				.locator('form button:has-text("Comment"), button[type="submit"]:has-text("Comment")')
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1500);
			await s.shot(notes, "04-comment-posted");
		}

		// B11.9 — hover the commented block, expect the chip, click to thread.
		await target.hover().catch(() => undefined);
		await notes.waitForTimeout(800);
		const chip = notes.locator('[aria-label="View comments"]').first();
		const chipVisible = await chip.isVisible().catch(() => false);
		s.note(`B11.9: hover chip appears on the commented block: ${chipVisible}`);
		await s.shot(notes, "05-hover-chip");

		let threadVisible = false;
		if (chipVisible) {
			await chip.click().catch(() => undefined);
			await notes.waitForTimeout(1200);
			threadVisible = await notes
				.locator("text=This claim needs the Beacon numbers")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`panel thread in view after chip click: ${threadVisible}`);
			await s.shot(notes, "06-thread-focused");
		}

		s.chat(
			SPEAKER.Mira,
			chipVisible && threadVisible
				? "Hovered Priya's highlighted paragraph, clicked the little comment chip, and the panel jumped straight to her thread. Review-in-the-tool works end to end."
				: "Still can't get from the highlighted block to the thread with one click — filing it.",
		);

		expect(rowVisible, "Comment must be reachable from the selection toolbar").toBe(true);
	} finally {
		await s.finish();
	}
});
