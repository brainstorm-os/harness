/**
 * Session 327 — SCREENSHOT-DRIVEN visual audit: shell + settings.
 *
 * Why this exists. The `POLISH-APP-1..20` program measured literal colors and
 * px font-sizes and drove them to zero, and the drift baseline has been empty
 * since. That is a mechanical proxy, and the owner kept finding obvious defects
 * anyway — a UA `<button>` frame painting white on a dark theme, a tag chip
 * that only LOOKED like the shared tag-property face, an absolutely-positioned
 * editor placeholder escaping its pane and painting over the window chrome.
 * None of those change a colour literal or a font-size, so none of them could
 * ever have been caught by the ratchet.
 *
 * So this spec does not judge. It CAPTURES, densely and in both themes, and a
 * human (or the agent) reads the images. The classes it is hunting are the ones
 * the ratchet is blind to:
 *
 *   - UA-default chrome showing through an unstyled control (light button
 *     faces, outset borders, focus rings) — worst on dark themes;
 *   - a local lookalike of a shared face (chips, pills, inputs, rows) that is
 *     almost-but-not the real primitive;
 *   - absolutely-positioned children escaping an unpositioned ancestor;
 *   - controls whose hover/active state paints somewhere unexpected;
 *   - inconsistent menus — some with icons, some without, checks on different
 *     sides.
 *
 * Shell + settings FIRST (owner's call): they are the surfaces every app is
 * judged against, so a defect here is the baseline everything else inherits.
 *
 * Hidden windows throughout via `startSession` → `shellLaunchEnv`. Screenshots
 * read from the page, not the screen, so nothing appears on the owner's
 * desktop.
 *
 * The theme flip goes through `../lib/appearance` — the real
 * `dashboard.setAppearanceMode` API, with the resolved background asserted
 * before a single file is named for a theme. The first version of this spec
 * flipped `documentElement`'s `data-theme` attribute, which nothing in the
 * shell styles off, so every `*-light-*` capture here was the dark theme filed
 * under the light name (F-494). The saved mode is restored in `finally`.
 */

import { test } from "@playwright/test";
import {
	AppearanceMode,
	readAppearanceMode,
	restoreAppearanceMode,
	switchTheme,
} from "../lib/appearance";
import { startSession } from "../lib/founder";

/** Every settings section, by its nav label. Captured one by one — a section
 *  that fails to open is recorded, not fatal. */
const SETTINGS_SECTIONS = [
	"Appearance",
	"General",
	"Interface",
	"Language",
	"Notifications",
	"Security",
	"Data",
	"Backup",
	"Search",
	"Defaults",
	"Apps",
	"Shortcuts",
	"Team",
	"AI",
] as const;

test("visual audit — shell + settings, both themes (327)", async () => {
	test.setTimeout(900_000);
	const s = await startSession("327-audit-shell-settings");
	const dash = s.dashboard;
	let savedMode: string | null = null;

	try {
		await dash.waitForTimeout(2500);
		await dash.keyboard.press("Escape");
		savedMode = await readAppearanceMode(dash);
		s.note(`saved appearance mode: ${savedMode}`);

		/** Capture without letting one bad surface abort the sweep. */
		const shot = async (name: string, fn?: () => Promise<void>): Promise<void> => {
			try {
				if (fn) await fn();
				await dash.waitForTimeout(450);
				await s.shot(dash, name);
			} catch (error) {
				s.note(`capture FAILED ${name}: ${(error as Error).message}`);
			}
		};

		// Flip the whole shell between themes so every capture happens twice — a
		// UA default is invisible on light and glaring on dark. `switchTheme`
		// throws if the shell did not actually repaint, so the sweep below can
		// never file a capture under a theme it is not.
		for (const theme of [AppearanceMode.Dark, AppearanceMode.Light] as const) {
			const probe = await switchTheme(dash, theme);
			s.note(`theme pass: ${theme} → resolved "${probe.theme}" (${probe.background})`);
			const p = (name: string) => `${theme}-${name}`;

			// ── The shell itself ────────────────────────────────────────────
			await shot(p("01-dashboard"));
			await shot(p("02-dashboard-hover-icon"), async () => {
				// Hover state is where UA chrome and stray frames surface.
				const icon = dash.locator(".dashboard__icon, [data-entity-id]").first();
				if (await icon.count()) await icon.hover();
			});
			await shot(p("03-search-open"), async () => {
				await dash.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
			});
			await dash.keyboard.press("Escape");

			await shot(p("04-object-menu"), async () => {
				const target = dash.locator("[data-entity-id]").first();
				if (await target.count()) await target.click({ button: "right" });
			});
			await dash.keyboard.press("Escape");

			// ── Settings, section by section ────────────────────────────────
			await shot(p("10-settings-open"), async () => {
				await dash.locator('[aria-label="Settings"]').first().click();
				await dash.waitForTimeout(900);
			});

			for (const [i, label] of SETTINGS_SECTIONS.entries()) {
				await shot(p(`11-settings-${String(i + 1).padStart(2, "0")}-${label.toLowerCase()}`), async () => {
					const item = dash.locator(".settings__nav-item", { hasText: label }).first();
					if ((await item.count()) === 0) {
						s.note(`settings section not present: ${label}`);
						return;
					}
					await item.click();
					await dash.waitForTimeout(600);
				});
			}

			// A form control's focus ring is its own class of defect.
			await shot(p("12-settings-focused-control"), async () => {
				const control = dash
					.locator(".settings__main input, .settings__main button, .settings__main .bs-select")
					.first();
				if (await control.count()) await control.focus();
			});

			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(400);
		}

		s.note("shell + settings captured in both themes — read the images, do not trust this line");
	} finally {
		await restoreAppearanceMode(dash, savedMode);
		await s.finish();
	}
});
