/**
 * Session 311 — Sol's first day. The interaction & accessibility lens.
 *
 * Sol Reyes (Interaction & Accessibility Engineer, Mira's fourth hire) doesn't
 * build an artifact — they DRIVE affordances and judge how the product *behaves*:
 *   • every header button has an accessible name (icon-only ⇒ aria-label / tooltip)
 *   • focus is reachable by keyboard AND visible (a focus ring, not outline:none)
 *   • the object ⋯ menu opens to a real [role=menu] and Escape closes it
 *   • hover gives feedback; press gives feedback
 *   • prefers-reduced-motion is honored (set, then screenshot for review)
 *
 * Same checks run across many apps on purpose — Sol's job is to catch where one
 * app behaves unlike the others. Each app is wrapped so one snag never aborts
 * the sweep. Verdicts here are SIGNALS; the screenshots are the evidence.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, type FounderSession, SPEAKER, startSession } from "../lib/founder";

const pass = (s: FounderSession, a: string, o: string) => s.note(`[PASS] ${a} — ${o}`);
const fail = (s: FounderSession, a: string, o: string) => s.note(`[FAIL] ${a} — ${o}`);
const judge = (s: FounderSession, a: string, ok: boolean, o: string) =>
	ok ? pass(s, a, o) : fail(s, a, o);

type NamedButton = { idx: number; hasName: boolean; name: string; iconOnly: boolean };

/** Every header button should expose an accessible name. An icon-only button
 *  with no aria-label / text / tooltip is a screen-reader dead end. */
async function auditHeaderButtons(page: Page): Promise<NamedButton[]> {
	return page
		.evaluate(() => {
			const btns = Array.from(
				document.querySelectorAll(".app-header button, .app-header [role='button']"),
			);
			return btns.map((b, idx) => {
				const el = b as HTMLElement;
				const text = (el.textContent || "").trim();
				const aria = el.getAttribute("aria-label") || "";
				const tip = el.getAttribute("data-bs-tooltip") || el.getAttribute("title") || "";
				const name = aria || text || tip;
				const iconOnly = !text;
				return { idx, hasName: name.length > 0, name, iconOnly };
			});
		})
		.catch(() => [] as NamedButton[]);
}

type FocusStop = {
	step: number;
	tag: string;
	name: string;
	visibleRing: boolean;
	isField: boolean;
};

/** Tab-walk the surface and, at each stop, record what holds focus and whether
 *  a focus indicator is actually visible (outline OR box-shadow change). */
async function tabWalk(page: Page, steps: number): Promise<FocusStop[]> {
	const trail: FocusStop[] = [];
	await page
		.locator("body")
		.press("Tab")
		.catch(() => undefined);
	for (let i = 0; i < steps; i++) {
		const stop = await page
			.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el || el === document.body) return null;
				const cs = getComputedStyle(el);
				const outline = cs.outlineStyle !== "none" && cs.outlineWidth !== "0px";
				const ring = cs.boxShadow !== "none";
				const tag = el.tagName.toLowerCase();
				const isField = tag === "input" || tag === "textarea" || el.isContentEditable === true;
				const name =
					el.getAttribute("aria-label") ||
					(el.textContent || "").trim().slice(0, 40) ||
					el.getAttribute("data-bs-tooltip") ||
					el.getAttribute("placeholder") ||
					"";
				return { tag, name, visibleRing: outline || ring, isField };
			})
			.catch(() => null);
		if (stop) trail.push({ step: i, ...stop });
		await page.keyboard.press("Tab").catch(() => undefined);
	}
	return trail;
}

async function sweepApp(s: FounderSession, id: AppId, label: string): Promise<void> {
	try {
		const page = await s.openApp(id);
		await page.waitForTimeout(2600);
		await s.shot(page, `${label}-01-open`);

		// 1) Accessible names on every header control.
		const btns = await auditHeaderButtons(page);
		const unnamed = btns.filter((b) => !b.hasName);
		judge(
			s,
			`${label} header buttons named`,
			btns.length > 0 && unnamed.length === 0,
			`${btns.length} controls, ${unnamed.length} without an accessible name${unnamed.length ? ` (idx ${unnamed.map((b) => b.idx).join(",")})` : ""}`,
		);

		// 2) Keyboard reachability + a VISIBLE focus indicator.
		const trail = await tabWalk(page, 22);
		const noRing = trail.filter((t) => !t.visibleRing && !t.isField);
		judge(s, `${label} focus reachable`, trail.length >= 3, `${trail.length} focus stops in 22 tabs`);
		judge(
			s,
			`${label} focus visible`,
			trail.length > 0 && noRing.length === 0,
			noRing.length
				? `${noRing.length}/${trail.length} stops had NO focus ring (e.g. ${noRing
						.slice(0, 3)
						.map((t) => `${t.tag}:${t.name || "?"}`)
						.join(", ")})`
				: `all ${trail.length} stops showed a focus ring`,
		);
		// Park focus on a mid-trail control and shoot it for ring-quality review.
		await page
			.locator("body")
			.press("Tab")
			.catch(() => undefined);
		for (let i = 0; i < 4; i++) await page.keyboard.press("Tab").catch(() => undefined);
		await s.shot(page, `${label}-02-focus-ring`);

		// 3) Hover feedback on the first header button.
		const firstBtn = page.locator(".app-header button").first();
		await firstBtn.hover().catch(() => undefined);
		await page.waitForTimeout(450);
		await s.shot(page, `${label}-03-hover`);

		// 4) The object ⋯ menu opens to a real menu, Escape closes it.
		const more = page
			.locator(
				'.app-header [aria-label*="more" i], .app-header [aria-label*="menu" i], .app-header .bs-object-menu__more, .app-header button:has-text("⋯")',
			)
			.last();
		const menuSel = '.bs-menu, [role="menu"], .fancy-menu, [class*="menu-panel"]';
		let menuOpened = false;
		let menuClosed = false;
		if (
			await more
				.count()
				.then((c) => c > 0)
				.catch(() => false)
		) {
			await more.click().catch(() => undefined);
			await page.waitForTimeout(700);
			menuOpened = await page
				.locator(menuSel)
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(page, `${label}-04-menu`);
			await page.keyboard.press("Escape").catch(() => undefined);
			await page.waitForTimeout(500);
			const stillOpen = await page
				.locator(menuSel)
				.first()
				.isVisible()
				.catch(() => false);
			menuClosed = !stillOpen;
		}
		judge(
			s,
			`${label} ⋯ menu opens`,
			menuOpened,
			menuOpened ? "menu surface appeared" : "no menu surface after clicking ⋯",
		);
		if (menuOpened)
			judge(s, `${label} Escape closes menu`, menuClosed, menuClosed ? "closed" : "stayed open");

		// 5) Reduced-motion: honor the OS preference, capture for review.
		await page.emulateMedia({ reducedMotion: "reduce" }).catch(() => undefined);
		await page.waitForTimeout(400);
		await s.shot(page, `${label}-05-reduced-motion`);
		await page.emulateMedia({ reducedMotion: "no-preference" }).catch(() => undefined);
	} catch (e) {
		fail(s, `${label} sweep`, (e as Error).message);
	}
}

test("Sol — interaction & a11y sweep (311)", async () => {
	test.setTimeout(900_000);
	const s = await startSession("311-sol-interaction-a11y-sweep");
	s.chat(
		SPEAKER.Sol,
		"First day. Not touching anyone's content — I just want to feel the app. Tabbing through every surface, hovering every button, opening every menu. I'll file what doesn't respond the way it should.",
	);
	try {
		const apps: Array<[AppId, string]> = [
			[APP.Notes, "notes"],
			[APP.Database, "database"],
			[APP.Tasks, "tasks"],
			[APP.Calendar, "calendar"],
			[APP.Files, "files"],
			[APP.Contacts, "contacts"],
			[APP.Bookmarks, "bookmarks"],
			[APP.Journal, "journal"],
			[APP.Preview, "preview"],
		];
		for (const [id, label] of apps) await sweepApp(s, id, label);
		s.chat(
			SPEAKER.Sol,
			"Sweep done — notes.md has the per-app verdicts and the focus-ring / menu / hover shots. Triaging the [FAIL]s into friction next.",
		);
	} finally {
		await s.finish();
	}
});
