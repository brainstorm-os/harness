/**
 * Session 228 — Deep Graph walkthrough.
 *
 * A founder-session that DEEPLY exercises the Graph app's interactive surface:
 * the header tools (Path-between, Animate-timeline, Filters, Settings, Export,
 * the history "Now" pill), the zoom controls, the legend, and — the priority —
 * direct canvas interaction: clicking a node (open/traverse), hovering a node
 * (preview tooltip), and hovering an edge (link-reason tooltip).
 *
 * Graph is canvas-based. There is no DOM node to click, so the spec drives the
 * canvas through the controller's `__graphProbe` diagnostic surface
 * (`apps/graph/src/graph-canvas-controller.ts`): `nodes()` returns live
 * world-space positions, `worldToClient(x, y)` maps a node to screen pixels,
 * and `setPathMode`/`pathPick`/`pathNodeIds` exercise the path-finder without
 * pixel-hunting. Where the probe can't help (hover dwell, edge tooltip) the
 * spec synthesises pointer events at the mapped client coordinates.
 *
 * Every action records a `[PASS] / [FAIL] / [?] <action> — <observed>` line
 * judged from observable state (panel opened, node count changed, zoom level
 * moved, animation running, tooltip un-hidden). Each step is wrapped so a
 * single failure never aborts the walkthrough. Screenshots capture states and
 * failures. DOES NOT assert a "correct" graph — only that each affordance does
 * something observable.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type ProbeNode = { id: string; x: number; y: number };
type ClientPoint = { x: number; y: number };

const SETTLE_MS = 6000;

/** Read the live node list off the controller's diagnostic probe. */
async function probeNodes(page: Page): Promise<ProbeNode[]> {
	return page
		.evaluate(() => {
			const probe = (window as unknown as { __graphProbe?: { nodes: () => ProbeNode[] } })
				.__graphProbe;
			return probe ? probe.nodes() : [];
		})
		.catch(() => [] as ProbeNode[]);
}

/** Map a node's world position to client (screen) pixels via the probe. */
async function nodeClientPoint(page: Page, node: ProbeNode): Promise<ClientPoint | null> {
	return page
		.evaluate(
			({ x, y }) => {
				const probe = (
					window as unknown as {
						__graphProbe?: { worldToClient: (x: number, y: number) => ClientPoint };
					}
				).__graphProbe;
				return probe ? probe.worldToClient(x, y) : null;
			},
			{ x: node.x, y: node.y },
		)
		.catch(() => null);
}

/** Live camera scale (k) off the controller snapshot, for zoom assertions. */
async function cameraScale(page: Page): Promise<number | null> {
	return page
		.evaluate(() => {
			const probe = (window as unknown as { __graphProbe?: unknown }).__graphProbe;
			// The probe exposes worldToClient which folds in scale; derive k by
			// mapping two world points one unit apart on x.
			if (!probe) return null;
			const wc = (probe as { worldToClient: (x: number, y: number) => ClientPoint }).worldToClient;
			const a = wc(0, 0);
			const b = wc(100, 0);
			return Math.abs(b.x - a.x) / 100;
		})
		.catch(() => null);
}

test("deep graph walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-graph");
	const graph = await s.openApp(APP.Graph);

	/** Record a judged outcome line; never throws. */
	const judge = (verdict: "PASS" | "FAIL" | "?", action: string, observed: string): void => {
		s.note(`[${verdict}] ${action} — ${observed}`);
	};
	/** Run a probe step, swallowing any throw into a [FAIL] line. */
	const step = async (action: string, fn: () => Promise<void>): Promise<void> => {
		try {
			await fn();
		} catch (err) {
			judge("FAIL", action, `threw: ${(err as Error).message}`);
		}
	};

	try {
		// Let the canvas boot, hydrate from the vault, and settle the layout.
		await graph.waitForTimeout(SETTLE_MS);
		await s.shot(graph, "01-settled");

		// Baseline: how many nodes does the probe see? Everything downstream
		// depends on there being something on the canvas.
		const initialNodes = await probeNodes(graph);
		judge(
			initialNodes.length > 0 ? "PASS" : "?",
			"canvas hydrate",
			`__graphProbe.nodes() = ${initialNodes.length}`,
		);

		/* ── Header inventory: which tools exist? ────────────────────────────── */
		await step("header tool inventory", async () => {
			const labels = ["Path between two nodes", "Animate timeline", "Filters", "Settings", "Export"];
			const present: Record<string, boolean> = {};
			for (const label of labels) {
				present[label] = await graph
					.locator(`[aria-label="${label}"]`)
					.first()
					.isVisible()
					.catch(() => false);
			}
			const missing = labels.filter((l) => !present[l]);
			judge(
				missing.length === 0 ? "PASS" : "FAIL",
				"header tools present",
				`${JSON.stringify(present)}${missing.length ? ` — missing ${missing.join(", ")}` : ""}`,
			);
		});

		// F-234: header object ⋯ menu. Record whether one exists at all.
		await step("header object ⋯ menu (F-234)", async () => {
			const more = graph.locator('.bs-object-menu__more, [aria-label="Graph actions"]');
			const count = await more.count().catch(() => 0);
			judge(
				count > 0 ? "PASS" : "FAIL",
				"header object ⋯ menu",
				count > 0
					? `found ${count} trailing ⋯ trigger(s)`
					: "NO object ⋯ menu in the header (F-234 confirmed — the trailing overflow is absent)",
			);
		});

		/* ── Filters panel: toggle a category, assert the visible set moves ──── */
		await step("open Filters panel", async () => {
			await graph.locator('[aria-label="Filters"]').first().click();
			await graph.waitForTimeout(900);
			const panel = graph.locator('.graph-sidebar__view--filters, [data-mode="filters"]').first();
			const visible = await panel.isVisible().catch(() => false);
			judge(visible ? "PASS" : "FAIL", "open Filters", `filters panel visible=${visible}`);
			await s.shot(graph, "02-filters-open");
		});

		await step("toggle a Show-type filter", async () => {
			const before = (await probeNodes(graph)).length;
			const beforeMatch = await graph
				.locator("#match-summary")
				.innerText()
				.catch(() => "");
			const toggles = graph.locator(".show-toggle__box");
			const toggleCount = await toggles.count().catch(() => 0);
			if (toggleCount === 0) {
				judge("?", "toggle Show filter", "no .show-toggle__box checkboxes rendered (empty vault?)");
				return;
			}
			// Flip the first type off (or on), then read the visible set again.
			await toggles
				.first()
				.click({ force: true })
				.catch(() => undefined);
			await graph.waitForTimeout(1200);
			const after = (await probeNodes(graph)).length;
			const afterMatch = await graph
				.locator("#match-summary")
				.innerText()
				.catch(() => "");
			const changed = after !== before || afterMatch !== beforeMatch;
			judge(
				changed ? "PASS" : "?",
				"toggle Show filter category",
				`nodes ${before}→${after}; match-summary changed=${afterMatch !== beforeMatch}`,
			);
			await s.shot(graph, "03-filter-toggled");
			// Restore.
			await toggles
				.first()
				.click({ force: true })
				.catch(() => undefined);
			await graph.waitForTimeout(800);
		});

		/* ── Settings panel: change a toggle, assert effect ──────────────────── */
		await step("open Settings panel", async () => {
			await graph.locator('[aria-label="Settings"]').first().click();
			await graph.waitForTimeout(900);
			const panel = graph.locator('.graph-sidebar__view--settings, [data-mode="settings"]').first();
			const visible = await panel.isVisible().catch(() => false);
			judge(visible ? "PASS" : "FAIL", "open Settings", `settings panel visible=${visible}`);
			await s.shot(graph, "04-settings-open");
		});

		await step("change a Settings toggle", async () => {
			// "Show unmatched" reshades the scene; flipping it should move the
			// visible-node count when a pattern is filtering anything out.
			const beforeNodes = (await probeNodes(graph)).length;
			const toggle = graph.locator(".settings-toggle input[type=checkbox]").first();
			const present = (await toggle.count().catch(() => 0)) > 0;
			if (!present) {
				judge("FAIL", "change Settings toggle", "no settings checkboxes found");
				return;
			}
			const wasChecked = await toggle.isChecked().catch(() => null);
			await toggle.click({ force: true }).catch(() => undefined);
			await graph.waitForTimeout(1000);
			const nowChecked = await toggle.isChecked().catch(() => null);
			const afterNodes = (await probeNodes(graph)).length;
			judge(
				wasChecked !== nowChecked ? "PASS" : "FAIL",
				"change Settings toggle",
				`checkbox ${wasChecked}→${nowChecked}; nodes ${beforeNodes}→${afterNodes}`,
			);
			await s.shot(graph, "05-setting-changed");
			// Restore.
			await toggle.click({ force: true }).catch(() => undefined);
			await graph.waitForTimeout(600);
		});

		// Tweak a force slider and confirm the value output updates.
		await step("drag a force slider", async () => {
			const slider = graph.locator(".settings-slider input[type=range]").first();
			if ((await slider.count().catch(() => 0)) === 0) {
				judge("?", "force slider", "no force sliders found");
				return;
			}
			const before = await slider.inputValue().catch(() => "");
			await slider.focus().catch(() => undefined);
			for (let i = 0; i < 6; i++) await graph.keyboard.press("ArrowRight");
			await graph.waitForTimeout(600);
			const after = await slider.inputValue().catch(() => "");
			judge(after !== before ? "PASS" : "?", "force slider", `value ${before}→${after}`);
		});

		/* ── Path-between two nodes ──────────────────────────────────────────── */
		await step("Path between two nodes", async () => {
			const nodes = await probeNodes(graph);
			if (nodes.length < 2) {
				judge("?", "Path between", `need ≥2 nodes, probe has ${nodes.length}`);
				return;
			}
			// Engage path mode via the header button, then pick two endpoints
			// through the probe (deterministic — no pixel hunting).
			await graph.locator('[aria-label="Path between two nodes"]').first().click();
			await graph.waitForTimeout(500);
			const pathModeOn = await graph
				.evaluate(() => {
					const p = (window as unknown as { __graphProbe?: { pathNodeIds: () => string[] } })
						.__graphProbe;
					return !!p;
				})
				.catch(() => false);
			// Pick endpoints far apart in the array to bias toward a real path.
			const a = nodes[0];
			const b = nodes[nodes.length - 1];
			await graph.evaluate(
				({ ida, idb }) => {
					const p = (
						window as unknown as {
							__graphProbe?: { pathPick: (id: string) => void };
						}
					).__graphProbe;
					if (!p) return;
					p.pathPick(ida);
					p.pathPick(idb);
				},
				{ ida: a.id, idb: b.id },
			);
			await graph.waitForTimeout(1200);
			const picked = await graph
				.evaluate(() => {
					const p = (window as unknown as { __graphProbe?: { pathNodeIds: () => string[] } })
						.__graphProbe;
					return p ? p.pathNodeIds() : [];
				})
				.catch(() => [] as string[]);
			// Status pill reflects the hop count / no-path result.
			const statusText = await graph
				.locator(".status-pill, [class*='status-pill']")
				.first()
				.innerText()
				.catch(() => "");
			judge(
				picked.length >= 2 ? "PASS" : "?",
				"Path between two nodes",
				`mode engaged=${pathModeOn}; pathNodeIds=${picked.length}; status="${statusText}"`,
			);
			await s.shot(graph, "06-path-between");
			// Disengage path mode.
			await graph
				.locator('[aria-label="Path between two nodes"]')
				.first()
				.click()
				.catch(() => undefined);
			await graph.waitForTimeout(400);
		});

		/* ── Animate timeline + the "Now" history pill ───────────────────────── */
		await step("Animate timeline (playback)", async () => {
			const btn = graph.locator('[aria-label="Animate timeline"]').first();
			const beforePressed = await btn.getAttribute("aria-pressed").catch(() => null);
			await btn.click();
			await graph.waitForTimeout(2500);
			const afterPressed = await btn.getAttribute("aria-pressed").catch(() => null);
			// While playing, the history pill label should move off "Now".
			const pillLabel = await graph
				.locator("#history-fab-label")
				.innerText()
				.catch(() => "");
			judge(
				afterPressed === "true" || beforePressed !== afterPressed ? "PASS" : "?",
				"Animate timeline",
				`aria-pressed ${beforePressed}→${afterPressed}; history pill="${pillLabel}"`,
			);
			await s.shot(graph, "07-animating");
			// Stop it.
			if (afterPressed === "true") {
				await btn.click().catch(() => undefined);
				await graph.waitForTimeout(600);
			}
		});

		await step("history Now pill + scrubber", async () => {
			const fab = graph.locator(".history-fab").first();
			const fabVisible = await fab.isVisible().catch(() => false);
			if (!fabVisible) {
				judge("FAIL", "history pill", "no .history-fab in the canvas overlay");
				return;
			}
			const beforeLabel = await graph
				.locator("#history-fab-label")
				.innerText()
				.catch(() => "");
			await fab.click();
			await graph.waitForTimeout(600);
			const popoverOpen = await graph
				.locator("#history-popover")
				.isVisible()
				.catch(() => false);
			// Drag the scrubber back in time and watch the label/count change.
			const bar = graph.locator("#scrubber-bar");
			let afterLabel = beforeLabel;
			let countText = "";
			if ((await bar.count().catch(() => 0)) > 0) {
				await bar.focus().catch(() => undefined);
				for (let i = 0; i < 12; i++) await graph.keyboard.press("ArrowLeft");
				await graph.waitForTimeout(900);
				afterLabel = await graph
					.locator("#scrubber-date")
					.innerText()
					.catch(() => beforeLabel);
				countText = await graph
					.locator("#scrubber-count")
					.innerText()
					.catch(() => "");
			}
			judge(
				popoverOpen ? "PASS" : "FAIL",
				"history scrubber",
				`popover open=${popoverOpen}; pill "${beforeLabel}"→scrubber "${afterLabel}"; count="${countText}"`,
			);
			await s.shot(graph, "08-history-scrubber");
			await graph.keyboard.press("Escape").catch(() => undefined);
			await graph.mouse.click(5, 5).catch(() => undefined); // dismiss popover
			await graph.waitForTimeout(500);
		});

		/* ── Export menu ─────────────────────────────────────────────────────── */
		await step("Export menu opens", async () => {
			await graph.locator('[aria-label="Export"]').first().click();
			await graph.waitForTimeout(700);
			const dialog = graph.locator("[role='dialog'], .export-popover, .bs-export-popover").first();
			const open = await dialog.isVisible().catch(() => false);
			judge(open ? "PASS" : "FAIL", "Export menu opens", `export popover visible=${open}`);
			await s.shot(graph, "09-export-menu");
			// Probe the format choices and trigger the default export action.
			const formatOptions = await graph
				.locator("input[type=radio], .export-popover [role='radio'], label:has(input)")
				.count()
				.catch(() => 0);
			const action = graph.locator("button:has-text('Export')").last();
			const ran = await action
				.click()
				.then(() => true)
				.catch(() => false);
			judge(
				ran ? "PASS" : "?",
				"Export action",
				`format options=${formatOptions}; clicked Export action=${ran}`,
			);
			await graph.waitForTimeout(600);
			await graph.keyboard.press("Escape").catch(() => undefined);
		});

		/* ── Zoom + reset ────────────────────────────────────────────────────── */
		await step("zoom in / out / reset", async () => {
			const base = await cameraScale(graph);
			await graph.locator('[aria-label="Zoom in"]').first().click();
			await graph.locator('[aria-label="Zoom in"]').first().click();
			await graph.waitForTimeout(700);
			const zoomedIn = await cameraScale(graph);
			await graph.locator('[aria-label="Zoom out"]').first().click();
			await graph.waitForTimeout(500);
			const zoomedOut = await cameraScale(graph);
			await graph.locator('[aria-label="Reset view"]').first().click();
			await graph.waitForTimeout(700);
			const reset = await cameraScale(graph);
			const moved =
				base !== null &&
				zoomedIn !== null &&
				(zoomedIn > base || zoomedOut !== zoomedIn || reset !== zoomedIn);
			judge(
				moved ? "PASS" : "?",
				"zoom controls",
				`scale base=${base?.toFixed(3)} in=${zoomedIn?.toFixed(3)} out=${zoomedOut?.toFixed(3)} reset=${reset?.toFixed(3)}`,
			);
			await s.shot(graph, "10-after-zoom");
		});

		/* ── Legend ──────────────────────────────────────────────────────────── */
		await step("legend renders link-category counts", async () => {
			const legend = graph.locator("#edge-legend");
			const visible = await legend.isVisible().catch(() => false);
			const rows = await legend
				.locator(".edge-legend__row")
				.count()
				.catch(() => 0);
			const text = await legend.innerText().catch(() => "");
			judge(
				visible && rows > 0 ? "PASS" : "?",
				"legend",
				`visible=${visible}; rows=${rows}; text="${text.replace(/\n/g, " | ")}"`,
			);
		});

		/* ── PRIORITY: direct canvas node interaction ────────────────────────── */

		// HOVER a node → after the dwell, the hover-preview tooltip un-hides.
		await step("hover a node → preview tooltip", async () => {
			const nodes = await probeNodes(graph);
			if (nodes.length === 0) {
				judge("?", "hover node tooltip", "no nodes to hover");
				return;
			}
			const target = nodes[Math.floor(nodes.length / 2)] ?? nodes[0];
			const pt = await nodeClientPoint(graph, target);
			if (!pt) {
				judge("FAIL", "hover node tooltip", "worldToClient returned null");
				return;
			}
			// Move first to a neutral spot, then onto the node, and dwell.
			await graph.mouse.move(pt.x + 120, pt.y + 120);
			await graph.waitForTimeout(150);
			await graph.mouse.move(pt.x, pt.y);
			await graph.waitForTimeout(1400); // exceed PREVIEW_DWELL_MS
			const hidden = await graph
				.locator("#hover-preview")
				.getAttribute("aria-hidden")
				.catch(() => "true");
			const title = await graph
				.locator("#hover-preview-title")
				.innerText()
				.catch(() => "");
			judge(
				hidden === "false" ? "PASS" : "FAIL",
				"hover node → preview tooltip",
				`#hover-preview aria-hidden=${hidden}; title="${title}"`,
			);
			await s.shot(graph, "11-node-hover-preview");
			await graph.mouse.move(5, 5); // leave
			await graph.waitForTimeout(400);
		});

		// CLICK a node → default action opens the entity (a new app window/tab).
		await step("click a node → opens entity", async () => {
			const nodes = await probeNodes(graph);
			if (nodes.length === 0) {
				judge("?", "click node", "no nodes to click");
				return;
			}
			const target = nodes[0];
			const pt = await nodeClientPoint(graph, target);
			if (!pt) {
				judge("FAIL", "click node", "worldToClient returned null");
				return;
			}
			const windowsBefore = s.app.windows().length;
			// pointerdown + pointerup at the same spot (drift ≤ 3px = a click).
			await graph.mouse.move(pt.x, pt.y);
			await graph.mouse.down();
			await graph.waitForTimeout(60);
			await graph.mouse.up();
			await graph.waitForTimeout(1800);
			const windowsAfter = s.app.windows().length;
			// With local-graph mode off (the default), a single click opens the
			// entity; with it on, the local-view badge appears. Either is a pass.
			const localBadge = await graph
				.locator("#local-badge")
				.isVisible()
				.catch(() => false);
			const opened = windowsAfter > windowsBefore || localBadge;
			judge(
				opened ? "PASS" : "?",
				"click node → action",
				`pages ${windowsBefore}→${windowsAfter}; local-badge=${localBadge}`,
			);
			await s.shot(graph, "12-node-clicked");
		});

		// RIGHT-CLICK a node → the shared object ⋯ menu opens.
		await step("right-click a node → object menu", async () => {
			const nodes = await probeNodes(graph);
			if (nodes.length === 0) {
				judge("?", "right-click node", "no nodes");
				return;
			}
			const target = nodes[Math.min(1, nodes.length - 1)];
			const pt = await nodeClientPoint(graph, target);
			if (!pt) {
				judge("FAIL", "right-click node", "worldToClient null");
				return;
			}
			await graph.mouse.move(pt.x, pt.y);
			await graph.mouse.click(pt.x, pt.y, { button: "right" });
			await graph.waitForTimeout(700);
			const menu = await graph
				.locator(".fm-menu, [role='menu']")
				.first()
				.isVisible()
				.catch(() => false);
			judge(menu ? "PASS" : "?", "right-click node → object menu", `fancy-menu visible=${menu}`);
			await s.shot(graph, "13-node-context-menu");
			await graph.keyboard.press("Escape").catch(() => undefined);
			await graph.waitForTimeout(300);
		});

		// HOVER an edge → the link-reason tooltip un-hides. The midpoint of two
		// connected nodes lands on (or near) the edge segment.
		await step("hover an edge → link-reason tooltip", async () => {
			const edges = await graph
				.evaluate(() => {
					const p = (
						window as unknown as {
							__graphProbe?: { edges: () => { source: string; target: string }[] };
						}
					).__graphProbe;
					return p ? p.edges() : [];
				})
				.catch(() => [] as { source: string; target: string }[]);
			const nodes = await probeNodes(graph);
			if (edges.length === 0 || nodes.length < 2) {
				judge("?", "hover edge tooltip", `edges=${edges.length}, nodes=${nodes.length}`);
				return;
			}
			const byId = new Map(nodes.map((n) => [n.id, n] as const));
			// Find an edge whose endpoints we have positions for.
			const edge = edges.find((e) => byId.has(e.source) && byId.has(e.target));
			if (!edge) {
				judge("?", "hover edge tooltip", "no edge with both endpoints in node set");
				return;
			}
			const sa = byId.get(edge.source);
			const sb = byId.get(edge.target);
			if (!sa || !sb) {
				judge("?", "hover edge tooltip", "endpoint lookup failed");
				return;
			}
			const mid = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 };
			const pt = await nodeClientPoint(graph, mid as ProbeNode);
			if (!pt) {
				judge("FAIL", "hover edge tooltip", "worldToClient null for midpoint");
				return;
			}
			// Nudge the pointer around the midpoint to catch the edge segment.
			await graph.mouse.move(5, 5);
			await graph.waitForTimeout(150);
			let tipHidden = "true";
			let reason = "";
			for (const [dx, dy] of [
				[0, 0],
				[3, 0],
				[-3, 0],
				[0, 3],
				[0, -3],
				[5, 5],
			]) {
				await graph.mouse.move(pt.x + dx, pt.y + dy);
				await graph.waitForTimeout(180);
				tipHidden = await graph
					.locator("#edge-tooltip")
					.getAttribute("aria-hidden")
					.catch(() => "true");
				if (tipHidden === "false") {
					reason = await graph
						.locator("#edge-tooltip-reason")
						.innerText()
						.catch(() => "");
					break;
				}
			}
			judge(
				tipHidden === "false" ? "PASS" : "?",
				"hover edge → link-reason tooltip",
				`#edge-tooltip aria-hidden=${tipHidden}; reason="${reason}"`,
			);
			await s.shot(graph, "14-edge-tooltip");
			await graph.mouse.move(5, 5);
			await graph.waitForTimeout(300);
		});

		/* ── F-230: label overlap, captured visually for the friction log ────── */
		await step("F-230 label overlap (visual)", async () => {
			const showLabels = await graph
				.locator(".settings-toggle input[type=checkbox]")
				.first()
				.isChecked()
				.catch(() => null);
			judge(
				"?",
				"F-230 label overlap",
				`captured a full-canvas shot for visual review of node-title overlap (showLabels=${showLabels}) — see 15-label-overlap.png`,
			);
			await s.shot(graph, "15-label-overlap");
		});

		/* ── Persistence / redraw: re-open the app, assert it rehydrates ─────── */
		await step("persistence: reopen app rehydrates canvas", async () => {
			const beforeNodes = (await probeNodes(graph)).length;
			const reopened = await s.openApp(APP.Graph).catch(() => null);
			if (!reopened) {
				judge("?", "reopen rehydrate", "could not open a second Graph window");
				return;
			}
			await reopened.waitForTimeout(SETTLE_MS);
			const afterNodes = (await probeNodes(reopened)).length;
			judge(
				afterNodes > 0 ? "PASS" : "?",
				"reopen rehydrate",
				`nodes before=${beforeNodes}, after reopen=${afterNodes}`,
			);
			await s.shot(reopened, "16-reopened");
		});
	} finally {
		await s.finish();
	}
});
