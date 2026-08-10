/**
 * Appearance control for the screenshot-driven audit specs (327 shell/settings,
 * 329 apps) — flip the shell's theme through the REAL API, and PROVE the flip
 * took before anything writes a file named for a theme.
 *
 * Why this is a shared module rather than two inline `evaluate` blocks:
 *
 * Session 327 used to flip with `document.documentElement.setAttribute(
 * "data-theme", mode)`. Nothing in the shell reads that attribute to style
 * itself. `applyThemeVars` (shell `renderer/theme/theme-provider.tsx`) writes
 * the theme as CSS CUSTOM PROPERTIES onto `:root` via `setProperty`, and then
 * *writes* `data-theme` — the attribute exists so the widgets layer can observe
 * the resolved theme NAME and propagate it into widget iframes, not so anything
 * can style off it. The old flip therefore changed one attribute and zero
 * pixels, and every `*-light-*` capture in `.sessions/327-audit-shell-settings/`
 * was the dark theme filed under the light name (F-494).
 *
 * That is the F-486 failure class one layer up: the audit reports "both themes
 * reviewed" while half the evidence is a duplicate. So the assertion below is
 * the point of this module, more than the switch is. It samples the RESOLVED
 * `--color-background-primary` — normalised through the engine, so a theme that
 * never applied reads as a transparent/absent token rather than a plausible
 * colour — and throws unless its luminance is on the requested side of the
 * midpoint. Every built-in light theme's base background sits at luminance
 * ≥ 0.83 (`#f3ead8`, Sepia, is the darkest) and every dark theme's at ≤ 0.05
 * (`#2e3440`, Nord, is the lightest), so the midpoint is not a close call.
 */

import type { Page } from "@playwright/test";

/** Mirror of `AppearanceMode` in the shell's `@brainstorm-os/protocol`. The
 *  harness has no dependency on the shell workspace, so the wire values are
 *  re-declared here rather than imported; they are the strings
 *  `dashboard.setAppearanceMode` accepts. */
export enum AppearanceMode {
	Light = "light",
	Dark = "dark",
	Auto = "auto",
}

/** The two modes an audit pass can capture under. `Auto` is excluded on
 *  purpose: which slot it resolves to depends on the OS preference of whatever
 *  machine the run happens on, so a capture named for it means nothing. */
export type AuditTheme = AppearanceMode.Light | AppearanceMode.Dark;

/** The token every theme defines as its base page background — the one value
 *  that is unambiguously light in a light theme and dark in a dark one. */
const BACKGROUND_TOKEN = "--color-background-primary";

/** Above this WCAG relative luminance the resolved background is a light
 *  theme's; below it, a dark theme's. Nothing built-in lands within 0.4 of it. */
const LUMINANCE_MIDPOINT = 0.5;

/** How long the shell needs to repaint after a mode commit: the main process
 *  pushes the resolved theme name to the dashboard and every app window, and
 *  the app windows re-theme off their own `app:theme-changed`. */
const REPAINT_SETTLE_MS = 1200;

/** What the renderer actually resolved, read back after a switch. */
export type AppearanceProbe = {
	/** Resolved theme NAME the renderer committed (`:root[data-theme]`), e.g.
	 *  `default-light`. Not a slot — a slot can hold any theme. */
	theme: string;
	/** The raw `--color-background-primary` custom property, verbatim. */
	token: string;
	/** That token resolved + normalised by the engine (`rgb()` / `rgba()`). */
	background: string;
	/** WCAG relative luminance of `background`: 0 is black, 1 is white. */
	luminance: number;
	/** The mode the dashboard snapshot reports — the round-trip of the real API. */
	mode: string | null;
};

type AppearanceBridge = {
	brainstorm: {
		dashboard: {
			snapshot: () => Promise<{ appearance?: { mode?: string } } | null>;
			setAppearanceMode: (mode: string) => Promise<void>;
		};
	};
};

/** The mode currently persisted for the vault, so a run can put it back. */
export async function readAppearanceMode(dash: Page): Promise<string | null> {
	return dash.evaluate(async () => {
		const bs = (window as unknown as AppearanceBridge).brainstorm;
		const snapshot = await bs.dashboard.snapshot();
		return snapshot?.appearance?.mode ?? null;
	});
}

/** Commit `mode` through the real appearance API and let the shell repaint.
 *  No assertion — this is the raw primitive, used by `restoreAppearanceMode`
 *  and by `switchTheme` (which adds the proof). */
export async function applyAppearanceMode(dash: Page, mode: string): Promise<void> {
	await dash.evaluate(async (m) => {
		const bs = (window as unknown as AppearanceBridge).brainstorm;
		await bs.dashboard.setAppearanceMode(m);
	}, mode);
	await dash.waitForTimeout(REPAINT_SETTLE_MS);
}

/** Read back what the renderer resolved. Pure observation — never throws on a
 *  mismatch, so a caller can report as well as assert. */
export async function probeAppearance(dash: Page): Promise<AppearanceProbe> {
	return dash.evaluate(
		async ({ tokenName }) => {
			const bs = (window as unknown as AppearanceBridge).brainstorm;
			const snapshot = await bs.dashboard.snapshot().catch(() => null);

			const root = document.documentElement;
			const token = getComputedStyle(root).getPropertyValue(tokenName).trim();

			// Resolve through the engine rather than parsing the token text: every
			// notation the themes use (#rgb, #rrggbb, #rrggbbaa, rgb()) comes back
			// as a normalised rgb()/rgba() in 0–255, and a token that never applied
			// comes back transparent instead of as a plausible colour.
			const probe = document.createElement("div");
			probe.style.position = "fixed";
			probe.style.left = "-9999px";
			probe.style.width = "1px";
			probe.style.height = "1px";
			probe.style.pointerEvents = "none";
			probe.style.backgroundColor = `var(${tokenName})`;
			document.body.appendChild(probe);
			const background = getComputedStyle(probe).backgroundColor;
			probe.remove();

			const [r = 0, g = 0, b = 0, a = 1] = (background.match(/[\d.]+/g) ?? []).map(Number);
			const channel = (value: number): number => {
				const scaled = value / 255;
				return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
			};
			// A transparent result means the token did not resolve at all. Report
			// it as NaN so no threshold comparison can quietly accept it.
			const luminance =
				a === 0 ? Number.NaN : 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

			return {
				theme: root.dataset.theme ?? "",
				token,
				background,
				luminance,
				mode: snapshot?.appearance?.mode ?? null,
			};
		},
		{ tokenName: BACKGROUND_TOKEN },
	);
}

/** Throw unless the shell has actually repainted into `theme`. Loud on purpose:
 *  a capture written under the wrong theme name is worse than a missing one,
 *  because the audit then reports coverage it does not have. */
export function assertAppearance(theme: AuditTheme, probe: AppearanceProbe): void {
	const detail =
		`resolved theme "${probe.theme}", mode "${probe.mode}", ` +
		`${BACKGROUND_TOKEN} "${probe.token}" → ${probe.background} ` +
		`(luminance ${probe.luminance.toFixed(3)})`;
	const refusal =
		"Refusing to capture: a screenshot filed under a theme it is not is exactly F-494.";

	if (Number.isNaN(probe.luminance)) {
		throw new Error(
			`appearance: ${BACKGROUND_TOKEN} did not resolve, so the ${theme} theme ` +
				`cannot be proven — ${detail}. ${refusal}`,
		);
	}
	const painted = probe.luminance > LUMINANCE_MIDPOINT ? AppearanceMode.Light : AppearanceMode.Dark;
	if (painted !== theme) {
		throw new Error(
			`appearance: asked for the ${theme} theme but the shell painted ${painted} — ` +
				`${detail}. ${refusal}`,
		);
	}
}

/**
 * Switch the whole shell — dashboard AND every app window — into `theme` and
 * prove it took. Returns the probe so a spec can narrate the resolved theme
 * name into its notes; throws if the flip did not land.
 */
export async function switchTheme(dash: Page, theme: AuditTheme): Promise<AppearanceProbe> {
	await applyAppearanceMode(dash, theme);
	const probe = await probeAppearance(dash);
	assertAppearance(theme, probe);
	return probe;
}

/** Put the owner's mode back at the end of a run. Best-effort: the shell may
 *  already be tearing down, and losing the restore must not mask the real
 *  failure that got us here. */
export async function restoreAppearanceMode(dash: Page, mode: string | null): Promise<void> {
	if (!mode) return;
	await applyAppearanceMode(dash, mode).catch(() => undefined);
}
