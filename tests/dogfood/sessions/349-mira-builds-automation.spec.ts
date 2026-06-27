/**
 * Session 349 — Mira builds an automation (deep-probe an in-flight app).
 *
 * The core-CRUD + breadth sweeps open Automations but never drive its builder.
 * This turn does what a real operator does: open Automations, start a New
 * workflow, and try to wire a trigger → step → save. The builder is a
 * menu/picker-heavy surface (trigger kinds, the step palette, bindings) — the
 * kind of place polish friction hides. Discovery-first (dump the app's
 * affordances) so a missed selector teaches us the real surface instead of
 * blinding the run; every interaction is best-effort. Per the loop protocol the
 * spec records intent + neutral observations only; the verdict comes from the
 * captures.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Mira builds an automation — New workflow → step palette (349)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("349-mira-builds-automation");
	s.chat(
		SPEAKER.Mira,
		"Trying to actually automate something today — when a task lands, nudge me. Opening Automations and building a real workflow: trigger, a step, save. Let's see how far the builder lets me get.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const auto = await s.openApp(APP.Automations);
		await auto.waitForTimeout(1800);
		await s.shot(auto, "01-automations-open");

		// Discovery: what can Mira actually act on here?
		const inv = await auto.evaluate(() => {
			const testids = new Set<string>();
			for (const el of document.querySelectorAll("[data-testid]"))
				testids.add(el.getAttribute("data-testid") ?? "");
			const labels = new Set<string>();
			for (const el of [...document.querySelectorAll("[aria-label]")].slice(
				0,
				50,
			))
				labels.add(el.getAttribute("aria-label") ?? "");
			const buttons = [...document.querySelectorAll("button")]
				.map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 30);
			return { testids: [...testids], labels: [...labels], buttons };
		});
		s.note(`=== testids === ${JSON.stringify(inv.testids)}`);
		s.note(`=== aria-labels === ${JSON.stringify(inv.labels)}`);
		s.note(`=== buttons === ${JSON.stringify(inv.buttons)}`);

		// Start a New workflow.
		const newBtn = auto.locator(
			'button:has-text("New workflow"), [aria-label="New workflow"]',
		);
		const hasNew = (await newBtn.count().catch(() => 0)) > 0;
		s.note(`\n"New workflow" affordance present: ${hasNew}`);
		if (hasNew) {
			await newBtn
				.first()
				.click()
				.catch(() => undefined);
			await auto.waitForTimeout(1200);
			await s.shot(auto, "02-builder-open");
		}

		// Add a step — capture the step palette (what kinds are offered).
		const addStep = auto.locator(
			'button:has-text("Add step"), [aria-label="Add step"]',
		);
		const hasAddStep = (await addStep.count().catch(() => 0)) > 0;
		s.note(`"Add step" affordance present: ${hasAddStep}`);
		if (hasAddStep) {
			await addStep
				.first()
				.click()
				.catch(() => undefined);
			await auto.waitForTimeout(900);
			await s.shot(auto, "03-step-palette");
			const paletteItems = (
				await auto
					.locator(
						'.fm-menu [role="option"], [role="menuitem"], [role="option"]',
					)
					.allInnerTexts()
					.catch(() => [])
			)
				.map((t) => t.replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 20);
			s.note(
				`step palette offered ${paletteItems.length} kind(s): ${JSON.stringify(paletteItems)}`,
			);
			// Best-effort: pick the first offered step kind, then capture the config.
			const first = auto
				.locator('.fm-menu [role="option"], [role="menuitem"], [role="option"]')
				.first();
			if ((await first.count().catch(() => 0)) > 0) {
				await first.click().catch(() => undefined);
				await auto.waitForTimeout(900);
				await s.shot(auto, "04-step-configured");
			}
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors building an automation").toEqual([]);
	} finally {
		await s.finish();
	}
});
