/**
 * Session 123 — Priya builds the Beacon one-pager (fulfilling the 122 hand-off).
 *
 * Continues the team-chat story: Mira handed Priya the Beacon one-pager; here
 * Priya actually writes it — a tight, cited case for moving Beacon from Lead to
 * Active — and checks she can wire it back to the client record + the live
 * pipeline (her connective-tissue lens). She narrates progress in the channel.
 * Friction from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
};

test("Priya writes the Beacon one-pager (123)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("123-priya-beacon-onepager");
	try {
		s.chat(
			SPEAKER.Priya,
			"Picking up the Beacon one-pager. Drafting the analytics-moat case now — I'll keep it to a page.",
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
		await notes.keyboard.type("Beacon Analytics — the case to go Active", { delay: 10 });
		await notes.waitForTimeout(300);

		const wrote = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Recommendation: move Beacon Analytics from Lead to Active at $12k/mo. The wedge is their analytics moat — they own first-party event data competitors can't replicate.",
				);
				await dev.appendParagraph(
					"Why now: (1) their data volume crossed the threshold where modeling beats dashboards [reading-list #2]; (2) two comparable seed analytics plays compounded once they productized the moat [reading-list #4]; (3) our Clients pipeline shows Vertex/Acme already Active on the same thesis — Beacon is the same shape, one stage behind.",
				);
				await dev.appendParagraph(
					"The ask: a 3-week paid pilot scoping the moat into a retainer. Success = one shipped model + a board-ready narrative.",
				);
				await dev.appendParagraph(
					"Risks: single-vertical data; mitigate by scoping the pilot to one use-case first.",
				);
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "Beacon one-pager body written" : "FRICTION? notes dev hook unavailable");
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-onepager");

		// Connective tissue: can she link the actual Beacon client record in?
		const editor = notes.locator('[contenteditable="true"]').first();
		await editor.click().catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await notes.keyboard.press("Enter").catch(() => undefined);
		await notes.keyboard.type("Linked record: ", { delay: 15 }).catch(() => undefined);
		await notes.keyboard.type("@Beacon", { delay: 60 }).catch(() => undefined);
		await notes.waitForTimeout(700);
		await s.shot(notes, "02-mention-beacon");
		const mentionItems = (
			await notes
				.locator(
					"[role='option'], [class*='mention'] [class*='item'], [class*='typeahead'] [class*='item']",
				)
				.allInnerTexts()
				.catch(() => [])
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 8);
		s.note(`"@Beacon" matched: ${JSON.stringify(mentionItems)}`);
		const beaconLinkable = mentionItems.some((m) => /beacon/i.test(m));
		if (beaconLinkable) {
			await notes.keyboard.press("Enter").catch(() => undefined);
			await notes.waitForTimeout(500);
		}
		await s.shot(notes, "03-after-link");

		s.chat(
			SPEAKER.Priya,
			beaconLinkable
				? "Beacon one-pager done — analytics-moat case, cited to the reading list, with the Beacon record linked in. Mira, it's ready for your review."
				: "Beacon one-pager drafted and cited, but I couldn't link the actual Beacon record from '@Beacon' — flagging that, Kai.",
		);
		s.note(`Beacon record linkable from @-mention? ${beaconLinkable}`);
		s.note("Priya built the Beacon one-pager and tested linking the client record.");
	} finally {
		await s.finish();
	}
});
