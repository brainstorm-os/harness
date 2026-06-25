/**
 * Session 339 — cross-app element-consistency audit.
 *
 * Unlike the per-app eyeball walks (336/337), this captures the SAME element
 * across every app so they can be read side-by-side (all 20 headers together,
 * all detail/right panes together, all ⋯ menus together) — the comparison that
 * surfaces drift a single-app pass misses. For each app it captures:
 *   -1-main   : header (title + left/right groups + ⋯) + the list/main surface
 *   -2-detail : the right/detail pane after drilling the first content item
 *   -3-objmenu: the header object ⋯ menu chrome
 *
 * Asserts nothing subjective — screenshots are the deliverable; it only notes
 * console errors. OOM-safe: closes each renderer before the next.
 */

import { type Page, test } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

const ALL_APPS: ReadonlyArray<{ id: AppId; name: string }> = [
	{ id: APP.Notes, name: "Notes" },
	{ id: APP.Journal, name: "Journal" },
	{ id: APP.Tasks, name: "Tasks" },
	{ id: APP.Database, name: "Database" },
	{ id: APP.Calendar, name: "Calendar" },
	{ id: APP.Contacts, name: "Contacts" },
	{ id: APP.Bookmarks, name: "Bookmarks" },
	{ id: APP.Files, name: "Files" },
	{ id: APP.Graph, name: "Graph" },
	{ id: APP.Whiteboard, name: "Whiteboard" },
	{ id: APP.Books, name: "Books" },
	{ id: APP.Preview, name: "Preview" },
	{ id: APP.Chat, name: "Chat" },
	{ id: APP.Agent, name: "Agent" },
	{ id: APP.Mailbox, name: "Mailbox" },
	{ id: APP.Browser, name: "Browser" },
	{ id: APP.Automations, name: "Automations" },
	{ id: APP.FormDesigner, name: "Form Designer" },
	{ id: APP.CodeEditor, name: "Code Editor" },
	{ id: APP.ThemeEditor, name: "Theme Editor" },
];

const ITEM_SELECTORS = [
	".db-sidebar__list-item",
	"[role='row']",
	".bs-list-row",
	".notes__list-item",
	".tasks-row",
	".bookmarks__row",
	".files__row",
	".contacts-list__row",
	"[data-entity-id]",
	".bs-card",
];

async function captureApp(s: FounderSession, page: Page, name: string): Promise<void> {
	const slug = name.toLowerCase().replace(/\s+/g, "-");
	await page.waitForTimeout(2200);
	await s.shot(page, `${slug}-1-main`);

	for (const sel of ITEM_SELECTORS) {
		const item = page.locator(sel).first();
		if ((await item.count().catch(() => 0)) > 0 && (await item.isVisible().catch(() => false))) {
			await item.click().catch(() => undefined);
			await page.waitForTimeout(1100);
			await s.shot(page, `${slug}-2-detail`);
			break;
		}
	}

	const more = page.locator(".app-header .bs-object-menu__more").first();
	if ((await more.count().catch(() => 0)) > 0 && (await more.isEnabled().catch(() => false))) {
		await more.click().catch(() => undefined);
		await page.waitForTimeout(450);
		await s.shot(page, `${slug}-3-objmenu`);
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(200);
	}
}

test("cross-app element-consistency capture (339)", async () => {
	test.setTimeout(2_400_000);
	const s = await startSession("339-cross-app-consistency");

	await s.app.evaluate(({ dialog }) => {
		dialog.showOpenDialog = (async () => ({ canceled: true, filePaths: [] })) as typeof dialog.showOpenDialog;
		dialog.showSaveDialog = (async () => ({
			canceled: true,
			filePath: undefined,
		})) as typeof dialog.showSaveDialog;
	});

	try {
		for (const appDef of ALL_APPS) {
			s.note(`\n## ${appDef.name}`);
			let page: Page | null = null;
			try {
				page = await s.openApp(appDef.id);
			} catch (error) {
				s.note(`[FAIL] ${appDef.name} did not open: ${(error as Error).message}`);
				continue;
			}
			if (!page) continue;
			page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
			page.setDefaultTimeout(4000);
			const errs = collectConsoleErrors(page);
			try {
				await captureApp(s, page, appDef.name);
			} catch (error) {
				s.note(`[!] ${appDef.name} capture aborted: ${(error as Error).message}`);
			}
			if (errs.errors.length > 0) {
				s.note(`[?] ${appDef.name} console errors (${errs.errors.length}):`);
				for (const e of errs.errors.slice(0, 4)) s.note(`    ${e}`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(250).catch(() => undefined);
		}
	} finally {
		await s.finish();
	}
});

test("aligned center-pane empties render the shared chrome (339b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("339b-empty-alignment-verify");
	try {
		// Chat / Mailbox / Agent each had a hand-rolled center empty (no glyph /
		// flat icon / small chip); all three now route through the shared
		// <EmptyState> Hero. A fresh dev vault opens each at its primary empty.
		for (const [appId, slug] of [
			[APP.Chat, "chat"],
			[APP.Mailbox, "mailbox"],
			[APP.Agent, "agent"],
		] as const) {
			const page = await s.openApp(appId);
			if (!page) continue;
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(2400);
			const count = await page.locator(".bs-empty-state").count();
			s.note(`[i] ${slug}: ${count} .bs-empty-state on open`);
			await s.shot(page, `${slug}-empty`);
			if (errs.errors.length > 0) {
				s.note(`[?] ${slug} console errors (${errs.errors.length}):`);
				for (const e of errs.errors.slice(0, 6)) s.note(`    ${e}`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300).catch(() => undefined);
		}
	} finally {
		await s.finish();
	}
});
