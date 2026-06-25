/**
 * Session 203 — Day 4: Marcus checks the knowledge map for ownership.
 *
 * F-152 registered `assigneeId` in the vault property catalog so a Task→Person
 * edge projects into the Graph labelled "Assignee" — that half was never
 * real-shell verified. With Priya assigned to the Issue #4 deliverable
 * (session 200), the map should now draw that edge, and the honest edge
 * counter (F-157) should tick up accordingly.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("the Task→Person Assignee edge reaches the graph (203)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("203-assignee-graph-edge");
	try {
		s.chat(
			SPEAKER.Marcus,
			"If assignment is a real relationship now, the map should show it — a task pointing at Priya, with a reason on the edge.",
		);

		// Tasks ensures the assigneeId catalog def at boot (the dev seeder
		// never runs against this vault) — open it first so the def exists
		// before the graph derives its links.
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2500);

		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(6000);
		await s.shot(graph, "01-settled");

		// The honest counter from F-157 — did the assignee edge tick it up?
		const summaryVisible = await graph
			.locator("text=Visible edges")
			.first()
			.isVisible()
			.catch(() => false);
		if (!summaryVisible) {
			await graph
				.locator('[aria-label*="ilter"], button:has-text("Filters")')
				.first()
				.click()
				.catch(() => undefined);
			await graph.waitForTimeout(1000);
		}
		const summaryText = await graph
			.locator("text=Visible edges")
			.first()
			.locator("xpath=..")
			.textContent()
			.catch(() => null);
		s.note(`visible-edges summary: ${summaryText ?? "(not found)"}`);
		await s.shot(graph, "02-filters");

		// Ground truth from the link snapshot: is there a property-ref link for
		// assigneeId at all?
		const probe = await graph.evaluate(async () => {
			const bs = (
				window as unknown as {
					brainstorm?: {
						services?: {
							vaultEntities?: {
								list: () => Promise<{
									entities: { id: string; type: string; deletedAt: number | null }[];
									links?: {
										sourceId: string;
										targetId: string;
										kind?: string;
										detail?: string;
									}[];
								}>;
							};
						};
					};
				}
			).brainstorm;
			const snap = await bs?.services?.vaultEntities?.list();
			if (!snap) return { error: "no snapshot" };
			const links = snap.links ?? [];
			const assigneeLinks = links.filter(
				(l) =>
					(l.detail ?? "").toLowerCase().includes("assignee") || (l.kind ?? "").includes("assigneeId"),
			);
			return {
				totalLinks: links.length,
				assigneeLinks: assigneeLinks.length,
				sample: assigneeLinks.slice(0, 3),
			};
		});
		s.note(`link snapshot probe: ${JSON.stringify(probe)}`);

		s.chat(
			SPEAKER.Marcus,
			(probe as { assigneeLinks?: number }).assigneeLinks
				? "The ownership edge is in the data — the map now knows who owns what, not just what links to what."
				: "No Assignee edge in the link snapshot — the catalog rule may not be projecting it; flagging for Kai.",
		);
	} finally {
		await s.finish();
	}
});
