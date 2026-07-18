/**
 * Session 907 — rebuilding Northbound, part 1: people + cadence.
 *
 * The June vault reset erased the company (owner call 2026-07-18: rebuild it,
 * and never let it be wiped again). Mira re-enters the team and client
 * contacts, restores this week's deliverables in Tasks, and writes today's
 * journal entry. Idempotent: anything already present is skipped.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const PEOPLE: Array<{ name: string; company: string; email: string; phone?: string }> = [
	{ name: "Marcus Lee", company: "Northbound", email: "marcus@getnorthbound.com" },
	{ name: "Priya Nair", company: "Northbound", email: "priya@getnorthbound.com" },
	{ name: "Dana Okafor", company: "Northbound", email: "dana@getnorthbound.com" },
	{ name: "Sol Reyes", company: "Northbound", email: "sol@getnorthbound.com" },
	{ name: "Elena Vogel", company: "Vertex Labs", email: "elena.vogel@vertexlabs.io", phone: "+49 30 555 0182" },
	{ name: "Tom Askey", company: "Acme Analytics", email: "tom@acmeanalytics.com" },
	{ name: "Rina Patel", company: "Halcyon Research", email: "rina@halcyon.dev" },
];

const TASKS = [
	"Issue #8 — final edit pass",
	"Send Vertex Labs the Q3 proposal",
	"Renewal outreach — Beacon Ventures",
	"Q3 advisory pipeline review",
	"Publish Issue #8",
];

test("rebuild Northbound — people, tasks, journal (907)", async () => {
	test.setTimeout(540_000);
	const s = await startSession("907-rebuild-people-cadence");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(2000);
		s.chat(SPEAKER.Mira, "Rebuild day. Re-entering the team + client contacts, this week's deliverables, and the daily log. The CRM lists come next.");

		// ---- Contacts ------------------------------------------------------
		const contacts = await s.openApp(APP.Contacts);
		await contacts.waitForTimeout(2500);
		let created = 0;
		for (const p of PEOPLE) {
			const exists = (await contacts.locator(`.contacts-list__row, [class*="contacts"]`, { hasText: p.name }).count().catch(() => 0)) > 0;
			if (exists) {
				s.note(`[contacts] ${p.name} already present — skipped`);
				continue;
			}
			try {
				await contacts.locator('[data-testid="contacts-new"]').click();
				await contacts.waitForTimeout(400);
				const dialog = contacts.locator('[data-testid="contacts-compose"]');
				const fields = dialog.locator("input");
				await dialog.locator('[data-testid="contacts-compose-name"]').fill(p.name);
				const n = await fields.count();
				if (n >= 2) await fields.nth(1).fill(p.company);
				if (n >= 3) await fields.nth(2).fill(p.email);
				if (p.phone && n >= 4) await fields.nth(3).fill(p.phone);
				await dialog.locator('[data-testid="contacts-compose-create"]').click();
				await contacts.waitForTimeout(600);
				created++;
			} catch (e) {
				s.note(`[contacts] failed on ${p.name}: ${String(e).slice(0, 150)}`);
			}
		}
		s.note(`[contacts] created ${created} contacts (of ${PEOPLE.length} wanted)`);
		await s.shot(contacts, "contacts-rebuilt");
		await contacts.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ---- Tasks -----------------------------------------------------------
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(3000);
		let madeTasks = 0;
		for (const title of TASKS) {
			const exists = (await tasks.locator(".task-row__name", { hasText: title }).count().catch(() => 0)) > 0;
			if (exists) {
				s.note(`[tasks] "${title}" already present — skipped`);
				continue;
			}
			try {
				await tasks.locator(".tasks-header__action").first().click();
				await tasks.waitForTimeout(500);
				const input = tasks.locator(".tasks-compose__input, [class*='compose'] input").first();
				if ((await input.count()) === 0) {
					s.note(`[tasks] compose opened but no input found for "${title}"`);
					await s.shot(tasks, "tasks-compose-unknown");
					await tasks.keyboard.press("Escape").catch(() => undefined);
					break;
				}
				await input.fill(title);
				await s.shot(tasks, `tasks-compose-${madeTasks}`);
				await input.press("Enter");
				await tasks.waitForTimeout(700);
				madeTasks++;
			} catch (e) {
				s.note(`[tasks] failed on "${title}": ${String(e).slice(0, 150)}`);
			}
		}
		s.note(`[tasks] created ${madeTasks} tasks (of ${TASKS.length} wanted)`);
		await s.shot(tasks, "tasks-rebuilt");
		await tasks.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ---- Journal ---------------------------------------------------------
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(2500);
		try {
			const editor = journal.locator('[contenteditable="true"]').first();
			await editor.click();
			await journal.keyboard.press("Meta+A");
			await journal.keyboard.press("Backspace");
			await journal.keyboard.type(
				"Rebuild day. The vault reset in June took the whole operating layer with it — re-entered the team and client contacts, restored this week's deliverables, CRM lists tomorrow. Lesson: the company lives in this vault; it gets backed up from now on.",
			);
			await journal.waitForTimeout(800);
			await s.shot(journal, "journal-entry");
			s.note("[journal] wrote today's entry");
		} catch (e) {
			s.note(`[journal] failed: ${String(e).slice(0, 150)}`);
		}
		await journal.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
