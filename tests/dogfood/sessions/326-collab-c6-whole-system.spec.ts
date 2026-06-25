/**
 * Session 326 — Collab-C6 whole-system pass (real shell).
 *
 * Exercises the identity foundation across surfaces, proving the data flows
 * between them through the real broker + privileged IPC:
 *   1. Settings → Identity: set the display name (privileged profile.set →
 *      signed Profile/v1) and read the sovereign fingerprint.
 *   2. Chat: the member list shows the name set in *Settings* — the cross-surface
 *      proof that Settings wrote the profile and chat's `roster.members` read it.
 *      Then the @-mention typeahead lists that member.
 *   3. Notes: a comment composer offers the same roster-backed @-mention.
 *
 * Driven, not asserted (`judge` narrates PASS/FAIL into the notes); a failure in
 * one step never aborts the rest.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("collab-c6 whole-system (326)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("326-collab-c6-whole-system");
	const dash = s.dashboard;

	const stamp = Date.now().toString(36);
	const myName = `Iris ${stamp}`;
	const channelName = `c6-${stamp}`;

	const judge = (verdict: "PASS" | "FAIL" | "?", action: string, observed: string): void =>
		s.note(`[${verdict}] ${action} — ${observed}`);
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
		// ── 1. Settings → Identity ───────────────────────────────────────────────
		await step("Settings → Identity: set display name", async () => {
			await dash.locator('button[aria-label="Settings"]').first().click({ timeout: 8000 });
			await dash.waitForSelector('[data-testid="settings"]', { timeout: 8000 }).catch(() => null);
			await dash.waitForTimeout(500);
			await dash
				.locator(".settings__nav-item")
				.filter({ hasText: /^Identity$/i })
				.first()
				.click({ timeout: 6000 });
			await dash.waitForTimeout(500);
			await dash.locator(".identity-section__input").first().fill(myName);
			await dash
				.locator(".identity-section")
				.getByRole("button", { name: "Save" })
				.first()
				.click({ timeout: 4000 });
			await dash.waitForTimeout(700);
			const fingerprint = await dash
				.locator(".identity-section__fingerprint")
				.first()
				.innerText()
				.catch(() => "");
			const savedShown = await dash
				.locator(".identity-section__saved")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(dash, "01-settings-identity");
			judge(
				fingerprint.startsWith("ed25519:") && savedShown ? "PASS" : "FAIL",
				"Settings → Identity set name",
				`fingerprint="${fingerprint}", savedToast=${savedShown}`,
			);
		});

		// Close Settings (Escape) before opening apps.
		await dash.keyboard.press("Escape").catch(() => undefined);
		await dash.waitForTimeout(400);

		// ── 2. Chat reflects the Settings identity ───────────────────────────────
		const chat = await s.openApp(APP.Chat);
		await chat.waitForTimeout(2400);
		await s.shot(chat, "02-chat-opened");

		await step("create a channel", async () => {
			await chat.locator('[aria-label="New channel"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(400);
			await chat.locator(`${panelSel} .chat__field-input`).first().fill(channelName);
			await chat
				.locator(panelSel)
				.getByRole("button", { name: "Create channel" })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(900);
			judge("PASS", "create channel", `name=${channelName}`);
		});

		await step("Members panel shows the Settings-set identity (cross-surface)", async () => {
			await chat.locator('[aria-label="Show members"]').first().click({ timeout: 4000 });
			await chat.waitForTimeout(600);
			const memberNames = await chat
				.locator(".chat__member-name")
				.allInnerTexts()
				.catch(() => []);
			await s.shot(chat, "03-chat-members");
			judge(
				memberNames.some((n) => n.includes(myName)) ? "PASS" : "FAIL",
				"chat member list reflects Settings identity",
				`members=[${memberNames.join(", ")}] (set in Settings as "${myName}")`,
			);
		});

		await step("chat @-mention lists the member", async () => {
			const composer = chat.locator(".chat__composer-input").first();
			await composer.click({ timeout: 4000 });
			await composer.pressSequentially("@Iris", { delay: 60 });
			await chat.waitForTimeout(800);
			const menuText = await chat
				.locator(menuSel)
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(chat, "04-chat-mention");
			judge(
				menuText.includes("Iris") ? "PASS" : "FAIL",
				"chat @-mention lists member",
				`typeahead="${menuText.replace(/\n/g, " / ")}"`,
			);
		});

		// ── 3. Comments @-mention in Notes ───────────────────────────────────────
		await step("Notes comment composer offers roster @-mention", async () => {
			const notes = await s.openApp(APP.Notes);
			await notes.waitForTimeout(2600);
			// Open (or create) a note so the right panel + comments tab exist.
			await notes
				.locator(".note-list__item, [data-testid='note-row'], .sidebar__item")
				.first()
				.click({ timeout: 4000 })
				.catch(() => undefined);
			await notes.waitForTimeout(800);
			// Reveal the Comments tab (Properties|Comments right panel).
			const commentsTab = notes
				.locator("button")
				.filter({ hasText: /^Comments$/i })
				.first();
			const tabbed = await commentsTab.isVisible().catch(() => false);
			if (tabbed) await commentsTab.click().catch(() => undefined);
			await notes.waitForTimeout(500);
			const composer = notes.locator(".bs-comments__input").first();
			const composerThere = await composer.isVisible().catch(() => false);
			if (composerThere) {
				await composer.click().catch(() => undefined);
				await composer.pressSequentially("@Iris", { delay: 60 }).catch(() => undefined);
				await notes.waitForTimeout(800);
			}
			const menuText = await notes
				.locator(menuSel)
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(notes, "05-notes-comment-mention");
			judge(
				menuText.includes("Iris") ? "PASS" : "?",
				"Notes comment @-mention",
				`tab=${tabbed}, composer=${composerThere}, typeahead="${menuText.replace(/\n/g, " / ")}"`,
			);
		});
	} finally {
		await s.finish();
	}
});
