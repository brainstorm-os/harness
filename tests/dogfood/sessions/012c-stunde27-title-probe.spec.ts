/**
 * 012c — F-423 verification probe. The all-apps smoke screenshot showed
 * "Stunde 27 | Natasha" (window header) over an editor with an EMPTY title
 * placeholder, but the 905 deep probe recorded the title as present. This
 * probe navigates to the note explicitly, waits for hydration, and reads
 * the editor h1 — deciding whether F-423 is real or a transient.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Stunde 27 title renders in the editor h1", async () => {
	const s = await startSession("012c-stunde27-title-probe");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);

		const search = notes.locator('input[placeholder*="Search"]').first();
		await search.click();
		await search.fill("Stunde 27");
		await notes.waitForTimeout(1500);
		await notes.getByText("Stunde 27 | Natasha").first().click();
		await notes.waitForTimeout(2500);

		const probe = await notes.evaluate(() => {
			const h1 = document.querySelector("h1.notes__title");
			return {
				titleText: h1?.textContent ?? null,
				empty: h1 ? h1.textContent?.trim().length === 0 : null,
				placeholderShown: h1?.getAttribute("data-placeholder") !== null && h1?.textContent === "",
			};
		});
		s.note(`[probe] Stunde 27 editor title: ${JSON.stringify(probe)}`);
		await s.shot(notes, "stunde27-title");
		expect(probe.titleText?.trim()).toBe("Stunde 27 | Natasha");
	} finally {
		await s.finish();
	}
});
