/**
 * Session 302 — credential-free functional sweep across every app that works
 * WITHOUT external credentials (Mailbox OAuth + the Agent send/generate flow
 * are skipped; the Agent is still opened to capture its idle / no-model state).
 *
 * Goal: find non-working buttons, dead affordances, and bad design with fresh
 * eyes. For each app we: open it, settle on real data, capture idle, measure
 * the header, enumerate header controls, FIRE the primary "+ / New" header
 * action and capture the result (a dead primary button shows here), open the
 * trailing object ⋯ menu and capture it OPEN, then cycle panel toggles. Every
 * step is wrapped so one broken affordance never aborts the rest.
 *
 * Per the loop protocol the spec computes NO verdict — signal = screenshots +
 * console.log + notes.md, distilled into the friction log in the triage step.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";

async function measureHeader(page: Page): Promise<string> {
	return page
		.evaluate(() => {
			const header = document.querySelector(".app-header") as HTMLElement | null;
			const title = document.querySelector(".app-header__title") as HTMLElement | null;
			const hc = header ? getComputedStyle(header) : null;
			const tc = title ? getComputedStyle(title) : null;
			return JSON.stringify({
				headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
				titleShared: title?.classList.contains("app-header__title") ?? false,
				titleSize: tc?.fontSize ?? null,
				titleWeight: tc?.fontWeight ?? null,
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

/** Exercise one app: idle shot, header measure, primary +/New action, ⋯ menu
 *  open+shot, panel toggles. */
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

	// Primary "+ / New" header action — fire it and capture the result. A dead
	// primary button shows as a no-change shot here.
	const primary = page
		.locator(
			'.app-header button[aria-label*="new" i], .app-header button[aria-label*="add" i], .app-header button[aria-label*="create" i], .app-header button[aria-label*="compose" i]',
		)
		.first();
	const hasPrimary = await primary.isVisible().catch(() => false);
	if (hasPrimary) {
		const label = (await primary.getAttribute("aria-label").catch(() => null)) ?? "";
		await primary.click().catch(() => undefined);
		await page.waitForTimeout(800);
		s.note(`primary action: present=true label=${JSON.stringify(label)}`);
		await s.shot(page, `${name}-02-primary`);
		// Dismiss anything the action opened so the ⋯ probe starts clean.
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(250);
	} else {
		s.note("primary action: present=false");
	}

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
		// The shared fancy-menus runtime renders each item as `.fm-row`
		// (role="option"); the SDK's own anchored-menu uses `.bs-object-menu__item`.
		// Match both so the count reflects real menu rows, not a selector miss.
		const itemCount = await page
			.locator(".fm-menu .fm-row, .bs-object-menu__item, [role='menu'] [role='option']")
			.count()
			.catch(() => 0);
		s.note(`⋯ menu: present=true items=${itemCount}`);
		await s.shot(page, `${name}-03-more-menu`);
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
		await s.shot(page, `${name}-04-toggle-${i}`);
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
	["contacts", APP.Contacts],
];

const GROUP_B: [string, AppId][] = [
	["code-editor", APP.CodeEditor],
	["theme-editor", APP.ThemeEditor],
	["automations", APP.Automations],
	["browser", APP.Browser],
	["form-designer", APP.FormDesigner],
	["books", APP.Books],
	["preview", APP.Preview],
	["agent", APP.Agent],
];

test("credential-free functional sweep — group A (302)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("302-credfree-sweep-a");
	try {
		for (const [name, id] of GROUP_A) await sweepApp(s, name, id);
	} finally {
		await s.finish();
	}
});

test("credential-free functional sweep — group B (302)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("302-credfree-sweep-b");
	try {
		for (const [name, id] of GROUP_B) await sweepApp(s, name, id);
	} finally {
		await s.finish();
	}
});
