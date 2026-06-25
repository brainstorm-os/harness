/**
 * Session 193 — verify the Browser app actually loads a page now (Tue).
 *
 * Session 192 found the Browser chrome rendered but every navigation failed:
 * the WebView host service was registered/called as `"webView"`, which the
 * lowercase-only IPC envelope `service` pattern rejects — 4× "service must be a
 * lowercase identifier" and a blank page. Fixed by pinning the wire name to a
 * `WEBVIEW_SERVICE = "webview"` constant. Mira re-opens the browser to capture a
 * real research source: open → type a URL → it should render, with no envelope
 * errors in the console.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira loads a page in the Browser (193)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("193-mira-browser-loads");
	try {
		s.chat(
			SPEAKER.Mira,
			"The browser wouldn't load anything last time. Trying again — opening a source page to capture for the next issue.",
		);

		const b = await s.openApp(APP.Browser);
		await b.waitForLoadState("domcontentloaded").catch(() => undefined);
		await b.waitForTimeout(1500);
		await s.shot(b, "01-browser-open");

		const addr = b
			.locator(
				"input[type='url'], input[placeholder*='Search'], input[placeholder*='address'], .browser-omnibox input, [data-testid='omnibox']",
			)
			.first();
		const haveOmnibox = (await addr.count().catch(() => 0)) > 0;
		s.note(`omnibox present: ${haveOmnibox}`);
		if (haveOmnibox) {
			await addr.click().catch(() => undefined);
			await addr.fill("https://example.com").catch(() => undefined);
			await addr.press("Enter").catch(() => undefined);
			// Give the WebContentsView time to navigate + paint.
			await b.waitForTimeout(4000);
			await s.shot(b, "02-after-navigate");
			const tabTitle = await b
				.locator(".browser-tab__title, [data-tab-title], .tab-strip__tab")
				.first()
				.innerText()
				.catch(() => "");
			s.note(`tab title after navigate: "${tabTitle}"`);
		}
		await s.shot(b, "03-final");

		s.chat(
			SPEAKER.Mira,
			"Reading the captures + console to confirm the page renders and the envelope error is gone.",
		);
		s.note("Verdict (page loaded? envelope error gone?) decided from captures + console.log.");
	} finally {
		await s.finish();
	}
});
