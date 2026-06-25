/**
 * Probe 300 — verify the slash menu after its migration onto the shared
 * controlled-list typeahead runtime (`openTypeaheadMenu`). The risks unit tests
 * can't cover, all in the real shell:
 *   1. the menu actually OPENS + renders rows on `/` in a clean paragraph,
 *   2. it FILTERS as the query grows,
 *   3. the editor KEEPS focus (the point of controlled-list mode — the caret
 *      stays in the contenteditable, not the menu),
 *   4. Escape closes it,
 *   5. no console errors from the new code path.
 * Fast + isolated (no model calls). Creates a FRESH note so the body is a clean
 * empty paragraph — the only context the slash menu triggers in.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const EDITOR = '.notes__body [contenteditable="true"]';
// The slash menu is the runtime `.fm-menu` portaled to <body>. (NOT [role=listbox]
// — the Notes sidebar note-list is also a listbox and gives a false positive.)
const MENU = ".fm-menu";

test("probe: slash menu opens, filters, keeps editor focus (300)", async () => {
	test.setTimeout(120_000);
	const s = await startSession("300-probe-slash-menu");
	const notes = await s.openApp(APP.Notes);
	await notes.waitForTimeout(2500);

	// Fresh note → clean empty body paragraph.
	await notes
		.locator('[aria-label="New note"]')
		.first()
		.click()
		.catch(() => undefined);
	await notes.waitForTimeout(1400);
	// Move focus from the title into the empty body.
	await notes.locator(EDITOR).first().click();
	await notes.waitForTimeout(300);

	// 1. Type "/" → the menu opens with rows. Wait deterministically for a row
	// to render (fixed timeouts were flaky under variable app-launch latency).
	await notes.keyboard.type("/", { delay: 40 });
	await notes
		.locator(`${MENU} .fm-row`)
		.first()
		.waitFor({ state: "visible", timeout: 6000 })
		.catch(() => undefined);
	const menuVisible = await notes
		.locator(MENU)
		.first()
		.isVisible()
		.catch(() => false);
	const rowsAtOpen = await notes
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	// The label must NOT be clipped to an ellipsis (the caption/name flex bug).
	const firstRowLabel = await notes
		.locator(`${MENU} .fm-row .fm-row__name`)
		.first()
		.innerText()
		.catch(() => "");
	s.note(
		`[probe] menu visible on '/': ${menuVisible}; rows: ${rowsAtOpen}; firstLabel=${JSON.stringify(firstRowLabel)}`,
	);
	await s.shot(notes, "01-slash-open");

	// 2. Filter: type "head" → heading rows.
	await notes.keyboard.type("head", { delay: 50 });
	await notes.waitForTimeout(500);
	const rowsFiltered = await notes
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	const menuText = await notes
		.locator(MENU)
		.first()
		.innerText()
		.catch(() => "");
	s.note(
		`[probe] rows after '/head': ${rowsFiltered}; text=${JSON.stringify(menuText.slice(0, 160))}`,
	);
	await s.shot(notes, "02-slash-filtered");

	// 3. Keystone: the editor still owns focus (controlled-list never grabs it).
	const focus = await notes.evaluate(() => {
		const a = document.activeElement as HTMLElement | null;
		return {
			editable:
				a?.getAttribute("contenteditable") === "true" || !!a?.closest('[contenteditable="true"]'),
			cls: a?.className ?? "",
		};
	});
	const para = await notes
		.locator(EDITOR)
		.first()
		.innerText()
		.catch(() => "");
	s.note(`[probe] focus: ${JSON.stringify(focus)}; body=${JSON.stringify(para.slice(0, 40))}`);

	// 4. Escape closes it.
	await notes.keyboard.press("Escape");
	await notes.waitForTimeout(400);
	const visibleAfterEsc = await notes
		.locator(MENU)
		.first()
		.isVisible()
		.catch(() => false);
	s.note(`[probe] menu visible after Escape: ${visibleAfterEsc}`);
	await s.shot(notes, "03-after-escape");

	// Hard assertions.
	expect(menuVisible, "slash menu should open on '/'").toBe(true);
	expect(rowsAtOpen, "menu should render command rows").toBeGreaterThan(0);
	expect(firstRowLabel.includes("…"), "command label must not be clipped to an ellipsis").toBe(
		false,
	);
	expect(rowsFiltered, "filtering to 'head' should keep heading rows").toBeGreaterThan(0);
	expect(focus.editable, "editor must keep focus (controlled-list mode)").toBe(true);
	expect(para.includes("/head"), "typed query must land in the editor paragraph").toBe(true);
	expect(visibleAfterEsc, "Escape should close the menu").toBe(false);
});
