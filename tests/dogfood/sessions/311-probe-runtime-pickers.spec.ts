/**
 * Probe 311 — verify the pickers migrated onto the shared runtime in PR #176
 * actually render + position + work in the REAL shell (jsdom can't: no layout,
 * and the runtime's list virtualizes so rows never paint in unit tests).
 *
 * Covers the new `openSearchPicker` (a filter-input-over-list, distinguished
 * from the slash typeahead by its `.fm-filter` input) at its three Notes call
 * sites — `/embed`, `/property`, Mod+K link — plus the select-field node's
 * runtime `CustomRow` + custom-footer add-input (`/select`).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const EDITOR = '.notes__body [contenteditable="true"]';
const MENU = ".fm-menu";
const FILTER = `${MENU} .fm-filter input`;

async function freshNoteBody(notes: import("@playwright/test").Page) {
	await notes
		.locator('[aria-label="New note"]')
		.first()
		.click()
		.catch(() => undefined);
	await notes.waitForTimeout(1200);
	await notes.locator(EDITOR).first().click();
	await notes.waitForTimeout(300);
}

/** Run a slash command by typing `/<kw>` then Enter on the slash menu. */
async function runSlash(notes: import("@playwright/test").Page, keyword: string) {
	await notes.keyboard.type(`/${keyword}`, { delay: 40 });
	await notes.waitForTimeout(500);
	await notes.keyboard.press("Enter");
	await notes.waitForTimeout(700);
}

test("probe: runtime search pickers + select-field (311)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("311-probe-runtime-pickers");
	const notes = await s.openApp(APP.Notes);
	await notes.waitForTimeout(2500);

	// ── /embed → openSearchPicker ────────────────────────────────────────
	await freshNoteBody(notes);
	await runSlash(notes, "embed");
	await notes
		.locator(FILTER)
		.first()
		.waitFor({ state: "visible", timeout: 7000 })
		.catch(() => undefined);
	const embedHasFilter = await notes
		.locator(FILTER)
		.first()
		.isVisible()
		.catch(() => false);
	const embedRows = await notes
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	s.note(`[probe] /embed picker: filterInput=${embedHasFilter}, rows=${embedRows}`);
	await s.shot(notes, "01-embed");
	await notes.keyboard.press("Escape");
	await notes.waitForTimeout(400);
	const embedClosed = !(await notes
		.locator(MENU)
		.first()
		.isVisible()
		.catch(() => false));

	// ── /property → openSearchPicker (with a "+ Create new" row) ──────────
	await freshNoteBody(notes);
	await runSlash(notes, "property");
	await notes
		.locator(FILTER)
		.first()
		.waitFor({ state: "visible", timeout: 7000 })
		.catch(() => undefined);
	const propHasFilter = await notes
		.locator(FILTER)
		.first()
		.isVisible()
		.catch(() => false);
	const propRows = await notes
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	s.note(`[probe] /property picker: filterInput=${propHasFilter}, rows=${propRows}`);
	await s.shot(notes, "02-property");
	await notes.keyboard.press("Escape");
	await notes.waitForTimeout(400);

	// ── Mod+K link → openSearchPicker (seeded by the selection) ───────────
	await freshNoteBody(notes);
	await notes.keyboard.type("Roadmap", { delay: 30 });
	await notes.keyboard.press("Meta+a");
	await notes.waitForTimeout(150);
	await notes.keyboard.press("Meta+k");
	await notes
		.locator(FILTER)
		.first()
		.waitFor({ state: "visible", timeout: 7000 })
		.catch(() => undefined);
	const linkHasFilter = await notes
		.locator(FILTER)
		.first()
		.isVisible()
		.catch(() => false);
	const linkRows = await notes
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	s.note(`[probe] Mod+K link picker: filterInput=${linkHasFilter}, rows=${linkRows}`);
	await s.shot(notes, "03-link-markup");
	await notes.keyboard.press("Escape");
	await notes.waitForTimeout(400);

	// ── /select → select-field node → runtime picker w/ footer add-input ──
	await freshNoteBody(notes);
	await runSlash(notes, "select");
	await notes.waitForTimeout(400);
	const chip = notes.locator(".notes__select-field-chip").first();
	const chipPresent = await chip.isVisible().catch(() => false);
	await chip.click().catch(() => undefined);
	await notes.waitForTimeout(500);
	const addInput = notes.locator(".notes__select-field-input").first();
	const addVisible = await addInput.isVisible().catch(() => false);
	await s.shot(notes, "04-select-field-open");
	// Add an option through the runtime footer, then confirm the chip adopts it.
	await addInput.click().catch(() => undefined);
	await notes.keyboard.type("Doing", { delay: 30 });
	await notes.keyboard.press("Enter");
	await notes.waitForTimeout(600);
	const chipText = await notes
		.locator(".notes__select-field-chip")
		.first()
		.innerText()
		.catch(() => "");
	s.note(
		`[probe] select-field: chip=${chipPresent}, addInput=${addVisible}, chipText=${JSON.stringify(chipText)}`,
	);
	await s.shot(notes, "05-select-field-picked");

	// ── Browser omnibox → openTypeaheadMenu (best-effort: needs history) ──
	const browser = await s.openApp(APP.Browser);
	await browser.waitForTimeout(2000);
	await browser
		.locator(".browser__omnibox")
		.first()
		.click()
		.catch(() => undefined);
	await browser.keyboard.type("a", { delay: 40 });
	await browser.waitForTimeout(800);
	const omniRows = await browser
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	s.note(`[probe] omnibox suggestions (history-dependent): rows=${omniRows}`);
	await s.shot(browser, "06-omnibox");

	// Hard assertions — the new-helper structural proof + select-field round-trip.
	expect(embedHasFilter, "/embed opens openSearchPicker (filter input renders)").toBe(true);
	expect(embedClosed, "Escape closes the /embed picker").toBe(true);
	expect(propHasFilter, "/property opens openSearchPicker (filter input renders)").toBe(true);
	expect(linkHasFilter, "Mod+K opens the link openSearchPicker (filter input renders)").toBe(true);
	expect(chipPresent, "/select inserts a select-field chip").toBe(true);
	expect(addVisible, "select-field picker renders its footer add-input").toBe(true);
	expect(chipText, "adding an option selects it on the chip").toContain("Doing");
});
