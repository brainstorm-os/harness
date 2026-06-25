/**
 * Session 321 — interaction-robustness sweep.
 *
 * The complement to the happy-path feature specs: instead of verifying one
 * intended flow per app, this systematically exercises the shared chrome of
 * every app and asserts the interaction INVARIANTS (tests/dogfood/lib/invariants):
 *
 *   - every menu trigger opens AND dismisses on Escape + outside-press, leaving
 *     no overlay still trapping clicks (the hanging-menu / dead-click class);
 *   - every header button produces an observable effect (the dead-button class);
 *   - no interaction wedges the app behind a lingering overlay or logs an error.
 *
 * A finding is recorded per affordance; the run HARD-FAILS only on the invariant
 * the founder cares about most — a stuck overlay that eats clicks — so a real
 * hang can never pass silently, while softer signals (a possibly-dead button)
 * are surfaced as `[?]` for triage without flaking the suite.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";
import {
	type ButtonProbe,
	type MenuProbe,
	collectConsoleErrors,
	probeButton,
	probeMenuTrigger,
} from "../lib/invariants";

// The apps whose shared header/object-menu chrome the sweep drives. Every
// first-party app shares `.app-header` + the fancy-menus runtime, so this list
// is cheap to extend; this set covers the menu-heavy surfaces.
const SWEEP_APPS: ReadonlyArray<{ id: AppId; name: string }> = [
	{ id: APP.Tasks, name: "Tasks" },
	{ id: APP.Notes, name: "Notes" },
	{ id: APP.Database, name: "Database" },
	{ id: APP.Files, name: "Files" },
	{ id: APP.Bookmarks, name: "Bookmarks" },
	{ id: APP.Calendar, name: "Calendar" },
	{ id: APP.Contacts, name: "Contacts" },
	{ id: APP.Graph, name: "Graph" },
];

test("interaction-robustness sweep (321)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("321-interaction-sweep");

	const stuckFindings: string[] = [];
	let menusProbed = 0;
	let buttonsProbed = 0;
	let deadButtons = 0;

	try {
		for (const appDef of SWEEP_APPS) {
			s.note(`\n## ${appDef.name}`);
			let page: Page | null = null;
			try {
				page = await s.openApp(appDef.id);
			} catch (error) {
				s.note(`[FAIL] ${appDef.name} — did not open: ${(error as Error).message}`);
				continue;
			}
			if (!page) continue;
			const consoleErrors = collectConsoleErrors(page);
			await page.waitForTimeout(2400);
			await s.shot(page, `${appDef.name.toLowerCase()}-00`);

			// ── Menu triggers: header object ⋯, any header popup trigger, and the
			//    first in-content row ⋯ (the surface where hanging menus live).
			const menuTriggers = [
				...(await page.locator(".app-header .bs-object-menu__more").all()),
				...(await page.locator('.app-header [aria-haspopup="menu"]').all()),
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
				const r: MenuProbe = await probeMenuTrigger(page, trigger, `${appDef.name}:${key}`);
				menusProbed += 1;
				if (r.disabled) {
					s.note(`[skip] menu "${key}" — trigger disabled (no object to act on)`);
					continue;
				}
				// An ENABLED trigger that opens nothing is a real dead-affordance signal.
				const verdict = r.ok ? "PASS" : r.stuck ? "FAIL" : "?";
				s.note(
					`[${verdict}] menu "${key}" — opened=${r.opened} escClose=${r.escapeClosed} outsideClose=${r.outsideClosed} interactive=${r.interactiveAfter}${r.stuck ? ` — ${r.stuck}` : ""}`,
				);
				if (r.stuck) {
					stuckFindings.push(r.stuck);
					await s.shot(page, `${appDef.name.toLowerCase()}-stuck-${idx}`);
				}
			}

			// ── Header buttons: each must DO something (dead-button detector). The
			//    ⋯ menu triggers above are skipped here to avoid double-probing.
			const headerButtons = await page.locator(".app-header button:not(.bs-object-menu__more)").all();
			let bIdx = 0;
			for (const button of headerButtons) {
				if (!(await button.isVisible().catch(() => false))) continue;
				if (!(await button.isEnabled().catch(() => false))) continue;
				const label =
					(await button.getAttribute("aria-label").catch(() => null)) ??
					(await button.getAttribute("data-bs-tooltip").catch(() => null)) ??
					`button-${bIdx}`;
				bIdx += 1;
				const r: ButtonProbe = await probeButton(page, button, `${appDef.name}:${label}`);
				buttonsProbed += 1;
				if (r.stuck) {
					stuckFindings.push(r.stuck);
					s.note(`[FAIL] button "${label}" — ${r.stuck}`);
					await s.shot(page, `${appDef.name.toLowerCase()}-btn-stuck-${bIdx}`);
				} else if (!r.effect) {
					deadButtons += 1;
					s.note(`[?] button "${label}" — click produced no observable effect (possible dead button)`);
				} else {
					s.note(`[PASS] button "${label}" — responded`);
				}
			}

			if (consoleErrors.errors.length > 0) {
				s.note(`[?] ${appDef.name} console errors during sweep (${consoleErrors.errors.length}):`);
				for (const e of consoleErrors.errors.slice(0, 8)) s.note(`    ${e}`);
			}
		}

		s.note(
			`\n## summary — ${menusProbed} menus, ${buttonsProbed} buttons probed; ${stuckFindings.length} stuck-overlay, ${deadButtons} possible-dead-button finding(s)`,
		);

		// The one HARD invariant: no interaction may leave an overlay trapping
		// clicks. A real hanging menu can never pass silently again.
		expect(stuckFindings, `hanging overlays found:\n${stuckFindings.join("\n")}`).toEqual([]);
	} finally {
		await s.finish();
	}
});
