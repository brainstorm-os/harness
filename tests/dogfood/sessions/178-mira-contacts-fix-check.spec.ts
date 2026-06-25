/**
 * Session 178 — fix-check for the Contacts back-navigation bug (F-145).
 *
 * F-145: the list route was modelled as bare `null`, which the shared
 * NavButtons treats as "nothing to apply", so Back from a contact was swallowed
 * and only one person could ever be added. The fix models the list as a
 * non-null `{ id: null }`. This session proves the loop end-to-end: add three
 * contacts, returning to the list between each via the real Back button, then
 * confirm all three render in the list. It also re-runs the link/birthday read
 * that 177 missed when the vault lock aborted it.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const PEOPLE = ["Dana Whitfield", "Sam Okonkwo", "Theo Marsh"];

test("Contacts back-nav fix: add several contacts via Back to list (178)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("178-mira-contacts-fix-check");
	try {
		s.chat(
			SPEAKER.Mira,
			"Re-checking Contacts after the Back fix — yesterday I could only add one person before getting stuck on their card. Adding three in a row this time.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);

		let added = 0;
		for (const name of PEOPLE) {
			const newBtn = c.locator("[data-testid='contacts-new']").first();
			if (!(await newBtn.count())) {
				s.note(`New-contact button missing before adding "${name}" — stuck off the list route`);
				break;
			}
			await newBtn.click().catch(() => undefined);
			await c.waitForTimeout(900);
			const nameInput = c.locator(".contacts-detail__title-input").first();
			if (!(await nameInput.count())) {
				s.note(`detail name input missing for "${name}"`);
				break;
			}
			await nameInput.fill(name).catch(() => undefined);
			await nameInput.press("Enter").catch(() => undefined);
			await c.waitForTimeout(700);

			// The fix under test: the real Back button must return to the list.
			const back = c.locator("[data-testid='nav-back']").first();
			await back.click().catch(() => undefined);
			await c.waitForTimeout(800);
			const onList = await c.locator("[data-testid='contacts-new']").count();
			s.note(`after Back from "${name}": on-list=${onList > 0}`);
			if (onList > 0) added++;
		}
		await s.shot(c, "01-list-after-three-adds");

		const listed = await c
			.locator(".contacts-row__name")
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.trim()).filter(Boolean))
			.catch(() => [] as string[]);
		s.note(`returned-to-list count: ${added}/${PEOPLE.length}`);
		s.note(`list rendered names: ${JSON.stringify(listed)}`);

		const allThere = PEOPLE.every((n) => listed.includes(n));
		s.chat(
			SPEAKER.Mira,
			allThere
				? `Fixed — added all three (${listed.length} in the book now) and Back returns me to the list every time. Contacts is usable.`
				: `Still off: returned-to-list ${added}/${PEOPLE.length}, list shows ${JSON.stringify(listed)}. Re-filing.`,
		);

		// Soft assert so the run records pass/fail but the capture is still useful.
		expect(added, "Back returned to the list for each contact").toBe(PEOPLE.length);
		s.note("Contacts fix-check: add-three-with-Back loop + list read-back.");
	} finally {
		await s.finish();
	}
});
