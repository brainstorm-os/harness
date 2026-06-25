/**
 * Session 126 — Marcus design-reviews the Bookmarks (reading list) surface.
 *
 * Priya's research leans on the reading list, so Marcus turns his consistency
 * lens on Bookmarks: the resting cards (favicon + title + domain + desc), the
 * header right-group order, the tag list, and whether cards read uniformly.
 * Specific, substantiated friction in his voice; narrated in the team chat.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Bookmarks surface (126)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("126-marcus-bookmarks-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Reviewing Bookmarks — it's Priya's research shelf, so it has to read cleanly at a glance. Looking at card consistency and the chrome.",
		);

		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2000);
		await s.shot(bm, "01-bookmarks-resting");

		// Cards: do all read uniformly (title + domain present, no empties)?
		const titles = await bm
			.locator(
				".bookmarks__card-title, .bookmarks__card-body [class*='title'], .bookmarks__card-domain",
			)
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 16),
			)
			.catch(() => [] as string[]);
		s.note(`Card text (titles/domains): ${JSON.stringify(titles)}`);

		const cardCount = await bm
			.locator(".bookmarks__card")
			.count()
			.catch(() => 0);
		const faviconCount = await bm
			.locator(".bookmarks__card-favicon")
			.count()
			.catch(() => 0);
		const descCount = await bm
			.locator(".bookmarks__card-desc")
			.count()
			.catch(() => 0);
		s.note(`cards=${cardCount} favicons=${faviconCount} descriptions=${descCount}`);

		// Header right-group: object ⋯ must be the last element.
		const headerRight = await bm
			.locator(".app-header__right, [class*='header__right']")
			.first()
			.locator("button")
			.evaluateAll((els) => els.map((e) => (e as HTMLElement).getAttribute("aria-label") || ""))
			.catch(() => [] as string[]);
		s.note(`header right-group: ${JSON.stringify(headerRight)}`);

		// Open one card's detail to check the reading view chrome.
		const firstCard = bm.locator(".bookmarks__card").first();
		if (await firstCard.count()) {
			await firstCard.click().catch(() => undefined);
			await bm.waitForTimeout(1000);
			await s.shot(bm, "02-card-detail");
		}

		// Don't compute a friction verdict from raw selector counts — those lie
		// (a missing `.bookmarks__card-favicon` match isn't a missing favicon; the
		// fallback uses a different element). Post a neutral close; the actual
		// design verdict is decided after reviewing the captures.
		s.chat(SPEAKER.Marcus, "Went through the reading list — pulling my notes from the captures now.");
		s.note("Marcus reviewed the Bookmarks surface; verdict decided from captures.");
	} finally {
		await s.finish();
	}
});
