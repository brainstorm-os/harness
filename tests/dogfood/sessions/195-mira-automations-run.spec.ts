/**
 * Session 195 — Mira actually runs an automation (Tue).
 *
 * Session 192 confirmed the Automations app is real (Workflows / Reminders /
 * Runs + a template gallery) but only *opened* the gallery — it never verified
 * a workflow can be added and fires. Mira's weekly cadence is a real use for
 * this: she adds the "Weekly review nudge" template (Fridays — her review day),
 * confirms it lands under Workflows (the empty-state should clear), then adds
 * the on-demand "Test notification" workflow and checks the Runs tab to see the
 * engine actually execute. This sharpens the DT-1 verdict: engine works? or is
 * it template chrome over nothing? Verdict from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira adds and runs an automation (195)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("195-mira-automations-run");
	try {
		s.chat(
			SPEAKER.Mira,
			"The automations app has templates — but do they actually run? Adding the weekly-review nudge to my Friday cadence and a test workflow, then checking the Runs tab to see if the engine really fires.",
		);

		const a = await s.openApp(APP.Automations);
		await a.waitForLoadState("domcontentloaded").catch(() => undefined);
		await a.waitForTimeout(1500);
		await s.shot(a, "01-open");

		// Open the template gallery.
		const newFromTemplate = a
			.locator("button:has-text('New from template'), [data-testid='automations-new']")
			.first();
		if (await newFromTemplate.count().catch(() => 0)) {
			await newFromTemplate.click().catch(() => undefined);
			await a.waitForTimeout(900);
		}
		await s.shot(a, "02-template-gallery");

		const before = await a
			.locator(".automations-workflow, .workflow-row, [data-workflow-id], li, .automations-list__item")
			.allInnerTexts()
			.catch(() => []);
		s.note(`workflow rows before add: ${JSON.stringify(before.slice(0, 8))}`);

		// Add a template by clicking the "Add" inside its card. Prefer the weekly
		// review (fits her cadence); fall back to the first Add button.
		const weeklyCard = a
			.locator(".automations-template, .template-card, [data-template]", {
				hasText: /weekly review/i,
			})
			.first();
		const weeklyAdd = weeklyCard.locator("button:has-text('Add')").first();
		const addBtn = (await weeklyAdd.count().catch(() => 0))
			? weeklyAdd
			: a.locator("button:has-text('Add')").first();
		if (await addBtn.count().catch(() => 0)) {
			await addBtn.click().catch(() => undefined);
			await a.waitForTimeout(1500);
			s.note("clicked Add on a template");
		} else {
			s.note("no Add button found on any template card");
		}
		await s.shot(a, "03-after-add");

		// Did a workflow land? The "No workflows yet" empty state should be gone.
		const emptyState = await a
			.locator("text=/no workflows yet/i")
			.first()
			.count()
			.catch(() => 0);
		const after = await a
			.locator(".automations-workflow, .workflow-row, [data-workflow-id], .automations-list__item")
			.allInnerTexts()
			.catch(() => []);
		s.note(`'No workflows yet' still shown: ${emptyState > 0}`);
		s.note(`workflow rows after add: ${JSON.stringify(after.slice(0, 8))}`);

		// Add the on-demand "Test notification" so we have something runnable.
		const testCard = a
			.locator(".automations-template, .template-card, [data-template]", {
				hasText: /test notification/i,
			})
			.first();
		const testAdd = testCard.locator("button:has-text('Add')").first();
		if (await testAdd.count().catch(() => 0)) {
			await testAdd.click().catch(() => undefined);
			await a.waitForTimeout(1200);
			s.note("added the on-demand Test notification workflow");
			await s.shot(a, "04-after-add-test");
		}

		// Try to run it on demand (a "Run" / "Run now" affordance on the row).
		const runNow = a
			.locator(
				"button:has-text('Run now'), button:has-text('Run'), [data-testid='run-now'], button[title*='run' i]",
			)
			.first();
		if (await runNow.count().catch(() => 0)) {
			await runNow.click().catch(() => undefined);
			await a.waitForTimeout(1500);
			s.note("clicked Run / Run now");
			await s.shot(a, "05-after-run");
		} else {
			s.note("no Run/Run-now affordance located on a workflow row");
		}

		// Check the Runs tab for an execution record — the proof the engine fired.
		const runsTab = a
			.locator("button:has-text('Runs'), [role='tab']:has-text('Runs'), .tab:has-text('Runs')")
			.first();
		if (await runsTab.count().catch(() => 0)) {
			await runsTab.click().catch(() => undefined);
			await a.waitForTimeout(1500);
			await s.shot(a, "06-runs-tab");
			const runRows = await a
				.locator(".automations-run, .run-row, [data-run-id], .automations-runs__item")
				.allInnerTexts()
				.catch(() => []);
			s.note(`run records (${runRows.length}): ${JSON.stringify(runRows.slice(0, 8))}`);
		}

		s.chat(
			SPEAKER.Mira,
			"Added the workflows and poked Run — reading the Runs tab + captures to see whether the engine actually executed or it's just template chrome.",
		);
		s.note("Verdict (do automations actually run?) decided from captures.");
	} finally {
		await s.finish();
	}
});
