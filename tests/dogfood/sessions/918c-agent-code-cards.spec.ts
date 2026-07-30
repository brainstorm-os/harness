/**
 * Session 918c — the Agent's `propose-code-file` cards (AppForge-3, #365).
 *
 * Run with the scripted capture-only provider so the cards are deterministic:
 *   BRAINSTORM_DEMO_AGENT=appforge BRAINSTORM_DOGFOOD_SKIP_BUILD=1 \
 *     npx playwright test --config=playwright.dogfood.config.ts \
 *     tests/dogfood/sessions/918c-agent-code-cards.spec.ts
 *
 * Captures: the stacked tray with two code cards, the code preview, a very
 * long path in the path field, the approve / discard controls (idle, busy and
 * disabled), in both appearances.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("918c — agent propose-code-file cards", async () => {
	test.setTimeout(420_000);
	const s = await startSession("918c-agent-code-cards");
	const dash = s.dashboard;
	await dash.waitForTimeout(1500);
	await dash.keyboard.press("Escape");

	const agent = await s.openApp(APP.Agent);
	await agent.waitForTimeout(2500);
	await s.shot(agent, "agent-empty-light");

	const input = agent.locator('[data-testid="agent-input"] [contenteditable="true"]').first();
	await input.click();
	await agent.keyboard.type("Draft me a small app that tracks project milestones.", { delay: 12 });
	await agent.locator('[data-testid="agent-send"]').first().click();

	// The scripted provider stages one card per loop iteration.
	await agent
		.locator('[data-testid="agent-proposal"]')
		.nth(1)
		.waitFor({ timeout: 60_000 })
		.catch(() => undefined);
	await agent.waitForTimeout(2500);
	await s.shot(agent, "agent-tray-two-cards-light");

	const card = agent.locator('[data-testid="agent-proposal"]').first();
	if ((await card.count()) > 0) {
		await s.shot(agent, "agent-card-light", card);
	}

	const geometry = await agent.evaluate(() => {
		const out: string[] = [];
		for (const el of Array.from(document.querySelectorAll('[data-testid="agent-proposal"]'))) {
			const r = el.getBoundingClientRect();
			out.push(`card kind=${(el as HTMLElement).dataset.kind} left=${Math.round(r.left)} w=${Math.round(r.width)} h=${Math.round(r.height)}`);
			for (const part of Array.from(
				el.querySelectorAll(
					".agent-proposal__kind, .agent-proposal__language, .agent-proposal__field-label, .agent-proposal__input, .agent-proposal__code, .agent-proposal__btn",
				),
			)) {
				const pr = part.getBoundingClientRect();
				const cs = getComputedStyle(part);
				out.push(
					`  .${(part as HTMLElement).className.split(" ")[0]} left=${Math.round(pr.left)} h=${Math.round(pr.height)} ` +
						`overflowX=${cs.overflowX} whiteSpace=${cs.whiteSpace} maxH=${cs.maxHeight}`,
				);
			}
		}
		return out.join("\n");
	});
	s.note(`\n### Proposal card geometry (light)\n\`\`\`\n${geometry}\n\`\`\`\n`);

	// A very long path — does the field / card hold its width?
	const pathInput = card.locator("input.bs-input").first();
	if ((await pathInput.count()) > 0) {
		await pathInput.fill(
			"milestones/src/ui/panels/inspector/sections/deeply/nested/quarterly-revenue-reconciliation-pipeline.config.json",
		);
		await agent.waitForTimeout(600);
		await s.shot(agent, "agent-card-long-path-light", card);
	}

	// Emptying the primary field must disable Approve.
	if ((await pathInput.count()) > 0) {
		await pathInput.fill("");
		await agent.waitForTimeout(500);
		await s.shot(agent, "agent-card-empty-primary-light", card);
		await pathInput.fill("milestones/manifest.json");
		await agent.waitForTimeout(400);
	}

	// Dark appearance.
	const toDark = dash.locator('[aria-label="Switch to Dark appearance"]').first();
	if ((await toDark.count()) > 0) {
		await toDark.click();
		await dash.waitForTimeout(1400);
	}
	await s.shot(agent, "agent-tray-two-cards-dark");
	if ((await card.count()) > 0) await s.shot(agent, "agent-card-dark", card);

	// Discard one, approve the other.
	const discard = card.locator('[data-testid="agent-proposal-discard"]').first();
	if ((await discard.count()) > 0) {
		await discard.click();
		await agent.waitForTimeout(1200);
		await s.shot(agent, "agent-tray-after-discard-dark");
	}
	const approve = agent.locator('[data-testid="agent-proposal-approve"]').first();
	if ((await approve.count()) > 0) {
		await approve.click();
		await agent.waitForTimeout(2500);
		await s.shot(agent, "agent-tray-after-approve-dark");
	}

	const toLight = dash.locator('[aria-label="Switch to Light appearance"]').first();
	if ((await toLight.count()) > 0) {
		await toLight.click().catch(() => undefined);
		await dash.waitForTimeout(800);
	}
	await s.finish();
});
