/**
 * Session 350 — Marcus design-reviews the Agent app (specialist turn).
 *
 * Two consecutive Mira turns (348/349) → a specialist; Priya ran 347, so Marcus
 * takes this one. His lens is visual + interaction craft: first-impression
 * (empty state), the composer, the context rail, and the conversation-settings
 * surface (Tools / Model / Token budget). The Agent app is in-flight and Stage
 * 11 (AI broker) isn't wired, so this is also a fair test of how honestly the
 * empty / no-provider states are designed. The spec only NAVIGATES to and
 * CAPTURES the design surfaces + collects console errors; Marcus's specific,
 * substantiated friction is written from the screenshots afterward (verdict
 * never computed in-spec).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Marcus design-reviews the Agent app — empty state, composer, settings (350)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("350-marcus-agent-design-review");
	s.chat(
		SPEAKER.Marcus,
		"Taking a hard design look at the Agent app — first impression, the composer, and the settings surface. I want to see whether the empty state earns trust and whether the chrome holds together.",
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
		const agent = await s.openApp(APP.Agent);
		await agent.waitForTimeout(1800);
		await s.shot(agent, "01-empty-state");

		const inv = await agent.evaluate(() => {
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
			const bodyText = (document.body.innerText ?? "")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 300);
			return { labels: [...labels], buttons, bodyText };
		});
		s.note(`=== aria-labels === ${JSON.stringify(inv.labels)}`);
		s.note(`=== buttons === ${JSON.stringify(inv.buttons)}`);
		s.note(`=== body text (start) === ${inv.bodyText}`);

		// Composer: click into it, capture the resting + focused state.
		const composer = agent.locator(
			'[placeholder="Message the agent…"], textarea, [contenteditable="true"]',
		);
		if ((await composer.count().catch(() => 0)) > 0) {
			await composer
				.first()
				.click()
				.catch(() => undefined);
			await agent.waitForTimeout(400);
			await composer
				.first()
				.type("Summarize my open tasks for the week", { delay: 8 })
				.catch(() => undefined);
			await agent.waitForTimeout(400);
			await s.shot(agent, "02-composer-filled");
		} else {
			s.note("\nno composer input found (Message the agent…)");
		}

		// Context rail: "Add context" — the @-mention/doc-link/media rail.
		const addCtx = agent.locator(
			'button:has-text("Add context"), [aria-label="Add context"]',
		);
		if ((await addCtx.count().catch(() => 0)) > 0) {
			await addCtx
				.first()
				.click()
				.catch(() => undefined);
			await agent.waitForTimeout(700);
			await s.shot(agent, "03-context-rail");
			await agent.keyboard.press("Escape").catch(() => undefined);
			await agent.waitForTimeout(200);
		} else {
			s.note('no "Add context" affordance found');
		}

		// Conversation settings: Tools / Model / Token budget.
		const settings = agent.locator(
			'[aria-label="Conversation settings"], button:has-text("Conversation settings")',
		);
		if ((await settings.count().catch(() => 0)) > 0) {
			await settings
				.first()
				.click()
				.catch(() => undefined);
			await agent.waitForTimeout(700);
			await s.shot(agent, "04-conversation-settings");
		} else {
			s.note("no Conversation settings affordance found");
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(
			errors,
			"no console/page errors during the Agent design review",
		).toEqual([]);
	} finally {
		await s.finish();
	}
});
