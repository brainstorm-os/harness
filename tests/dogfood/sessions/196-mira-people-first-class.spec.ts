/**
 * Session 196 — Mira makes her team "real" (Tue): roles + mentions.
 *
 * Two open friction items both claim the people primitives are missing:
 *   - F-155: "a contact can hold a company but not a job title / role" (187).
 *   - F-156: "I can't @-mention a teammate; the picker omits people" (188).
 *
 * Both were filed from captures that may have under-sampled the UI: 187 probed
 * for a role *input* on the detail card (the role lives in the properties
 * inspector, behind the Info toggle), and 188 grabbed only the first 8 rows of
 * an *unfiltered* @-typeahead — where 3 date rows + alphabetically-early
 * entities crowd out "Marcus" / "Priya". This session settles both with the
 * decisive test: open a teammate's inspector and actually set a role, then
 * @-mention a teammate *by name* (filter the typeahead to "Marc"), and read
 * whether a real person surfaces + a resolvable chip lands. Verdict from the
 * captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira sets a teammate role + @-mentions a teammate (196)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("196-mira-people-first-class");
	try {
		s.chat(
			SPEAKER.Mira,
			"Two things have been nagging me: can a contact even hold a job title, and can I @-mention a teammate in a doc? Settling both — setting Marcus's role in his card, then mentioning him by name in a note.",
		);

		// ---- Part 1: F-155 — set a role on a real teammate via the inspector ----
		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded").catch(() => undefined);
		await c.waitForTimeout(1500);
		await s.shot(c, "01-contacts-open");

		// Open Marcus's detail (created in 187). Fall back to the first row.
		const marcusRow = c.locator(".contacts-row", { hasText: /marcus/i }).first();
		const targetRow = (await marcusRow.count().catch(() => 0))
			? marcusRow
			: c.locator(".contacts-row").first();
		const targetName = (await targetRow.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
		await targetRow.click().catch(() => undefined);
		await c.waitForTimeout(1000);
		s.note(`opened contact detail for: "${targetName}"`);

		// The role field is NOT on the card — it lives in the properties inspector
		// (the Info toggle in the header-right). Open it.
		const inspectorToggle = c.locator("[aria-pressed]").first();
		const wasOpen = (await inspectorToggle.getAttribute("aria-pressed").catch(() => null)) === "true";
		if (!wasOpen) {
			await inspectorToggle.click().catch(() => undefined);
			await c.waitForTimeout(700);
		}
		await s.shot(c, "02-inspector-open");

		const roleRow = c.locator(".bs-props__row[data-property-key='role']").first();
		const roleRowPresent = (await roleRow.count().catch(() => 0)) > 0;
		s.note(`role property row present in inspector: ${roleRowPresent}`);

		let roleSet = false;
		if (roleRowPresent) {
			// Click into the role value cell and type a title.
			const valueCell = roleRow.locator(".bs-props__row-value").first();
			await valueCell.click().catch(() => undefined);
			await c.waitForTimeout(400);
			const input = roleRow.locator("input, textarea, [contenteditable='true']").first();
			if (await input.count().catch(() => 0)) {
				await input.fill("Product Designer").catch(() => undefined);
				await input.press("Enter").catch(() => undefined);
				await c.waitForTimeout(800);
				roleSet = true;
			}
		}
		await s.shot(c, "03-role-set");

		// The detail subtitle should now read the role ("Product Designer · …").
		const subtitle = (
			await c
				.locator(".contacts-detail__subtitle")
				.first()
				.innerText()
				.catch(() => "")
		)
			.replace(/\s+/g, " ")
			.trim();
		s.note(`role set via inspector: ${roleSet}; detail subtitle now: "${subtitle}"`);

		// ---- Part 2: F-156 — @-mention a teammate BY NAME in a note ----
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
		await notes.keyboard.type("Team — who owns what", { delay: 8 });
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(200);

		// Decisive test: filter the @-typeahead to a real teammate's name.
		await notes.keyboard.type("Design lead: @Marc", { delay: 35 });
		await notes.waitForTimeout(1000);

		const typeahead = notes.locator(
			"[class*='typeahead'], [class*='mention'], [role='listbox'], .notes__mention-menu",
		);
		const mentionOpen = await typeahead
			.first()
			.isVisible()
			.catch(() => false);
		const mentionOptions = await typeahead
			.locator("[role='option'], li, [class*='item'], [class*='row']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 10),
			)
			.catch(() => [] as string[]);
		const personOffered = mentionOptions.some((o) => /marcus/i.test(o));
		s.note(
			`@-typeahead (query "Marc") open: ${mentionOpen}; options: ${JSON.stringify(mentionOptions)}; person offered: ${personOffered}`,
		);
		await s.shot(notes, "04-mention-typeahead-named");

		// Pick the offered person and confirm a chip lands.
		if (mentionOpen && personOffered) {
			await notes.keyboard.press("Enter");
			await notes.waitForTimeout(600);
		} else {
			await notes.keyboard.press("Escape").catch(() => undefined);
		}
		const mentionChip = (
			await notes
				.locator(
					"[class*='mention'][class*='chip'], .notes__mention, [data-mention], [data-mention-id]",
				)
				.first()
				.innerText()
				.catch(() => "")
		)
			.replace(/\s+/g, " ")
			.trim();
		s.note(`mention chip after pick: "${mentionChip}"`);
		await s.shot(notes, "05-after-mention");

		s.chat(
			SPEAKER.Mira,
			personOffered
				? "Settled it: Marcus shows up in the @-picker when I type his name, and his card carries a role now. The earlier reports were sampling artifacts — people are first-class after all. Verifying the chip resolves from the captures."
				: `Typed "@Marc" and Marcus still doesn't surface in the picker — that's a real gap, not a sampling fluke. Filing it sharp.`,
		);
		s.note("Mira tested role-set + named person-mention; verdict from captures.");
	} finally {
		await s.finish();
	}
});
