/**
 * Session 060 — Mira tracks metadata on her thesis note.
 *
 * She opens the properties panel and binds a property to the note via the
 * "Add property" picker. Exercises the note properties surface (shared
 * PropertiesPanel + the add-property picker) — custom metadata on an object,
 * not yet dogfooded — all UI-driven (no Lexical typing).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("bind a property to a note via the Add-property picker", async () => {
	test.setTimeout(180_000);
	const s = await startSession("060-note-property");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes.locator("text=Northbound — investment thesis").first().click();
		await notes.waitForTimeout(900);

		// Open the properties panel — when closed the aside is `inert`, so its
		// Add button is present but unclickable. Toggle only if currently hidden.
		const aside = notes.locator("#notes-props");
		if ((await aside.getAttribute("aria-hidden")) !== "false") {
			await notes
				.locator('[aria-controls="notes-props"]')
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(500);
		}
		s.note(`properties panel open: ${(await aside.getAttribute("aria-hidden")) === "false"}`);
		await s.shot(notes, "01-props-open");

		await notes.locator(".bs-props__add").first().click();
		await notes.waitForTimeout(500);
		const picker = notes.locator(".notes__picker").first();
		const options = picker.locator('[role="option"]');
		const optCount = await options.count();
		s.note(`add-property picker options: ${optCount}`);
		await s.shot(notes, "02-picker");

		const optionText = ((await options.first().textContent()) ?? "").trim();
		s.note(`binding first property: "${optionText}"`);
		await options.first().click();
		await notes.waitForTimeout(700);
		await s.shot(notes, "03-bound");

		const pickerClosed = (await notes.locator(".notes__picker").count()) === 0;
		const rowLabels = (await notes.locator(".bs-props__row-label").allInnerTexts()).map((t) =>
			t.trim(),
		);
		s.note(`picker closed: ${pickerClosed}; property rows now: ${JSON.stringify(rowLabels)}`);

		expect(optCount, "the Add-property picker offers at least one property").toBeGreaterThanOrEqual(
			1,
		);
		// The picked property is now bound to the note (idempotent across reruns:
		// if it was already bound, it still shows).
		expect(
			rowLabels.some(
				(l) => optionText.length > 0 && l.toLowerCase().includes(optionText.toLowerCase().slice(0, 4)),
			),
			`the bound property "${optionText}" appears in the note's properties`,
		).toBe(true);
	} finally {
		await s.finish();
	}
});
