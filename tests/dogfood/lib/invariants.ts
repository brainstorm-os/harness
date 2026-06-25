/**
 * Interaction invariants for the dogfood harness.
 *
 * The founder sessions verify "the intended feature works on the happy path"
 * by asserting DOM presence. That misses a whole class of bugs the founder
 * hits by hand: a menu that opens but won't close (the stuck-overlay dead-click),
 * a button that does nothing, an interaction that leaves the app wedged behind a
 * lingering overlay. These are PROPERTIES every interactive affordance must
 * hold, regardless of app:
 *
 *   1. A menu/popover dismisses on BOTH Escape and an outside press, and leaves
 *      NO overlay still intercepting clicks (`probeMenuTrigger`).
 *   2. After any interaction the app is still interactive — the viewport centre
 *      is live app content, not a leftover dimmer (`appInteractive`).
 *   3. A control click produces SOME observable effect — a dead button is a bug
 *      (`probeButton`).
 *
 * These are generic (they key off the shared `.fm-menu` / `.popover` chrome), so
 * one sweep exercises every app. Helpers RETURN findings rather than throwing, so
 * a sweep records every affordance instead of aborting on the first failure.
 */

import type { Locator, Page } from "@playwright/test";

/** Overlays that MUST be gone after a dismiss. `.fm-dimmer--closing` is excluded
 *  — it's mid-fade and now `pointer-events:none`, so it can't trap a click. */
const DISMISSABLE_OVERLAYS = [
	".fm-menu",
	".fm-dimmer:not(.fm-dimmer--closing)",
	".popover__backdrop",
	".bs-popover",
	'[role="dialog"]:not([data-permanent])',
] as const;

export type OverlayHit = { selector: string; area: number; intercepts: boolean };

/** Dismissable overlays currently visible in the page (excluding tooltips and
 *  mid-close dimmers). `intercepts` = it actually captures pointer events at its
 *  own centre, i.e. it would eat a click there. */
export async function visibleOverlays(page: Page): Promise<OverlayHit[]> {
	return page.evaluate(
		(selectors) => {
			const hits: OverlayHit[] = [];
			for (const selector of selectors) {
				for (const el of Array.from(document.querySelectorAll(selector))) {
					const r = el.getBoundingClientRect();
					const cs = getComputedStyle(el);
					const visible =
						r.width > 1 &&
						r.height > 1 &&
						cs.visibility !== "hidden" &&
						cs.display !== "none" &&
						Number(cs.opacity || "1") > 0.01;
					if (!visible) continue;
					const cx = r.left + r.width / 2;
					const cy = r.top + r.height / 2;
					const top = document.elementFromPoint(cx, cy);
					const intercepts =
						cs.pointerEvents !== "none" &&
						top != null &&
						(el === top || el.contains(top) || top.contains(el));
					hits.push({ selector, area: Math.round(r.width * r.height), intercepts });
				}
			}
			return hits;
		},
		DISMISSABLE_OVERLAYS as unknown as string[],
	);
}

/** The hanging-menu invariant: after a dismiss, no dismissable overlay may
 *  remain. Returns a problem string, or null when clean. Waits out the 90ms
 *  close fade first. */
export async function checkNoStuckOverlay(page: Page, context: string): Promise<string | null> {
	await page.waitForTimeout(240);
	const overlays = await visibleOverlays(page);
	const trapping = overlays.filter((o) => o.intercepts);
	if (trapping.length === 0) return null;
	return `STUCK OVERLAY after ${context}: ${trapping
		.map((o) => `${o.selector}(${o.area}px²)`)
		.join(", ")}`;
}

/** True when the viewport centre resolves to live app content rather than a
 *  leftover overlay — i.e. the app would still take a click. */
export async function appInteractive(page: Page): Promise<boolean> {
	return page.evaluate(
		(selectors) => {
			const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
			if (!el) return false;
			return !selectors.some((sel) => el.closest(sel));
		},
		[".fm-menu", ".fm-dimmer:not(.fm-dimmer--closing)", ".popover__backdrop"],
	);
}

/** Press at a viewport coordinate OUTSIDE the open menu, the way a user does.
 *  Critically this uses `page.mouse.click(x,y)` (a raw pointer event at that
 *  point), NOT `locator.click()` — when a full-screen dimmer covers the page,
 *  Playwright's actionability guard refuses to "click through" it to a target
 *  element, so a locator click would never land and falsely read as a hang. A
 *  coordinate press hits whatever is on top (the dimmer), exactly like a user. */
async function clickOutside(page: Page): Promise<void> {
	// Press a point that is outside every interactive PANEL (the `.fm-menu`, the
	// `.bs-popover__panel`, the `.popover__panel`) — NOT merely outside the menu
	// root. A shared `<Popover>` root is a full-viewport modal whose centred panel
	// is small; keying off the root rect (the whole viewport) made the old
	// "outside" point land unpredictably and read a perfectly-dismissable popover
	// as stuck. Scanning for a point clear of the actual panels hits the backdrop /
	// dimmer / app body — exactly where a user clicks to dismiss.
	const point = await page.evaluate(() => {
		const panels = Array.from(
			document.querySelectorAll(".fm-menu, .bs-popover__panel, .popover__panel, .bs-menu"),
		)
			.map((el) => el.getBoundingClientRect())
			.filter((r) => r.width > 1 && r.height > 1);
		const inAnyPanel = (x: number, y: number) =>
			panels.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
		const W = window.innerWidth;
		const H = window.innerHeight;
		// Candidate points biased to the edges (most likely backdrop), then centre.
		const candidates: Array<[number, number]> = [
			[Math.round(W * 0.5), H - 12],
			[12, H - 12],
			[W - 12, H - 12],
			[12, 12],
			[W - 12, 12],
			[Math.round(W * 0.5), 12],
			[Math.round(W * 0.5), Math.round(H * 0.5)],
		];
		for (const [x, y] of candidates) {
			if (!inAnyPanel(x, y)) return { x, y };
		}
		return { x: 6, y: 6 };
	});
	await page.mouse.click(point.x, point.y).catch(() => undefined);
}

export type MenuProbe = {
	label: string;
	/** The trigger was disabled — clicking it is EXPECTED to do nothing, so the
	 *  "opens nothing" signal below is suppressed (not a dead-affordance bug). */
	disabled: boolean;
	opened: boolean;
	escapeClosed: boolean;
	outsideClosed: boolean;
	stuck: string | null;
	interactiveAfter: boolean;
	/** True when every checked property held (or the trigger was disabled). */
	ok: boolean;
};

/** Open a menu via `trigger`, then assert it dismisses on BOTH Escape and an
 *  outside press, leaving no stuck overlay and an interactive app. This is the
 *  property that the Tasks ⋯→sidebar dead-click violated. */
export async function probeMenuTrigger(
	page: Page,
	trigger: Locator,
	label: string,
): Promise<MenuProbe> {
	// A trigger may open a fancy-menu (`.fm-menu`) OR a shared `<Popover>` /
	// non-permanent dialog (e.g. a Sort-by / filter popover). Treat ANY of those
	// transient surfaces as "the menu" so the dismiss cycle below runs against
	// whichever actually opened — otherwise a popover-opening trigger looks like
	// it "never opened" yet leaves a surface up, falsely reading as a stuck hang.
	const menu = page
		.locator('.fm-menu, .bs-popover, .popover, [role="dialog"]:not([data-permanent])')
		.first();
	const isOpen = () => menu.isVisible().catch(() => false);

	// A disabled trigger legitimately opens nothing — don't flag it. (A header ⋯
	// is `disabled` on surfaces with no object to act on.)
	const enabled =
		(await trigger.isEnabled().catch(() => true)) &&
		(await trigger.getAttribute("aria-disabled").catch(() => null)) !== "true";
	if (!enabled) {
		return {
			label,
			disabled: true,
			opened: false,
			escapeClosed: true,
			outsideClosed: true,
			stuck: null,
			interactiveAfter: true,
			ok: true,
		};
	}

	// 1. Escape dismissal.
	await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
	await trigger.click().catch(() => undefined);
	await page.waitForTimeout(380);
	const opened = await isOpen();
	let escapeClosed = true;
	if (opened) {
		await page.keyboard.press("Escape");
		await page.waitForTimeout(320);
		escapeClosed = !(await isOpen());
	}

	// 2. Outside-press dismissal (the dead-click path) — re-open, click away.
	let outsideClosed = true;
	if (opened) {
		await trigger.click().catch(() => undefined);
		await page.waitForTimeout(380);
		if (await isOpen()) {
			await clickOutside(page);
			await page.waitForTimeout(320);
			outsideClosed = !(await isOpen());
		}
	}

	const stuck = await checkNoStuckOverlay(page, `menu "${label}"`);
	const interactiveAfter = await appInteractive(page);
	// Leave the app clean for the next probe.
	await page.keyboard.press("Escape").catch(() => undefined);
	await page.waitForTimeout(120);

	const ok = opened && escapeClosed && outsideClosed && stuck === null && interactiveAfter;
	return {
		label,
		disabled: false,
		opened,
		escapeClosed,
		outsideClosed,
		stuck,
		interactiveAfter,
		ok,
	};
}

export type ButtonProbe = { label: string; effect: boolean; stuck: string | null };

/** Click a control and detect whether ANYTHING observably happened — DOM
 *  mutated, an overlay appeared, the route changed, or focus moved. A
 *  no-effect click is a candidate dead button (surfaced as `[?]`, since some
 *  controls are legitimately inert in a given state). Always tidies up after. */
export async function probeButton(
	page: Page,
	locator: Locator,
	label: string,
): Promise<ButtonProbe> {
	// A coarse innerHTML-LENGTH compare alone misses real effects and cries
	// "dead button" all over: a view switch swaps content of near-identical
	// length, an inline-rename swaps a label for an <input>, a selection moves an
	// `aria-current`/`aria-selected` flag, an async-IPC create lands after the
	// snapshot. Fingerprint structure too — element count, focused-element,
	// selected/expanded/current flags, input count, and live region text — so any
	// of those moving counts as an effect. (Canvas-only transforms still produce
	// no DOM signal — Graph/Whiteboard zoom legitimately read as `[?]`.)
	const snap = () =>
		page.evaluate(() => ({
			html: document.body.innerHTML.length,
			nodes: document.body.querySelectorAll("*").length,
			url: location.href,
			focus: document.activeElement?.tagName + (document.activeElement?.className ?? ""),
			overlays: document.querySelectorAll('.fm-menu,.popover,.bs-popover,[role="dialog"]').length,
			selected: document.querySelectorAll(
				'[aria-current="true"],[aria-current="page"],[aria-selected="true"],[aria-expanded="true"],[aria-pressed="true"],[data-active="true"]',
			).length,
			inputs: document.querySelectorAll("input,textarea,[contenteditable='true']").length,
		}));
	const before = await snap();
	await locator.click().catch(() => undefined);
	// Give async-IPC effects (entity create, view load) time to land before the
	// snapshot — 360ms was below the round-trip for several real creates.
	await page.waitForTimeout(650);
	const after = await snap();
	const effect =
		after.html !== before.html ||
		after.nodes !== before.nodes ||
		after.url !== before.url ||
		after.focus !== before.focus ||
		after.overlays !== before.overlays ||
		after.selected !== before.selected ||
		after.inputs !== before.inputs;
	// Dismiss anything the click opened so the next probe starts clean.
	await page.keyboard.press("Escape").catch(() => undefined);
	await page.waitForTimeout(120);
	const stuck = await checkNoStuckOverlay(page, `button "${label}"`);
	return { label, effect, stuck };
}

/** Live console-error / pageerror collector for a page. Attach once; read
 *  `.errors` after a probe to attribute new errors to the interaction. */
export function collectConsoleErrors(page: Page): { errors: string[] } {
	const errors: string[] = [];
	page.on("console", (m) => {
		if (m.type() === "error" && !/Failed to load resource|DevTools|Autofill/.test(m.text())) {
			errors.push(m.text());
		}
	});
	page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
	return { errors };
}
