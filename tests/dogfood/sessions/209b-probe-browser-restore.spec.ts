/**
 * Probe 209b — cross-boot persistence of the two new browser entities:
 * BrowsingSession/v1 (tabs restore on launch) and BrowsingHistory/v1
 * (yesterday's visits feed suggestions in a fresh shell).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("probe: browser restores tabs + history across shell restarts (209b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("209b-probe-browser-restore");
	try {
		const br = await s.openApp(APP.Browser);
		await br.waitForTimeout(5000);
		await s.shot(br, "01-browser-fresh-boot");
		const tabs = await br
			.locator('[class*="tab"]')
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`tabs on fresh boot: ${JSON.stringify(tabs.filter((t) => t.trim()).slice(0, 6))}`);
		const omnibox = br.locator('[aria-label="Address bar"]').first();
		const omniValue = await omnibox.inputValue().catch(() => "?");
		s.note(`omnibox on boot: ${omniValue}`);
		// History should remember session 209's visits in this fresh process.
		await omnibox.click().catch(() => undefined);
		await omnibox.fill("iana").catch(() => undefined);
		await br.waitForTimeout(1200);
		const sugg = await br
			.locator(".browser__suggestion")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`suggestions for "iana" after restart: ${JSON.stringify(sugg.slice(0, 4))}`);
		await s.shot(br, "02-history-after-restart");
		s.chat(SPEAKER.Mira, "Restart memory check done.");
	} finally {
		await s.finish();
	}
});
