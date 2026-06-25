/**
 * Session 213 — Dana Okafor's day one as Northbound's Operations & Growth
 * manager. Her brief: take the pipeline, the publishing calendar and the
 * cadence off Mira's desk — and automate anything that repeats. Day one is
 * a working tour with her lens on: the Clients CRM, the week's cadence,
 * and Automations (can she wire the renewal-reminder chain from her craft
 * trial?).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Dana's day one — pipeline, cadence, automations (213)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("213-dana-day-one");
	try {
		s.chat(
			SPEAKER.Dana,
			"Day one. Mira walked me through the hub doc; my read of the job: the pipeline, the calendar and the cadence should run without her. First pass: see what's manual today, automate the first repeat.",
		);

		// ---- The Clients CRM: the pipeline she now owns ----------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		await db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/^clients$/i")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1500);
		await s.shot(db, "01-clients-crm");
		const clientRows = await db
			.locator(".dbv-grid__title-label, [data-entity-id]")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`clients: ${JSON.stringify(clientRows.slice(0, 8))}`);

		// ---- The week's cadence ----------------------------------------------
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2500);
		await s.shot(tasks, "02-cadence-today");
		// Her own first task, created her way: one chore captured immediately.
		const add = tasks.locator('[aria-label*="new" i], button:has-text("New")').first();
		if (await add.isVisible().catch(() => false)) {
			await add.click().catch(() => undefined);
			await tasks.waitForTimeout(700);
			await tasks.keyboard.type("Ops audit — list every chore Mira does twice a week", { delay: 12 });
			await tasks.keyboard.press("Enter");
			await tasks.waitForTimeout(800);
			s.note("created Dana's ops-audit task");
		}

		// ---- Automations: the surface she was hired to live in ---------------
		const auto = await s.openApp(APP.Automations);
		await auto.waitForTimeout(3000);
		await s.shot(auto, "03-automations-open");
		const headerButtons = await auto
			.locator(".app-header button")
			.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim()))
			.catch(() => [] as unknown[]);
		s.note(`automations header: ${JSON.stringify(headerButtons)}`);
		// Reminder quick-capture (11b.12) — the renewal chain starts as one.
		const newReminder = auto
			.locator('button:has-text("Reminder"), [aria-label*="reminder" i], button:has-text("New")')
			.first();
		if (await newReminder.isVisible().catch(() => false)) {
			await newReminder.click().catch(() => undefined);
			await auto.waitForTimeout(900);
			await s.shot(auto, "04-reminder-capture");
			await auto.keyboard
				.type("Renewal check — Beacon Analytics (30 days out)", { delay: 12 })
				.catch(() => undefined);
			await auto.waitForTimeout(500);
			await s.shot(auto, "05-reminder-typed");
			// Commit with whatever the dialog offers.
			const confirm = auto
				.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Add")')
				.first();
			if (await confirm.isVisible().catch(() => false)) {
				await confirm.click().catch(() => undefined);
				await auto.waitForTimeout(1200);
				s.note("reminder committed");
			} else {
				await auto.keyboard.press("Enter").catch(() => undefined);
				await auto.waitForTimeout(1000);
				s.note("reminder committed via Enter (no explicit confirm button)");
			}
			await s.shot(auto, "06-after-reminder");
		} else {
			s.note("no reminder/new affordance visible in Automations");
		}
		// The runs view — her audit trail (11b.13).
		const runsTab = auto
			.locator('button:has-text("Runs"), [role="tab"]:has-text("Runs"), [aria-label*="runs" i]')
			.first();
		if (await runsTab.isVisible().catch(() => false)) {
			await runsTab.click().catch(() => undefined);
			await auto.waitForTimeout(1000);
			await s.shot(auto, "07-runs-view");
		} else {
			s.note("no Runs view affordance found");
		}

		// ---- Calendar: the publishing cadence she now owns --------------------
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2500);
		await s.shot(cal, "08-publishing-calendar");

		s.chat(
			SPEAKER.Dana,
			"Day-one read: the pipeline data is solid and the calendar is honest. The renewal chain starts as a reminder today and becomes a workflow the week the trigger fires twice. Audit task is on the board — by Friday I want the list of everything this studio does by hand.",
		);
	} finally {
		await s.finish();
	}
});
