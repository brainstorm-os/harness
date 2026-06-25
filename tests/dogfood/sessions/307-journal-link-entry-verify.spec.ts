/**
 * Session 307 — journal "Link an entry" insertion (re-examines F-237), real
 * Electron. F-237 was "opening the link picker and choosing a target did not
 * insert a link chip." The journal is now React; this drives the real button
 * (`.journal__link-btn` → anchored calendar picker → pick a non-today day) and
 * checks whether a mention chip (`[data-entity-id]`) lands in the body.
 *
 * Records only factual captures (chip counts); verdict decided in triage.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function chipCount(page: Page): Promise<number> {
	return page
		.locator(".journal__entry-editor [data-entity-id]")
		.count()
		.catch(() => -1);
}

test("journal link-an-entry insertion (307)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("307-journal-link");
	try {
		const page = await s.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		s.note("\n### journal — Link an entry → chip inserted? (F-237)");

		const before = await chipCount(page);
		s.note(`body mention chips before: ${before}`);

		const linkBtn = page.locator(".journal__link-btn").first();
		const hasBtn = await linkBtn.isVisible().catch(() => false);
		s.note(`Link-an-entry button present: ${hasBtn}`);
		await linkBtn.click().catch(() => undefined);
		await page.waitForTimeout(700);
		await s.shot(page, "jl-01-picker-open");

		// Pick a non-today day in the picker. SCOPE to the popover (`.bs-cal-popover`)
		// — the sidebar mini-calendar renders the same `.bs-cal-month__cell` class,
		// and clicking ITS day navigates instead of linking. Exact date "20"
		// (in-month, not today which is the 19th in the dogfood vault's clock).
		const day = page
			.locator(".bs-cal-popover .bs-cal-month__cell")
			.filter({ has: page.locator(".bs-cal-month__date", { hasText: /^20$/ }) })
			.first();
		const dayVisible = await day.isVisible().catch(() => false);
		s.note(`picker day cell visible: ${dayVisible}`);
		await day.click().catch(() => undefined);
		await page.waitForTimeout(1400);

		const after = await chipCount(page);
		s.note(`body mention chips after: ${after}`);
		await s.shot(page, "jl-02-after-link");

		// If a chip landed, click the NEWLY-INSERTED journal-entry chip (the last
		// data-entity-id, "@…20 June…" — not the pre-existing product-tour Note
		// mention) and check the journal navigates to that day (open-entity →
		// the journal's own Entry opener focuses the linked day).
		if (after > before) {
			const headerBefore = (
				await page
					.locator(".app-header__title")
					.innerText()
					.catch(() => "")
			).trim();
			s.note(`header before chip click: ${JSON.stringify(headerBefore)}`);
			await page
				.locator(".journal__entry-editor [data-entity-id]")
				.last()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1400);
			const headerAfter = (
				await page
					.locator(".app-header__title")
					.innerText()
					.catch(() => "")
			).trim();
			s.note(`header after chip click: ${JSON.stringify(headerAfter)}`);
			await s.shot(page, "jl-03-after-chip-click");
		}
	} finally {
		await s.finish();
	}
});
