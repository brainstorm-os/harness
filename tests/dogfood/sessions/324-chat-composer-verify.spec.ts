/**
 * Session 324 — Chat composer real-shell verification.
 *
 * Reproduces the user report "the chat form does not work and is super huge".
 * Root cause was `compact-editor.css` being tree-shaken out of the chat bundle
 * (bare side-effect import in editor `index.ts`, dropped because the package is
 * `sideEffects: ["*.css"]`), so the CompactEditor rendered unstyled: no height
 * constraint (giant box) and a placeholder with no `pointer-events: none`
 * overlapping the input (clicks/typing swallowed).
 *
 * Unlike 313 (which `fill()`s the composer and so bypasses the pointer-events
 * overlap), this probe drives it like a human: MEASURE the composer height,
 * CLICK into it, type via the keyboard, and click the Send BUTTON. That is the
 * path the broken CSS actually breaks.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("chat composer real-shell verify (324)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("324-chat-composer-verify");

	const stamp = Date.now().toString(36);
	const channelName = `compose-${stamp}`;
	const typed = `typed-by-click ${stamp}`;

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

	try {
		const chat = await s.openApp(APP.Chat);
		await chat.waitForTimeout(2400);
		await s.shot(chat, "01-opened");
		judge("PASS", "open Chat app", `url=${chat.url()}`);

		// Need an active channel for the composer to render.
		await step("create a channel", async () => {
			await chat.locator('[aria-label="New channel"]').first().click({ timeout: 8000 });
			await chat.waitForTimeout(500);
			const nameInput = chat.locator(`${panelSel} .chat__field-input`).first();
			await nameInput.fill(channelName);
			await chat
				.locator(panelSel)
				.getByRole("button", { name: "Create channel" })
				.first()
				.click({ timeout: 4000 });
			await chat.waitForTimeout(900);
			await s.shot(chat, "02-channel");
			judge("PASS", "create channel", channelName);
		});

		// ── "super huge" check: measure composer geometry ────────────────────────
		await step("composer is a sane single-line height (not huge)", async () => {
			const input = chat.locator(".chat__composer-input").first();
			const box = await input.boundingBox();
			const wrap = await chat.locator(".chat__composer").first().boundingBox();
			// Empty composer should sit near its 40px single-line min-height; the CSS
			// caps growth at max-height 160px. Anything past ~200px means the
			// stylesheet didn't load (the "super huge" symptom).
			const h = box?.height ?? -1;
			const wrapH = wrap?.height ?? -1;
			await s.shot(chat, "03-composer-geometry");
			judge(
				h > 0 && h <= 200 ? "PASS" : "FAIL",
				"composer height sane",
				`input height=${Math.round(h)}px, composer row=${Math.round(wrapH)}px (expect input ~40, ≤200)`,
			);
		});

		// ── "does not work" check: click + type + Send button ────────────────────
		await step("click into composer, type, click Send", async () => {
			const input = chat.locator(".chat__composer-input").first();
			// Real pointer click — this is what the overlapping placeholder used to
			// swallow. Then type with the keyboard (no fill()).
			await input.click({ timeout: 6000 });
			await chat.waitForTimeout(200);
			await chat.keyboard.type(typed, { delay: 10 });
			await chat.waitForTimeout(300);
			await s.shot(chat, "04-typed");

			// The Send button enables only when the draft is non-empty — a good
			// signal that the keystrokes actually reached the editor.
			const sendBtn = chat.locator(".chat__send").first();
			const enabled = await sendBtn.isEnabled().catch(() => false);
			await sendBtn.click({ timeout: 4000 }).catch(() => undefined);
			await chat.waitForTimeout(800);

			const lines = await chat
				.locator(".chat__line")
				.allInnerTexts()
				.catch(() => []);
			await s.shot(chat, "05-sent");
			const shown = lines.some((l) => l.includes(typed));
			judge(
				shown ? "PASS" : "FAIL",
				"click-type-send round trip",
				`send enabled=${enabled}, lines=[${lines.join(" | ")}]`,
			);
		});
	} finally {
		await s.finish();
	}
});
