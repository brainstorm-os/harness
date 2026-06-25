/**
 * Session 327 — Composer resize / layout measurement (real shell).
 *
 * User report: the agent composer "looks bad", and the chat composer "resizes
 * and gets bigger when only 2 characters are typed". A standalone CSS repro
 * could NOT reproduce a height jump, so this measures the REAL shell (real
 * Lexical DOM, real Electron Chromium, real fonts/tokens) to find the truth:
 * composer-input height EMPTY vs after typing 2 chars, plus the attach-`+` /
 * input / send button heights (alignment).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("composer resize measure (327)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("327-composer-resize-measure");

	const heights = async (page: import("@playwright/test").Page, sels: string[]) =>
		page.evaluate(
			(list) =>
				list.map((sel) => {
					const el = document.querySelector(sel);
					return el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : -1;
				}),
			sels,
		);

	try {
		// ── CHAT ───────────────────────────────────────────────────────────────
		const chat = await s.openApp(APP.Chat);
		await chat.waitForTimeout(2400);
		const stamp = Date.now().toString(36);
		await chat.locator('[aria-label="New channel"]').first().click({ timeout: 8000 });
		await chat.waitForTimeout(400);
		await chat.locator(".bs-popover__panel .chat__field-input").first().fill(`m-${stamp}`);
		await chat
			.locator(".bs-popover__panel")
			.getByRole("button", { name: "Create channel" })
			.first()
			.click({ timeout: 4000 });
		await chat.waitForTimeout(900);

		const chatSels = [
			".chat__composer-input",
			".chat__send",
			".chat__composer .bs-composer-context__attach",
		];
		const chatEmpty = await heights(chat, chatSels);
		await s.shot(chat, "chat-01-empty");
		await chat.locator(".chat__composer-input").first().click({ timeout: 6000 });
		await chat.waitForTimeout(200);
		const chatFocused = await heights(chat, chatSels);
		await chat.keyboard.type("ab", { delay: 40 });
		await chat.waitForTimeout(400);
		const chatTyped = await heights(chat, chatSels);
		await s.shot(chat, "chat-02-typed");
		s.note(
			`[CHAT] input/send/attach heights — empty=${JSON.stringify(chatEmpty)} focused=${JSON.stringify(chatFocused)} typed2=${JSON.stringify(chatTyped)}`,
		);
		s.note(
			`[CHAT] resize delta empty→typed input = ${(chatTyped[0] ?? 0) - (chatEmpty[0] ?? 0)}px (0 = no jump)`,
		);

		// ── AGENT ──────────────────────────────────────────────────────────────
		const agent = await s.openApp(APP.Agent);
		await agent.waitForTimeout(2600);
		const agentSels = [
			".agent__input",
			".agent__send",
			".agent__composer .bs-composer-context__attach",
		];
		const agentEmpty = await heights(agent, agentSels);
		await s.shot(agent, "agent-01-empty");
		await agent
			.locator(".agent__input")
			.first()
			.click({ timeout: 6000 })
			.catch(() => undefined);
		await agent.waitForTimeout(200);
		const agentFocused = await heights(agent, agentSels);
		await agent.keyboard.type("ab", { delay: 40 });
		await agent.waitForTimeout(400);
		const agentTyped = await heights(agent, agentSels);
		await s.shot(agent, "agent-02-typed");
		s.note(
			`[AGENT] input/send/attach heights — empty=${JSON.stringify(agentEmpty)} focused=${JSON.stringify(agentFocused)} typed2=${JSON.stringify(agentTyped)}`,
		);
		s.note(
			`[AGENT] resize delta empty→typed input = ${(agentTyped[0] ?? 0) - (agentEmpty[0] ?? 0)}px (0 = no jump)`,
		);
		s.note(
			`[AGENT] alignment: input=${agentEmpty[0]} send=${agentEmpty[1]} attach=${agentEmpty[2]} (attach should match input/send)`,
		);

		// Regression guards: typing 2 chars must not grow either composer, and the
		// attach "+" must sit at the same control height as the input/send so all
		// three line up on the composer row.
		expect((chatTyped[0] ?? 0) - (chatEmpty[0] ?? 0)).toBe(0);
		expect((agentTyped[0] ?? 0) - (agentEmpty[0] ?? 0)).toBe(0);
		expect(agentEmpty[2]).toBe(agentEmpty[0]);
		expect(chatEmpty[2]).toBe(chatEmpty[0]);
	} finally {
		await s.finish();
	}
});
