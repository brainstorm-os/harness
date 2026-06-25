/**
 * Session 227 — functional sweep across every app. For each app we don't just
 * screenshot the idle state (that was 222); we actively drive it: enumerate its
 * header controls, fire the primary "new / add" affordance, type into whatever
 * editing surface appears, open the object ⋯ menu, and toggle any view/panel
 * controls — capturing a shot at each meaningful step and letting the harness
 * record every renderer console error.
 *
 * It also MEASURES each app's `.app-header` + `.app-header__title` computed
 * style (height, title font-size / weight / colour, presence of the shared
 * class) into notes.md, so header/title-face inconsistencies between apps fall
 * out as objective numbers rather than eyeballing.
 *
 * Split into two tests of ~9 apps so each stays inside the per-test budget.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";

/** Measure the header + title face so cross-app inconsistencies are numbers. */
async function measureHeader(page: Page): Promise<string> {
	return page
		.evaluate(() => {
			const header = document.querySelector(".app-header") as HTMLElement | null;
			const title =
				(document.querySelector(".app-header__title") as HTMLElement | null) ??
				(document.querySelector(".app-header [class*='title']") as HTMLElement | null);
			const hc = header ? getComputedStyle(header) : null;
			const tc = title ? getComputedStyle(title) : null;
			return JSON.stringify({
				headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
				headerBorderBottom: hc?.borderBottomWidth ?? null,
				titleClass: title?.className ?? null,
				titleSharedClass: title?.classList.contains("app-header__title") ?? false,
				titleSize: tc?.fontSize ?? null,
				titleWeight: tc?.fontWeight ?? null,
				titleColor: tc?.color ?? null,
				titleText: title?.textContent?.slice(0, 40) ?? null,
			});
		})
		.catch((e) => `(measure failed: ${(e as Error).message})`);
}

/** Enumerate header buttons (label + visible) so missing/odd controls show up. */
async function headerControls(page: Page): Promise<string> {
	return page
		.evaluate(() => {
			const btns = Array.from(
				document.querySelectorAll(".app-header button, .app-header [role='button']"),
			);
			return JSON.stringify(
				btns.map((b) => ({
					label:
						b.getAttribute("aria-label") ??
						b.getAttribute("title") ??
						(b.textContent ?? "").trim().slice(0, 24),
					expanded: b.getAttribute("aria-expanded"),
				})),
			);
		})
		.catch((e) => `(controls failed: ${(e as Error).message})`);
}

/** Actively exercise one app and record what worked / broke. */
async function exerciseApp(s: FounderSession, name: string, id: AppId): Promise<void> {
	let page: Page;
	try {
		page = await s.openApp(id);
	} catch (err) {
		s.note(`### ${name}\nFAILED to open: ${(err as Error).message}\n`);
		return;
	}
	await page.waitForTimeout(2400);
	s.note(`\n### ${name}`);
	s.note(`header: ${await measureHeader(page)}`);
	s.note(`controls: ${await headerControls(page)}`);
	await s.shot(page, `${name}-01-open`);

	// Primary "new / add / create / compose" affordance — the first one found.
	const newBtn = page
		.locator(
			'.app-header button[aria-label*="New" i], .app-header button[aria-label*="Add" i], .app-header button[aria-label*="Create" i], .app-header button[aria-label*="Compose" i], button[aria-label*="New" i]',
		)
		.first();
	const hasNew = await newBtn.isVisible().catch(() => false);
	s.note(`primary-new affordance visible: ${hasNew}`);
	if (hasNew) {
		await newBtn.click().catch(() => undefined);
		await page.waitForTimeout(1400);
		await s.shot(page, `${name}-02-new`);
		// Type into whatever focusable surface appeared.
		const surface = page
			.locator('[contenteditable="true"], input[type="text"]:visible, textarea:visible')
			.first();
		if (await surface.isVisible().catch(() => false)) {
			await surface.click().catch(() => undefined);
			await page.keyboard.type(`Sweep 227 ${name}`, { delay: 10 }).catch(() => undefined);
			await page.waitForTimeout(600);
			await s.shot(page, `${name}-03-typed`);
			s.note("typed into editing surface: yes");
		} else {
			s.note("typed into editing surface: no focusable surface");
		}
	}

	// Object ⋯ menu — the trailing overflow menu every app should carry.
	const moreBtn = page
		.locator(
			'.bs-object-menu__more, .app-header button[aria-label*="More" i], .app-header button[aria-label*="menu" i], .app-header button[aria-label="⋯"]',
		)
		.last();
	const hasMore = await moreBtn.isVisible().catch(() => false);
	s.note(`object ⋯ menu visible: ${hasMore}`);
	if (hasMore) {
		await moreBtn.click().catch(() => undefined);
		await page.waitForTimeout(700);
		const menuVisible = await page
			.locator(".fm-menu, [role='menu']")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`⋯ opened a menu: ${menuVisible}`);
		await s.shot(page, `${name}-04-more-menu`);
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(300);
	}

	// View / panel toggles — sidebar, inspector, view-mode switches.
	const toggles = page.locator(
		'.app-header button[aria-label*="sidebar" i], .app-header button[aria-label*="inspector" i], .app-header button[aria-label*="view" i], .app-header button[aria-label*="panel" i]',
	);
	const tCount = await toggles.count().catch(() => 0);
	s.note(`view/panel toggles found: ${tCount}`);
	if (tCount > 0) {
		await toggles
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(700);
		await s.shot(page, `${name}-05-toggle`);
		await toggles
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(300);
	}
}

const GROUP_A: [string, AppId][] = [
	["notes", APP.Notes],
	["database", APP.Database],
	["tasks", APP.Tasks],
	["calendar", APP.Calendar],
	["journal", APP.Journal],
	["graph", APP.Graph],
	["whiteboard", APP.Whiteboard],
	["files", APP.Files],
	["bookmarks", APP.Bookmarks],
];

const GROUP_B: [string, AppId][] = [
	["code-editor", APP.CodeEditor],
	["theme-editor", APP.ThemeEditor],
	["contacts", APP.Contacts],
	["automations", APP.Automations],
	["browser", APP.Browser],
	["mailbox", APP.Mailbox],
	["form-designer", APP.FormDesigner],
	["books", APP.Books],
	["agent", APP.Agent],
];

test("functional sweep — group A (knowledge + visual apps) (227)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("227-functional-sweep-a");
	try {
		for (const [name, id] of GROUP_A) await exerciseApp(s, name, id);
	} finally {
		await s.finish();
	}
});

test("functional sweep — group B (newer + connector apps) (227)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("227-functional-sweep-b");
	try {
		for (const [name, id] of GROUP_B) await exerciseApp(s, name, id);
	} finally {
		await s.finish();
	}
});
