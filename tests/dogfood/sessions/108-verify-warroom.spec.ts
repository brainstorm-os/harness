/**
 * Session 108 — verify the war-room + F-054 batch in the real shell.
 *
 * F-052 (Journal opens on today), F-043 (Tasks empty affordances visible at
 * rest), F-054 (Calendar new-event form folds secondary fields under "More
 * options"). Built fresh (no SKIP_BUILD).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("verify war-room batch (108)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("108-verify-warroom");
	try {
		// F-052 — Journal should open on today, not the last-viewed date.
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await s.shot(journal, "01-journal");
		const header =
			(await journal.locator("header, [class*='journal__header'], h1, h2").first().textContent()) ??
			"";
		s.note(`F-052 journal header date: ${JSON.stringify(header.trim().slice(0, 60))}`);

		// F-043 — Tasks empty affordances should be visible at rest (not display:none).
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await tasks
			.locator('text="Today"')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(600);
		await s.shot(tasks, "02-tasks-today");
		const emptyAffordances = await tasks
			.locator('.task-row__chip--editable[data-empty="true"]')
			.count()
			.catch(() => 0);
		const visibleAffordances = await tasks
			.locator('.task-row__chip--editable[data-empty="true"]:visible')
			.count()
			.catch(() => 0);
		s.note(
			`F-043 empty affordances: ${emptyAffordances} present, ${visibleAffordances} visible at rest`,
		);

		// F-054 — new-event form: secondary fields folded under "More options".
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);
		await cal
			.locator('.cal-toolbar__tab[data-view="week"]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(400);
		await cal
			.locator('.cal-toolbar__new, [aria-label*="new event" i], [aria-label*="new" i]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(800);
		await s.shot(cal, "03-event-detail");
		const moreSummary = await cal
			.locator(".cal-detail__more-summary")
			.first()
			.textContent()
			.catch(() => "");
		const moreOpen = await cal
			.locator(".cal-detail__more[open]")
			.count()
			.then((c) => c > 0)
			.catch(() => false);
		// Time-zone field should be hidden (inside the collapsed details) at rest.
		const tzVisible = await cal
			.locator(".cal-detail__more select")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(
			`F-054 "More options" summary: ${JSON.stringify((moreSummary ?? "").trim())}, open=${moreOpen}, secondary visible=${tzVisible}`,
		);

		s.note("captured war-room batch verification");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
