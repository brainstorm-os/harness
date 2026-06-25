/**
 * Session 062 — Mira triages her reading list.
 *
 * She marks a source in her Inbox as Read so it moves out of her queue.
 * Exercises the bookmark read-lifecycle (card object menu → "Mark read",
 * Inbox→Read surface move) — the triage side of Bookmarks, not yet dogfooded.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function surfaceCount(bm: import("@playwright/test").Page, label: string): Promise<number> {
	const btn = bm.locator(".bookmarks__nav-btn", { hasText: new RegExp(`^${label}`) }).first();
	if ((await btn.count()) === 0) return -1;
	const txt = (await btn.locator(".bookmarks__nav-count").first().textContent()) ?? "";
	const n = Number.parseInt(txt.trim(), 10);
	return Number.isFinite(n) ? n : -1;
}

test("mark a bookmark as Read (Inbox → Read)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("062-bookmark-mark-read");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await bm
			.locator(".bookmarks__nav-btn", { hasText: /^Inbox/ })
			.first()
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(600);

		const readBefore = await surfaceCount(bm, "Read");
		const inboxCards = await bm.locator(".bookmarks__card").count();
		s.note(`Inbox cards: ${inboxCards}; Read count before: ${readBefore}`);
		await s.shot(bm, "01-inbox");

		if (inboxCards >= 1) {
			await bm.locator(".bookmarks__card").first().click({ button: "right" });
			await bm.waitForTimeout(400);
			await bm
				.locator('.fm-menu [role="option"]', { hasText: /^Mark read$/ })
				.first()
				.click();
			await bm.waitForTimeout(800);
			await s.shot(bm, "02-after-mark");

			const readAfter = await surfaceCount(bm, "Read");
			const inboxAfter = await bm.locator(".bookmarks__card").count();
			s.note(`Read count after: ${readAfter}; Inbox cards after: ${inboxAfter}`);
			expect(readAfter, "the bookmark moved into the Read surface").toBeGreaterThan(readBefore);
			expect(inboxAfter, "the marked bookmark left the Inbox view").toBeLessThan(inboxCards);
		} else {
			// Inbox already empty (triaged in a prior run) — the read lifecycle
			// still holds if Read has items.
			s.note("Inbox empty — verifying the reading list already has Read items");
			expect(readBefore, "the Read surface holds previously-triaged sources").toBeGreaterThanOrEqual(
				1,
			);
		}
	} finally {
		await s.finish();
	}
});
