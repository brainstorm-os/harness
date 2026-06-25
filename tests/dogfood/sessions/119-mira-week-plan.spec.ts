/**
 * Session 119 — Mira plans the week and checks her pipeline.
 *
 * Real operating work: she opens Tasks to lay down this week's deliverable,
 * then crosses to the Clients pipeline in Database to see where her
 * engagements stand. Touches the two surfaces that changed under her this
 * cycle (the Tasks compose/surface WIP and the Database grid), composing
 * across apps rather than poking one affordance. Friction from the captures.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Mira lays down a weekly deliverable, then checks the Clients pipeline", async () => {
	test.setTimeout(240_000);
	const s = await startSession("119-mira-week-plan");
	try {
		// ── Tasks: what's on deck, and add this week's deliverable ──────────
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await tasks
			.locator('text="Today"')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "01-tasks-today");

		const onDeck = await tasks
			.locator(".task-row__name, .task-row__name-label")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 15),
			)
			.catch(() => [] as string[]);
		s.note(`Tasks on deck: ${JSON.stringify(onDeck)}`);

		// Add a real deliverable through the compose input. Reveal it first if
		// it's behind a "New"/"Add" trigger.
		let compose = tasks.locator(".tasks-compose__input").first();
		if (!(await compose.count())) {
			await tasks
				.locator('button:has-text("New"), button:has-text("Add"), [aria-label*="add" i]')
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(400);
			compose = tasks.locator(".tasks-compose__input").first();
		}
		if (await compose.count()) {
			await compose.click().catch(() => undefined);
			await tasks.keyboard.type("Draft Issue #3 — distribution moats for seed startups", { delay: 8 });
			await tasks.waitForTimeout(300);
			await tasks.keyboard.press("Enter").catch(() => undefined);
			await tasks.waitForTimeout(800);
		} else {
			s.note("FRICTION? could not find a compose input to add a task from Today");
		}
		await s.shot(tasks, "02-tasks-after-add");

		// ── Database: where do the Clients stand? (also live-checks the grid
		//    footer pluralization fixed in session 118) ──────────────────────
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		await db
			.locator(".db-sidebar__list-item", { hasText: /Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1400);
		await s.shot(db, "03-clients-pipeline");

		const footer = await db
			.locator(".dbv-grid__foot-total")
			.first()
			.innerText()
			.then((t) => t.replace(/\s+/g, " ").trim())
			.catch(() => "");
		s.note(`Clients grid footer total reads: ${JSON.stringify(footer)}`);

		const clients = await db
			.locator("[class*='row'] [class*='name'], .dbv-grid__cell[data-col='title']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`Clients in pipeline: ${JSON.stringify(clients)}`);

		s.note(
			"Mira planned the week (Tasks) and reviewed the Clients pipeline (Database); friction from captures.",
		);
	} finally {
		await s.finish();
	}
});
