/**
 * Session 370 — verify polishing round 2.
 *
 * - F-305 (Books double empty-state): the empty library should now show ONE
 *   actionable empty state — the prominent reader hero carries the "Import a
 *   book" CTA; the sidebar's redundant primary button is gone (quiet note only).
 * - F-304 (Contacts compose field): the New-contact popover input now rides
 *   `.bs-input` (32px md) instead of a hand-rolled box.
 * - F-304 (Whiteboard board-name rename): rides `.bs-input--sm`.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("polish round 2 — Books empty-state + Contacts/Whiteboard control faces (370)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("370-polish-r2-verify");
	try {
		// ---- F-305 Books: one empty state, CTA on the hero ----------------
		const books = await s.openApp(APP.Books);
		const bErrs = collectConsoleErrors(books);
		await books.waitForTimeout(2500);
		const heroAction = await books.locator(".bs-empty-state__action button").count().catch(() => 0);
		const sidebarBlank = await books.locator(".books__library-blank").count().catch(() => 0);
		const sidebarCta = await books.locator(".books__library-import-cta").count().catch(() => 0);
		s.note(
			`[books] hero action buttons=${heroAction} (want 1), sidebar blank note=${sidebarBlank}, sidebar redundant CTA=${sidebarCta} (want 0)`,
		);
		await s.shot(books, "books-empty-full");
		if (bErrs.errors.length > 0) for (const e of bErrs.errors.slice(0, 3)) s.note(`    books: ${e}`);
		await books.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(250).catch(() => undefined);

		// ---- F-304 Contacts: compose field on .bs-input -------------------
		const contacts = await s.openApp(APP.Contacts);
		const cErrs = collectConsoleErrors(contacts);
		await contacts.waitForTimeout(2500);
		// Open the New-contact popover (header + or the empty-state CTA).
		const newBtn = contacts
			.locator('[data-testid="contacts-empty-new"], [aria-label*="new" i], [aria-label*="add" i]')
			.first();
		await newBtn.click().catch(() => undefined);
		await contacts.waitForTimeout(800);
		const compose = await contacts
			.evaluate(() => {
				const el = document.querySelector(".contacts-compose__input") as HTMLElement | null;
				const btn = document.querySelector(".contacts-compose__actions .bs-btn") as HTMLElement | null;
				return {
					input: el ? Math.round(el.getBoundingClientRect().height) : null,
					hasBsInput: el?.classList.contains("bs-input") ?? false,
					button: btn ? Math.round(btn.getBoundingClientRect().height) : null,
				};
			})
			.catch(() => null);
		s.note(
			`[contacts] compose input=${compose?.input ?? "?"}px (.bs-input=${compose?.hasBsInput}), compose button=${compose?.button ?? "—"}px (want input==button, on scale)`,
		);
		await s.shot(contacts, "contacts-compose");
		if (cErrs.errors.length > 0) for (const e of cErrs.errors.slice(0, 3)) s.note(`    contacts: ${e}`);
		await contacts.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(250).catch(() => undefined);

		// ---- F-304 Whiteboard: header board-name --------------------------
		const wb = await s.openApp(APP.Whiteboard);
		const wErrs = collectConsoleErrors(wb);
		await wb.waitForTimeout(2500);
		await s.shot(wb, "whiteboard-header", wb.locator(".app-header").first());
		// Trigger the inline board-name rename to measure the .bs-input--sm field.
		const nameEl = wb.locator('[class*="board-name"]').first();
		await nameEl.dblclick().catch(() => undefined);
		await wb.waitForTimeout(500);
		const wbInput = await wb
			.evaluate(() => {
				const el = document.querySelector(".whiteboard__board-name-input") as HTMLElement | null;
				return el
					? { h: Math.round(el.getBoundingClientRect().height), bs: el.classList.contains("bs-input") }
					: null;
			})
			.catch(() => null);
		s.note(`[whiteboard] board-name input=${wbInput?.h ?? "n/a"}px (.bs-input=${wbInput?.bs ?? "n/a"}; want 24 sm)`);
		await wb.keyboard.press("Escape").catch(() => undefined);
		if (wErrs.errors.length > 0) for (const e of wErrs.errors.slice(0, 3)) s.note(`    wb: ${e}`);
	} finally {
		await s.finish();
	}
});
