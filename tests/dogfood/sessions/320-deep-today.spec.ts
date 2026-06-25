/**
 * Session 320 — deep "Today" walkthrough. The Tasks app's Today surface is the
 * product's daily driver: "what do I do now". This spec exercises it end to end
 * by MANUFACTURING the state Today is supposed to show (the seeded Northbound
 * vault lands nothing in Today — every seed task is future-dated, undated, or
 * already done), then verifying Today buckets it correctly:
 *
 *   1. Land on Today empty — record the empty-state copy a fresh user sees.
 *   2. Create a task scheduled TODAY → it must appear in the "Today" section.
 *   3. Create an OVERDUE open task (scheduled yesterday) → it must appear in a
 *      separate "Overdue · N" section ABOVE Today.
 *   4. Verify the sidebar Today count badge tracks the live total.
 *   5. Complete the today task → it leaves the active list; the count drops.
 *   6. Toggle "Show completed" → the completed today task returns.
 *
 * Judged from observable DOM, every step wrapped so one broken affordance never
 * aborts the run. This spec only USES the app — it never patches code.
 *
 * Selectors mirror 228-deep-tasks (the imperative-DOM Tasks renderer):
 *   - sidebar surface row:  `.tasks-sidebar__row[data-surface="today"]`
 *   - sidebar count badge:  `.tasks-sidebar__row[data-surface="today"] .tasks-sidebar__badge`
 *   - section heading:      `.tasks-section__heading` (Overdue · N / Today)
 *   - empty state:          `.tasks-empty`
 *   - compose popover:      `.tasks-compose` (name `.tasks-compose__input`,
 *                           `.tasks-compose__date-trigger` ×2 = Scheduled, Due,
 *                           each popping the shared `.bs-cal-popover` calendar)
 *   - task rows:            `.task-row[data-task-id]` (+ `data-done`)
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const fmtDate = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("deep today walkthrough (320)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("320-deep-today");

	try {
		const page = await s.openApp(APP.Tasks);
		await page.waitForTimeout(2600);

		const step = async (action: string, fn: () => Promise<string>): Promise<void> => {
			try {
				s.note(await fn());
			} catch (error) {
				s.note(`[FAIL] ${action} — threw ${(error as Error).message}`);
			}
		};

		const gotoToday = async () => {
			await page.locator('.tasks-sidebar__row[data-surface="today"]').first().click();
			await page.waitForTimeout(700);
		};
		const sectionTitles = async () =>
			(await page.locator(".tasks-section__heading").allInnerTexts()).map((t) => t.trim());
		const todayBadge = async () => {
			const b = page
				.locator('.tasks-sidebar__row[data-surface="today"] .tasks-sidebar__badge')
				.first();
			return (await b.count()) > 0 ? (await b.innerText()).trim() : "(none)";
		};
		const rowInToday = (name: string) =>
			page.locator(".task-row__name-label", { hasText: name }).count();

		// Pick a date in the compose form's themed picker (the product replaced
		// native <input type=date> with a `.tasks-compose__date-trigger` button
		// that pops the shared `.bs-cal-popover` calendar — cells carry
		// `data-date-key="YYYY-MM-DD"`). `which` 0 = Scheduled, 1 = Due.
		const pickDate = async (which: 0 | 1, target: Date) => {
			await page.locator(".tasks-compose__date-trigger").nth(which).click();
			await page.waitForTimeout(400);
			const key = fmtDate(target);
			let cell = page.locator(`.bs-cal-popover .bs-cal-month__cell[data-date-key="${key}"]`).first();
			// Yesterday can fall in the previous month — page back once if absent.
			if ((await cell.count()) === 0) {
				await page
					.locator(".bs-cal-popover .bs-date-pager__arrow--prev")
					.first()
					.click()
					.catch(() => undefined);
				await page.waitForTimeout(250);
				cell = page.locator(`.bs-cal-popover .bs-cal-month__cell[data-date-key="${key}"]`).first();
			}
			await cell.click();
			await page.waitForTimeout(300);
		};

		// Create a task via the compose popover. `schedule`/`due` are Date|null.
		const createTask = async (name: string, schedule: Date | null, due: Date | null) => {
			await page.locator('[aria-label="New task"]').first().click();
			await page.waitForTimeout(600);
			await page.locator(".tasks-compose__input").first().fill(name);
			if (schedule) await pickDate(0, schedule);
			if (due) await pickDate(1, due);
			await page
				.locator("button", { hasText: "Create task" })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1100);
			// Never leave the modal open — its backdrop would intercept every
			// later click and cascade unrelated failures.
			if (
				await page
					.locator(".tasks-compose")
					.first()
					.isVisible()
					.catch(() => false)
			) {
				await page.keyboard.press("Escape").catch(() => undefined);
				await page.waitForTimeout(300);
			}
		};

		await s.shot(page, "00-launch");

		// ─── 1. Land on Today — record what a fresh user sees ────────────────
		await gotoToday();
		await s.shot(page, "01-today-initial");
		await step("initial Today state", async () => {
			const rows = await page.locator(".task-row").count();
			const empty = page.locator(".tasks-empty");
			const isEmpty = (await empty.count()) > 0;
			const emptyTitle = isEmpty
				? await empty
						.locator("h2")
						.first()
						.innerText()
						.catch(() => "")
				: "";
			const emptyBody = isEmpty
				? await empty
						.locator("p")
						.first()
						.innerText()
						.catch(() => "")
				: "";
			const badge = await todayBadge();
			return `[?] initial Today — ${rows} rows, empty-state=${isEmpty} ("${emptyTitle}" / "${emptyBody}"), sidebar badge="${badge}"`;
		});

		const now = new Date();
		const todayName = `Today task ${Date.now().toString(36)}`;
		const overdueName = `Overdue task ${Date.now().toString(36)}`;

		// ─── 2. Create a task scheduled TODAY → appears in Today section ─────
		await step("create task scheduled today", async () => {
			await createTask(todayName, now, null);
			await gotoToday();
			const found = await rowInToday(todayName);
			const titles = await sectionTitles();
			const inToday = titles.some((t) => /^today/i.test(t));
			const ok = found > 0;
			return `[${ok ? "PASS" : "FAIL"}] create task scheduled today — row visible in Today=${found}, sections=[${titles.join(" | ")}], has "Today" section=${inToday}`;
		});
		await s.shot(page, "02-today-has-task");

		// ─── 3. Create an OVERDUE open task → separate Overdue section ───────
		const yesterday = new Date(now.getTime() - 86_400_000);
		await step("create overdue task (scheduled yesterday)", async () => {
			await createTask(overdueName, yesterday, null);
			await gotoToday();
			const found = await rowInToday(overdueName);
			const titles = await sectionTitles();
			const overdueSection = titles.find((t) => /overdue/i.test(t)) ?? "(none)";
			const overdueAboveToday = (() => {
				const oi = titles.findIndex((t) => /overdue/i.test(t));
				const ti = titles.findIndex((t) => /^today/i.test(t));
				return oi >= 0 && ti >= 0 && oi < ti;
			})();
			const ok = found > 0 && /overdue/i.test(overdueSection);
			return `[${ok ? "PASS" : "FAIL"}] create overdue task — row visible=${found}, Overdue heading="${overdueSection}", Overdue-above-Today=${overdueAboveToday}`;
		});
		await s.shot(page, "03-today-with-overdue");

		// ─── 4. Sidebar Today count badge tracks the live total ─────────────
		await step("sidebar Today badge reflects count", async () => {
			const badge = await todayBadge();
			const rows = await page.locator(".task-row").count();
			// Both the today task and the overdue task should count → ≥ 2.
			const n = Number.parseInt(badge.replace(/\D/g, ""), 10);
			const ok = Number.isFinite(n) && n >= 2 && rows >= 2;
			return `[${ok ? "PASS" : "FAIL"}] sidebar Today badge — badge="${badge}" (parsed ${n}), rows=${rows}`;
		});

		// ─── 5. Complete the today task → leaves the active list ────────────
		await step("complete the today task", async () => {
			const row = page
				.locator(".task-row")
				.filter({ has: page.locator(".task-row__name-label", { hasText: todayName }) })
				.first();
			if ((await row.count()) === 0) return "[FAIL] complete today task — row not found";
			const badgeBefore = await todayBadge();
			await row.locator(".task-row__toggle").first().click();
			await page.waitForTimeout(900);
			const stillVisible = await rowInToday(todayName);
			const badgeAfter = await todayBadge();
			const ok = stillVisible === 0;
			return `[${ok ? "PASS" : "FAIL"}] complete today task — hidden from active list=${ok} (copies ${stillVisible}), badge "${badgeBefore}"→"${badgeAfter}"`;
		});
		await s.shot(page, "04-after-complete");

		// ─── 6. Show completed → completed today task returns ───────────────
		await step("toggle Show completed", async () => {
			const toggle = page.locator(".tasks-surface__toggle", { hasText: "Show completed" }).first();
			if ((await toggle.count()) === 0) return "[FAIL] show completed — toggle absent on Today";
			await toggle.click();
			await page.waitForTimeout(700);
			const reappeared = await rowInToday(todayName);
			const pressed = await toggle.getAttribute("aria-pressed");
			const ok = reappeared > 0 && pressed === "true";
			return `[${ok ? "PASS" : "FAIL"}] show completed — completed task visible=${reappeared > 0}, aria-pressed=${pressed}`;
		});
		await s.shot(page, "05-show-completed");

		s.note("--- session 320 complete ---");
	} finally {
		await s.finish();
	}
});
