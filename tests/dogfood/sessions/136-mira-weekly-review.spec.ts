/**
 * Session 136 — Mira's weekly operating review (Journal).
 *
 * Founder cadence: she closes the week with a short review in the Journal —
 * what shipped, where the pipeline stands, what's next. Written through the
 * journal dev hook (raw keystrokes corrupt the Yjs editor). Spec posts
 * intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira writes the weekly operating review (136)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("136-mira-weekly-review");
	try {
		s.chat(
			SPEAKER.Mira,
			"Closing the week — quick operating review in the Journal: what shipped, where the pipeline is, what's next.",
		);

		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1600);
		await s.shot(journal, "01-journal");

		// Mira posts the week's review to the team channel — the natural place for
		// a founder wrap-up the whole team reads.
		s.chat(
			SPEAKER.Mira,
			"Weekly review — Team: hired Priya (research editor); in week one she shipped her craft brief, the Beacon one-pager, and the Issue #3 draft.",
		);
		s.chat(
			SPEAKER.Mira,
			"Pipeline: Vertex and Acme active; Beacon advancing from Lead on the strength of the one-pager.",
		);
		s.chat(
			SPEAKER.Mira,
			"Knowledge base: the HQ hub composes cleanly and — after this week's fix — the research finally connects in the graph.",
		);
		s.chat(
			SPEAKER.Mira,
			"Next week: ship Issue #3 once the two data points land, and move Beacon to a signed pilot. Good momentum.",
		);
		s.note("Mira posted the weekly operating review to the team chat.");
	} finally {
		await s.finish();
	}
});
