/**
 * Session 242 — journal persistence repro. Mint today's entry from the Daily
 * review template (real code path: seeds 3 h2 headings into the body + mounts
 * the editor), then assert the seeded body actually RENDERS, survives a
 * navigate-away-and-back, and survives a window reopen. The template headings
 * ("What went well today?", …) are the marker — no synthetic typing / dev hook.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const HEADING = "What went well today?";

const bodyText = (page: Page) =>
	page
		.locator('.journal__entry-body [contenteditable="true"], .journal__main [contenteditable="true"]')
		.first()
		.innerText()
		.catch(() => "(no editable)");

// KNOWN-FAILING repro for F-251 (journal body renders BLANK on cold reopen
// despite the Y.Doc persisting the content). `fixme` so it documents the bug +
// gives the next fix a green target without flagging the dogfood run red.
// Control: session 243 proves Notes (same resolver/editor) does NOT have this.
test.fixme("journal seeded body renders + persists across nav + reopen (242 — F-251)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("242-journal-persistence");
	try {
		const j = await s.openApp(APP.Journal);
		await j.waitForTimeout(2800);
		await s.shot(j, "01-today-empty");

		const chip = j.locator(".journal__template-chip").first();
		s.note(`template chip visible: ${await chip.isVisible().catch(() => false)}`);
		await chip.click().catch(() => undefined);
		await j.waitForTimeout(2000);
		const seeded = await bodyText(j);
		s.note(`body after mint (len ${seeded.length}): ${JSON.stringify(seeded.slice(0, 120))}`);
		s.note(`body renders the seeded heading: ${seeded.includes(HEADING)}`);
		await s.shot(j, "02-template-minted");

		// Navigate AWAY to another day, then BACK to today.
		const days = j.locator(".cal-mini__day");
		if ((await days.count().catch(() => 0)) > 3)
			await days
				.nth(2)
				.click()
				.catch(() => undefined);
		await j.waitForTimeout(1000);
		await s.shot(j, "03-other-day");
		await j
			.locator('button:has-text("Today")')
			.first()
			.click()
			.catch(() => undefined);
		await j.waitForTimeout(1800);
		const afterReturn = await bodyText(j);
		s.note(
			`body after return-to-today renders heading: ${afterReturn.includes(HEADING)} (len ${afterReturn.length})`,
		);
		await s.shot(j, "04-back-to-today");

		// Hard reopen: a fresh journal window (closest to a cold reopen).
		const reopened = await s.openApp(APP.Journal);
		await reopened.waitForTimeout(2600);
		await reopened
			.locator('button:has-text("Today")')
			.first()
			.click()
			.catch(() => undefined);
		await reopened.waitForTimeout(2000);
		const afterReopen = await bodyText(reopened);
		s.note(
			`body after REOPEN renders heading: ${afterReopen.includes(HEADING)} (len ${afterReopen.length})`,
		);
		s.note(`reopen body: ${JSON.stringify(afterReopen.slice(0, 160))}`);
		await s.shot(reopened, "05-after-reopen");

		expect(seeded.includes(HEADING), "seeded heading renders right after mint").toBe(true);
		expect(afterReturn.includes(HEADING), "seeded heading survives navigate-away-and-back").toBe(
			true,
		);
		expect(afterReopen.includes(HEADING), "seeded heading survives a window reopen").toBe(true);
	} finally {
		await s.finish();
	}
});
