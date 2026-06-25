/**
 * Session 325 — Collab-C6 roster + @-mention verification (real shell).
 *
 * Proves the identity foundation end-to-end through the real broker + capability
 * gate, single-vault:
 *   1. Set the display name → `roster.setSelf` signs + writes a `Profile/v1`.
 *   2. The Members panel renders that name → `roster.members` joined the channel's
 *      access record (just self here) to the resolved profile. A regression here
 *      means the new roster path (not the old `storage.kv` personRef) is broken.
 *   3. The composer @-mention typeahead lists the member by name → the mention
 *      search redirects to the roster (vault members), not arbitrary Person/v1.
 *
 * Cross-user mentions + their notifications are sync-gated (Collab-C5) and out of
 * scope for this single-vault proof — see the plan's Collab-C6 note.
 *
 * Driven, not asserted (`judge` narrates `[PASS]/[FAIL]/[?]` into the notes).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("chat roster + @-mention (325)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("325-chat-roster-mention");

	const stamp = Date.now().toString(36);
	const channelName = `roster-${stamp}`;
	const myName = `Ada ${stamp}`;

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
		await s.shot(chat, "01-opened");
		judge("PASS", "open Chat app", `url=${chat.url()}`);

		// ── Set display name → writes a signed Profile/v1 via roster.setSelf ──────
		await step("set display name (→ Profile/v1)", async () => {
			await chat.locator('[aria-label="More actions"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(400);
			await chat
				.locator(menuSel)
				.getByText("Change display name", { exact: false })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(400);
			await chat.locator(`${panelSel} .chat__field-input`).first().fill(myName);
			await chat
				.locator(panelSel)
				.getByRole("button", { name: "Save" })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(600);
			await s.shot(chat, "02-identity-set");
			judge("PASS", "set display name", `name="${myName}"`);
		});

		// ── Create a channel ─────────────────────────────────────────────────────
		await step("create channel", async () => {
			await chat.locator('[aria-label="New channel"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(400);
			await chat.locator(`${panelSel} .chat__field-input`).first().fill(channelName);
			await chat
				.locator(panelSel)
				.getByRole("button", { name: "Create channel" })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(900);
			const active = await chat
				.locator('[data-testid="active-channel"]')
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(chat, "03-channel");
			judge(active.includes(channelName) ? "PASS" : "FAIL", "create channel", `crumb="${active}"`);
		});

		// ── Members panel resolves the real name via roster.members ──────────────
		await step("members panel shows the roster name", async () => {
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
			await s.shot(chat, "04-members");
			judge(
				memberNames.some((n) => n.includes(myName)) && youTag ? "PASS" : "FAIL",
				"members panel shows roster name",
				`members=[${memberNames.join(", ")}], (you)=${youTag}`,
			);
		});

		// ── @-mention typeahead lists the vault member (roster-backed) ───────────
		await step("@-mention lists the member", async () => {
			const composer = chat.locator(".chat__composer-input").first();
			await composer.click({ timeout: 4000 });
			await composer.pressSequentially("@", { delay: 60 });
			await chat.waitForTimeout(700);
			let menuText = await chat
				.locator(menuSel)
				.first()
				.innerText()
				.catch(() => "");
			// Narrow the query to the member's name to confirm the search filters it.
			await composer.pressSequentially("Ada", { delay: 60 });
			await chat.waitForTimeout(700);
			menuText = await chat
				.locator(menuSel)
				.first()
				.innerText()
				.catch(() => menuText);
			await s.shot(chat, "05-mention");
			judge(
				menuText.includes("Ada") ? "PASS" : "FAIL",
				"@-mention lists the member",
				`typeahead="${menuText.replace(/\n/g, " / ")}"`,
			);
		});

		// ── `@` is people-scoped; documents pin through their own affordance ─────
		// The composer "+" menu offers a person-mention row AND a separate
		// "Link a document…" row — the two never share one list (the fix here).
		await step("attach menu separates people from documents", async () => {
			await chat.keyboard.press("Escape");
			await chat.waitForTimeout(250);
			await chat.locator(".bs-composer-context__attach").first().click({ timeout: 4000 });
			await chat.waitForTimeout(500);
			const attachMenu = await chat
				.locator(menuSel)
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(chat, "06-attach-menu");
			const hasMention = /mention a person/i.test(attachMenu);
			const hasLink = /link a document/i.test(attachMenu);
			judge(
				hasMention && hasLink ? "PASS" : "FAIL",
				"attach menu separates people from documents",
				`menu="${attachMenu.replace(/\n/g, " / ")}" (mention=${hasMention}, link=${hasLink})`,
			);
		});
	} finally {
		await s.finish();
	}
});
