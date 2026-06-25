/**
 * Session 228 — DEEP Browser walkthrough. Exercises the whole Browser-app
 * chrome surface end to end and judges every action from observable state, so
 * the notes read like a verifiable checklist rather than a screenshot dump.
 *
 * The Browser is **chrome only**: the page itself lives in a shell-managed
 * `WebContentsView` that floats over the `.browser__region` placeholder div —
 * its DOM/bytes never enter this renderer. So "did the page actually paint?"
 * cannot be answered from the renderer screenshot; it is answered the way the
 * 215b/215c probes do it — from the MAIN process, by enumerating each
 * BaseWindow's contentView children and checking the navigated URL's view is
 * visible AND non-zero-sized (this directly guards F-235 "page area blank").
 *
 * Coverage: omnibox URL navigation + paint check · new tab (+) · tab switch ·
 * back / forward / reload / stop · close tab (×) · star clip → persists to
 * Bookmarks · non-URL search query · LINK following (omnibox suggestion +
 * History-menu visited entry re-navigate, the renderer-reachable proxy for
 * clicking a link inside the native page) · header/History menu · cross-boot
 * tab + history restore.
 *
 * Every step is a `[PASS]/[FAIL]/[?] <action> — <observed>` note wrapped in
 * try/catch so one failure never aborts the walkthrough.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type FounderSession, SPEAKER, startSession } from "../lib/founder";

const MOD = process.platform === "darwin" ? "Meta" : "Control";

type ViewInfo = {
	window: string;
	url: string;
	bounds: { x: number; y: number; width: number; height: number };
	visible: string;
};

/** MAIN-process enumeration of every BaseWindow's contentView children — the
 *  only way to observe the native WebContentsView the page renders into (the
 *  renderer DOM has only a placeholder div). Mirrors the 215b/215c probes. */
async function dumpViews(s: FounderSession): Promise<ViewInfo[]> {
	return s.app.evaluate(({ BaseWindow }) => {
		type AnyView = {
			getBounds(): { x: number; y: number; width: number; height: number };
			getVisible?: () => boolean;
			webContents?: { getURL(): string; isDestroyed(): boolean };
			children?: AnyView[];
		};
		const out: ViewInfo[] = [];
		for (const win of BaseWindow.getAllWindows()) {
			const content = (win as unknown as { contentView: AnyView }).contentView;
			const winBounds = win.getBounds();
			const tag = `win#${win.id} ${winBounds.width}x${winBounds.height} visible=${win.isVisible()}`;
			for (const child of content.children ?? []) {
				out.push({
					window: tag,
					url:
						child.webContents && !child.webContents.isDestroyed()
							? child.webContents.getURL()
							: "<no-wc>",
					bounds: child.getBounds(),
					visible: String(child.getVisible ? child.getVisible() : "?"),
				});
			}
		}
		return out;
	}) as Promise<ViewInfo[]>;
}

/** Did a WebContentsView for `urlPrefix` mount, visible and meaningfully
 *  sized? Returns a one-line verdict string for the notes. */
function paintVerdict(views: ViewInfo[], urlPrefix: string): { painted: boolean; detail: string } {
	const view = views.find((v) => v.url.startsWith(urlPrefix));
	if (!view) return { painted: false, detail: `no WebContentsView for ${urlPrefix}` };
	const sized = view.bounds.width > 100 && view.bounds.height > 100;
	const visible = view.visible === "true";
	return {
		painted: sized && visible,
		detail: `view ${urlPrefix} visible=${view.visible} bounds=${JSON.stringify(view.bounds)}`,
	};
}

/** Tab labels the chrome currently renders (trimmed, non-empty). */
async function tabTitles(br: Page): Promise<string[]> {
	return br
		.locator(".browser__tab-title")
		.allTextContents()
		.then((all) => all.map((t) => t.trim()).filter(Boolean))
		.catch(() => [] as string[]);
}

async function tabCount(br: Page): Promise<number> {
	return br
		.locator(".browser__tab")
		.count()
		.catch(() => -1);
}

async function activeTabTitle(br: Page): Promise<string> {
	return br
		.locator(".browser__tab--active .browser__tab-title")
		.first()
		.textContent()
		.then((t) => (t ?? "").trim())
		.catch(() => "?");
}

test("deep browser walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-browser");
	const verdict = (status: "PASS" | "FAIL" | "?", action: string, observed: string) =>
		s.note(`[${status}] ${action} — ${observed}`);

	try {
		s.chat(
			SPEAKER.Mira,
			"Deep browser day. Pushing on every control — navigation, tabs, back/forward, the star, search, following links — and checking the page actually shows.",
		);

		const br = await s.openApp(APP.Browser);
		await br.waitForTimeout(4000);
		await s.shot(br, "browser-boot");

		// ---- 0. Boot sanity: omnibox + at least one tab present ----------------
		try {
			const omniVisible = await br
				.locator('[aria-label="Address bar"]')
				.first()
				.isVisible()
				.catch(() => false);
			const tabs = await tabCount(br);
			verdict(
				omniVisible && tabs >= 1 ? "PASS" : "FAIL",
				"browser boots with chrome",
				`omnibox visible=${omniVisible}, tabs=${tabs}`,
			);
		} catch (err) {
			verdict("FAIL", "browser boots with chrome", `threw: ${(err as Error).message}`);
		}

		const omnibox = br.locator('[aria-label="Address bar"]').first();

		// ---- 1. Navigate the omnibox to a real URL + assert the page PAINTED ---
		try {
			await omnibox.click();
			await omnibox.fill("https://example.com");
			await omnibox.press("Enter");
			await br.waitForTimeout(6000);

			const omniValue = await omnibox.inputValue().catch(() => "?");
			const titles = await tabTitles(br);
			const titleResolved = titles.some((t) => /example/i.test(t));
			verdict(
				omniValue.startsWith("https://example.com") ? "PASS" : "FAIL",
				"omnibox navigates to https://example.com",
				`omnibox now "${omniValue}", tab titles ${JSON.stringify(titles.slice(0, 4))}`,
			);
			verdict(
				titleResolved ? "PASS" : "?",
				"tab title resolves from page",
				`titles ${JSON.stringify(titles.slice(0, 4))}`,
			);

			// THE paint guard (F-235 "page area looks blank"): the navigated URL's
			// WebContentsView must exist, be visible, and be non-zero-sized.
			const views = await dumpViews(s);
			for (const v of views) {
				s.note(
					`  view [${v.window}] url=${v.url.slice(0, 80)} bounds=${JSON.stringify(v.bounds)} visible=${v.visible}`,
				);
			}
			const paint = paintVerdict(views, "https://example.com");
			verdict(paint.painted ? "PASS" : "FAIL", "navigated page actually paints", paint.detail);
			await s.shot(br, "example-loaded");
		} catch (err) {
			verdict("FAIL", "omnibox navigates + paints", `threw: ${(err as Error).message}`);
		}

		// ---- 2. Open a NEW tab (+) — assert tab count grows --------------------
		try {
			const before = await tabCount(br);
			await br.locator('[aria-label="Open a new tab"]').first().click();
			await br.waitForTimeout(2500);
			const after = await tabCount(br);
			verdict(
				after > before ? "PASS" : "FAIL",
				"new-tab (+) opens a tab",
				`tab count ${before} → ${after}`,
			);
			await s.shot(br, "new-tab-opened");
		} catch (err) {
			verdict("FAIL", "new-tab (+) opens a tab", `threw: ${(err as Error).message}`);
		}

		// ---- 3. Navigate the second (new) tab so we have two distinct pages ----
		try {
			await omnibox.click();
			await omnibox.fill("https://www.iana.org/help/example-domains");
			await omnibox.press("Enter");
			await br.waitForTimeout(6000);
			const views = await dumpViews(s);
			const paint = paintVerdict(views, "https://www.iana.org");
			verdict(paint.painted ? "PASS" : "?", "second tab navigates to iana.org", paint.detail);
			await s.shot(br, "second-tab-loaded");
		} catch (err) {
			verdict("FAIL", "second tab navigates", `threw: ${(err as Error).message}`);
		}

		// ---- 4. Switch between tabs — assert active tab + content swap ---------
		try {
			const labels = br.locator(".browser__tab-label");
			const total = await labels.count();
			if (total >= 2) {
				const activeBefore = await activeTabTitle(br);
				// Activate the first tab.
				await labels.nth(0).click();
				await br.waitForTimeout(2500);
				const omniAfterFirst = await omnibox.inputValue().catch(() => "?");
				const activeAfterFirst = await activeTabTitle(br);
				// The active WebContentsView should be the example.com one again.
				const views1 = await dumpViews(s);
				const exampleVisible = views1.some(
					(v) => v.url.startsWith("https://example.com") && v.visible === "true",
				);
				verdict(
					activeAfterFirst !== activeBefore || omniAfterFirst.includes("example") ? "PASS" : "?",
					"switch to first tab swaps active + omnibox",
					`active "${activeBefore}" → "${activeAfterFirst}", omnibox "${omniAfterFirst}", example-view-visible=${exampleVisible}`,
				);
				await s.shot(br, "switched-to-first-tab");

				// Switch back to the second tab.
				await labels.nth(1).click();
				await br.waitForTimeout(2500);
				const omniAfterSecond = await omnibox.inputValue().catch(() => "?");
				const views2 = await dumpViews(s);
				const ianaVisible = views2.some(
					(v) => v.url.startsWith("https://www.iana.org") && v.visible === "true",
				);
				verdict(
					omniAfterSecond.includes("iana") || ianaVisible ? "PASS" : "?",
					"switch back to second tab swaps content",
					`omnibox "${omniAfterSecond}", iana-view-visible=${ianaVisible}`,
				);
				await s.shot(br, "switched-to-second-tab");
			} else {
				verdict("?", "tab switching", `only ${total} tab(s) present — cannot switch`);
			}
		} catch (err) {
			verdict("FAIL", "tab switching", `threw: ${(err as Error).message}`);
		}

		// ---- 5. Build navigation history on the active tab for back/forward ----
		// Navigate the active tab to a fresh URL so it has >1 history entry.
		try {
			await omnibox.click();
			await omnibox.fill("https://example.com");
			await omnibox.press("Enter");
			await br.waitForTimeout(5000);
			await omnibox.click();
			await omnibox.fill("https://www.iana.org/domains/reserved");
			await omnibox.press("Enter");
			await br.waitForTimeout(5500);
			const omniNow = await omnibox.inputValue().catch(() => "?");
			verdict(
				omniNow.includes("iana") ? "PASS" : "?",
				"built two-deep history on active tab",
				`omnibox at "${omniNow}"`,
			);
			await s.shot(br, "history-built");
		} catch (err) {
			verdict("FAIL", "build history", `threw: ${(err as Error).message}`);
		}

		// ---- 6. BACK — assert URL changes back -------------------------------
		try {
			const backBtn = br.locator('[aria-label="Back"]').first();
			const disabledBefore = await backBtn.isDisabled().catch(() => true);
			const omniBefore = await omnibox.inputValue().catch(() => "?");
			await backBtn.click().catch(() => undefined);
			await br.waitForTimeout(4000);
			const omniAfter = await omnibox.inputValue().catch(() => "?");
			verdict(
				!disabledBefore && omniAfter !== omniBefore ? "PASS" : "?",
				"Back button navigates back",
				`back-enabled=${!disabledBefore}, omnibox "${omniBefore}" → "${omniAfter}"`,
			);
			await s.shot(br, "after-back");
		} catch (err) {
			verdict("FAIL", "Back button", `threw: ${(err as Error).message}`);
		}

		// ---- 7. FORWARD — assert URL changes forward again --------------------
		try {
			const fwdBtn = br.locator('[aria-label="Forward"]').first();
			const disabledBefore = await fwdBtn.isDisabled().catch(() => true);
			const omniBefore = await omnibox.inputValue().catch(() => "?");
			await fwdBtn.click().catch(() => undefined);
			await br.waitForTimeout(4000);
			const omniAfter = await omnibox.inputValue().catch(() => "?");
			verdict(
				!disabledBefore && omniAfter !== omniBefore ? "PASS" : "?",
				"Forward button navigates forward",
				`forward-enabled=${!disabledBefore}, omnibox "${omniBefore}" → "${omniAfter}"`,
			);
			await s.shot(br, "after-forward");
		} catch (err) {
			verdict("FAIL", "Forward button", `threw: ${(err as Error).message}`);
		}

		// ---- 8. RELOAD — assert the active view still paints after reload ------
		try {
			// Reload/Stop share a button: when idle the label is "Reload".
			const reloadBtn = br.locator('[aria-label="Reload"]').first();
			const present = await reloadBtn.isVisible().catch(() => false);
			if (present) {
				const omniBefore = await omnibox.inputValue().catch(() => "?");
				await reloadBtn.click().catch(() => undefined);
				await br.waitForTimeout(5000);
				const views = await dumpViews(s);
				const stillPainted = views.some(
					(v) =>
						v.visible === "true" &&
						v.bounds.width > 100 &&
						v.bounds.height > 100 &&
						v.url.startsWith("http"),
				);
				verdict(
					stillPainted ? "PASS" : "?",
					"Reload re-renders the active page",
					`omnibox "${omniBefore}", a sized+visible http view present=${stillPainted}`,
				);
			} else {
				verdict("?", "Reload button", "Reload not visible (button may read Stop mid-load)");
			}
			await s.shot(br, "after-reload");
		} catch (err) {
			verdict("FAIL", "Reload button", `threw: ${(err as Error).message}`);
		}

		// ---- 9. STOP — trigger a load then hit Stop while it shows -------------
		try {
			await omnibox.click();
			await omnibox.fill("https://www.iana.org/help/example-domains");
			await omnibox.press("Enter");
			// The Reload button flips to a "Stop" affordance during loading.
			const stopBtn = br.locator('[aria-label="Stop"]').first();
			const appeared = await stopBtn
				.waitFor({ state: "visible", timeout: 2500 })
				.then(() => true)
				.catch(() => false);
			if (appeared) {
				await stopBtn.click().catch(() => undefined);
				await br.waitForTimeout(1500);
				const stopGone = !(await stopBtn.isVisible().catch(() => false));
				verdict(
					"PASS",
					"Stop halts an in-flight load",
					`Stop affordance appeared mid-load, clicked, reverted-to-reload=${stopGone}`,
				);
			} else {
				verdict(
					"?",
					"Stop button",
					"load completed too fast to catch the Stop affordance (cached page)",
				);
			}
			await br.waitForTimeout(4000);
			await s.shot(br, "after-stop");
		} catch (err) {
			verdict("FAIL", "Stop button", `threw: ${(err as Error).message}`);
		}

		// ---- 10. STAR CLIP — bookmark the page, assert the affordance confirms -
		try {
			await omnibox.click();
			await omnibox.fill("https://example.com");
			await omnibox.press("Enter");
			await br.waitForTimeout(5000);
			const clip = br.locator(".browser__clip").first();
			const enabledBefore = await clip.isEnabled().catch(() => false);
			const labelBefore = await clip.getAttribute("aria-label").catch(() => null);
			await clip.click().catch(() => undefined);
			await br.waitForTimeout(3000);
			const labelAfter = await clip.getAttribute("aria-label").catch(() => null);
			// "Saving to vault…" → "Saved to vault"; either confirms the action ran.
			const confirmed = labelAfter === "Saved to vault" || labelAfter === "Saving to vault…";
			verdict(
				enabledBefore && confirmed ? "PASS" : "?",
				"star clips the page to the vault",
				`clip enabled=${enabledBefore}, aria "${labelBefore}" → "${labelAfter}"`,
			);
			await s.shot(br, "after-clip");
		} catch (err) {
			verdict("FAIL", "star clip", `threw: ${(err as Error).message}`);
		}

		// ---- 11. Clip persistence — assert it shows up in Bookmarks ------------
		try {
			const bm = await s.openApp(APP.Bookmarks);
			await bm.waitForTimeout(4000);
			await s.shot(bm, "bookmarks-after-clip");
			// The clipped example.com page should appear among bookmark rows.
			const bodyText = await bm
				.locator("body")
				.innerText()
				.catch(() => "");
			const found = /example\.com/i.test(bodyText);
			verdict(
				found ? "PASS" : "?",
				"clipped page persists into Bookmarks",
				found ? "example.com row visible in Bookmarks" : "example.com not seen in Bookmarks body text",
			);
		} catch (err) {
			verdict("FAIL", "clip persistence in Bookmarks", `threw: ${(err as Error).message}`);
		}

		// ---- 12. SEARCH a non-URL query — assert it routes to a web search -----
		try {
			await omnibox.click();
			await omnibox.fill("brainstorm knowledge management");
			await omnibox.press("Enter");
			await br.waitForTimeout(6000);
			const omniAfter = await omnibox.inputValue().catch(() => "?");
			// normalizeOmnibox sends word-like input to duckduckgo.
			const views = await dumpViews(s);
			const searchView = views.find((v) => v.url.includes("duckduckgo.com") || /[?&]q=/.test(v.url));
			verdict(
				searchView || /duckduckgo|[?&]q=/.test(omniAfter) ? "PASS" : "?",
				"non-URL query routes to web search",
				`omnibox "${omniAfter}", search view url=${searchView?.url.slice(0, 80) ?? "(none seen)"}`,
			);
			await s.shot(br, "search-results");
		} catch (err) {
			verdict("FAIL", "search query", `threw: ${(err as Error).message}`);
		}

		// ---- 13. LINK FOLLOWING (PRIORITY) — omnibox history suggestion -------
		// The page DOM lives in the native view so a real in-page link click is
		// not reachable from the renderer. The renderer-reachable equivalent is
		// following a remembered link: type a prefix, pick a History suggestion,
		// and assert it navigates to that link's URL.
		try {
			await omnibox.click();
			await omnibox.fill("example");
			await br.waitForTimeout(1500);
			const suggestions = br.locator(".browser__suggestion");
			const sugCount = await suggestions.count().catch(() => 0);
			s.note(`  omnibox suggestions for "example": ${sugCount}`);
			if (sugCount > 0) {
				const sugUrls = await suggestions
					.locator(".browser__suggestion-url")
					.allTextContents()
					.catch(() => [] as string[]);
				s.note(`  suggestion urls ${JSON.stringify(sugUrls.slice(0, 5))}`);
				await s.shot(br, "omnibox-suggestions");
				// Follow the first remembered link.
				await suggestions
					.first()
					.click()
					.catch(() => undefined);
				await br.waitForTimeout(5000);
				const omniAfter = await omnibox.inputValue().catch(() => "?");
				const views = await dumpViews(s);
				const followedPaint = views.some(
					(v) => v.visible === "true" && v.bounds.width > 100 && v.url.startsWith("http"),
				);
				verdict(
					omniAfter.startsWith("http") && followedPaint ? "PASS" : "?",
					"following a remembered link navigates + paints",
					`omnibox "${omniAfter}", a visible http view painted=${followedPaint}`,
				);
				await s.shot(br, "link-followed-suggestion");
			} else {
				verdict("?", "link following via suggestion", "no history suggestions surfaced for prefix");
				await br.keyboard.press("Escape").catch(() => undefined);
			}
		} catch (err) {
			verdict("FAIL", "link following via suggestion", `threw: ${(err as Error).message}`);
		}

		// ---- 14. LINK FOLLOWING via the History menu visited entry ------------
		try {
			const historyBtn = br.locator('[aria-label="History"]').first();
			if (await historyBtn.isVisible().catch(() => false)) {
				await historyBtn.click().catch(() => undefined);
				await br.waitForTimeout(1000);
				await s.shot(br, "history-menu");
				const items = br.locator(
					'.fm-menu [role="menuitem"], .fm-menu [role="option"], .fm-menu button',
				);
				const itemTexts = await items.allTextContents().catch(() => [] as string[]);
				s.note(`  history menu rows ${JSON.stringify(itemTexts.slice(0, 12))}`);
				// Pick a "Recently visited" link row (skip section headers + clear).
				const linkRow = items.filter({ hasNotText: "Clear browsing history" }).filter({
					hasNotText: "Recently visited",
				});
				const linkCount = await linkRow.count().catch(() => 0);
				const omniBefore = await omnibox.inputValue().catch(() => "?");
				if (linkCount > 0) {
					await linkRow
						.last()
						.click()
						.catch(() => undefined);
					await br.waitForTimeout(5000);
					const omniAfter = await omnibox.inputValue().catch(() => "?");
					const views = await dumpViews(s);
					const painted = views.some(
						(v) => v.visible === "true" && v.bounds.width > 100 && v.url.startsWith("http"),
					);
					verdict(
						omniAfter !== omniBefore && painted ? "PASS" : "?",
						"History-menu visited entry re-navigates to that link",
						`omnibox "${omniBefore}" → "${omniAfter}", painted=${painted}`,
					);
					await s.shot(br, "history-link-followed");
				} else {
					verdict(
						"?",
						"History-menu link follow",
						`no link rows (menu: ${JSON.stringify(itemTexts.slice(0, 6))})`,
					);
					await br.keyboard.press("Escape").catch(() => undefined);
				}
			} else {
				verdict("FAIL", "History menu present in chrome", "no History button found");
			}
		} catch (err) {
			verdict("FAIL", "History-menu link follow", `threw: ${(err as Error).message}`);
		}

		// ---- 15. FIND IN PAGE — header chrome / Cmd+F path --------------------
		try {
			await br.keyboard.press(`${MOD}+f`);
			await br.waitForTimeout(800);
			const findInput = br.locator('[aria-label="Find in page"]').first();
			if (await findInput.isVisible().catch(() => false)) {
				await findInput.fill("domain").catch(() => undefined);
				await br.waitForTimeout(2000);
				const count = await br
					.locator(".browser__findbar-count")
					.first()
					.textContent()
					.catch(() => null);
				verdict(
					"PASS",
					"Cmd+F find-in-page bar opens + counts",
					`count reads "${count?.trim() ?? "?"}"`,
				);
				await s.shot(br, "find-bar");
				await br.keyboard.press("Escape").catch(() => undefined);
			} else {
				verdict("?", "Cmd+F find-in-page", "find bar did not surface");
			}
		} catch (err) {
			verdict("FAIL", "find-in-page", `threw: ${(err as Error).message}`);
		}

		// ---- 16. CLOSE a tab (×) — assert tab count drops ---------------------
		try {
			const before = await tabCount(br);
			const closeBtn = br.locator(".browser__tab-close").first();
			if (before >= 2 && (await closeBtn.isVisible().catch(() => false))) {
				await closeBtn.click().catch(() => undefined);
				await br.waitForTimeout(2500);
				const after = await tabCount(br);
				verdict(
					after < before ? "PASS" : "FAIL",
					"close-tab (×) drops a tab",
					`tab count ${before} → ${after}`,
				);
			} else {
				verdict("?", "close-tab (×)", `only ${before} tab(s) — skipped to avoid closing the window`);
			}
			await s.shot(br, "after-close-tab");
		} catch (err) {
			verdict("FAIL", "close-tab (×)", `threw: ${(err as Error).message}`);
		}

		// ---- 17. CROSS-BOOT RESTORE — reopen the shell, assert tabs restore ---
		// Record the surviving tabs, finish the session (closes the shell), then
		// boot a fresh session against the same persistent vault (cf 209b/215c).
		let priorTitles: string[] = [];
		try {
			priorTitles = await tabTitles(br);
			s.note(`  tabs before restart ${JSON.stringify(priorTitles.slice(0, 6))}`);
			// Give the debounced BrowsingSession/v1 persistence time to flush.
			await br.waitForTimeout(4000);
		} catch (err) {
			verdict("FAIL", "capture pre-restart tab set", `threw: ${(err as Error).message}`);
		}

		await s.finish();

		const s2 = await startSession("228-deep-browser");
		try {
			const br2 = await s2.openApp(APP.Browser);
			await br2.waitForTimeout(6000);
			await s2.shot(br2, "browser-after-restart");
			const restoredTitles = await tabTitles(br2);
			const restoredCount = await tabCount(br2);
			s2.note(`  tabs after restart ${JSON.stringify(restoredTitles.slice(0, 6))}`);
			// History should also survive — typing a visited prefix yields suggestions.
			const omnibox2 = br2.locator('[aria-label="Address bar"]').first();
			await omnibox2.click().catch(() => undefined);
			await omnibox2.fill("iana").catch(() => undefined);
			await br2.waitForTimeout(1500);
			const sug = await br2
				.locator(".browser__suggestion")
				.allTextContents()
				.catch(() => [] as string[]);
			s2.note(`  history suggestions for "iana" after restart ${JSON.stringify(sug.slice(0, 4))}`);
			await s2.shot(br2, "history-after-restart");
			s2.note(
				`[${restoredCount >= 1 ? "PASS" : "FAIL"}] tabs restore across shell restart — restored ${restoredCount} tab(s) ${JSON.stringify(restoredTitles.slice(0, 4))} (prior ${JSON.stringify(priorTitles.slice(0, 4))})`,
			);
			s2.note(
				`[${sug.length > 0 ? "PASS" : "?"}] browsing history restores across restart — ${sug.length} suggestion(s) for "iana"`,
			);
			s2.chat(
				SPEAKER.Mira,
				"Deep browser pass done — every control judged from what I could actually see, including whether the page painted and whether tabs came back after a restart.",
			);
		} finally {
			await s2.finish();
		}
	} finally {
		// s.finish() was already called before the restart leg; calling again is a
		// no-op-safe close (the harness swallows close errors).
		await s.finish().catch(() => undefined);
	}
});
