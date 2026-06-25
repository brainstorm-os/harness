/**
 * Session 317 — Stage 7.3b iframe widgets, real Electron. Verifies the iframe
 * migration end-to-end: place a Notes widget, confirm an <iframe> mounts in the
 * dashboard DOM, loads the Notes bundle in widget-mode, and renders content via
 * the postMessage bridge (no native overlay). Then drag it and confirm it lands.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

const NOTES = "io.brainstorm.notes";

test("dashboard iframe widgets (317)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("317-widgets-iframe");
	try {
		const page = s.dashboard;
		await page.waitForTimeout(2000);

		// Place a Notes widget at an 8px-grid footprint.
		await page.evaluate(async (notes) => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: { upsertWidget(id: string, r: Record<string, unknown>): Promise<void> };
					};
				}
			).brainstorm;
			await bs.dashboard.upsertWidget("widget_iframe_317", {
				appId: notes,
				kind: "recent-notes",
				x: 4,
				y: 30,
				w: 40,
				h: 26,
				paused: false,
			});
		}, NOTES);

		// 1) The widget bridge exists on the (rebuilt) preload.
		const hasBridge = await page.evaluate(
			() =>
				typeof (
					window as unknown as {
						brainstorm: { dashboard: { widgetBridge?: { listEntities?: unknown } } };
					}
				).brainstorm.dashboard.widgetBridge?.listEntities === "function",
		);
		s.note(`widgetBridge present: ${hasBridge}`);
		expect(hasBridge, "preload exposes dashboard.widgetBridge").toBe(true);

		// Diagnostics: what does resolve-entry return, and is the card present?
		const diag = await page.evaluate(async (notes) => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: {
							widgetBridge: { resolveEntry(a: string, w: string): Promise<string | null> };
							registeredWidgets(): Promise<unknown[]>;
						};
					};
				}
			).brainstorm;
			return {
				entry: await bs.dashboard.widgetBridge.resolveEntry(notes, "recent-notes"),
				registered: await bs.dashboard.registeredWidgets(),
				cards: document.querySelectorAll('[data-testid^="dashboard-widget-"]').length,
				frames: document.querySelectorAll(".dashboard-widgets__frame").length,
			};
		}, NOTES);
		s.note(
			`resolveEntry → ${diag.entry}\ncards: ${diag.cards} · frames: ${diag.frames}\nregistered: ${JSON.stringify(diag.registered)}`,
		);

		// 2) An iframe mounts in the card (DOM, not a native overlay).
		const frameEl = page.locator(".dashboard-widgets__frame");
		await expect(frameEl, "widget iframe is in the dashboard DOM").toHaveCount(1, {
			timeout: 15_000,
		});
		const frameSrc = await frameEl.getAttribute("src");
		s.note(`iframe src: ${frameSrc}`);

		// 3) The iframe loaded the Notes widget UI (proves the sandboxed bundle ran).
		const frame = page.frameLocator(".dashboard-widgets__frame");
		await expect(
			frame.locator(".notes-widget"),
			"Notes widget mounted inside the iframe",
		).toBeVisible({
			timeout: 20_000,
		});

		// 4) The bridge delivered data → rows, OR a clean empty state. Either proves
		//    vaultEntities.list() round-tripped (a broken bridge → neither appears).
		await page.waitForTimeout(2000);
		const rowCount = await frame.locator(".notes-widget__row").count();
		const emptyVisible = await frame
			.locator(".notes-widget__empty")
			.isVisible()
			.catch(() => false);
		const countText = await frame
			.locator(".notes-widget__count")
			.textContent()
			.catch(() => null);
		s.note(`rows: ${rowCount} · empty-state: ${emptyVisible} · count chip: ${countText ?? "—"}`);
		expect(rowCount > 0 || emptyVisible, "widget rendered rows or an empty state (bridge live)").toBe(
			true,
		);

		// 4b) Theme tokens reached the iframe (parent → widget-theme → injected),
		//     so the widget is actually styled (not the unstyled serif fallback).
		const wf = page.frames().find((f) => f.url().startsWith("bswidget://"));
		const themed = wf
			? await wf.evaluate(() => {
					const cs = getComputedStyle(document.documentElement);
					const row = document.querySelector(".notes-widget__row");
					return {
						textToken: cs.getPropertyValue("--color-text-primary").trim(),
						spaceToken: cs.getPropertyValue("--space-2").trim(),
						rowPad: row ? getComputedStyle(row).paddingLeft : "",
						font: getComputedStyle(document.body).fontFamily,
					};
				})
			: null;
		s.note(`theme in iframe: ${JSON.stringify(themed)}`);
		expect(themed?.textToken, "theme tokens injected into the widget iframe").toBeTruthy();

		await s.shot(page, "iframe-widget-loaded");

		// 5) Drag the widget by its header grip and confirm it lands (no crash).
		const card = page.locator('[data-testid="dashboard-widget-widget_iframe_317"]');
		const before = await card.boundingBox();
		const grip = card.locator(".dashboard-widgets__grip");
		const gb = await grip.boundingBox();
		if (gb) {
			await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
			await page.mouse.down();
			await page.mouse.move(gb.x + gb.width / 2 - 160, gb.y + gb.height / 2 + 60, { steps: 12 });
			await page.mouse.up();
			await page.waitForTimeout(800);
		}
		const after = await card.boundingBox();
		s.note(
			`drag: before x=${before?.x.toFixed(0)} → after x=${after?.x.toFixed(0)} (moved ${
				before && after ? (after.x - before.x).toFixed(0) : "?"
			}px)`,
		);
		// Still exactly one iframe, still showing the widget (didn't blank on drag).
		await expect(page.locator(".dashboard-widgets__frame")).toHaveCount(1);
		await expect(frame.locator(".notes-widget")).toBeVisible();
		await s.shot(page, "iframe-widget-after-drag");

		// Clean up for re-runs.
		await page.evaluate(() =>
			(
				window as unknown as { brainstorm: { dashboard: { removeWidget(id: string): Promise<void> } } }
			).brainstorm.dashboard.removeWidget("widget_iframe_317"),
		);
		await page.waitForTimeout(500);
	} finally {
		await s.finish();
	}
});
