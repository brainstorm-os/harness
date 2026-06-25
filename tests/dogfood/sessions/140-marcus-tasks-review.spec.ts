/**
 * Session 140 — Marcus design-reviews the Tasks surface.
 *
 * The deliverables app. Marcus checks the surface nav (Inbox / Today /
 * Upcoming), task-row consistency (toggle + name + chips), and the header for
 * consistency with the rest of the product. Known dogfood cruft (duplicate
 * seed tasks) is cruft, not a finding. Spec posts intent/neutral; verdict from
 * the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Tasks surface (140)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("140-marcus-tasks-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Reviewing Tasks — the deliverables app. Checking the surface nav, row consistency and the header chrome.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await tasks
			.locator('text="Today"')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "01-today");

		const surfaces = await tasks
			.locator("[class*='surface'], [class*='sidebar'] [class*='item'], [class*='nav']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 10),
			)
			.catch(() => [] as string[]);
		s.note(`surfaces/nav: ${JSON.stringify(surfaces)}`);

		const rowChips = await tasks
			.locator(".task-row__chip, .task-row__chip-text")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`row chips sample: ${JSON.stringify(rowChips)}`);

		const headerRight = await tasks
			.locator(".app-header__right")
			.first()
			.locator("button")
			.evaluateAll((els) => els.map((e) => (e as HTMLElement).getAttribute("aria-label") || ""))
			.catch(() => [] as string[]);
		s.note(`header right-group: ${JSON.stringify(headerRight)}`);

		s.chat(SPEAKER.Marcus, "Walked the surfaces and rows — pulling my notes from the captures.");
		s.note("Marcus reviewed the Tasks surface; verdict from captures.");
	} finally {
		await s.finish();
	}
});
