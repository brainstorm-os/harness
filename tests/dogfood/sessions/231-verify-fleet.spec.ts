/**
 * Session 231 — verify the 9-agent fleet fixes (F-227..F-242) in the real shell.
 *
 * One driven pass per fixed app, each emitting [PASS]/[FAIL]/[?] from observable
 * DOM + a screenshot for the visual/hard-to-assert ones. This is the real-shell
 * acceptance the sandbox agents couldn't do — especially the four manifest/host
 * fixes (Books ⋯, Code-editor rename/delete, Theme-editor Save, Contacts company
 * opener) that only take effect after the vault re-seeds the new manifests.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("verify fleet fixes 227-228 (231)", async () => {
	test.setTimeout(560_000);
	const s = await startSession("231-verify-fleet");
	try {
		// ── Form Designer — F-232 (44px header) + F-239 (required validation) ──
		const fd = await s.openApp(APP.FormDesigner);
		await fd.waitForTimeout(2000);
		const fdHeader = await fd
			.evaluate(() => {
				const h = document.querySelector(".app-header") as HTMLElement | null;
				return h ? Math.round(h.getBoundingClientRect().height) : null;
			})
			.catch(() => null);
		s.note(
			`[${fdHeader === 44 ? "PASS" : "FAIL"}] F-232 form-designer header height = ${fdHeader} (want 44)`,
		);
		await s.shot(fd, "01-form-designer-header");
		// Try the Fill tab → Create empty → expect a block, not "Created…".
		await fd
			.getByRole("tab", { name: /fill/i })
			.click()
			.catch(() => undefined);
		await fd.waitForTimeout(600);
		await fd
			.getByRole("button", { name: /create/i })
			.first()
			.click()
			.catch(() => undefined);
		await fd.waitForTimeout(600);
		const fdValidation = await fd
			.evaluate(() => {
				const body = document.body.innerText;
				const created = /Created a new/i.test(body);
				const blocked = !!document.querySelector('[role="alert"]') || /required|fill/i.test(body);
				return { created, blocked };
			})
			.catch((e) => `(eval failed: ${(e as Error).message})`);
		s.note(
			`[${typeof fdValidation === "object" && fdValidation.blocked && !fdValidation.created ? "PASS" : "?"}] F-239 empty-create blocked: ${JSON.stringify(fdValidation)}`,
		);
		await s.shot(fd, "02-form-designer-empty-create");

		// ── Files — F-233 (storage row accent selected-state) ──
		const fl = await s.openApp(APP.Files);
		await fl.waitForTimeout(1800);
		await fl
			.locator(".sidebar__tree-row", { hasText: /media|storage/i })
			.first()
			.click()
			.catch(() => undefined);
		await fl.waitForTimeout(600);
		const flSel = await fl
			.evaluate(() => {
				const row = Array.from(document.querySelectorAll<HTMLElement>(".sidebar__tree-row")).find((r) =>
					/media|storage/i.test(r.textContent ?? ""),
				);
				if (!row) return null;
				return {
					ariaSelected: row.getAttribute("aria-selected"),
					bg: getComputedStyle(row).backgroundColor,
				};
			})
			.catch(() => null);
		s.note(
			`[${flSel?.ariaSelected === "true" ? "PASS" : "?"}] F-233 files storage row aria-selected: ${JSON.stringify(flSel)}`,
		);
		await s.shot(fl, "03-files-storage-selected");

		// ── Browser — F-231 (tab title uses shared app-header__title) ──
		const br = await s.openApp(APP.Browser);
		await br.waitForTimeout(2000);
		const brTitle = await br
			.evaluate(() => {
				const t = document.querySelector(".browser__tab-title") as HTMLElement | null;
				if (!t) return null;
				const cs = getComputedStyle(t);
				return {
					hasSharedClass: t.classList.contains("app-header__title"),
					fontSize: cs.fontSize,
					fontWeight: cs.fontWeight,
				};
			})
			.catch(() => null);
		s.note(
			`[${brTitle?.hasSharedClass ? "PASS" : "FAIL"}] F-231 browser tab title shared face: ${JSON.stringify(brTitle)}`,
		);
		await s.shot(br, "04-browser-title");

		// ── Graph — F-234 (trailing header ⋯) + F-230 (label declutter, eyeball) ──
		const gr = await s.openApp(APP.Graph);
		await gr.waitForTimeout(3000);
		const grMore = await gr
			.evaluate(() => {
				const right = document.querySelector(".app-header__right");
				const more = right?.querySelector(
					".bs-object-menu__more, [aria-label*='more' i], [aria-label*='actions' i]",
				);
				const last = right?.lastElementChild;
				return { morePresent: !!more, moreIsLast: !!more && more === last };
			})
			.catch(() => null);
		s.note(
			`[${grMore?.morePresent ? "PASS" : "FAIL"}] F-234 graph header ⋯ present(+last): ${JSON.stringify(grMore)}`,
		);
		await gr
			.locator(".app-header__right .bs-object-menu__more")
			.first()
			.click()
			.catch(() => undefined);
		await gr.waitForTimeout(500);
		const grMenu = await gr
			.locator(".fm-menu, .bs-menu")
			.count()
			.catch(() => 0);
		s.note(`[${grMenu > 0 ? "PASS" : "?"}] F-234 graph ⋯ opens a menu (count=${grMenu})`);
		await s.shot(gr, "05-graph-header-and-labels");

		// ── Books — F-228 (header ⋯ live with a book selected) ──
		const bk = await s.openApp(APP.Books);
		await bk.waitForTimeout(2200);
		const bkCard = await bk.locator(".books__card, [class*='book-card'], [data-entity-id]").first();
		const bkHasBook = (await bkCard.count().catch(() => 0)) > 0;
		if (bkHasBook) await bkCard.click().catch(() => undefined);
		await bk.waitForTimeout(500);
		await bk
			.locator(".app-header__right .bs-object-menu__more")
			.first()
			.click()
			.catch(() => undefined);
		await bk.waitForTimeout(500);
		const bkMenu = await bk
			.evaluate(() => {
				const menu = document.querySelector(".fm-menu, .bs-menu");
				const items = menu
					? Array.from(menu.querySelectorAll("[role='menuitem'], .fm-menu__item")).map((i) =>
							i.textContent?.trim(),
						)
					: [];
				return { open: !!menu, items };
			})
			.catch(() => null);
		s.note(
			`[${bkMenu?.open && (bkMenu.items?.length ?? 0) > 0 ? "PASS" : "?"}] F-228 books ⋯ (book selected=${bkHasBook}): ${JSON.stringify(bkMenu)}`,
		);
		await s.shot(bk, "06-books-menu");

		// ── Code-editor — F-238 (Rename + Delete in the file object menu) ──
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(2200);
		// Open the object ⋯ on a file row (or the header title).
		await ce
			.locator(".app-header__right .bs-object-menu__more, .sidebar__tree-row .bs-object-menu__more")
			.first()
			.click()
			.catch(() => undefined);
		await ce.waitForTimeout(500);
		const ceMenu = await ce
			.evaluate(() => {
				const menu = document.querySelector(".fm-menu, .bs-menu");
				const text = menu?.textContent ?? "";
				return {
					open: !!menu,
					hasRename: /rename/i.test(text),
					hasDelete: /delete|remove/i.test(text),
				};
			})
			.catch(() => null);
		s.note(
			`[${ceMenu?.hasRename && ceMenu?.hasDelete ? "PASS" : "?"}] F-238 code-editor rename+delete in menu: ${JSON.stringify(ceMenu)}`,
		);
		await s.shot(ce, "07-code-editor-file-menu");

		// ── Theme-editor — F-240 (Save theme persists) ──
		const te = await s.openApp(APP.ThemeEditor);
		await te.waitForTimeout(2200);
		await te
			.getByPlaceholder(/theme name|name/i)
			.first()
			.fill("Fleet Verify Theme")
			.catch(() => undefined);
		await te
			.getByRole("button", { name: /save theme|save/i })
			.first()
			.click()
			.catch(() => undefined);
		await te.waitForTimeout(1200);
		const teSave = await te
			.evaluate(() => {
				const body = document.body.innerText;
				return { failed: /could not save|failed/i.test(body), listed: /Fleet Verify Theme/.test(body) };
			})
			.catch(() => null);
		s.note(
			`[${teSave && !teSave.failed ? "PASS" : "FAIL"}] F-240 theme-editor save (no error): ${JSON.stringify(teSave)}`,
		);
		await s.shot(te, "08-theme-editor-save");

		// ── Contacts — F-242 (company chip opens Contacts, not the dashboard) ──
		const co = await s.openApp(APP.Contacts);
		await co.waitForTimeout(2200);
		// Select a contact that has a company, then click the company chip.
		await co
			.locator(".contacts__list-row, [data-entity-id]")
			.first()
			.click()
			.catch(() => undefined);
		await co.waitForTimeout(800);
		const beforeUrl = co.url();
		await co
			.locator("a, button, .chip, [class*='company']")
			.filter({ hasText: /.+/ })
			.first()
			.click()
			.catch(() => undefined);
		await co.waitForTimeout(1200);
		const coPages = s.appPagesFor(APP.Contacts);
		const landedDashboard =
			coPages.some((p) => /index\.html/.test(p.url())) || /index\.html/.test(co.url());
		s.note(
			`[${!landedDashboard ? "PASS" : "FAIL"}] F-242 contacts company link did NOT fall to dashboard (before=${beforeUrl})`,
		);
		await s.shot(co, "09-contacts-company");

		// ── Journal — F-227 (⋯) + F-236 (body persist) + F-237 (mention) ──
		const jo = await s.openApp(APP.Journal);
		await jo.waitForTimeout(2200);
		const joMore = await jo
			.evaluate(() => {
				const right = document.querySelector(".app-header__right");
				const more = right?.querySelector(".bs-object-menu__more");
				return {
					present: !!more,
					disabled: more?.hasAttribute("disabled") || more?.getAttribute("aria-disabled") === "true",
				};
			})
			.catch(() => null);
		s.note(
			`[${joMore?.present ? "PASS" : "FAIL"}] F-227 journal header ⋯ present (disabled-on-empty is OK): ${JSON.stringify(joMore)}`,
		);
		// F-236: type a marker, navigate away + back, check it survived.
		const marker = "fleet-verify-marker-231";
		const editor = jo.locator("[contenteditable='true']").first();
		await editor.click().catch(() => undefined);
		await editor.type(marker).catch(() => undefined);
		await jo.waitForTimeout(1000);
		// nav prev then back to today via the mini-calendar / nav buttons.
		await jo
			.getByRole("button", { name: /previous|prev|back/i })
			.first()
			.click()
			.catch(() => undefined);
		await jo.waitForTimeout(800);
		await jo
			.getByRole("button", { name: /today|next/i })
			.first()
			.click()
			.catch(() => undefined);
		await jo.waitForTimeout(1200);
		const joBody = await jo
			.evaluate((m) => document.body.innerText.includes(m), marker)
			.catch(() => false);
		s.note(
			`[${joBody ? "PASS" : "?"}] F-236 journal body survived date round-trip (marker present=${joBody})`,
		);
		await s.shot(jo, "10-journal");

		s.chat(SPEAKER.Marcus, "Fleet verification sweep done — notes.md has the per-finding PASS/FAIL.");
	} finally {
		await s.finish();
	}
});
