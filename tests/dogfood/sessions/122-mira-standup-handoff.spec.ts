/**
 * Session 122 — Mira's pre-standup pipeline check + a hand-off to Priya.
 *
 * Short operating session that doubles as the first live use of the team chat:
 * Mira talks through what she's doing as she reviews the Clients pipeline, then
 * hands a concrete piece of work to Priya in the channel. The collaboration is
 * the artifact — watch it with `bun run dogfood:watch`. Friction (if any) from
 * the captures, as always.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira reviews the pipeline and hands off to Priya (122)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("122-mira-standup-handoff");
	try {
		s.chat(
			SPEAKER.Mira,
			"Morning — doing a quick pipeline pass before standup. Want to know where Beacon and Acme stand.",
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

		const clients = await db
			.locator("[class*='card'] [class*='name'], .dbv-grid__cell[data-col='title'], [class*='card']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 10),
			)
			.catch(() => [] as string[]);
		s.note(`Clients seen: ${JSON.stringify(clients)}`);

		s.chat(
			SPEAKER.Mira,
			"Pipeline looks healthy — Vertex active, Acme active, Beacon still a Lead at $12k.",
		);
		s.chat(
			SPEAKER.Priya,
			"Priya here — I can turn Beacon. Let me draft a tight one-pager on the analytics-moat angle, cite the two reading-list pieces, and embed the live pipeline so the number's current.",
		);
		s.chat(
			SPEAKER.Mira,
			"Perfect. That's the hand-off — Beacon one-pager is yours. I'll review before it goes out.",
		);

		s.note("Mira ran a pipeline check and handed the Beacon one-pager to Priya in the team chat.");
	} finally {
		await s.finish();
	}
});
