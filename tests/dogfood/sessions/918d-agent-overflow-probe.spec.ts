/**
 * Session 918d — is the Agent window horizontally overflowing when a
 * `propose-code-file` card is staged? (Follow-up probe for 918c shot 02.)
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("918d — agent horizontal overflow probe", async () => {
	test.setTimeout(420_000);
	const s = await startSession("918d-agent-overflow-probe");
	const dash = s.dashboard;
	await dash.waitForTimeout(1500);
	await dash.keyboard.press("Escape");

	const agent = await s.openApp(APP.Agent);
	await agent.waitForTimeout(2500);

	const before = await agent.evaluate(() => {
		const de = document.documentElement;
		return `documentElement scrollW=${de.scrollWidth} clientW=${de.clientWidth} scrollLeft=${de.scrollLeft}`;
	});
	s.note(`\n### Before any proposal\n\`\`\`\n${before}\n\`\`\`\n`);

	const input = agent.locator('[data-testid="agent-input"] [contenteditable="true"]').first();
	await input.click();
	await agent.keyboard.type("Draft me a small app that tracks project milestones.", { delay: 10 });
	await agent.locator('[data-testid="agent-send"]').first().click();
	await agent
		.locator('[data-testid="agent-proposal"]')
		.nth(1)
		.waitFor({ timeout: 60_000 })
		.catch(() => undefined);
	await agent.waitForTimeout(2500);

	const after = await agent.evaluate(() => {
		const out: string[] = [];
		const de = document.documentElement;
		out.push(
			`documentElement scrollW=${de.scrollWidth} clientW=${de.clientWidth} scrollLeft=${de.scrollLeft}`,
		);
		out.push(`body scrollW=${document.body.scrollWidth} clientW=${document.body.clientWidth}`);
		for (const sel of [
			".agent",
			".agent__main",
			".agent__transcript",
			".agent__proposals",
			".agent-proposal",
			".agent-proposal__code",
			".agent__sidebar",
		]) {
			const el = document.querySelector(sel) as HTMLElement | null;
			if (!el) {
				out.push(`${sel}: (absent)`);
				continue;
			}
			const r = el.getBoundingClientRect();
			out.push(
				`${sel}: rect ${Math.round(r.left)}..${Math.round(r.right)} scrollW=${el.scrollWidth} clientW=${el.clientWidth} overflowX=${getComputedStyle(el).overflowX} minWidth=${getComputedStyle(el).minWidth}`,
			);
		}
		return out.join("\n");
	});
	s.note(`\n### With two code-file cards staged\n\`\`\`\n${after}\n\`\`\`\n`);
	await s.shot(agent, "agent-overflow");
	await agent.evaluate(() => {
		document.documentElement.scrollLeft = 0;
	});
	await agent.waitForTimeout(400);
	await s.shot(agent, "agent-overflow-scrolled-home");
	await s.finish();
});
