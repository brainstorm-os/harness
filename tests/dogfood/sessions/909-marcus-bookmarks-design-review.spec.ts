/**
 * Session 909 — Marcus design-reviews Bookmarks (Launch-2 sweep, 2 of 12).
 *
 * Second rung of the all-apps design sweep gating the August Product Hunt
 * launch. Bookmarks just had its empty-state CTA converted to the shared
 * `<EmptyState>` (F-444 / shell #219) — Marcus verifies that landed, then
 * walks the app's real surfaces: the add flow, the card list, the detail
 * pane, and every rail surface's empty state (the F-441 class check, per
 * surface). Spec navigates + captures + inventories only; the friction is
 * written from the screenshots afterward.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Marcus design-reviews Bookmarks — empty states, add flow, cards, detail (909)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("909-marcus-bookmarks-design-review");
	s.chat(
		SPEAKER.Marcus,
		"Bookmarks is next on my list. The empty-state button was apparently reborn last night — I'll believe it when I see it. Then the add flow, the cards, and every surface's empty state, because that's where this product keeps slipping.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1800);
		await s.shot(bm, "01-first-impression");

		// Inventory the first screen — what the eye lands on.
		const inv = await bm.evaluate(() => {
			const buttons = [...document.querySelectorAll("button")]
				.map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 25);
			const rail = [...document.querySelectorAll("nav a, nav button, aside button, aside a")]
				.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 25);
			const emptyStateShared = document.querySelector(".bs-empty-state") !== null;
			return { buttons, rail, emptyStateShared };
		});
		s.note(`=== shared EmptyState present === ${inv.emptyStateShared}`);
		s.note(`=== buttons === ${JSON.stringify(inv.buttons)}`);
		s.note(`=== rail items === ${JSON.stringify(inv.rail)}`);

		// ── The add flow.
		const addBtn = bm.locator("button", { hasText: "Add bookmark" });
		if ((await addBtn.count().catch(() => 0)) > 0) {
			await addBtn.first().click();
			await bm.waitForTimeout(700);
			await s.shot(bm, "02-add-dialog");
			const urlInput = bm.locator(
				'input[type="url"], input[placeholder*="http" i], input[placeholder*="URL" i], [data-testid*=add] input',
			);
			if ((await urlInput.count().catch(() => 0)) > 0) {
				await urlInput.first().fill("https://example.com/").catch(() => undefined);
				await s.shot(bm, "03-add-filled");
				await bm.keyboard.press("Enter").catch(() => undefined);
				// Capture may hit the network — give it a moment either way; a
				// graceful-or-ugly failure is review material too.
				await bm.waitForTimeout(9000);
				await s.shot(bm, "04-after-add");
			} else {
				s.note("no URL input found in the add dialog");
				await bm.keyboard.press("Escape").catch(() => undefined);
			}
		} else {
			s.note("no 'Add bookmark' button on first screen");
		}

		// ── A card + the detail pane, if anything exists now.
		const card = bm.locator(".bookmarks__cards li, [class*=card]").first();
		if ((await card.count().catch(() => 0)) > 0) {
			await card.click().catch(() => undefined);
			await bm.waitForTimeout(900);
			await s.shot(bm, "05-detail-pane");
		}

		// ── Every rail surface's empty state (the F-441 class check).
		for (const [label, shotName] of [
			["Read", "06-surface-read"],
			["Archive", "07-surface-archive"],
			["Tags", "08-surface-tags"],
			["Inbox", "09-surface-inbox"],
		] as const) {
			const item = bm.locator(`nav >> text=${label}`).first();
			if ((await item.count().catch(() => 0)) > 0) {
				await item.click().catch(() => undefined);
				await bm.waitForTimeout(700);
				await s.shot(bm, shotName);
			} else {
				s.note(`rail surface not found: ${label}`);
			}
		}

		s.note(`=== console errors (${errors.length}) ===`);
		for (const e of errors.slice(0, 20)) s.note(e);

		s.chat(
			SPEAKER.Marcus,
			"Bookmarks captured: the reborn empty state, the add flow end to end, a card, the detail pane, and four surface empties. Writing the verdicts now.",
		);
	} finally {
		await s.close();
	}
});
