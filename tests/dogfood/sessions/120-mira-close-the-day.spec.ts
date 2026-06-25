/**
 * Session 120 — Mira closes out a deliverable and logs the day.
 *
 * Founder cadence: she ticks a finished deliverable off Today, flips "Show
 * completed" to confirm her done work reads sanely (and that toggling it
 * doesn't flood Today with the whole backlog of long-finished tasks), then
 * writes an end-of-day line in the Journal. Exercises the Tasks completion +
 * Today-surface filtering and the Journal save path. Friction from captures.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Mira completes a deliverable, checks Show completed, logs the day", async () => {
	test.setTimeout(240_000);
	const s = await startSession("120-mira-close-the-day");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await tasks
			.locator('text="Today"')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "01-today-before");

		const countBefore = await tasks
			.locator(".task-row")
			.count()
			.catch(() => 0);
		s.note(`Today rows before completing: ${countBefore}`);

		// Tick the first open deliverable off the list.
		const firstRow = tasks.locator(".task-row").first();
		const firstName = await firstRow
			.locator(".task-row__name, .task-row__name-label")
			.first()
			.innerText()
			.catch(() => "");
		const tick = firstRow.locator(".task-row__tick, .task-row__toggle, [role='checkbox']").first();
		if (await tick.count()) {
			await tick.click().catch(() => undefined);
			await tasks.waitForTimeout(900);
			s.note(`completed deliverable: ${JSON.stringify(firstName.replace(/\s+/g, " ").trim())}`);
		} else {
			s.note("FRICTION? no tick/toggle affordance found on a task row");
		}
		await s.shot(tasks, "02-after-complete");
		const countAfterComplete = await tasks
			.locator(".task-row")
			.count()
			.catch(() => 0);
		s.note(`Today rows after completing (open only): ${countAfterComplete}`);

		// Flip "Show completed" — the just-shipped fix should NOT dump the whole
		// finished backlog into Today, only work actually completed today.
		const showCompleted = tasks
			.getByText(/show completed/i)
			.or(tasks.locator('[aria-label*="completed" i]'))
			.first();
		if (await showCompleted.count()) {
			await showCompleted.click().catch(() => undefined);
			await tasks.waitForTimeout(900);
			const countWithCompleted = await tasks
				.locator(".task-row")
				.count()
				.catch(() => 0);
			s.note(`Today rows with "Show completed" on: ${countWithCompleted}`);
			s.note(
				countWithCompleted > countAfterComplete + 5
					? "WATCH: Show completed added many rows — is the old backlog leaking into Today?"
					: "Show completed added only recently-finished work (expected)",
			);
		} else {
			s.note("could not find a 'Show completed' toggle");
		}
		await s.shot(tasks, "03-show-completed");

		// ── Journal: end-of-day line ────────────────────────────────────────
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1600);
		// Raw Playwright keystrokes race the Lexical/Yjs binding and corrupt the
		// doc (only the first char lands) — write through the journal dev hook,
		// the same pattern Notes sessions use for reliable text entry.
		const wrote = await journal
			.evaluate(async (line) => {
				const dev = (
					window as unknown as {
						__brainstormJournalDev?: { appendParagraph: (t: string) => Promise<void> };
					}
				).__brainstormJournalDev;
				if (!dev) return false;
				await dev.appendParagraph(line);
				return true;
			}, "Closed out a deliverable and reviewed the Clients pipeline — Vertex, Acme, Beacon all tracking. Issue #3 outline is next.")
			.catch(() => false);
		await journal.waitForTimeout(700);
		s.note(wrote ? "journal line written via dev hook" : "FRICTION? journal dev hook unavailable");
		await s.shot(journal, "04-journal-logged");

		s.note(
			"Mira closed a deliverable, sanity-checked Show completed, logged the day; friction from captures.",
		);
	} finally {
		await s.finish();
	}
});
