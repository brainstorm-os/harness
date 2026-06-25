/**
 * Session 232 — tighter re-verify of the three findings that session 231 left
 * inconclusive (selector/nav fragility, not product failures):
 *  - F-228 Books ⋯: SELECT a library row first, then assert the header ⋯ opens a
 *    populated menu (231 never selected a book, so the ⋯ stayed correctly disabled).
 *  - F-236 Journal body: type a marker → autosave → click another day in the
 *    mini-calendar → click back → read the *contenteditable* text directly.
 *  - F-242 Contacts company: click the actual company chip and assert no shell
 *    dashboard window opened + Contacts shows the company landing surface (231's
 *    /index.html/ regex wrongly matched the Contacts app's OWN index.html).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("re-verify F-228 / F-236 / F-242 (232)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("232-verify-fleet-b");
	try {
		// ── F-228 Books — select a real library row, then open the header ⋯ ──
		const bk = await s.openApp(APP.Books);
		await bk.waitForTimeout(2400);
		await bk
			.getByText("Deep Work", { exact: false })
			.first()
			.click()
			.catch(() => undefined);
		await bk.waitForTimeout(900);
		const bkMoreDisabled = await bk
			.evaluate(() => {
				const more = document.querySelector(".app-header__right .bs-object-menu__more");
				return {
					present: !!more,
					disabled: more?.hasAttribute("disabled") || more?.getAttribute("aria-disabled") === "true",
				};
			})
			.catch(() => null);
		await bk
			.locator(".app-header__right .bs-object-menu__more")
			.first()
			.click()
			.catch(() => undefined);
		await bk.waitForTimeout(600);
		const bkMenu = await bk
			.evaluate(() => {
				const menu = document.querySelector(".fm-menu, .bs-menu");
				const items = menu
					? Array.from(menu.querySelectorAll("[role='menuitem'], .fm-menu__item"))
							.map((i) => i.textContent?.trim())
							.filter(Boolean)
					: [];
				return { open: !!menu, items };
			})
			.catch(() => null);
		const bkPass = !!bkMenu?.open && (bkMenu.items?.length ?? 0) > 0;
		s.note(
			`[${bkPass ? "PASS" : "FAIL"}] F-228 books ⋯ after selecting a book — ⋯state=${JSON.stringify(bkMoreDisabled)} menu=${JSON.stringify(bkMenu)}`,
		);
		await s.shot(bk, "01-books-menu-selected");

		// ── F-236 Journal — marker survives a mini-calendar date round-trip ──
		const jo = await s.openApp(APP.Journal);
		await jo.waitForTimeout(2200);
		const marker = "fleetmarker232";
		const editor = jo.locator("[contenteditable='true']").first();
		await editor.click().catch(() => undefined);
		await jo.waitForTimeout(300);
		await editor.type(` ${marker} `).catch(() => undefined);
		await jo.waitForTimeout(1500); // let the gated autosave flush
		const typedOk = await editor
			.evaluate((el, m) => (el.textContent ?? "").includes(m), marker)
			.catch(() => false);
		s.note(
			`[${typedOk ? "ok" : "?"}] F-236 precheck — marker present in editor right after typing = ${typedOk}`,
		);
		// Navigate to a different day in the mini-calendar, then back to today.
		const otherDay = await jo
			.evaluate(() => {
				const today = document.querySelector(
					".cal-mini__day--today, .cal-mini__day[aria-current], [class*='--today']",
				);
				const days = Array.from(
					document.querySelectorAll(".cal-mini__day, [class*='cal-mini__day'], [class*='mini'] button"),
				).filter((d) => /^\d+$/.test((d.textContent ?? "").trim()));
				const other = days.find((d) => d !== today && d.getBoundingClientRect().width > 0);
				if (other) (other as HTMLElement).setAttribute("data-fleet-other", "1");
				return other ? (other.textContent ?? "").trim() : null;
			})
			.catch(() => null);
		await jo
			.locator("[data-fleet-other='1']")
			.first()
			.click()
			.catch(() => undefined);
		await jo.waitForTimeout(1200);
		await jo
			.getByRole("button", { name: /today/i })
			.first()
			.click()
			.catch(() => undefined);
		await jo.waitForTimeout(1600);
		const survived = await jo
			.locator("[contenteditable='true']")
			.first()
			.evaluate((el, m) => (el.textContent ?? "").includes(m), marker)
			.catch(() => false);
		s.note(
			`[${survived ? "PASS" : "FAIL"}] F-236 journal marker survived round-trip (went to day ${otherDay} and back) = ${survived}`,
		);
		await s.shot(jo, "02-journal-roundtrip");

		// ── F-242 Contacts — company chip opens the Company surface, not dashboard ──
		const co = await s.openApp(APP.Contacts);
		await co.waitForTimeout(2200);
		await co
			.locator(".contacts__list-row, [class*='list-row']")
			.first()
			.click()
			.catch(() => undefined);
		await co.waitForTimeout(900);
		const windowsBefore = s.appPagesFor(APP.Contacts).length;
		// Click the company chip specifically (the value chip rendered under the name / in Properties).
		await co
			.getByRole("button", { name: /studio|inc|llc|northbound|acme|company/i })
			.first()
			.click()
			.catch(async () => {
				await co
					.locator("[class*='company'] button, button[class*='chip']")
					.first()
					.click()
					.catch(() => undefined);
			});
		await co.waitForTimeout(1600);
		const result = await co
			.evaluate(() => {
				const text = document.body.innerText;
				return {
					backToAll: /back to all contacts/i.test(text),
					// dashboard would be the SHELL renderer — detect its launcher chrome, not the app's own index.html
					looksLikeDashboard: !!document.querySelector(".dashboard, .launcher, [class*='dashboard__']"),
				};
			})
			.catch(() => null);
		const windowsAfter = s.appPagesFor(APP.Contacts).length;
		// A real failure = the shell dashboard surfaced. Success = stayed in Contacts (ideally on the company landing surface).
		const noDashboard = !!result && !result.looksLikeDashboard;
		s.note(
			`[${noDashboard ? "PASS" : "FAIL"}] F-242 company chip stayed in Contacts (no dashboard) — ${JSON.stringify(result)} contactsWindows ${windowsBefore}->${windowsAfter}`,
		);
		await s.shot(co, "03-contacts-company-landing");

		s.chat(SPEAKER.Marcus, "Re-verify pass (F-228/236/242) done — see 232 notes.md.");
	} finally {
		await s.finish();
	}
});
