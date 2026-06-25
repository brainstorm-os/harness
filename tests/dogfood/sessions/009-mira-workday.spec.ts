/**
 * Session 009 — Mira's first real workday.
 *
 * The blockers are fixed, so Mira does actual Northbound work and we watch for
 * the NEXT wave of friction: write today's journal, capture this week's
 * deliverables on Today, and stand up the Clients CRM with a couple of clients.
 * Exploratory — captures over assertions; friction is distilled afterward.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Mira's workday — journal, deliverables, Clients CRM", async () => {
	test.setTimeout(240_000);
	const s = await startSession("009-mira-workday");
	try {
		// 1. Journal — write today's entry now that the body works.
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		const jBody = journal
			.locator(".journal__entry-editor [contenteditable], .journal__entry-editor")
			.first();
		if (await jBody.count()) {
			await jBody.click().catch(() => undefined);
			await journal.keyboard.type(
				"Shipped the CRM groundwork. Two leads to chase. Issue #1 outline tomorrow.",
				{ delay: 10 },
			);
			await journal.waitForTimeout(600);
		}
		await s.shot(journal, "journal-written");
		s.note("Wrote today's journal entry.");

		// 2. Tasks — capture deliverables from Today (should land on Today now).
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		await tasks
			.locator('text="Today"')
			.first()
			.click()
			.catch(() => undefined);
		for (const name of ["Outline issue #1", "Email Acme about the retainer"]) {
			await tasks
				.locator('[aria-label="New task"]')
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(500);
			const composer = tasks.locator('input:focus, [contenteditable="true"]:focus').first();
			if (await composer.count()) {
				await composer.type(name, { delay: 12 }).catch(() => undefined);
				await tasks
					.locator('button:has-text("Create task")')
					.click()
					.catch(() => undefined);
				await tasks.waitForTimeout(500);
			}
		}
		await s.shot(tasks, "today-deliverables");
		s.note("Captured this week's deliverables on Today.");

		// 3. Database — stand up the Clients CRM.
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db.locator("#sidebar-new-list").first().click();
		await db.waitForTimeout(500);
		await db
			.locator('text="Blank collection"')
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1200);
		// Rename the collection title to "Clients".
		const title = db.locator("#stage-title");
		if (await title.count()) {
			await title.click().catch(() => undefined);
			await db.keyboard.press("Meta+a").catch(() => undefined);
			await db.keyboard.type("Clients", { delay: 20 }).catch(() => undefined);
			await db.keyboard.press("Enter").catch(() => undefined);
			await db.waitForTimeout(600);
		}
		await s.shot(db, "clients-collection");
		s.note("Created a Clients collection and renamed it.");

		// Add two client rows.
		for (let i = 0; i < 2; i++) {
			await db
				.locator("#toolbar-new")
				.click()
				.catch(() => undefined);
			await db.waitForTimeout(900);
		}
		await s.shot(db, "clients-rows");
		s.note("Added two client rows (generic Objects).");

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
