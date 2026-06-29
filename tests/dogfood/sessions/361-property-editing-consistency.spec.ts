/**
 * Session 361 — property-editing consistency audit.
 *
 * The user's worry: every app reinvents property editing. Properties are the
 * SAME concept everywhere (Block-Protocol entity `values`); only the RENDERING
 * should differ — the *editing* interaction must be identical. The SDK already
 * ships that contract: `<PropertiesPanel>` chrome (`.bs-props` rows) whose value
 * column is resolved through the `getCell(valueType, view)` registry in
 * `@brainstorm/sdk/property-ui` (text/number/date/tag/link/checkbox/… editors).
 *
 * This session opens every property-bearing app, drills into its first object to
 * surface the inspector, then for each app captures:
 *   -1-detail : the inspector / detail pane (read the property rows)
 *   -2-edit   : the editor that appears when a property VALUE cell is clicked
 *               (the affordance under scrutiny — popover vs inline vs nothing)
 *
 * It also records, per app, machine-readable signal so the report isn't purely
 * eyeballed: whether the pane uses the shared `.bs-props` chrome, how many
 * shared `.bs-cell-*` editors it mounts, and whether clicking a value opened a
 * shared editor (input / fancy-menu / date pop). An app showing property rows
 * with ZERO `.bs-cell-*` is hand-rolling; an app where clicking a value does
 * nothing is read-only (legitimate for files/preview, a gap elsewhere).
 *
 * Asserts nothing subjective — screenshots + notes are the deliverable. OOM-safe.
 */

import { type Locator, type Page, test } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

const PROP_APPS: ReadonlyArray<{ id: AppId; name: string }> = [
	{ id: APP.Database, name: "Database" },
	{ id: APP.Tasks, name: "Tasks" },
	{ id: APP.Contacts, name: "Contacts" },
	{ id: APP.Bookmarks, name: "Bookmarks" },
	{ id: APP.Books, name: "Books" },
	{ id: APP.Notes, name: "Notes" },
	{ id: APP.Journal, name: "Journal" },
	{ id: APP.Files, name: "Files" },
	{ id: APP.Preview, name: "Preview" },
	{ id: APP.Calendar, name: "Calendar" },
];

/** Drill into the first content object so an inspector/detail pane appears. */
const ITEM_SELECTORS = [
	".db-sidebar__list-item",
	"[role='row']",
	"[role='option']",
	".bs-list-row",
	".notes__list-item",
	".tasks-row",
	".task-row",
	".bookmarks__row",
	".files__row",
	".contacts-row",
	".books__library-item",
	".cal-chip",
	"[data-task-id]",
	"[data-entity-id]",
	".bs-card",
];

/** The inspector renders its property rows in the DOM even while the pane is
 *  collapsed, so presence isn't enough — gate on VISIBILITY. */
async function propsVisible(page: Page): Promise<boolean> {
	const p = page.locator(".bs-props, .inspector-properties, [class*='bs-cell-']").first();
	return (await p.count().catch(() => 0)) > 0 && (await p.isVisible().catch(() => false));
}

/** Inspectors live behind a header panel-toggle (`.bs-panel-toggle`) or a
 *  labelled button. Click candidates until a property pane is actually shown. */
async function ensureInspector(page: Page): Promise<void> {
	if (await propsVisible(page)) return;
	const candidates = [
		".app-header [aria-label*='roperties']",
		".app-header [aria-label*='nspector']",
		".app-header [aria-label*='etail']",
		".app-header .bs-panel-toggle",
	];
	for (const sel of candidates) {
		const toggles = page.locator(sel);
		const n = await toggles.count().catch(() => 0);
		for (let i = 0; i < n; i++) {
			const t = toggles.nth(i);
			if (!(await t.isVisible().catch(() => false))) continue;
			await t.click().catch(() => undefined);
			await page.waitForTimeout(700);
			if (await propsVisible(page)) return;
		}
	}
}

async function captureApp(s: FounderSession, page: Page, name: string): Promise<void> {
	const slug = name.toLowerCase().replace(/\s+/g, "-");
	await page.waitForTimeout(2200);

	// Drill into the first object.
	for (const sel of ITEM_SELECTORS) {
		const item = page.locator(sel).first();
		if ((await item.count().catch(() => 0)) > 0 && (await item.isVisible().catch(() => false))) {
			await item.click().catch(() => undefined);
			await page.waitForTimeout(1100);
			break;
		}
	}
	await ensureInspector(page);
	await page.waitForTimeout(400);
	await s.shot(page, `${slug}-1-detail`);

	// Machine signal: shared chrome + shared editor cells present?
	const hasProps = (await page.locator(".bs-props").count().catch(() => 0)) > 0;
	const propRows = await page.locator(".bs-props__row").count().catch(() => 0);
	const cells = await page.locator("[class*='bs-cell-']").count().catch(() => 0);
	s.note(
		`[i] ${name}: .bs-props=${hasProps} rows=${propRows} sharedCells(.bs-cell-*)=${cells}`,
	);
	if (propRows > 0 && cells === 0) {
		s.note(`[!] ${name}: ${propRows} property rows but ZERO shared cells — hand-rolled value column?`);
	}

	// Try to EDIT: click the first VISIBLE value cell and see what opens.
	const valueCells = page.locator(".bs-props__row-value, [class*='bs-cell-']");
	let valueCell: Locator | null = null;
	const cn = await valueCells.count().catch(() => 0);
	for (let i = 0; i < cn; i++) {
		const c = valueCells.nth(i);
		if (await c.isVisible().catch(() => false)) {
			valueCell = c;
			break;
		}
	}
	if (valueCell) {
		await valueCell.scrollIntoViewIfNeeded().catch(() => undefined);
		await valueCell.click().catch(() => undefined);
		await page.waitForTimeout(700);
		const openedInput =
			(await page.locator(".bs-cell-input, .bs-cell-multiline-input, input:focus, textarea:focus").count().catch(() => 0)) > 0;
		const openedMenu = (await page.locator(".bs-menu, .bs-cell-date-pop, [role='listbox']").count().catch(() => 0)) > 0;
		s.note(`[i] ${name}: click value → input=${openedInput} menu/pop=${openedMenu}`);
		if (!openedInput && !openedMenu) {
			s.note(`[?] ${name}: clicking a property value opened no editor (read-only or non-standard).`);
		}
		await s.shot(page, `${slug}-2-edit`);
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(200);
	} else {
		s.note(`[?] ${name}: no VISIBLE value cell found to edit.`);
	}
}

test("property-editing consistency across apps (361)", async () => {
	test.setTimeout(1_800_000);
	const s = await startSession("361-property-editing-consistency");

	await s.app.evaluate(({ dialog }) => {
		dialog.showOpenDialog = (async () => ({ canceled: true, filePaths: [] })) as typeof dialog.showOpenDialog;
		dialog.showSaveDialog = (async () => ({ canceled: true, filePath: undefined })) as typeof dialog.showSaveDialog;
	});

	try {
		for (const appDef of PROP_APPS) {
			s.note(`\n## ${appDef.name}`);
			let page: Page | null = null;
			try {
				page = await s.openApp(appDef.id);
			} catch (error) {
				s.note(`[FAIL] ${appDef.name} did not open: ${(error as Error).message}`);
				continue;
			}
			if (!page) continue;
			page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
			page.setDefaultTimeout(4000);
			const errs = collectConsoleErrors(page);
			try {
				await captureApp(s, page, appDef.name);
			} catch (error) {
				s.note(`[!] ${appDef.name} capture aborted: ${(error as Error).message}`);
			}
			if (errs.errors.length > 0) {
				s.note(`[?] ${appDef.name} console errors (${errs.errors.length}):`);
				for (const e of errs.errors.slice(0, 4)) s.note(`    ${e}`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(250).catch(() => undefined);
		}
	} finally {
		await s.finish();
	}
});

/**
 * Calendar is the one app whose object editor does NOT route through the shared
 * property system (Event isn't a property-bearing entity yet — OQ-DM). Its
 * event-detail form hand-rolls a custom RadioGroup for Status/Color (vs the
 * vocabulary-backed TagCell single-select everyone else uses) and a custom
 * DateTimeField. Capture it directly by opening an event chip so the divergence
 * is visible next to the shared panels above.
 */
test("calendar event-detail divergence (361b)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("361b-calendar-event-form");
	try {
		const page = await s.openApp(APP.Calendar);
		const errs = collectConsoleErrors(page);
		await page.waitForTimeout(2400);
		const chip = page.locator(".cal-chip").first();
		if ((await chip.count().catch(() => 0)) > 0) {
			await chip.click().catch(() => undefined);
			await page.waitForTimeout(1200);
		} else {
			s.note("[?] no event chip found; capturing the new-event form via +");
			await page.locator(".app-header [aria-label*='vent'], .app-header button:has-text('+')").first().click().catch(() => undefined);
			await page.waitForTimeout(1000);
		}
		const radios = await page.locator("[role='radiogroup'], .cal-radio, [role='radio']").count().catch(() => 0);
		const sharedCells = await page.locator("[class*='bs-cell-']").count().catch(() => 0);
		s.note(`[i] Calendar event form: custom radiogroup/radio nodes=${radios} sharedCells(.bs-cell-*)=${sharedCells}`);
		s.note(radios > 0 ? "[!] confirms hand-rolled RadioGroup, not the shared TagCell single-select" : "[i] no radiogroup surfaced");
		await s.shot(page, "calendar-event-detail");
		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 4)) s.note(`    ${e}`);
		await page.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
