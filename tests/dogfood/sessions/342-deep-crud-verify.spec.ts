/**
 * Session 342 — deep CRUD verify ("functionality that doesn't work").
 *
 * The happy-path specs each verify one flow; the sweeps (321/328/340) exercise
 * chrome (menus open/close, buttons have an effect, apps render clean). This
 * session goes after the next layer the founder keeps hitting by hand: the
 * PRIMARY data action of each core app actually does its job end to end —
 *   - the create affordance creates a real object,
 *   - typed text lands and survives,
 *   - the new object shows up where it should,
 *   - with ZERO console errors during the interaction.
 *
 * Each app runs in a try/guard so a missing affordance is RECORDED, not thrown —
 * the run completes the whole tour and prints a single RESULT block listing every
 * app whose core action is broken. Selectors are the ones the focused sessions
 * (004/005/014/015/038) already proved against the real shell.
 */

import { type Page, test } from "@playwright/test";
import { APP, type AppId, type FounderSession, startSession } from "../lib/founder";
import { appInteractive, collectConsoleErrors } from "../lib/invariants";

type Finding = { app: string; problem: string };

async function firstVisible(page: Page, selector: string, timeout = 4000): Promise<boolean> {
	const loc = page.locator(selector).first();
	try {
		await loc.waitFor({ state: "visible", timeout });
		return true;
	} catch {
		return false;
	}
}

test("deep CRUD verify — primary data action of each core app (342)", async () => {
	test.setTimeout(2_400_000);
	const s = await startSession("342-deep-crud-verify");
	await s.app.evaluate(({ dialog }) => {
		dialog.showOpenDialog = (async () => ({
			canceled: true,
			filePaths: [],
		})) as typeof dialog.showOpenDialog;
		dialog.showSaveDialog = (async () => ({
			canceled: true,
			filePath: undefined,
		})) as typeof dialog.showSaveDialog;
	});

	const findings: Finding[] = [];
	const record = (app: string, problem: string) => {
		findings.push({ app, problem });
		s.note(`  [BROKEN] ${problem}`);
	};

	const open = async (
		id: AppId,
		name: string,
	): Promise<{ page: Page; errs: { errors: string[] } } | null> => {
		s.note(`\n## ${name}`);
		try {
			const page = await s.openApp(id);
			page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
			page.setDefaultTimeout(3500);
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(1800);
			return { page, errs };
		} catch (error) {
			record(name, `${name}: did not open — ${(error as Error).message}`);
			return null;
		}
	};

	const closeAndReport = async (page: Page, errs: { errors: string[] }, name: string) => {
		if (errs.errors.length > 0) {
			s.note(`  [?] ${name} console errors (${errs.errors.length}): ${errs.errors[0]}`);
			record(name, `${name}: ${errs.errors.length} console error(s) — ${errs.errors[0]}`);
		}
		if (!(await appInteractive(page)))
			record(name, `${name}: app left non-interactive (overlay trap)`);
		await page.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(250).catch(() => undefined);
	};

	try {
		// ── Notes: create a note, type a title, verify it lands ──────────────
		{
			const o = await open(APP.Notes, "Notes");
			if (o) {
				const { page, errs } = o;
				if (!(await firstVisible(page, '[aria-label="New note"]'))) {
					record("Notes", "Notes: no 'New note' affordance");
				} else {
					const clicked = await page
						.locator('[aria-label="New note"]')
						.first()
						.click({ timeout: 3000 })
						.then(() => true)
						.catch(() => false);
					if (!clicked) record("Notes", "Notes: 'New note' button click hangs / does not complete");
					await page.waitForTimeout(900);
					const title = `Northbound Q3 plan ${Date.now() % 100000}`;
					await page.keyboard.type(title, { delay: 12 });
					await page.waitForTimeout(700);
					await s.shot(page, "notes-created");
					const titleText =
						(await page
							.locator(".notes__title")
							.first()
							.textContent()
							.catch(() => "")) ?? "";
					if (!titleText.includes(title.slice(0, 12))) {
						record("Notes", `Notes: typed title didn't land (title reads "${titleText.slice(0, 40)}")`);
					}
				}
				await closeAndReport(page, errs, "Notes");
			}
		}

		// ── Tasks: create a task via the header +, verify the row appears ────
		{
			const o = await open(APP.Tasks, "Tasks");
			if (o) {
				const { page, errs } = o;
				if (!(await firstVisible(page, '[aria-label="New task"]'))) {
					record("Tasks", "Tasks: no 'New task' affordance");
				} else {
					const clicked = await page
						.locator('[aria-label="New task"]')
						.first()
						.click({ timeout: 3000 })
						.then(() => true)
						.catch(() => false);
					if (!clicked) record("Tasks", "Tasks: 'New task' button click hangs / does not complete");
					await page.waitForTimeout(700);
					const composer = page.locator('input:focus, [contenteditable="true"]:focus').first();
					const taskName = `Ship pricing page ${Date.now() % 100000}`;
					if ((await composer.count().catch(() => 0)) === 0) {
						record("Tasks", "Tasks: New-task button opened no focused composer");
					} else {
						await composer.type(taskName, { delay: 12 });
						await page.keyboard.press("Enter");
						await page.waitForTimeout(900);
						await s.shot(page, "tasks-created");
						const got = await page
							.locator(`text=${taskName.slice(0, 18)}`)
							.count()
							.catch(() => 0);
						if (got === 0) record("Tasks", "Tasks: created task does not appear in the list");
					}
				}
				await closeAndReport(page, errs, "Tasks");
			}
		}

		// ── Database: open Clients, add a row, name it, verify ───────────────
		{
			const o = await open(APP.Database, "Database");
			if (o) {
				const { page, errs } = o;
				const clients = page
					.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
					.first();
				if ((await clients.count().catch(() => 0)) > 0) {
					await clients.click().catch(() => undefined);
					await page.waitForTimeout(800);
				}
				await s.shot(page, "database-grid");
				const addRow = page.locator("#toolbar-new").first();
				if ((await addRow.count().catch(() => 0)) === 0) {
					record("Database", "Database: no add-row affordance (#toolbar-new) on the grid");
				} else {
					const before = await page
						.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
						.count()
						.catch(() => 0);
					await addRow.click().catch(() => undefined);
					await page.waitForTimeout(900);
					const after = await page
						.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
						.count()
						.catch(() => 0);
					if (after <= before)
						record("Database", `Database: add-row did not add a row (${before}→${after})`);
					await s.shot(page, "database-row-added");
				}
				await closeAndReport(page, errs, "Database");
			}
		}

		// ── Journal: type into today's body, verify word count moves ─────────
		{
			const o = await open(APP.Journal, "Journal");
			if (o) {
				const { page, errs } = o;
				const body = page
					.locator('.journal__entry-editor, .journal__entry-body [contenteditable="true"]')
					.first();
				if ((await body.count().catch(() => 0)) === 0) {
					record("Journal", "Journal: no editable body");
				} else {
					await body.click().catch(() => undefined);
					await page.waitForTimeout(400);
					await page.keyboard.type("Pipeline is looking healthy after two closed deals.", { delay: 10 });
					await page.waitForTimeout(800);
					await s.shot(page, "journal-typed");
					const bodyText = (await body.textContent().catch(() => "")) ?? "";
					if (!/pipeline is looking healthy/i.test(bodyText)) {
						record(
							"Journal",
							`Journal: typed body text did not land (body reads "${bodyText.slice(0, 40)}")`,
						);
					}
				}
				await closeAndReport(page, errs, "Journal");
			}
		}

		// ── Calendar: create an event, verify it lands ───────────────────────
		{
			const o = await open(APP.Calendar, "Calendar");
			if (o) {
				const { page, errs } = o;
				const newBtn = page.locator('.cal-toolbar__new, [aria-label="New event"]').first();
				if ((await newBtn.count().catch(() => 0)) === 0) {
					record("Calendar", "Calendar: no 'New event' affordance");
				} else {
					await newBtn.click().catch(() => undefined);
					await page.waitForTimeout(700);
					const title = page.locator('.cal-detail__input--title, [aria-label="Event title"]').first();
					if ((await title.count().catch(() => 0)) === 0) {
						record("Calendar", "Calendar: New-event opened no title field");
					} else {
						await title.fill("Vertex Labs — intro call").catch(() => undefined);
						const save = page.locator("[data-bs-primary]").first();
						await save.click().catch(() => undefined);
						await page.waitForTimeout(900);
						// Month cells collapse overflow under "+2 more", hiding a new same-day
						// event — verify on the Agenda view, which lists every event in full.
						await page
							.locator('.cal-view-tabs button, [role="tab"]', { hasText: /Agenda/i })
							.first()
							.click()
							.catch(() => undefined);
						await page.waitForTimeout(800);
						await s.shot(page, "calendar-event");
						const got = await page
							.locator("text=/Vertex Labs/i")
							.count()
							.catch(() => 0);
						if (got === 0) record("Calendar", "Calendar: created event does not appear in Agenda");
					}
				}
				await closeAndReport(page, errs, "Calendar");
			}
		}

		// ── Contacts: create a contact, verify ───────────────────────────────
		{
			const o = await open(APP.Contacts, "Contacts");
			if (o) {
				const { page, errs } = o;
				const newBtn = page
					.locator('[aria-label="New contact"], [aria-label="Add contact"], .contacts__new')
					.first();
				if ((await newBtn.count().catch(() => 0)) === 0) {
					record("Contacts", "Contacts: no 'New contact' affordance");
				} else {
					const before = await page
						.locator(".contacts-list__row, [data-entity-id]")
						.count()
						.catch(() => 0);
					await newBtn.click().catch(() => undefined);
					await page.waitForTimeout(900);
					await s.shot(page, "contacts-new");
					const after = await page
						.locator(".contacts-list__row, [data-entity-id]")
						.count()
						.catch(() => 0);
					if (after <= before) {
						// Some apps open a detail/composer rather than inserting a row first.
						const composer = page.locator('input:focus, [contenteditable="true"]:focus').first();
						if ((await composer.count().catch(() => 0)) === 0) {
							record(
								"Contacts",
								`Contacts: New-contact added no row and opened no composer (${before}→${after})`,
							);
						}
					}
				}
				await closeAndReport(page, errs, "Contacts");
			}
		}

		// ── Bookmarks: add a bookmark, verify it lands ───────────────────────
		{
			const o = await open(APP.Bookmarks, "Bookmarks");
			if (o) {
				const { page, errs } = o;
				if (!(await firstVisible(page, '[aria-label="Add bookmark"]'))) {
					record("Bookmarks", "Bookmarks: no 'Add bookmark' affordance");
				} else {
					await page
						.locator('[aria-label="Add bookmark"]')
						.first()
						.click({ timeout: 3000 })
						.catch(() =>
							record("Bookmarks", "Bookmarks: 'Add bookmark' click hangs / does not complete"),
						);
					await page.waitForTimeout(600);
					const url = page.locator(".bookmarks__form-input").first();
					if ((await url.count().catch(() => 0)) === 0) {
						record("Bookmarks", "Bookmarks: Add-bookmark opened no URL field");
					} else {
						await url.type("https://example.com/research/through-line", { delay: 8 });
						const submit = page.locator('[role="dialog"] [data-bs-primary]').first();
						await submit.click().catch(() => undefined);
						await page.waitForTimeout(1200);
						await s.shot(page, "bookmarks-added");
						const got = await page
							.locator("text=/example\\.com|through-line/i")
							.count()
							.catch(() => 0);
						if (got === 0) record("Bookmarks", "Bookmarks: added bookmark does not appear");
					}
				}
				await closeAndReport(page, errs, "Bookmarks");
			}
		}

		// ── Files: just render + console-clean (create path is dialog-bound) ─
		{
			const o = await open(APP.Files, "Files");
			if (o) {
				const { page, errs } = o;
				await s.shot(page, "files-main");
				await closeAndReport(page, errs, "Files");
			}
		}

		s.note(
			`\n## RESULT: ${findings.length === 0 ? "ALL CORE ACTIONS WORK" : `${findings.length} broken`}`,
		);
		for (const f of findings) s.note(`  - ${f.problem}`);
	} finally {
		await s.finish();
	}
});
