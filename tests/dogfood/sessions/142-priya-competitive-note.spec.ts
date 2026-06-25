/**
 * Session 142 — Priya writes a short competitive note + a clean Beacon link.
 *
 * Validates the corrected mention method (type the pre-space token, then pick —
 * the F-135 playbook rule) together with the F-067 fix: a single `@Beacon`
 * mention should insert as a chip and materialize as a graph edge. Real, small
 * artifact. Spec posts intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya writes a competitive note linking Beacon (142)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("142-priya-competitive-note");
	try {
		s.chat(
			SPEAKER.Priya,
			"Quick competitive note on the analytics space — linking it straight to the Beacon record so the thread holds.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1300);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowUp");
		await notes.waitForTimeout(200);
		await notes.keyboard.type("Competitive note — analytics moat", { delay: 12 });
		await notes.waitForTimeout(300);
		await notes.keyboard.press("Enter");

		await notes.keyboard.type("First-party event data is the defensible wedge. Closest comp to ", {
			delay: 14,
		});
		// Clean single-token mention: type "@Beacon", let the typeahead filter,
		// then Enter to insert the chip (per the F-135 playbook rule).
		await notes.keyboard.type("@Beacon", { delay: 70 });
		await notes.waitForTimeout(900);
		await s.shot(notes, "01-mention-open");
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(300);
		await notes.keyboard.type(" is well ahead on data volume.", { delay: 14 });
		await notes.waitForTimeout(1200);
		await s.shot(notes, "02-note");

		s.note("Priya wrote a competitive note with a single clean @Beacon link; verdict from captures.");
	} finally {
		await s.finish();
	}
});
