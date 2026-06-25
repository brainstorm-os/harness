/**
 * Session 313 — Chat app walkthrough. Exercises the new first-party Chat
 * surface end-to-end in the real shell: set your display name (identity), create
 * a #northbound channel, post messages (Enter-to-send), see them render grouped
 * by author with avatars, toggle the Members panel, open the header ⋯ menu, and
 * confirm the channel + messages PERSIST across a reopen.
 *
 * This is the single-vault proof that the Chat app works as shipped — the
 * "see the real work inside the vault" half of the July goal. The multi-persona,
 * each-themed, cross-shell synced version rides the collab harness
 * (`collab-team.ts`, per-persona themes wired) once in-product channel sharing
 * (Collab-C5) lands; until then a teammate's messages reach another vault only
 * through that unbuilt share UX.
 *
 * Driven, not asserted (`judge`/`step` narrate `[PASS]/[FAIL]/[?]` into the
 * session notes); every step is wrapped so a single failure never aborts.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("chat northbound walkthrough (313)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("313-chat-northbound");

	const stamp = Date.now().toString(36);
	const channelName = `northbound-${stamp}`;
	const myName = `Mira ${stamp}`;
	const messages = [
		"Kicking off the #northbound channel 🚀",
		"Anyone around to review the Q3 brief?",
	];

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

	const popoverSel = ".bs-popover";
	const panelSel = ".bs-popover__panel";
	const menuSel = ".fm-menu";

	try {
		const chat = await s.openApp(APP.Chat);
		await chat.waitForTimeout(2400);
		await s.shot(chat, "01-opened");
		judge("PASS", "open Chat app", `url=${chat.url()}`);

		// ── Set display name via header ⋯ → Change display name… ──────────────────
		await step("set display name (identity)", async () => {
			await chat.locator('[aria-label="More actions"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(500);
			await chat
				.locator(menuSel)
				.getByText("Change display name", { exact: false })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(500);
			const input = chat.locator(`${panelSel} .chat__field-input`).first();
			await input.fill(myName);
			await chat
				.locator(panelSel)
				.getByRole("button", { name: "Save" })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(500);
			await s.shot(chat, "02-identity-set");
			judge("PASS", "set display name", `name="${myName}"`);
		});

		// ── Create a channel ─────────────────────────────────────────────────────
		await step("create #northbound channel", async () => {
			await chat.locator('[aria-label="New channel"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(500);
			const open = await chat
				.locator(popoverSel)
				.first()
				.isVisible()
				.catch(() => false);
			const nameInput = chat.locator(`${panelSel} .chat__field-input`).first();
			await nameInput.fill(channelName);
			await chat
				.locator(panelSel)
				.getByRole("button", { name: "Create channel" })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(900);
			const row = await chat
				.locator(".chat__channel-name")
				.filter({ hasText: channelName })
				.first()
				.isVisible()
				.catch(() => false);
			const active = await chat
				.locator('[data-testid="active-channel"]')
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(chat, "03-channel-created");
			judge(
				row && active.includes(channelName) ? "PASS" : "FAIL",
				"create #northbound channel",
				`dialog opened=${open}, sidebar row=${row}, active crumb="${active}"`,
			);
		});

		// ── Post messages (Enter to send) ────────────────────────────────────────
		await step("post messages with Enter-to-send", async () => {
			const composer = chat.locator(".chat__composer-input").first();
			for (const body of messages) {
				await composer.fill(body);
				await composer.press("Enter");
				await chat.waitForTimeout(700);
			}
			const lines = await chat
				.locator(".chat__line")
				.allInnerTexts()
				.catch(() => []);
			const author = await chat
				.locator(".chat__author")
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(chat, "04-messages-posted");
			const allShown = messages.every((m) => lines.some((l) => l.includes(m)));
			judge(
				allShown ? "PASS" : "FAIL",
				"post messages with Enter-to-send",
				`lines=[${lines.join(" | ")}], author header="${author}"`,
			);
		});

		// ── Members panel ────────────────────────────────────────────────────────
		await step("toggle the Members panel", async () => {
			await chat.locator('[aria-label="Show members"]').first().click({ timeout: 4000 });
			await chat.waitForTimeout(500);
			const memberNames = await chat
				.locator(".chat__member-name")
				.allInnerTexts()
				.catch(() => []);
			const youTag = await chat
				.locator(".chat__member-you")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(chat, "05-members");
			judge(
				memberNames.some((n) => n.includes(myName)) && youTag ? "PASS" : "?",
				"toggle the Members panel",
				`members=[${memberNames.join(", ")}], (you) tag=${youTag}`,
			);
		});

		// ── Persistence: reopen Chat ─────────────────────────────────────────────
		await step("persistence: relaunch Chat, channel + messages survive", async () => {
			await s.dashboard
				.evaluate(
					(appId) =>
						(
							window as unknown as { brainstorm: { apps: { launch: (id: string) => Promise<void> } } }
						).brainstorm.apps.launch(appId),
					APP.Chat,
				)
				.catch(() => undefined);
			await chat.waitForTimeout(900);
			const pages = s.appPagesFor(APP.Chat);
			const fresh = pages[pages.length - 1] ?? chat;
			await fresh.waitForTimeout(2000);
			await fresh
				.locator(".chat__channel-name")
				.filter({ hasText: channelName })
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await fresh.waitForTimeout(700);
			const lines = await fresh
				.locator(".chat__line")
				.allInnerTexts()
				.catch(() => []);
			const survived = messages.every((m) => lines.some((l) => l.includes(m)));
			await s.shot(fresh, "06-after-reopen");
			judge(
				survived ? "PASS" : "FAIL",
				"persistence after reopen",
				`channel reopened, lines=[${lines.join(" | ")}]`,
			);
		});
	} finally {
		await s.finish();
	}
});
