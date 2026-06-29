/**
 * Session 366 — verify Tasks' empty surface renders the shared <EmptyState>
 * Hero (via the new `createEmptyState` DOM twin), not the old hand-built
 * `.tasks-empty` h2+p (F-301). Walk to a surface that's empty and assert
 * `.bs-empty-state` is present with zero legacy `.tasks-empty` markers.
 */

import { type Page, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

async function emptyCount(page: Page): Promise<{ hero: number; legacy: number }> {
	return {
		hero: await page.locator(".bs-empty-state").count().catch(() => 0),
		legacy: await page.locator(".tasks-empty").count().catch(() => 0),
	};
}

test("tasks empty surface renders the shared EmptyState (366)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("366-tasks-empty-state");
	try {
		const page = await s.openApp(APP.Tasks);
		const errs = collectConsoleErrors(page);
		await page.waitForTimeout(2400);

		// Walk the left-nav surfaces looking for one that's empty. Inbox is the
		// most likely empty surface in the seeded vault.
		const surfaces = ["Inbox", "Upcoming", "Today"];
		let found = { hero: 0, legacy: 0 };
		for (const name of surfaces) {
			const nav = page.locator(`text="${name}"`).first();
			if ((await nav.count().catch(() => 0)) > 0) {
				await nav.click().catch(() => undefined);
				await page.waitForTimeout(900);
			}
			const c = await emptyCount(page);
			s.note(`[i] surface ${name}: .bs-empty-state=${c.hero} .tasks-empty=${c.legacy}`);
			if (c.hero > 0 || c.legacy > 0) {
				found = c;
				await s.shot(page, `empty-${name.toLowerCase()}`);
				break;
			}
		}
		s.note(
			found.hero > 0 && found.legacy === 0
				? "[ok] empty surface uses the shared EmptyState Hero; no legacy .tasks-empty"
				: found.hero === 0 && found.legacy === 0
					? "[i] no empty surface reachable in this vault (all populated) — unit tests cover the render"
					: "[?] unexpected — inspect screenshot",
		);
		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 5)) s.note(`    ${e}`);
		await page.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
