/**
 * Session 244 — the RIGHT PANEL (inspector / properties / comments) across every
 * app that has one. This surface is under-tested: it only populates once an
 * entity is SELECTED, so a plain idle screenshot shows nothing. For each app we
 * select an entity, open the inspector, capture it, MEASURE the shared
 * `.bs-props` panel (header height, title face, cover-band height, row count),
 * and — for prose apps — switch to the Comments tab. Signal = the screenshots +
 * the measured JSON in notes.md.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";

type PanelApp = {
	name: string;
	id: AppId;
	/** Selector for a list item to click so an entity is selected. */
	selectItem: string;
	/** aria-label fragments for the inspector/properties toggle. */
	openPanel: string;
};

/** Measure the shared properties panel so cross-app drift falls out as numbers. */
async function measurePanel(page: Page): Promise<string> {
	return page
		.evaluate(() => {
			const panel =
				(document.querySelector(".bs-props") as HTMLElement | null) ??
				(document.querySelector(
					"[class*='inspector'],[class*='props'],[class*='detail']",
				) as HTMLElement | null);
			if (!panel) return JSON.stringify({ panel: null });
			const head = panel.querySelector(".bs-props__head") as HTMLElement | null;
			const title = panel.querySelector(".bs-props__title") as HTMLElement | null;
			const cover = panel.querySelector("[class*='cover']") as HTMLElement | null;
			const rows = panel.querySelectorAll(".bs-props__row").length;
			const meta = panel.querySelectorAll(".bs-props__meta-row").length;
			const emptyRowValues = Array.from(panel.querySelectorAll(".bs-props__row-value")).filter(
				(v) => (v.textContent ?? "").trim() === "",
			).length;
			const tc = title ? getComputedStyle(title) : null;
			return JSON.stringify({
				panelClass: panel.className.slice(0, 40),
				headH: head ? Math.round(head.getBoundingClientRect().height) : null,
				titleSize: tc?.fontSize ?? null,
				titleWeight: tc?.fontWeight ?? null,
				titleText: title?.textContent?.slice(0, 30) ?? null,
				coverH: cover ? Math.round(cover.getBoundingClientRect().height) : null,
				coverShrink: cover ? getComputedStyle(cover).flexShrink : null,
				rows,
				meta,
				emptyRowValues,
			});
		})
		.catch((e) => `(measure failed: ${(e as Error).message})`);
}

async function sweepPanel(s: FounderSession, app: PanelApp): Promise<void> {
	let page: Page;
	try {
		page = await s.openApp(app.id);
	} catch (e) {
		s.note(`\n### ${app.name}\n[FAIL] open: ${(e as Error).message}`);
		return;
	}
	await page.waitForTimeout(2600);
	s.note(`\n### ${app.name}`);

	// Select an entity so the inspector populates.
	const item = page.locator(app.selectItem).first();
	const hasItem = await item.isVisible().catch(() => false);
	s.note(`select item (${app.selectItem}) visible: ${hasItem}`);
	if (hasItem) {
		await item.click().catch(() => undefined);
		await page.waitForTimeout(1200);
	}

	// Open the inspector/properties panel if a toggle exists + it isn't already open.
	const toggle = page
		.locator(
			`.app-header button[aria-label*="${app.openPanel}" i], button[aria-label*="${app.openPanel}" i]`,
		)
		.first();
	if (await toggle.isVisible().catch(() => false)) {
		await toggle.click().catch(() => undefined);
		await page.waitForTimeout(900);
	}
	s.note(`panel: ${await measurePanel(page)}`);
	await s.shot(page, `${app.name}-01-panel`);

	// Add-property affordance present?
	const addBtn = page.locator(".bs-props__add").first();
	s.note(`add-property button visible: ${await addBtn.isVisible().catch(() => false)}`);

	// Comments tab (prose apps) — switch to it if present.
	const commentsTab = page
		.locator(
			'[role="tab"]:has-text("Comment"), button:has-text("Comments"), [aria-label*="comment" i]',
		)
		.first();
	if (await commentsTab.isVisible().catch(() => false)) {
		await commentsTab.click().catch(() => undefined);
		await page.waitForTimeout(800);
		await s.shot(page, `${app.name}-02-comments`);
		s.note("comments tab: opened");
	} else {
		s.note("comments tab: none");
	}
}

const PANEL_APPS: PanelApp[] = [
	{ name: "notes", id: APP.Notes, selectItem: ".notes__sidebar-item", openPanel: "properties" },
	{
		name: "database",
		id: APP.Database,
		selectItem: ".db-grid__row, [role='row'], .db-row",
		openPanel: "inspector",
	},
	{
		name: "journal",
		id: APP.Journal,
		selectItem: ".journal__entry-link, .journal__overview-row",
		openPanel: "properties",
	},
	{
		name: "files",
		id: APP.Files,
		selectItem: ".content-list__row, [class*='content-list'] [role='row'], [class*='file']",
		openPanel: "inspector",
	},
	{ name: "books", id: APP.Books, selectItem: ".books__row", openPanel: "book info" },
	{
		name: "contacts",
		id: APP.Contacts,
		selectItem: "[class*='contact-row'], [class*='person'], [class*='list-item']",
		openPanel: "properties",
	},
	{
		name: "tasks",
		id: APP.Tasks,
		selectItem: ".task-row, [class*='task-row'], [class*='task__row']",
		openPanel: "inspector",
	},
	{
		name: "bookmarks",
		id: APP.Bookmarks,
		selectItem: "[class*='bookmark'], li",
		openPanel: "inspector",
	},
	{ name: "code-editor", id: APP.CodeEditor, selectItem: "[class*='file']", openPanel: "inspector" },
];

test("right-panel sweep — group A (244)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("244-right-panel-a");
	try {
		for (const app of PANEL_APPS.slice(0, 5)) await sweepPanel(s, app);
	} finally {
		await s.finish();
	}
});

test("right-panel sweep — group B (244)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("244-right-panel-b");
	try {
		for (const app of PANEL_APPS.slice(5)) await sweepPanel(s, app);
	} finally {
		await s.finish();
	}
});
