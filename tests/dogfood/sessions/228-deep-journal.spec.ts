/**
 * Session 228 — Deep Journal walkthrough. Exhaustively exercises the Journal
 * app to surface broken features for the friction log: date navigation
 * (prev / next / today / mini-calendar cell clicks), the three templates,
 * writing + persistence, INTER-ENTRY LINKS (the user reports "linking an entry
 * and clicking it does nothing" — we create a mention via the "Link an entry"
 * picker and click the rendered chip, asserting navigation), periodic rollups,
 * the daily-reminder toggle, Export, the header ⋯ "More actions" menu, the
 * properties + calendar panel toggles, the change-icon button, and reopen
 * persistence.
 *
 * Every interaction is wrapped in try/catch and self-assessed from OBSERVABLE
 * state (URL / element presence / text or count deltas / menu visibility) into
 * a `[PASS] / [FAIL] / [?]` notes line — a thrown click is never treated as the
 * verdict. One failure never aborts the walk.
 *
 * Journal is an imperative-DOM app (`apps/journal/src/app.ts`); selectors below
 * are read from that source + the shared SDK widgets it composes
 * (`@brainstorm/sdk/calendar` mini-calendar = `.bs-cal-*`, `@brainstorm/sdk/
 * date-pager` = `.bs-date-pager__*`, fancy-menus = `.fm-menu`).
 */

import { type Page, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** A self-assessed verdict line. Always recorded — never throws. */
type Verdict = "PASS" | "FAIL" | "?";

test("deep journal walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-journal");

	/** Record a self-assessed verdict line in the notes. */
	const verdict = (kind: Verdict, action: string, observed: string): void => {
		s.note(`[${kind}] ${action} — ${observed}`);
	};

	/** Run `fn`, swallow any throw, and let the caller judge from state. The
	 *  returned boolean only says whether the interaction itself threw — the
	 *  PASS/FAIL verdict is always derived from observed state, not this. */
	const attempt = async (fn: () => Promise<void>): Promise<string | null> => {
		try {
			await fn();
			return null;
		} catch (error) {
			return (error as Error).message;
		}
	};

	/** The journal app's focused-day title text (`.app-header__title`). The
	 *  primary "did navigation happen" signal — the focused date IS the
	 *  location, and the header title mirrors it. */
	const headerTitle = async (page: Page): Promise<string> => {
		return (
			(await page
				.locator(".app-header__title")
				.first()
				.innerText()
				.catch(() => "")) ?? ""
		).trim();
	};

	/** Whole-app text snapshot — used for coarse content-change assertions. */
	const bodyText = async (page: Page): Promise<string> => {
		return (await page
			.locator(".journal__entry-body")
			.first()
			.innerText()
			.catch(() => "")) as string;
	};

	const isMenuVisible = async (page: Page): Promise<boolean> => {
		return page
			.locator(".fm-menu, [role='menu'], [role='listbox']")
			.first()
			.isVisible()
			.catch(() => false);
	};

	const dismissMenu = async (page: Page): Promise<void> => {
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(200);
	};

	try {
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(2800);
		await s.shot(journal, "00-opened");

		const openTitle = await headerTitle(journal);
		verdict(
			openTitle.length > 0 ? "PASS" : "FAIL",
			"Open Journal (lands on today)",
			openTitle.length > 0 ? `header title is "${openTitle}"` : "header title is empty",
		);

		// ── Date navigation: pager prev / next / today ──────────────────────
		// The mini-calendar lives in the left nav (`.journal__mini`); ensure the
		// nav panel is open first (it defaults open).
		const navOpenAttr = await journal
			.locator("#journal-root, [data-nav-open]")
			.first()
			.getAttribute("data-nav-open")
			.catch(() => null);
		s.note(`(nav panel data-nav-open=${navOpenAttr})`);
		if (navOpenAttr === "false") {
			await journal
				.locator('[aria-label="Show calendar"]')
				.first()
				.click()
				.catch(() => undefined);
			await journal.waitForTimeout(400);
		}

		// Previous day.
		{
			const before = await headerTitle(journal);
			const err = await attempt(async () => {
				await journal.locator(".journal__mini .bs-date-pager__arrow--prev").first().click();
				await journal.waitForTimeout(600);
			});
			// The pager steps the *month* view; the focused DAY changes via the
			// Prev chord. Use the chord (declared keyboard path) for the day step,
			// then assert the title moved.
			await journal.keyboard.press("ArrowLeft").catch(() => undefined);
			await journal.waitForTimeout(500);
			const after = await headerTitle(journal);
			verdict(
				after !== before ? "PASS" : "?",
				"Previous-day navigation (pager prev + ←)",
				after !== before
					? `title "${before}" → "${after}"`
					: `title unchanged ("${after}")${err ? ` [err: ${err}]` : ""}`,
			);
			await s.shot(journal, "01-prev-day");
		}

		// Today button (returns to today).
		{
			const before = await headerTitle(journal);
			const err = await attempt(async () => {
				await journal.locator(".journal__mini .bs-date-pager__today").first().click();
				await journal.waitForTimeout(600);
			});
			// Also fire the Today chord as the canonical "go to today" path.
			await journal.keyboard.press("t").catch(() => undefined);
			await journal.waitForTimeout(500);
			const after = await headerTitle(journal);
			verdict(
				after === openTitle ? "PASS" : "?",
				"Today button (return to today)",
				after === openTitle
					? `title back to "${after}"`
					: `expected "${openTitle}" but title is "${after}" (was "${before}")${
							err ? ` [err: ${err}]` : ""
						}`,
			);
			await s.shot(journal, "02-today");
		}

		// Next month via pager, then click a date cell.
		{
			const beforeMonth = await journal
				.locator(".journal__mini .bs-cal-mini__title")
				.first()
				.innerText()
				.catch(() => "");
			const err = await attempt(async () => {
				await journal.locator(".journal__mini .bs-date-pager__arrow--next").first().click();
				await journal.waitForTimeout(600);
			});
			const afterMonth = await journal
				.locator(".journal__mini .bs-cal-mini__title")
				.first()
				.innerText()
				.catch(() => "");
			verdict(
				afterMonth !== beforeMonth ? "PASS" : "FAIL",
				"Mini-calendar next-month pager",
				afterMonth !== beforeMonth
					? `month label "${beforeMonth}" → "${afterMonth}"`
					: `month label unchanged ("${afterMonth}")${err ? ` [err: ${err}]` : ""}`,
			);
			await s.shot(journal, "03-next-month");
		}

		// Click a specific date cell — pick the 15th of the visible month.
		{
			const before = await headerTitle(journal);
			let clickedKey: string | null = null;
			const err = await attempt(async () => {
				const cells = journal.locator(
					".journal__mini .bs-cal-month__cell:not(.bs-cal-month__cell--other-month)",
				);
				const count = await cells.count();
				// Pick a middle cell so it's never a leading/trailing other-month day.
				const target = cells.nth(Math.min(14, Math.max(0, Math.floor(count / 2))));
				clickedKey = await target.getAttribute("data-date-key");
				// Click the day-number button inside the cell (it's the actionable el).
				const btn = target.locator("button").first();
				if ((await btn.count()) > 0) await btn.click();
				else await target.click();
				await journal.waitForTimeout(700);
			});
			const after = await headerTitle(journal);
			verdict(
				after !== before ? "PASS" : "FAIL",
				`Click mini-calendar date cell (${clickedKey ?? "?"})`,
				after !== before
					? `focused day title "${before}" → "${after}"`
					: `title unchanged ("${after}")${err ? ` [err: ${err}]` : ""}`,
			);
			await s.shot(journal, "04-cell-click");
		}

		// Return to today for the writing flow.
		await journal
			.locator(".journal__mini .bs-date-pager__today")
			.first()
			.click()
			.catch(() => undefined);
		await journal.keyboard.press("t").catch(() => undefined);
		await journal.waitForTimeout(700);

		// ── Templates: Daily review / Gratitude / Free write ────────────────
		// Templates only appear on an EMPTY today (the implicit-create body). If
		// today already has content from a prior session, the picker is absent —
		// note that and skip. We test whichever chips are present.
		{
			const chips = journal.locator(".journal__template-chip");
			const chipCount = await chips.count().catch(() => 0);
			s.note(`(template chips present: ${chipCount})`);
			if (chipCount === 0) {
				verdict("?", "Templates", "no template chips (today already has an entry) — skipped");
			} else {
				// Click the first template chip and assert its heading text lands
				// in the body.
				const before = await bodyText(journal);
				const firstLabel = (
					await chips
						.first()
						.innerText()
						.catch(() => "")
				).trim();
				const err = await attempt(async () => {
					await chips.first().click();
					await journal.waitForTimeout(1200);
				});
				const after = await bodyText(journal);
				// Daily-review seeds "What went well today?"; Gratitude "Grateful
				// for"; Free write a prompt. Any non-trivial growth = inserted.
				const grew = after.trim().length > before.trim().length + 3;
				verdict(
					grew ? "PASS" : "FAIL",
					`Template "${firstLabel}" inserts content`,
					grew
						? `body grew ${before.length} → ${after.length} chars`
						: `body unchanged (${after.length} chars)${err ? ` [err: ${err}]` : ""}`,
				);
				await s.shot(journal, "05-template-inserted");
			}
		}

		// ── Write an entry via the dev hook + persistence within session ────
		// The Journal dev hook (`window.__brainstormJournalDev`) appends a
		// paragraph to the live editor without synthetic keystrokes (which
		// corrupt the Yjs-bound editor in headless Electron).
		const marker = `Deep journal probe ${Date.now()}`;
		{
			// If there's no entry yet (no template was clicked), seed one by typing
			// into the placeholder so the editor mounts + the dev hook captures it.
			const placeholder = journal.locator(".journal__write-placeholder");
			if ((await placeholder.count().catch(() => 0)) > 0) {
				await placeholder
					.first()
					.click()
					.catch(() => undefined);
				await journal.keyboard.type("Today.", { delay: 12 }).catch(() => undefined);
				await journal.waitForTimeout(1500);
			}
			const appendResult = await journal
				.evaluate(
					(text) =>
						(
							window as unknown as {
								__brainstormJournalDev?: { appendParagraph: (t: string) => Promise<void> };
							}
						).__brainstormJournalDev
							?.appendParagraph(text)
							.then(() => "ok")
							.catch((e: Error) => e.message) ?? "no-hook",
					marker,
				)
				.catch((e) => (e as Error).message);
			s.note(`(__brainstormJournalDev.appendParagraph → ${JSON.stringify(appendResult)})`);
			await journal.waitForTimeout(1200);
			const body = await bodyText(journal);
			verdict(
				body.includes(marker) ? "PASS" : "FAIL",
				"Write entry (append paragraph)",
				body.includes(marker) ? "marker text present in body" : "marker text NOT found in body",
			);
			await s.shot(journal, "06-written");

			// Word-count meta should be non-empty / reflect the text.
			const wc = (
				await journal
					.locator(".journal__entry-meta")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			verdict(
				/\d/.test(wc) ? "PASS" : "?",
				"Word-count meta updates",
				wc.length > 0 ? `meta reads "${wc}"` : "no word-count meta visible",
			);
		}

		const entryId = await journal
			.evaluate(
				() =>
					(
						window as unknown as { __brainstormJournalDev?: { currentEntryId: () => string | null } }
					).__brainstormJournalDev?.currentEntryId() ?? null,
			)
			.catch(() => null);
		s.note(`(today entry id: ${entryId})`);

		// ── LINKS (PRIORITY) — create a link to another entry, then click it ─
		// First make sure a SECOND entry exists to link to (navigate to
		// yesterday and seed it), then back to today and use "Link an entry".
		{
			// Seed yesterday so there is a link target.
			await journal.keyboard.press("ArrowLeft").catch(() => undefined);
			await journal.waitForTimeout(600);
			const yphn = journal.locator(".journal__write-placeholder");
			if ((await yphn.count().catch(() => 0)) > 0) {
				await yphn
					.first()
					.click()
					.catch(() => undefined);
				await journal.keyboard.type("Yesterday's entry.", { delay: 12 }).catch(() => undefined);
				await journal.waitForTimeout(1600);
			}
			const yesterdayTitle = await headerTitle(journal);
			s.note(`(link target — yesterday entry title: "${yesterdayTitle}")`);

			// Back to today.
			await journal.keyboard.press("t").catch(() => undefined);
			await journal.waitForTimeout(700);
			const todayTitle = await headerTitle(journal);

			// Open the "Link an entry" picker (`.journal__link-btn`).
			const linkBtn = journal.locator(".journal__link-btn").first();
			const haveLinkBtn = (await linkBtn.count().catch(() => 0)) > 0;
			verdict(
				haveLinkBtn ? "PASS" : "FAIL",
				'"Link an entry" button present',
				haveLinkBtn ? "button rendered in entry meta" : "no .journal__link-btn (no entry today?)",
			);

			if (haveLinkBtn) {
				const openErr = await attempt(async () => {
					await linkBtn.click();
					await journal.waitForTimeout(600);
				});
				const pickerVisible = await isMenuVisible(journal);
				verdict(
					pickerVisible ? "PASS" : "FAIL",
					"Link picker opens",
					pickerVisible
						? "anchored fancy-menu visible"
						: `no menu visible${openErr ? ` [err: ${openErr}]` : ""}`,
				);
				await s.shot(journal, "07-link-picker");

				if (pickerVisible) {
					// Pick the first candidate (newest other entry = yesterday).
					const item = journal.locator(".fm-menu .fm-row, .fm-menu [role='menuitem']").first();
					const itemLabel = (await item.innerText().catch(() => "")).trim();
					const pickErr = await attempt(async () => {
						await item.click();
						await journal.waitForTimeout(900);
					});
					await dismissMenu(journal);
					// A mention chip should now be in the body.
					const chip = journal.locator(
						".journal__entry-body .notes__mention-chip, .journal__entry-body [data-entity-id]",
					);
					const chipCount = await chip.count().catch(() => 0);
					verdict(
						chipCount > 0 ? "PASS" : "FAIL",
						`Insert link to "${itemLabel}"`,
						chipCount > 0
							? `${chipCount} mention chip(s) in body`
							: `no mention chip inserted${pickErr ? ` [err: ${pickErr}]` : ""}`,
					);
					await s.shot(journal, "08-link-inserted");

					// ── THE REPORTED BUG: click the rendered link → navigation? ──
					if (chipCount > 0) {
						const beforeClickTitle = await headerTitle(journal);
						const beforeUrl = journal.url();
						const clickErr = await attempt(async () => {
							await chip.first().click();
							await journal.waitForTimeout(1400);
						});
						const afterClickTitle = await headerTitle(journal);
						const afterUrl = journal.url();
						// Navigation evidence: the focused-day title changed (link
						// target is another journal day) OR a new app page opened /
						// URL changed. The user reported "clicking it does nothing".
						const titleChanged = afterClickTitle !== beforeClickTitle;
						const urlChanged = afterUrl !== beforeUrl;
						const navigated = titleChanged || urlChanged;
						verdict(
							navigated ? "PASS" : "FAIL",
							"Click rendered link → navigates",
							navigated
								? `title "${beforeClickTitle}" → "${afterClickTitle}"${urlChanged ? " (url changed)" : ""}`
								: `NOTHING HAPPENED — title stayed "${afterClickTitle}", url unchanged${
										clickErr ? ` [err: ${clickErr}]` : ""
									}`,
						);
						await s.shot(journal, "09-after-link-click");

						// Return to today for the rest of the walk.
						await journal.keyboard.press("t").catch(() => undefined);
						await journal.waitForTimeout(600);
					}
				}
			}
			s.note(`(today title before/after link work: "${todayTitle}")`);
		}

		// ── Outgoing-links / backlinks panels render ────────────────────────
		{
			const outgoing = await journal
				.locator(".journal__backlinks")
				.count()
				.catch(() => 0);
			verdict(
				outgoing > 0 ? "PASS" : "?",
				"Links panel (outgoing/backlinks) renders",
				outgoing > 0 ? `${outgoing} links panel(s) present` : "no links panels (snapshot may lag)",
			);
		}

		// ── Periodic rollups: This week / Last week / This month / Last month ─
		{
			const rollupBtns = journal.locator(".journal__rollup-btn");
			const n = await rollupBtns.count().catch(() => 0);
			s.note(`(rollup buttons present: ${n})`);
			verdict(
				n >= 4 ? "PASS" : n > 0 ? "?" : "FAIL",
				"Rollups section present",
				n > 0 ? `${n} rollup button(s)` : "no rollup buttons (shell mode required)",
			);
			for (let i = 0; i < n; i++) {
				const label = (
					await rollupBtns
						.nth(i)
						.innerText()
						.catch(() => "")
				).trim();
				const beforeTitle = await headerTitle(journal);
				const err = await attempt(async () => {
					await rollupBtns.nth(i).click();
					await journal.waitForTimeout(900);
				});
				const afterTitle = await headerTitle(journal);
				// Opening a rollup swaps the header title to the period label AND
				// marks the button active (`data-active="true"`).
				const active = await rollupBtns
					.nth(i)
					.getAttribute("data-active")
					.catch(() => null);
				const opened = afterTitle !== beforeTitle || active === "true";
				verdict(
					opened ? "PASS" : "FAIL",
					`Rollup "${label}" opens`,
					opened
						? `header → "${afterTitle}"${active === "true" ? " (button active)" : ""}`
						: `no change (title "${afterTitle}", active=${active})${err ? ` [err: ${err}]` : ""}`,
				);
				await s.shot(journal, `10-rollup-${i}`);
			}
			// Back to today after rollups (rollup view replaces the day surface).
			await journal.keyboard.press("t").catch(() => undefined);
			await journal.waitForTimeout(700);
		}

		// ── Daily reminder toggle + time field ──────────────────────────────
		{
			const toggle = journal.locator(".journal__reminder-toggle input, .journal__reminder-toggle");
			const haveToggle = (await toggle.count().catch(() => 0)) > 0;
			const timeBefore = await journal
				.locator(".journal__reminder-time")
				.first()
				.isHidden()
				.catch(() => true);
			const err = await attempt(async () => {
				await journal.locator(".journal__reminder-toggle").first().click();
				await journal.waitForTimeout(500);
			});
			const timeAfter = await journal
				.locator(".journal__reminder-time")
				.first()
				.isHidden()
				.catch(() => true);
			// Enabling the toggle reveals the time input (it's `hidden` when off).
			const revealed = timeBefore && !timeAfter;
			verdict(
				revealed ? "PASS" : haveToggle ? "?" : "FAIL",
				"Daily-reminder toggle reveals time field",
				haveToggle
					? `time input hidden ${timeBefore} → ${timeAfter}${err ? ` [err: ${err}]` : ""}`
					: "no reminder toggle present",
			);
			await s.shot(journal, "11-reminder");
		}

		// ── Export button → anchored menu of formats ────────────────────────
		{
			const exportBtn = journal.locator(".journal__overview-export").first();
			const haveExport = (await exportBtn.count().catch(() => 0)) > 0;
			if (!haveExport) {
				verdict("FAIL", "Export button present", "no .journal__overview-export (files host unbound?)");
			} else {
				const err = await attempt(async () => {
					await exportBtn.click();
					await journal.waitForTimeout(600);
				});
				const menuVisible = await isMenuVisible(journal);
				const items = await journal
					.locator(".fm-menu .fm-row, .fm-menu [role='menuitem']")
					.count()
					.catch(() => 0);
				verdict(
					menuVisible ? "PASS" : "FAIL",
					"Export opens format menu",
					menuVisible
						? `menu visible with ${items} item(s)`
						: `no menu visible${err ? ` [err: ${err}]` : ""}`,
				);
				await s.shot(journal, "12-export-menu");
				await dismissMenu(journal);
			}
		}

		// ── Header ⋯ "More actions" menu (SUSPECTED BROKEN) ─────────────────
		{
			const more = journal.locator(".app-header__right .bs-object-menu__more").first();
			const haveMore = (await more.count().catch(() => 0)) > 0;
			const disabled = await more.getAttribute("disabled").catch(() => null);
			const ariaDisabled = await more.getAttribute("aria-disabled").catch(() => null);
			s.note(`(header ⋯ present=${haveMore} disabled=${disabled} aria-disabled=${ariaDisabled})`);
			const err = await attempt(async () => {
				await more.click({ force: true });
				await journal.waitForTimeout(600);
			});
			const menuVisible = await isMenuVisible(journal);
			const expanded = await more.getAttribute("aria-expanded").catch(() => null);
			verdict(
				menuVisible ? "PASS" : "FAIL",
				'Header ⋯ "More actions" opens a menu',
				menuVisible
					? `menu visible (aria-expanded=${expanded})`
					: `NO MENU — confirms suspected breakage (aria-expanded=${expanded}, disabled=${disabled})${
							err ? ` [err: ${err}]` : ""
						}`,
			);
			await s.shot(journal, "13-header-more");
			await dismissMenu(journal);
		}

		// ── Properties panel toggle ─────────────────────────────────────────
		{
			const root = journal.locator("#journal-root, [data-props-open]").first();
			const before = await root.getAttribute("data-props-open").catch(() => null);
			const err = await attempt(async () => {
				await journal
					.locator('[aria-label="Show properties"], [aria-label="Hide properties"]')
					.first()
					.click();
				await journal.waitForTimeout(500);
			});
			const after = await root.getAttribute("data-props-open").catch(() => null);
			verdict(
				after !== null && after !== before ? "PASS" : "FAIL",
				"Properties panel toggle",
				after !== before
					? `data-props-open ${before} → ${after}`
					: `unchanged (${after})${err ? ` [err: ${err}]` : ""}`,
			);
			await s.shot(journal, "14-props-toggle");
			// Assert the panel actually shows property rows when open.
			if (after === "true") {
				const propsVisible = await journal
					.locator("#journal-props")
					.first()
					.isVisible()
					.catch(() => false);
				verdict(
					propsVisible ? "PASS" : "?",
					"Properties panel content visible",
					propsVisible ? "properties aside visible" : "properties aside not visible",
				);
			}
		}

		// ── Calendar (nav) panel toggle ─────────────────────────────────────
		{
			const root = journal.locator("#journal-root, [data-nav-open]").first();
			const before = await root.getAttribute("data-nav-open").catch(() => null);
			const err = await attempt(async () => {
				await journal
					.locator('[aria-label="Hide calendar"], [aria-label="Show calendar"]')
					.first()
					.click();
				await journal.waitForTimeout(500);
			});
			const after = await root.getAttribute("data-nav-open").catch(() => null);
			verdict(
				after !== null && after !== before ? "PASS" : "FAIL",
				"Calendar (nav) panel toggle",
				after !== before
					? `data-nav-open ${before} → ${after}`
					: `unchanged (${after})${err ? ` [err: ${err}]` : ""}`,
			);
			await s.shot(journal, "15-nav-toggle");
			// Re-open the nav for the change-icon step (icon picker lives in the header,
			// but re-open so a later screenshot shows the calendar again).
			if (after === "false") {
				await journal
					.locator('[aria-label="Show calendar"]')
					.first()
					.click()
					.catch(() => undefined);
				await journal.waitForTimeout(400);
			}
		}

		// ── Change-icon button (icon picker in the header) ──────────────────
		{
			const iconBtn = journal.locator('.app-header__left [aria-label="Change icon"]').first();
			const haveIconBtn = (await iconBtn.count().catch(() => 0)) > 0;
			if (!haveIconBtn) {
				verdict("?", "Change-icon button", "no Change-icon button (no mutable entry on focus?)");
			} else {
				const err = await attempt(async () => {
					await iconBtn.click();
					await journal.waitForTimeout(600);
				});
				// The shared icon picker opens as a popover/menu surface.
				const pickerVisible = await journal
					.locator(".fm-menu, [role='dialog'], .bs-popover, .picker, [role='menu']")
					.first()
					.isVisible()
					.catch(() => false);
				verdict(
					pickerVisible ? "PASS" : "FAIL",
					"Change-icon opens picker",
					pickerVisible
						? "icon picker surface visible"
						: `no picker visible${err ? ` [err: ${err}]` : ""}`,
				);
				await s.shot(journal, "16-icon-picker");
				await dismissMenu(journal);
			}
		}

		// ── Persistence: reopen a prior date, assert content survives ───────
		// Navigate to yesterday (we seeded it earlier) and confirm its text
		// renders; then back to today and confirm the marker survived.
		{
			await journal.keyboard.press("ArrowLeft").catch(() => undefined);
			await journal.waitForTimeout(900);
			const yBody = await bodyText(journal);
			verdict(
				yBody.includes("Yesterday") ? "PASS" : "?",
				"Reopen yesterday — content persists",
				yBody.includes("Yesterday")
					? "yesterday's seeded text renders"
					: `yesterday body did not contain seed text (len ${yBody.length})`,
			);
			await s.shot(journal, "17-reopen-yesterday");

			await journal.keyboard.press("t").catch(() => undefined);
			await journal.waitForTimeout(900);
			const tBody = await bodyText(journal);
			verdict(
				tBody.includes(marker) ? "PASS" : "FAIL",
				"Reopen today — written marker persists",
				tBody.includes(marker)
					? "marker still present after navigating away + back"
					: "marker LOST on reopen",
			);
			await s.shot(journal, "18-reopen-today");
		}

		// ── In-app search overlay (chord-driven) ────────────────────────────
		{
			const err = await attempt(async () => {
				await journal.keyboard.press("Meta+k");
				await journal.waitForTimeout(500);
			});
			const overlayVisible = await journal
				.locator(".fm-menu, [role='dialog'], .journal__search, [role='listbox']")
				.first()
				.isVisible()
				.catch(() => false);
			verdict(
				overlayVisible ? "PASS" : "?",
				"Search overlay (Cmd+K)",
				overlayVisible ? "search surface visible" : `no search surface${err ? ` [err: ${err}]` : ""}`,
			);
			await s.shot(journal, "19-search");
			await dismissMenu(journal);
		}

		s.note("");
		s.note("— end of deep journal walkthrough (228) —");
	} finally {
		await s.finish();
	}
});
