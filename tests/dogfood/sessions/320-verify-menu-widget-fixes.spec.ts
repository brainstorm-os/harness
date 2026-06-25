/**
 * Session 320 — real-shell verification of this session's fixes:
 *
 *  1. Menu dead-click (shared fancy-menus): an open menu must dismiss on an
 *     outside press and leave the app interactive — the Tasks ⋯-menu →
 *     sidebar-click "stuck menu / dead routing" the founder hit.
 *  2. Taskbar divider: the Apps-button → window-strip divider now sits a
 *     space-2 gap off the button (captured for visual check).
 *  3. Dashboard widgets render (the postMessage-origin hardening must not have
 *     broken the bridge) and the renderer console stays clean.
 *  4. A collapsed widget stays header-height while dragging (best-effort).
 *
 * Pure verification — uses the app, never patches. Each check is judged from
 * observable DOM and recorded via `s.note()`; failures never abort the run.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("verify menu + widget fixes (320)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("320-verify-menu-widget-fixes");

	try {
		// ── 1. Menu outside-click dismissal + interactivity (Tasks) ──────────
		const page = await s.openApp(APP.Tasks);
		await page.waitForTimeout(2600);
		await s.shot(page, "00-tasks-launch");

		const menuVisible = () =>
			page
				.locator(".fm-menu")
				.first()
				.isVisible()
				.catch(() => false);
		const headerTitle = () =>
			page
				.locator(".app-header__title")
				.first()
				.innerText()
				.catch(() => "");

		// Open a menu: prefer a task-row ⋯, fall back to the header object ⋯.
		await s.note("--- 1. menu outside-click dismissal ---");
		let opened = false;
		const row = page.locator(".task-row").first();
		if ((await row.count()) > 0) {
			await row.hover();
			const more = row.locator(".task-row__more").first();
			if ((await more.count()) > 0) {
				await more.click().catch(() => undefined);
				await page.waitForTimeout(500);
				opened = await menuVisible();
			}
		}
		if (!opened) {
			const headerMore = page.locator(".app-header .bs-object-menu__more").first();
			if ((await headerMore.count()) > 0) {
				await headerMore.click().catch(() => undefined);
				await page.waitForTimeout(500);
				opened = await menuVisible();
			}
		}
		await s.shot(page, "01-menu-open");
		s.note(`[${opened ? "PASS" : "?"}] a menu opened — fm-menu visible=${opened}`);

		// THE FIX: click an element OUTSIDE the menu (a sidebar surface row). The
		// menu must close, and the app must stay interactive afterwards.
		await page
			.locator('.tasks-sidebar__row[data-surface="today"]')
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(500);
		const closedAfterOutside = !(await menuVisible());
		s.note(
			`[${closedAfterOutside ? "PASS" : "FAIL"}] menu dismissed on outside press — fm-menu gone=${closedAfterOutside}`,
		);
		await s.shot(page, "02-after-outside-click");

		// Routing still works after dismissing the menu: switch surface, header changes.
		await page
			.locator('.tasks-sidebar__row[data-surface="upcoming"]')
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(600);
		const title = (await headerTitle()).toLowerCase();
		const routed = title.includes("upcoming");
		const noStrayMenu = !(await menuVisible());
		s.note(
			`[${routed && noStrayMenu ? "PASS" : "FAIL"}] app interactive after menu — routed to "${title}", no stray overlay=${noStrayMenu}`,
		);
		expect(closedAfterOutside, "menu must close on outside press").toBe(true);
		expect(noStrayMenu, "no overlay may trap clicks after dismissal").toBe(true);

		// ── 2 + 3. Dashboard divider + widgets render + console ──────────────
		await s.note("--- 2/3. dashboard divider + widgets ---");
		const dash = s.dashboard;
		await dash.bringToFront().catch(() => undefined);
		await dash.waitForTimeout(800);
		await s.shot(dash, "03-dashboard");
		const footer = dash.locator(".dashboard__footer").first();
		await s.shot(dash, "04-taskbar-divider", footer);

		const dividerCount = await dash.locator(".dashboard__start-divider").count();
		s.note(
			`[${dividerCount === 1 ? "PASS" : "FAIL"}] taskbar divider element present — count=${dividerCount}`,
		);

		// Place a real widget so the origin-pinned bridge is actually exercised
		// (Mira's vault may have none). Track its id so we can remove it after.
		const placedId = `widget_verify_${Date.now().toString(36)}`;
		const placed = await dash.evaluate(async (id) => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: {
							registeredWidgets: () => Promise<Array<{ appId: string; widgetId: string }>>;
							upsertWidget: (id: string, r: Record<string, unknown>) => Promise<void>;
						};
					};
				}
			).brainstorm;
			const reg = await bs.dashboard.registeredWidgets();
			const w = reg[0];
			if (!w) return null;
			await bs.dashboard.upsertWidget(id, {
				appId: w.appId,
				kind: w.widgetId,
				x: 0,
				y: 0,
				w: 4,
				h: 3,
				paused: false,
			});
			return { appId: w.appId, kind: w.widgetId };
		}, placedId);
		s.note(
			`[?] placed a widget for the bridge check — ${placed ? `${placed.appId}/${placed.kind}` : "no registered widgets"}`,
		);
		await dash.waitForTimeout(2500);

		const widgetCards = await dash.locator(".dashboard-widgets__card").count();
		s.note(`[${widgetCards > 0 ? "PASS" : "FAIL"}] dashboard widget renders — cards=${widgetCards}`);

		// A widget iframe whose bridge survived the origin hardening renders app
		// content (not the empty placeholder).
		const liveFrames = await dash.locator(".dashboard-widgets__frame").count();
		const placeholders = await dash.locator(".dashboard-widgets__placeholder").count();
		s.note(
			`[?] widget frames=${liveFrames}, placeholders=${placeholders} (frames should load post origin-pinning)`,
		);

		// ── 4. Collapsed widget keeps header height while dragging ───────────
		await s.note("--- 4. collapsed-widget drag height ---");
		const firstCard = dash.locator(".dashboard-widgets__card").first();
		if ((await firstCard.count()) > 0) {
			const collapseBtn = firstCard
				.locator('[aria-label="Collapse widget"], [aria-label="Expand widget"]')
				.first();
			// Ensure collapsed.
			const label = await collapseBtn.getAttribute("aria-label").catch(() => "");
			if (label === "Collapse widget") {
				await collapseBtn.click().catch(() => undefined);
				await dash.waitForTimeout(400);
			}
			const collapsedBox = await firstCard.boundingBox().catch(() => null);
			// Drag the header a little and sample height mid-drag.
			const grip = firstCard.locator(".dashboard-widgets__grip").first();
			const gripBox = await grip.boundingBox().catch(() => null);
			let midDragHeight = collapsedBox?.height ?? 0;
			if (gripBox) {
				await dash.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
				await dash.mouse.down();
				await dash.mouse.move(gripBox.x + 120, gripBox.y + 60, { steps: 6 });
				await dash.waitForTimeout(150);
				const dragBox = await firstCard.boundingBox().catch(() => null);
				midDragHeight = dragBox?.height ?? midDragHeight;
				await dash.mouse.up();
				await dash.waitForTimeout(300);
			}
			// Collapsed card is header-height (~30px chrome); a regression expands it
			// to the full widget body. Allow slack for borders/padding.
			const stayedCollapsed = midDragHeight > 0 && midDragHeight < 80;
			s.note(
				`[${stayedCollapsed ? "PASS" : "FAIL"}] collapsed widget stays header-height mid-drag — height=${Math.round(midDragHeight)}px`,
			);
			await s.shot(dash, "05-collapsed-drag");
		} else {
			s.note("[?] collapsed-widget drag — no widget cards on the dashboard to test");
		}

		// ── Console cleanliness ──────────────────────────────────────────────
		await page.waitForTimeout(500);
		const consolePath = join(
			process.cwd(),
			"tests",
			"dogfood",
			".sessions",
			"320-verify-menu-widget-fixes",
			"console.log",
		);
		let log = "";
		try {
			log = readFileSync(consolePath, "utf8");
		} catch {
			// console.log not present — leave empty
		}
		const errorLines = log
			.split("\n")
			.filter(
				(l) =>
					/pageerror|error:|widget rpc failed|Unavailable/i.test(l) &&
					!/seedPrebuiltApps|DevTools|Autofill/i.test(l),
			);
		s.note(`--- console: ${errorLines.length} error-ish line(s) ---`);
		for (const l of errorLines.slice(0, 12)) s.note(`  ${l}`);

		// Remove the widget we placed so the persistent vault stays clean.
		await s.dashboard
			.evaluate(
				(id) =>
					(
						window as unknown as {
							brainstorm: { dashboard: { removeWidget: (id: string) => Promise<void> } };
						}
					).brainstorm.dashboard.removeWidget(id),
				placedId,
			)
			.catch(() => undefined);

		s.note("--- session 320 complete ---");
	} finally {
		await s.finish();
	}
});
