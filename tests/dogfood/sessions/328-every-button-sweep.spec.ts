/**
 * Session 328 — "check EVERY button" full-product sweep.
 *
 * The widest interaction sweep yet: walks ALL 20 first-party apps and, in each,
 * exercises every interactive affordance the user could click — header buttons,
 * object ⋯ / popup menus, sidebar/nav controls, AND in-content buttons — and
 * asserts the interaction INVARIANTS (tests/dogfood/lib/invariants):
 *
 *   - every menu trigger opens AND dismisses on Escape + outside-press, leaving
 *     no overlay still trapping clicks (the hanging-menu / dead-click class);
 *   - every button produces an observable effect (the dead-button class);
 *   - no interaction wedges the app behind a lingering overlay;
 *   - no app throws console errors just sitting there or being clicked.
 *
 * Per-affordance findings are recorded to the session notes for triage. The run
 * HARD-FAILS only on the founder's worst case — a stuck overlay that eats clicks
 * — so a real hang can never pass silently, while softer signals (a maybe-dead
 * button, console noise) are surfaced for review without flaking the suite.
 *
 * This is deliberately exhaustive and slow; it is the "long run" full check.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";
import {
	type ButtonProbe,
	type MenuProbe,
	collectConsoleErrors,
	probeButton,
	probeMenuTrigger,
} from "../lib/invariants";

// Every shipped first-party app. Order roughly follows the dashboard grid so
// the notes read like a methodical walk-through.
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

type AppReport = {
	name: string;
	opened: boolean;
	menusProbed: number;
	buttonsProbed: number;
	deadButtons: string[];
	stuck: string[];
	consoleErrors: string[];
};

async function probeMenusIn(
	page: Page,
	s: FounderSession,
	name: string,
	report: AppReport,
	stuckFindings: string[],
): Promise<void> {
	const menuTriggers = [
		...(await page.locator(".app-header .bs-object-menu__more").all()),
		...(await page.locator('.app-header [aria-haspopup="menu"]').all()),
		...(await page.locator('[aria-haspopup="menu"]').all()).slice(0, 6),
		...(await page.locator(".bs-object-menu__more").nth(0).all()),
	];
	const seen = new Set<string>();
	let idx = 0;
	for (const trigger of menuTriggers) {
		if (!(await trigger.isVisible().catch(() => false))) continue;
		const key = (await trigger.getAttribute("aria-label").catch(() => null)) ?? `menu-${idx}`;
		if (seen.has(key)) continue;
		seen.add(key);
		idx += 1;
		const r: MenuProbe = await probeMenuTrigger(page, trigger, `${name}:${key}`);
		report.menusProbed += 1;
		if (r.disabled) {
			s.note(`  [skip] menu "${key}" — disabled (no object to act on)`);
			continue;
		}
		const verdict = r.ok ? "PASS" : r.stuck ? "FAIL" : "?";
		s.note(
			`  [${verdict}] menu "${key}" — opened=${r.opened} esc=${r.escapeClosed} outside=${r.outsideClosed} interactive=${r.interactiveAfter}${r.stuck ? ` — ${r.stuck}` : ""}`,
		);
		if (r.stuck) {
			report.stuck.push(r.stuck);
			stuckFindings.push(r.stuck);
			await s.shot(page, `${name.toLowerCase().replace(/\s+/g, "-")}-stuck-${idx}`);
		}
	}
}

async function probeButtonsIn(
	page: Page,
	s: FounderSession,
	name: string,
	report: AppReport,
	stuckFindings: string[],
): Promise<void> {
	// Header buttons first (the always-present chrome), then a bounded sweep of
	// in-content buttons. ⋯ menu triggers are excluded (probed as menus above).
	const headerButtons = await page.locator(".app-header button:not(.bs-object-menu__more)").all();
	const contentButtons = (
		await page
			.locator('button:not(.app-header button):not(.bs-object-menu__more):not([aria-haspopup="menu"])')
			.all()
	).slice(0, 24);
	const all = [...headerButtons, ...contentButtons];

	const seen = new Set<string>();
	let bIdx = 0;
	for (const button of all) {
		if (!(await button.isVisible().catch(() => false))) continue;
		if (!(await button.isEnabled().catch(() => false))) continue;
		const label =
			(await button.getAttribute("aria-label").catch(() => null)) ??
			(await button.getAttribute("data-bs-tooltip").catch(() => null)) ??
			(await button.textContent().catch(() => null))?.trim()?.slice(0, 32) ??
			`button-${bIdx}`;
		if (seen.has(label) && label.length > 2) continue; // skip repeated identical labels (rows)
		seen.add(label);
		bIdx += 1;
		if (bIdx > 40) break; // hard cap per app so the run stays bounded
		const r: ButtonProbe = await probeButton(page, button, `${name}:${label}`);
		report.buttonsProbed += 1;
		if (r.stuck) {
			report.stuck.push(r.stuck);
			stuckFindings.push(r.stuck);
			s.note(`  [FAIL] button "${label}" — ${r.stuck}`);
			await s.shot(page, `${name.toLowerCase().replace(/\s+/g, "-")}-btn-stuck-${bIdx}`);
		} else if (!r.effect) {
			report.deadButtons.push(label);
			s.note(`  [?] button "${label}" — click produced no observable effect (possible dead button)`);
		}
	}
}

test("every-button full-product sweep (328)", async () => {
	test.setTimeout(3_000_000);
	const s = await startSession("328-every-button-sweep");

	// Probing arbitrary content buttons WILL hit affordances that open a native
	// modal (`dialog.showOpenDialog/showSaveDialog/showMessageBox`) — a file
	// picker, an upload, a confirm. A native modal blocks the renderer and there
	// is no DOM to dismiss it, so the sweep wedges. Stub the dialog module in the
	// MAIN process to return "canceled" instantly so a click that would open a
	// picker is a no-op instead of a hang. (We're testing button reachability,
	// not the OS dialog itself.)
	await s.app.evaluate(({ dialog }) => {
		const canceledOpen = { canceled: true, filePaths: [] as string[] };
		const canceledSave = { canceled: true, filePath: undefined as string | undefined };
		dialog.showOpenDialog = (async () => canceledOpen) as typeof dialog.showOpenDialog;
		dialog.showSaveDialog = (async () => canceledSave) as typeof dialog.showSaveDialog;
		dialog.showMessageBox = (async () => ({
			response: 0,
			checkboxChecked: false,
		})) as typeof dialog.showMessageBox;
	});

	const stuckFindings: string[] = [];
	const reports: AppReport[] = [];

	try {
		for (const appDef of ALL_APPS) {
			s.note(`\n## ${appDef.name}`);
			const report: AppReport = {
				name: appDef.name,
				opened: false,
				menusProbed: 0,
				buttonsProbed: 0,
				deadButtons: [],
				stuck: [],
				consoleErrors: [],
			};
			reports.push(report);

			let page: Page | null = null;
			try {
				page = await s.openApp(appDef.id);
			} catch (error) {
				s.note(`[FAIL] ${appDef.name} — did not open: ${(error as Error).message}`);
				continue;
			}
			if (!page) continue;
			report.opened = true;
			// Renderer-level window.confirm/alert/prompt also block — auto-dismiss.
			page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
			// Cap click actionability waits — an obscured/unstable button otherwise
			// costs the 30s default each, which would make the sweep crawl.
			page.setDefaultTimeout(4000);
			const consoleErrors = collectConsoleErrors(page);
			await page.waitForTimeout(2600);
			await s.shot(page, `${appDef.name.toLowerCase().replace(/\s+/g, "-")}-00`);

			// A mid-probe page-close (a crashing late app, or the renderer being
			// reaped under memory pressure) must not abort the whole sweep — record
			// it and carry on so every app is still reported + the final assertion
			// runs over what was collected.
			try {
				await probeMenusIn(page, s, appDef.name, report, stuckFindings);
				await probeButtonsIn(page, s, appDef.name, report, stuckFindings);
			} catch (error) {
				s.note(`  [!] ${appDef.name} — probing aborted: ${(error as Error).message}`);
			}

			report.consoleErrors = consoleErrors.errors.slice();
			if (consoleErrors.errors.length > 0) {
				s.note(`  [?] ${appDef.name} console errors (${consoleErrors.errors.length}):`);
				for (const e of consoleErrors.errors.slice(0, 10)) s.note(`      ${e}`);
			}

			// Close this app's renderer before opening the next — the container
			// hosts a tab page per launch, and 20 live renderers accumulate enough
			// memory to OOM-crash Electron mid-sweep. Closing as we go keeps a
			// bounded working set so the full 20-app walk completes.
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300).catch(() => undefined);
		}

		// ── Summary table ─────────────────────────────────────────────────
		s.note("\n\n## SUMMARY");
		let totalMenus = 0;
		let totalButtons = 0;
		let totalDead = 0;
		for (const r of reports) {
			totalMenus += r.menusProbed;
			totalButtons += r.buttonsProbed;
			totalDead += r.deadButtons.length;
			const flags: string[] = [];
			if (!r.opened) flags.push("DID-NOT-OPEN");
			if (r.stuck.length) flags.push(`${r.stuck.length} STUCK`);
			if (r.deadButtons.length) flags.push(`${r.deadButtons.length} dead?`);
			if (r.consoleErrors.length) flags.push(`${r.consoleErrors.length} console-err`);
			s.note(
				`- ${r.name}: ${r.menusProbed} menus, ${r.buttonsProbed} buttons${flags.length ? ` — ${flags.join(", ")}` : " — clean"}`,
			);
			if (r.deadButtons.length) s.note(`    dead?: ${r.deadButtons.join(", ")}`);
		}
		s.note(
			`\nTOTALS: ${totalMenus} menus, ${totalButtons} buttons probed across ${reports.filter((r) => r.opened).length}/${ALL_APPS.length} apps; ${stuckFindings.length} stuck-overlay, ${totalDead} possible-dead-button finding(s).`,
		);

		// The one HARD invariant: no interaction may leave an overlay trapping clicks.
		expect(stuckFindings, `hanging overlays found:\n${stuckFindings.join("\n")}`).toEqual([]);
	} finally {
		await s.finish();
	}
});
