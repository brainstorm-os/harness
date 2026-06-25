/**
 * Session 057 — Mira builds a research reading list.
 *
 * She captures a source and files it under a "reading-list" tag, then opens
 * that tag in the sidebar to see just her reading list. Exercises bookmark
 * tagging + tag filtering (sidebar tag → Tags surface filtered to that tag) —
 * the organize side of Bookmarks, beyond the capture verified in 039.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const TAG = "reading-list";

test("tag a source and filter to the reading list", async () => {
	test.setTimeout(180_000);
	const s = await startSession("057-reading-list");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "01-landing");

		// Capture a source tagged for her reading list.
		await bm.locator(".bookmarks__header-add").first().click();
		await bm.waitForTimeout(500);
		const dialog = bm.locator('[role="dialog"]');
		const inputs = dialog.locator(".bookmarks__form-input");
		await inputs.first().fill("https://example.org");
		if ((await inputs.count()) >= 4) {
			await inputs.nth(3).fill(TAG);
			await bm.keyboard.press("Enter").catch(() => undefined); // commit tag chip if chip-style
		}
		await s.shot(bm, "02-compose");
		await dialog.locator("[data-bs-primary]").first().click();
		await bm.waitForTimeout(3000); // readable extraction fetches the page
		await s.shot(bm, "03-after-capture");

		// Open the reading-list tag from the sidebar.
		const tagBtn = bm.locator(".bookmarks__tag-list-btn", { hasText: new RegExp(TAG, "i") }).first();
		const haveTag = (await tagBtn.count()) > 0;
		s.note(`reading-list tag in sidebar: ${haveTag}`);
		await tagBtn.click();
		await bm.waitForTimeout(700);
		await s.shot(bm, "04-filtered");

		const selected = await tagBtn.getAttribute("aria-selected");
		const cards = await bm.locator(".bookmarks__card").count();
		s.note(`tag aria-selected after click: ${selected}; cards in filtered view: ${cards}`);

		expect(haveTag, "the reading-list tag appears in the sidebar after tagging a source").toBe(true);
		expect(selected, "clicking the tag selects it").toBe("true");
		expect(
			cards,
			"the filtered reading list shows at least the tagged source",
		).toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
