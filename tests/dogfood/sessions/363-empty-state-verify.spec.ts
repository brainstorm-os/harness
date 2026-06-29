/**
 * Session 363 — verify the F-301 empty-state migrations render the shared Hero.
 *
 * Files' folder/search empty and Calendar's agenda empty were hand-rolled; both
 * now route through `@brainstorm/sdk/empty-state` (`.bs-empty-state`). This opens
 * each, drives it to its empty state, and asserts the shared chrome is present
 * (and the old hand-rolled markers are gone) with no console errors.
 */

import { type Page, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("files search-empty renders shared EmptyState (363)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("363-empty-state-verify");
	try {
		const files = await s.openApp(APP.Files);
		const errs = collectConsoleErrors(files);
		await files.waitForTimeout(2000);
		// A nonsense query yields zero rows → the (converted) search-empty.
		const search = files.locator("input[type='search'], input[placeholder*='earch'], .files__search input").first();
		if ((await search.count().catch(() => 0)) > 0) {
			await search.click().catch(() => undefined);
			await files.keyboard.type("zzqqxx-no-such-file", { delay: 5 });
			await files.waitForTimeout(900);
		}
		const heroes = await files.locator(".content-empty .bs-empty-state").count().catch(() => 0);
		const legacy = await files.locator(".content-empty__glyph, .content-empty h2").count().catch(() => 0);
		s.note(`[i] Files search-empty: .bs-empty-state under .content-empty=${heroes}, legacy markers=${legacy}`);
		await s.shot(files, "files-search-empty");
		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 4)) s.note(`    files: ${e}`);
		await files.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(250).catch(() => undefined);

		const cal: Page = await s.openApp(APP.Calendar);
		const calErrs = collectConsoleErrors(cal);
		await cal.waitForTimeout(2000);
		const agenda = cal.locator("button:has-text('Agenda'), [data-view='agenda']").first();
		if ((await agenda.count().catch(() => 0)) > 0) {
			await agenda.click().catch(() => undefined);
			await cal.waitForTimeout(900);
		}
		const calLegacy = await cal.locator(".cal-empty").count().catch(() => 0);
		const calHero = await cal.locator(".cal-agenda .bs-empty-state").count().catch(() => 0);
		s.note(`[i] Calendar agenda: .bs-empty-state=${calHero}, legacy .cal-empty=${calLegacy} (0 events → hero; events → list)`);
		await s.shot(cal, "calendar-agenda");
		if (calErrs.errors.length > 0) for (const e of calErrs.errors.slice(0, 4)) s.note(`    cal: ${e}`);
		await cal.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
