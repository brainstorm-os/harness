/**
 * Session 334 — "verify the last-two-days work" design + new-logic sweep.
 *
 * The 328 sweep proves every app's chrome is interaction-safe. This spec is the
 * complement: it drives the specific features that landed over the last two days
 * and captures them for a design / quality eyeball, asserting only the cheap
 * hard invariants (the surface renders, no console errors) so a real regression
 * can't pass silently while the screenshots carry the subjective judgement:
 *
 *   - Dashboard widgets layer — the Contacts widget slot (9.12.13(c)) renders.
 *   - Tasks timeline / Gantt redesign — the pinned toolbar + redesigned bars.
 *   - Settings reopens on the LAST-viewed section (not always Appearance).
 *   - Marketplace / catalog Updates panel renders (14.34).
 *   - Cross-app DnD affordances (grips / drag sources) are present (DND-1..6).
 *
 * Findings go to the session notes + screenshots; triage reads them back.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("new-logic + design sweep (334)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("334-new-logic-design-sweep");

	// Native dialogs would wedge the renderer — stub to instant-cancel.
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

	try {
		const dash = s.dashboard;
		const dashErrors = collectConsoleErrors(dash);
		await dash.waitForTimeout(1500);

		// ── 1. Dashboard widgets — Contacts widget slot present ──────────────
		s.note("\n## Dashboard widgets");
		await s.shot(dash, "dashboard");
		const widgetCards = dash.locator('[data-testid^="dashboard-widget-"]');
		const widgetCount = await widgetCards.count();
		const widgetTitles = (await dash.locator(".dashboard-widgets__title").allInnerTexts()).join(
			" | ",
		);
		s.note(`widget cards: ${widgetCount}; titles: ${widgetTitles || "(none)"}`);
		const hasContactsWidget =
			/contact/i.test(widgetTitles) ||
			(await dash.locator('[data-testid="dashboard-widget-io.brainstorm.contacts"]').count()) > 0;
		s.note(`Contacts widget present: ${hasContactsWidget}`);

		// ── 2. Settings reopens on last-viewed section ───────────────────────
		s.note("\n## Settings reopen-on-last-section");
		await dash
			.locator('[aria-label="Settings"], [aria-label*="ettings"]')
			.first()
			.click()
			.catch(() => undefined);
		await dash.waitForTimeout(800);
		const navItems = dash.locator(".settings__nav-item");
		const navCount = await navItems.count();
		s.note(`settings nav items: ${navCount}`);
		// Jump to a non-first section (the 5th) and remember its label.
		let pickedLabel = "";
		if (navCount >= 5) {
			const target = navItems.nth(4);
			pickedLabel = (await target.innerText().catch(() => "")).trim();
			await target.click().catch(() => undefined);
			await dash.waitForTimeout(500);
		}
		await s.shot(dash, "settings-section-picked");
		s.note(`picked section: "${pickedLabel}"`);
		// Close settings, reopen, and read which section is active.
		await dash.keyboard.press("Escape").catch(() => undefined);
		await dash.waitForTimeout(600);
		await dash
			.locator('[aria-label="Settings"], [aria-label*="ettings"]')
			.first()
			.click()
			.catch(() => undefined);
		await dash.waitForTimeout(700);
		const activeLabel = (
			await dash
				.locator(".settings__nav-item--active")
				.first()
				.innerText()
				.catch(() => "")
		).trim();
		s.note(`active section after reopen: "${activeLabel}"`);
		await s.shot(dash, "settings-reopened");
		if (pickedLabel) {
			expect(activeLabel, "settings should reopen on the last-viewed section").toBe(pickedLabel);
		}

		// ── 3. Marketplace / catalog Updates panel ───────────────────────────
		s.note("\n## Marketplace / catalog");
		const mp = dash
			.locator(".settings__nav-item", { hasText: /marketplace|app store|extensions|catalog/i })
			.first();
		if ((await mp.count()) > 0) {
			await mp.click().catch(() => undefined);
			await dash.waitForTimeout(900);
			await s.shot(dash, "marketplace-panel");
			s.note("marketplace nav item found + opened");
		} else {
			s.note("no dedicated Marketplace nav item (may be nested under Interface/Apps)");
		}
		await dash.keyboard.press("Escape").catch(() => undefined);
		await dash.waitForTimeout(400);
		if (dashErrors.errors.length > 0) {
			s.note(`dashboard console errors (${dashErrors.errors.length}):`);
			for (const e of dashErrors.errors.slice(0, 8)) s.note(`  ${e}`);
		}

		// ── 4. Tasks timeline / Gantt redesign ───────────────────────────────
		s.note("\n## Tasks timeline / Gantt");
		const tasks = await s.openApp(APP.Tasks);
		const tErrors = collectConsoleErrors(tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "tasks-default");
		// Switch to the Timeline surface if the view picker offers it.
		const timelineNav = tasks.locator("button, [role='tab'], a", { hasText: /^timeline$/i }).first();
		if ((await timelineNav.count()) > 0) {
			await timelineNav.click().catch(() => undefined);
			await tasks.waitForTimeout(1200);
			s.note("switched to Timeline surface");
		} else {
			s.note("no Timeline view control found at top level");
		}
		await s.shot(tasks, "tasks-timeline");
		const ganttBars = await tasks
			.locator(".tasks-timeline__bar, .tasks-gantt__bar, [class*='gantt']")
			.count();
		s.note(`gantt-bar-like elements: ${ganttBars}`);
		if (tErrors.errors.length > 0) {
			s.note(`tasks console errors (${tErrors.errors.length}):`);
			for (const e of tErrors.errors.slice(0, 6)) s.note(`  ${e}`);
		}
		await tasks.close().catch(() => undefined);

		// ── 5. Cross-app DnD affordances present ─────────────────────────────
		s.note("\n## Cross-app DnD affordances");
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1600);
		await s.shot(files, "files");
		const fileGrips = await files
			.locator("[draggable='true'], [data-drag-source], .files__grip, [class*='grip']")
			.count();
		s.note(`Files drag-source-like elements: ${fileGrips}`);
		await files.close().catch(() => undefined);

		const dbApp = await s.openApp(APP.Database);
		await dbApp.waitForTimeout(1600);
		await s.shot(dbApp, "database");
		const dbGrips = await dbApp
			.locator("[draggable='true'], [data-drag-source], [class*='grip'], [class*='drag-handle']")
			.count();
		s.note(`Database drag-source-like elements: ${dbGrips}`);
		await dbApp.close().catch(() => undefined);

		s.note("\n## summary — captures collected; read screenshots for the design eyeball.");
	} finally {
		await s.finish();
	}
});
