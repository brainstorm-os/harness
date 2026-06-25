/**
 * Session 228 — DEEP Contacts walkthrough. Exercises the real two-pane Contacts
 * surface end to end: the compose popover ("New contact") with name + company +
 * email + phone, list selection → detail pane fill, in-detail property edits
 * (email / phone / role / birthday / company), people search filtering, and —
 * the PRIORITY — link navigation (a contact's company link routing an `open`
 * intent to its owning app). vCard import/export discovery, contact-list and
 * properties-panel toggles, the header ⋯ "More actions" menu, rename, delete
 * (cleanup), and PERSISTENCE on reopen.
 *
 * The session never aborts: every action is wrapped in try/catch and judged
 * from observable DOM (contact-row count, detail-pane content, saved property,
 * filtered list). Each step records a [PASS]/[FAIL]/[?] line via s.note() and
 * screenshots key states + failures.
 *
 * NOTE the known residue: 7× duplicate "Dana Whitfield" rows. This session also
 * records whether "New contact" does any dedupe when creating a name that
 * already exists.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

// A run-unique tag so this session's test contact never collides with prior
// sessions' residue in the persistent Northbound vault.
const TAG = `Z${Date.now().toString().slice(-6)}`;
const TEST_NAME = `Probe ${TAG}`;
const TEST_COMPANY = `Acme ${TAG}`;
const TEST_EMAIL = `probe.${TAG.toLowerCase()}@example.com`;
const TEST_PHONE = "+1 555 0188";

test("deep contacts walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-contacts");

	// Count contact rows currently rendered in the sidebar.
	const rowCount = async (page: import("@playwright/test").Page): Promise<number> => {
		return page
			.locator(".contacts-row")
			.count()
			.catch(() => 0);
	};
	// Detail-pane visible text (empty string if no pane / not yet filled).
	const detailText = async (page: import("@playwright/test").Page): Promise<string> => {
		return page
			.locator(".contacts-detail")
			.first()
			.innerText()
			.catch(() => "");
	};

	try {
		const page = await s.openApp(APP.Contacts);
		await page.waitForTimeout(2600);

		// ── Baseline: app loaded, header + sidebar present ─────────────────────
		try {
			const headerVisible = await page
				.locator('[data-testid="app-header"]')
				.first()
				.isVisible()
				.catch(() => false);
			const sidebarVisible = await page
				.locator("#contacts-sidebar")
				.first()
				.isVisible()
				.catch(() => false);
			const startRows = await rowCount(page);
			s.note(
				`[${headerVisible && sidebarVisible ? "PASS" : "FAIL"}] app load — header=${headerVisible} sidebar=${sidebarVisible} startingRows=${startRows}`,
			);
			// Record the known "Dana Whitfield" duplicate residue.
			const danaRows = await page
				.locator('.contacts-row__name:has-text("Dana Whitfield")')
				.count()
				.catch(() => 0);
			s.note(`[?] residue — "Dana Whitfield" rows present: ${danaRows}`);
		} catch (e) {
			s.note(`[FAIL] app load — ${(e as Error).message}`);
		}
		await s.shot(page, "01-loaded");

		const startRows = await rowCount(page);

		// ── New contact via the compose popover ────────────────────────────────
		try {
			await page.locator('[data-testid="contacts-new"]').first().click({ timeout: 5000 });
			await page.waitForTimeout(700);
			const composeOpen = await page
				.locator('[data-testid="contacts-compose"]')
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`[${composeOpen ? "PASS" : "FAIL"}] open compose popover — visible=${composeOpen}`);
			await s.shot(page, "02-compose-open");

			await page.locator('[data-testid="contacts-compose-name"]').fill(TEST_NAME);
			await page
				.locator('[data-testid="contacts-compose-company"]')
				.fill(TEST_COMPANY)
				.catch(async () => {
					// company field has no dedicated testId — fall back to label-scoped input.
					await page
						.locator('.contacts-compose__field:has-text("Company") input')
						.fill(TEST_COMPANY)
						.catch(() => undefined);
				});
			await page
				.locator('[data-testid="contacts-compose-email"]')
				.fill(TEST_EMAIL)
				.catch(async () => {
					await page
						.locator('.contacts-compose__field:has-text("Email") input')
						.fill(TEST_EMAIL)
						.catch(() => undefined);
				});
			await page
				.locator('[data-testid="contacts-compose-phone"]')
				.fill(TEST_PHONE)
				.catch(async () => {
					await page
						.locator('.contacts-compose__field:has-text("Phone") input')
						.fill(TEST_PHONE)
						.catch(() => undefined);
				});
			await s.shot(page, "03-compose-filled");
			await page.locator('[data-testid="contacts-compose-create"]').click({ timeout: 5000 });
			await page.waitForTimeout(1400);
		} catch (e) {
			s.note(`[FAIL] fill + submit compose — ${(e as Error).message}`);
		}

		// Assert the new contact landed in the list and is NOT an abandoned empty.
		try {
			const afterRows = await rowCount(page);
			const namedRow = await page
				.locator(`.contacts-row__name:has-text("${TEST_NAME}")`)
				.count()
				.catch(() => 0);
			const unnamed = await page
				.locator('.contacts-row__name:has-text("Unnamed")')
				.count()
				.catch(() => 0);
			s.note(
				`[${namedRow > 0 ? "PASS" : "FAIL"}] new contact in list — "${TEST_NAME}" rows=${namedRow} (rows ${startRows}→${afterRows})`,
			);
			s.note(`[${unnamed === 0 ? "PASS" : "?"}] no abandoned-empty — "Unnamed" rows=${unnamed}`);
		} catch (e) {
			s.note(`[FAIL] assert new contact — ${(e as Error).message}`);
		}
		await s.shot(page, "04-after-create");

		// ── Select the new contact → detail pane fills ─────────────────────────
		try {
			await page
				.locator(`.contacts-row:has(.contacts-row__name:has-text("${TEST_NAME}"))`)
				.first()
				.click({ timeout: 5000 });
			await page.waitForTimeout(900);
			const txt = await detailText(page);
			const hasName =
				txt.includes(TEST_NAME) ||
				(
					await page
						.locator(".contacts-detail__name-input")
						.inputValue()
						.catch(() => "")
				).includes(TAG);
			const hasEmail = txt.includes(TEST_EMAIL);
			const hasCompany = txt.includes(TEST_COMPANY);
			s.note(
				`[${hasName ? "PASS" : "FAIL"}] detail pane fills — name=${hasName} email=${hasEmail} company=${hasCompany}`,
			);
		} catch (e) {
			s.note(`[FAIL] select contact — ${(e as Error).message}`);
		}
		await s.shot(page, "05-detail-pane");

		// ── Properties panel: ensure open, then edit role / birthday ───────────
		try {
			const propsVisible = await page
				.locator(".bs-props--open")
				.first()
				.isVisible()
				.catch(() => false);
			if (!propsVisible) {
				await page
					.locator('[controls="contacts-props"], [aria-label="Show properties"]')
					.first()
					.click({ timeout: 3000 })
					.catch(() => undefined);
				await page.waitForTimeout(500);
			}
			const nowVisible = await page
				.locator(".bs-props--open")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`[${nowVisible ? "PASS" : "FAIL"}] properties panel open — visible=${nowVisible}`);
			// What property rows rendered.
			const keys = await page
				.locator(".bs-props__row")
				.evaluateAll((rows) => rows.map((r) => r.getAttribute("data-property-key")).filter(Boolean))
				.catch(() => [] as (string | null)[]);
			s.note(`[?] property rows present — ${JSON.stringify(keys)}`);
		} catch (e) {
			s.note(`[FAIL] properties panel — ${(e as Error).message}`);
		}
		await s.shot(page, "06-properties-open");

		// Edit the ROLE property (a scalar text cell) and assert it persists in the
		// detail subtitle.
		try {
			const roleRow = page.locator('.bs-props__row[data-property-key="role"]');
			await roleRow
				.locator(".bs-cell-plain, .bs-cell-plain-input, input, [contenteditable]")
				.first()
				.click({ timeout: 3000 });
			await page.waitForTimeout(300);
			const roleInput = roleRow.locator("input, textarea, [contenteditable]").first();
			await roleInput.fill("Head of Probing").catch(async () => {
				await page.keyboard.type("Head of Probing", { delay: 10 });
			});
			await page.keyboard.press("Enter").catch(() => undefined);
			await page.waitForTimeout(900);
			const txt = await detailText(page);
			s.note(
				`[${txt.includes("Head of Probing") ? "PASS" : "?"}] edit role property — subtitle has role=${txt.includes("Head of Probing")}`,
			);
		} catch (e) {
			s.note(`[FAIL] edit role — ${(e as Error).message}`);
		}
		await s.shot(page, "07-role-edited");

		// Edit the EMAIL multiline property — add a second address — and assert it
		// shows in the detail contact-methods list.
		try {
			const emailRow = page.locator('.bs-props__row[data-property-key="email"]');
			await emailRow
				.locator(".bs-cell-plain, .bs-cell-plain-input, input, textarea, [contenteditable]")
				.first()
				.click({ timeout: 3000 });
			await page.waitForTimeout(300);
			const secondEmail = `alt.${TAG.toLowerCase()}@example.com`;
			const field = emailRow.locator("textarea, input, [contenteditable]").first();
			await field.fill(`${TEST_EMAIL}\n${secondEmail}`).catch(async () => {
				await page.keyboard.type(`\n${secondEmail}`, { delay: 8 });
			});
			await page.keyboard.press("Escape").catch(() => undefined);
			await page.waitForTimeout(900);
			const methods = await page
				.locator('.contacts-detail__method-value[href^="mailto:"]')
				.count()
				.catch(() => 0);
			s.note(
				`[${methods >= 1 ? "PASS" : "?"}] edit email property — mailto methods rendered=${methods}`,
			);
		} catch (e) {
			s.note(`[FAIL] edit email — ${(e as Error).message}`);
		}
		await s.shot(page, "08-email-edited");

		// Edit the PHONE property.
		try {
			const phoneRow = page.locator('.bs-props__row[data-property-key="phone"]');
			await phoneRow
				.locator(".bs-cell-plain, .bs-cell-plain-input, input, textarea, [contenteditable]")
				.first()
				.click({ timeout: 3000 });
			await page.waitForTimeout(300);
			const field = phoneRow.locator("textarea, input, [contenteditable]").first();
			await field.fill("+1 555 0199").catch(async () => {
				await page.keyboard.type("+1 555 0199", { delay: 10 });
			});
			await page.keyboard.press("Escape").catch(() => undefined);
			await page.waitForTimeout(900);
			const telMethods = await page
				.locator('.contacts-detail__method-value[href^="tel:"]')
				.count()
				.catch(() => 0);
			s.note(
				`[${telMethods >= 1 ? "PASS" : "?"}] edit phone property — tel methods rendered=${telMethods}`,
			);
		} catch (e) {
			s.note(`[FAIL] edit phone — ${(e as Error).message}`);
		}

		// Edit the BIRTHDAY (Date) property — open the date cell, pick a value.
		try {
			const bdayRow = page.locator('.bs-props__row[data-property-key="birthday"]');
			await bdayRow
				.locator(".bs-cell-plain, .bs-cell-date, input, button, [contenteditable]")
				.first()
				.click({ timeout: 3000 });
			await page.waitForTimeout(500);
			// A native date input or a calendar popover — try a YYYY-MM-DD fill first.
			const dateInput = page.locator('input[type="date"], .bs-cell-date input').first();
			await dateInput.fill("1990-06-15").catch(() => undefined);
			await page.keyboard.press("Enter").catch(() => undefined);
			await page.waitForTimeout(800);
			const txt = await detailText(page);
			const hasBirthday = txt.includes("Birthday");
			s.note(
				`[${hasBirthday ? "PASS" : "?"}] edit birthday property — detail shows birthday line=${hasBirthday}`,
			);
		} catch (e) {
			s.note(`[FAIL] edit birthday — ${(e as Error).message}`);
		}
		await s.shot(page, "09-birthday-edited");

		// ── LINK NAVIGATION (PRIORITY): click the company link, assert an open
		//    intent routes the Company/v1 entity to its owning app. ─────────────
		try {
			const companyLink = page.locator(".contacts-detail__company-link").first();
			const linkVisible = await companyLink.isVisible().catch(() => false);
			s.note(`[?] company link present — visible=${linkVisible} (company="${TEST_COMPANY}")`);
			if (linkVisible) {
				const before = s.app.windows().length;
				await companyLink.click({ timeout: 4000 });
				await page.waitForTimeout(2500);
				const after = s.app.windows().length;
				// An open intent either spawns/focuses a window for the Company's
				// owning app, or (if no opener is registered) is a no-op we still log.
				const opened = after > before;
				s.note(
					`[${opened ? "PASS" : "?"}] company link → open intent — windows ${before}→${after} (opened=${opened})`,
				);
				// If a new window appeared, screenshot whatever surfaced.
				const target = s.app.windows().find((p) => p.url() !== page.url());
				if (target) {
					await target.waitForTimeout(800).catch(() => undefined);
					const targetUrl = target.url();
					s.note(`[?] link navigation target url — ${targetUrl}`);
					await s.shot(target, "10-company-opened").catch(() => undefined);
				}
			} else {
				s.note("[FAIL] company link — not rendered; company ref may not have resolved to a Company/v1");
			}
		} catch (e) {
			s.note(`[FAIL] company link navigation — ${(e as Error).message}`);
		}
		await s.shot(page, "11-after-link-nav");

		// ── Search filters the people list ─────────────────────────────────────
		try {
			const search = page.locator(".contacts-list__search-input").first();
			const beforeFilter = await rowCount(page);
			await search.fill(TAG);
			await page.waitForTimeout(700);
			const afterFilter = await rowCount(page);
			const hasOurs = await page
				.locator(`.contacts-row__name:has-text("${TEST_NAME}")`)
				.count()
				.catch(() => 0);
			s.note(
				`[${afterFilter <= beforeFilter && hasOurs > 0 ? "PASS" : "FAIL"}] search filters — rows ${beforeFilter}→${afterFilter}, our contact still shown=${hasOurs}`,
			);
			await s.shot(page, "12-search-filtered");
			// A query that matches nothing → "no results" copy.
			await search.fill("zzz-no-such-person-zzz");
			await page.waitForTimeout(600);
			const noResults = await page
				.locator(".contacts-list__no-results")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`[${noResults ? "PASS" : "?"}] search no-results state — shown=${noResults}`);
			await search.fill("");
			await page.waitForTimeout(500);
		} catch (e) {
			s.note(`[FAIL] search — ${(e as Error).message}`);
		}

		// Re-select our contact (search cleared) before the next steps.
		await page
			.locator(`.contacts-row:has(.contacts-row__name:has-text("${TEST_NAME}"))`)
			.first()
			.click({ timeout: 4000 })
			.catch(() => undefined);
		await page.waitForTimeout(600);

		// ── Contact-list hide / show toggle ────────────────────────────────────
		try {
			const sidebar = page.locator(".contacts").first();
			const before = await sidebar.getAttribute("data-nav-open").catch(() => null);
			await page
				.locator('[controls="contacts-sidebar"], [aria-label="Hide contact list"]')
				.first()
				.click({ timeout: 3000 });
			await page.waitForTimeout(500);
			const afterHide = await sidebar.getAttribute("data-nav-open").catch(() => null);
			await page
				.locator('[controls="contacts-sidebar"], [aria-label="Show contact list"]')
				.first()
				.click({ timeout: 3000 });
			await page.waitForTimeout(500);
			const afterShow = await sidebar.getAttribute("data-nav-open").catch(() => null);
			s.note(
				`[${before !== afterHide && afterHide === "false" && afterShow === "true" ? "PASS" : "?"}] sidebar hide/show — ${before}→${afterHide}→${afterShow}`,
			);
		} catch (e) {
			s.note(`[FAIL] sidebar toggle — ${(e as Error).message}`);
		}

		// ── Properties panel toggle (hide then show) ───────────────────────────
		try {
			await page.locator('[controls="contacts-props"]').first().click({ timeout: 3000 });
			await page.waitForTimeout(400);
			const hidden = await page
				.locator(".bs-props--open")
				.first()
				.isVisible()
				.catch(() => false);
			await page.locator('[controls="contacts-props"]').first().click({ timeout: 3000 });
			await page.waitForTimeout(400);
			const shown = await page
				.locator(".bs-props--open")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(
				`[${!hidden && shown ? "PASS" : "?"}] properties toggle — hidden=${hidden} thenShown=${shown}`,
			);
		} catch (e) {
			s.note(`[FAIL] properties toggle — ${(e as Error).message}`);
		}
		await s.shot(page, "13-after-toggles");

		// ── Header ⋯ "More actions" menu — open + inspect items (vCard etc.) ───
		try {
			const more = page
				.locator('.bs-object-menu__more, [data-testid="contacts-more"], [aria-label="More actions"]')
				.first();
			await more.click({ timeout: 4000 });
			await page.waitForTimeout(600);
			const menuVisible = await page
				.locator(".fm-menu, [role='menu']")
				.first()
				.isVisible()
				.catch(() => false);
			const items = await page
				.locator(".fm-menu [role='menuitem'], [role='menu'] [role='menuitem']")
				.allInnerTexts()
				.catch(() => [] as string[]);
			s.note(`[${menuVisible ? "PASS" : "FAIL"}] header ⋯ menu opens — visible=${menuVisible}`);
			s.note(`[?] ⋯ menu items — ${JSON.stringify(items)}`);
			await s.shot(page, "14-more-menu");
			// vCard import / export discovery.
			const hasImport = items.some((i) => /import/i.test(i));
			const hasExport = items.some((i) => /export/i.test(i));
			s.note(
				`[${hasImport || hasExport ? "PASS" : "?"}] vCard actions present — import=${hasImport} export=${hasExport}`,
			);
			await page.keyboard.press("Escape").catch(() => undefined);
			await page.waitForTimeout(400);
		} catch (e) {
			s.note(`[FAIL] header ⋯ menu — ${(e as Error).message}`);
		}

		// ── Rename the test contact (detail name input) ────────────────────────
		const RENAMED = `${TEST_NAME} (renamed)`;
		try {
			const nameInput = page.locator(".contacts-detail__name-input").first();
			await nameInput.click({ timeout: 3000 });
			await nameInput.fill(RENAMED);
			await page.keyboard.press("Enter");
			await page.waitForTimeout(1000);
			const renamedInList = await page
				.locator(`.contacts-row__name:has-text("${RENAMED}")`)
				.count()
				.catch(() => 0);
			s.note(
				`[${renamedInList > 0 ? "PASS" : "?"}] rename contact — renamed row in list=${renamedInList}`,
			);
		} catch (e) {
			s.note(`[FAIL] rename — ${(e as Error).message}`);
		}
		await s.shot(page, "15-renamed");

		// ── Persistence: reopen the app, assert the contact survived ───────────
		// (Reopen by relaunching the app window in the same vault session.)
		try {
			const before = await page
				.locator(`.contacts-row__name:has-text("${TAG}")`)
				.count()
				.catch(() => 0);
			const reopened = await s.openApp(APP.Contacts).catch(() => page);
			await reopened.waitForTimeout(2500);
			const survived = await reopened
				.locator(`.contacts-row__name:has-text("${TAG}")`)
				.count()
				.catch(() => 0);
			s.note(
				`[${survived > 0 ? "PASS" : "FAIL"}] persistence on reopen — tagged rows before=${before} after=${survived}`,
			);
			await s.shot(reopened, "16-reopened");
		} catch (e) {
			s.note(`[FAIL] persistence reopen — ${(e as Error).message}`);
		}

		// ── Cleanup: delete the test contact via the ⋯ menu → confirm ──────────
		try {
			const live = s.appPagesFor(APP.Contacts);
			const work = live[live.length - 1] ?? page;
			// Select the (renamed) test contact.
			await work
				.locator(`.contacts-row:has(.contacts-row__name:has-text("${TAG}"))`)
				.first()
				.click({ timeout: 4000 });
			await work.waitForTimeout(700);
			// Open the header object ⋯ menu and pick Delete.
			await work
				.locator('.bs-object-menu__more, [aria-label="More actions"]')
				.first()
				.click({ timeout: 4000 });
			await work.waitForTimeout(500);
			await work
				.locator(".fm-menu [role='menuitem'], [role='menu'] [role='menuitem']")
				.filter({ hasText: /delete/i })
				.first()
				.click({ timeout: 4000 });
			await work.waitForTimeout(600);
			// Confirm in the fail-safe dialog (the danger button).
			await work
				.locator(".contacts-confirm__actions .bs-btn--danger")
				.first()
				.click({ timeout: 4000 });
			await work.waitForTimeout(1200);
			const remaining = await work
				.locator(`.contacts-row__name:has-text("${TAG}")`)
				.count()
				.catch(() => 0);
			s.note(
				`[${remaining === 0 ? "PASS" : "FAIL"}] delete contact (cleanup) — tagged rows remaining=${remaining}`,
			);
			await s.shot(work, "17-after-delete");
		} catch (e) {
			s.note(`[FAIL] delete contact — ${(e as Error).message}`);
		}

		s.note("Session 228 deep-contacts walkthrough complete.");
	} finally {
		await s.finish();
	}
});
