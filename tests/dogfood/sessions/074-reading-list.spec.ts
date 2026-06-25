/**
 * Session 074 — Mira organizes her research reading list.
 *
 * Her captured bookmarks are an undifferentiated pile; she's pulling research
 * for the newsletter, so she tags her sources with a shared "newsletter-research"
 * label to group them, then filters to that tag to see just the reading list.
 * Exercises the Bookmarks tag-edit + tag-filter path (right-click card → Edit
 * tags → comma-separated input → Save; then the tag-list nav to filter).
 *
 * APPENDS the tag (reads the pre-filled value first) so existing tags are
 * preserved, and is idempotent (the save path dedups, and a card already
 * carrying the tag is left as-is).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const TAG = "newsletter-research";
const HOW_MANY = 3;

test("tag and filter a research reading list", async () => {
	test.setTimeout(180_000);
	const s = await startSession("074-reading-list");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "01-before");

		const cards = bm.locator(".bookmarks__card[data-entity-id]");
		const total = await cards.count();
		const target = Math.min(HOW_MANY, total);
		s.note(`bookmarks present: ${total}; tagging ${target} with "${TAG}"`);

		for (let i = 0; i < target; i++) {
			// Re-resolve the card each iteration (the list re-renders on save).
			const card = bm.locator(".bookmarks__card[data-entity-id]").nth(i);
			const alreadyTagged = (await card.locator(".bookmarks__card-tag").allInnerTexts())
				.map((t) => t.trim())
				.some((t) => t.includes(TAG));
			if (alreadyTagged) {
				s.note(`card ${i} already tagged — skipping`);
				continue;
			}
			await card.click({ button: "right" });
			await bm.waitForTimeout(350);
			await bm
				.locator('.fm-menu [role="option"]', { hasText: /edit tags/i })
				.first()
				.click();
			await bm.waitForTimeout(400);
			const input = bm.locator(".bookmarks__form-input").first();
			await expect(input, `edit-tags form opened for card ${i}`).toBeVisible();
			const current = (await input.inputValue()).trim();
			await input.fill(current.length > 0 ? `${current}, ${TAG}` : TAG);
			await bm.locator("[data-bs-primary]").first().click();
			await bm.waitForTimeout(700);
			s.note(`tagged card ${i} (was: "${current}")`);
		}
		await s.shot(bm, "02-tagged");

		// Filter to the reading-list tag via the tag nav.
		const tagBtn = bm.locator(".bookmarks__tag-list-btn", { hasText: new RegExp(TAG, "i") }).first();
		if ((await tagBtn.count()) > 0) {
			await tagBtn.click();
			await bm.waitForTimeout(700);
			await s.shot(bm, "03-filtered");
			const filtered = await bm.locator(".bookmarks__card[data-entity-id]").count();
			s.note(`cards shown under "${TAG}" filter: ${filtered}`);
			expect(filtered, "the filter shows the tagged reading list").toBeGreaterThanOrEqual(target);
		}

		// Every targeted card now carries the shared tag.
		const tagged = await bm
			.locator(".bookmarks__card[data-entity-id]", {
				has: bm.locator(".bookmarks__card-tag", { hasText: new RegExp(TAG, "i") }),
			})
			.count();
		s.note(`cards carrying "${TAG}": ${tagged}`);
		expect(
			tagged,
			`at least ${target} bookmarks tagged into the reading list`,
		).toBeGreaterThanOrEqual(target);
	} finally {
		await s.finish();
	}
});
