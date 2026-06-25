/**
 * Session 242 — shell-chrome design + consistency + reactivity sweep.
 *
 * The 228/239 sweeps cover the sandboxed apps; this one covers the SHELL's own
 * surfaces — the dashboard chrome (header / footer / icon rail), the full
 * Settings panel (every section, captured open, with its main-header baseline
 * measured against the 44px panel-header rule), and a live REACTIVITY probe:
 * create a note and confirm the sidebar list updates and the typed title
 * propagates without any reload (the `useVaultEntities` path).
 *
 * Every step is wrapped so one broken affordance never aborts the rest. Signal
 * = the screenshots + notes.md + the captured renderer console (errors there
 * are the real defects), distilled into the friction log.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** Measure a panel header's height + bottom border so drift off the shared
 *  44px / 1px baseline is visible in notes.md. */
async function measureHeader(page: Page, selector: string): Promise<string> {
	return page
		.evaluate((sel) => {
			const el = document.querySelector(sel) as HTMLElement | null;
			if (!el) return `(no ${sel})`;
			const cs = getComputedStyle(el);
			return JSON.stringify({
				height: Math.round(el.getBoundingClientRect().height),
				borderBottom: cs.borderBottomWidth,
			});
		}, selector)
		.catch((e) => `(measure failed: ${(e as Error).message})`);
}

/** Enumerate the accessible labels of every button in a region — a quick read
 *  on whether chrome controls are labelled (a11y) and consistent. */
async function controlLabels(page: Page, regionSelector: string): Promise<string> {
	return page
		.evaluate((sel) => {
			const root = document.querySelector(sel);
			if (!root) return `(no ${sel})`;
			const btns = Array.from(root.querySelectorAll("button, [role='button']"));
			return JSON.stringify(
				btns.map(
					(b) =>
						b.getAttribute("aria-label") ??
						b.getAttribute("title") ??
						(b.textContent ?? "").trim().slice(0, 24),
				),
			);
		}, regionSelector)
		.catch((e) => `(labels failed: ${(e as Error).message})`);
}

test("shell chrome + settings + reactivity sweep", async () => {
	test.setTimeout(420_000);
	const s = await startSession("242-shell-elements-sweep");
	const dash = s.dashboard;

	try {
		// ---- Dashboard chrome --------------------------------------------
		await dash.waitForTimeout(2000);
		await s.shot(dash, "01-dashboard-idle");
		s.note("## Dashboard chrome");
		s.note(`header: ${await measureHeader(dash, ".dashboard__header")}`);
		s.note(`footer: ${await measureHeader(dash, ".dashboard__footer")}`);
		s.note(`header controls: ${await controlLabels(dash, ".dashboard__header")}`);

		// ---- Settings panel — every section ------------------------------
		s.note("\n## Settings sections");
		const settingsBtn = dash.locator('button[aria-label="Settings"]').first();
		const opened = await settingsBtn
			.click()
			.then(() => true)
			.catch(() => false);
		if (!opened) {
			s.note("[FAIL] could not click the Settings button");
		} else {
			await dash.waitForSelector('[data-testid="settings"]', { timeout: 8000 }).catch(() => null);
			await dash.waitForTimeout(600);
			s.note(`sidebar header: ${await measureHeader(dash, ".settings__sidebar-header")}`);
			s.note(`main header: ${await measureHeader(dash, ".settings__main-header")}`);

			const navItems = dash.locator(".settings__nav-item");
			const count = await navItems.count().catch(() => 0);
			s.note(`nav items: ${count}`);
			for (let i = 0; i < count; i++) {
				const item = navItems.nth(i);
				const label = (await item.textContent().catch(() => ""))?.trim() ?? `section-${i}`;
				const slug = label
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/(^-|-$)/g, "");
				try {
					await item.click();
					await dash.waitForTimeout(450);
					const mainH = await measureHeader(dash, ".settings__main-header");
					s.note(`- ${label}: main-header ${mainH}`);
					await s.shot(dash, `settings-${String(i).padStart(2, "0")}-${slug || i}`);
				} catch (err) {
					s.note(`- ${label}: [FAIL] ${(err as Error).message}`);
				}
			}

			// Backup & Migration — the panel just re-styled. Capture the cards +
			// entry-button sizing explicitly.
			const bmNav = dash
				.locator(".settings__nav-item")
				.filter({ hasText: /backup|migration/i })
				.first();
			if (await bmNav.isVisible().catch(() => false)) {
				await bmNav.click();
				await dash.waitForTimeout(500);
				await s.shot(dash, "backup-migration-cards");
				const cardInfo = await dash
					.evaluate(() => {
						const groups = Array.from(document.querySelectorAll(".backup-migration__group"));
						const btns = Array.from(
							document.querySelectorAll('[data-testid="backup-migration-panel"] .button'),
						);
						return JSON.stringify({
							cards: groups.length,
							cardBg: groups[0] ? getComputedStyle(groups[0] as HTMLElement).backgroundColor : null,
							entryButtonHeights: btns
								.slice(0, 4)
								.map((b) => Math.round((b as HTMLElement).getBoundingClientRect().height)),
						});
					})
					.catch((e) => `(failed: ${(e as Error).message})`);
				s.note(`backup-migration: ${cardInfo}`);
			}

			// Close settings (Escape) so it doesn't overlay the reactivity probe.
			await dash.keyboard.press("Escape").catch(() => undefined);
			await dash.waitForTimeout(400);
		}

		// ---- Reactivity probe --------------------------------------------
		// Create a note and confirm the live sidebar list reflects it WITHOUT a
		// reload, and the typed title propagates into the list row live.
		s.note("\n## Reactivity (Notes live list)");
		let notes: Page | null = null;
		try {
			notes = await s.openApp(APP.Notes);
			await notes.waitForTimeout(1800);
			const before = await notes
				.locator(".notes__sidebar-row")
				.count()
				.catch(() => 0);
			s.note(`sidebar rows before: ${before}`);

			const newNote = notes.locator('[aria-label="New note"]').first();
			await newNote.click();
			await notes.waitForTimeout(1200);

			const TITLE = `Reactivity probe ${Date.now() % 100000}`;
			await notes.keyboard.type(TITLE, { delay: 18 });
			await notes.waitForTimeout(1000);
			await s.shot(notes, "reactivity-after-type");

			// The sidebar list is virtualized (absolute-positioned rows), so a raw
			// `.notes__sidebar-row` count is the rendered window, not the total —
			// it's noted for context but is NOT the reactivity signal. The real
			// contract: the title typed into the editor propagates into a live
			// sidebar row with no reload (the `useVaultEntities` path).
			const after = await notes
				.locator(".notes__sidebar-row")
				.count()
				.catch(() => 0);
			const liveRow = notes.locator(".notes__sidebar-title").filter({ hasText: TITLE.slice(0, 16) });
			const rowAppeared = await liveRow
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`sidebar rows rendered: before ${before} → after ${after} (virtualized window)`);
			s.note(`typed title appeared live in sidebar: ${rowAppeared}`);

			expect(rowAppeared, "typed title should appear in the live sidebar row").toBe(true);
		} catch (err) {
			s.note(`[reactivity] ${(err as Error).message}`);
			if (notes) await s.shot(notes, "reactivity-fail");
			throw err;
		}
	} finally {
		await s.finish();
	}
});
