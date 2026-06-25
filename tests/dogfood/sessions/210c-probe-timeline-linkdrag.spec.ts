/**
 * Probe 210c — the last two loose ends:
 *   1. switch "Grid 2" to a Timeline via View settings → View type, then
 *      drag a bar (9.12.10);
 *   2. graph drag-to-link node→node using the __graphProbe coordinates
 *      (9.13.11).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type ProbeNode = { id: string; x: number; y: number };
type GraphProbeWindow = {
	__graphProbe?: {
		nodes: () => ProbeNode[];
		worldToClient: (x: number, y: number) => { x: number; y: number };
	};
};

test("probe: timeline view-type switch + graph node link-drag (210c)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("210c-probe-timeline-linkdrag");
	try {
		// ---- 1. Timeline via View settings → View type ----------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/content calendar/i")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1500);
		const grid2 = db.locator('[role="tab"]:has-text("Grid 2"), button:has-text("Grid 2")').first();
		if (await grid2.isVisible().catch(() => false)) {
			await grid2.click().catch(() => undefined);
			await db.waitForTimeout(1000);
		}
		await db
			.locator("#toolbar-settings")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);
		const viewType = db
			.locator('button:has-text("View type"), [role="menuitem"]:has-text("View type")')
			.first();
		if (await viewType.isVisible().catch(() => false)) {
			await viewType.click().catch(() => undefined);
			await db.waitForTimeout(800);
			await s.shot(db, "01-view-type-page");
			const timeline = db
				.locator('button:has-text("Timeline"), [role="menuitem"]:has-text("Timeline")')
				.first();
			if (await timeline.isVisible().catch(() => false)) {
				await timeline.click().catch(() => undefined);
				await db.waitForTimeout(1500);
				await db.keyboard.press("Escape").catch(() => undefined);
				await db.waitForTimeout(1000);
				await s.shot(db, "02-timeline-view");
				const bar = db
					.locator('[class*="timeline"] [class*="bar"], [class*="timeline"] [class*="item"]')
					.first();
				const box = await bar.boundingBox().catch(() => null);
				s.note(`timeline bar box: ${JSON.stringify(box)}`);
				if (box && box.width > 4) {
					await db.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
					await db.mouse.down();
					await db.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 12 });
					await db.mouse.up();
					await db.waitForTimeout(1500);
					const after = await bar.boundingBox().catch(() => null);
					s.note(`bar after drag: ${JSON.stringify(after)}`);
					await s.shot(db, "03-timeline-after-drag");
				}
			} else {
				s.note("View type page has no Timeline option");
				await s.shot(db, "02-no-timeline-option");
				await db.keyboard.press("Escape").catch(() => undefined);
			}
		} else {
			s.note("no View type row in settings");
			await db.keyboard.press("Escape").catch(() => undefined);
		}

		// ---- 2. Graph node→node Alt-drag ------------------------------------
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(5000);
		// Close the filter panel if it launched open.
		const filterToggle = graph.locator('.app-header [aria-pressed="true"]').first();
		await filterToggle.click().catch(() => undefined);
		await graph.waitForTimeout(800);
		const pair = await graph
			.evaluate(() => {
				const probe = (window as unknown as GraphProbeWindow).__graphProbe;
				if (!probe) return null;
				const nodes = probe.nodes();
				if (nodes.length < 2) return null;
				const a = nodes[0];
				let best: ProbeNode | null = null;
				let bestD = Number.POSITIVE_INFINITY;
				for (const n of nodes.slice(1)) {
					const d = (n.x - a.x) ** 2 + (n.y - a.y) ** 2;
					if (d > 400 && d < bestD) {
						bestD = d;
						best = n;
					}
				}
				if (!best) return null;
				const ca = probe.worldToClient(a.x, a.y);
				const cb = probe.worldToClient(best.x, best.y);
				return { a: ca, b: cb, aId: a.id, bId: best.id };
			})
			.catch(() => null);
		s.note(`link-drag pair: ${JSON.stringify(pair)}`);
		if (pair) {
			await graph.keyboard.down("Alt");
			await graph.mouse.move(pair.a.x, pair.a.y);
			await graph.mouse.down();
			await graph.mouse.move((pair.a.x + pair.b.x) / 2, (pair.a.y + pair.b.y) / 2, { steps: 8 });
			await graph.mouse.move(pair.b.x, pair.b.y, { steps: 8 });
			await s.shot(graph, "04-rubber-band");
			await graph.mouse.up();
			await graph.keyboard.up("Alt");
			await graph.waitForTimeout(1200);
			await s.shot(graph, "05-release-menu");
			const rows = await graph
				.locator('[role="menuitem"], .fm-menu button')
				.allTextContents()
				.catch(() => [] as string[]);
			s.note(`release menu rows: ${JSON.stringify(rows.slice(0, 12))}`);
			// Pick the first property if the menu opened (a real link write).
			const firstRow = graph.locator('[role="menuitem"], .fm-menu button').first();
			if (await firstRow.isVisible().catch(() => false)) {
				await firstRow.click().catch(() => undefined);
				await graph.waitForTimeout(1500);
				await s.shot(graph, "06-after-link-commit");
			}
		} else {
			s.note("__graphProbe unavailable or <2 nodes");
		}

		s.chat(SPEAKER.Priya, "210c probe done.");
	} finally {
		await s.finish();
	}
});
