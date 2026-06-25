/**
 * Session 146 — Mira runs the numbers on the Clients book.
 *
 * Operator cadence: open the Clients collection, read the engagement values off
 * the cards, and post the pipeline total to the team channel. Reliable read +
 * capture. Spec posts intent/neutral; the tally is reported from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira runs the numbers on the Clients book (146)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("146-mira-running-numbers");
	try {
		s.chat(
			SPEAKER.Mira,
			"Running the numbers — tallying the Clients book before I plan next month's capacity.",
		);

		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		await db
			.locator(".db-sidebar__list-item", { hasText: /Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1400);
		await s.shot(db, "01-clients");

		const values = await db
			.locator("[class*='card'], [class*='chip'], [class*='cell']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter((t) => /US\$|\$|active|lead/i.test(t))
					.slice(0, 16),
			)
			.catch(() => [] as string[]);
		s.note(`client values/stages read: ${JSON.stringify(values)}`);

		s.chat(SPEAKER.Mira, "Read the book — posting the tally from the capture.");
		s.note("Mira read the Clients book; tally reported from capture.");
	} finally {
		await s.finish();
	}
});
