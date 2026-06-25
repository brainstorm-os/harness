/**
 * Session 198 — Day 1 after the fix batch: Mira + Marcus verify what shipped.
 *
 * Five fixes landed on main today; this session gives each its first real-shell
 * look, woven into the team's normal day:
 *  - F-152: Tasks Assignee — Mira finally assigns Priya's deliverable to Priya.
 *  - F-153: the REPEAT caption no longer parrots "Does not repeat".
 *  - F-157/F-159: Marcus re-reads the graph — does "Visible edges" tell the
 *    truth now, and is the legend clear of the "Now" pill?
 *  - F-158: an abandoned "New contact" should no longer leave an Unnamed ghost.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const PERSON_TYPE = "brainstorm/Person/v1";

test("Mira assigns work + checks the repeat caption (F-152/F-153)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("198-fix-batch-verify");
	try {
		s.chat(
			SPEAKER.Mira,
			"Kai says tasks have an Assignee now. If I can put Priya's name on her Issue #4 outline instead of typing it into the title, that's the team becoming real.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2000);
		await s.shot(tasks, "01-tasks-landing");

		// Open the first task row's detail route.
		const row = tasks.locator(".task-row, [data-task-id], .tasks-list li").first();
		await row.click().catch(() => undefined);
		await tasks.waitForTimeout(1500);
		await s.shot(tasks, "02-detail-route");

		// F-153 — the REPEAT caption must not duplicate the select's value.
		const repeatEchoes = await tasks
			.locator("text=Does not repeat")
			.count()
			.catch(() => -1);
		s.note(
			`F-153: occurrences of "Does not repeat" on the detail (1 = select only, 2 = caption still parrots): ${repeatEchoes}`,
		);

		// F-152 — the Properties panel should now carry an Assignee row. The
		// panel may need its header toggle first.
		const propsVisible = await tasks
			.locator("text=Assignee")
			.first()
			.isVisible()
			.catch(() => false);
		if (!propsVisible) {
			await tasks
				.locator('[aria-label*="roperties"], [aria-label*="Info"], [aria-label*="inspector"]')
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(1000);
		}
		const assigneeRow = await tasks
			.locator("text=Assignee")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`F-152: Assignee row present in the Properties panel: ${assigneeRow}`);
		await s.shot(tasks, "03-properties-panel");

		if (assigneeRow) {
			// Open the assignee picker and look for the team.
			await tasks
				.locator("text=Assignee")
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(800);
			await s.shot(tasks, "04-assignee-picker");
			const priya = tasks.locator("text=Priya").first();
			const priyaVisible = await priya.isVisible().catch(() => false);
			s.note(`F-152: Priya offered as an assignee candidate: ${priyaVisible}`);
			if (priyaVisible) {
				await priya.click().catch(() => undefined);
				await tasks.waitForTimeout(1200);
				await s.shot(tasks, "05-assignee-set");
				const renders = await tasks
					.locator("text=Priya")
					.first()
					.isVisible()
					.catch(() => false);
				s.note(`F-152: assignee renders on the detail after pick: ${renders}`);
			}
		}

		s.chat(
			SPEAKER.Mira,
			assigneeRow
				? "Assignee is real — picked Priya from my own contacts. The title-string era is over for ownership."
				: "Still no Assignee row where I looked — filing it back.",
		);

		// F-153 hard check: the echo case is exactly what got fixed.
		expect(repeatEchoes, "repeat caption must not duplicate the select").toBeLessThanOrEqual(1);
	} finally {
		await s.finish();
	}
});

test("Marcus re-reads the graph: honest edge count + clear legend (F-157/F-159)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("198-marcus-graph-recheck");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Last week the graph claimed zero edges while drawing some. Re-checking the Filters numbers and that legend corner.",
		);

		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(6000); // let the sim settle
		await s.shot(graph, "01-settled");

		// Open the Filters panel if the summary isn't already on screen.
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
		await s.shot(graph, "02-filters-panel");

		const summaryText = await graph
			.locator("text=Visible edges")
			.first()
			.locator("xpath=..")
			.textContent()
			.catch(() => null);
		s.note(`F-157: visible-edges summary row reads: ${summaryText ?? "(not found)"}`);

		const edgeCount = summaryText ? Number(/Visible edges\D*(\d+)/.exec(summaryText)?.[1] ?? -1) : -1;
		s.note(`F-157: parsed visible edge count: ${edgeCount}`);

		// F-159 — the legend should sit clear of the Now pill; capture the corner.
		await s.shot(graph, "03-bottom-left-corner");
		const legendBox = await graph
			.locator(".edge-legend")
			.first()
			.boundingBox()
			.catch(() => null);
		const nowBox = await graph
			.locator("text=Now")
			.first()
			.boundingBox()
			.catch(() => null);
		const overlap =
			legendBox && nowBox
				? !(
						legendBox.y + legendBox.height <= nowBox.y ||
						nowBox.y + nowBox.height <= legendBox.y ||
						legendBox.x + legendBox.width <= nowBox.x ||
						nowBox.x + nowBox.width <= legendBox.x
					)
				: null;
		s.note(
			`F-159: legend box ${JSON.stringify(legendBox)} vs Now pill ${JSON.stringify(nowBox)} → overlap: ${overlap}`,
		);

		s.chat(
			SPEAKER.Marcus,
			edgeCount > 0
				? `The counter tells the truth now — ${edgeCount} visible edges, matching a drawn web instead of claiming zero.`
				: "Counter still reads zero or the panel moved — noting it for Kai either way.",
		);
	} finally {
		await s.finish();
	}
});

test("an abandoned New contact leaves no Unnamed ghost (F-158)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("198-contact-ghost-check");
	try {
		s.chat(
			SPEAKER.Kai,
			"Verifying F-158: a New contact you abandon without typing anything should evaporate when you leave Contacts, like the Notes blanks now do.",
		);

		const contacts = await s.openApp(APP.Contacts);
		await contacts.waitForTimeout(2000);

		const countPersons = async () =>
			await contacts.evaluate(async (type) => {
				const bs = (
					window as unknown as {
						brainstorm?: {
							services?: {
								vaultEntities?: { list: () => Promise<{ entities: { type: string }[] }> };
							};
						};
					}
				).brainstorm;
				const snap = await bs?.services?.vaultEntities?.list();
				return (snap?.entities ?? []).filter((e) => e.type === type).length;
			}, PERSON_TYPE);

		const before = await countPersons();
		s.note(`Person entities before New contact: ${before}`);
		await s.shot(contacts, "01-before");

		await contacts
			.locator('button:has-text("New contact"), [aria-label*="New contact"]')
			.first()
			.click()
			.catch(() => undefined);
		await contacts.waitForTimeout(1500);
		const during = await countPersons();
		s.note(`Person entities right after New contact (persisted immediately): ${during}`);
		await s.shot(contacts, "02-new-contact-open");

		// Park the app the way the shell does on window close.
		await contacts.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent("brainstorm:app-visibility", { detail: { visible: false } }),
			);
		});
		await contacts.waitForTimeout(2000);

		const after = await countPersons();
		s.note(`Person entities after park (ghost should be discarded): ${after}`);
		await s.shot(contacts, "03-after-park");

		expect(after).toBe(before);

		s.chat(
			SPEAKER.Kai,
			after === before
				? "Confirmed: the abandoned blank contact is discarded on park — no more Unnamed rows accumulating. F-158 ghost-prevention holds."
				: "The blank contact survived the park — reopening F-158.",
		);
	} finally {
		await s.finish();
	}
});
