/**
 * Session 329 — SCREENSHOT-DRIVEN visual audit: the twenty first-party apps.
 *
 * The 327 template applied app-by-app (same rationale, recorded there): the
 * drift ratchet measured colour/px literals and certified apps the owner then
 * found visibly broken, so the audit is now dense CAPTURE + a reader judging
 * the images. This spec does not judge. The defect classes it hunts are the
 * ratchet-blind ones: UA-default chrome (worst on dark), lookalikes of shared
 * faces, absolutely-positioned children escaping an unpositioned ancestor,
 * hover states painting somewhere unexpected, inconsistent menus.
 *
 * One THEME per invocation (`AUDIT_THEME=dark|light`, default dark): the mode
 * flip uses the real `dashboard.setAppearanceMode` so app windows re-theme
 * too, and the saved mode is restored in `finally`. Slot pairs are never
 * touched — the audit sees the owner's actual light/dark themes. A fresh boot
 * per run also sidesteps the zombie-window relaunch trap.
 *
 * `AUDIT_APPS=Notes,Tasks,…` (APP keys) chunks the sweep under external time
 * caps. Console/page errors are collected per window like session 012 — a
 * free signal while we're in there.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

/** Apps that need longer to settle before the first capture. */
const SETTLE: Partial<Record<AppId, number>> = {
	[APP.Graph]: 6000,
	[APP.Whiteboard]: 3500,
	[APP.Database]: 2600,
	[APP.Calendar]: 2600,
	[APP.CodeEditor]: 3000,
	[APP.Mailbox]: 2600,
	[APP.Browser]: 2600,
};

/** Per-app extra captures on top of the generic pass — the surfaces the
 *  generic pass cannot reach but a standing finding names (e.g. the
 *  Bookmarks Read-pill × hover-⋯ overlap lives on the Tags surface). */
const EXTRAS: Partial<Record<AppId, (page: Page, shot: (n: string) => Promise<void>) => Promise<void>>> = {
	[APP.Bookmarks]: async (page, shot) => {
		const tags = page.getByText(/^Tags$/i).first();
		if (await tags.count()) {
			await tags.click({ timeout: 5000 }).catch(() => {});
			await page.waitForTimeout(900);
			await shot("06-tags-surface");
			const card = page.locator(".bookmarks__card").first();
			if (await card.count()) {
				await card.hover();
				await page.waitForTimeout(500);
				await shot("07-tags-card-hover");
			}
		}
	},
	// Tasks' first [data-entity-id] is a collapsed-sidebar row parked
	// off-canvas at x<0 — CSS-visible, never actionable (probe 932). Drive
	// the main surface's own row class instead.
	[APP.Tasks]: async (page, shot) => {
		const row = page.locator(".task-row").first();
		if (await row.count()) {
			await row.hover();
			await shot("06-row-hover");
			await row.click({ button: "right" });
			await shot("07-row-context-menu");
			await page.keyboard.press("Escape");
			await row.click();
			await page.waitForTimeout(900);
			await shot("08-row-open");
			await page.keyboard.press("Escape");
		}
	},
	[APP.Files]: async (page, shot) => {
		const sort = page.locator('[data-testid="toolbar-sort"]').first();
		if (await sort.count()) {
			await sort.click({ timeout: 5000 });
			await page.waitForTimeout(600);
			await shot("06-sort-menu");
			await page.keyboard.press("Escape");
		}
	},
};

test("visual audit — every app, one theme per run (329)", async () => {
	test.setTimeout(900_000);
	const theme = process.env.AUDIT_THEME === "light" ? "light" : "dark";
	const only = process.env.AUDIT_APPS?.split(",").map((s) => s.trim());
	const s = await startSession(`329-audit-apps-${theme}`);

	const errors = new Map<string, Set<string>>();
	const record = (url: string, line: string) => {
		const key = url.split("?")[0] ?? url;
		(errors.get(key) ?? errors.set(key, new Set()).get(key))?.add(line);
	};
	s.app.on("window", (page) => {
		page.on("pageerror", (err) => record(page.url(), `pageerror: ${err.message.split("\n")[0]}`));
		page.on("console", (msg) => {
			if (msg.type() === "error") record(page.url(), `console.error: ${msg.text().split("\n")[0]}`);
		});
	});

	const dash = s.dashboard;
	let savedMode: string | null = null;

	try {
		await dash.waitForTimeout(2500);
		await dash.keyboard.press("Escape");

		// Save the owner's mode, then flip. Slot pairs stay untouched.
		savedMode = await dash.evaluate(async () => {
			const bs = (window as unknown as {
				brainstorm: {
					dashboard: {
						snapshot: () => Promise<{ appearance?: { mode?: string } } | null>;
					};
				};
			}).brainstorm;
			const snap = await bs.dashboard.snapshot();
			return snap?.appearance?.mode ?? null;
		});
		await dash.evaluate(async (mode) => {
			const bs = (window as unknown as {
				brainstorm: { dashboard: { setAppearanceMode: (m: string) => Promise<void> } };
			}).brainstorm;
			await bs.dashboard.setAppearanceMode(mode);
		}, theme);
		await dash.waitForTimeout(1200);
		s.note(`theme pass: ${theme} (saved mode: ${savedMode})`);

		const entries = Object.entries(APP).filter(([name]) => !only || only.includes(name));
		for (const [name, id] of entries) {
			const label = name.toLowerCase();
			let page: Page;
			try {
				page = await s.openApp(id);
			} catch (e) {
				s.note(`✗ ${name} FAILED to open: ${(e as Error).message.split("\n")[0]}`);
				continue;
			}
			await page.waitForTimeout(SETTLE[id] ?? 1800);

			const shot = async (n: string, fn?: () => Promise<void>): Promise<void> => {
				try {
					if (fn) await fn();
					await page.waitForTimeout(450);
					await s.shot(page, `${theme}-${label}-${n}`);
				} catch (error) {
					s.note(`capture FAILED ${theme}-${label}-${n}: ${(error as Error).message.split("\n")[0]}`);
				}
			};

			await shot("01-main");
			await shot("02-hover-first-item", async () => {
				const item = page.locator("[data-entity-id]:visible").first();
				if (await item.count()) await item.hover({ timeout: 5000 });
			});
			await shot("03-context-menu", async () => {
				const item = page.locator("[data-entity-id]:visible").first();
				if (await item.count()) await item.click({ button: "right", timeout: 5000 });
			});
			await page.keyboard.press("Escape");
			await shot("04-header-menu", async () => {
				const more = page.locator(".app-header .bs-object-menu__more").last();
				if (await more.count()) await more.click({ timeout: 5000 });
			});
			await page.keyboard.press("Escape");
			await shot("05-first-item-open", async () => {
				const item = page.locator("[data-entity-id]:visible").first();
				if (await item.count()) {
					await item.click({ timeout: 5000 });
					await page.waitForTimeout(900);
				}
			});
			const extra = EXTRAS[id];
			if (extra) await extra(page, (n) => shot(n));
			await page.keyboard.press("Escape");
			s.note(`✓ captured ${name}`);
		}

		s.note("\n=== console.error / pageerror by window ===");
		if (errors.size === 0) s.note("(none)");
		for (const [url, lines] of errors) {
			const m = url.match(/io\.brainstorm\.[a-z-]+|\/renderer\/|\/chrome\//);
			s.note(`\n[${m?.[0] ?? url}]`);
			for (const line of [...lines].slice(0, 20)) s.note(`  ${line}`);
		}
		s.note("captured — read the images, do not trust this line");
	} finally {
		if (savedMode) {
			await dash
				.evaluate(async (mode) => {
					const bs = (window as unknown as {
						brainstorm: { dashboard: { setAppearanceMode: (m: string) => Promise<void> } };
					}).brainstorm;
					await bs.dashboard.setAppearanceMode(mode);
				}, savedMode)
				.catch(() => {});
		}
		await s.finish();
	}
});
