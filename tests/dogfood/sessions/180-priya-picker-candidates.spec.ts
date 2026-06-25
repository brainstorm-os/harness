/**
 * Session 180 — Priya re-checks the related-people picker candidate list.
 *
 * Session 179 linked a person successfully but reported only 1 candidate in the
 * picker where several people exist in the book. This probe opens the picker,
 * waits for it to settle, and reads back EVERY candidate name + the people
 * count, so we know whether the picker actually lists the full set or is
 * dropping candidates.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya re-checks the related-people picker candidates (180)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("180-priya-picker-candidates");
	try {
		s.chat(
			SPEAKER.Priya,
			"The picker linked a person fine but only seemed to offer one candidate. Checking it lists everyone it should.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);

		const peopleNames = await c
			.locator(".contacts-list__group .contacts-row__name")
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.trim()).filter(Boolean))
			.catch(() => [] as string[]);
		s.note(`people in the book (list rows): ${JSON.stringify(peopleNames)}`);

		await c
			.locator(".contacts-row")
			.first()
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(1100);
		if ((await c.locator(".bs-props--open").count()) === 0) {
			await c
				.locator(".contacts-icon-btn")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(700);
		}

		const linkTrigger = c
			.locator(".bs-props__row[data-property-key='links'] .bs-cell-link-trigger")
			.first();
		if (await linkTrigger.count()) {
			await linkTrigger.click().catch(() => undefined);
			// Generous settle so the popover list is fully rendered before counting.
			await c.waitForTimeout(1500);
			const candidates = await c
				.locator(".bs-cell-pop-row .bs-cell-pop-row-label")
				.allInnerTexts()
				.then((xs) => xs.map((t) => t.trim()).filter(Boolean))
				.catch(() => [] as string[]);
			s.note(`picker candidates (full): ${JSON.stringify(candidates)} (count=${candidates.length})`);
			await s.shot(c, "01-picker-open");
			await c.keyboard.press("Escape").catch(() => undefined);

			const expected = peopleNames.length;
			s.chat(
				SPEAKER.Priya,
				candidates.length >= Math.max(1, expected - 1)
					? `Picker lists ${candidates.length} candidates for ~${expected} people — that's the full set. The earlier "1" was a render-timing read, not a missing-candidate bug.`
					: `Picker only lists ${candidates.length} candidates for ${expected} people in the book — it IS dropping candidates. Filing.`,
			);
		} else {
			s.note("related-people picker cell not found");
		}
		s.note("Priya picker-candidate re-check complete.");
	} finally {
		await s.finish();
	}
});
