/**
 * Probe 909b — F-449 repro check: does clicking a bookmark card open the
 * detail pane? Session 909's generic locator (`[class*=card]`) matched the
 * cards CONTAINER (`.bookmarks__cards`), so its click landed on empty space
 * — this probe drives the real affordance (`.bookmarks__card`) and asserts
 * the detail actually renders, before F-449 is triaged as a product bug.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("909b — card click opens the bookmark detail", async () => {
	test.setTimeout(180_000);
	const s = await startSession("909b-bookmark-card-open-probe");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		const card = bm.locator(".bookmarks__card").first();
		await expect(card).toBeVisible();
		await card.click();
		await bm.waitForTimeout(900);
		await s.shot(bm, "01-after-card-click");
		const detail = await bm.evaluate(() => {
			const el = document.querySelector('[class*="detail"]');
			return el ? el.className.slice(0, 80) : null;
		});
		s.note(`detail element after click: ${detail}`);
		expect(detail).not.toBeNull();
	} finally {
		await s.close();
	}
});
