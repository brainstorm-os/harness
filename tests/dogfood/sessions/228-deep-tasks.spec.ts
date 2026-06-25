/**
 * Session 228 — deep Tasks walkthrough. A founder-session spec that exercises
 * the Tasks app end-to-end to surface broken features: every sidebar surface
 * (Inbox / Today / Upcoming / Board / Timeline), the New-task compose dialog
 * (name + project + priority + scheduled/due dates → Create), completing a
 * task, opening + editing a task on the detail route, creating a Project and
 * assigning a task to it, FOLLOWING links (project chip / assignee), the
 * "Show completed" toggle, sidebar hide/show, the header object ⋯ menu, a
 * board drag between columns, deletion cleanup, and surface-switch persistence.
 *
 * Each action is judged from observable DOM (task / row counts, dialog
 * open/close, view change, chip text, selected state) and recorded as
 * `[PASS] / [FAIL] / [?] <action> — <observed>` via `s.note()`. Every step is
 * wrapped in try/catch so a single broken affordance never aborts the run;
 * states + failures are screenshotted. This spec only USES the app — it never
 * patches code.
 *
 * Tasks is an imperative-DOM app (`apps/tasks/src/app.ts`), so selectors are
 * the real class / data-attribute hooks the renderer emits:
 *   - sidebar surface rows:   `.tasks-sidebar__row[data-surface="today"]`
 *   - project rows:           `.tasks-sidebar__item[data-project-id]`
 *   - the Projects "+" :       `.tasks-sidebar__heading-add`
 *   - header "New task":       `[aria-label="New task"]`
 *   - compose popover:         `.tasks-compose` (title "New task"; `.bs-select`
 *                              project/priority triggers; `input[type=date]`)
 *   - task rows:               `.task-row[data-task-id]` (+ `data-done`)
 *   - completion toggle:       `.task-row__toggle`
 *   - inline chips:            `.task-row__chip[data-kind="priority|date|project"]`
 *   - object ⋯ menu:           `.task-row__more` / header `.bs-object-menu__more`
 *   - board:                   `.tasks-board` / `.tasks-board__column` / card
 *   - timeline:                `.tasks-timeline` region (aria-label "Timeline")
 *   - detail route:            `.tasks-detail` (host `main[data-detail-open]`)
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep tasks walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-tasks");

	try {
		const page = await s.openApp(APP.Tasks);
		await page.waitForTimeout(2600);

		// A tiny judged-step runner: run `fn`, derive an observation, never throw.
		const step = async (action: string, fn: () => Promise<string>): Promise<void> => {
			try {
				const observed = await fn();
				s.note(observed);
			} catch (error) {
				s.note(`[FAIL] ${action} — threw ${(error as Error).message}`);
			}
		};

		const rowCount = () => page.locator(".task-row").count();
		const cardCount = () => page.locator(".tasks-board__card").count();
		const dialogOpen = () =>
			page
				.locator(".tasks-compose")
				.first()
				.isVisible()
				.catch(() => false);
		const detailOpen = () =>
			page
				.locator('.tasks-main[data-detail-open="true"]')
				.first()
				.isVisible()
				.catch(() => false);
		const headerTitle = () =>
			page
				.locator(".app-header__title")
				.first()
				.innerText()
				.catch(() => "");

		await s.shot(page, "00-launch");
		await step("initial render", async () => {
			const rows = await rowCount();
			const surfaces = await page.locator(".tasks-sidebar__row[data-surface]").count();
			const ok = surfaces >= 5;
			return `[${ok ? "PASS" : "FAIL"}] initial render — ${rows} task rows, ${surfaces} sidebar surfaces, header "${await headerTitle()}"`;
		});

		// ─── 1. Switch every built-in surface; assert the view changed ───────
		const surfaces: Array<{ key: string; label: string; expect: string }> = [
			{ key: "inbox", label: "Inbox", expect: ".tasks-surface" },
			{ key: "today", label: "Today", expect: ".tasks-surface" },
			{ key: "upcoming", label: "Upcoming", expect: ".tasks-surface" },
			{ key: "board", label: "Board", expect: ".tasks-board" },
			{ key: "timeline", label: "Timeline", expect: ".tasks-timeline" },
		];
		for (const surface of surfaces) {
			await step(`switch to ${surface.label}`, async () => {
				await page.locator(`.tasks-sidebar__row[data-surface="${surface.key}"]`).first().click();
				await page.waitForTimeout(700);
				const viewPresent = await page
					.locator(surface.expect)
					.first()
					.isVisible()
					.catch(() => false);
				const title = await headerTitle();
				const titleMatches = title.toLowerCase().includes(surface.label.toLowerCase());
				const ok = viewPresent && titleMatches;
				return `[${ok ? "PASS" : "FAIL"}] switch to ${surface.label} — view "${surface.expect}" visible=${viewPresent}, header="${title}"`;
			});
			await s.shot(page, `01-surface-${surface.key}`);
		}

		// Land back on Inbox for the create/edit flow (no date defaulting).
		await page
			.locator('.tasks-sidebar__row[data-surface="inbox"]')
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(500);

		// ─── 2. New-task dialog: name + project + priority + dates → Create ──
		const uniqueName = `Deep-test task ${Date.now().toString(36)}`;
		const rowsBeforeCreate = await rowCount();

		await step("open New-task dialog", async () => {
			await page.locator('[aria-label="New task"]').first().click();
			await page.waitForTimeout(600);
			const open = await dialogOpen();
			return `[${open ? "PASS" : "FAIL"}] open New-task dialog — compose form visible=${open}`;
		});
		await s.shot(page, "02-compose-open");

		// NOTE the date-field nature: the compose form uses NATIVE `<input
		// type="date">` for Scheduled + Due (per compose-view.ts). Record it.
		await step("inspect compose date inputs", async () => {
			const dateInputs = page.locator(".tasks-compose input[type='date']");
			const n = await dateInputs.count();
			const selects = await page.locator(".tasks-compose .bs-select").count();
			return `[?] inspect compose date inputs — ${n} native <input type=date> (Scheduled+Due are native), ${selects} .bs-select pickers (project+priority)`;
		});

		await step("fill task name", async () => {
			const nameInput = page.locator(".tasks-compose__input").first();
			await nameInput.fill(uniqueName);
			const v = await nameInput.inputValue();
			const ok = v === uniqueName;
			return `[${ok ? "PASS" : "FAIL"}] fill task name — input="${v}"`;
		});

		await step("pick Priority via .bs-select", async () => {
			// Priority is the .bs-select whose value reads a priority label; the
			// project select (when present) precedes it. Open the last .bs-select
			// (priority is appended after the optional project select).
			const triggers = page.locator(".tasks-compose .bs-select");
			const count = await triggers.count();
			if (count === 0) return "[FAIL] pick Priority via .bs-select — no select trigger found";
			await triggers.nth(count - 1).click();
			await page.waitForTimeout(400);
			const option = page.locator(".fm-menu [role='menuitem'], .fm-menu [role='option']").filter({
				hasText: "High priority",
			});
			const had = (await option.count()) > 0;
			if (had) await option.first().click();
			else await page.keyboard.press("Escape");
			await page.waitForTimeout(300);
			const shown = await triggers
				.nth(count - 1)
				.locator(".bs-select__value")
				.innerText()
				.catch(() => "");
			const ok = had && /priority/i.test(shown);
			return `[${ok ? "PASS" : "FAIL"}] pick Priority via .bs-select — option present=${had}, value now "${shown}"`;
		});

		await step("set Scheduled + Due dates", async () => {
			const dateInputs = page.locator(".tasks-compose input[type='date']");
			const n = await dateInputs.count();
			if (n < 2) return `[FAIL] set Scheduled + Due dates — expected 2 date inputs, found ${n}`;
			// Pick a near-future scheduled date and a due a few days later.
			const today = new Date();
			const fmt = (d: Date) =>
				`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			const sched = new Date(today.getTime() + 1 * 86_400_000);
			const due = new Date(today.getTime() + 4 * 86_400_000);
			await dateInputs.nth(0).fill(fmt(sched));
			await dateInputs.nth(1).fill(fmt(due));
			const sv = await dateInputs.nth(0).inputValue();
			const dv = await dateInputs.nth(1).inputValue();
			const ok = sv === fmt(sched) && dv === fmt(due);
			return `[${ok ? "PASS" : "FAIL"}] set Scheduled + Due dates — scheduled="${sv}", due="${dv}"`;
		});
		await s.shot(page, "03-compose-filled");

		await step("click Create — task appears", async () => {
			await page
				.locator(".tasks-compose")
				.locator("xpath=following-sibling::*")
				.locator("button", { hasText: "Create task" })
				.first()
				.click()
				.catch(async () => {
					// Footer lives in the popover, a sibling of the body form; fall
					// back to any visible "Create task" button.
					await page
						.locator("button", { hasText: "Create task" })
						.first()
						.click()
						.catch(() => undefined);
				});
			await page.waitForTimeout(1200);
			const stillOpen = await dialogOpen();
			const appeared = await page.locator(".task-row__name-label", { hasText: uniqueName }).count();
			const ok = !stillOpen && appeared > 0;
			return `[${ok ? "PASS" : "FAIL"}] click Create — dialog closed=${!stillOpen}, "${uniqueName}" rows found=${appeared}, total rows ${await rowCount()} (was ${rowsBeforeCreate})`;
		});
		await s.shot(page, "04-after-create");

		// Locator for the created row (used by later steps).
		const createdRow = () =>
			page
				.locator(".task-row")
				.filter({ has: page.locator(".task-row__name-label", { hasText: uniqueName }) })
				.first();

		// ─── 3. Complete a task — assert done / leaves the active list ───────
		await step("complete the created task", async () => {
			const row = createdRow();
			const present = (await row.count()) > 0;
			if (!present) return "[FAIL] complete the created task — created row not found to complete";
			const toggle = row.locator(".task-row__toggle").first();
			await toggle.click();
			await page.waitForTimeout(900);
			// With "Show completed" off, the row should leave the active list.
			const stillVisible = await page
				.locator(".task-row__name-label", { hasText: uniqueName })
				.count();
			const ok = stillVisible === 0;
			return `[${ok ? "PASS" : "FAIL"}] complete the created task — completed row hidden from active list=${ok} (visible copies: ${stillVisible})`;
		});
		await s.shot(page, "05-after-complete");

		// ─── 4. "Show completed" toggle — completed task reappears ───────────
		await step("toggle Show completed on", async () => {
			const toggle = page.locator(".tasks-surface__toggle", { hasText: "Show completed" }).first();
			const had = (await toggle.count()) > 0;
			if (!had) return "[FAIL] toggle Show completed on — toggle not present on this surface";
			await toggle.click();
			await page.waitForTimeout(700);
			const reappeared = await page.locator(".task-row__name-label", { hasText: uniqueName }).count();
			const pressed = await toggle.getAttribute("aria-pressed");
			const ok = reappeared > 0 && pressed === "true";
			return `[${ok ? "PASS" : "FAIL"}] toggle Show completed on — completed task visible again=${reappeared > 0}, aria-pressed=${pressed}`;
		});
		await s.shot(page, "06-show-completed");

		// Re-open the (completed) task and un-complete it so the rest of the
		// edit/link flow operates on an active task.
		await step("re-open completed task + un-complete", async () => {
			const row = createdRow();
			if ((await row.count()) === 0) return "[FAIL] re-open completed task — row missing";
			await row.locator(".task-row__toggle").first().click();
			await page.waitForTimeout(700);
			const doneAttr = await createdRow()
				.getAttribute("data-done")
				.catch(() => null);
			const ok = doneAttr === "false";
			return `[${ok ? "PASS" : "FAIL"}] re-open completed task + un-complete — data-done now "${doneAttr}"`;
		});

		// ─── 5. Open a task to edit it (detail route) + persist a rename ─────
		await step("open task detail route", async () => {
			const row = createdRow();
			if ((await row.count()) === 0) return "[FAIL] open task detail route — row missing";
			await row.locator(".task-row__name-label").first().click();
			await page.waitForTimeout(900);
			const open = await detailOpen();
			const title = await headerTitle();
			const ok = open && title.includes(uniqueName);
			return `[${ok ? "PASS" : "FAIL"}] open task detail route — detail open=${open}, header title="${title}"`;
		});
		await s.shot(page, "07-detail-open");

		const renamed = `${uniqueName} (edited)`;
		await step("rename task in detail (single-click title)", async () => {
			// In the detail header the title uses single-click-to-edit. The
			// editable name lives in `.tasks-detail__title-group`.
			const titleLabel = page
				.locator(
					".tasks-detail .task-row__name-label, .tasks-detail__title-group .task-row__name-label",
				)
				.first();
			if ((await titleLabel.count()) === 0)
				return "[FAIL] rename task in detail — editable title not found";
			await titleLabel.click();
			await page.waitForTimeout(300);
			const input = page.locator(".tasks-detail input.task-row__name-input").first();
			if ((await input.count()) === 0)
				return "[?] rename task in detail — single-click did not open a rename input";
			await input.fill(renamed);
			await page.keyboard.press("Enter");
			await page.waitForTimeout(800);
			const newTitle = await headerTitle();
			const ok = newTitle.includes("edited");
			return `[${ok ? "PASS" : "FAIL"}] rename task in detail — header title now "${newTitle}"`;
		});
		await s.shot(page, "08-detail-renamed");

		await step("change priority from detail chip", async () => {
			const chip = page.locator('.tasks-detail .task-row__chip[data-kind="priority"]').first();
			if ((await chip.count()) === 0)
				return "[?] change priority from detail chip — no priority chip in detail";
			const before = await chip.innerText().catch(() => "");
			await chip.click();
			await page.waitForTimeout(400);
			const option = page
				.locator(".fm-menu [role='menuitem'], .fm-menu [role='option']")
				.filter({ hasText: "Critical priority" });
			const had = (await option.count()) > 0;
			if (had) await option.first().click();
			else await page.keyboard.press("Escape");
			await page.waitForTimeout(600);
			const after = await page
				.locator('.tasks-detail .task-row__chip[data-kind="priority"]')
				.first()
				.innerText()
				.catch(() => "");
			const ok = had && after !== before;
			return `[${ok ? "PASS" : "FAIL"}] change priority from detail chip — "${before}" → "${after}"`;
		});

		// Close the detail route back to the list before project work.
		await step("close detail route", async () => {
			await page.keyboard.press("Escape");
			await page.waitForTimeout(600);
			let open = await detailOpen();
			if (open) {
				// Fall back to the header back button.
				await page
					.locator('.app-header [aria-label*="Back" i], .app-header button')
					.first()
					.click()
					.catch(() => undefined);
				await page.waitForTimeout(500);
				open = await detailOpen();
			}
			return `[${!open ? "PASS" : "FAIL"}] close detail route — detail open=${open}`;
		});

		// Verify the rename persisted by finding the renamed row in the list.
		await step("rename persisted in list", async () => {
			await page
				.locator('.tasks-sidebar__row[data-surface="inbox"]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(600);
			const found = await page.locator(".task-row__name-label", { hasText: "edited" }).count();
			const ok = found > 0;
			return `[${ok ? "PASS" : "FAIL"}] rename persisted in list — rows with "edited" = ${found}`;
		});

		const editedRow = () =>
			page
				.locator(".task-row")
				.filter({ has: page.locator(".task-row__name-label", { hasText: "edited" }) })
				.first();

		// ─── 6. Create a Project (Projects "+") — assert it appears ──────────
		const projectName = `Deep Project ${Date.now().toString(36)}`;
		const projectsBefore = await page.locator(".tasks-sidebar__item[data-project-id]").count();
		await step("create a project via Projects +", async () => {
			const add = page.locator(".tasks-sidebar__heading-add").first();
			if ((await add.count()) === 0)
				return "[FAIL] create a project — Projects '+' affordance not present";
			await add.click();
			await page.waitForTimeout(600);
			// A new project opens its sidebar row in inline-rename mode.
			const renameInput = page.locator(".tasks-sidebar__rename-input").first();
			const opened = (await renameInput.count()) > 0;
			if (opened) {
				await renameInput.fill(projectName);
				await page.keyboard.press("Enter");
				await page.waitForTimeout(700);
			}
			const projectsAfter = await page.locator(".tasks-sidebar__item[data-project-id]").count();
			const named = await page.locator(".tasks-sidebar__label", { hasText: projectName }).count();
			const ok = projectsAfter > projectsBefore && (named > 0 || opened);
			return `[${ok ? "PASS" : "FAIL"}] create a project — rename input opened=${opened}, projects ${projectsBefore} → ${projectsAfter}, named match=${named}`;
		});
		await s.shot(page, "09-project-created");

		// ─── 7. Assign the edited task to that project (project chip menu) ───
		await step("assign task to the new project", async () => {
			// Go to Inbox so the edited row shows its project chip.
			await page
				.locator('.tasks-sidebar__row[data-surface="inbox"]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(600);
			const row = editedRow();
			if ((await row.count()) === 0) return "[FAIL] assign task to project — edited row not found";
			const chip = row.locator('.task-row__chip[data-kind="project"]').first();
			if ((await chip.count()) === 0) return "[?] assign task to project — no project chip on the row";
			await chip.click();
			await page.waitForTimeout(400);
			const option = page
				.locator(".fm-menu [role='menuitem'], .fm-menu [role='option']")
				.filter({ hasText: projectName });
			const had = (await option.count()) > 0;
			if (had) await option.first().click();
			else await page.keyboard.press("Escape");
			await page.waitForTimeout(800);
			// Switch to the project surface; the task should be listed there.
			await page
				.locator(".tasks-sidebar__label", { hasText: projectName })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(700);
			const inProject = await page.locator(".task-row__name-label", { hasText: "edited" }).count();
			const ok = had && inProject > 0;
			return `[${ok ? "PASS" : "FAIL"}] assign task to project — menu option present=${had}, task in project surface=${inProject > 0}`;
		});
		await s.shot(page, "10-task-in-project");

		// ─── 8. LINKS (priority) — click a project chip, assert navigation ──
		await step("follow project chip link", async () => {
			// On the Inbox surface the project chip carries the project name and a
			// click opens the project menu (the in-app navigation affordance for
			// reassignment). A click MUST do something observable (open a menu).
			await page
				.locator('.tasks-sidebar__row[data-surface="inbox"]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(500);
			const row = editedRow();
			const chip = row.locator('.task-row__chip[data-kind="project"]').first();
			if ((await chip.count()) === 0) return "[?] follow project chip link — no project chip present";
			const beforeUrl = page.url();
			await chip.click();
			await page.waitForTimeout(500);
			const menuOpen = await page
				.locator(".fm-menu")
				.first()
				.isVisible()
				.catch(() => false);
			await page.keyboard.press("Escape").catch(() => undefined);
			const ok = menuOpen || page.url() !== beforeUrl;
			return `[${ok ? "PASS" : "FAIL"}] follow project chip link — menu opened=${menuOpen}, url changed=${page.url() !== beforeUrl}`;
		});

		await step("follow assignee link if present", async () => {
			// Assignee chips (`.task-row__assignee`, e.g. "Priya Nair") appear on
			// rows with an assignee. If one exists, clicking should open / navigate.
			const assignee = page.locator(".task-row__assignee").first();
			const has = (await assignee.count()) > 0;
			if (!has)
				return "[?] follow assignee link — no assignee chip in the current list (nothing to click)";
			const name = await assignee.innerText().catch(() => "");
			const beforeUrl = page.url();
			await assignee.click().catch(() => undefined);
			await page.waitForTimeout(700);
			const menuOpen = await page
				.locator(".fm-menu")
				.first()
				.isVisible()
				.catch(() => false);
			const navigated = page.url() !== beforeUrl;
			// The assignee chip is documented as display-only on the row (editing is
			// in the detail panel) — record what actually happened either way.
			return `[?] follow assignee link — clicked "${name}", menu opened=${menuOpen}, url changed=${navigated} (chip is display-only by design — flag if a click does nothing AND it looks clickable)`;
		});
		await s.shot(page, "11-links");

		// ─── 9. Header ⋯ "More actions" menu — open + click an item ──────────
		await step("open project header ⋯ menu", async () => {
			// Select the project surface so the header carries a project object ⋯.
			await page
				.locator(".tasks-sidebar__label", { hasText: projectName })
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(600);
			const more = page.locator(".app-header .bs-object-menu__more").first();
			if ((await more.count()) === 0) return "[FAIL] open project header ⋯ menu — no ⋯ in header";
			await more.click();
			await page.waitForTimeout(500);
			const menuOpen = await page
				.locator(".fm-menu")
				.first()
				.isVisible()
				.catch(() => false);
			const items = await page.locator(".fm-menu [role='menuitem'], .fm-menu [role='option']").count();
			const expanded = await more.getAttribute("aria-expanded");
			const ok = menuOpen && items > 0;
			return `[${ok ? "PASS" : "FAIL"}] open project header ⋯ menu — open=${menuOpen}, items=${items}, aria-expanded=${expanded}`;
		});
		await s.shot(page, "12-header-menu");
		// Close the menu without destroying the project yet.
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(300);

		await step("open a task row ⋯ menu + click Edit", async () => {
			await page
				.locator('.tasks-sidebar__row[data-surface="inbox"]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(500);
			const row = page.locator(".task-row").first();
			if ((await row.count()) === 0) return "[?] open task row ⋯ menu — no task rows present";
			await row.hover();
			const more = row.locator(".task-row__more").first();
			if ((await more.count()) === 0) return "[FAIL] open task row ⋯ menu — no ⋯ button on the row";
			await more.click();
			await page.waitForTimeout(400);
			const editItem = page
				.locator(".fm-menu [role='menuitem'], .fm-menu [role='option']")
				.filter({ hasText: "Edit" });
			const hadEdit = (await editItem.count()) > 0;
			if (hadEdit) {
				await editItem.first().click();
				await page.waitForTimeout(600);
			}
			const composeOpen = await dialogOpen();
			const ok = hadEdit && composeOpen;
			// Close the edit popover if it opened.
			if (composeOpen) await page.keyboard.press("Escape").catch(() => undefined);
			await page.keyboard.press("Escape").catch(() => undefined);
			return `[${ok ? "PASS" : "FAIL"}] open task row ⋯ menu + click Edit — Edit item present=${hadEdit}, edit popover opened=${composeOpen}`;
		});

		// ─── 10. Board view — drag a card between columns, assert it moved ───
		await step("board drag card between columns", async () => {
			await page.locator('.tasks-sidebar__row[data-surface="board"]').first().click();
			await page.waitForTimeout(800);
			const cols = page.locator(".tasks-board__column");
			const colCount = await cols.count();
			if (colCount < 2)
				return `[?] board drag card — only ${colCount} column(s), nothing to drag between`;
			// Find the first card in any column, and a different target column.
			const card = page.locator(".tasks-board__card").first();
			if ((await card.count()) === 0) return "[?] board drag card — no cards on the board to drag";
			const taskId = await card.getAttribute("data-task-id");
			const sourceColKey = await card
				.locator("xpath=ancestor::section[contains(@class,'tasks-board__column')]")
				.first()
				.getAttribute("data-status-key")
				.catch(() => null);
			// Pick a target column whose status-key differs from the source.
			let targetCol = null as ReturnType<typeof page.locator> | null;
			let targetKey: string | null = null;
			for (let i = 0; i < colCount; i++) {
				const c = cols.nth(i);
				const key = await c.getAttribute("data-status-key");
				if (key && key !== sourceColKey) {
					targetCol = c;
					targetKey = key;
					break;
				}
			}
			if (!targetCol) return "[?] board drag card — no distinct target column found";
			const before = await cardCount();
			// HTML5 DnD is finicky under Playwright; dragTo is the best-effort path.
			await card.dragTo(targetCol).catch(() => undefined);
			await page.waitForTimeout(900);
			const movedCard = page.locator(`.tasks-board__card[data-task-id="${taskId}"]`).first();
			const movedKey = await movedCard
				.locator("xpath=ancestor::section[contains(@class,'tasks-board__column')]")
				.first()
				.getAttribute("data-status-key")
				.catch(() => null);
			const after = await cardCount();
			const ok = movedKey === targetKey;
			return `[${ok ? "PASS" : "?"}] board drag card between columns — moved "${sourceColKey}"→"${movedKey}" (wanted "${targetKey}"); cards ${before}→${after} (HTML5 DnD can be flaky under Playwright — flag only if repeatedly stuck)`;
		});
		await s.shot(page, "13-board-after-drag");

		// ─── 11. Sidebar hide / show ─────────────────────────────────────────
		await step("hide then show sidebar", async () => {
			const toggle = page
				.locator('.app-header [aria-label="Hide sidebar"], .app-header [aria-label="Show sidebar"]')
				.first();
			if ((await toggle.count()) === 0)
				return "[FAIL] hide/show sidebar — no sidebar toggle in header";
			const main = page.locator(".tasks-main").first();
			await toggle.click();
			await page.waitForTimeout(500);
			const afterHide = await main.getAttribute("data-nav-open");
			await page
				.locator('.app-header [aria-label="Hide sidebar"], .app-header [aria-label="Show sidebar"]')
				.first()
				.click();
			await page.waitForTimeout(500);
			const afterShow = await main.getAttribute("data-nav-open");
			const ok = afterHide === "false" && afterShow === "true";
			return `[${ok ? "PASS" : "FAIL"}] hide then show sidebar — data-nav-open hide="${afterHide}", show="${afterShow}"`;
		});
		await s.shot(page, "14-sidebar-toggled");

		// ─── 12. Persistence — switch surfaces and back, task survives ───────
		await step("persistence across surface switch", async () => {
			await page.locator('.tasks-sidebar__row[data-surface="today"]').first().click();
			await page.waitForTimeout(500);
			await page.locator('.tasks-sidebar__row[data-surface="inbox"]').first().click();
			await page.waitForTimeout(600);
			const found = await page.locator(".task-row__name-label", { hasText: "edited" }).count();
			// Project should also still exist in the sidebar.
			const projectStill = await page
				.locator(".tasks-sidebar__label", { hasText: projectName })
				.count();
			const ok = found > 0 && projectStill > 0;
			return `[${ok ? "PASS" : "FAIL"}] persistence across surface switch — edited task rows=${found}, project still listed=${projectStill > 0}`;
		});

		// ─── 13. Cleanup — delete the test task + project, assert removal ────
		await step("delete the test task", async () => {
			const row = editedRow();
			if ((await row.count()) === 0)
				return "[?] delete the test task — edited row not found (already gone?)";
			await row.hover();
			const more = row.locator(".task-row__more").first();
			if ((await more.count()) === 0) return "[FAIL] delete the test task — no ⋯ on row";
			await more.click();
			await page.waitForTimeout(400);
			const del = page
				.locator(".fm-menu [role='menuitem'], .fm-menu [role='option']")
				.filter({ hasText: "Delete" });
			const had = (await del.count()) > 0;
			if (had) {
				await del.first().click();
				await page.waitForTimeout(800);
			} else {
				await page.keyboard.press("Escape");
			}
			const remaining = await page.locator(".task-row__name-label", { hasText: "edited" }).count();
			const ok = had && remaining === 0;
			return `[${ok ? "PASS" : "FAIL"}] delete the test task — Delete item present=${had}, remaining "edited" rows=${remaining}`;
		});
		await s.shot(page, "15-task-deleted");

		await step("delete the test project", async () => {
			const projectRow = page
				.locator(".tasks-sidebar__item[data-project-id]")
				.filter({ has: page.locator(".tasks-sidebar__label", { hasText: projectName }) })
				.first();
			if ((await projectRow.count()) === 0)
				return "[?] delete the test project — project row not found (already gone?)";
			await projectRow.hover();
			const more = projectRow.locator(".tasks-sidebar__more").first();
			if ((await more.count()) === 0) return "[FAIL] delete the test project — no ⋯ on project row";
			await more.click();
			await page.waitForTimeout(400);
			const del = page
				.locator(".fm-menu [role='menuitem'], .fm-menu [role='option']")
				.filter({ hasText: "Delete" });
			const had = (await del.count()) > 0;
			if (had) {
				await del.first().click();
				await page.waitForTimeout(800);
			} else {
				await page.keyboard.press("Escape");
			}
			const remaining = await page.locator(".tasks-sidebar__label", { hasText: projectName }).count();
			const ok = had && remaining === 0;
			return `[${ok ? "PASS" : "FAIL"}] delete the test project — Delete item present=${had}, remaining project rows=${remaining}`;
		});
		await s.shot(page, "16-project-deleted");

		s.note("--- session 228 complete ---");
	} finally {
		await s.finish();
	}
});
