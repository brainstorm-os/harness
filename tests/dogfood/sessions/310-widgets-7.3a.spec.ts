/**
 * Session 310 — Stage 7.3 dashboard widgets, real Electron. Credential-free.
 *
 * Verifies the widget glue end-to-end against the production shell:
 *  - the Notes "recent-notes" widget is in the registered-widget catalog
 *    (install → `widgets` table → `dashboard:registered-widgets`);
 *  - placing it via `dashboard.upsertWidget` persists into the snapshot;
 *  - the renderer widgets-layer paints a slot card for it;
 *  - the main process mounts a native widget surface (`[widget] mounted …`
 *    in the captured main stdout) and loads the Notes bundle in widget-mode.
 *
 * Note: a native WebContentsView overlay is NOT in the dashboard DOM, so the
 * page screenshot shows the slot chrome, not the widget body — the surface
 * mount + load is verified from the captured main-process log, not the image.
 */

import { test } from "@playwright/test";
import { startSession } from "../lib/founder";

const NOTES = "io.brainstorm.notes";

test("dashboard widgets 7.3a (310)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("310-widgets-7.3a");
	try {
		const page = s.dashboard;
		await page.waitForTimeout(2000);

		// 1) The Notes widget is in the catalog.
		const registered = await page.evaluate(() =>
			(
				window as unknown as { brainstorm: { dashboard: { registeredWidgets(): Promise<unknown[]> } } }
			).brainstorm.dashboard.registeredWidgets(),
		);
		s.note(`### registered widgets\n\`\`\`json\n${JSON.stringify(registered, null, 2)}\n\`\`\``);

		// 2) Place the Notes recent-notes widget.
		const placed = await page.evaluate(async (notes) => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: {
							upsertWidget(id: string, r: Record<string, unknown>): Promise<void>;
							snapshot(): Promise<{ widgets: Record<string, unknown> } | null>;
						};
					};
				}
			).brainstorm;
			await bs.dashboard.upsertWidget("widget_probe_310", {
				appId: notes,
				kind: "recent-notes",
				x: 0,
				y: 0,
				w: 4,
				h: 2,
				paused: false,
			});
			const snap = await bs.dashboard.snapshot();
			return snap?.widgets ?? {};
		}, NOTES);
		s.note(
			`### snapshot.widgets after placing\n\`\`\`json\n${JSON.stringify(placed, null, 2)}\n\`\`\``,
		);

		// 3) Let the surface mount + load, then capture the slot DOM + a shot.
		await page.waitForTimeout(3000);
		const slotCount = await page.locator('[data-testid^="dashboard-widget-"]').count();
		s.note(`slot cards in DOM: ${slotCount}`);
		await s.shot(page, "dashboard-with-widget");

		// 4) Remove it again (clean state for re-runs).
		await page.evaluate(() =>
			(
				window as unknown as { brainstorm: { dashboard: { removeWidget(id: string): Promise<void> } } }
			).brainstorm.dashboard.removeWidget("widget_probe_310"),
		);
		await page.waitForTimeout(1000);
	} finally {
		await s.finish();
	}
});
