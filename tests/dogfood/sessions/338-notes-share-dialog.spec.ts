/**
 * Session 338 — Collab-C5.3b: the Notes "Share…" object-menu item opens the
 * shared <ShareDialog>. Single-shell smoke: open Notes → open the note's ⋯
 * menu → "Share…" is present → click it → the dialog mounts with the member
 * list + "Get my invite code". (The full two-user share is the collab tier.)
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("Notes object menu offers Share… and opens the dialog (338)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("338-notes-share-dialog");
	try {
		const page = await s.openApp(APP.Notes);
		if (!page) throw new Error("Notes did not open");
		const errs = collectConsoleErrors(page);
		page.setDefaultTimeout(8000);
		await page.waitForTimeout(2200);

		// Open the header object ⋯ menu.
		const more = page.locator(".app-header .bs-object-menu__more").first();
		await more.click();
		await page.waitForTimeout(500);
		await s.shot(page, "01-objmenu-open");

		// "Share…" must be present (Notes holds sharing.share).
		const shareItem = page.getByText("Share…", { exact: false }).first();
		await expect(shareItem).toBeVisible();

		await shareItem.click();
		await page.waitForTimeout(900);
		await s.shot(page, "02-share-dialog");

		// The dialog mounted with its sections.
		const dialog = page.locator('[data-testid="share-dialog"], .bs-share').first();
		await expect(dialog).toBeVisible();
		await expect(page.getByText("People with access", { exact: false })).toBeVisible();
		await expect(page.getByText("Get my invite code", { exact: false })).toBeVisible();

		// Mint a code → it appears in the readonly field.
		await page.getByText("Get my invite code", { exact: false }).click();
		await page.waitForTimeout(700);
		await s.shot(page, "03-invite-code");

		if (errs.errors.length > 0) {
			s.note(`[?] console errors (${errs.errors.length}):`);
			for (const e of errs.errors.slice(0, 8)) s.note(`    ${e}`);
		}
		await page.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
