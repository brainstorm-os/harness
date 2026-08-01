/**
 * Session 321 — POLISH-APP-15 audit sweep: Chat surfaces in both themes.
 *
 * The first judgment-only rubric audit (the Teams flagship surface). This
 * spec only CAPTURES — the findings come from reviewing the shots against
 * docs/dogfood/app-design-audit.md. Surfaces: channel list + active channel
 * with message history, the composer (typed draft + @-typeahead), a second
 * channel/DM, and the header/member affordances.
 *
 * Run with BRAINSTORM_SHELL_DIR pointed at the branch worktree's build.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const enum ThemePass {
	Dark = "dark",
	Light = "light",
}

test("POLISH-APP-15 — Chat audit sweep", async () => {
	test.setTimeout(420_000);
	const s = await startSession("321-audit-chat-surfaces");
	try {
		const ch = await s.openApp(APP.Chat);
		await ch.waitForTimeout(1800);

		const setAppearance = async (mode: ThemePass) => {
			await s.dashboard.evaluate(
				async (m) => {
					type BW = {
						brainstorm: {
							dashboard: {
								setAppearanceMode: (x: string) => Promise<void>;
								setTheme: (t: string) => Promise<void>;
							};
						};
					};
					const bs = (window as unknown as BW).brainstorm;
					await bs.dashboard.setAppearanceMode(m);
					await bs.dashboard.setTheme(m === "light" ? "default-light" : "default-dark");
				},
				mode === ThemePass.Light ? "light" : "dark",
			);
			await ch.waitForTimeout(1500);
		};

		const capture = async (pass: ThemePass) => {
			// Resting: channel list + whatever channel is active.
			await s.shot(ch, `${pass}-01-resting`);

			// Open the first channel with history, then a second one.
			const channels = ch.locator(".chat__channel-name");
			const count = await channels.count();
			if (count > 0) {
				await channels.first().click();
				await ch.waitForTimeout(700);
				await s.shot(ch, `${pass}-02-channel-a`);
			}
			if (count > 1) {
				await channels.nth(1).click();
				await ch.waitForTimeout(700);
				await s.shot(ch, `${pass}-03-channel-b`);
			}

			// Composer with a typed draft + the @-mention typeahead.
			// The composer is a Lexical compact editor (contenteditable inside a
			// div host) — drive it via the keyboard, not fill().
			const composer = ch.locator(".chat__composer-input").first();
			if ((await composer.count()) > 0) {
				await composer.click();
				await ch.keyboard.type("Design audit draft — checking composer chrome ", { delay: 5 });
				await ch.waitForTimeout(300);
				await s.shot(ch, `${pass}-04-composer-draft`);
				await ch.keyboard.type("@", { delay: 60 });
				await ch.waitForTimeout(600);
				await s.shot(ch, `${pass}-05-mention-typeahead`);
				await ch.keyboard.press("Escape");
				for (let i = 0; i < 60; i += 1) await ch.keyboard.press("Backspace");
				await ch.waitForTimeout(200);
			}

			// Message-density surface (dark pass only — the vault had a single
			// message, which is no evidence for grouping / wrap / day dividers).
			if (pass === ThemePass.Dark && (await composer.count()) > 0) {
				const send = async (text: string) => {
					await composer.click();
					await ch.keyboard.type(text, { delay: 3 });
					await ch.keyboard.press("Enter");
					await ch.waitForTimeout(400);
				};
				await send("Audit ping one — consecutive messages should group under one author head.");
				await send("Audit ping two, same author seconds later.");
				await send(
					"A deliberately long paragraph to judge wrap and measure: the quick brown fox jumps over the lazy dog again and again until the line has to break at the message body's max width, which should hold a comfortable reading measure rather than spanning the full pane.",
				);
				await ch.waitForTimeout(600);
				await s.shot(ch, `${pass}-06-message-density`);
			}
		};

		await setAppearance(ThemePass.Dark);
		await capture(ThemePass.Dark);

		await setAppearance(ThemePass.Light);
		await capture(ThemePass.Light);

		await setAppearance(ThemePass.Dark);
		s.note("POLISH-APP-15 audit sweep captured (channels / composer / typeahead × 2 themes)");
	} finally {
		await s.finish();
	}
});
