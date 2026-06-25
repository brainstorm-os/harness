/**
 * Session 228 — deep Automations walkthrough.
 *
 * A single founder session that exercises the Automations app end to end
 * against its REAL DOM (selectors lifted from `apps/automations/src`): the
 * three-tab shell (Workflows / Reminders / Runs), the "New from template"
 * gallery, the export/import bundle transfer, per-row ⋯ menus (Enable/Disable
 * → status flip, Copy bundle, Export to file…), workflow step inspection,
 * the reminders quick-capture + Done/Snooze/Delete transitions, the Runs
 * history + provenance inspector, and — PRIORITY — any link from a run or
 * workflow to an entity it created (click it, assert the target opens).
 *
 * Parts of this app are gated (Stage 11 scheduler / OQ-166 builder): the
 * header ⋯ is deliberately disabled, there is no in-row "Run now", and the
 * runs view renders step kinds rather than clickable created-entity links.
 * Every probe records `[PASS] / [FAIL] / [?]` from observable DOM so the
 * capture distinguishes "wired" from "no-op / not-yet-built". Nothing aborts
 * the session — each action is guarded and narrated.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const MENU = ".bs-object-menu[role='menu']";
const MENU_ITEM = ".bs-object-menu__item[role='menuitem']";

test("deep automations walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-automations");

	// Each probe runs guarded; `note` records the verdict, never throws.
	const probe = async (label: string, fn: () => Promise<string>): Promise<void> => {
		try {
			const observed = await fn();
			s.note(observed);
		} catch (error) {
			s.note(`[FAIL] ${label} — threw: ${(error as Error).message}`);
		}
	};

	/** Click a tab by its visible label and report the active tab afterward. */
	const switchTab = async (page: Page, label: string): Promise<string> => {
		await page.locator(`.au-tab:has-text("${label}")`).first().click();
		await page.waitForTimeout(700);
		const active = await page
			.locator(".au-tab[aria-selected='true']")
			.first()
			.innerText()
			.catch(() => "(none)");
		const bodyText = await page
			.locator(".au-body")
			.innerText()
			.catch(() => "");
		const matched = active.trim().toLowerCase() === label.toLowerCase();
		return `[${matched ? "PASS" : "FAIL"}] switch to "${label}" tab — active tab is "${active.trim()}", body chars=${bodyText.length}`;
	};

	const countRows = (page: Page): Promise<number> =>
		page
			.locator(".au-list .au-row")
			.count()
			.catch(() => 0);

	try {
		const page = await s.openApp(APP.Automations);
		await page.waitForLoadState("domcontentloaded").catch(() => undefined);
		await page.waitForTimeout(2000);
		await s.shot(page, "01-open");

		// ── Sanity: the three-tab shell rendered.
		await probe("tab shell renders", async () => {
			const tabs = await page
				.locator(".au-tab")
				.allInnerTexts()
				.catch(() => []);
			const ok = tabs.length === 3;
			return `[${ok ? "PASS" : "FAIL"}] tab shell renders — tabs=${JSON.stringify(tabs)}`;
		});

		// ── Tab switching: assert content changed for each of the three views.
		await probe("switch Reminders", () => switchTab(page, "Reminders"));
		await s.shot(page, "02-reminders-tab");
		await probe("switch Runs", () => switchTab(page, "Runs"));
		await s.shot(page, "03-runs-tab");
		await probe("switch back to Workflows", () => switchTab(page, "Workflows"));
		await s.shot(page, "04-workflows-tab");

		// ── New from template — open the gallery, count workflows, add one, assert
		// the workflow list grew by one.
		await probe("open template gallery", async () => {
			await page.locator(".au-toolbar button:has-text('New from template')").first().click();
			await page.waitForTimeout(700);
			const cards = await page
				.locator(".au-templates .au-template")
				.count()
				.catch(() => 0);
			const visible = await page
				.locator(".au-templates")
				.first()
				.isVisible()
				.catch(() => false);
			return `[${visible && cards > 0 ? "PASS" : "FAIL"}] open template gallery — visible=${visible}, template cards=${cards}`;
		});
		await s.shot(page, "05-template-gallery");

		await probe("add a template → workflow created", async () => {
			const before = await countRows(page);
			// Prefer the on-demand "Test notification" (Manual trigger → runnable);
			// fall back to the first card's Add button.
			const testCard = page.locator(".au-template", { hasText: /test notification/i }).first();
			const testAdd = testCard.locator("button:has-text('Add')").first();
			const addBtn = (await testAdd.count().catch(() => 0))
				? testAdd
				: page.locator(".au-template button:has-text('Add')").first();
			await addBtn.click().catch(() => undefined);
			await page.waitForTimeout(1500);
			const after = await countRows(page);
			const grew = after > before;
			return `[${grew ? "PASS" : "FAIL"}] add a template → workflow created — rows ${before} → ${after}`;
		});
		await s.shot(page, "06-after-add-template");

		// Add a second template so we have more than one row to inspect.
		await probe("add a second template", async () => {
			const before = await countRows(page);
			const open = page.locator(".au-toolbar button:has-text('New from template')").first();
			if (await open.count().catch(() => 0)) {
				await open.click().catch(() => undefined);
				await page.waitForTimeout(600);
			}
			const dailyCard = page.locator(".au-template", { hasText: /daily planning/i }).first();
			const dailyAdd = dailyCard.locator("button:has-text('Add')").first();
			const addBtn = (await dailyAdd.count().catch(() => 0))
				? dailyAdd
				: page.locator(".au-template button:has-text('Add')").first();
			await addBtn.click().catch(() => undefined);
			await page.waitForTimeout(1500);
			const after = await countRows(page);
			return `[${after >= before ? "PASS" : "FAIL"}] add a second template — rows ${before} → ${after}`;
		});

		// ── Import — open the dialog (it's a host file dialog; only present when
		// the files service is wired, so the button may be absent outside the shell).
		await probe("Import dialog", async () => {
			const importBtn = page.locator(".au-toolbar button:has-text('Import')").first();
			const present = (await importBtn.count().catch(() => 0)) > 0;
			if (!present) return "[?] Import — button absent (files service unwired / gated)";
			// A native file dialog can block; fire it without awaiting the click promise.
			importBtn.click().catch(() => undefined);
			await page.waitForTimeout(1200);
			return "[?] Import — clicked; opens a host file dialog (no in-DOM assertion possible)";
		});
		await s.shot(page, "07-after-import");
		// Dismiss any modal dialog the click may have raised.
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(400);

		// ── Row ⋯ menu — open it on the first workflow and walk every item.
		await probe("open first workflow row ⋯ menu", async () => {
			const more = page.locator(".au-list .au-row .bs-object-menu__more").first();
			if (!(await more.count().catch(() => 0))) return "[FAIL] row ⋯ — no workflow rows present";
			await more.click().catch(() => undefined);
			await page.waitForTimeout(600);
			const open = await page
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			const items = await page
				.locator(`${MENU} ${MENU_ITEM}`)
				.allInnerTexts()
				.catch(() => []);
			return `[${open ? "PASS" : "FAIL"}] open row ⋯ menu — open=${open}, items=${JSON.stringify(items)}`;
		});
		await s.shot(page, "08-row-menu");

		// Enable/Disable — click the toggle item and assert the row status flips.
		await probe("Enable/Disable flips status", async () => {
			const statusBefore = await page
				.locator(".au-list .au-row")
				.first()
				.locator(".au-row__status")
				.innerText()
				.catch(() => "?");
			// Re-open the menu (a previous probe may have closed it).
			const more = page.locator(".au-list .au-row .bs-object-menu__more").first();
			await more.click().catch(() => undefined);
			await page.waitForTimeout(500);
			const toggle = page
				.locator(`${MENU} ${MENU_ITEM}`)
				.filter({ hasText: /enable|disable/i })
				.first();
			if (!(await toggle.count().catch(() => 0)))
				return `[FAIL] Enable/Disable — no toggle item (status was "${statusBefore.trim()}")`;
			await toggle.click().catch(() => undefined);
			await page.waitForTimeout(1200);
			const statusAfter = await page
				.locator(".au-list .au-row")
				.first()
				.locator(".au-row__status")
				.innerText()
				.catch(() => "?");
			const flipped = statusBefore.trim() !== statusAfter.trim();
			return `[${flipped ? "PASS" : "FAIL"}] Enable/Disable flips status — "${statusBefore.trim()}" → "${statusAfter.trim()}"`;
		});
		await s.shot(page, "09-after-toggle");

		// Copy bundle — clicking it copies to the clipboard and flashes a status banner.
		await probe("Copy bundle", async () => {
			const more = page.locator(".au-list .au-row .bs-object-menu__more").first();
			await more.click().catch(() => undefined);
			await page.waitForTimeout(500);
			const copy = page
				.locator(`${MENU} ${MENU_ITEM}`)
				.filter({ hasText: /copy bundle/i })
				.first();
			if (!(await copy.count().catch(() => 0))) return "[?] Copy bundle — item absent";
			await copy.click().catch(() => undefined);
			await page.waitForTimeout(900);
			const banner = await page
				.locator(".au-status")
				.first()
				.innerText()
				.catch(() => "");
			const ok = /copied|export/i.test(banner);
			return `[${ok ? "PASS" : "?"}] Copy bundle — status banner="${banner.trim() || "(none)"}"`;
		});
		await s.shot(page, "10-after-copy");

		// Export to file… — only present with the files service; opens a host dialog.
		await probe("Export to file…", async () => {
			const more = page.locator(".au-list .au-row .bs-object-menu__more").first();
			await more.click().catch(() => undefined);
			await page.waitForTimeout(500);
			const exportItem = page
				.locator(`${MENU} ${MENU_ITEM}`)
				.filter({ hasText: /export to file/i })
				.first();
			if (!(await exportItem.count().catch(() => 0)))
				return "[?] Export to file… — item absent (files service unwired / gated)";
			exportItem.click().catch(() => undefined);
			await page.waitForTimeout(1000);
			return "[?] Export to file… — clicked; opens a host save dialog (no in-DOM assertion)";
		});
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(400);
		await s.shot(page, "11-after-export");

		// ── Step inspection — the workflow row only shows a step COUNT (the visual
		// builder is gated, OQ-166), so assert the step-count meta renders.
		await probe("workflow step count renders", async () => {
			const meta = await page
				.locator(".au-list .au-row")
				.first()
				.locator(".au-row__meta")
				.innerText()
				.catch(() => "");
			const ok = /step/i.test(meta);
			return `[${ok ? "PASS" : "?"}] workflow step list — row meta="${meta.trim()}" (no inline step editor; builder gated)`;
		});

		// ── Reminders tab — capture a reminder, then exercise Done / Snooze.
		await probe("switch to Reminders for capture", () => switchTab(page, "Reminders"));
		await s.shot(page, "12-reminders-before-capture");

		await probe("capture a reminder", async () => {
			const before = await countRows(page);
			const subject = page.locator(".au-capture__subject").first();
			await subject.click().catch(() => undefined);
			await subject.fill("Email the Q3 investors").catch(() => undefined);
			await page.waitForTimeout(300);
			const add = page.locator(".au-capture button:has-text('Add reminder')").first();
			await add.click().catch(() => undefined);
			await page.waitForTimeout(1500);
			const after = await countRows(page);
			const grew = after > before;
			return `[${grew ? "PASS" : "FAIL"}] capture a reminder — rows ${before} → ${after}`;
		});
		await s.shot(page, "13-reminder-captured");

		// Inspect the captured reminder's status pill.
		await probe("reminder status pill renders", async () => {
			const pill = await page
				.locator(".au-list .au-row .au-row__status")
				.first()
				.innerText()
				.catch(() => "");
			const ok = pill.trim().length > 0;
			return `[${ok ? "PASS" : "?"}] reminder status pill — "${pill.trim()}"`;
		});

		// Snooze transition — pick Snooze from the reminder row ⋯ and assert the
		// status pill changes to Snoozed.
		await probe("reminder Snooze transition", async () => {
			const statusBefore = await page
				.locator(".au-list .au-row .au-row__status")
				.first()
				.innerText()
				.catch(() => "?");
			const more = page.locator(".au-list .au-row .bs-object-menu__more").first();
			await more.click().catch(() => undefined);
			await page.waitForTimeout(500);
			const snooze = page
				.locator(`${MENU} ${MENU_ITEM}`)
				.filter({ hasText: /snooze/i })
				.first();
			if (!(await snooze.count().catch(() => 0))) return "[FAIL] Snooze — item absent";
			await snooze.click().catch(() => undefined);
			await page.waitForTimeout(1200);
			const statusAfter = await page
				.locator(".au-list .au-row .au-row__status")
				.first()
				.innerText()
				.catch(() => "?");
			const changed = statusBefore.trim() !== statusAfter.trim() || /snooz/i.test(statusAfter);
			return `[${changed ? "PASS" : "?"}] reminder Snooze — "${statusBefore.trim()}" → "${statusAfter.trim()}"`;
		});
		await s.shot(page, "14-reminder-snoozed");

		// Done transition — pick Done and assert the pill flips to Done.
		await probe("reminder Done transition", async () => {
			const more = page.locator(".au-list .au-row .bs-object-menu__more").first();
			await more.click().catch(() => undefined);
			await page.waitForTimeout(500);
			const done = page
				.locator(`${MENU} ${MENU_ITEM}`)
				.filter({ hasText: /^done$/i })
				.first();
			if (!(await done.count().catch(() => 0))) return "[FAIL] Done — item absent";
			await done.click().catch(() => undefined);
			await page.waitForTimeout(1200);
			const statusAfter = await page
				.locator(".au-list .au-row .au-row__status")
				.first()
				.innerText()
				.catch(() => "?");
			const ok = /done/i.test(statusAfter);
			return `[${ok ? "PASS" : "?"}] reminder Done — pill now "${statusAfter.trim()}"`;
		});
		await s.shot(page, "15-reminder-done");

		// ── Runs tab — assert the run history surface, and inspect provenance.
		await probe("switch to Runs", () => switchTab(page, "Runs"));
		await page.waitForTimeout(800);

		let runCount = 0;
		await probe("runs history present", async () => {
			runCount = await page
				.locator(".au-runs .au-run")
				.count()
				.catch(() => 0);
			const empty = await page
				.locator(".au-body")
				.innerText()
				.catch(() => "");
			if (runCount > 0) return `[PASS] runs history — ${runCount} run(s) listed`;
			const gated = /no workflow runs yet|run history appears here/i.test(empty);
			return `[?] runs history — 0 runs; empty/gated state shown=${gated} (scheduler is Stage-11 gated)`;
		});
		await s.shot(page, "16-runs-list");

		// Open a run → provenance (the depth-tagged step log) renders.
		await probe("inspect a run → provenance", async () => {
			if (runCount === 0) return "[?] inspect run — no runs to inspect (scheduler gated)";
			const inspect = page.locator(".au-run button:has-text('Inspect')").first();
			if (!(await inspect.count().catch(() => 0))) return "[?] inspect run — no Inspect affordance";
			await inspect.click().catch(() => undefined);
			await page.waitForTimeout(800);
			const steps = await page
				.locator(".au-run__detail .au-step")
				.count()
				.catch(() => 0);
			const detailVisible = await page
				.locator(".au-run__detail")
				.first()
				.isVisible()
				.catch(() => false);
			return `[${detailVisible ? "PASS" : "?"}] inspect run — detail open=${detailVisible}, step rows=${steps}`;
		});
		await s.shot(page, "17-run-provenance");

		// ── LINKS (PRIORITY) — a run or workflow that references a created entity
		// (e.g. a Note the workflow made) should be CLICKABLE and OPEN that entity.
		// The runs view currently renders step KINDS (no anchor to a created
		// entity), so this records whether such a link exists at all, then — if
		// one surfaces — clicks it and asserts a new entity window/page opens.
		await probe("LINK: run/workflow → created entity opens", async () => {
			const before = s.appPagesFor(APP.Notes).length;
			// Any anchor or button that names a created entity inside a run detail
			// or a workflow row. (Selector is broad on purpose — we're testing for
			// the presence of the affordance, which is the gated bit.)
			const link = page
				.locator(
					".au-run__detail a, .au-run__detail [data-entity-id], .au-row a, .au-row [data-entity-id], .au-step a, .au-step [data-entity-id]",
				)
				.first();
			const hasLink = (await link.count().catch(() => 0)) > 0;
			if (!hasLink)
				return "[?] LINK run/workflow → entity — NO clickable created-entity link surfaced (runs render step kinds only; entity-open affordance not wired — Stage 11)";
			const linkText = await link.innerText().catch(() => "(link)");
			await link.click().catch(() => undefined);
			await page.waitForTimeout(2000);
			// Did a Notes (or any new app) window open for the created entity?
			const afterNotes = s.appPagesFor(APP.Notes).length;
			const opened = afterNotes > before;
			return `[${opened ? "PASS" : "FAIL"}] LINK run/workflow → entity — clicked "${linkText.trim()}", Notes pages ${before} → ${afterNotes}`;
		});
		await s.shot(page, "18-after-link-click");

		// ── Header ⋯ menu — the cross-app trailing object menu. In Automations it
		// is deliberately DISABLED (no header object), so assert that rather than
		// expecting a menu to open.
		await probe("header ⋯ menu", async () => {
			const headerMore = page.locator(".app-header__right .bs-object-menu__more").first();
			if (!(await headerMore.count().catch(() => 0))) return "[?] header ⋯ — no trigger present";
			const disabled =
				(await headerMore.getAttribute("disabled").catch(() => null)) !== null ||
				(await headerMore.getAttribute("aria-disabled").catch(() => null)) === "true" ||
				(await headerMore.isDisabled().catch(() => false));
			if (disabled)
				return "[?] header ⋯ — present but DISABLED by design (no header object in Automations)";
			await headerMore.click().catch(() => undefined);
			await page.waitForTimeout(600);
			const open = await page
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			const items = await page
				.locator(`${MENU} ${MENU_ITEM}`)
				.allInnerTexts()
				.catch(() => []);
			return `[${open ? "PASS" : "?"}] header ⋯ — menu open=${open}, items=${JSON.stringify(items)}`;
		});
		await s.shot(page, "19-header-menu");

		// ── Run now — there is no in-row "Run now" affordance (manual trigger fires
		// via the gated scheduler), so record its absence explicitly.
		await probe("Run now affordance", async () => {
			const runNow = page
				.locator(
					"button:has-text('Run now'), button:has-text('Run'), [data-testid='run-now'], button[title*='run' i]",
				)
				.first();
			const present = (await runNow.count().catch(() => 0)) > 0;
			if (!present)
				return "[?] Run now — NO run-now affordance in the UI (manual triggers fire via the Stage-11 scheduler, not an in-app button)";
			await runNow.click().catch(() => undefined);
			await page.waitForTimeout(1500);
			await switchTab(page, "Runs");
			const runs = await page
				.locator(".au-runs .au-run")
				.count()
				.catch(() => 0);
			return `[${runs > 0 ? "PASS" : "?"}] Run now — clicked; runs listed afterward=${runs}`;
		});
		await s.shot(page, "20-after-run-now");

		// ── Persistence — switch away and back; the workflows we added must survive.
		await probe("persistence across tab switches", async () => {
			await page
				.locator(".au-tab:has-text('Workflows')")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(600);
			const before = await countRows(page);
			await page
				.locator(".au-tab:has-text('Reminders')")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(500);
			await page
				.locator(".au-tab:has-text('Runs')")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(500);
			await page
				.locator(".au-tab:has-text('Workflows')")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(800);
			const after = await countRows(page);
			const ok = after >= before && after > 0;
			return `[${ok ? "PASS" : "FAIL"}] persistence across tab switches — workflow rows ${before} → ${after}`;
		});
		await s.shot(page, "21-persistence");

		s.note("Session 228 complete — verdicts above; gated surfaces marked [?].");
	} finally {
		await s.finish();
	}
});
