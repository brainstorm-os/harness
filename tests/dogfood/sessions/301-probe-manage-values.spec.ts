/**
 * Session 301 — "Manage values…" works outside Notes (Bookmarks).
 *
 * Regression probe for the dead-button bug: the Tag cell's "Manage values…"
 * footer fired dictionaryEditorStore.open() but the editor host was mounted
 * only in Notes, so in Bookmarks the button did nothing. PropertiesProvider
 * now auto-mounts the shared host — opening the Tags picker → "Manage
 * values…" must render the dictionary editor overlay in Bookmarks too.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("'Manage values…' opens the dictionary editor in Bookmarks", async () => {
	test.setTimeout(180_000);
	const s = await startSession("301-probe-manage-values");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);

		const cards = bm.locator(".bookmarks__card");
		const cardCount = await cards.count();
		s.note(`Bookmark cards: ${cardCount}`);
		if (cardCount === 0) {
			s.note("No bookmarks in the forked vault — cannot reach the Tags picker.");
			test.skip(true, "no bookmarks to inspect");
			return;
		}

		await cards.first().click();
		await bm.waitForTimeout(900);
		await s.shot(bm, "01-detail");

		const tagTrigger = bm.locator(".bs-cell-tag-trigger").first();
		await expect(tagTrigger, "the Tags property cell is in the inspector").toBeAttached({
			timeout: 8000,
		});
		// The inspector body overflows the window fold, so Playwright's
		// viewport actionability check blocks a pointer click — fire the
		// trigger's own click handler. We're verifying the picker + editor
		// open, not pointer mechanics.
		await tagTrigger.evaluate((el) => (el as HTMLElement).click());
		await bm.waitForTimeout(600);
		await s.shot(bm, "02-picker-open");

		const manage = bm.locator(".bs-cell-pop-foot", { hasText: /Manage values/ }).first();
		await expect(manage, "the 'Manage values…' footer is present").toBeAttached({ timeout: 5000 });
		await manage.evaluate((el) => (el as HTMLElement).click());
		await bm.waitForTimeout(900);
		await s.shot(bm, "03-after-manage");

		// THE regression assertion: before the fix this overlay never mounted
		// in Bookmarks (host lived in Notes), so the click was a no-op.
		const overlay = bm.locator(".notes__dict-overlay");
		await expect(overlay, "the dictionary editor overlay opened in Bookmarks").toBeVisible({
			timeout: 5000,
		});
		const name = await bm.locator(".notes__dict-name").first().inputValue();
		s.note(`Dictionary editor opened; vocabulary name = "${name}"`);
		expect(name.length, "the editor shows the vocabulary's name").toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
