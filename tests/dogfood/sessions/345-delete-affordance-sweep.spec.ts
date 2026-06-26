/**
 * Session 345 — fleet-wide delete-affordance + menu-health sweep.
 *
 * 343/344 proved delete works for Notes / Tasks / Database. This widens the net:
 * across ALL 20 apps, can the founder REACH a delete for the primary object, and
 * does opening the object/context menu stay CLEAN (zero console errors)?
 *
 * Two probe routes per app (apps differ): the header object ⋯ menu
 * (`.bs-object-menu__more`) and a right-click on the first addressable entity
 * (`[data-entity-id]`); a Delete/Remove row in the shared menu
 * (`.fm-menu [role="option"]`) counts as "reachable". NON-DESTRUCTIVE — it only
 * opens menus and Escapes; nothing is deleted.
 *
 * HARD findings: console errors during the interaction. The delete-affordance
 * presence is INFORMATIONAL (a tool/view app legitimately has no per-object
 * delete — Graph, Preview, Theme Editor, etc.), printed as a map for judgement,
 * not auto-failed. record-don't-throw.
 */

import { type Page, test } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";
import { appInteractive, collectConsoleErrors } from "../lib/invariants";

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

async function menuHasDelete(page: Page): Promise<boolean> {
	const del = page
		.locator('.fm-menu [role="option"], .bs-object-menu__item')
		.filter({ hasText: /Delete|Remove|Move to Bin/i })
		.first();
	const found = (await del.count().catch(() => 0)) > 0;
	await page.keyboard.press("Escape").catch(() => undefined);
	await page.waitForTimeout(200);
	return found;
}

test("fleet-wide delete-affordance reachability + menu health (345)", async () => {
	test.setTimeout(600_000);
	const s: FounderSession = await startSession("345-delete-affordance-sweep");
	const errorFindings: string[] = [];
	const deleteMap: Array<{ app: string; reachable: boolean }> = [];

	try {
		for (const app of ALL_APPS) {
			s.note(`\n## ${app.name}`);
			let page: Page;
			try {
				page = await s.openApp(app.id);
			} catch (error) {
				errorFindings.push(`${app.name}: did not open — ${(error as Error).message}`);
				continue;
			}
			page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
			page.setDefaultTimeout(3000);
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(1500);

			let reachable = false;
			// Route 1 — header object ⋯ menu.
			const more = page.locator(".bs-object-menu__more").first();
			if ((await more.count().catch(() => 0)) > 0) {
				await more.click({ timeout: 2500 }).catch(() => undefined);
				await page.waitForTimeout(400);
				reachable = await menuHasDelete(page);
			}
			// Route 2 — right-click the first addressable entity.
			if (!reachable) {
				const entity = page.locator("[data-entity-id]").first();
				if ((await entity.count().catch(() => 0)) > 0) {
					await entity.click({ button: "right", timeout: 2500 }).catch(() => undefined);
					await page.waitForTimeout(400);
					reachable = await menuHasDelete(page);
				}
			}
			deleteMap.push({ app: app.name, reachable });
			s.note(`  delete affordance reachable: ${reachable ? "yes" : "no"}`);

			if (errs.errors.length > 0)
				errorFindings.push(`${app.name}: ${errs.errors.length} console error(s) — ${errs.errors[0]}`);
			if (!(await appInteractive(page)))
				errorFindings.push(`${app.name}: left non-interactive (overlay trap)`);
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(200).catch(() => undefined);
		}

		// ── RESULT ──────────────────────────────────────────────────────────────
		s.note("\n## RESULT — delete-affordance sweep");
		const withDelete = deleteMap.filter((d) => d.reachable).map((d) => d.app);
		const withoutDelete = deleteMap.filter((d) => !d.reachable).map((d) => d.app);
		s.note(`  delete reachable (${withDelete.length}): ${withDelete.join(", ")}`);
		s.note(`  no delete found (${withoutDelete.length}): ${withoutDelete.join(", ")}`);
		if (errorFindings.length === 0) s.note("  ✅ ZERO console errors across all 20 apps during the menu sweep.");
		else {
			s.note(`  ${errorFindings.length} HARD finding(s):`);
			for (const f of errorFindings) s.note(`   • ${f}`);
		}
	} finally {
		await s.finish();
	}
});
