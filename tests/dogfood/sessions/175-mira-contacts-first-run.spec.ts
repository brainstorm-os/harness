/**
 * Session 175 — Mira opens the new Contacts app for the first time.
 *
 * Day one of the work week with the new build. Contacts is a dedicated people
 * surface over the shared Person/v1 space — until now Mira tracked people as
 * rows in the Clients database. She opens the app cold (empty address book),
 * adds her first few real contacts (a client, an advisor, a vendor), gives each
 * a name, and confirms the list renders them grouped alphabetically. The point
 * is the *first-run* experience: does an empty app invite the first action, and
 * does creating a person land somewhere sensible. Friction comes from the
 * captures + the read-back of what actually rendered.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const NEW_PEOPLE = ["Dana Whitfield", "Sam Okonkwo", "Priya Raman"];

test("Mira's first run of the Contacts app (175)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("175-mira-contacts-first-run");
	try {
		s.chat(
			SPEAKER.Mira,
			"New build dropped — there's a dedicated Contacts app now. I've been keeping people as rows in the Clients DB; let me see if this is a better home for the actual humans. Opening it cold.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);
		await s.shot(c, "01-contacts-cold-open");

		// First-run read: is the header clean (title + New-contact action on one
		// row) and does the empty state invite the first action?
		const firstRun = await c.evaluate(() => {
			const title = document.querySelector(".app-header__title");
			const right = document.querySelector(".app-header__right");
			const empty = document.querySelector(".contacts-list__empty-title");
			const tr = title?.getBoundingClientRect();
			const rr = right?.getBoundingClientRect();
			return {
				titleText: title?.textContent ?? null,
				titleFontPx: title ? getComputedStyle(title).fontSize : null,
				// header is laid out as ONE row when the title and the right-group
				// share a vertical band (tops within a few px of each other).
				sameRow: tr && rr ? Math.abs(tr.top - rr.top) < 12 : false,
				emptyTitle: empty?.textContent ?? null,
			};
		});
		s.note(`first-run header/empty: ${JSON.stringify(firstRun)}`);

		// Add the first contacts. New-contact opens the detail route with an empty
		// name input focused; type the name, commit with Enter, go back, repeat.
		let added = 0;
		for (const name of NEW_PEOPLE) {
			const newBtn = c.locator("[data-testid='contacts-new']").first();
			if (!(await newBtn.count())) break;
			await newBtn.click().catch(() => undefined);
			await c.waitForTimeout(900);
			const nameInput = c.locator(".contacts-detail__title-input").first();
			if (!(await nameInput.count())) {
				s.note(`could not reach the name input for "${name}"`);
				break;
			}
			await nameInput.fill(name).catch(() => undefined);
			await nameInput.press("Enter").catch(() => undefined);
			await c.waitForTimeout(700);
			added++;
			// Back to the list to add the next one.
			await c
				.locator("[aria-label='Back to list'], .header-nav button")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(800);
		}
		s.note(`contacts created this run: ${added}/${NEW_PEOPLE.length}`);
		await s.shot(c, "02-contacts-after-adding");

		// Read back the rendered list — names + group letters.
		const listed = await c
			.locator(".contacts-row__name")
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.trim()).filter(Boolean))
			.catch(() => [] as string[]);
		const groups = await c
			.locator(".contacts-list__group-letter")
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.trim()))
			.catch(() => [] as string[]);
		s.note(`list rendered names: ${JSON.stringify(listed)}`);
		s.note(`group letters: ${JSON.stringify(groups)}`);

		s.chat(
			SPEAKER.Mira,
			added === NEW_PEOPLE.length
				? `Added my first ${added} contacts and they're sitting in the alphabetical list. This feels like the right home for people — reporting how the first run went from the captures.`
				: `The first run hit some friction adding people (${added}/${NEW_PEOPLE.length} landed) — pulling the captures so we can fix it.`,
		);
		s.note("Mira first-run of Contacts: cold open, added contacts, read back the list.");
	} finally {
		await s.finish();
	}
});
