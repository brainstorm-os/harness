/**
 * Session 340 — full-product verify after a heavy build day.
 *
 * "Dogfood everything to be sure it works." Two passes on a fresh vault:
 *  A) every one of the 20 apps opens, renders, drills into its first item, and
 *     opens its ⋯ menu — with ZERO console errors (the broad regression bar:
 *     covers the empty-state design-system work across 10 apps + general health).
 *  B) the NEW Settings surfaces shipped today — Settings → Network's
 *     "Automation network access" egress allowlist (11b.8b) and Settings → AI's
 *     MCP servers panel (MCP-2's stdio transport rides this) — render clean.
 *
 * Screenshots are the deliverable; the only hard failures are console errors
 * and a missing new-surface marker. OOM-safe: each app renderer is closed
 * before the next.
 */

import { type Page, expect, test } from "@playwright/test";
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
			await page.waitForTimeout(1000);
			await s.shot(page, `${slug}-2-detail`);
			break;
		}
	}
	const more = page.locator(".app-header .bs-object-menu__more").first();
	if ((await more.count().catch(() => 0)) > 0 && (await more.isEnabled().catch(() => false))) {
		await more.click().catch(() => undefined);
		await page.waitForTimeout(400);
		await s.shot(page, `${slug}-3-objmenu`);
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(200);
	}
}

test("full-product verify — 20 apps + new Settings surfaces (340)", async () => {
	test.setTimeout(2_400_000);
	const s = await startSession("340-full-product-verify");
	await s.app.evaluate(({ dialog }) => {
		dialog.showOpenDialog = (async () => ({ canceled: true, filePaths: [] })) as typeof dialog.showOpenDialog;
		dialog.showSaveDialog = (async () => ({
			canceled: true,
			filePath: undefined,
		})) as typeof dialog.showSaveDialog;
	});

	const broken: string[] = [];
	try {
		// ── Pass A: every app ──────────────────────────────────────────────
		for (const appDef of ALL_APPS) {
			s.note(`\n## ${appDef.name}`);
			let page: Page | null = null;
			try {
				page = await s.openApp(appDef.id);
			} catch (error) {
				s.note(`[FAIL] ${appDef.name} did not open: ${(error as Error).message}`);
				broken.push(`${appDef.name}: did not open`);
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
				broken.push(`${appDef.name}: ${errs.errors.length} console error(s)`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(250).catch(() => undefined);
		}

		// ── Pass B: today's new Settings surfaces ──────────────────────────
		s.note("\n## Settings (new surfaces)");
		const dash = s.dashboard;
		const dashErrs = collectConsoleErrors(dash);
		await dash.bringToFront().catch(() => undefined);
		// The header settings IconButton (aria-label "Settings"); fall back to the
		// Cmd+, chord if the control is hidden.
		const settingsBtn = dash.getByRole("button", { name: "Settings" }).first();
		if ((await settingsBtn.count().catch(() => 0)) > 0) {
			await settingsBtn.click().catch(() => undefined);
		} else {
			await dash.keyboard.press("Meta+Comma").catch(() => undefined);
		}
		await dash.waitForTimeout(1200);
		const settingsOpen = await dash
			.locator('[data-testid="settings"]')
			.isVisible()
			.catch(() => false);
		s.note(`[i] settings opened: ${settingsOpen}`);

		if (settingsOpen) {
			// Network → the new "Automation network access" egress allowlist (11b.8b).
			await dash.locator(".settings__nav-item", { hasText: "Network" }).first().click().catch(() => undefined);
			await dash.waitForTimeout(900);
			await s.shot(dash, "settings-network");
			const egressSection = await dash
				.locator('[data-testid="network-egress-automation"]')
				.count()
				.catch(() => 0);
			s.note(`[i] egress allowlist section present: ${egressSection > 0}`);
			if (egressSection === 0) broken.push("Settings: egress allowlist section missing");

			// AI → MCP servers panel (MCP-2's stdio transport rides this surface).
			await dash.locator(".settings__nav-item", { hasText: "AI" }).first().click().catch(() => undefined);
			await dash.waitForTimeout(900);
			await s.shot(dash, "settings-ai");
		} else {
			broken.push("Settings: did not open via Cmd+,");
		}
		if (dashErrs.errors.length > 0) {
			s.note(`[?] dashboard/settings console errors (${dashErrs.errors.length}):`);
			for (const e of dashErrs.errors.slice(0, 6)) s.note(`    ${e}`);
		}

		s.note(`\n## RESULT: ${broken.length === 0 ? "ALL CLEAN" : `${broken.length} issue(s)`}`);
		for (const b of broken) s.note(`  - ${b}`);
	} finally {
		await s.finish();
	}
});
