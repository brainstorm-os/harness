/**
 * Session 309 — real-shell verification of the polish sweep.
 *
 * Drives the changed flows and captures FACTUAL signals (logged as
 * `RESULT <check>: <json>` so the verdict can be read off stdout):
 *  - Automations: reminder due field is the shared picker, NOT native datetime-local.
 *  - Browser: "Clear browsing data" shows a role=status confirmation.
 *  - Form-designer: create a form → delete it via the per-row ⋯ → count drops.
 *  - Whiteboard: board nav buttons exist + enable after navigating to a 2nd board.
 *  - Books: reader controls carry data-bs-tooltip (not native title).
 *  - Mailbox: flag control renders a star glyph (idle/connect state captured).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

function result(label: string, data: unknown): void {
	// biome-ignore lint/suspicious/noConsole: harness signal channel
	console.log(`RESULT ${label}: ${JSON.stringify(data)}`);
}

test("session 309 polish verification", async () => {
	test.setTimeout(600_000);
	const s = await startSession("309-polish-verify");
	try {
		// ── Automations: shared date picker, no native datetime-local ──────────
		try {
			const page = await s.openApp(APP.Automations);
			await page.waitForTimeout(2200);
			// Switch to the Reminders tab (where the capture due field lives).
			await page
				.locator('[role="tab"]')
				.filter({ hasText: /reminder/i })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(900);
			const nativeDatetime = await page.locator('input[type="datetime-local"]').count();
			const dueTrigger = await page.locator(".au-capture__due-trigger").count();
			result("automations", { nativeDatetime, dueTrigger });
			await s.shot(page, "automations-reminders");
		} catch (err) {
			result("automations", { error: (err as Error).message });
		}

		// ── Browser: Clear browsing data → confirmation ────────────────────────
		try {
			const page = await s.openApp(APP.Browser);
			await page.waitForTimeout(2200);
			// Open the overflow ⋯ menu (the trailing nav button with menu.open aria).
			await page
				.locator('.browser__navbtn[aria-haspopup="menu"], .browser__navbtn[aria-label*="menu" i]')
				.last()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(700);
			const clearRow = page.locator(".fm-row").filter({ hasText: /clear/i }).first();
			const clearRowFound = await clearRow.count();
			await clearRow.click().catch(() => undefined);
			await page.waitForTimeout(900);
			const statusText = await page
				.locator('.browser__clip-status[role="status"]')
				.allInnerTexts()
				.catch(() => [] as string[]);
			const confirmation = statusText.map((t) => t.trim()).filter(Boolean);
			result("browser", { clearRowFound, confirmation });
			await s.shot(page, "browser-clear-data");
		} catch (err) {
			result("browser", { error: (err as Error).message });
		}

		// ── Form-designer: create → delete via per-row ⋯ ───────────────────────
		try {
			const page = await s.openApp(APP.FormDesigner);
			await page.waitForTimeout(2200);
			const itemsBefore = await page.locator(".fd-sidebar__item").count();
			// Create a form (the fill-pane primary "Create" button).
			await page
				.locator("button.bs-btn[data-bs-primary]")
				.filter({ hasText: /create/i })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1300);
			const itemsAfterCreate = await page.locator(".fd-sidebar__item").count();
			// Open the per-row ⋯ on the first sidebar item.
			const row = page.locator(".fd-sidebar__item").first();
			await row.hover().catch(() => undefined);
			await row
				.locator(".fd-sidebar__item-more")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(600);
			const deleteRowFound = await page
				.locator(".fm-row")
				.filter({ hasText: /delete/i })
				.count();
			await page
				.locator(".fm-row")
				.filter({ hasText: /delete/i })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(600);
			await s.shot(page, "fd-delete-confirm");
			// Confirm in the .fd-confirm dialog (the danger button).
			await page
				.locator(".fd-confirm__actions button")
				.filter({ hasText: /delete/i })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1300);
			const itemsAfterDelete = await page.locator(".fd-sidebar__item").count();
			result("formDesigner", {
				itemsBefore,
				itemsAfterCreate,
				deleteRowFound,
				itemsAfterDelete,
			});
			await s.shot(page, "fd-after-delete");
		} catch (err) {
			result("formDesigner", { error: (err as Error).message });
		}

		// ── Whiteboard: nav buttons exist + enable after a 2nd-board nav ────────
		try {
			const page = await s.openApp(APP.Whiteboard);
			await page.waitForTimeout(2600);
			const back = page.locator('[data-testid="nav-back"]').first();
			const present = (await back.count()) > 0;
			const backDisabledInitial = present ? await back.isDisabled() : null;
			// Open boards from the nav list to build history.
			const boardEntries = page.locator(".whiteboard__nav-list button, .whiteboard__nav-list a");
			const boardCount = await boardEntries.count().catch(() => 0);
			let backEnabledAfterNav: boolean | null = null;
			if (boardCount >= 2) {
				await boardEntries
					.nth(0)
					.click()
					.catch(() => undefined);
				await page.waitForTimeout(900);
				await boardEntries
					.nth(1)
					.click()
					.catch(() => undefined);
				await page.waitForTimeout(900);
				backEnabledAfterNav = !(await back.isDisabled().catch(() => true));
			}
			result("whiteboard", { present, boardCount, backDisabledInitial, backEnabledAfterNav });
			await s.shot(page, "whiteboard-nav");
		} catch (err) {
			result("whiteboard", { error: (err as Error).message });
		}

		// ── Books: reader controls carry data-bs-tooltip, not native title ─────
		try {
			const page = await s.openApp(APP.Books);
			await page.waitForTimeout(2200);
			// Open the first library card if present.
			const card = page
				.locator('.books__library-card, .books__lib-card, [class*="library"] [role="button"]')
				.first();
			if ((await card.count()) > 0) {
				await card.click().catch(() => undefined);
				await page.waitForTimeout(1600);
			}
			const tooltipControls = await page.locator("[data-bs-tooltip]").count();
			const nativeTitleControls = await page
				.locator(".books__reader [title], .books__chrome [title], .books__footer [title]")
				.count();
			result("books", { tooltipControls, nativeTitleControls });
			await s.shot(page, "books-reader");
		} catch (err) {
			result("books", { error: (err as Error).message });
		}

		// ── Mailbox: flag uses a star (idle/connect state, account-gated) ──────
		try {
			const page = await s.openApp(APP.Mailbox);
			await page.waitForTimeout(2200);
			const flagControls = await page
				.locator('[aria-label*="flag" i]')
				.count()
				.catch(() => 0);
			result("mailbox", { flagControls, note: "flag rows need a connected account" });
			await s.shot(page, "mailbox-idle");
		} catch (err) {
			result("mailbox", { error: (err as Error).message });
		}
	} finally {
		await s.finish();
	}
});
