/**
 * Session 375b — post-hoc probes for the widget findings of session 375.
 * Runs AFTER the seeder (startSession awaits it), so it answers:
 *   1. Is the Notes registry data healthy post-seed? (icon + widget name) —
 *      if yes, the "NO / recent-notes / placeholder" breakage in 375 is the
 *      boot race (one-shot fetches during reseed) and not bad data.
 *   2. What does the widget bridge actually return for Contacts — does the
 *      vault have Person/v1 entities at all, or does Mira's CRM live
 *      elsewhere (Database rows) while the widget reads only Person/v1?
 *   3. The stored record of the teleported Task Stats card (cells, not px).
 * Also tidies Mira's dashboard back to a sane layout (persistent vault).
 */

import { test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("widget probes (375b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("375b-widgets-probe");
	try {
		const page = s.dashboard;
		await page.waitForTimeout(2000);

		const probe = await page.evaluate(async () => {
			const bs = (
				window as unknown as {
					brainstorm: {
						apps: { listInstalled(): Promise<Array<{ id: string; hasIcon: boolean }>> };
						dashboard: {
							registeredWidgets(): Promise<Array<{ appId: string; widgetId: string; name: string }>>;
							widgetBridge: { listEntities(appId: string): Promise<unknown> };
						};
					};
				}
			).brainstorm;
			const installed = await bs.apps.listInstalled();
			const registered = await bs.dashboard.registeredWidgets();
			const contactsRaw = (await bs.dashboard.widgetBridge.listEntities(
				"io.brainstorm.contacts",
			)) as { entities?: Array<{ type: string }> } | Array<{ type: string }>;
			const list = Array.isArray(contactsRaw) ? contactsRaw : (contactsRaw.entities ?? []);
			const byType: Record<string, number> = {};
			for (const e of list) byType[e.type] = (byType[e.type] ?? 0) + 1;
			return {
				notesInstalled: installed.find((a) => a.id === "io.brainstorm.notes"),
				notesWidgetRow: registered.find((w) => w.appId === "io.brainstorm.notes"),
				contactsEntityTypes: byType,
				contactsTotal: list.length,
			};
		});
		s.note(`post-seed notes install: ${JSON.stringify(probe.notesInstalled)}`);
		s.note(`post-seed notes widget row: ${JSON.stringify(probe.notesWidgetRow)}`);
		s.note(`contacts-app visible entities: total=${probe.contactsTotal}`);
		s.note(`by type: ${JSON.stringify(probe.contactsEntityTypes, null, 0).slice(0, 2000)}`);

		// Person/v1 present anywhere? Also check what the DATABASE app can see, to
		// tell "no people in vault" apart from "people live in another app's silo".
		const dbView = await page.evaluate(async () => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: { widgetBridge: { listEntities(appId: string): Promise<unknown> } };
					};
				}
			).brainstorm;
			const raw = (await bs.dashboard.widgetBridge.listEntities("io.brainstorm.database")) as
				| { entities?: Array<{ type: string }> }
				| Array<{ type: string }>;
			const list = Array.isArray(raw) ? raw : (raw.entities ?? []);
			const byType: Record<string, number> = {};
			for (const e of list) byType[e.type] = (byType[e.type] ?? 0) + 1;
			return { total: list.length, byType };
		});
		s.note(`database-app visible entities: total=${dbView.total}`);
		s.note(`by type: ${JSON.stringify(dbView.byType, null, 0).slice(0, 2000)}`);

		// 3. Stored record of every placed widget (decode teleports in CELLS).
		const rects = await page.$$eval('[data-testid^="dashboard-widget-"]', (els) =>
			els.map((el) => {
				const st = (el as HTMLElement).style;
				return {
					id: (el.getAttribute("data-testid") ?? "").replace("dashboard-widget-", ""),
					left: st.left,
					top: st.top,
					width: st.width,
					height: st.height,
				};
			}),
		);
		s.note(`widget card inline geometry: ${JSON.stringify(rects)}`);
		await s.shot(page, "probe-dashboard");

		// 4. Tidy Mira's dashboard: pull the teleported card back on-screen.
		await page.evaluate(async () => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: {
							upsertWidget(id: string, r: Record<string, unknown>): Promise<void>;
						};
					};
				}
			).brainstorm;
			const els = Array.from(document.querySelectorAll('[data-testid^="dashboard-widget-"]'));
			for (const el of els) {
				const id = (el.getAttribute("data-testid") ?? "").replace("dashboard-widget-", "");
				const st = (el as HTMLElement).style;
				const top = Number.parseFloat(st.top || "0");
				if (top > 700) {
					// parked off-screen by the migration bug — bring it home
					await bs.dashboard.upsertWidget(id, {
						appId: "io.brainstorm.tasks",
						kind: "task-stats",
						x: 4,
						y: 50,
						w: 20,
						h: 20,
						paused: false,
						collapsed: false,
					});
				}
			}
		});
		await page.waitForTimeout(800);
		await s.shot(page, "tidied-dashboard");
	} finally {
		await s.finish();
	}
});
