/**
 * Session 228 — DEEP Database walkthrough. A founder ("Mira") drives the
 * Database app hard to surface broken features: every view kind, inline cell
 * editing (name / select / date), column add, filter, sort, the inspector,
 * search, the LISTS "+" new-collection menu, relation/link navigation, the
 * header object ⋯ menu, rename, and delete/cleanup of everything created.
 *
 * Judgement is OBSERVABLE: every probe records `[PASS]/[FAIL]/[?] <action> —
 * <observed>` from the DOM (row/column count delta, cell value change, menu
 * visible, `#stage-body[data-view-kind]` switch, selection state), never from
 * whether a click threw. Each step is wrapped so one failure never aborts the
 * sweep. Major states + failures get screenshots.
 *
 * Real selectors (from apps/database/src):
 *   - sidebar lists:  .db-sidebar__list-item[data-list-id] / .db-sidebar__list-name / .db-sidebar__list-count
 *   - new list (+):   #sidebar-new-list → fancy menu "Blank collection" / "From existing objects…" / "Import from CSV…"
 *   - stage header:   #stage-title (contenteditable rename) / #stage-count
 *   - view tabs:      #view-tabs .db-tab[data-view-id] .db-tab__label ; add: [aria-label="New view"]
 *   - view kind body: #stage-body[data-view-kind="grid|list|gallery|board|calendar|timeline"]
 *   - toolbar:        #toolbar-filter / #toolbar-sort / #toolbar-settings / #toolbar-new
 *   - view settings:  .db-popover ; rows .db-popover__nav-row ; kind options .db-popover__option ; "Add column" .db-popover__add-column
 *   - grid rows:      .dbv-grid__row[data-entity-id] ; title .dbv-grid__title-label--editable / input .dbv-grid__title-input
 *   - editable cells: .dbv-grid__cell--editable (SDK .bs-cell-plain / .bs-cell-pill / .bs-cell-date-trigger / .bs-cell-link-trigger)
 *   - row open:       .dbv-grid__open
 *   - inspector:      #header-btn-inspector ; #db-inspector ; .db-inspector__props (dt/dd) ; #inspector-close
 *   - header ⋯:       .app-header__right .bs-object-menu__more  (label "More actions")
 *   - menus:          .fm-menu [role="menuitem"]
 */

import { type Page, test } from "@playwright/test";
import { APP, type FounderSession, startSession } from "../lib/founder";

const MENU = ".fm-menu, [role='menu'], [role='listbox']";
const MENU_ITEM = ".fm-menu [role='menuitem'], [role='menu'] [role='menuitem'], [role='menuitem']";

async function settle(page: Page, ms = 700): Promise<void> {
	await page.waitForTimeout(ms);
}

/** Run `fn`, recording a PASS/FAIL/? line. `judge` returns true=PASS, false=FAIL;
 *  any throw → FAIL with the message. Never re-throws. */
async function probe(s: FounderSession, action: string, fn: () => Promise<string>): Promise<void> {
	try {
		const observed = await fn();
		s.note(observed);
	} catch (err) {
		s.note(`[FAIL] ${action} — threw: ${(err as Error).message}`);
	}
}

function verdict(action: string, ok: boolean, observed: string): string {
	return `${ok ? "[PASS]" : "[FAIL]"} ${action} — ${observed}`;
}
function unknown(action: string, observed: string): string {
	return `[?] ${action} — ${observed}`;
}

/** Click the menu item whose visible text matches `re`; returns true if found. */
async function clickMenuItem(page: Page, re: RegExp): Promise<boolean> {
	const items = page.locator(MENU_ITEM);
	const n = await items.count().catch(() => 0);
	for (let i = 0; i < n; i++) {
		const txt = (
			await items
				.nth(i)
				.innerText()
				.catch(() => "")
		).trim();
		if (re.test(txt)) {
			await items
				.nth(i)
				.click()
				.catch(() => undefined);
			return true;
		}
	}
	return false;
}

async function viewKind(page: Page): Promise<string> {
	return page
		.locator("#stage-body")
		.getAttribute("data-view-kind")
		.then((v) => v ?? "")
		.catch(() => "");
}

async function gridRowCount(page: Page): Promise<number> {
	return page
		.locator(".dbv-grid__row:not(.dbv-grid__row--head):not(.dbv-grid__row--foot)")
		.count()
		.catch(() => 0);
}

async function gridColCount(page: Page): Promise<number> {
	return page
		.locator(".dbv-grid__row--head .dbv-grid__cell--head")
		.count()
		.catch(() => 0);
}

async function stageCount(page: Page): Promise<string> {
	return page
		.locator("#stage-count")
		.innerText()
		.catch(() => "");
}

test("deep database walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-database");
	const db = await s.openApp(APP.Database);
	try {
		await settle(db, 2600);
		await s.shot(db, "00-opened");

		// ── 1. Pick a user collection from the LISTS sidebar ─────────────────
		const listItems = db.locator(".db-sidebar__list-item");
		let chosenListName = "";
		await probe(s, "enumerate sidebar lists", async () => {
			const n = await listItems.count();
			const names: string[] = [];
			for (let i = 0; i < n; i++) {
				names.push(
					(
						await listItems
							.nth(i)
							.locator(".db-sidebar__list-name")
							.innerText()
							.catch(() => "")
					).trim(),
				);
			}
			return verdict("LISTS sidebar populated", n > 0, `${n} lists: ${JSON.stringify(names)}`);
		});

		// Prefer a content/calendar/CRM-style collection if present, else the last
		// list (user collections sort after vault-derived type lists).
		await probe(s, "select a user collection", async () => {
			const n = await listItems.count();
			let idx = Math.max(0, n - 1);
			for (let i = 0; i < n; i++) {
				const nm = (
					await listItems
						.nth(i)
						.locator(".db-sidebar__list-name")
						.innerText()
						.catch(() => "")
				).trim();
				if (/content|calendar|client|crm|task|project|board/i.test(nm)) {
					idx = i;
					break;
				}
			}
			await listItems.nth(idx).click();
			await settle(db, 1100);
			chosenListName = (
				await db
					.locator("#stage-title")
					.innerText()
					.catch(() => "")
			).trim();
			return verdict(
				"collection selected + stage titled",
				chosenListName.length > 0,
				`title="${chosenListName}", rows=${await stageCount(db)}`,
			);
		});
		await s.shot(db, "01-collection-selected");

		// ── 2. Switch EVERY view kind (create a fresh view, flip its kind) ───
		// Tabs are per-view; each view has a kind. We add a view then change its
		// type via View settings → View type, asserting #stage-body[data-view-kind].
		const kinds: Array<[RegExp, string]> = [
			[/^grid$/i, "grid"],
			[/^board$/i, "board"],
			[/^gallery$/i, "gallery"],
			[/^calendar$/i, "calendar"],
			[/^timeline$/i, "timeline"],
			[/^list$/i, "list"],
		];
		await probe(s, "create a probe view", async () => {
			await db
				.locator('[aria-label="New view"]')
				.first()
				.click()
				.catch(() => undefined);
			await settle(db, 900);
			const kind = await viewKind(db);
			return verdict("new view created", kind.length > 0, `+View → data-view-kind="${kind}"`);
		});

		for (const [label, expected] of kinds) {
			await probe(s, `switch view → ${expected}`, async () => {
				const before = await viewKind(db);
				await db
					.locator("#toolbar-settings")
					.click()
					.catch(() => undefined);
				await settle(db, 600);
				// Root popover → "View type" row.
				const typeRow = db.locator(".db-popover__nav-row", { hasText: /View type/i }).first();
				const hadTypeRow = await typeRow.isVisible().catch(() => false);
				if (hadTypeRow) await typeRow.click().catch(() => undefined);
				await settle(db, 500);
				// Pick the kind option.
				const opt = db.locator(".db-popover__option", { hasText: label }).first();
				const hadOpt = await opt.isVisible().catch(() => false);
				if (hadOpt) await opt.click().catch(() => undefined);
				await settle(db, 900);
				// Close the popover (Escape or backdrop).
				await db.keyboard.press("Escape").catch(() => undefined);
				await db
					.locator(".db-popover__backdrop")
					.click({ force: true })
					.catch(() => undefined);
				await settle(db, 700);
				const after = await viewKind(db);
				await s.shot(db, `02-view-${expected}`);
				const ok = after === expected;
				if (!ok) await s.shot(db, `02-view-${expected}-FAIL`);
				return verdict(
					`view layout → ${expected}`,
					ok,
					`data-view-kind: "${before}" → "${after}" (View-type row=${hadTypeRow}, option=${hadOpt})`,
				);
			});
		}

		// Return the probe view to Grid for the cell-editing block.
		await probe(s, "return probe view to grid", async () => {
			await db
				.locator("#toolbar-settings")
				.click()
				.catch(() => undefined);
			await settle(db, 500);
			await db
				.locator(".db-popover__nav-row", { hasText: /View type/i })
				.first()
				.click()
				.catch(() => undefined);
			await settle(db, 400);
			await db
				.locator(".db-popover__option", { hasText: /^Grid$/i })
				.first()
				.click()
				.catch(() => undefined);
			await settle(db, 700);
			await db.keyboard.press("Escape").catch(() => undefined);
			await settle(db, 600);
			return verdict(
				"back to grid",
				(await viewKind(db)) === "grid",
				`data-view-kind="${await viewKind(db)}"`,
			);
		});

		// ── 3. "+ New" row — assert a new row appears ────────────────────────
		await probe(s, "add a row via + New", async () => {
			const before = await gridRowCount(db);
			await db
				.locator("#toolbar-new")
				.click()
				.catch(() => undefined);
			await settle(db, 1100);
			const after = await gridRowCount(db);
			await s.shot(db, "03-new-row");
			return verdict("+ New adds a row", after > before, `rows ${before} → ${after}`);
		});

		// ── 4. INLINE CELL EDITS — name, select, date ────────────────────────
		const NAME_PROBE = `Mira probe ${Date.now() % 100000}`;
		await probe(s, "inline edit Name cell", async () => {
			const titleLabel = db.locator(".dbv-grid__title-label--editable").first();
			const had = await titleLabel.isVisible().catch(() => false);
			await titleLabel.dblclick().catch(() => undefined);
			await settle(db, 400);
			const input = db.locator(".dbv-grid__title-input").first();
			const editing = await input.isVisible().catch(() => false);
			if (editing) {
				await input.fill(NAME_PROBE).catch(() => undefined);
				await db.keyboard.press("Enter").catch(() => undefined);
				await settle(db, 900);
			}
			const body =
				(await db
					.locator("#stage-body")
					.innerText()
					.catch(() => "")) ?? "";
			const ok = body.includes(NAME_PROBE);
			await s.shot(db, "04a-name-edit");
			return verdict(
				"Name cell edit persists",
				ok,
				`editable=${had}, entered-edit=${editing}, value-in-grid=${ok}`,
			);
		});

		await probe(s, "inline edit select/pill cell", async () => {
			const pill = db
				.locator(
					".dbv-grid__row:not(.dbv-grid__row--head) .bs-cell-pill, .dbv-grid__cell--editable .bs-cell-pill",
				)
				.first();
			const had = await pill.isVisible().catch(() => false);
			const before = (await pill.innerText().catch(() => "")).trim();
			if (had) {
				await pill.click().catch(() => undefined);
				await settle(db, 700);
				const menuUp = await db
					.locator(MENU)
					.first()
					.isVisible()
					.catch(() => false);
				// Pick the first option that differs from the current value.
				const items = db.locator(MENU_ITEM);
				const m = await items.count().catch(() => 0);
				let picked = "";
				for (let i = 0; i < m; i++) {
					const txt = (
						await items
							.nth(i)
							.innerText()
							.catch(() => "")
					).trim();
					if (txt && txt !== before) {
						picked = txt;
						await items
							.nth(i)
							.click()
							.catch(() => undefined);
						break;
					}
				}
				await settle(db, 800);
				const after = (
					await db
						.locator(".bs-cell-pill")
						.first()
						.innerText()
						.catch(() => "")
				).trim();
				await s.shot(db, "04b-select-edit");
				return verdict(
					"select cell edit",
					menuUp && picked.length > 0 && after !== before,
					`menu=${menuUp}, "${before}" → "${after}" (picked "${picked}")`,
				);
			}
			return unknown("select cell edit", "no select/pill cell present in this collection");
		});

		await probe(s, "inline edit date cell", async () => {
			const trigger = db
				.locator(".dbv-grid__cell--editable .bs-cell-date-trigger, .bs-cell-date-empty")
				.first();
			const had = await trigger.isVisible().catch(() => false);
			if (!had) return unknown("date cell edit", "no date cell present in this collection");
			const before = (await trigger.innerText().catch(() => "")).trim();
			await trigger.click().catch(() => undefined);
			await settle(db, 700);
			const popUp = await db
				.locator(".bs-cell-date-pop")
				.first()
				.isVisible()
				.catch(() => false);
			// Pick "today" if the calendar is up.
			const today = db.locator(".bs-cell-cal-day--today, .bs-cell-cal-day").first();
			if (await today.isVisible().catch(() => false)) await today.click().catch(() => undefined);
			await settle(db, 700);
			await db.keyboard.press("Escape").catch(() => undefined);
			await settle(db, 500);
			const after = (
				await db
					.locator(".bs-cell-date-trigger, .bs-cell-date-empty")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			await s.shot(db, "04c-date-edit");
			return verdict(
				"date cell edit",
				popUp && after !== before,
				`popover=${popUp}, "${before}" → "${after}"`,
			);
		});

		// ── 5. Add a column via View settings → Properties → Add column ──────
		await probe(s, "add a column", async () => {
			const before = await gridColCount(db);
			await db
				.locator("#toolbar-settings")
				.click()
				.catch(() => undefined);
			await settle(db, 500);
			const propsRow = db.locator(".db-popover__nav-row", { hasText: /Properties/i }).first();
			const hadProps = await propsRow.isVisible().catch(() => false);
			if (hadProps) await propsRow.click().catch(() => undefined);
			await settle(db, 500);
			const addBtn = db.locator(".db-popover__add-column").first();
			const hadAdd = await addBtn.isVisible().catch(() => false);
			if (hadAdd) {
				await addBtn.click().catch(() => undefined);
				await settle(db, 600);
				// The column-adder is a fancy menu of existing/new properties; pick the first.
				await db
					.locator(MENU_ITEM)
					.first()
					.click()
					.catch(() => undefined);
				await settle(db, 900);
			}
			await db.keyboard.press("Escape").catch(() => undefined);
			await db
				.locator(".db-popover__backdrop")
				.click({ force: true })
				.catch(() => undefined);
			await settle(db, 700);
			const after = await gridColCount(db);
			await s.shot(db, "05-add-column");
			return verdict(
				"Add column adds a header",
				after > before,
				`cols ${before} → ${after} (Properties=${hadProps}, AddColumn=${hadAdd})`,
			);
		});

		// ── 6. Filter — assert rows reduce ───────────────────────────────────
		await probe(s, "add a filter", async () => {
			const before = await gridRowCount(db);
			await db
				.locator("#toolbar-filter")
				.click()
				.catch(() => undefined);
			await settle(db, 700);
			const menuUp = await db
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			// property → operator → (value) — walk the first option at each step.
			const pickedProp = await clickMenuItem(db, /.+/);
			await settle(db, 600);
			await clickMenuItem(db, /.+/).catch(() => false); // operator
			await settle(db, 600);
			await clickMenuItem(db, /.+/).catch(() => false); // value (if any)
			await settle(db, 900);
			await db.keyboard.press("Escape").catch(() => undefined);
			await settle(db, 700);
			const after = await gridRowCount(db);
			const filterBarVisible = await db
				.locator("#filter-bar")
				.isVisible()
				.catch(() => false);
			await s.shot(db, "06-filter");
			// PASS if rows reduced OR a filter chip is now shown (filter applied,
			// even if it happens to match all rows).
			return verdict(
				"filter applies",
				menuUp && (after < before || filterBarVisible),
				`menu=${menuUp}, propPicked=${pickedProp}, rows ${before} → ${after}, filterBar=${filterBarVisible}`,
			);
		});

		// Clear filter so the sort/inspector blocks see the full set.
		await probe(s, "clear filters", async () => {
			const clear = db.locator(".db-filter-bar__clear").first();
			const had = await clear.isVisible().catch(() => false);
			if (had) await clear.click().catch(() => undefined);
			await settle(db, 700);
			return unknown(
				"clear filters",
				`clear-button-present=${had}, rows now ${await gridRowCount(db)}`,
			);
		});

		// ── 7. Sort — assert order changes ───────────────────────────────────
		await probe(s, "change sort order", async () => {
			const firstBefore = (
				await db
					.locator(".dbv-grid__title-label, .dbv-grid__title-label--editable")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			await db
				.locator("#toolbar-sort")
				.click()
				.catch(() => undefined);
			await settle(db, 700);
			const menuUp = await db
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			await clickMenuItem(db, /.+/); // pick a sort property
			await settle(db, 800);
			await db.keyboard.press("Escape").catch(() => undefined);
			await settle(db, 700);
			const firstAfter = (
				await db
					.locator(".dbv-grid__title-label, .dbv-grid__title-label--editable")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			await s.shot(db, "07-sort");
			const filterBarVisible = await db
				.locator("#filter-bar")
				.isVisible()
				.catch(() => false);
			return verdict(
				"sort changes order",
				menuUp && (firstAfter !== firstBefore || filterBarVisible),
				`menu=${menuUp}, first row "${firstBefore}" → "${firstAfter}", sortChip=${filterBarVisible}`,
			);
		});

		// ── 8. Inspector — open on a row, assert props render, edit one ──────
		await probe(s, "open inspector on a row", async () => {
			const openBtn = db.locator(".dbv-grid__open").first();
			if (await openBtn.isVisible().catch(() => false)) await openBtn.click().catch(() => undefined);
			else {
				await db
					.locator("#header-btn-inspector")
					.click()
					.catch(() => undefined);
				await db
					.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
					.first()
					.click()
					.catch(() => undefined);
			}
			await settle(db, 900);
			const open =
				(await db
					.locator("#db-main")
					.getAttribute("data-inspector-open")
					.catch(() => "")) === "true";
			const props = await db
				.locator(".db-inspector__props dt")
				.count()
				.catch(() => 0);
			await s.shot(db, "08a-inspector-open");
			return verdict(
				"inspector opens with properties",
				open && props > 0,
				`inspector-open=${open}, property-rows=${props}`,
			);
		});

		await probe(s, "edit a property in the inspector", async () => {
			const cell = db
				.locator(
					".db-inspector__props .bs-cell-plain, .db-inspector__props .bs-cell-pill, .db-inspector__props .bs-cell-multiline",
				)
				.first();
			const had = await cell.isVisible().catch(() => false);
			if (!had) return unknown("inspector property edit", "no editable cell in inspector");
			const before = (await cell.innerText().catch(() => "")).trim();
			await cell.click().catch(() => undefined);
			await settle(db, 500);
			const input = db
				.locator(
					".db-inspector__props .bs-cell-plain-input, .db-inspector__props input, .db-inspector__props textarea",
				)
				.first();
			let editing = await input.isVisible().catch(() => false);
			const probeVal = `insp ${Date.now() % 10000}`;
			if (editing) {
				await input.fill(probeVal).catch(() => undefined);
				await db.keyboard.press("Enter").catch(() => undefined);
				await settle(db, 800);
			} else {
				// select/pill cell → opened a menu; pick a differing option.
				const menuUp = await db
					.locator(MENU)
					.first()
					.isVisible()
					.catch(() => false);
				editing = menuUp;
				if (menuUp) {
					await clickMenuItem(db, /.+/);
					await settle(db, 700);
				}
			}
			const after = (
				await db
					.locator(
						".db-inspector__props .bs-cell-plain, .db-inspector__props .bs-cell-pill, .db-inspector__props .bs-cell-multiline",
					)
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			await s.shot(db, "08b-inspector-edit");
			return verdict(
				"inspector property edit persists",
				editing && after !== before,
				`entered-edit=${editing}, "${before}" → "${after}"`,
			);
		});

		// ── 9. LINK / RELATION navigation (PRIORITY) ─────────────────────────
		// A relation cell holds a reference to another object; clicking its title
		// chip dispatches a cross-app open intent (openEntity) — observe a new app
		// window/tab opening for the target.
		await probe(s, "click a relation/link → opens the target object", async () => {
			const link = db
				.locator(
					".db-inspector__props .bs-cell-link-title, .dbv-grid__cell--editable .bs-cell-link-title",
				)
				.first();
			const had = await link.isVisible().catch(() => false);
			if (!had) {
				// Also try the inspector body text for an obvious relation row.
				return unknown("relation navigation", "no relation/link cell with a target present");
			}
			const target = (await link.innerText().catch(() => "")).trim();
			const windowsBefore = s.app.windows().length;
			await link.click().catch(() => undefined);
			await settle(db, 1500);
			const windowsAfter = s.app.windows().length;
			// Navigation succeeds either by opening a new window/tab OR by the
			// inspector now showing the target object's title.
			const inspTitle = (
				await db
					.locator("#inspector-title")
					.innerText()
					.catch(() => "")
			).trim();
			const navigated =
				windowsAfter > windowsBefore || (target.length > 0 && inspTitle.includes(target));
			await s.shot(db, "09-relation-nav");
			return verdict(
				"relation cell navigates to target",
				navigated,
				`target="${target}", windows ${windowsBefore} → ${windowsAfter}, inspectorTitle="${inspTitle}"`,
			);
		});

		// Close inspector to free the stage.
		await db
			.locator("#inspector-close")
			.click()
			.catch(() => undefined);
		await settle(db, 500);

		// ── 10. Search ───────────────────────────────────────────────────────
		await probe(s, "search rows", async () => {
			const before = await gridRowCount(db);
			await db
				.locator("#header-btn-search")
				.click()
				.catch(() => undefined);
			await settle(db, 600);
			const searchBox = db
				.locator(
					'[aria-label="Search rows"], [aria-label="Search"], #stage-body input[type="search"], input[type="search"]',
				)
				.first();
			const had = await searchBox.isVisible().catch(() => false);
			if (had) {
				await searchBox.fill("zzzzqqqq-no-match").catch(() => undefined);
				await settle(db, 900);
			}
			const after = await gridRowCount(db);
			await s.shot(db, "10-search");
			// A no-match query should drive rows toward 0.
			const ok = had && after < before;
			if (had) await searchBox.fill("").catch(() => undefined);
			await settle(db, 600);
			return verdict(
				"search filters rows",
				ok,
				`searchBox=${had}, rows ${before} → ${after} on no-match query`,
			);
		});

		// ── 11. LISTS "+" → Blank collection ─────────────────────────────────
		let newListName = "";
		await probe(s, "open LISTS + menu", async () => {
			await db
				.locator("#sidebar-new-list")
				.click()
				.catch(() => undefined);
			await settle(db, 700);
			const menuUp = await db
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			const hasBlank =
				(await db
					.locator(MENU_ITEM, { hasText: /Blank collection/i })
					.count()
					.catch(() => 0)) > 0;
			const hasFrom =
				(await db
					.locator(MENU_ITEM, { hasText: /From existing/i })
					.count()
					.catch(() => 0)) > 0;
			const hasCsv =
				(await db
					.locator(MENU_ITEM, { hasText: /Import from CSV/i })
					.count()
					.catch(() => 0)) > 0;
			await s.shot(db, "11a-new-list-menu");
			return verdict(
				"new-collection menu offers the three shapes",
				menuUp && hasBlank && hasFrom && hasCsv,
				`menu=${menuUp}, Blank=${hasBlank}, FromExisting=${hasFrom}, ImportCSV=${hasCsv}`,
			);
		});
		await probe(s, "create a Blank collection", async () => {
			const before = await db.locator(".db-sidebar__list-item").count();
			const clicked = await clickMenuItem(db, /Blank collection/i);
			await settle(db, 1200);
			const after = await db.locator(".db-sidebar__list-item").count();
			newListName = (
				await db
					.locator("#stage-title")
					.innerText()
					.catch(() => "")
			).trim();
			await s.shot(db, "11b-blank-collection");
			return verdict(
				"Blank collection appears in LISTS",
				clicked && after > before,
				`clicked=${clicked}, lists ${before} → ${after}, active title="${newListName}"`,
			);
		});

		// ── 12. Rename a collection (the new blank one) via #stage-title ─────
		const renamedTo = `Mira Sandbox ${Date.now() % 10000}`;
		await probe(s, "rename the collection", async () => {
			const title = db.locator("#stage-title");
			await title.click().catch(() => undefined);
			await db.keyboard.press("Meta+a").catch(() => undefined);
			await title.fill(renamedTo).catch(async () => {
				// contenteditable: selectAll + type
				await db.keyboard.press("Meta+a").catch(() => undefined);
				await db.keyboard.type(renamedTo).catch(() => undefined);
			});
			await db.keyboard.press("Enter").catch(() => undefined);
			await settle(db, 900);
			const headerTitle = (
				await db
					.locator("#stage-title")
					.innerText()
					.catch(() => "")
			).trim();
			const sidebarHas =
				(await db
					.locator(".db-sidebar__list-name", { hasText: renamedTo })
					.count()
					.catch(() => 0)) > 0;
			await s.shot(db, "12-renamed");
			return verdict(
				"collection rename persists",
				headerTitle.includes(renamedTo) || sidebarHas,
				`header="${headerTitle}", sidebarMatch=${sidebarHas}`,
			);
		});

		// ── 13. Header object ⋯ "More actions" menu ──────────────────────────
		await probe(s, "open header ⋯ More actions menu", async () => {
			const more = db
				.locator(
					'.app-header__right .bs-object-menu__more, .app-header__right [aria-label="More actions"]',
				)
				.first();
			const had = await more.isVisible().catch(() => false);
			if (had) await more.click().catch(() => undefined);
			await settle(db, 700);
			const menuUp = await db
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			const itemCount = await db
				.locator(MENU_ITEM)
				.count()
				.catch(() => 0);
			const items: string[] = [];
			for (let i = 0; i < Math.min(itemCount, 12); i++) {
				items.push(
					(
						await db
							.locator(MENU_ITEM)
							.nth(i)
							.innerText()
							.catch(() => "")
					).trim(),
				);
			}
			await s.shot(db, "13-header-more-menu");
			await db.keyboard.press("Escape").catch(() => undefined);
			return verdict(
				"header ⋯ opens an action menu",
				had && menuUp && itemCount > 0,
				`moreButton=${had}, menu=${menuUp}, items(${itemCount})=${JSON.stringify(items)}`,
			);
		});

		// ── 14. Persistence — switch lists and back ──────────────────────────
		await probe(s, "switch lists and back (persistence)", async () => {
			const items = db.locator(".db-sidebar__list-item");
			const n = await items.count();
			if (n < 2) return unknown("persistence", "need ≥2 lists to switch");
			const firstName = (
				await items
					.nth(0)
					.locator(".db-sidebar__list-name")
					.innerText()
					.catch(() => "")
			).trim();
			await items
				.nth(0)
				.click()
				.catch(() => undefined);
			await settle(db, 900);
			const titleA = (
				await db
					.locator("#stage-title")
					.innerText()
					.catch(() => "")
			).trim();
			// back to the renamed sandbox
			const back = db.locator(".db-sidebar__list-name", { hasText: renamedTo }).first();
			if (await back.isVisible().catch(() => false)) await back.click().catch(() => undefined);
			await settle(db, 900);
			const titleB = (
				await db
					.locator("#stage-title")
					.innerText()
					.catch(() => "")
			).trim();
			await s.shot(db, "14-persistence");
			return verdict(
				"list selection round-trips",
				titleA.includes(firstName) && titleB.includes(renamedTo),
				`to "${titleA}" then back to "${titleB}" (expected "${renamedTo}")`,
			);
		});

		// ── 15. Cleanup — delete the created row + the created collection ────
		await probe(s, "delete the probe row", async () => {
			// Navigate back to a list that holds the renamed probe row if it survived
			// in the original collection; otherwise delete from wherever it shows.
			const row = db.locator(`.dbv-grid__row:has-text("${NAME_PROBE}")`).first();
			const had = await row.isVisible().catch(() => false);
			if (!had)
				return unknown(
					"delete probe row",
					`probe row "${NAME_PROBE}" not in current view (may live in original collection)`,
				);
			const before = await gridRowCount(db);
			await row.click({ button: "right" }).catch(() => undefined);
			await settle(db, 700);
			const deleted = await clickMenuItem(db, /delete|remove/i);
			await settle(db, 600);
			// A confirm dialog may appear; click its confirm.
			await clickMenuItem(db, /delete|confirm|remove/i).catch(() => false);
			const confirm = db
				.locator('button:has-text("Delete"), [role="button"]:has-text("Delete")')
				.first();
			if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => undefined);
			await settle(db, 900);
			const after = await gridRowCount(db);
			await s.shot(db, "15a-row-deleted");
			return verdict(
				"probe row deleted",
				deleted && after < before,
				`menuItem=${deleted}, rows ${before} → ${after}`,
			);
		});

		await probe(s, "delete the created collection (cleanup)", async () => {
			// Right-click the renamed sandbox list in the sidebar → Delete.
			const sandbox = db
				.locator(".db-sidebar__list-item", {
					has: db.locator(".db-sidebar__list-name", { hasText: renamedTo }),
				})
				.first();
			const had = await sandbox.isVisible().catch(() => false);
			if (!had) return unknown("delete collection", `sandbox list "${renamedTo}" not found`);
			const before = await db.locator(".db-sidebar__list-item").count();
			await sandbox.click({ button: "right" }).catch(() => undefined);
			await settle(db, 700);
			const deleted = await clickMenuItem(db, /delete|remove/i);
			await settle(db, 600);
			const confirm = db
				.locator('button:has-text("Delete"), [role="button"]:has-text("Delete")')
				.first();
			if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => undefined);
			await settle(db, 1000);
			const after = await db.locator(".db-sidebar__list-item").count();
			const stillThere =
				(await db
					.locator(".db-sidebar__list-name", { hasText: renamedTo })
					.count()
					.catch(() => 0)) > 0;
			await s.shot(db, "15b-collection-deleted");
			return verdict(
				"created collection deleted",
				deleted && (after < before || !stillThere),
				`menuItem=${deleted}, lists ${before} → ${after}, stillListed=${stillThere}`,
			);
		});

		await s.shot(db, "16-final");
		s.note(
			"[?] session complete — review notes.md for the full PASS/FAIL/? matrix and the screenshots for visual confirmation.",
		);
	} finally {
		await s.finish();
	}
});
