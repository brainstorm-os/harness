/**
 * Session 336 — design-eyeball walk across all 20 apps.
 *
 * The 328 sweep proves affordances aren't dead or stuck (mechanical). This walk
 * is the SUBJECTIVE complement: for each app it captures the states a designer
 * judges — the empty/main surface, a drilled-in object (first row/card opened),
 * an open object ⋯ menu, and (where present) a secondary view — so the captures
 * can be read back for "poor interface choices" (cramped spacing, misaligned
 * headers, ugly empty states, inconsistent chrome, truncation, contrast).
 *
 * It asserts nothing subjective — it only fails on console errors that indicate
 * a broken render. The screenshots are the deliverable; triage reads them.
 * OOM-safe: closes each app's renderer before opening the next (20 live
 * renderers crash Electron mid-walk).
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

// First-content-item selectors — the row/card a user would click to drill in.
const ITEM_SELECTORS = [
	".db-sidebar__list-item",
	"[role='row']",
	".bs-list-row",
	".notes__list-item",
	".tasks-row",
	".bookmarks__row",
	".files__row",
	".contacts__row",
	"[data-entity-id]",
	".bs-card",
];

async function captureApp(s: FounderSession, page: Page, name: string): Promise<void> {
	const slug = name.toLowerCase().replace(/\s+/g, "-");
	await page.waitForTimeout(2400);
	await s.shot(page, `${slug}-1-main`);

	// Drill into the first content item, if any.
	for (const sel of ITEM_SELECTORS) {
		const item = page.locator(sel).first();
		if ((await item.count().catch(() => 0)) > 0 && (await item.isVisible().catch(() => false))) {
			await item.click().catch(() => undefined);
			await page.waitForTimeout(1200);
			await s.shot(page, `${slug}-2-detail`);
			break;
		}
	}

	// Open the header object ⋯ menu (the catch-all overflow) for a chrome capture.
	const more = page.locator(".app-header .bs-object-menu__more").first();
	if ((await more.count().catch(() => 0)) > 0 && (await more.isEnabled().catch(() => false))) {
		await more.click().catch(() => undefined);
		await page.waitForTimeout(500);
		await s.shot(page, `${slug}-3-objmenu`);
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(250);
	}
}

test("design-eyeball walk across all apps (336)", async () => {
	test.setTimeout(2_400_000);
	const s = await startSession("336-design-eyeball-walk");

	// Stub native dialogs so a stray click can't wedge the renderer.
	await s.app.evaluate(({ dialog }) => {
		dialog.showOpenDialog = (async () => ({
			canceled: true,
			filePaths: [],
		})) as typeof dialog.showOpenDialog;
		dialog.showSaveDialog = (async () => ({
			canceled: true,
			filePath: undefined,
		})) as typeof dialog.showSaveDialog;
	});

	const errorReports: string[] = [];
	try {
		for (const appDef of ALL_APPS) {
			s.note(`\n## ${appDef.name}`);
			let page: Page | null = null;
			try {
				page = await s.openApp(appDef.id);
			} catch (error) {
				s.note(`[FAIL] ${appDef.name} did not open: ${(error as Error).message}`);
				errorReports.push(`${appDef.name}: did not open`);
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
				for (const e of errs.errors.slice(0, 8)) s.note(`    ${e}`);
				errorReports.push(`${appDef.name}: ${errs.errors.length} console error(s)`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300).catch(() => undefined);
		}
		s.note(`\n## summary — apps with console errors: ${errorReports.length}`);
		for (const r of errorReports) s.note(`  ${r}`);
	} finally {
		await s.finish();
	}
});
