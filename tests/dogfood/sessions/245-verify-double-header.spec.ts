/**
 * Session 245 — verify F-252: the right panel no longer shows a doubled
 * "Properties" header (the comments tab strip already labels it). Assert the
 * Properties tab exists but the inner `.bs-props__head` is suppressed in Notes
 * and Journal.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

async function probe(page: Page): Promise<{ tabCount: number; innerHeads: number }> {
	return page.evaluate(() => {
		const tabs = Array.from(document.querySelectorAll(".bs-panel-tab")).filter((b) =>
			/propert/i.test(b.textContent ?? ""),
		).length;
		const innerHeads = document.querySelectorAll(".bs-props__head").length;
		return { tabCount: tabs, innerHeads };
	});
}

test("F-252 — Notes & Journal right panel has no doubled Properties header (245)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("245-verify-double-header");
	try {
		const n = await s.openApp(APP.Notes as AppId);
		await n.waitForTimeout(2800);
		const np = await probe(n);
		s.note(`notes: properties-tabs=${np.tabCount} inner-heads=${np.innerHeads}`);
		await s.shot(n, "notes-panel");

		const j = await s.openApp(APP.Journal as AppId);
		await j.waitForTimeout(2800);
		const jp = await probe(j);
		s.note(`journal: properties-tabs=${jp.tabCount} inner-heads=${jp.innerHeads}`);
		await s.shot(j, "journal-panel");

		// Exactly the tab labels "Properties"; the inner shared-panel header is gone.
		expect(np.tabCount, "notes properties tab present").toBeGreaterThanOrEqual(1);
		expect(np.innerHeads, "notes: no inner .bs-props__head (no double header)").toBe(0);
		expect(jp.tabCount, "journal properties tab present").toBeGreaterThanOrEqual(1);
		expect(jp.innerHeads, "journal: no inner .bs-props__head (no double header)").toBe(0);
	} finally {
		await s.finish();
	}
});
