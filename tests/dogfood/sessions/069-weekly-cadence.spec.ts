/**
 * Session 069 — Mira blocks out the newsletter cadence in Tasks.
 *
 * The Content Calendar (065–067) says WHAT ships and WHEN; now she puts the
 * matching WORK on her task list, scheduled ahead of each publish date. Three
 * "Draft Issue #N" deliverables, each scheduled this/next week (a few days
 * before its issue goes out). This closes the loop between the editorial
 * pipeline and her day-to-day cadence — the "deliverables in Tasks" piece of
 * the core operating area.
 *
 * Drives the Tasks compose form end-to-end: header "+" New task →
 * .tasks-compose (name + scheduled-date inputs) → primary submit. Future-dated
 * tasks land on the Upcoming surface, where they're asserted. Idempotent:
 * a deliverable already on the list is left alone.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Deliverable = { title: string; key: string; scheduled: string };
const DELIVERABLES: Deliverable[] = [
	{
		title: "Draft Issue #1 — the case for dev-tools infra",
		key: "Draft Issue #1",
		scheduled: "2026-06-06",
	},
	{
		title: "Draft Issue #2 — pricing power at seed",
		key: "Draft Issue #2",
		scheduled: "2026-06-13",
	},
	{ title: "Draft Issue #3 — when to raise", key: "Draft Issue #3", scheduled: "2026-06-20" },
];

test("schedule this period's newsletter deliverables", async () => {
	test.setTimeout(180_000);
	const s = await startSession("069-weekly-cadence");
	try {
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);

		// Work from Upcoming — where future-dated deliverables live.
		await tasks.locator('[data-surface="upcoming"]').first().click();
		await tasks.waitForTimeout(700);
		await s.shot(tasks, "01-upcoming-before");

		const onList = async (key: string): Promise<boolean> => {
			const names = (await tasks.locator(".task-row__name-label").allInnerTexts()).map((t) =>
				t.trim(),
			);
			return names.some((n) => n.includes(key));
		};

		for (const d of DELIVERABLES) {
			if (await onList(d.key)) {
				s.note(`"${d.key}" already scheduled — skipping`);
				continue;
			}
			await tasks.locator(".tasks-header__action").first().click();
			await tasks.waitForTimeout(500);
			const form = tasks.locator(".tasks-compose").first();
			await expect(form, `compose form opened for ${d.key}`).toBeVisible();
			const inputs = form.locator(".tasks-compose__input");
			await inputs.nth(0).fill(d.title); // name
			await inputs.nth(1).fill(d.scheduled); // scheduled date
			await tasks.waitForTimeout(150);
			// Submit lives in the popover footer (.tasks-compose__actions), a
			// sibling of the .tasks-compose body — target it at page level.
			await tasks.locator("[data-bs-primary]").first().click();
			await tasks.waitForTimeout(900);
			s.note(`scheduled "${d.key}" for ${d.scheduled}`);
		}

		// Land back on Upcoming to confirm the whole cadence is there.
		await tasks.locator('[data-surface="upcoming"]').first().click();
		await tasks.waitForTimeout(700);
		await s.shot(tasks, "02-upcoming-after");

		const names = (await tasks.locator(".task-row__name-label").allInnerTexts()).map((t) => t.trim());
		s.note(`upcoming tasks: ${JSON.stringify(names)}`);

		for (const d of DELIVERABLES) {
			expect(
				names.some((n) => n.includes(d.key)),
				`${d.key} is on the cadence`,
			).toBe(true);
		}
	} finally {
		await s.finish();
	}
});
