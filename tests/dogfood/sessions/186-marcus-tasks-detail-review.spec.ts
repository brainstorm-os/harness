/**
 * Session 186 — Marcus design-reviews the Tasks DETAIL view (polish pass).
 *
 * `fix/tasks-detail-polish` reworked the task detail route: consistent detail
 * fields + section rhythm, title cursor/single-click edit. Marcus — the
 * designer, allergic to inconsistency — opens a task on its detail route and
 * scrutinises the layout against the rest of the product: field-label casing,
 * section spacing, the title affordance (does it read as editable), and whether
 * the header `⋯` sits where every other app puts it (last, rightmost). He posts
 * intent neutrally; the verdict comes from the captures + measured values.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Tasks detail layout (186)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("186-marcus-tasks-detail-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Mira says the task detail view got a polish pass. Opening a task on its detail route — checking field rhythm, label casing, the title affordance and where the ⋯ lands.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "01-list");

		// Open the first task on its detail route.
		await tasks
			.locator("[data-task-id] .task-row__name")
			.first()
			.click()
			.catch(() => undefined);
		const titleRow = tasks.locator(".tasks-detail__titlerow").first();
		await titleRow.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
		await tasks.waitForTimeout(900);
		await s.shot(tasks, "02-detail-top");

		// Field/section labels — Marcus wants consistent casing + naming.
		const labels = await tasks
			.locator(
				".tasks-detail__field-label, .tasks-detail__section-label, .bs-props__row .bs-cell-label",
			)
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean))
			.catch(() => [] as string[]);
		s.note(`detail labels: ${JSON.stringify(labels)}`);

		// Title affordance: does the label read as editable (pointer cursor)?
		const titleCursor = await tasks
			.locator(".tasks-detail__title-group .task-row__name-label")
			.first()
			.evaluate((el) => getComputedStyle(el).cursor)
			.catch(() => "n/a");
		s.note(`detail title cursor=${titleCursor}`);

		// Section rhythm: capture the vertical gaps between detail sections so an
		// uneven cadence is measurable, not just eyeballed.
		const sectionTops = await tasks
			.locator(".tasks-detail__section, .tasks-detail__field")
			.evaluateAll((els) =>
				els.slice(0, 8).map((e) => Math.round((e as HTMLElement).getBoundingClientRect().top)),
			)
			.catch(() => [] as number[]);
		const gaps = sectionTops.slice(1).map((t, i) => t - (sectionTops[i] ?? t));
		s.note(`section tops=${JSON.stringify(sectionTops)} gaps=${JSON.stringify(gaps)}`);

		await tasks.mouse.wheel(0, 700);
		await tasks.waitForTimeout(500);
		await s.shot(tasks, "03-detail-lower");

		// Header ⋯ placement: should be the LAST element in the right group.
		const headerRightLabels = await tasks
			.locator(".tasks-header .app-header__right, .tasks-header")
			.first()
			.locator("button")
			.evaluateAll((els) =>
				els.map((e) => (e as HTMLElement).getAttribute("aria-label") || (e as HTMLElement).className),
			)
			.catch(() => [] as string[]);
		s.note(`header right buttons (in order): ${JSON.stringify(headerRightLabels)}`);
		const moreIsLast =
			headerRightLabels.length > 0 &&
			/more|⋯|object-menu/i.test(headerRightLabels[headerRightLabels.length - 1] ?? "");
		s.note(`⋯ is the last/rightmost header control: ${moreIsLast}`);

		s.chat(
			SPEAKER.Marcus,
			"Walked the detail layout end to end — title affordance, label casing, section gaps, header order. Pulling the verdict from the captures.",
		);
		s.note(
			"Marcus reviewed the Tasks detail layout; specific findings (if any) distilled into friction-log.",
		);
	} finally {
		await s.finish();
	}
});
