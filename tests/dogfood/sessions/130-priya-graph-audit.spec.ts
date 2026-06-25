/**
 * Session 130 — Priya audits the knowledge graph (is the research connected?).
 *
 * Her second session shape: a knowledge-integrity audit. She opens the Graph —
 * Northbound's idea map — and asks whether her research actually connects:
 * issues, briefs, clients and the reading list as one web, or scattered islands.
 * Lets the force sim settle, then captures. Verdict decided from the capture.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya audits the knowledge graph (130)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("130-priya-graph-audit");
	try {
		s.chat(
			SPEAKER.Priya,
			"Auditing the graph — I want to see whether the research actually connects: issues, briefs, clients, reading list as one web, not islands.",
		);

		const graph = await s.openApp(APP.Graph);
		// Let the force simulation settle before judging the layout.
		await graph.waitForTimeout(4500);
		await s.shot(graph, "01-graph-settled");

		// Best-effort signal counters the graph may expose on the canvas dataset.
		const canvasInfo = await graph
			.locator("canvas")
			.first()
			.evaluate((el) => ({
				nodes: (el as HTMLElement).dataset.nodeCount ?? null,
				edges: (el as HTMLElement).dataset.edgeCount ?? null,
			}))
			.catch(() => ({ nodes: null, edges: null }));
		s.note(`graph canvas dataset: ${JSON.stringify(canvasInfo)}`);

		s.chat(
			SPEAKER.Priya,
			"Let it settle and grabbed the map — reading the structure from the capture now.",
		);
		s.note("Priya audited the knowledge graph; verdict from capture.");
	} finally {
		await s.finish();
	}
});
