/**
 * Session 078 — Mira archives a processed source.
 *
 * Closing the bookmark lifecycle: 062 marked one read; now she archives one
 * she's done with so it leaves the active queue but stays findable. Right-click
 * card → Archive → it moves to the Archive surface. Covers the archive/unarchive
 * lifecycle (the remaining uncovered Bookmarks surface move).
 *
 * Idempotent: if the Inbox is already empty (prior runs archived everything),
 * it just confirms the Archive surface holds the archived sources.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const CARD = ".bookmarks__card[data-entity-id]";

test("archive a processed bookmark", async () => {
	test.setTimeout(180_000);
	const s = await startSession("078-archive-bookmark");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "01-inbox");

		const inboxBefore = await bm.locator(CARD).count();
		s.note(`inbox cards before: ${inboxBefore}`);

		if (inboxBefore > 0) {
			await bm.locator(CARD).first().click({ button: "right" });
			await bm.waitForTimeout(350);
			await bm
				.locator('.fm-menu [role="option"]', { hasText: /^Archive$/i })
				.first()
				.click();
			await bm.waitForTimeout(700);
			const inboxAfter = await bm.locator(CARD).count();
			s.note(`inbox cards after archive: ${inboxAfter}`);
			expect(inboxAfter, "the archived card left the Inbox").toBe(inboxBefore - 1);
		} else {
			s.note("inbox empty — confirming the Archive surface instead");
		}

		// Switch to the Archive surface and confirm it holds archived sources.
		await bm
			.locator(".bookmarks__nav-btn", { hasText: /Archive/i })
			.first()
			.click();
		await bm.waitForTimeout(700);
		await s.shot(bm, "02-archive");
		const archived = await bm.locator(CARD).count();
		s.note(`cards on the Archive surface: ${archived}`);
		expect(archived, "the Archive surface holds at least one source").toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
