/**
 * Session 316 — dogfood the new composer-context feature (just merged): the
 * @-mention / doc-link / media attach rail in the Agent and Chat composers.
 * Factual capture only (console.log + screenshots); verdict in triage.
 *
 * Drives the accumulated Northbound vault, so real titled entities exist to
 * mention. For each app: open it, type "@" in the composer, record whether the
 * shared typeahead opens with rows, pick the first row, and record whether a
 * chip lands in the context rail. Then open the "+" attach menu and record its
 * rows. No OS file dialog is driven (Playwright can't), so media upload is
 * verified only up to the menu affordance.
 */

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function countRows(page: Page): Promise<number> {
	return page
		.locator(".bs-typeahead-row")
		.count()
		.catch(() => -1);
}

test("composer-context — @mention + attach rail (agent + chat)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("316-composer-context");
	try {
		// ── Agent ──────────────────────────────────────────────────────────
		const agent = await s.openApp(APP.Agent);
		await agent.waitForTimeout(2600);
		s.note("\n### agent composer-context");

		const aInput = agent.locator('[data-testid="agent-input"]');
		await aInput.click().catch(() => undefined);
		await aInput.pressSequentially("@", { delay: 60 });
		await agent.waitForTimeout(700);
		const aRows0 = await countRows(agent);
		s.note(`agent: "@" → typeahead rows=${aRows0}`);
		await s.shot(agent, "agent-at-typeahead");

		// Narrow with a common letter to exercise host search.
		await aInput.pressSequentially("a", { delay: 60 });
		await agent.waitForTimeout(700);
		const aRows1 = await countRows(agent);
		s.note(`agent: "@a" → typeahead rows=${aRows1}`);

		if (aRows1 > 0) {
			await agent.locator(".bs-typeahead-row").first().click();
			await agent.waitForTimeout(500);
		}
		const aChips = await agent.locator(".bs-composer-context__chip").count();
		s.note(`agent: chips after pick=${aChips}`);
		await s.shot(agent, "agent-chip");

		// Attach "+" menu.
		await agent
			.locator(".bs-composer-context__attach")
			.click()
			.catch(() => undefined);
		await agent.waitForTimeout(500);
		const aMenu = await agent
			.locator(".fm-row")
			.allInnerTexts()
			.catch(() => []);
		s.note(`agent: attach menu rows=${JSON.stringify(aMenu)}`);
		await s.shot(agent, "agent-attach-menu");
		await agent.keyboard.press("Escape").catch(() => undefined);

		// ── Chat ───────────────────────────────────────────────────────────
		const chat = await s.openApp(APP.Chat);
		await chat.waitForTimeout(2600);
		s.note("\n### chat composer-context");

		let hasChannel = (await chat.locator('[data-testid="active-channel"]').count()) > 0;
		s.note(`chat: active channel present=${hasChannel}`);
		if (!hasChannel) {
			// Create one so the composer exists. Empty-state primary button or the
			// sidebar "+" both open the New-channel popover.
			await chat
				.locator(".chat__placeholder .bs-btn--primary, .chat__sidebar-header .chat__icon-btn")
				.first()
				.click()
				.catch(() => undefined);
			await chat.waitForTimeout(500);
			await chat.locator(".chat__field-input").first().fill("dogfood-316");
			await chat.waitForTimeout(200);
			await chat
				.locator(".bs-btn--primary")
				.filter({ hasText: /create channel/i })
				.first()
				.click()
				.catch(() => undefined);
			await chat.waitForTimeout(1200);
			hasChannel = (await chat.locator('[data-testid="active-channel"]').count()) > 0;
			s.note(`chat: created channel → active=${hasChannel}`);
			await s.shot(chat, "chat-after-create");
		}
		const cInput = chat.locator(".chat__composer-input");
		if ((await cInput.count()) > 0) {
			await cInput.click().catch(() => undefined);
			await cInput.pressSequentially("@", { delay: 60 });
			await chat.waitForTimeout(700);
			const cRows = await countRows(chat);
			s.note(`chat: "@" → typeahead rows=${cRows}`);
			await s.shot(chat, "chat-at-typeahead");
			if (cRows > 0) {
				await chat.locator(".bs-typeahead-row").first().click();
				await chat.waitForTimeout(500);
			}
			const cChips = await chat.locator(".bs-composer-context__chip").count();
			s.note(`chat: chips after pick=${cChips}`);
			await s.shot(chat, "chat-chip");
			await chat
				.locator(".bs-composer-context__attach")
				.click()
				.catch(() => undefined);
			await chat.waitForTimeout(400);
			const cMenu = await chat
				.locator(".fm-row")
				.allInnerTexts()
				.catch(() => []);
			s.note(`chat: attach menu rows=${JSON.stringify(cMenu)}`);
			await s.shot(chat, "chat-attach-menu");
			await chat.keyboard.press("Escape").catch(() => undefined);

			// Send a message carrying the attachment + verify the chip on the bubble.
			if (cChips > 0) {
				await cInput.click().catch(() => undefined);
				await cInput.pressSequentially("look at this", { delay: 30 });
				await chat.keyboard.press("Enter");
				await chat.waitForTimeout(1500);
				const bubbleChips = await chat
					.locator('[data-testid="message-attachments"] .chat__attachment')
					.count();
				s.note(`chat: attachment chips on sent bubble=${bubbleChips}`);
				await s.shot(chat, "chat-sent-with-attachment");
			}
		} else {
			s.note("chat: no composer (no channel) — skipped");
		}

		s.note("\nDONE 316");
	} finally {
		await s.finish();
	}
});
