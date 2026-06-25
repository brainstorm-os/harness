/**
 * Session 101 — Marcus re-checks his design-review fixes.
 *
 * The other half of the dogfood loop: the developer side shipped fixes for six
 * of Marcus's findings (F-037..F-042 + F-039); now the founder-side persona
 * re-opens the exact surfaces and confirms — in his voice, from the captures —
 * whether they actually hold. He praises sparingly and re-files anything still
 * off. This session captures the evidence; the verdict lands in the friction
 * log.
 *
 *   Calendar  — F-040 (no "0:00"), F-041 (one date language), F-042 (legend colours)
 *   Database  — F-037 (board funnel order), F-038 (view named + inline rename)
 *   Notes     — F-039 (two blank "Untitled" notes are tellable apart)
 *
 * Builds with the merged fixes (no SKIP_BUILD).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("verification re-review — Marcus's fixes (101)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("101-marcus-verify-fixes");
	try {
		// ── Calendar: F-040 / F-041 / F-042 ────────────────────────────────
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);
		await cal.locator('.cal-toolbar__tab[data-view="agenda"]').first().click();
		await cal.waitForTimeout(700);
		await s.shot(cal, "01-calendar-agenda");
		const dayHeaders = (await cal.locator(".cal-agenda__day").allInnerTexts()).map((t) => t.trim());
		const chipTexts = (await cal.locator(".cal-chip").allInnerTexts()).map((t) =>
			t.replace(/\s+/g, " ").trim(),
		);
		s.note(`F-041 agenda day-headers: ${JSON.stringify(dayHeaders)}`);
		s.note(`F-040 agenda chip texts: ${JSON.stringify(chipTexts)}`);
		// F-040 check: no chip should lead with a bare "0:00".
		s.note(`F-040 any "0:00" chip? ${chipTexts.some((t) => /\b0:00\b/.test(t))}`);

		await cal.locator('.cal-toolbar__tab[data-view="month"]').first().click();
		await cal.waitForTimeout(700);
		await s.shot(cal, "02-calendar-month");

		// ── Database: F-037 (board lane order) + F-038 (view naming) ────────
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Candidates/i })
			.first()
			.click();
		await db.waitForTimeout(700);
		// The board is the last non-add tab (added in the hiring arc).
		await db.locator(".db-tab:not(.db-tab--add)").last().click();
		await db.waitForTimeout(700);
		await s.shot(db, "03-database-board");
		const laneLabels = (await db.locator(".dbv-board__label").allInnerTexts()).map((t) => t.trim());
		s.note(`F-037 board lane order: ${JSON.stringify(laneLabels)}`);

		// F-038: add a view → it should be named by type (not "New view") and
		// drop into inline rename.
		const tabsBefore = (
			await db.locator(".db-tab:not(.db-tab--add) .db-tab__label").allInnerTexts()
		).map((t) => t.trim());
		await db.locator(".db-tab--add").first().click();
		await db.waitForTimeout(500);
		const tabsAfter = (
			await db.locator(".db-tab:not(.db-tab--add) .db-tab__label").allInnerTexts()
		).map((t) => t.trim());
		const newTab = tabsAfter.find((t) => !tabsBefore.includes(t)) ?? tabsAfter.at(-1) ?? "";
		const renameActive = await db
			.locator(".db-tab__label[contenteditable]")
			.first()
			.count()
			.then((c) => c > 0)
			.catch(() => false);
		s.note(
			`F-038 new view name: ${JSON.stringify(newTab)} (was-"New view"? ${newTab === "New view"})`,
		);
		s.note(`F-038 inline-rename active on create? ${renameActive}`);
		await s.shot(db, "04-database-new-view");
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(300);

		// ── Notes: F-039 (two blank untitled notes) ────────────────────────
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		// Create two blank notes in quick succession — Marcus's exact scenario —
		// WITHOUT typing, so both fall to the "Untitled" fallback.
		for (let i = 0; i < 2; i++) {
			await notes.locator('[aria-label="New note"]').first().click();
			await notes.waitForTimeout(900);
		}
		await s.shot(notes, "05-notes-untitled");
		const sidebarTitles = (await notes.locator(".notes__sidebar-title").allInnerTexts()).map((t) =>
			t.trim(),
		);
		const untitled = sidebarTitles.filter((t) => /^Untitled/.test(t));
		const distinct = new Set(untitled).size;
		s.note(`F-039 untitled row labels: ${JSON.stringify(untitled)}`);
		s.note(`F-039 distinct labels among ${untitled.length} untitled rows: ${distinct}`);

		// A soft expectation — not a hard gate (the verdict is the read-back), but
		// it surfaces in the run if the same-minute case still collides.
		expect(untitled.length, "expected at least two blank untitled notes").toBeGreaterThanOrEqual(2);

		s.note("captured Calendar / Database / Notes for Marcus's verification re-review");
	} finally {
		await s.finish();
	}
});
