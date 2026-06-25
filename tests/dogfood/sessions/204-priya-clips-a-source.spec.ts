/**
 * Session 204 — Day 5: Priya's research loop closes (Browser-5 / F-161).
 *
 * The read → save → cite seam: load a source in the Browser, hit the new
 * Save-to-vault clip button, and find it as a Bookmark in the Bookmarks app.
 * (Page body pixels don't show in captures — the WebContentsView is outside
 * the renderer paint tree — so the proof is the entity + Bookmarks render.)
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const BOOKMARK_TYPE = "brainstorm/Bookmark/v1";

test("clip a source from the Browser into Bookmarks (204)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("204-priya-clips-a-source");
	try {
		s.chat(
			SPEAKER.Priya,
			"The browser grew a save button. If example.com can land in my Bookmarks without copy-pasting URLs, the research loop finally closes.",
		);

		// Count from Bookmarks — the Browser app deliberately can't list vault
		// entities (capability-scoped), so the probe lives where the read does.
		const bookmarksApp = await s.openApp(APP.Bookmarks);
		await bookmarksApp.waitForTimeout(2000);

		const browser = await s.openApp(APP.Browser);
		await browser.waitForTimeout(2500);

		const countBookmarks = async () =>
			await bookmarksApp.evaluate(async (type) => {
				const bs = (
					window as unknown as {
						brainstorm?: {
							services?: {
								vaultEntities?: {
									list: () => Promise<{
										entities: { type: string; deletedAt: number | null }[];
									}>;
								};
							};
						};
					}
				).brainstorm;
				const snap = await bs?.services?.vaultEntities?.list();
				return (snap?.entities ?? []).filter((e) => e.type === type && e.deletedAt === null).length;
			}, BOOKMARK_TYPE);

		const before = await countBookmarks();
		s.note(`Bookmark entities before clip: ${before}`);

		// Navigate: omnibox → URL → Enter.
		const omnibox = browser
			.locator('input[type="url"], input[placeholder*="Search"], .browser__omnibox input')
			.first();
		await omnibox.click().catch(() => undefined);
		await browser.keyboard.type("https://example.com", { delay: 15 });
		await browser.keyboard.press("Enter");
		await browser.waitForTimeout(4000);
		await s.shot(browser, "01-page-loaded");

		// The clip button should be enabled on a loaded page.
		const clip = browser
			.locator('[aria-label*="Save to vault"], [aria-label*="ave to vault"], .browser__clip')
			.first();
		const clipVisible = await clip.isVisible().catch(() => false);
		const clipEnabled = clipVisible ? await clip.isEnabled().catch(() => false) : false;
		s.note(`clip button visible: ${clipVisible}, enabled: ${clipEnabled}`);
		await s.shot(browser, "02-clip-button");

		if (clipEnabled) {
			await clip.click().catch(() => undefined);
			await browser.waitForTimeout(2000);
			await s.shot(browser, "03-after-clip");
		}

		const after = await countBookmarks();
		s.note(`Bookmark entities after clip: ${after}`);
		expect(after).toBe(before + 1);

		// The destination renders it: back to Bookmarks and look for the title.
		await bookmarksApp.bringToFront().catch(() => undefined);
		await bookmarksApp.waitForTimeout(2500);
		const entryVisible = await bookmarksApp
			.locator("text=Example Domain")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`"Example Domain" visible in Bookmarks: ${entryVisible}`);
		await s.shot(bookmarksApp, "04-bookmarks-app");

		s.chat(
			SPEAKER.Priya,
			after > before
				? "Clipped. One click in the browser and the source is a real Bookmark I can tag and cite. The research loop is closed — reader-mode snapshots are the next want."
				: "The button is there but nothing landed in Bookmarks — filing it.",
		);
	} finally {
		await s.finish();
	}
});
