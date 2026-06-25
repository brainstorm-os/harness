/**
 * Session 056 — Mira gives her thesis note an identity.
 *
 * A compass for "Northbound". She opens the note's icon picker, searches for
 * a compass emoji, and picks it. Exercises the icon picker (emoji search →
 * cell → apply) — a core object-identity feature not yet dogfooded — and
 * confirms the note then carries an in-doc icon.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("set a note icon via the picker (emoji search)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("056-note-icon");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const thesis = notes.locator("text=Northbound — investment thesis").first();
		if (await thesis.count()) await thesis.click();
		await notes.waitForTimeout(1000);
		await s.shot(notes, "01-note-open");

		// Header icon affordance (shows the AddIconGlyph when no icon is set).
		await notes.locator(".bs-icon-pick").first().click();
		await notes.waitForTimeout(500);
		const picker = notes.locator(".icon-picker").first();
		s.note(`icon picker opened: ${(await picker.count()) > 0}`);
		await s.shot(notes, "02-picker-open");

		// Search for a compass and pick the first matching emoji cell.
		await picker.locator(".icon-picker__search").first().fill("compass");
		await notes.waitForTimeout(500);
		const cell = picker.locator(".icon-picker__cell").first();
		const cellLabel = (await cell.getAttribute("aria-label")) ?? "";
		s.note(`first emoji cell after search "compass": "${cellLabel}"`);
		await cell.click();
		await notes.waitForTimeout(800);
		await s.shot(notes, "03-icon-set");

		// The note now carries an in-doc icon (rendered only when set).
		const docIcon = await notes.locator(".notes__doc-icon").count();
		s.note(`in-doc icon present after pick: ${docIcon}`);
		const pickerClosed = (await notes.locator(".icon-picker").count()) === 0;
		s.note(`picker closed after pick: ${pickerClosed}`);

		expect(cellLabel, "the compass search surfaces a matching emoji").toMatch(/compass/i);
		expect(docIcon, "the note shows an in-doc icon once one is picked").toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
