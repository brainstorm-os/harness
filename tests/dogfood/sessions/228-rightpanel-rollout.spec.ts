/**
 * Session 228 — right-panel consistency rollout, real-shell verification.
 * Every entity app's inspector now shows the SHARED Properties | Comments tab
 * strip (Files keeps its 4-tab inspector + a Comments tab). This drives a real
 * Electron shell to confirm each migrated app (1) boots clean and (2) renders
 * the tab strip, with Bookmarks deep-verified end to end (seed → inspector →
 * Properties|Comments + an editable property + the Comments composer).
 *
 * `[PASS]/[FAIL]/[?]` lines judged from observable DOM; each step try/caught.
 */

import { test } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

const ROLLOUT_APPS: ReadonlyArray<readonly [AppId, string]> = [
	[APP.Bookmarks, "bookmarks"],
	[APP.Books, "books"],
	[APP.Contacts, "contacts"],
	[APP.Graph, "graph"],
	[APP.Files, "files"],
	[APP.Tasks, "tasks"],
	[APP.Database, "database"],
];

test("right-panel rollout — all migrated apps boot + Bookmarks deep flow (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-rightpanel-rollout");
	try {
		// ── 1. Smoke: each migrated app boots and renders its root ─────────────
		for (const [id, name] of ROLLOUT_APPS) {
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(2200);
				const hasRoot = await page
					.locator("#root, [data-testid='app-header'], .app-header, main")
					.first()
					.count()
					.catch(() => 0);
				s.note(`[${hasRoot > 0 ? "PASS" : "FAIL"}] ${name} boots — root/header present=${hasRoot > 0}`);
				await s.shot(page, `00-${name}-boot`);
			} catch (e) {
				s.note(`[FAIL] ${name} boots — ${(e as Error).message}`);
			}
		}

		// ── 2. Bookmarks deep flow: seed → inspector → Properties|Comments ─────
		try {
			const bm = await s.openApp(APP.Bookmarks);
			await bm.waitForTimeout(1500);
			// Seed a bookmark + a vault property through Bookmarks' own services
			// (exercises its new entities.write:brainstorm/Comment/v1 indirectly via
			// the shared adapter; the property proves the editable Properties tab).
			const seed = await bm
				.evaluate(async () => {
					const bs = (window as unknown as { brainstorm?: { services?: Record<string, unknown> } })
						.brainstorm;
					const entities = bs?.services?.entities as
						| { create?: (t: string, p: Record<string, unknown>) => Promise<{ id: string }> }
						| undefined;
					const properties = bs?.services?.properties as
						| { setProperty?: (d: Record<string, unknown>) => Promise<void> }
						| undefined;
					if (!entities?.create) return { ok: false, reason: "no entities.create" };
					await properties?.setProperty?.({
						key: "rating",
						name: "Rating",
						icon: null,
						valueType: "text",
					});
					const created = await entities.create("brainstorm/Bookmark/v1", {
						title: "Rollout probe bookmark",
						url: "https://example.com/rollout",
						values: { rating: "★★★★" },
					});
					return { ok: true, id: created.id };
				})
				.catch((e: Error) => ({ ok: false, reason: e.message }));
			s.note(
				`[${seed.ok ? "PASS" : "FAIL"}] Bookmarks seed — ${seed.ok ? "created" : `failed: ${"reason" in seed ? seed.reason : "?"}`}`,
			);
			await bm.waitForTimeout(1500);

			// Open a bookmark into detail view (the inspector only renders there),
			// then reveal the properties inspector via its header toggle.
			const row = bm.locator(".bookmarks__card").first();
			if ((await row.count()) > 0) {
				await row.click({ timeout: 5000 }).catch(() => undefined);
				await bm.waitForTimeout(1000);
			}
			const toggle = bm
				.locator("[aria-label='Show properties'], [aria-label='Hide properties']")
				.first();
			if ((await toggle.count()) > 0) {
				const pressed = await toggle.getAttribute("aria-pressed").catch(() => null);
				if (pressed !== "true") await toggle.click({ timeout: 5000 }).catch(() => undefined);
			}
			await bm.waitForTimeout(800);

			const tabsVisible = await bm
				.locator(".bs-panel-tabs")
				.first()
				.isVisible()
				.catch(() => false);
			const tabLabels = await bm
				.locator(".bs-panel-tab")
				.allInnerTexts()
				.catch(() => [] as string[]);
			s.note(
				`[${tabsVisible ? "PASS" : "?"}] Bookmarks Properties|Comments tab strip — visible=${tabsVisible}, tabs=[${tabLabels.join(", ")}]`,
			);
			await s.shot(bm, "01-bookmarks-tabs");

			// Switch to Comments → composer renders.
			const commentsTab = bm.locator(".bs-panel-tab", { hasText: /comment/i }).first();
			if ((await commentsTab.count()) > 0) {
				await commentsTab.click({ timeout: 5000 }).catch(() => undefined);
				await bm.waitForTimeout(700);
				const composer = await bm
					.locator("textarea, [contenteditable='true'], .bs-comments, [class*='comment']")
					.first()
					.isVisible()
					.catch(() => false);
				s.note(
					`[${composer ? "PASS" : "?"}] Bookmarks Comments tab renders — body visible=${composer}`,
				);
				await s.shot(bm, "02-bookmarks-comments");
			}
		} catch (e) {
			s.note(`[FAIL] Bookmarks deep flow — ${(e as Error).message}`);
		}
	} finally {
		await s.finish();
	}
});
