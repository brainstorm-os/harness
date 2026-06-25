/**
 * Session 145 — Priya builds a research index (real cross-links → graph edges).
 *
 * The connective artifact her role is about: a short index that `@`-links the
 * research pieces, so they form a navigable web (and real graph edges, post
 * F-067). Uses clean single-token mentions (token → pick, per the F-135 rule).
 * Spec posts intent/neutral; verdict from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

async function mention(page: Awaited<ReturnType<typeof startSession>>["dashboard"], token: string) {
	await page.keyboard.type(token, { delay: 70 });
	await page.waitForTimeout(800);
	await page.keyboard.press("Enter");
	await page.waitForTimeout(300);
}

test("Priya builds a research index linking her pieces (145)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("145-priya-research-index");
	try {
		s.chat(
			SPEAKER.Priya,
			"Building a small research index — linking the pieces so they form one navigable web, not a pile of docs.",
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
		await notes.keyboard.type("Research index — Northbound", { delay: 12 });
		await notes.waitForTimeout(300);
		await notes.keyboard.press("Enter");

		await notes.keyboard.type("Core threads. Trust-tax work: ", { delay: 14 });
		await mention(notes, "@Research");
		await notes.keyboard.type(". Active engagement: ", { delay: 14 });
		await mention(notes, "@Beacon");
		await notes.keyboard.type(". More to fold in as it lands.", { delay: 14 });
		await notes.waitForTimeout(1200);
		await s.shot(notes, "01-index");

		s.chat(
			SPEAKER.Priya,
			"Research index is up with the first links in — pulling my read from the capture.",
		);
		s.note("Priya built a research index with clean @-mentions; verdict from capture.");
	} finally {
		await s.finish();
	}
});
