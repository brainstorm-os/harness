/**
 * Session 228 — Deep Bookmarks walkthrough. Exercise the real Bookmarks
 * surface end-to-end: the Add-bookmark popover (URL / title / description /
 * tags / "Download page content" toggle / Save), the vault-wide "N duplicate
 * links found — Merge" banner, tag editing + tag-filter, sidebar surfaces and
 * the tag board vs. flat list, OPENING A LINK (the priority probe — record
 * exactly what happens), the sidebar show/hide toggle, the header ⋯ "More
 * actions" object menu, rename/delete cleanup, and PERSISTENCE on reopen.
 *
 * Every action is judged from observable DOM and narrated as
 * `[PASS]/[FAIL]/[?] <action> — <observed>` into the session notes; each step
 * is wrapped in try/catch so a single failure never aborts the walkthrough.
 * Screenshots capture states + failures. This spec only DRIVES the app — it
 * never asserts via `expect()` so the run always completes and reports.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep bookmarks walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-bookmarks");

	// A unique-per-run URL so the "new card appears" + cleanup assertions don't
	// collide with bookmarks left by an earlier session in the persistent vault.
	const stamp = Date.now().toString(36);
	const testUrl = `https://northbound.example/deep-bookmarks-${stamp}`;
	const testTitle = `Deep Bookmarks Probe ${stamp}`;
	const testDesc = "Authored by session 228 to exercise the bookmarks surface.";
	const testTag = `s228-${stamp}`;

	/** Narrate a judged result; never throws. */
	const judge = (verdict: "PASS" | "FAIL" | "?", action: string, observed: string): void => {
		s.note(`[${verdict}] ${action} — ${observed}`);
	};

	/** Run a probe, catching everything; a throw is itself a [FAIL] line. */
	const step = async (action: string, fn: () => Promise<void>): Promise<void> => {
		try {
			await fn();
		} catch (error) {
			judge("FAIL", action, `threw: ${(error as Error).message}`);
		}
	};

	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2600);
		await s.shot(bm, "01-opened");
		judge("PASS", "open Bookmarks app", `url=${bm.url()}`);

		// Selectors observed from apps/bookmarks/src/**.
		const cardSel = ".bookmarks__card";
		const popoverSel = ".bs-popover";
		const panelSel = ".bs-popover__panel";
		const menuSel = ".fm-menu";

		const cardCount = async (): Promise<number> =>
			await bm
				.locator(cardSel)
				.count()
				.catch(() => 0);
		const cardForTitle = (title: string) => bm.locator(cardSel).filter({ hasText: title }).first();

		// ── Baseline card count ────────────────────────────────────────────────
		let baseline = 0;
		await step("read baseline bookmark count", async () => {
			baseline = await cardCount();
			judge("PASS", "read baseline bookmark count", `${baseline} card(s) visible`);
		});

		// ── Add-bookmark dialog ─────────────────────────────────────────────────
		await step("open Add-bookmark dialog", async () => {
			await bm.locator('[aria-label="Add bookmark"]').first().click({ timeout: 8000 });
			await bm.waitForTimeout(700);
			const open = await bm
				.locator(popoverSel)
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(bm, "02-add-dialog");
			judge(open ? "PASS" : "FAIL", "open Add-bookmark dialog", `popover visible=${open}`);
		});

		await step("fill URL / title / description / tags", async () => {
			const panel = bm.locator(panelSel).first();
			const inputs = panel.locator(".bookmarks__form-input");
			// Field order in compose-bookmark.ts: url, title, description, tags.
			await inputs.nth(0).fill(testUrl);
			await inputs.nth(1).fill(testTitle);
			await inputs.nth(2).fill(testDesc);
			await inputs.nth(3).fill(testTag);
			await bm.waitForTimeout(200);
			const urlVal = await inputs
				.nth(0)
				.inputValue()
				.catch(() => "");
			const tagVal = await inputs
				.nth(3)
				.inputValue()
				.catch(() => "");
			await s.shot(bm, "03-add-dialog-filled");
			judge(
				urlVal === testUrl && tagVal === testTag ? "PASS" : "FAIL",
				"fill URL / title / description / tags",
				`url="${urlVal}" tags="${tagVal}"`,
			);
		});

		await step("toggle Download page content for offline reading", async () => {
			const panel = bm.locator(panelSel).first();
			const checkbox = panel.locator('input.checkbox__input[type="checkbox"]').first();
			const before = await checkbox.isChecked().catch(() => null);
			// Click the label wrapper so the styled box toggles the native input.
			await panel
				.locator(".checkbox")
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(150);
			const after = await checkbox.isChecked().catch(() => null);
			judge(
				before !== null && after !== null && before !== after ? "PASS" : "?",
				"toggle Download page content",
				`checked ${before} → ${after}`,
			);
		});

		await step("Save bookmark — assert new card appears", async () => {
			await bm
				.locator(panelSel)
				.getByRole("button", { name: "Save bookmark" })
				.first()
				.click({ timeout: 6000 });
			await bm.waitForTimeout(1500);
			const dialogGone = !(await bm
				.locator(popoverSel)
				.first()
				.isVisible()
				.catch(() => false));
			// New bookmarks land in the Inbox surface (the default view).
			const appeared = await cardForTitle(testTitle)
				.isVisible()
				.catch(() => false);
			const total = await cardCount();
			await s.shot(bm, "04-after-save");
			judge(
				appeared ? "PASS" : "FAIL",
				"Save bookmark — assert new card appears",
				`dialog closed=${dialogGone}, card visible=${appeared}, count ${baseline}→${total}`,
			);
		});

		// ── Duplicate banner + Merge ──────────────────────────────────────────────
		// Re-add the SAME url so the vault has a same-URL collision → the banner
		// renders. (compose blocks dupes in-form, so we add via the dev path if
		// present, else accept that the banner may already be showing from the
		// seeded vault and exercise Merge against whatever it found.)
		await step("create a duplicate to surface the banner", async () => {
			// Try the form again; compose rejects exact dupes, but a trailing slash
			// is a distinct string yet the same normalized URL, surfacing the banner.
			await bm
				.locator('[aria-label="Add bookmark"]')
				.first()
				.click({ timeout: 6000 })
				.catch(() => undefined);
			await bm.waitForTimeout(500);
			const panel = bm.locator(panelSel).first();
			const inputs = panel.locator(".bookmarks__form-input");
			await inputs
				.nth(0)
				.fill(`${testUrl}/`)
				.catch(() => undefined);
			await inputs
				.nth(1)
				.fill(`${testTitle} dup`)
				.catch(() => undefined);
			await bm
				.locator(panelSel)
				.getByRole("button", { name: "Save bookmark" })
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(800);
			// If the form rejected it, close the dialog and carry on.
			const stillOpen = await bm
				.locator(popoverSel)
				.first()
				.isVisible()
				.catch(() => false);
			if (stillOpen) {
				const formErr = await panel
					.locator(".bookmarks__form-error")
					.first()
					.innerText()
					.catch(() => "");
				await bm
					.locator(".bs-popover__close")
					.first()
					.click({ timeout: 2000 })
					.catch(() => undefined);
				judge("?", "create a duplicate to surface the banner", `compose rejected: "${formErr}"`);
			} else {
				judge("PASS", "create a duplicate to surface the banner", "second copy saved");
			}
			await bm.waitForTimeout(400);
		});

		await step("Merge duplicates — banner clears, duplicates collapse", async () => {
			const banner = bm.locator(".bookmarks__dedup-banner").first();
			const hadBanner = await banner.isVisible().catch(() => false);
			if (!hadBanner) {
				judge("?", "Merge duplicates", "no duplicate banner present to merge");
				return;
			}
			const label = await banner
				.locator(".bookmarks__dedup-label")
				.innerText()
				.catch(() => "");
			await s.shot(bm, "05-dedup-banner");
			const before = await cardCount();
			await banner.locator(".bookmarks__dedup-merge").click({ timeout: 4000 });
			await bm.waitForTimeout(1200);
			const bannerGone = !(await banner.isVisible().catch(() => false));
			const after = await cardCount();
			await s.shot(bm, "06-after-merge");
			judge(
				bannerGone ? "PASS" : "FAIL",
				"Merge duplicates — banner clears",
				`banner="${label}", banner gone=${bannerGone}, count ${before}→${after}`,
			);
		});

		// ── Edit tags on the test bookmark ────────────────────────────────────────
		const editTag = `${testTag}-edited`;
		await step("open ⋯ menu on the test card and Edit tags", async () => {
			const card = cardForTitle(testTitle);
			if (!(await card.isVisible().catch(() => false))) {
				judge("?", "open ⋯ on test card", "test card not visible (may have merged away)");
				return;
			}
			await card.hover().catch(() => undefined);
			await bm.waitForTimeout(200);
			// The card ⋯ is the hover-revealed more-button inside the card actions.
			await card
				.locator(".bookmarks__card-actions button, button.bs-object-menu__more")
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(500);
			const menuOpen = await bm
				.locator(menuSel)
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(bm, "07-card-menu");
			judge(menuOpen ? "PASS" : "FAIL", "open ⋯ menu on test card", `menu visible=${menuOpen}`);
			if (!menuOpen) return;
			await bm
				.locator(menuSel)
				.getByText("Edit tags", { exact: false })
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(600);
			const tagsDialog = await bm
				.locator(popoverSel)
				.first()
				.isVisible()
				.catch(() => false);
			if (!tagsDialog) {
				judge("FAIL", "open Edit tags dialog", "tags popover did not open");
				return;
			}
			const input = bm.locator(`${panelSel} .bookmarks__form-input`).first();
			await input.fill(editTag).catch(() => undefined);
			await bm
				.locator(panelSel)
				.getByRole("button", { name: /save/i })
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(900);
			const chip = await cardForTitle(testTitle)
				.locator(".bookmarks__card-tag")
				.filter({ hasText: editTag })
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(bm, "08-after-edit-tags");
			judge(chip ? "PASS" : "FAIL", "Edit tags — chip updated", `#${editTag} chip visible=${chip}`);
		});

		// ── Filter by tag (sidebar) ───────────────────────────────────────────────
		await step("filter by tag via sidebar tag row", async () => {
			const tagRow = bm.locator(".bookmarks__tag-list-btn").filter({ hasText: editTag }).first();
			const found = await tagRow.isVisible().catch(() => false);
			if (!found) {
				judge("?", "filter by tag", `sidebar row for #${editTag} not found`);
				return;
			}
			await tagRow.click({ timeout: 4000 });
			await bm.waitForTimeout(900);
			const selected = await tagRow.getAttribute("aria-selected").catch(() => null);
			const visible = await cardCount();
			const onlyTagged = await cardForTitle(testTitle)
				.isVisible()
				.catch(() => false);
			await s.shot(bm, "09-tag-filtered");
			judge(
				selected === "true" && onlyTagged ? "PASS" : "FAIL",
				"filter by tag via sidebar",
				`row aria-selected=${selected}, ${visible} card(s), test card present=${onlyTagged}`,
			);
		});

		// ── Switch surfaces + board (Tags) vs list ────────────────────────────────
		await step("switch sidebar surface to Tags (board overview)", async () => {
			const tagsNav = bm.locator(".bookmarks__nav-btn").filter({ hasText: "Tags" }).first();
			await tagsNav.click({ timeout: 4000 }).catch(() => undefined);
			await bm.waitForTimeout(900);
			const boards = await bm
				.locator(".bookmarks__tag-board")
				.count()
				.catch(() => 0);
			const listVisible = await bm
				.locator(".bookmarks__card-scroll")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(bm, "10-tags-board");
			judge(
				boards > 0 || !listVisible ? "PASS" : "?",
				"switch to Tags board overview",
				`tag-board lanes=${boards}, flat-list visible=${listVisible}`,
			);
		});

		await step("switch back to Inbox surface (flat list)", async () => {
			const inboxNav = bm.locator(".bookmarks__nav-btn").filter({ hasText: "Inbox" }).first();
			await inboxNav.click({ timeout: 4000 }).catch(() => undefined);
			await bm.waitForTimeout(800);
			const selected = await inboxNav.getAttribute("aria-selected").catch(() => null);
			const boards = await bm
				.locator(".bookmarks__tag-board")
				.count()
				.catch(() => 0);
			await s.shot(bm, "11-inbox-list");
			judge(
				selected === "true" && boards === 0 ? "PASS" : "?",
				"switch back to Inbox (flat list)",
				`Inbox aria-selected=${selected}, board lanes=${boards}`,
			);
		});

		// ── OPEN LINK — priority probe ─────────────────────────────────────────────
		// Two affordances: clicking the card opens the in-app DETAIL (readable
		// content + header "Open original"); the header "Open original" anchor
		// opens the source URL externally. Record exactly what each does.
		await step("OPEN LINK: click card title → in-app detail", async () => {
			const before = s.app.windows().length;
			const card = cardForTitle(testTitle);
			if (!(await card.isVisible().catch(() => false))) {
				judge("?", "open link: click card", "test card not visible");
				return;
			}
			await card
				.locator(".bookmarks__card-title")
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(1400);
			const detailVisible = await bm
				.locator(".bookmarks__detail-island, .bookmarks__detail")
				.first()
				.isVisible()
				.catch(() => false);
			const openOriginal = await bm
				.locator('[aria-label="Open original"]')
				.first()
				.isVisible()
				.catch(() => false);
			const after = s.app.windows().length;
			await s.shot(bm, "12-detail-opened");
			judge(
				detailVisible || openOriginal ? "PASS" : "FAIL",
				"OPEN LINK: click card title → in-app detail",
				`detail island visible=${detailVisible}, "Open original" header action=${openOriginal}, windows ${before}→${after}`,
			);
		});

		await step("OPEN LINK: header 'Open original' → external/source", async () => {
			const link = bm.locator('[aria-label="Open original"]').first();
			if (!(await link.isVisible().catch(() => false))) {
				judge("?", "open link: Open original", "no 'Open original' affordance (detail not open?)");
				return;
			}
			const href = await link.getAttribute("href").catch(() => null);
			const target = await link.getAttribute("target").catch(() => null);
			const before = s.app.windows().length;
			// Watch for either a new shell window/tab (the shell external-link path)
			// or a popup; record whichever fires. Don't block the run on it.
			const popupOrWindow = Promise.race([
				bm
					.waitForEvent("popup", { timeout: 4000 })
					.then(() => "popup")
					.catch(() => null),
				s.app
					.waitForEvent("window", { timeout: 4000 })
					.then(() => "window")
					.catch(() => null),
			]);
			await link.click({ timeout: 4000 }).catch(() => undefined);
			const opened = await popupOrWindow;
			await bm.waitForTimeout(800);
			const after = s.app.windows().length;
			await s.shot(bm, "13-open-original-clicked");
			judge(
				href ? "PASS" : "FAIL",
				"OPEN LINK: header 'Open original'",
				`href="${href}" target="${target}", click outcome=${opened ?? "no-new-surface"}, windows ${before}→${after}`,
			);
		});

		// ── Sidebar show/hide ──────────────────────────────────────────────────────
		await step("toggle sidebar hide/show", async () => {
			const toggle = bm.locator('[aria-label="Hide sidebar"], [aria-label="Show sidebar"]').first();
			const labelBefore = await toggle.getAttribute("aria-label").catch(() => null);
			const navBefore = await bm
				.locator(".bookmarks__sidebar")
				.first()
				.isVisible()
				.catch(() => false);
			await toggle.click({ timeout: 4000 }).catch(() => undefined);
			await bm.waitForTimeout(600);
			const navOpenAttr = await bm
				.locator("#bookmarks-root")
				.first()
				.getAttribute("data-nav-open")
				.catch(() => null);
			await s.shot(bm, "14-sidebar-toggled");
			// Toggle back to leave the layout as we found it.
			await toggle.click({ timeout: 3000 }).catch(() => undefined);
			await bm.waitForTimeout(400);
			judge(
				navOpenAttr === "false" || navOpenAttr === "true" ? "PASS" : "?",
				"toggle sidebar hide/show",
				`label was "${labelBefore}", sidebar visible=${navBefore}, root data-nav-open=${navOpenAttr}`,
			);
		});

		// ── Header ⋯ "More actions" object menu ─────────────────────────────────────
		await step("open header ⋯ More actions menu + read items", async () => {
			// On the open-detail route the header ⋯ is the open bookmark's object menu.
			const headerMore = bm
				.locator('.bookmarks__header-more, .app-header__right [aria-label="More actions"]')
				.first();
			const visible = await headerMore.isVisible().catch(() => false);
			if (!visible) {
				judge("?", "header ⋯ More actions", "header ⋯ not present on this route");
				return;
			}
			await headerMore.click({ timeout: 4000 }).catch(() => undefined);
			await bm.waitForTimeout(600);
			const menuOpen = await bm
				.locator(menuSel)
				.first()
				.isVisible()
				.catch(() => false);
			const items = await bm
				.locator(`${menuSel} [role="menuitem"], ${menuSel} button`)
				.allInnerTexts()
				.catch(() => []);
			await s.shot(bm, "15-header-menu");
			judge(
				menuOpen ? "PASS" : "FAIL",
				"open header ⋯ More actions menu",
				`menu visible=${menuOpen}, items=[${items
					.map((i) => i.trim())
					.filter(Boolean)
					.join(", ")}]`,
			);
			// Click a benign item (Edit tags) if present to confirm items are live,
			// then close whatever opens.
			const editItem = bm.locator(menuSel).getByText("Edit tags", { exact: false }).first();
			if (await editItem.isVisible().catch(() => false)) {
				await editItem.click({ timeout: 3000 }).catch(() => undefined);
				await bm.waitForTimeout(500);
				await bm
					.locator(".bs-popover__close")
					.first()
					.click({ timeout: 2000 })
					.catch(() => undefined);
				judge("PASS", "click header menu item (Edit tags)", "item activated + closed");
			}
			await bm.keyboard.press("Escape").catch(() => undefined);
			await bm.waitForTimeout(300);
		});

		// ── Cleanup: delete the test bookmark ───────────────────────────────────────
		await step("delete the test bookmark via ⋯ → Remove", async () => {
			// Return to Inbox flat list to find the card reliably.
			await bm
				.locator(".bookmarks__nav-btn")
				.filter({ hasText: "Inbox" })
				.first()
				.click({ timeout: 3000 })
				.catch(() => undefined);
			await bm.waitForTimeout(700);
			const card = cardForTitle(testTitle);
			if (!(await card.isVisible().catch(() => false))) {
				judge("?", "delete test bookmark", "card not found to delete (already merged/removed)");
				return;
			}
			const before = await cardCount();
			await card.hover().catch(() => undefined);
			await card
				.locator(".bookmarks__card-actions button, button.bs-object-menu__more")
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(500);
			await bm
				.locator(menuSel)
				.getByText(/remove bookmark|remove/i)
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await bm.waitForTimeout(1000);
			// A confirm dialog may appear; accept it if so.
			const confirmBtn = bm
				.locator(popoverSel)
				.getByRole("button", { name: /remove|delete|confirm/i })
				.first();
			if (await confirmBtn.isVisible().catch(() => false)) {
				await confirmBtn.click({ timeout: 3000 }).catch(() => undefined);
				await bm.waitForTimeout(800);
			}
			const after = await cardCount();
			const gone = !(await cardForTitle(testTitle)
				.isVisible()
				.catch(() => false));
			await s.shot(bm, "16-after-delete");
			judge(
				gone ? "PASS" : "FAIL",
				"delete test bookmark via ⋯ → Remove",
				`card gone=${gone}, count ${before}→${after}`,
			);
		});

		// ── Persistence: reopen the app ─────────────────────────────────────────────
		await step("persistence: close + reopen Bookmarks", async () => {
			// Record whether the deleted bookmark stays gone after a fresh launch.
			const dashboard = s.dashboard;
			await dashboard
				.evaluate(
					(appId) =>
						(
							window as unknown as { brainstorm: { apps: { launch: (id: string) => Promise<void> } } }
						).brainstorm.apps.launch(appId),
					APP.Bookmarks,
				)
				.catch(() => undefined);
			await bm.waitForTimeout(800);
			// Re-pull a fresh app page for Bookmarks (the relaunch may surface a new tab).
			const pages = s.appPagesFor(APP.Bookmarks);
			const fresh = pages[pages.length - 1] ?? bm;
			await fresh.waitForTimeout(1800);
			await fresh
				.locator(".bookmarks__nav-btn")
				.filter({ hasText: "Inbox" })
				.first()
				.click({ timeout: 3000 })
				.catch(() => undefined);
			await fresh.waitForTimeout(800);
			const stillGone = !(await fresh
				.locator(cardSel)
				.filter({ hasText: testTitle })
				.first()
				.isVisible()
				.catch(() => false));
			const total = await fresh
				.locator(cardSel)
				.count()
				.catch(() => 0);
			await s.shot(fresh, "17-after-reopen");
			judge(
				stillGone ? "PASS" : "?",
				"persistence: deleted bookmark stays gone after reopen",
				`test card absent=${stillGone}, ${total} card(s) in Inbox`,
			);
		});
	} finally {
		await s.finish();
	}
});
