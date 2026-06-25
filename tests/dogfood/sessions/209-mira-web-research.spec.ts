/**
 * Session 209 — Mira does real web research in the Browser, exercising the
 * whole Browser-9 / find-in-page / session-restore drop: omnibox navigation,
 * history suggestions, the History menu, Cmd+F find, and the star clip.
 * Then a Bookmarks pass: the compose dialog's download-page-content default
 * (9.18.5), scrape-populated author/date (9.18.6), and the tag board's
 * horizontal scroll (the in-flight DnD fix).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira researches on the web — history, find, clips (209)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("209-mira-web-research");
	try {
		s.chat(
			SPEAKER.Mira,
			"Research morning. Last time the browser forgot every site the moment I closed it — they say it remembers now. Testing that, plus find-in-page.",
		);

		// ---- Browser: navigate twice, then check memory --------------------
		const br = await s.openApp(APP.Browser);
		await br.waitForTimeout(3000);
		await s.shot(br, "01-browser-open");

		const omnibox = br.locator('[aria-label="Address bar"]').first();
		const omniVisible = await omnibox.isVisible().catch(() => false);
		s.note(`omnibox visible: ${omniVisible}`);
		if (omniVisible) {
			await omnibox.click().catch(() => undefined);
			await omnibox.fill("https://example.com").catch(() => undefined);
			await br.keyboard.press("Enter");
			await br.waitForTimeout(5000);
			await s.shot(br, "02-example-com-loaded");
			const omniValue = await omnibox.inputValue().catch(() => "?");
			s.note(`after nav 1, omnibox: ${omniValue}`);

			// Second site so history has two distinct entries.
			await omnibox.click().catch(() => undefined);
			await omnibox.fill("https://www.iana.org/help/example-domains").catch(() => undefined);
			await br.keyboard.press("Enter");
			await br.waitForTimeout(6000);
			await s.shot(br, "03-iana-loaded");

			// Omnibox suggestions: type a prefix of a visited host.
			await omnibox.click().catch(() => undefined);
			await omnibox.fill("exam").catch(() => undefined);
			await br.waitForTimeout(1200);
			const suggestions = br.locator(".browser__suggestion");
			const sugCount = await suggestions.count().catch(() => 0);
			s.note(`suggestions for "exam": ${sugCount}`);
			if (sugCount > 0) {
				const sugText = await suggestions.allTextContents().catch(() => [] as string[]);
				s.note(`suggestion rows: ${JSON.stringify(sugText.slice(0, 5))}`);
			}
			await s.shot(br, "04-omnibox-suggestions");
			if (sugCount > 0) {
				await br.keyboard.press("ArrowDown");
				await s.shot(br, "05-suggestion-highlighted");
				await br.keyboard.press("Enter");
				await br.waitForTimeout(4000);
				await s.shot(br, "06-navigated-via-suggestion");
			} else {
				await br.keyboard.press("Escape").catch(() => undefined);
			}
		}

		// History menu.
		const historyBtn = br.locator('[aria-label="History"]').first();
		if (await historyBtn.isVisible().catch(() => false)) {
			await historyBtn.click().catch(() => undefined);
			await br.waitForTimeout(900);
			const menuItems = await br
				.locator('[role="menuitem"], .fm-menu [role="option"], .fm-menu button')
				.allTextContents()
				.catch(() => [] as string[]);
			s.note(`history menu rows: ${JSON.stringify(menuItems.slice(0, 12))}`);
			await s.shot(br, "07-history-menu");
			await br.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("NO History button found in chrome");
		}

		// Find-in-page over the loaded page.
		await br.keyboard.press(process.platform === "darwin" ? "Meta+f" : "Control+f");
		await br.waitForTimeout(800);
		const findInput = br
			.locator('[placeholder="Find in page"], [aria-label="Find in page"] input, input[type="search"]')
			.first();
		if (await findInput.isVisible().catch(() => false)) {
			await findInput.fill("domain").catch(() => undefined);
			await br.waitForTimeout(1500);
			await s.shot(br, "08-find-bar-matches");
			const findBarText = await br
				.locator('[class*="find"]')
				.first()
				.textContent()
				.catch(() => null);
			s.note(`find bar reads: ${findBarText?.slice(0, 120) ?? "(?)"}`);
			await br.keyboard.press("Enter");
			await br.waitForTimeout(600);
			await s.shot(br, "09-find-next");
			await br.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("Cmd+F did NOT surface a find bar");
			await s.shot(br, "08-no-find-bar");
		}

		// Star clip the current page (Browser-5).
		const clip = br
			.locator('[class*="clip"], [aria-label*="clip" i], [aria-label*="bookmark" i]')
			.first();
		if (await clip.isVisible().catch(() => false)) {
			const label = await clip.getAttribute("aria-label").catch(() => null);
			s.note(`clip button label: ${label}`);
			await clip.click().catch(() => undefined);
			await br.waitForTimeout(2500);
			await s.shot(br, "10-after-clip");
		} else {
			s.note("no clip/star button found");
		}

		// ---- Bookmarks: compose default + scrape fields + board scroll -----
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(3000);
		await s.shot(bm, "11-bookmarks-open");

		// Compose dialog: the download-page-content checkbox default (9.18.5).
		const newBtn = bm
			.locator('[aria-label*="new" i], [aria-label*="add" i], button:has-text("New")')
			.first();
		if (await newBtn.isVisible().catch(() => false)) {
			await newBtn.click().catch(() => undefined);
			await bm.waitForTimeout(900);
			const checkbox = bm.locator('input[type="checkbox"]').first();
			const checked = await checkbox.isChecked().catch(() => null);
			s.note(`compose download-page-content checkbox default: ${checked}`);
			await s.shot(bm, "12-compose-dialog");
			// Actually add a bookmark so scrape population runs.
			const urlInput = bm
				.locator('input[type="url"], input[placeholder*="http" i], input[placeholder*="url" i]')
				.first();
			if (await urlInput.isVisible().catch(() => false)) {
				await urlInput.fill("https://www.iana.org/help/example-domains").catch(() => undefined);
				const confirm = bm
					.locator('button:has-text("Add"), button:has-text("Save"), button:has-text("Create")')
					.first();
				await confirm.click().catch(() => undefined);
				await bm.waitForTimeout(6000);
				await s.shot(bm, "13-bookmark-added");
			} else {
				await bm.keyboard.press("Escape").catch(() => undefined);
			}
		} else {
			s.note("no compose/new button found in Bookmarks");
		}

		// Tag board: horizontal scroll survival (the in-flight DnD fix).
		const boardToggle = bm
			.locator('[aria-label*="board" i], [aria-label*="tag" i], button:has-text("Board")')
			.first();
		if (await boardToggle.isVisible().catch(() => false)) {
			await boardToggle.click().catch(() => undefined);
			await bm.waitForTimeout(1500);
		}
		const boards = bm.locator(".bookmarks__tag-boards").first();
		if (await boards.isVisible().catch(() => false)) {
			await s.shot(bm, "14-tag-board");
			const lanes = await bm
				.locator(".bookmarks__tag-board")
				.count()
				.catch(() => 0);
			s.note(`tag board lanes: ${lanes}`);
			// Scroll right, wait through a couple of live-store ticks, re-read.
			const scrolled = await boards
				.evaluate((el) => {
					el.scrollLeft = 400;
					return el.scrollLeft;
				})
				.catch(() => -1);
			await bm.waitForTimeout(4000);
			const after = await boards.evaluate((el) => el.scrollLeft).catch(() => -1);
			s.note(`board scrollLeft set→${scrolled}, after 4s→${after} (survives = equal & > 0)`);
			await s.shot(bm, "15-tag-board-scrolled");
		} else {
			s.note("tag board view not found");
			const viewControls = await bm
				.locator(".app-header button")
				.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim()))
				.catch(() => [] as unknown[]);
			s.note(`header buttons: ${JSON.stringify(viewControls)}`);
		}

		s.chat(
			SPEAKER.Mira,
			"Browser memory pass done — if the suggestions and History menu held, that closes my oldest browser complaint.",
		);
	} finally {
		await s.finish();
	}
});
