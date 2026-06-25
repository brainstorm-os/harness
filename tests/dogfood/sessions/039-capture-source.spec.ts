/**
 * Session 039 — Mira captures a research source. Opens Bookmarks, adds a URL
 * with "Download page content" on (readable extraction), and confirms the
 * bookmark lands with its domain/title. Dogfoods the Bookmarks capture flow.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("capture a research source via Bookmarks", async () => {
	test.setTimeout(180_000);
	const s = await startSession("039-capture-source");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "01-bookmarks-open");

		const addBtn = bm.locator(".bookmarks__header-add").first();
		s.note(`Add-bookmark button present: ${(await addBtn.count()) > 0}`);
		await addBtn.click();
		await bm.waitForTimeout(500);

		const dialog = bm.locator('[role="dialog"]');
		s.note(`Compose dialog opened: ${(await dialog.count()) > 0}`);
		const urlInput = dialog.locator(".bookmarks__form-input").first();
		await urlInput.fill("https://example.com");
		// Add a tag so it files under her research.
		const inputs = dialog.locator(".bookmarks__form-input");
		const nInputs = await inputs.count();
		if (nInputs >= 4) {
			await inputs.nth(3).fill("research");
		}
		await s.shot(bm, "02-compose");

		await dialog.locator("[data-bs-primary]").first().click();
		// Readable extraction fetches the page — give it a moment.
		await bm.waitForTimeout(3000);
		await s.shot(bm, "03-after-capture");

		const body =
			(await bm
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		const hasDomain = /example\.com/i.test(body);
		const hasTitle = /Example Domain/i.test(body);
		s.note(`Bookmark shows domain: ${hasDomain}; readable title "Example Domain": ${hasTitle}`);

		expect(hasDomain).toBe(true);
	} finally {
		await s.finish();
	}
});
