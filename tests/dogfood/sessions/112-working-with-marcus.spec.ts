/**
 * Session 112 — working with Marcus (team coordination, real operations).
 *
 * Northbound is two people now. Mira tries to actually run the team: assign the
 * Sprint-1 deliverables to Marcus, see "Marcus's work" as its own view, and
 * review/sign off his output. Where the app has no concept of *who owns what*
 * or *review state*, that's the note. Founder mode — gaps to the wishlist /
 * dev-tasks, no fixing.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("working with Marcus — team coordination (112)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("112-working-with-marcus");
	try {
		// 1. The deliverables — can a task be ASSIGNED to someone?
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await tasks
			.locator('text="Today"')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(500);
		// Open a deliverable's detail to see its fields (is there an Assignee?).
		const deliverable = tasks
			.locator("text=/Newsletter template|Marketing site|Advisory-deck|Issue #1/i")
			.first();
		if (await deliverable.count()) {
			await deliverable.click().catch(() => undefined);
			await tasks.waitForTimeout(800);
		}
		await s.shot(tasks, "01-task-detail");
		const taskFields = (
			await tasks
				.locator(
					".bs-props [class*='row'], [class*='inspector'] [class*='prop'], [class*='detail'] label, [class*='chip']",
				)
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 25);
		s.note(`Task detail fields/chips (looking for an Assignee/Owner): ${JSON.stringify(taskFields)}`);

		// 2. Is there any "people / team / members" concept in the vault?
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		const lists = (await db.locator(".db-sidebar__list-item").allInnerTexts())
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		s.note(`Database lists (looking for People/Team/Members): ${JSON.stringify(lists)}`);
		const people = lists.filter((l) => /people|team|member|contact|staff|marcus/i.test(l));
		s.note(`Any people/team surface? ${JSON.stringify(people)}`);

		// 3. Marcus's output — how does Mira review/sign off his work?
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const marcusDocs = (await notes.locator(".notes__sidebar-title").allInnerTexts())
			.map((t) => t.trim())
			.filter((t) => /marcus|design review|scorecard|brand/i.test(t));
		s.note(`Marcus-related docs Mira can review: ${JSON.stringify(marcusDocs)}`);
		await s.shot(notes, "02-marcus-docs");
		// Is there any approval / sign-off / review-state affordance on a doc?
		if (marcusDocs.length > 0) {
			await notes
				.locator(`text=${marcusDocs[0]}`)
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(800);
			await s.shot(notes, "03-doc-review");
			const docControls = (
				await notes
					.locator(".app-header button, .app-header [aria-label]")
					.evaluateAll((els) =>
						els.map(
							(e) => (e as HTMLElement).getAttribute("aria-label") || (e as HTMLElement).textContent || "",
						),
					)
					.catch(() => [])
			)
				.map((t) => t.replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 15);
			s.note(
				`Doc header controls (looking for approve/sign-off/status): ${JSON.stringify(docControls)}`,
			);
		}

		s.note("captured team-coordination surfaces for gap analysis");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
