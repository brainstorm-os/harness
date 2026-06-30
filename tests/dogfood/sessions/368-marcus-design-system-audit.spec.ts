/**
 * Session 368 — Marcus's cross-app design-system audit.
 *
 * The founder reported a pile of visual problems: wrong/missing paddings,
 * elements that don't follow the design system, bad layouts. Marcus does what
 * he does — opens every surface, crops the chrome/panels/states, and MEASURES
 * the contracts instead of eyeballing them:
 *
 *   - app-header 44px baseline (the shared `.app-header` height contract)
 *   - control-face parity: the first text input vs the first button in a
 *     surface should share a control height (the recurring "input next to a
 *     button is a different height" complaint; `.bs-input` is the new primitive)
 *   - property-inspector padding + cover-band behaviour
 *   - empty / list / detail layout density
 *
 * The screenshots ARE the review artifact. Verdicts (→ friction-log F-NNN) are
 * decided in triage AFTER staring at the crops — the spec only captures + notes
 * neutral measurements, never a verdict (per continuous-loop.md).
 */

import { type Page, test } from "@playwright/test";
import { APP, type AppId, SPEAKER, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

type Surface = { id: AppId; name: string };

// A broad sweep across the surfaces most likely to carry chrome/inspector/
// layout debt — operator apps + the knowledge/data apps + the newer ones.
const SURFACES: Surface[] = [
	{ id: APP.Notes, name: "notes" },
	{ id: APP.Database, name: "database" },
	{ id: APP.Tasks, name: "tasks" },
	{ id: APP.Calendar, name: "calendar" },
	{ id: APP.Files, name: "files" },
	{ id: APP.Bookmarks, name: "bookmarks" },
	{ id: APP.Contacts, name: "contacts" },
	{ id: APP.Books, name: "books" },
	{ id: APP.Journal, name: "journal" },
	{ id: APP.Whiteboard, name: "whiteboard" },
	{ id: APP.Automations, name: "automations" },
	{ id: APP.Mailbox, name: "mailbox" },
];

test("Marcus audits design-system adherence across apps (368)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("368-marcus-design-system-audit");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Mira's been collecting visual snags — paddings, off-system controls, layouts that don't hold. I'm doing a measured sweep: header baselines, input-vs-button heights, inspector padding. Numbers, then crops. Verdicts after I look.",
		);

		for (const surface of SURFACES) {
			let page: Page;
			try {
				page = await s.openApp(surface.id);
			} catch (e) {
				s.note(`[${surface.name}] open FAILED: ${(e as Error).message}`);
				continue;
			}
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(2500);

			// 1) Full surface.
			await s.shot(page, `${surface.name}-01-full`);

			// 2) Header crop + 44px baseline measurement.
			const header = page.locator(".app-header").first();
			if (await header.isVisible().catch(() => false)) {
				await s.shot(page, `${surface.name}-02-header`, header);
				const hb = await header.boundingBox().catch(() => null);
				const off = hb ? Math.abs(hb.height - 44) : NaN;
				s.note(
					`[${surface.name}] header height=${hb?.height ?? "?"}px (contract 44; off-by ${Number.isNaN(off) ? "?" : off.toFixed(1)})`,
				);
			} else {
				s.note(`[${surface.name}] no .app-header found`);
			}

			// 3) Control-face parity: first input vs first button height.
			const heights = await page
				.evaluate(() => {
					const h = (sel: string) => {
						const el = document.querySelector(sel) as HTMLElement | null;
						return el ? Math.round(el.getBoundingClientRect().height) : null;
					};
					return {
						input: h(".bs-input") ?? h("input:not([type=checkbox]):not([type=radio])"),
						select: h(".bs-select"),
						button: h(".bs-btn") ?? h("button"),
					};
				})
				.catch(() => ({ input: null, select: null, button: null }));
			s.note(
				`[${surface.name}] control heights — input=${heights.input ?? "—"} select=${heights.select ?? "—"} button=${heights.button ?? "—"} (input & button should match)`,
			);

			// 4) Try to reveal the property inspector / a detail panel, then crop it.
			const firstRow = page
				.locator(
					'[role="row"], [class*="row"], [class*="card"], [role="treeitem"], [class*="list-item"], li[class*="item"]',
				)
				.first();
			await firstRow.click().catch(() => undefined);
			await page.waitForTimeout(700);
			const inspectorToggle = page
				.locator(
					'[aria-label*="propert" i], [aria-label*="inspector" i], [aria-label*="details" i], [aria-label*="info" i]',
				)
				.first();
			await inspectorToggle.click().catch(() => undefined);
			await page.waitForTimeout(900);
			const inspector = page
				.locator(".bs-props, [class*='props-panel'], [class*='properties'], [class*='inspector']")
				.first();
			if (await inspector.isVisible().catch(() => false)) {
				await s.shot(page, `${surface.name}-03-inspector`, inspector);
				const ib = await inspector.boundingBox().catch(() => null);
				// Cover band height inside the inspector (the "cover jumps per object" trap).
				const cover = page.locator(".bs-props .entity-cover, [class*='cover']").first();
				const cb = await cover.boundingBox().catch(() => null);
				s.note(
					`[${surface.name}] inspector w=${ib?.width ?? "?"}px; cover host h=${cb?.height ?? "—"}`,
				);
			} else {
				s.note(`[${surface.name}] inspector not reachable via generic row+toggle`);
			}
			// Whole detail/inspector view too, for padding/layout context.
			await s.shot(page, `${surface.name}-04-detail`);

			if (errs.errors.length > 0) {
				for (const e of errs.errors.slice(0, 3)) s.note(`    [${surface.name}] console: ${e}`);
			}

			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(250).catch(() => undefined);
		}

		// Shell surfaces too: dashboard + Settings carry the panel-header 44px +
		// 1px border contract the apps mirror.
		await s.shot(s.dashboard, "shell-01-dashboard");
		const settings = s.dashboard
			.locator('[aria-label*="settings" i], [title*="Settings" i], button:has-text("Settings")')
			.first();
		await settings.click().catch(() => undefined);
		await s.dashboard.waitForTimeout(900);
		await s.shot(s.dashboard, "shell-02-settings");

		s.chat(
			SPEAKER.Marcus,
			"Sweep captured — headers, control-face heights, inspectors, empty/detail layouts across a dozen apps plus the shell. I'll stare at the crops and file the specific offenders; no vibes in the log.",
		);
	} finally {
		await s.finish();
	}
});
