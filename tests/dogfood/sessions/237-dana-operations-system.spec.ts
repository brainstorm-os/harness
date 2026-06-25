/**
 * Session 237 — Dana systematizes Northbound's operations (product-artifact turn).
 *
 * Dana (ops & growth) does what her lens points at: turn the recurring chores
 * into a SYSTEM. On the persistent vault she builds:
 *   1. a "Northbound Operations" playbook note that documents the operating
 *      rhythm and TRANSCLUDES the surfaces it operates (Priya's evidence brief,
 *      Mira's HQ hub) — the operating doc threaded across app seams;
 *   2. the recurring operational chores as Tasks (the cadence);
 *   3. a publishing event in the Calendar (the rhythm on the calendar);
 *   4. an actual wired operation in Automations — a workflow from a template
 *      and a captured reminder (her core surface, exercised for real).
 *
 * The Notes playbook + Tasks are the guaranteed artifact; Calendar + Automations
 * are wrapped best-effort so any friction there is surfaced, not fatal.
 *
 * Title input goes through `keyboard.insertText` (one atomic event) rather than
 * per-char `type` — the title lives in the Lexical editor, so per-char typing
 * right after New-note raced the binding and dropped leading chars (F-248).
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const NOTE_TYPE = "io.brainstorm.notes/Note/v1";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	insertTransclusion: (entityId: string, entityType: string, label: string) => Promise<void>;
	currentNoteId: () => string | null;
};

function devId(notes: Page): Promise<string | null> {
	return notes.evaluate(() => {
		const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
		return dev?.currentNoteId() ?? null;
	});
}

async function newNote(notes: Page, title: string, body: string[]): Promise<string | null> {
	await notes.locator('[aria-label="New note"]').first().click();
	await notes.waitForTimeout(1600); // let the editor fully mount before input
	// Atomic insertion — avoids the per-keystroke Lexical binding race (F-248).
	await notes.keyboard.insertText(title);
	await notes.waitForTimeout(500);
	await notes
		.evaluate(async (paras) => {
			const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
			if (!dev) return;
			for (const p of paras) await dev.appendParagraph(p);
		}, body)
		.catch(() => undefined);
	await notes.waitForTimeout(500);
	return devId(notes);
}

async function openByTitle(notes: Page, title: string): Promise<string | null> {
	const row = notes.locator(".notes__sidebar-item", { hasText: title }).first();
	if ((await row.count()) === 0) return null;
	await row.click();
	await notes.waitForTimeout(900);
	return devId(notes);
}

test("Dana systematizes Northbound operations (playbook + cadence + calendar + automation)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("237-dana-operations-system");
	s.chat(
		SPEAKER.Dana,
		"Three people now and the chores are starting to repeat — that's my cue. I'm turning the operating rhythm into a system: one playbook that documents it, the recurring work on a cadence, the publishing date on the calendar, and the renewal nudge wired as an actual reminder so nobody has to remember it.",
	);
	try {
		// ── 1. Operations playbook (Notes) ────────────────────────────────
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const briefId = await openByTitle(notes, "evidence base");
		const hubId = await openByTitle(notes, "Northbound HQ");
		s.note(`briefId=${briefId} hubId=${hubId}`);

		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1600);
		await notes.keyboard.insertText("Northbound Operations — the system");
		await notes.waitForTimeout(500);

		const composed = await notes
			.evaluate(
				async ({ briefId, hubId, noteType }) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					await dev.appendParagraph(
						"How Northbound runs itself — the recurring operations, owned and scheduled.",
					);
					await dev.appendParagraph("Publishing cadence");
					await dev.appendParagraph(
						"One issue per week. Draft by Wednesday, edit Thursday, ship Friday. The ship date lives on the Calendar; the draft work lives in Tasks.",
					);
					await dev.appendParagraph("Renewal chain");
					await dev.appendParagraph(
						"Advisory renewals get a reminder 14 days out and a checklist task. No renewal is ever tracked only in someone's head.",
					);
					await dev.appendParagraph("Pipeline hygiene");
					await dev.appendParagraph(
						"Weekly: every Client row has a current stage and a next action. Stale rows get surfaced, not buried.",
					);
					await dev.appendParagraph("What this operates");
					if (hubId) await dev.insertTransclusion(hubId, noteType, "Northbound HQ");
					if (briefId) await dev.insertTransclusion(briefId, noteType, "Evidence base");
					return true;
				},
				{ briefId, hubId, noteType: NOTE_TYPE },
			)
			.catch(() => false);
		const playbookTitle =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const transclusions = await notes.locator(".notes__transclusion").count();
		s.note(`playbook composed=${composed} title="${playbookTitle}" transclusions=${transclusions}`);
		await s.shot(notes, "01-playbook");

		// ── 2. Operational cadence (Tasks) ────────────────────────────────
		const chores = [
			"Ship this week's issue (Friday)",
			"Renewal check — advisory clients (14-day window)",
			"Weekly pipeline hygiene review",
		];
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1200);
		let madeTasks = 0;
		for (const name of chores) {
			try {
				await tasks.locator('[aria-label="New task"]').first().click();
				await tasks.waitForTimeout(500);
				await tasks.locator(".tasks-compose__input").first().fill(name);
				await tasks.waitForTimeout(200);
				await tasks
					.locator("button", { hasText: "Create task" })
					.first()
					.click()
					.catch(() => undefined);
				await tasks.waitForTimeout(800);
				if ((await tasks.locator(".task-row__name-label", { hasText: name.slice(0, 14) }).count()) > 0)
					madeTasks += 1;
			} catch {
				/* one stuck compose shouldn't drop the rest */
			}
		}
		s.note(`operational tasks created: ${madeTasks}/${chores.length}`);
		await s.shot(tasks, "02-tasks");

		// ── 3. Publishing rhythm on the Calendar (best-effort) ────────────
		try {
			const cal = await s.openApp(APP.Calendar);
			await cal.waitForTimeout(1500);
			await cal
				.locator('.cal-toolbar__new, [aria-label="New event"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(700);
			const titleField = cal
				.locator('.cal-detail__input--title, .cal-detail [aria-label="Title"]')
				.first();
			await titleField.fill("Ship Issue #1").catch(() => undefined);
			const dt = cal.locator('.cal-detail__field input[type="datetime-local"]').first();
			if ((await dt.count()) > 0) {
				const d = new Date();
				d.setDate(d.getDate() + 3);
				d.setHours(9, 0, 0, 0);
				const pad = (n: number) => String(n).padStart(2, "0");
				const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
				await dt.fill(local).catch(() => undefined);
			}
			await s.shot(cal, "03-calendar-dialog");
			await cal
				.locator('.cal-detail [data-bs-primary], .cal-detail button:has-text("Save")')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(900);
			const chip = await cal.locator(".cal-chip", { hasText: "Ship Issue" }).count();
			s.note(`calendar event "Ship Issue #1" chips=${chip}`);
			await s.shot(cal, "04-calendar");
		} catch (e) {
			s.note(`calendar step skipped: ${(e as Error).message}`);
		}

		// ── 4. Wire the operation in Automations (best-effort) ────────────
		try {
			const au = await s.openApp(APP.Automations);
			await au.waitForTimeout(1500);
			await s.shot(au, "05-automations");

			// Add a workflow from a template.
			let workflowAdded = false;
			try {
				await au.locator(".au-toolbar button:has-text('New from template')").first().click();
				await au.waitForTimeout(700);
				const addBtn = au.locator("button:has-text('Add')").first();
				if ((await addBtn.count()) > 0) {
					await addBtn.click().catch(() => undefined);
					await au.waitForTimeout(800);
					workflowAdded = true;
				} else {
					await au.keyboard.press("Escape").catch(() => undefined);
				}
			} catch {
				/* template gallery undriveable — observed below */
			}
			s.note(`automations workflow from template: added=${workflowAdded}`);
			await s.shot(au, "06-automations-workflow");

			// Capture a renewal reminder.
			let reminderCaptured = false;
			try {
				await au.locator('.au-tab:has-text("Reminders")').first().click();
				await au.waitForTimeout(600);
				const subject = au.locator(".au-capture input, .au-capture textarea").first();
				if ((await subject.count()) > 0) {
					await subject.fill("Renewal nudge — advisory clients (14-day window)");
					await au.waitForTimeout(200);
					await au
						.locator(".au-capture button:has-text('Add reminder')")
						.first()
						.click()
						.catch(() => undefined);
					await au.waitForTimeout(800);
					reminderCaptured = true;
				}
			} catch {
				/* capture surface undriveable — observed below */
			}
			s.note(`automations reminder captured: ${reminderCaptured}`);
			await s.shot(au, "07-automations-reminders");
		} catch (e) {
			s.note(`automations step skipped: ${(e as Error).message}`);
		}

		s.chat(
			SPEAKER.Dana,
			"Operations are a system now, not a memory test: the playbook documents the rhythm and points at what it runs, the recurring work is on the cadence, the ship date's on the calendar, and the renewal nudge is wired. That's the kind of thing I never want to think about twice.",
		);

		expect(playbookTitle, "the operations playbook is titled").toMatch(/Operations/i);
	} finally {
		await s.finish();
	}
});
