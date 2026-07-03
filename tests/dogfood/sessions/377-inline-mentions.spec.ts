/**
 * Session 377 — Slack-style inline @-mentions (chat + agent) + avatar fix.
 *
 * Verifies the inline-mention rework end-to-end in the real shell:
 *   1. Chat: picking a person from the `@` typeahead plants an inline mention
 *      chip in the composer (no rail chip above the composer).
 *   2. Sending renders the mention inline in the message body — NOT as a
 *      boxed attachment chip under the message.
 *   3. Agent: the composer is now a CompactEditor — the same `@` flow plants
 *      an inline chip there too.
 *
 * Driven, not asserted (`judge` narrates `[PASS]/[FAIL]/[?]` into the notes).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("inline mentions in chat + agent (377)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("377-inline-mentions");

	const stamp = Date.now().toString(36);
	const channelName = `mentions-${stamp}`;
	const myName = `Razor ${stamp}`;

	const judge = (verdict: "PASS" | "FAIL" | "?", action: string, observed: string): void => {
		s.note(`[${verdict}] ${action} — ${observed}`);
	};
	const step = async (action: string, fn: () => Promise<void>): Promise<void> => {
		try {
			await fn();
		} catch (error) {
			judge("FAIL", action, `threw: ${(error as Error).message}`);
		}
	};

	const panelSel = ".bs-popover__panel";
	const menuSel = ".fm-menu";

	try {
		const chat = await s.openApp(APP.Chat);
		await chat.waitForTimeout(2400);

		// ── Identity + channel (same path as session 325) ────────────────────────
		await step("set display name", async () => {
			await chat.locator('[aria-label="More actions"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(400);
			await chat
				.locator(menuSel)
				.getByText("Change display name", { exact: false })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(400);
			await chat.locator(`${panelSel} .chat__field-input, ${panelSel} .bs-input`).first().fill(myName);
			await chat.locator(panelSel).getByRole("button", { name: "Save" }).first().click({ timeout: 4000 });
			await chat.waitForTimeout(600);
		});
		await step("create channel", async () => {
			await chat.locator('[aria-label="New channel"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(400);
			await chat.locator(`${panelSel} .chat__field-input, ${panelSel} .bs-input`).first().fill(channelName);
			await chat
				.locator(panelSel)
				.getByRole("button", { name: "Create channel" })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(900);
		});

		// ── @-mention commits as an INLINE chip in the composer ──────────────────
		await step("chat: @-mention plants an inline chip in the composer", async () => {
			const composer = chat.locator(".chat__composer-input").first();
			await composer.click({ timeout: 4000 });
			await composer.pressSequentially("ping @Razor", { delay: 50 });
			await chat.waitForTimeout(800);
			await s.shot(chat, "01-typeahead-open");
			// Commit the highlighted row (the roster member).
			await chat.keyboard.press("Enter");
			await chat.waitForTimeout(600);
			const chipInComposer = await chat
				.locator(".chat__composer-input .notes__mention-chip")
				.first()
				.innerText()
				.catch(() => "");
			const railChips = await chat.locator(".bs-composer-context__chip").count();
			await s.shot(chat, "02-inline-chip-in-composer");
			judge(
				chipInComposer.includes("Razor") && railChips === 0 ? "PASS" : "FAIL",
				"inline chip in composer, no rail chip",
				`chip="${chipInComposer}", railChips=${railChips}`,
			);
		});

		// ── Send → mention renders inline in the message, no attachment box ──────
		await step("chat: sent message renders the mention inline", async () => {
			await chat.keyboard.press("Enter");
			await chat.waitForTimeout(1200);
			const inlineInMessage = await chat
				.locator(".chat__line--rich .notes__mention-chip")
				.first()
				.innerText()
				.catch(() => "");
			const attachmentChips = await chat.locator(".chat__attachment").count();
			await s.shot(chat, "03-sent-message-inline-mention");
			judge(
				inlineInMessage.includes("Razor") && attachmentChips === 0 ? "PASS" : "FAIL",
				"mention inline in sent message, no attachment chip",
				`inline="${inlineInMessage}", attachmentChips=${attachmentChips}`,
			);
		});

		// ── Agent: same flow in the (now CompactEditor) composer ─────────────────
		const agent = await s.openApp(APP.Agent);
		await agent.waitForTimeout(2400);
		await step("agent: @-mention plants an inline chip in the composer", async () => {
			const composer = agent.locator('[data-testid="agent-input"] .bs-compact-editor__content').first();
			await composer.click({ timeout: 4000 });
			await composer.pressSequentially("summarize @", { delay: 50 });
			await agent.waitForTimeout(900);
			await s.shot(agent, "04-agent-typeahead");
			const menuRows = await agent
				.locator(menuSel)
				.first()
				.innerText()
				.catch(() => "");
			await agent.keyboard.press("Enter");
			await agent.waitForTimeout(600);
			const chip = await agent
				.locator('[data-testid="agent-input"] .notes__mention-chip')
				.first()
				.innerText()
				.catch(() => "");
			const railChips = await agent.locator(".bs-composer-context__chip").count();
			await s.shot(agent, "05-agent-inline-chip");
			judge(
				chip.length > 1 && railChips === 0 ? "PASS" : "FAIL",
				"agent inline chip, no rail chip",
				`chip="${chip}", railChips=${railChips}, typeahead="${menuRows.replace(/\n/g, " / ")}"`,
			);
		});
	} finally {
		await s.finish();
	}
});
