/**
 * Probe 933 — the standing "Bookmarks ⋯ overlaps the Read pill" question.
 *
 * The 329 sweep could not answer it: the surface pill renders only on the
 * Tags surface AND only for a non-Inbox card, and the seeded vault has zero
 * Read/Archive bookmarks — so no capture could contain a pill. This probe
 * marks the first bookmark read (harmless dogfood-vault state), opens the
 * "All" tag view, hovers the card so the ⋯ cluster reveals, and captures
 * both states for the overlap judgement.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe — bookmarks read-pill vs hover-⋯ (933)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("933-probe-bookmarks-pill");
	try {
		const page = await s.openApp(APP.Bookmarks);
		await page.waitForTimeout(2200);

		// Mark the first card read via its context menu.
		const card = page.locator(".bookmarks__card").first();
		await card.click({ button: "right", timeout: 5000 });
		await page.waitForTimeout(600);
		const markRead = page.getByText(/^Mark read$/i).first();
		if (await markRead.count()) {
			await markRead.click({ timeout: 5000 });
			await page.waitForTimeout(800);
			s.note("marked first bookmark read");
		} else {
			await page.keyboard.press("Escape");
			s.note("no Mark read item — first card may already be read");
		}

		// The All tag view is the Tags surface: pills render there.
		await page.getByText(/^All$/).first().click({ timeout: 5000 });
		await page.waitForTimeout(900);
		await s.shot(page, "01-all-tags-rest");

		const readCard = page.locator(".bookmarks__card", { hasText: /read/i }).first();
		const target = (await readCard.count()) ? readCard : page.locator(".bookmarks__card").first();
		await target.hover({ timeout: 5000 });
		await page.waitForTimeout(600);
		await s.shot(page, "02-all-tags-hover");

		// The Tag board lane got the fade fix — capture it too for contrast.
		await page.getByText(/^Tag board$/i).first().click({ timeout: 5000 });
		await page.waitForTimeout(900);
		await s.shot(page, "03-tag-board-rest");
		const laneCard = page.locator(".bookmarks__tag-board .bookmarks__card").first();
		if (await laneCard.count()) {
			await laneCard.hover({ timeout: 5000 });
			await page.waitForTimeout(600);
			await s.shot(page, "04-tag-board-hover");
		}
	} finally {
		await s.finish();
	}
});
