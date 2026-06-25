/**
 * Session 190 — Marcus design-reviews the Graph as a knowledge map (Fri).
 *
 * Priya audited the graph for *connectivity* (130). Marcus's lens is different:
 * is the map *legible and considered* as a piece of design — node legibility,
 * the edge-reason legend, label collision, the empty/dense readability, and the
 * chrome (header order, controls). He lets the force sim settle, captures the
 * settled map and the legend, reads the on-canvas signal counters, and files
 * specific design friction. Verdict from the captures + measured values.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the knowledge graph (190)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("190-marcus-graph-design-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Reviewing the Graph as design, not data — node legibility, the colour-by-reason legend, label collisions, and whether the chrome matches the rest of the product.",
		);

		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(4800); // let the force sim settle before judging
		await s.shot(graph, "01-settled");

		const canvasInfo = await graph
			.locator("canvas")
			.first()
			.evaluate((el) => ({
				nodes: (el as HTMLElement).dataset.nodeCount ?? null,
				edges: (el as HTMLElement).dataset.edgeCount ?? null,
				rebuilds: (el as HTMLElement).dataset.edgeRebuilds ?? null,
			}))
			.catch(() => ({ nodes: null, edges: null, rebuilds: null }));
		s.note(`graph canvas dataset: ${JSON.stringify(canvasInfo)}`);

		// The edge-reason legend (BodyLink / PropertyReference / SharedAttribute).
		const legend = await graph
			.locator("[class*='legend'], [class*='Legend']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 10),
			)
			.catch(() => [] as string[]);
		s.note(`legend text: ${JSON.stringify(legend)}`);
		const legendBox = graph.locator("[class*='legend'], [class*='Legend']").first();
		if (await legendBox.count().catch(() => 0)) {
			await s.shot(graph, "02-legend", legendBox).catch(() => undefined);
		}

		// Header chrome: button order + the trailing ⋯.
		const headerButtons = await graph
			.locator(".app-header__right, .app-header")
			.first()
			.locator("button")
			.evaluateAll((els) =>
				els.map((e) => (e as HTMLElement).getAttribute("aria-label") || (e as HTMLElement).className),
			)
			.catch(() => [] as string[]);
		s.note(`graph header buttons (in order): ${JSON.stringify(headerButtons)}`);

		// Hover a node to check the reason tooltip renders (the WHY-edges feature).
		const box = await graph
			.locator("canvas")
			.first()
			.boundingBox()
			.catch(() => null);
		if (box) {
			await graph.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await graph.waitForTimeout(700);
			await s.shot(graph, "03-hover-center");
		}

		s.chat(
			SPEAKER.Marcus,
			"Settled map, legend and chrome captured. Pulling specific design notes from the captures — legibility, legend clarity, header order.",
		);
		s.note(
			"Marcus design-reviewed the graph; findings distilled to friction-log from captures + counters.",
		);
	} finally {
		await s.finish();
	}
});
