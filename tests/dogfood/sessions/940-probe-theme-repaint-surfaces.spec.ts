/**
 * Probe 940 — WHICH SURFACE fails to repaint on a live light/dark switch.
 *
 * The owner has reported a broken light/dark switch four times. Every previous
 * investigation was code-reading, and the code reads clean: `applyThemeVars`
 * falls back on an unknown theme name, the token path is guarded, the unit
 * suites are green. Reading has failed. Precedent says the theme bugs only ever
 * fall out of live probes (F-480 was isolated by 921/922, never by reading), so
 * this spec measures instead of arguing.
 *
 * Phases A–E are deliberately NOT pass/fail assertions on "did the theme
 * change" — they are a CENSUS, and they measured clean. Phase F (mode=auto,
 * driven by the OS preference) is the one that found the bug, so it — and only
 * it — ASSERTS: the dashboard must converge on main's reading, and no surface
 * that paints a real colour may sit out the flip. The census is: sample the resolved background of every surface the shell paints,
 * flip the theme through the path a user actually uses, sample again, and print
 * the surfaces whose value is byte-identical across the flip. An unchanged
 * value is the only unambiguous evidence of a missed repaint — a *different*
 * wrong colour is a theming bug of another class, and a plausible-looking
 * colour is exactly what fooled the earlier eyeball passes (F-494).
 *
 * Two kinds of reading, because the shell paints two kinds of surface:
 *   • TOKEN  — `--color-background-primary` resolved through the engine inside
 *     that document (`probeSurface`, shared with 327/329). Proves the CSS
 *     custom properties reached the document at all.
 *   • COMPUTED — the real `background-color` of a named element (the Settings
 *     panel, the `.app-header` glass, its `::after` wallpaper scrim, a tab).
 *     A document can hold correct tokens while a surface still paints a stale
 *     literal, and only this reading can tell them apart.
 *   • PIXELS — a sha256 of an element screenshot, for the canvas apps whose
 *     content is drawn imperatively and is invisible to both readings above.
 *     Identical bytes across a theme flip means the pixels never moved.
 *
 * The three cases the owner's complaint actually spans:
 *   1. windows ALREADY OPEN when the switch happens (his words: things already
 *      open) — phases B and C;
 *   2. the switch driven from the REAL Settings → Appearance control, not the
 *      IPC, because a dead control would look identical to the user and
 *      invisible to an API-level probe — phases B and C use the radio;
 *   3. an app CLOSED before the switch and REOPENED after it, since AppLauncher
 *      parks closed containers (warm-keep) and a revived renderer may never
 *      have seen the broadcast — phase D.
 *
 * Nothing here mutates the owner's vault beyond the appearance mode, which is
 * read at the start and restored in `finally`.
 */

import { createHash } from "node:crypto";
import { type Frame, type Page, expect, test } from "@playwright/test";
import {
	AppearanceMode,
	type AuditTheme,
	probeSurface,
	readAppearanceMode,
	restoreAppearanceMode,
	switchTheme,
} from "../lib/appearance";
import { APP, type AppId, startSession } from "../lib/founder";

/** How a surface's value was obtained — carried into the report so a reader can
 *  tell "the tokens never arrived" from "the element paints a stale literal". */
enum ReadingKind {
	/** `--color-background-primary` resolved inside that document. */
	Token = "token",
	/** `getComputedStyle(el).backgroundColor` of a named element. */
	Computed = "computed",
	/** sha256 of an element screenshot — for imperatively drawn content. */
	Pixels = "pixels",
	/** A non-colour value recorded verbatim (e.g. the wallpaper URL var). */
	Raw = "raw",
}

/** One surface's state at one moment. `value` is what the comparison keys on. */
type Reading = {
	surface: string;
	kind: ReadingKind;
	value: string;
	/** WCAG relative luminance of `value` when it is a colour; NaN otherwise. */
	luminance: number;
};

/** Snapshot of every reachable surface at one moment, keyed by surface name. */
type Census = Map<string, Reading>;

/** A surface whose value is allowed to be byte-identical across a flip: a
 *  reading that is not a colour at all (`--app-wallpaper-image` is `(unset)`
 *  in a solid-wallpaper vault) or an element that paints nothing and lets its
 *  parent through (alpha 0 ⇒ `luminanceOf` returns NaN). Everything else
 *  standing still IS a missed repaint — pixel hashes included, since a frozen
 *  canvas is exactly the failure they exist to catch. */
function isExplainedStale(reading: Reading | undefined): boolean {
	if (!reading) return true;
	if (reading.kind === ReadingKind.Raw) return true;
	return (
		(reading.kind === ReadingKind.Computed || reading.kind === ReadingKind.Token) &&
		Number.isNaN(reading.luminance)
	);
}

/** Apps opened before the switch. One with a wallpaper-stripe header and a
 *  normal DOM body (Notes), two canvas apps (Graph, Whiteboard), and one dense
 *  chrome-heavy app (Database) — the mix the complaint spans. */
const OPEN_BEFORE: readonly AppId[] = [APP.Notes, APP.Graph, APP.Whiteboard, APP.Database];

/** The app used for the close → switch → reopen (warm-keep revival) case. It is
 *  deliberately NOT in `OPEN_BEFORE`: its container must be parked, not live. */
const REOPEN_APP: AppId = APP.Tasks;

/** Apps need very different times to paint their first frame. */
const SETTLE_MS: Partial<Record<AppId, number>> = {
	[APP.Graph]: 6000,
	[APP.Whiteboard]: 3500,
	[APP.Database]: 2600,
};

/** Long enough for the main-process broadcast to reach every renderer AND for
 *  each to repaint. Generous on purpose: a race read as a missed repaint would
 *  send the next investigation down a fourth wrong path. */
const REPAINT_SETTLE_MS = 2500;

/** Above this WCAG relative luminance a colour is a light theme's. Mirrors the
 *  midpoint in `lib/appearance`; nothing built-in lands within 0.4 of it. */
const LUMINANCE_MIDPOINT = 0.5;

function luminanceOf(css: string): number {
	const [r = 0, g = 0, b = 0, a = 1] = (css.match(/[\d.]+/g) ?? []).map(Number);
	if (a === 0) return Number.NaN;
	const channel = (value: number): number => {
		const scaled = value / 255;
		return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Which side of the midpoint a reading sits on, for the report. */
function side(luminance: number): string {
	if (Number.isNaN(luminance)) return "—";
	return luminance > LUMINANCE_MIDPOINT ? "light" : "dark";
}

function reading(surface: string, kind: ReadingKind, value: string): Reading {
	const luminance = kind === ReadingKind.Computed || kind === ReadingKind.Token
		? luminanceOf(value)
		: Number.NaN;
	return { surface, kind, value, luminance };
}

/** Resolve the theme tokens inside one document. */
async function tokenReading(surface: string, target: Page | Frame): Promise<Reading | null> {
	try {
		const probe = await probeSurface(target);
		const r = reading(surface, ReadingKind.Token, probe.background);
		return { ...r, value: `${probe.background} [data-theme=${probe.theme || "(unset)"}]` };
	} catch {
		return null;
	}
}

/** The real painted `background-color` of `selector` — plus, when `pseudo` is
 *  given, of that pseudo-element (the app-header wallpaper scrim is an
 *  `::after`, and a stale scrim is exactly the kind of thing a root-token read
 *  cannot see). Returns null when the element is not present. */
async function computedReading(
	surface: string,
	page: Page | Frame,
	selector: string,
	pseudo?: string,
): Promise<Reading | null> {
	try {
		const value = await page.evaluate(
			({ sel, pseudoEl }) => {
				const el = document.querySelector(sel);
				if (!el) return null;
				const style = getComputedStyle(el, pseudoEl ?? undefined);
				return style.backgroundColor;
			},
			{ sel: selector, pseudoEl: pseudo ?? null },
		);
		return value === null ? null : reading(surface, ReadingKind.Computed, value);
	} catch {
		return null;
	}
}

/** Record a non-colour value verbatim (the header wallpaper URL var). */
async function rawReading(surface: string, page: Page, property: string): Promise<Reading | null> {
	try {
		const value = await page.evaluate(
			(prop) => getComputedStyle(document.documentElement).getPropertyValue(prop).trim(),
			property,
		);
		return reading(surface, ReadingKind.Raw, value || "(unset)");
	} catch {
		return null;
	}
}

/** sha256 of an element screenshot. The only reading that can see a canvas. */
async function pixelReading(surface: string, page: Page, selector: string): Promise<Reading | null> {
	try {
		const el = page.locator(selector).first();
		if ((await el.count()) === 0) return null;
		const buf = await el.screenshot({ scale: "css", timeout: 15_000 });
		return reading(surface, ReadingKind.Pixels, createHash("sha256").update(buf).digest("hex").slice(0, 16));
	} catch {
		return null;
	}
}

test("940 — which surfaces fail to repaint on a live light/dark switch", async () => {
	test.setTimeout(900_000);
	const s = await startSession("940-probe-theme-repaint-surfaces");
	const dash = s.dashboard;
	let savedMode: string | null = null;

	/** App pages opened before the first switch, kept for re-sampling. */
	const openApps = new Map<AppId, Page>();

	/** Sample every surface this run can reach, right now. */
	const census = async (label: string): Promise<Census> => {
		const out: Census = new Map();
		const add = (r: Reading | null): void => {
			if (r) out.set(r.surface, r);
		};

		// --- dashboard renderer -------------------------------------------------
		add(await tokenReading("dashboard/root-token", dash));
		add(await computedReading("dashboard/body", dash, "body"));
		add(await computedReading("dashboard/header", dash, ".dashboard__header"));
		add(await computedReading("dashboard/body-region", dash, ".dashboard__body"));

		// --- Settings overlay (only present while it is open) -------------------
		add(await computedReading("settings/panel", dash, ".settings__panel"));
		add(await computedReading("settings/backdrop", dash, ".settings__backdrop"));
		add(await computedReading("settings/sidebar", dash, ".settings__sidebar"));

		// --- widget iframes on the dashboard ------------------------------------
		const widgetFrames = dash.frames().filter((f) => f !== dash.mainFrame());
		for (const [i, frame] of widgetFrames.entries()) {
			// The widget bundle URL is a custom-scheme URL; take the app-id segment
			// by string split rather than `new URL`, which throws on some schemes.
			const appSegment = frame.url().match(/io\.brainstorm\.[a-z-]+/)?.[0] ?? `frame${i}`;
			const name = `widget[${i}]:${appSegment.replace("io.brainstorm.", "")}`;
			add(await tokenReading(`${name}/root-token`, frame));
			// The iframe has no preload: its tokens arrive as a postMessage'd CSS
			// string, so the painted body is a separate question from the tokens.
			add(await computedReading(`${name}/body`, frame, "body"));
		}

		// --- tab strips (one shell-owned chrome view per app container) ---------
		const strips = s.app.windows().filter((p) => p.url().includes("/chrome/tab-strip"));
		for (const [i, strip] of strips.entries()) {
			add(await tokenReading(`tabstrip[${i}]/root-token`, strip));
			add(await computedReading(`tabstrip[${i}]/strip`, strip, ".strip"));
			add(await computedReading(`tabstrip[${i}]/active-tab`, strip, ".tab--active"));
		}

		// --- each open app renderer ---------------------------------------------
		for (const [id, page] of openApps) {
			if (page.isClosed()) continue;
			const short = id.replace("io.brainstorm.", "");
			add(await tokenReading(`app:${short}/root-token`, page));
			add(await computedReading(`app:${short}/body`, page, "body"));
			// The app-header glass + its wallpaper stripe layers. `::before` carries
			// the image, `::after` the themed scrim over it.
			add(await computedReading(`app:${short}/app-header`, page, ".app-header"));
			add(await computedReading(`app:${short}/app-header::after`, page, ".app-header", "::after"));
			add(await rawReading(`app:${short}/wallpaper-var`, page, "--app-wallpaper-image"));
			// Canvas content is drawn imperatively — pixels are the only witness.
			add(await pixelReading(`app:${short}/canvas-pixels`, page, "canvas"));
		}

		s.note(`\n--- census: ${label} (${out.size} surfaces) ---`);
		for (const r of out.values()) {
			s.note(`  ${r.surface.padEnd(38)} ${r.kind.padEnd(8)} ${r.value}  (${side(r.luminance)})`);
		}
		return out;
	};

	/** Print which surfaces did NOT change between two censuses. THE deliverable. */
	const diff = (from: Census, to: Census, label: string): string[] => {
		const unchanged: string[] = [];
		const changed: string[] = [];
		const appeared: string[] = [];
		const vanished: string[] = [];

		for (const [surface, before] of from) {
			const after = to.get(surface);
			if (!after) {
				vanished.push(surface);
				continue;
			}
			if (after.value === before.value) unchanged.push(surface);
			else changed.push(`${surface}: ${before.value} → ${after.value}`);
		}
		for (const surface of to.keys()) if (!from.has(surface)) appeared.push(surface);

		s.note(`\n=== ${label} ===`);
		s.note(`REPAINTED (${changed.length}):`);
		for (const line of changed) s.note(`  ✓ ${line}`);
		s.note(`\nDID NOT CHANGE (${unchanged.length}):`);
		if (unchanged.length === 0) s.note("  (none — every reachable surface repainted)");
		for (const surface of unchanged) {
			const r = to.get(surface);
			s.note(`  ✗ ${surface.padEnd(38)} still ${r?.value} (${side(r?.luminance ?? Number.NaN)})`);
		}
		if (vanished.length) s.note(`\nnot re-readable after the switch: ${vanished.join(", ")}`);
		if (appeared.length) s.note(`only readable after the switch: ${appeared.join(", ")}`);
		return unchanged;
	};

	/** Drive the REAL Settings → Appearance segmented control. Returns false when
	 *  the control could not be reached, so the caller can fall back to the IPC
	 *  and the report can say which path was exercised. */
	const clickAppearanceMode = async (mode: AuditTheme): Promise<boolean> => {
		const label = mode === AppearanceMode.Light ? "Light" : "Dark";
		const group = dash.getByRole("radiogroup", { name: "Appearance mode" });
		if ((await group.count()) === 0) {
			// Dump what IS reachable rather than just reporting a miss — a control
			// the probe cannot find is indistinguishable from a control that does
			// nothing, and only this tells the two apart.
			const diagnostics = await dash.evaluate(() => ({
				settingsOpen: Boolean(document.querySelector(".settings__panel")),
				activeSection:
					document.querySelector(".settings__main-title")?.textContent?.trim() ?? "(no title)",
				navItems: [...document.querySelectorAll(".settings__nav-item")].map(
					(el) => `${el.getAttribute("role") ?? "(no role)"}:${el.textContent?.trim()}`,
				),
				radiogroups: [...document.querySelectorAll('[role="radiogroup"]')].map(
					(el) => el.getAttribute("aria-label") ?? "(unlabelled)",
				),
			}));
			s.note(`(appearance radiogroup not reachable — cannot click "${label}")`);
			s.note(`  settings overlay open: ${diagnostics.settingsOpen}`);
			s.note(`  active section: ${diagnostics.activeSection}`);
			s.note(`  radiogroups present: ${diagnostics.radiogroups.join(" | ") || "(none)"}`);
			s.note(`  nav items: ${diagnostics.navItems.join(" | ") || "(none)"}`);
			return false;
		}
		const radio = group.getByRole("radio", { name: label, exact: true });
		if ((await radio.count()) === 0) {
			s.note(`(no "${label}" radio inside the appearance radiogroup)`);
			return false;
		}
		const checkedBefore = await radio.getAttribute("aria-checked");
		await radio.click({ timeout: 10_000 });
		await dash.waitForTimeout(REPAINT_SETTLE_MS);
		const checkedAfter = await radio.getAttribute("aria-checked");
		// The persisted mode is the proof the CONTROL reached the API — a control
		// that renders as selected but never calls `setAppearanceMode` would look
		// identical to the user and identical to an aria-only assertion.
		const persisted = await readAppearanceMode(dash).catch(() => "(unreadable)");
		s.note(
			`clicked Settings → Appearance → ${label}: aria-checked ${checkedBefore} → ${checkedAfter}, ` +
				`persisted mode now "${persisted}"`,
		);
		return true;
	};

	try {
		await dash.waitForTimeout(3000);
		await dash.keyboard.press("Escape");

		savedMode = await readAppearanceMode(dash);
		s.note(`saved appearance mode: ${savedMode}`);

		// ---- phase A: boot into DARK, open everything --------------------------
		const darkProbe = await switchTheme(dash, AppearanceMode.Dark);
		s.note(`baseline DARK: resolved "${darkProbe.theme}" (${darkProbe.background})`);

		const placedWidgets = await dash.evaluate(async () => {
			const bs = window as unknown as {
				brainstorm: { dashboard: { snapshot: () => Promise<{ widgets?: Record<string, unknown> } | null> } };
			};
			const snap = await bs.brainstorm.dashboard.snapshot().catch(() => null);
			return Object.keys(snap?.widgets ?? {});
		});
		s.note(`dashboard widgets placed in this vault: ${placedWidgets.length ? placedWidgets.join(", ") : "(none)"}`);
		s.note(`dashboard iframes visible to the probe: ${dash.frames().length - 1}`);

		for (const id of OPEN_BEFORE) {
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(SETTLE_MS[id] ?? 1800);
				openApps.set(id, page);
				s.note(`opened ${id}`);
			} catch (error) {
				s.note(`✗ ${id} failed to open: ${(error as Error).message.split("\n")[0]}`);
			}
		}

		// Open the Settings overlay and land on Appearance — this is the owner's
		// path, and it keeps the overlay ON SCREEN across the switch so a stale
		// overlay is measurable rather than merely suspected.
		await dash.bringToFront().catch(() => undefined);
		const settingsButton = dash.getByRole("button", { name: "Settings", exact: true });
		if (await settingsButton.count()) {
			await settingsButton.first().click({ timeout: 10_000 }).catch(() => undefined);
			await dash.waitForTimeout(1200);
			// The settings nav is a `listbox` (useCompositeKeyboard owns the
			// listbox/option roles) — its entries are NOT buttons or tabs, which is
			// why the first run of this probe could never reach the control.
			const navItem = dash.locator(".settings__nav-item", { hasText: /^Appearance$/ });
			if (await navItem.count()) {
				await navItem.first().click({ timeout: 8000 }).catch(() => undefined);
			} else {
				s.note("(no Appearance entry in the settings nav)");
			}
			await dash.waitForTimeout(1500);
			s.note(
				`settings section now: ${await dash
					.locator(".settings__main-title")
					.first()
					.textContent()
					.catch(() => "(unreadable)")}`,
			);
		} else {
			s.note("(Settings header button not found — the overlay surfaces will be absent)");
		}
		await s.shot(dash, "01-dark-settings-appearance");

		const A = await census("A · DARK, everything open, Settings on Appearance");

		// ---- phase B: DARK → LIGHT through the REAL control --------------------
		const clickedLight = await clickAppearanceMode(AppearanceMode.Light);
		if (!clickedLight) {
			s.note("falling back to dashboard.setAppearanceMode for LIGHT");
			await switchTheme(dash, AppearanceMode.Light);
		}
		await dash.waitForTimeout(REPAINT_SETTLE_MS);
		await s.shot(dash, "02-light-after-switch");
		for (const [id, page] of openApps) {
			if (!page.isClosed()) await s.shot(page, `03-light-${id.replace("io.brainstorm.", "")}`);
		}
		const B = await census("B · after DARK → LIGHT (control path)");
		const failedToLight = diff(A, B, "DARK → LIGHT — surfaces that did not repaint");

		// ---- phase C: LIGHT → DARK, because one-way is a different bug ---------
		const clickedDark = await clickAppearanceMode(AppearanceMode.Dark);
		if (!clickedDark) {
			s.note("falling back to dashboard.setAppearanceMode for DARK");
			await switchTheme(dash, AppearanceMode.Dark);
		}
		await dash.waitForTimeout(REPAINT_SETTLE_MS);
		await s.shot(dash, "04-dark-after-switch-back");
		const C = await census("C · after LIGHT → DARK (control path)");
		const failedToDark = diff(B, C, "LIGHT → DARK — surfaces that did not repaint");

		// ---- phase D: close → switch → reopen (AppLauncher warm-keep) ----------
		s.note("\n=== D · close → switch → reopen (parked container revival) ===");
		let reopened: Page | null = null;
		try {
			const short = REOPEN_APP.replace("io.brainstorm.", "");
			const first = await s.openApp(REOPEN_APP);
			await first.waitForTimeout(2000);
			const beforeClose = await tokenReading(`reopen:${short}/root-token`, first);
			s.note(`  opened in DARK: ${beforeClose?.value ?? "(unreadable)"}`);

			// Close the container the way a user does — the strip's close control,
			// falling back to closing the window — so AppLauncher parks it.
			const strip = s.app.windows().find((p) => p.url().includes("/chrome/tab-strip"));
			const close = strip?.locator(".tab__close").first();
			if (close && (await close.count())) await close.click({ timeout: 8000 }).catch(() => undefined);
			await dash.waitForTimeout(2000);
			s.note(`  container closed (page closed=${first.isClosed()})`);

			// Switch while it is parked.
			const clicked = await clickAppearanceMode(AppearanceMode.Light);
			if (!clicked) await switchTheme(dash, AppearanceMode.Light);
			await dash.waitForTimeout(REPAINT_SETTLE_MS);

			reopened = await s.openApp(REOPEN_APP);
			await reopened.waitForTimeout(2500);
			const afterReopen = await tokenReading(`reopen:${short}/root-token`, reopened);
			s.note(`  reopened while shell is LIGHT: ${afterReopen?.value ?? "(unreadable)"}`);
			await s.shot(reopened, "05-reopened-after-switch");
			const stale =
				afterReopen && beforeClose && afterReopen.value === beforeClose.value
					? "✗ REVIVED STALE — the reopened renderer kept the pre-switch theme"
					: "✓ the reopened renderer picked up the current theme";
			s.note(`  ${stale}`);
			s.note(
				`  ${side(afterReopen?.luminance ?? Number.NaN)} after a switch to light` +
					` (dashboard is ${side((await probeSurface(dash)).luminance)})`,
			);
		} catch (error) {
			s.note(`  reopen case could not run: ${(error as Error).message.split("\n")[0]}`);
		}

		// ---- phase E: the dashboard HEADER toggle, including from `auto` -------
		//
		// The header toggle does not ask main what `auto` currently resolves to —
		// it computes its target renderer-side from `matchMedia(prefers-color-
		// scheme)` (`nextModeForToggle(mode, systemPrefersDark())`). Main resolves
		// `auto` from its own `nativeTheme`. If the two ever disagree, one click
		// picks a mode that lands on the SAME painted slot, and the switch is dead
		// to the user while every API-level probe says it worked. Measure it.
		s.note("\n=== E · the dashboard header toggle, from each starting mode ===");
		// The Settings overlay traps focus and covers the header — close it, or
		// every click below lands on the backdrop and reads as a dead toggle for
		// the wrong reason.
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(1000);
		s.note(
			`  settings overlay closed: ${!(await dash.locator(".settings__panel").count())}`,
		);
		const rendererPrefersDark = await dash.evaluate(
			() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? null,
		);
		s.note(`  renderer matchMedia(prefers-color-scheme: dark) = ${rendererPrefersDark}`);

		for (const start of [AppearanceMode.Dark, AppearanceMode.Light, AppearanceMode.Auto]) {
			await dash.evaluate(async (m) => {
				const bs = window as unknown as {
					brainstorm: { dashboard: { setAppearanceMode: (mode: string) => Promise<void> } };
				};
				await bs.brainstorm.dashboard.setAppearanceMode(m);
			}, start);
			await dash.waitForTimeout(REPAINT_SETTLE_MS);
			const before = await probeSurface(dash);
			const toggle = dash.getByRole("button", { name: /Switch to (Light|Dark) appearance/ });
			if ((await toggle.count()) === 0) {
				s.note(`  start=${start}: header toggle button NOT PRESENT`);
				continue;
			}
			const toggleLabel = await toggle.first().getAttribute("aria-label");
			await toggle.first().click({ timeout: 10_000 }).catch(() => undefined);
			await dash.waitForTimeout(REPAINT_SETTLE_MS);
			const after = await probeSurface(dash);
			const modeAfter = await readAppearanceMode(dash).catch(() => "(unreadable)");
			const moved = after.background !== before.background;
			s.note(
				`  start=${start} (painted ${side(before.luminance)}, ${before.theme}) · "${toggleLabel}" → ` +
					`mode="${modeAfter}", painted ${side(after.luminance)} (${after.theme}) · ` +
					`${moved ? "✓ the shell moved" : "✗ DEAD CLICK — the painted theme did not change"}`,
			);
			await s.shot(dash, `06-header-toggle-from-${start}`);
		}

		// ---- phase F: mode=auto driven by the OS preference --------------------
		//
		// The one path no probe has ever exercised. In `auto` nobody clicks
		// anything: the OS flips, `nativeTheme.updated` fires in main, and the
		// shell has to re-resolve the slot AND re-broadcast to every app window.
		// A miss here is invisible to every control-level test and looks to the
		// owner exactly like a broken switch — the dashboard follows (the
		// renderer has its own `matchMedia` listener) while the already-open app
		// windows stay on the old theme.
		//
		// `nativeTheme.themeSource` is the only way to move the OS preference from
		// a test; it fires the same `updated` event a real OS flip does. It is
		// restored to "system" in the same phase.
		s.note("\n=== F · mode=auto, flipped by the OS preference (nativeTheme) ===");
		let autoFailures: string[] = [];
		/** One entry per OS flip that never reached main's own reading. THE
		 *  assertion of this spec: a torn shell is one where these two disagree,
		 *  and the disagreement outlived a 10s poll on 3 runs of 3. */
		const autoStuck: string[] = [];
		/** The last AUTO-phase census, so the verdict can ask what KIND of reading
		 *  a stale surface was: a transparent element or an `(unset)` wallpaper var
		 *  is identical in both themes by construction; a colour is not. */
		let lastAutoCensus: Census | null = null;
		try {
			await dash.evaluate(async () => {
				const bs = window as unknown as {
					brainstorm: { dashboard: { setAppearanceMode: (mode: string) => Promise<void> } };
				};
				await bs.brainstorm.dashboard.setAppearanceMode("auto");
			}, undefined);
			await dash.waitForTimeout(REPAINT_SETTLE_MS);

			/** Flip the OS preference, then WATCH the dashboard converge (or not).
			 *  A lag and a stuck state look identical in a single after-shot, and
			 *  they are different bugs: poll so the report can say which. Main's
			 *  own `shouldUseDarkColors` is the ground truth to converge on. */
			const setOsPreference = async (source: "light" | "dark"): Promise<void> => {
				await s.app.evaluate(({ nativeTheme }, value) => {
					nativeTheme.themeSource = value;
				}, source);
				const mainSaysDark = await s.app.evaluate(
					({ nativeTheme }) => nativeTheme.shouldUseDarkColors,
				);
				const want = mainSaysDark ? AppearanceMode.Dark : AppearanceMode.Light;
				const trail: string[] = [];
				let converged = false;
				for (let i = 0; i < 10; i += 1) {
					await dash.waitForTimeout(1000);
					const probe = await probeSurface(dash);
					trail.push(`${i + 1}s:${side(probe.luminance)}`);
					if (side(probe.luminance) === want) {
						converged = true;
						break;
					}
				}
				// The decisive datum when it does NOT converge: the dashboard
				// renderer resolves the Auto slot from its OWN `matchMedia`, while
				// main resolves it from `nativeTheme.shouldUseDarkColors`. If these
				// disagree here, the split IS the bug — main broadcasts dark to the
				// app windows while the dashboard's own resolver insists on light.
				const rendererView = await dash.evaluate(async () => {
					const bs = window as unknown as {
						brainstorm: { dashboard: { snapshot: () => Promise<{ appearance?: unknown } | null> } };
					};
					const snap = await bs.brainstorm.dashboard.snapshot().catch(() => null);
					return {
						matchMediaDark: window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? null,
						dataTheme: document.documentElement.dataset.theme ?? "(unset)",
						appearance: JSON.stringify(snap?.appearance ?? null),
					};
				});
				s.note(
					`  OS → ${source} (main shouldUseDarkColors=${mainSaysDark}, want ${want}): ` +
						`dashboard ${converged ? `converged after ${trail.length}s` : "NEVER converged in 10s"} ` +
						`[${trail.join(" ")}]`,
				);
				if (!converged) {
					autoStuck.push(
						`OS → ${source}: main resolved ${want}, the dashboard stayed ` +
							`${trail[trail.length - 1]?.split(":")[1] ?? "?"} for ${trail.length}s ` +
							`(:root[data-theme]=${rendererView.dataTheme})`,
					);
				}
				s.note(
					`    renderer matchMedia dark=${rendererView.matchMediaDark}, ` +
						`:root[data-theme]=${rendererView.dataTheme}`,
				);
				s.note(`    snapshot.appearance=${rendererView.appearance}`);
			};

			await setOsPreference("dark");
			const osDark = await census("F1 · mode=auto, OS preference = DARK");
			await s.shot(dash, "07-auto-os-dark");

			await setOsPreference("light");
			const osLight = await census("F2 · mode=auto, OS preference = LIGHT");
			await s.shot(dash, "08-auto-os-light");
			autoFailures = diff(osDark, osLight, "AUTO · OS dark → light — surfaces that did not repaint");

			await setOsPreference("dark");
			const osDarkAgain = await census("F3 · mode=auto, OS preference = DARK again");
			lastAutoCensus = osDarkAgain;
			const backFailures = diff(
				osLight,
				osDarkAgain,
				"AUTO · OS light → dark — surfaces that did not repaint",
			);
			autoFailures = [...new Set([...autoFailures, ...backFailures])];
		} catch (error) {
			s.note(`  auto/OS phase could not run: ${(error as Error).message.split("\n")[0]}`);
		} finally {
			await s.app
				.evaluate(({ nativeTheme }) => {
					nativeTheme.themeSource = "system";
				})
				.catch(() => undefined);
		}

		// ---- verdict -----------------------------------------------------------
		s.note("\n=== VERDICT ===");
		s.note(`surfaces sampled: ${A.size}`);
		s.note(
			failedToLight.length === 0
				? "DARK → LIGHT: every reachable surface repainted."
				: `DARK → LIGHT: ${failedToLight.length} surface(s) unchanged → ${failedToLight.join(", ")}`,
		);
		s.note(
			failedToDark.length === 0
				? "LIGHT → DARK: every reachable surface repainted."
				: `LIGHT → DARK: ${failedToDark.length} surface(s) unchanged → ${failedToDark.join(", ")}`,
		);
		const asymmetric = [
			...failedToLight.filter((x) => !failedToDark.includes(x)).map((x) => `${x} (light only)`),
			...failedToDark.filter((x) => !failedToLight.includes(x)).map((x) => `${x} (dark only)`),
		];
		s.note(
			asymmetric.length === 0
				? "symmetry: no one-way failures."
				: `ONE-WAY failures (a different bug from a symmetric one): ${asymmetric.join(", ")}`,
		);
		s.note(
			autoFailures.length === 0
				? "AUTO (OS-driven): every reachable surface repainted."
				: `AUTO (OS-driven): ${autoFailures.length} surface(s) unchanged → ${autoFailures.join(", ")}`,
		);

		// ---- the one hard assertion (F-495) ------------------------------------
		//
		// Everything above is a census a reader judges. This is the regression
		// lock, and it is deliberately narrow: the AUTO path, where the shell was
		// measured tearing in two — dark app windows against a light dashboard,
		// stuck there past a 10s poll, on the FIRST OS flip after entering Auto.
		// It does not tolerate a slow convergence either: `converged` already
		// allows a full second per sample.
		const autoStaleColours = autoFailures.filter(
			(surface) => !isExplainedStale(lastAutoCensus?.get(surface)),
		);
		expect(
			autoStuck,
			"the dashboard never reached the slot main resolved from nativeTheme — a torn shell (F-495), not a lag",
		).toEqual([]);
		expect(
			autoStaleColours,
			"these surfaces paint a real colour and did not move across an OS-driven light/dark flip in mode=auto (F-495)",
		).toEqual([]);
	} finally {
		await restoreAppearanceMode(dash, savedMode);
		await s.finish();
	}
});
