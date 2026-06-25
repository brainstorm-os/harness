/**
 * Probe 301 — verify the mention (`@`) and transclusion (`!@`) typeaheads after
 * migrating them onto the shared controlled-list runtime (`openTypeaheadMenu`).
 * Same risks as the slash probe (300): the menu opens + renders rows in the real
 * shell, the editor keeps focus (controlled-list keystone), and Escape closes —
 * across an editor surface every app shares. Fast + isolated.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const EDITOR = '.notes__body [contenteditable="true"]';
const MENU = ".fm-menu";

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

async function editorKeepsFocus(notes: import("@playwright/test").Page): Promise<boolean> {
	return notes.evaluate(() => {
		const a = document.activeElement as HTMLElement | null;
		return a?.getAttribute("contenteditable") === "true" || !!a?.closest('[contenteditable="true"]');
	});
}

test("probe: mention + transclusion typeaheads (301)", async () => {
	test.setTimeout(120_000);
	const s = await startSession("301-probe-mention-transclusion");
	const notes = await s.openApp(APP.Notes);
	await notes.waitForTimeout(2500);

	// ── Mention (@) ──────────────────────────────────────────────────────
	await freshNoteBody(notes);
	await notes.keyboard.type("@", { delay: 40 });
	// The entity list loads async (fetchEntities) — wait for a row.
	await notes
		.locator(`${MENU} .fm-row`)
		.first()
		.waitFor({ state: "visible", timeout: 7000 })
		.catch(() => undefined);
	const mentionRows = await notes
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	const mentionFocus = await editorKeepsFocus(notes);
	s.note(`[probe] mention: rows=${mentionRows}, editorFocus=${mentionFocus}`);
	await s.shot(notes, "01-mention");
	await notes.keyboard.press("Escape");
	await notes.waitForTimeout(400);
	const mentionClosed = !(await notes
		.locator(MENU)
		.first()
		.isVisible()
		.catch(() => false));
	s.note(`[probe] mention closed on Escape: ${mentionClosed}`);

	// ── Transclusion (!@) ────────────────────────────────────────────────
	await freshNoteBody(notes);
	await notes.keyboard.type("!@", { delay: 40 });
	await notes
		.locator(`${MENU} .fm-row`)
		.first()
		.waitFor({ state: "visible", timeout: 7000 })
		.catch(() => undefined);
	const transRows = await notes
		.locator(`${MENU} .fm-row`)
		.count()
		.catch(() => 0);
	const transFocus = await editorKeepsFocus(notes);
	const transText = await notes
		.locator(MENU)
		.first()
		.innerText()
		.catch(() => "");
	s.note(
		`[probe] transclusion: rows=${transRows}, editorFocus=${transFocus}, text=${JSON.stringify(transText.slice(0, 120))}`,
	);
	await s.shot(notes, "02-transclusion");
	await notes.keyboard.press("Escape");
	await notes.waitForTimeout(400);
	const transClosed = !(await notes
		.locator(MENU)
		.first()
		.isVisible()
		.catch(() => false));
	s.note(`[probe] transclusion closed on Escape: ${transClosed}`);

	// Hard assertions.
	expect(mentionRows, "mention menu should render entity rows").toBeGreaterThan(0);
	expect(mentionFocus, "editor keeps focus during mention typeahead").toBe(true);
	expect(mentionClosed, "Escape closes the mention menu").toBe(true);
	expect(transRows, "transclusion menu should render rows").toBeGreaterThan(0);
	expect(transFocus, "editor keeps focus during transclusion typeahead").toBe(true);
	expect(transClosed, "Escape closes the transclusion menu").toBe(true);
});
