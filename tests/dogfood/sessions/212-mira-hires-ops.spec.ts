/**
 * Session 212 — Mira makes Northbound's THIRD hire: an Operations & Growth
 * manager. With Marcus on brand and Priya on the content engine, the
 * bottleneck is now ops — client pipeline upkeep, scheduling, publishing
 * cadence, all still manual founder work. Same in-app funnel as the first
 * two hires (per docs/dogfood/README.md): role brief (Notes) → Candidates
 * pipeline rows (Database board) → interview (Calendar) → scorecard (Notes)
 * → offer → onboarding tasks (Tasks).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira hires an Operations & Growth manager (212)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("212-mira-hires-ops");
	try {
		s.chat(
			SPEAKER.Mira,
			"Hiring day. Marcus owns the brand, Priya owns the research engine — and I'm still the one moving every client card, scheduling every send, chasing every renewal. Northbound's third hire is Operations & Growth. Opening the funnel.",
		);

		// ---- 1. Role brief (Notes) -----------------------------------------
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		await notes
			.locator('[aria-label*="new" i], button:has-text("New")')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1500);
		await notes.keyboard.type("Hiring — Operations & Growth", { delay: 25 });
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(500);
		await notes.keyboard.type(
			"Why now: every client card, calendar slot and renewal chase still routes through me. " +
				"The studio's output doubled since Priya joined; the operations didn't.",
			{ delay: 8 },
		);
		await notes.keyboard.press("Enter");
		await notes.keyboard.type(
			"The role: own the client pipeline end to end, the publishing calendar, and the business cadence. " +
				"Automate every recurring chore the moment it repeats twice.",
			{ delay: 8 },
		);
		await notes.keyboard.press("Enter");
		await notes.keyboard.type(
			"What good looks like: I stop being the studio's scheduler. Renewals fire reminders on their own. " +
				"The pipeline is current without anyone asking.",
			{ delay: 8 },
		);
		await notes.keyboard.press("Enter");
		await notes.keyboard.type(
			"Process: screen on systems thinking, craft trial = design our renewal workflow, offer within a week.",
			{ delay: 8 },
		);
		await notes.waitForTimeout(1200);
		await s.shot(notes, "01-role-brief");

		// ---- 2. Candidates pipeline (Database board) ------------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		const candidates = db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/candidate/i")
			.first();
		await candidates.click().catch(() => undefined);
		await db.waitForTimeout(1500);
		await s.shot(db, "02-candidates-before");

		// Two applicants for the role; "+ New" creates a row.
		for (const name of ["Dana Okafor", "Felix Brandt"]) {
			const newBtn = db.locator('button:has-text("New")').first();
			if (await newBtn.isVisible().catch(() => false)) {
				await newBtn.click().catch(() => undefined);
				await db.waitForTimeout(900);
				await db.keyboard.type(name, { delay: 25 });
				await db.keyboard.press("Enter");
				await db.waitForTimeout(900);
				s.note(`added candidate row: ${name}`);
			} else {
				s.note("no + New button on Candidates");
			}
		}
		await s.shot(db, "03-candidates-with-applicants");

		// ---- 3. Interview event (Calendar) ----------------------------------
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2500);
		const newEvent = cal
			.locator('.app-header [aria-label*="new" i], .app-header button:has-text("+")')
			.first();
		if (await newEvent.isVisible().catch(() => false)) {
			await newEvent.click().catch(() => undefined);
			await cal.waitForTimeout(1000);
			await cal.keyboard.type("Interview — Dana Okafor (Ops & Growth)", { delay: 15 });
			await cal.keyboard.press("Enter").catch(() => undefined);
			await cal.waitForTimeout(1200);
			await s.shot(cal, "04-interview-event");
		} else {
			s.note("no new-event affordance found in Calendar header");
			await s.shot(cal, "04-calendar-no-new");
		}

		// ---- 4. Scorecard (Notes) -------------------------------------------
		const notes2 = await s.openApp(APP.Notes);
		await notes2.waitForTimeout(2000);
		await notes2
			.locator('[aria-label*="new" i], button:has-text("New")')
			.first()
			.click()
			.catch(() => undefined);
		await notes2.waitForTimeout(1500);
		await notes2.keyboard.type("Hiring — Dana Okafor scorecard (ops trial)", { delay: 20 });
		await notes2.keyboard.press("Enter");
		await notes2.keyboard.type(
			"Craft trial: design Northbound's renewal workflow. Dana mapped it as trigger → check → reminder → escalate, " +
				"with the manual fallback documented. Ran the client list against it and found two renewals I'd already missed.",
			{ delay: 8 },
		);
		await notes2.keyboard.press("Enter");
		await notes2.keyboard.type(
			"Systems sense: strong. Asks 'what happens the second time?' about everything. Allergic to repeating herself — good.",
			{ delay: 8 },
		);
		await notes2.keyboard.press("Enter");
		await notes2.keyboard.type(
			"Decision: offer. Felix strong on growth, lighter on systems — keep warm.",
			{
				delay: 8,
			},
		);
		await notes2.waitForTimeout(1200);
		await s.shot(notes2, "05-scorecard");

		// ---- 5. Onboarding cadence (Tasks) ----------------------------------
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2500);
		for (const title of [
			"Send Dana Okafor the offer",
			"Dana day one — hand over the client pipeline",
			"Dana week one — renewal workflow live in Automations",
		]) {
			const add = tasks.locator('[aria-label*="new" i], button:has-text("New")').first();
			if (await add.isVisible().catch(() => false)) {
				await add.click().catch(() => undefined);
				await tasks.waitForTimeout(700);
				await tasks.keyboard.type(title, { delay: 15 });
				await tasks.keyboard.press("Enter");
				await tasks.waitForTimeout(700);
				s.note(`task created: ${title}`);
			}
		}
		await s.shot(tasks, "06-onboarding-tasks");

		s.chat(
			SPEAKER.Mira,
			"Offer out to Dana Okafor — Operations & Growth, hire #3. Craft trial caught two renewals I'd dropped, which rather proves the role. She starts Monday; the pipeline, the publishing calendar and the cadence move off my desk.",
		);
	} finally {
		await s.finish();
	}
});
