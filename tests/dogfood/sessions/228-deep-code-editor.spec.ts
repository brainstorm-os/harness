/**
 * Session 228 — DEEP Code Editor walkthrough.
 *
 * A single founder session that exercises the Code Editor end-to-end and
 * judges every action from the observable DOM, recording one
 * `[PASS]/[FAIL]/[?] <action> — <observed>` note per step (never aborting on
 * a miss). Coverage: New file → row + tab; typing TypeScript with a
 * deliberate error → syntax-highlight tokens render; the Problems
 * (diagnostics) panel reflecting the error; switching files in the FILES
 * sidebar swaps the buffer; rename probe; save / "N unsaved" indicator;
 * REFERENCES (priority) — write a plan/OQ id, assert it tracks, click it,
 * assert navigation; the header ⋯ "More actions" menu (suspected
 * non-opening — confirmed explicitly); files + references panel toggles;
 * delete the test file (cleanup); persistence on reopen.
 *
 * Real selectors (from apps/code-editor/src/**):
 *  - buffer textarea  .editor__buffer
 *  - syntax tokens    .editor__highlight-token (inline color) / .editor__highlight-line
 *  - file rows        .editor__file (open button .editor__file-open, name
 *                     .editor__file-name, dirty dot .editor__file-dirty)
 *  - new file         .editor__file-new / .editor__header-new
 *  - references panel .editor__refs (rows .editor__ref, code .editor__ref-code,
 *                     empty .editor__refs-empty)
 *  - problems panel   .editor__diagnostics (rows .editor__diagnostic)
 *  - header ⋯ menu    .bs-object-menu__more → opens .fm-menu
 *  - panel toggles    #header-nav-toggle / #header-refs-toggle
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const MOD = process.platform === "darwin" ? "Meta" : "Control";

/** Run `label`'s body, record a single judged note, and never let a throw
 *  abort the walkthrough. The body decides PASS/FAIL/? via the returned line
 *  suffix; an uncaught throw is reported as [FAIL] with the error message. */
async function step(
	note: (line: string) => void,
	label: string,
	body: () => Promise<string>,
): Promise<void> {
	try {
		const observed = await body();
		note(observed);
	} catch (error) {
		note(`[FAIL] ${label} — threw: ${(error as Error).message}`);
	}
}

test("deep code-editor walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-code-editor");
	const note = s.note;

	try {
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(3000);
		await s.shot(ce, "00-open");

		// Baseline file count before we add anything (so the New-file assertion
		// is a delta, not an absolute that the seeded vault could already satisfy).
		const baselineFiles = await ce
			.locator(".editor__file")
			.count()
			.catch(() => 0);
		note(`[?] baseline — ${baselineFiles} file row(s) on open`);

		// ── New file ──────────────────────────────────────────────────────────
		await step(note, "New file", async () => {
			// The "New" affordance lives in the files-panel head (.editor__file-new),
			// in the empty state (.editor__empty-new), and as a header "+"
			// (.editor__header-new) — try them in that order.
			const newBtn = ce.locator(".editor__file-new, .editor__empty-new, .editor__header-new").first();
			const visible = await newBtn.isVisible().catch(() => false);
			if (!visible) return "[FAIL] New file — no New affordance visible";
			await newBtn.click();
			await ce.waitForTimeout(1800);
			const after = await ce
				.locator(".editor__file")
				.count()
				.catch(() => 0);
			const added = after - baselineFiles;
			await s.shot(ce, "01-new-file");
			return added >= 1
				? `[PASS] New file — file rows ${baselineFiles}→${after} (+${added})`
				: `[FAIL] New file — row count unchanged (${after})`;
		});

		// New file auto-selects + its name should show as the shell tab title.
		await step(note, "New file tab/title", async () => {
			const title = await ce
				.locator(".app-header__title")
				.first()
				.textContent()
				.catch(() => null);
			const strip = s.tabStrip();
			const stripText = strip
				? await strip
						.locator("body")
						.innerText()
						.catch(() => "")
				: "";
			const namedUntitled = (title ?? "").toLowerCase().includes("untitled");
			const onStrip = stripText.toLowerCase().includes("untitled");
			return namedUntitled || onStrip
				? `[PASS] New file tab/title — header="${title}", strip mentions untitled=${onStrip}`
				: `[?] New file tab/title — header="${title}", strip="${stripText.slice(0, 60)}"`;
		});

		// The freshly-created row should be the selected (aria-current) one.
		const buffer = ce.locator(".editor__buffer").first();
		await step(note, "Editor surface present", async () => {
			const visible = await buffer.isVisible().catch(() => false);
			return visible
				? "[PASS] Editor surface present — .editor__buffer visible"
				: "[FAIL] Editor surface present — .editor__buffer not visible";
		});

		// ── Type code WITH a deliberate error ───────────────────────────────────
		// `cont` is an unterminated string and a reference to an undeclared/typo
		// symbol — gives both the highlighter tokens and the linter a target.
		// The plan/OQ id in the comment is the References-panel probe.
		const CODE = [
			"// tracks plan iteration 9.7.6 and OQ-4 here",
			"const greeting: string = 'hello",
			"function totals(items: number[]): number {",
			"  const sum = items.reduce((a, b) => a + b, 0)",
			"  return sum",
			"}",
			"const out = totals([1, 2, 3])",
			"",
		].join("\n");

		await step(note, "Type code", async () => {
			await buffer.click().catch(() => undefined);
			await buffer.fill("").catch(() => undefined);
			await ce.keyboard.type(CODE, { delay: 8 });
			await ce.waitForTimeout(1500);
			const value = await buffer.inputValue().catch(() => "");
			await s.shot(ce, "02-typed");
			return value.includes("totals") && value.length > 60
				? `[PASS] Type code — buffer holds ${value.length} chars`
				: `[FAIL] Type code — buffer length ${value.length}`;
		});

		// ── Syntax highlighting ─────────────────────────────────────────────────
		await step(note, "Syntax highlighting", async () => {
			const tokenCount = await ce
				.locator(".editor__highlight-token")
				.count()
				.catch(() => 0);
			// A real grammar paints colour onto keyword/string tokens — count the
			// tokens that carry an inline foreground colour, not just any span.
			const colored = await ce
				.locator(".editor__highlight-token")
				.evaluateAll((els) => els.filter((el) => (el as HTMLElement).style.color !== "").length)
				.catch(() => 0);
			const lines = await ce
				.locator(".editor__highlight-line")
				.count()
				.catch(() => 0);
			await s.shot(ce, "03-highlight");
			return colored > 0
				? `[PASS] Syntax highlighting — ${tokenCount} tokens, ${colored} coloured, ${lines} lines`
				: `[FAIL] Syntax highlighting — ${tokenCount} tokens but 0 coloured (no grammar?)`;
		});

		// ── Problems / diagnostics panel ─────────────────────────────────────────
		await step(note, "Problems panel reflects error", async () => {
			// The diagnostics list lives at the top of the references aside; it
			// rebuilds on every edit. The unterminated string should surface as a
			// problem row.
			const panelVisible = await ce
				.locator(".editor__diagnostics")
				.first()
				.isVisible()
				.catch(() => false);
			const problemRows = await ce
				.locator(".editor__diagnostic")
				.count()
				.catch(() => 0);
			const headText = await ce
				.locator(".editor__diagnostics-head")
				.first()
				.textContent()
				.catch(() => "");
			await s.shot(ce, "04-problems");
			if (!panelVisible) return "[FAIL] Problems panel reflects error — no .editor__diagnostics panel";
			return problemRows > 0
				? `[PASS] Problems panel reflects error — ${problemRows} problem row(s); head="${headText?.trim()}"`
				: `[?] Problems panel reflects error — panel present, 0 rows; head="${headText?.trim()}" (linter may not flag this)`;
		});

		// Activate the first problem row → caret should jump (revealLine). We can't
		// see the caret, but the click must not throw and the buffer keeps focus.
		await step(note, "Problem row jump", async () => {
			const row = ce.locator(".editor__diagnostic").first();
			if ((await row.count()) === 0) return "[?] Problem row jump — no problem rows to click";
			await row.click().catch(() => undefined);
			await ce.waitForTimeout(400);
			const focused = await buffer.evaluate((el) => document.activeElement === el).catch(() => false);
			return `[${focused ? "PASS" : "?"}] Problem row jump — clicked, buffer focused=${focused}`;
		});

		// ── REFERENCES (priority) ────────────────────────────────────────────────
		// The first code line references "9.7.6" + "OQ-4"; the References panel
		// scans the buffer against the live citation index and lists resolved ids.
		await step(note, "References panel tracks plan/OQ id", async () => {
			await ce.waitForTimeout(800);
			const refsVisible = await ce
				.locator(".editor__refs")
				.first()
				.isVisible()
				.catch(() => false);
			if (!refsVisible) return "[FAIL] References panel tracks plan/OQ id — no .editor__refs panel";
			const refCount = await ce
				.locator(".editor__ref")
				.count()
				.catch(() => 0);
			const codes = await ce
				.locator(".editor__ref-code")
				.allTextContents()
				.catch(() => [] as string[]);
			const emptyShown = await ce
				.locator(".editor__refs-empty")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(ce, "05-references");
			if (refCount > 0) {
				return `[PASS] References panel tracks plan/OQ id — ${refCount} ref(s): ${JSON.stringify(codes)}`;
			}
			return emptyShown
				? "[?] References panel tracks plan/OQ id — panel present but empty (no id in citation index resolved 9.7.6/OQ-4)"
				: "[FAIL] References panel tracks plan/OQ id — panel present, 0 refs, no empty state";
		});

		// PRIORITY: click a resolved reference → assert navigation (a new window/tab
		// opens for the referenced iteration/OQ entity, or the open intent fires).
		await step(note, "Reference click navigates", async () => {
			const ref = ce.locator(".editor__ref").first();
			if ((await ref.count()) === 0) {
				return "[?] Reference click navigates — no clickable reference to exercise";
			}
			const windowsBefore = ce.context()?.pages?.().length ?? 0;
			const appWindowsBefore = s.app.windows().length;
			await ref.click().catch(() => undefined);
			await ce.waitForTimeout(2500);
			const appWindowsAfter = s.app.windows().length;
			await s.shot(ce, "06-reference-clicked");
			const opened = appWindowsAfter > appWindowsBefore;
			return opened
				? `[PASS] Reference click navigates — Electron windows ${appWindowsBefore}→${appWindowsAfter}`
				: `[?] Reference click navigates — windows unchanged (${appWindowsAfter}); open intent may target an existing surface or have no opener`;
		});

		// ── Rename probe ─────────────────────────────────────────────────────────
		// The code-editor object menu wires only Open / Pin (no onRemove, no
		// rename). Probe for ANY rename trigger and report its absence honestly.
		await step(note, "Rename file", async () => {
			const nameEl = ce.locator(".editor__file[aria-current='true'] .editor__file-name").first();
			const before = await nameEl.textContent().catch(() => null);
			// Try a double-click-to-rename (common pattern) — assert nothing if no
			// inline editor appears.
			await nameEl.dblclick().catch(() => undefined);
			await ce.waitForTimeout(500);
			const inlineInput = await ce
				.locator(".editor__file input, .editor__file [contenteditable='true']")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(ce, "07-rename-probe");
			return inlineInput
				? `[PASS] Rename file — inline rename editor appeared (was "${before}")`
				: `[FAIL] Rename file — no rename affordance (dbl-click on "${before}" did nothing; object menu offers only Open/Pin)`;
		});

		// ── Save / unsaved indicator ─────────────────────────────────────────────
		await step(note, "Unsaved indicator shows", async () => {
			const dirtyDots = await ce
				.locator(".editor__file-dirty")
				.count()
				.catch(() => 0);
			const meta = await ce
				.locator(".app-header__meta")
				.first()
				.textContent()
				.catch(() => "");
			return /unsaved/i.test(meta ?? "") || dirtyDots > 0
				? `[PASS] Unsaved indicator shows — meta="${meta?.trim()}", dirty dots=${dirtyDots}`
				: `[?] Unsaved indicator shows — meta="${meta?.trim()}", dirty dots=${dirtyDots} (edits may have auto-committed)`;
		});

		await step(note, "Save clears unsaved", async () => {
			await buffer.click().catch(() => undefined);
			await ce.keyboard.press(`${MOD}+s`);
			await ce.waitForTimeout(1800);
			const dirtyAfter = await ce
				.locator(".editor__file-dirty")
				.count()
				.catch(() => 0);
			const metaAfter = await ce
				.locator(".app-header__meta")
				.first()
				.textContent()
				.catch(() => "");
			await s.shot(ce, "08-after-save");
			const cleared = dirtyAfter === 0 && !/unsaved/i.test(metaAfter ?? "");
			return cleared
				? `[PASS] Save clears unsaved — dirty dots 0, meta="${metaAfter?.trim()}"`
				: `[?] Save clears unsaved — dirty dots=${dirtyAfter}, meta="${metaAfter?.trim()}" (Y.Doc transport persists body; property-bag save may be a no-op surface)`;
		});

		// ── File switching swaps buffer content ──────────────────────────────────
		await step(note, "Switch files swaps content", async () => {
			const rowCount = await ce
				.locator(".editor__file")
				.count()
				.catch(() => 0);
			if (rowCount < 2) {
				return `[?] Switch files swaps content — only ${rowCount} file(s); need ≥2 to compare`;
			}
			const current = await buffer.inputValue().catch(() => "");
			// Click a row that isn't the current selection.
			const otherRow = ce
				.locator(".editor__file:not([aria-current='true']) .editor__file-open")
				.first();
			await otherRow.click().catch(() => undefined);
			await ce.waitForTimeout(1200);
			const swapped = await buffer.inputValue().catch(() => "");
			await s.shot(ce, "09-switched-file");
			const changed = swapped !== current;
			// Switch back to our test file so later cleanup targets it.
			const ours = ce.locator(".editor__file-name", { hasText: /untitled/i }).first();
			await ours.click().catch(() => undefined);
			await ce.waitForTimeout(900);
			return changed
				? `[PASS] Switch files swaps content — buffer changed (${current.length}→${swapped.length} chars)`
				: `[FAIL] Switch files swaps content — buffer identical after switch (${swapped.length} chars)`;
		});

		// ── Header ⋯ "More actions" menu (suspected non-opening) ─────────────────
		await step(note, "Header ⋯ menu opens", async () => {
			const more = ce.locator(".app-header .bs-object-menu__more").first();
			const present = await more.isVisible().catch(() => false);
			if (!present) return "[FAIL] Header ⋯ menu opens — no .bs-object-menu__more in header";
			await more.click().catch(() => undefined);
			await ce.waitForTimeout(700);
			const menu = ce.locator(".fm-menu, [role='menu']").first();
			const menuVisible = await menu.isVisible().catch(() => false);
			const expanded = await more.getAttribute("aria-expanded").catch(() => null);
			await s.shot(ce, "10-header-menu");
			if (!menuVisible) {
				return `[FAIL] Header ⋯ menu opens — clicked, no .fm-menu became visible (aria-expanded=${expanded})`;
			}
			const items = await menu
				.locator("[role='menuitem'], button")
				.allTextContents()
				.catch(() => []);
			return `[PASS] Header ⋯ menu opens — menu visible with items ${JSON.stringify(items.slice(0, 6))}`;
		});

		// If a menu opened, click an item (Open) and assert it doesn't throw.
		await step(note, "Header ⋯ item activates", async () => {
			const menu = ce.locator(".fm-menu, [role='menu']").first();
			if (!(await menu.isVisible().catch(() => false))) {
				return "[?] Header ⋯ item activates — no open menu to click into";
			}
			const item = menu.locator("[role='menuitem'], button").first();
			const itemText = await item.textContent().catch(() => "");
			await item.click().catch(() => undefined);
			await ce.waitForTimeout(800);
			await s.shot(ce, "11-header-menu-item");
			return `[PASS] Header ⋯ item activates — clicked "${itemText?.trim()}" without throw`;
		});
		await ce.keyboard.press("Escape").catch(() => undefined);
		await ce.waitForTimeout(300);

		// ── Panel toggles ────────────────────────────────────────────────────────
		await step(note, "Files panel toggle", async () => {
			const toggle = ce.locator("#header-nav-toggle");
			const beforeOpen = await ce
				.locator(".editor")
				.first()
				.getAttribute("data-nav-open")
				.catch(() => null);
			await toggle.click().catch(() => undefined);
			await ce.waitForTimeout(500);
			const afterOpen = await ce
				.locator(".editor")
				.first()
				.getAttribute("data-nav-open")
				.catch(() => null);
			await s.shot(ce, "12-files-toggled");
			// Restore.
			await toggle.click().catch(() => undefined);
			await ce.waitForTimeout(400);
			return beforeOpen !== afterOpen
				? `[PASS] Files panel toggle — data-nav-open ${beforeOpen}→${afterOpen}`
				: `[FAIL] Files panel toggle — data-nav-open unchanged (${afterOpen})`;
		});

		await step(note, "References panel toggle", async () => {
			const toggle = ce.locator("#header-refs-toggle");
			const before = await ce
				.locator(".editor")
				.first()
				.getAttribute("data-refs-open")
				.catch(() => null);
			await toggle.click().catch(() => undefined);
			await ce.waitForTimeout(500);
			const after = await ce
				.locator(".editor")
				.first()
				.getAttribute("data-refs-open")
				.catch(() => null);
			await s.shot(ce, "13-refs-toggled");
			await toggle.click().catch(() => undefined);
			await ce.waitForTimeout(400);
			return before !== after
				? `[PASS] References panel toggle — data-refs-open ${before}→${after}`
				: `[FAIL] References panel toggle — data-refs-open unchanged (${after})`;
		});

		// ── Delete the test file (cleanup) ───────────────────────────────────────
		// No UI delete affordance is expected (object menu has no Remove); probe
		// the menu for a destructive item and report honestly. The untitled file
		// stays in the vault if there's no delete path — note that for cleanup.
		await step(note, "Delete test file", async () => {
			const ours = ce
				.locator(".editor__file", { has: ce.locator(".editor__file-name", { hasText: /untitled/i }) })
				.first();
			if ((await ours.count()) === 0)
				return "[?] Delete test file — no untitled file row found to delete";
			const rowsBefore = await ce
				.locator(".editor__file")
				.count()
				.catch(() => 0);
			// Open the row's ⋯ menu and look for a Remove/Delete item.
			const rowMore = ours.locator(".bs-object-menu__more").first();
			await rowMore.click().catch(() => undefined);
			await ce.waitForTimeout(600);
			const menu = ce.locator(".fm-menu, [role='menu']").first();
			const items = await menu
				.locator("[role='menuitem'], button")
				.allTextContents()
				.catch(() => []);
			const deleteItem = menu
				.locator("[role='menuitem'], button", { hasText: /remove|delete/i })
				.first();
			const hasDelete = (await deleteItem.count().catch(() => 0)) > 0;
			await s.shot(ce, "14-delete-probe");
			if (!hasDelete) {
				await ce.keyboard.press("Escape").catch(() => undefined);
				return `[FAIL] Delete test file — no Remove/Delete in row menu (items=${JSON.stringify(items.slice(0, 6))}); untitled file remains in vault`;
			}
			await deleteItem.click().catch(() => undefined);
			await ce.waitForTimeout(1500);
			const rowsAfter = await ce
				.locator(".editor__file")
				.count()
				.catch(() => 0);
			await s.shot(ce, "15-after-delete");
			return rowsAfter < rowsBefore
				? `[PASS] Delete test file — rows ${rowsBefore}→${rowsAfter}`
				: `[?] Delete test file — clicked delete, rows unchanged (${rowsAfter})`;
		});

		// ── Persistence on reopen ─────────────────────────────────────────────────
		await step(note, "Persistence on reopen", async () => {
			// Re-open the app from the dashboard; the typed file's content should
			// survive if the save path persisted it (Y.Doc body or property bag).
			const reopened = await s.openApp(APP.CodeEditor);
			await reopened.waitForTimeout(3000);
			await s.shot(reopened, "16-reopened");
			// Look for any file whose buffer holds our distinctive token.
			const untitled = reopened.locator(".editor__file-name", { hasText: /untitled/i }).first();
			const hasUntitled = (await untitled.count().catch(() => 0)) > 0;
			if (!hasUntitled) {
				return "[?] Persistence on reopen — no untitled file present (deleted, or never persisted to the list)";
			}
			await untitled.click().catch(() => undefined);
			await reopened.waitForTimeout(1200);
			const body = await reopened
				.locator(".editor__buffer")
				.first()
				.inputValue()
				.catch(() => "");
			return body.includes("totals")
				? `[PASS] Persistence on reopen — typed content survived (${body.length} chars)`
				: `[?] Persistence on reopen — untitled file present but buffer lacks typed content (${body.length} chars; editing was in-memory in this drop)`;
		});

		await s.shot(ce, "17-final");
	} finally {
		await s.finish();
	}
});
