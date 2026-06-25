/**
 * Session 185 — Mira's work-week kickoff (real cadence work).
 *
 * It's Monday. Mira opens Tasks to plan the week now that the team is real
 * (Marcus on brand, Priya on research). She does two things a founder actually
 * does:
 *   1. Opens an existing deliverable on its detail route and reads the layout —
 *      this is the first real-shell look at the `fix/tasks-detail-polish`
 *      change (consistent detail fields + section rhythm), which shipped to the
 *      branch but was never verified in the running shell. If the detail view
 *      is clean and legible, that's a positive verification; if a field is
 *      mislabelled / cramped / duplicated, that's friction.
 *   2. Schedules THIS week's concrete deliverables against the team, so the
 *      task list reflects who-owes-what. Idempotent: an item already on the
 *      list is left alone.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type Deliverable = { title: string; key: string; scheduled: string };
const THIS_WEEK: Deliverable[] = [
	{
		title: "Advisory — Beacon: prep the discovery deck",
		key: "Advisory — Beacon",
		scheduled: "2026-06-09",
	},
	{
		title: "Review Marcus's brand system v1",
		key: "brand system v1",
		scheduled: "2026-06-10",
	},
	{
		title: "Priya — Issue #4 research outline + sources",
		key: "Issue #4 research outline",
		scheduled: "2026-06-11",
	},
];

test("Mira plans the work week in Tasks (185)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("185-mira-weekly-cadence");
	try {
		s.chat(
			SPEAKER.Mira,
			"Monday. Team's real now — Marcus on brand, Priya on research. Opening Tasks to read a deliverable on the new detail view and block out who owes what this week.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "01-list");

		// --- Part 1: read an existing deliverable on its detail route. ---
		// The task name button is the stable detail-open target (session 154/181).
		await tasks
			.locator("[data-task-id] .task-row__name")
			.first()
			.click()
			.catch(() => undefined);
		const titleRow = tasks.locator(".tasks-detail__titlerow").first();
		await titleRow.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
		await tasks.waitForTimeout(900);
		await s.shot(tasks, "02-detail-top");

		const detailTitle = await titleRow.innerText().catch(() => "");
		// Read the field/section labels so a mislabelled or duplicated field is
		// visible in the notes (the polish pass was about exactly this).
		const fieldLabels = await tasks
			.locator(
				".tasks-detail__field-label, .tasks-detail__section-label, .bs-props__row .bs-cell-label",
			)
			.allInnerTexts()
			.catch(() => [] as string[]);
		s.note(`detail title="${detailTitle.replace(/\n/g, " / ")}"`);
		s.note(
			`detail field/section labels: ${JSON.stringify(fieldLabels.map((l) => l.trim()).filter(Boolean))}`,
		);

		// Scroll for the body editor + subtasks (lower sections).
		await tasks.mouse.wheel(0, 700);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "03-detail-lower");

		// Back to the list.
		await tasks.keyboard.press("Escape").catch(() => undefined);
		await tasks.waitForTimeout(600);

		// --- Part 2: schedule this week's team deliverables. ---
		await tasks
			.locator('[data-surface="upcoming"]')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(700);
		await s.shot(tasks, "04-upcoming-before");

		const onList = async (key: string): Promise<boolean> => {
			const names = (
				await tasks
					.locator(".task-row__name-label")
					.allInnerTexts()
					.catch(() => [])
			).map((t) => t.trim());
			return names.some((n) => n.includes(key));
		};

		let added = 0;
		for (const d of THIS_WEEK) {
			if (await onList(d.key)) {
				s.note(`"${d.key}" already on the list — skipping`);
				continue;
			}
			await tasks
				.locator(".tasks-header__action")
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(500);
			const form = tasks.locator(".tasks-compose").first();
			if (!(await form.isVisible().catch(() => false))) {
				s.note(`compose form did not open for "${d.key}"`);
				continue;
			}
			const inputs = form.locator(".tasks-compose__input");
			await inputs
				.nth(0)
				.fill(d.title)
				.catch(() => undefined);
			await inputs
				.nth(1)
				.fill(d.scheduled)
				.catch(() => undefined);
			await tasks.waitForTimeout(150);
			await tasks
				.locator("[data-bs-primary]")
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(900);
			added += 1;
			s.note(`scheduled "${d.key}" for ${d.scheduled}`);
		}

		await tasks
			.locator('[data-surface="upcoming"]')
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(700);
		await s.shot(tasks, "05-upcoming-after");

		const names = (
			await tasks
				.locator(".task-row__name-label")
				.allInnerTexts()
				.catch(() => [])
		).map((t) => t.trim());
		s.note(`upcoming tasks now: ${JSON.stringify(names)}`);

		const allThere = THIS_WEEK.every((d) => names.some((n) => n.includes(d.key)));
		s.chat(
			SPEAKER.Mira,
			allThere
				? `Week's blocked out — Beacon prep, Marcus brand review, Priya's Issue #4 outline, all dated. The detail view reads clean too: "${detailTitle.split("\n")[0]}".`
				: `Got ${added} of this week's deliverables on the list; some didn't take — checking the compose flow.`,
		);

		s.note(
			`detail-polish real-shell look: title legible="${Boolean(detailTitle.trim())}", labels=${fieldLabels.length}`,
		);
		expect(
			detailTitle.trim().length,
			"a deliverable opens on a readable detail route",
		).toBeGreaterThan(0);
		expect(allThere, "this week's team deliverables are all on the list").toBe(true);
	} finally {
		await s.finish();
	}
});
