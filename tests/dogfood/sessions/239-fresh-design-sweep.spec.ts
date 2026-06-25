/**
 * Session 239 — fresh design + functionality sweep across every app, run a
 * "week" after the last sweeps (227/228) against the accumulated Northbound
 * vault. Goal: catch DESIGN and FUNCTIONALITY problems with fresh eyes.
 *
 * For each app we: open it, let it settle on real (populated) data, capture the
 * idle state, measure the header face, enumerate header controls, open the
 * trailing object ⋯ menu and CAPTURE IT OPEN (so a dead/empty menu is visible
 * in the shot, not just inferred), then cycle any view-mode / panel toggles
 * capturing each. Every step is wrapped so one broken affordance never aborts
 * the rest. Signal = the screenshots + notes.md, distilled into the friction log.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";

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
				borderBottom: hc?.borderBottomWidth ?? null,
				titleShared: title?.classList.contains("app-header__title") ?? false,
				titleSize: tc?.fontSize ?? null,
				titleWeight: tc?.fontWeight ?? null,
				titleText: title?.textContent?.slice(0, 40) ?? null,
			});
		})
		.catch((e) => `(measure failed: ${(e as Error).message})`);
}

async function headerControls(page: Page): Promise<string> {
	return page
		.evaluate(() => {
			const btns = Array.from(
				document.querySelectorAll(".app-header button, .app-header [role='button']"),
			);
			return JSON.stringify(
				btns.map(
					(b) =>
						b.getAttribute("aria-label") ??
						b.getAttribute("title") ??
						(b.textContent ?? "").trim().slice(0, 20),
				),
			);
		})
		.catch((e) => `(controls failed: ${(e as Error).message})`);
}

/** Exercise one app: idle shot, header measure, ⋯ menu open+shot, view toggles. */
async function sweepApp(s: FounderSession, name: string, id: AppId): Promise<void> {
	let page: Page;
	try {
		page = await s.openApp(id);
	} catch (err) {
		s.note(`\n### ${name}\n[FAIL] open: ${(err as Error).message}`);
		return;
	}
	await page.waitForTimeout(2600);
	s.note(`\n### ${name}`);
	s.note(`header: ${await measureHeader(page)}`);
	s.note(`controls: ${await headerControls(page)}`);
	await s.shot(page, `${name}-01-idle`);

	// Trailing object ⋯ menu — open it and CAPTURE IT OPEN.
	const more = page
		.locator(
			'.bs-object-menu__more, .app-header button[aria-label*="More" i], .app-header button[aria-label*="actions" i], .app-header button[aria-label*="menu" i]',
		)
		.last();
	const hasMore = await more.isVisible().catch(() => false);
	if (hasMore) {
		await more.click().catch(() => undefined);
		await page.waitForTimeout(700);
		const menuVisible = await page
			.locator(".bs-object-menu, .fm-menu, [role='menu']")
			.first()
			.isVisible()
			.catch(() => false);
		const itemCount = await page
			.locator(".bs-object-menu__item, .fm-menu [role='menuitem'], [role='menu'] [role='menuitem']")
			.count()
			.catch(() => 0);
		s.note(`⋯ menu: present=${hasMore} opened=${menuVisible} items=${itemCount}`);
		await s.shot(page, `${name}-02-more-menu`);
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(250);
	} else {
		s.note("⋯ menu: present=false");
	}

	// View-mode / panel toggles — click each once, capture, restore.
	const toggles = page.locator(
		'.app-header button[aria-label*="view" i], .app-header button[aria-label*="sidebar" i], .app-header button[aria-label*="inspector" i], .app-header button[aria-label*="panel" i], .app-header [role="tab"]',
	);
	const tCount = await toggles.count().catch(() => 0);
	s.note(`view/panel toggles: ${tCount}`);
	for (let i = 0; i < Math.min(tCount, 3); i++) {
		await toggles
			.nth(i)
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(600);
		await s.shot(page, `${name}-03-toggle-${i}`);
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

test("fresh design sweep — group A (239)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("239-fresh-sweep-a");
	try {
		for (const [name, id] of GROUP_A) await sweepApp(s, name, id);
	} finally {
		await s.finish();
	}
});

test("fresh design sweep — group B (239)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("239-fresh-sweep-b");
	try {
		for (const [name, id] of GROUP_B) await sweepApp(s, name, id);
	} finally {
		await s.finish();
	}
});
