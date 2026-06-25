/**
 * Probe 230 — reproduce the reported "I tried adding https://ruyixuanhotpot.de/
 * but it could not be parsed". Adds that exact URL via the Add-bookmark popover
 * with "Download page content" left ON (the default), then records:
 *   - whether the compose form showed an error (invalid-url / duplicate),
 *   - whether the bookmark actually landed in the list,
 *   - what the detail view shows (capture error message vs content).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const URL = "https://ruyixuanhotpot.de/";

test("probe: add ruyixuanhotpot.de bookmark (230)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("230-probe-bookmark-url");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2400);

		await bm
			.locator('[aria-label="Add bookmark"]')
			.first()
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(800);
		// First text input in the compose form is the URL field.
		const urlInput = bm.locator(".bookmarks__form-input, .bookmarks__form input").first();
		await urlInput.click().catch(() => undefined);
		await bm.keyboard.type(URL, { delay: 12 });
		await bm.waitForTimeout(300);
		// Force the capture path: tick "Download page content for offline reading".
		await bm
			.getByText("Download page content", { exact: false })
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(200);
		await s.shot(bm, "01-compose-filled");

		// Save — the real footer button.
		await bm
			.getByRole("button", { name: "Save bookmark" })
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(2000);

		// Did the compose form reject it (error visible + popover still open)?
		const composeErr = await bm
			.evaluate(() => {
				const e = document.querySelector(
					".bookmarks__form-error, [class*='form-error']",
				) as HTMLElement | null;
				const visible = e && !e.hidden && e.offsetParent !== null;
				return {
					composeErrorShown: !!visible,
					composeErrorText: visible ? (e?.textContent ?? "") : null,
				};
			})
			.catch((err) => `(eval failed: ${(err as Error).message})`);
		s.note(`compose result: ${JSON.stringify(composeErr)}`);
		await s.shot(bm, "02-after-save");

		// Did the bookmark land in the list?
		const inList = await bm
			.evaluate((u: string) => {
				const cards = Array.from(document.querySelectorAll(".bookmarks__card"));
				const hit = cards.find((c) => (c.textContent ?? "").includes("ruyixuanhotpot"));
				return { totalCards: cards.length, found: !!hit };
			}, URL)
			.catch((err) => `(eval failed: ${(err as Error).message})`);
		s.note(`bookmark in list: ${JSON.stringify(inList)}`);

		// Open it and read the detail capture state.
		const titleBtn = bm
			.locator(".bookmarks__card-title")
			.filter({ hasText: "ruyixuanhotpot" })
			.first();
		if (await titleBtn.count().catch(() => 0)) {
			await titleBtn.click().catch(() => undefined);
			await bm.waitForTimeout(3000); // allow the async capture attempt
			const detail = await bm
				.evaluate(() => {
					const err = document.querySelector(".bm-detail__capture-error") as HTMLElement | null;
					const capturing = document.querySelector(".bm-detail__capturing") as HTMLElement | null;
					const body = document.querySelector(".bm-detail__body") as HTMLElement | null;
					return {
						captureErrorShown: !!err,
						captureErrorText: err?.textContent ?? null,
						capturing: !!capturing,
						bodyTextLen: (body?.textContent ?? "").trim().length,
					};
				})
				.catch((e) => `(eval failed: ${(e as Error).message})`);
			s.note(`detail capture state: ${JSON.stringify(detail)}`);
			await s.shot(bm, "03-detail");
		} else {
			s.note("could not find the bookmark card to open");
		}
	} finally {
		await s.finish();
	}
});
