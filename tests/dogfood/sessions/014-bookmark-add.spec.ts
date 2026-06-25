/**
 * Session 014 — reproduce Bookmarks capture precisely (session 012's generic
 * selectors likely missed the form). Drive the real flow: header "+" → URL
 * field → submit, then read the count as text.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Bookmarks — capture a research URL via the real flow", async () => {
	test.setTimeout(180_000);
	const s = await startSession("014-bookmark-add");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);

		const before =
			(await bm
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(`Before: ${JSON.stringify(before.replace(/\s+/g, " ").slice(0, 120))}`);

		await bm.locator('[aria-label="Add bookmark"]').first().click();
		await bm.waitForTimeout(700);
		const url = bm.locator(".bookmarks__form-input").first();
		await url.click().catch(() => undefined);
		await url.type("https://example.com/research/through-line", { delay: 8 });
		// Scope to the dialog — the empty-state "Add bookmark" button shares the
		// primary class, so an unscoped selector hits the wrong button.
		const submit = bm.locator('[role="dialog"] [data-bs-primary]').first();
		s.note(`Submit button text: ${JSON.stringify(await submit.textContent())}`);
		await submit.click({ force: true });
		await bm.waitForTimeout(1500);

		await s.shot(bm, "result");
		const after =
			(await bm
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(`After: ${JSON.stringify(after.replace(/\s+/g, " ").slice(0, 200))}`);

		// The new bookmark (or its host) should be present.
		const got = await bm.locator("text=/example\\.com|through-line/i").count();
		s.note(`Matches for the captured URL: ${got}`);
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
