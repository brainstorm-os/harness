/**
 * Session 102 — Brand-system kickoff: a real work day for Mira AND Marcus.
 *
 * First working day after the hire. Mira and Marcus share ONE vault (live
 * collaboration is still sync-gated), so the "team" is both of them working the
 * same business: Mira produces, Marcus critiques.
 *
 *   Mira (founder work, real composed artifacts):
 *     - Notes:   the "Brand System — Sprint 1" brief that frames Marcus's
 *                first 30 days (deliverables, cadence, the no-shared-vault
 *                working arrangement).
 *     - Tasks:   the four Sprint-1 deliverables, on the board.
 *     - Journal: the kickoff logged.
 *
 *   Marcus (his craft = critical design review):
 *     - Files:   his first on-the-job review — where the brand assets will
 *                live. An app he hasn't reviewed yet. Captured for his verdict.
 *
 * Exploratory: captures over assertions. Mira's workflow friction + Marcus's
 * design critique are distilled into the friction log afterward (read-back).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

const BRIEF_TITLE = "Brand System — Sprint 1";
const BRIEF = [
	"Sprint 1 (first 30 days) — Marcus owns the brand system. Goal: a coherent type / colour / layout shipped across the newsletter template and the marketing site, a reusable advisory-deck template, and one full newsletter issue designed end to end.",
	"Deliverables: (1) Newsletter template — type scale, palette, masthead. (2) Marketing site — landing + about on the same system. (3) Advisory-deck template — reusable, on-brand. (4) Issue #1, designed end to end.",
	"Cadence: a weekly product-design review where Marcus holds the bar on the app surface. Async-first, 2–3 days/week.",
	"Working arrangement: until the shared workspace lands (sync), Marcus comes in through exported artifacts and this brief — not a live shared vault. I drop briefs + assets here; he returns designs as files + notes, and we review weekly.",
];

const DELIVERABLES = [
	"Newsletter template — type, palette, masthead",
	"Marketing site — landing + about",
	"Advisory-deck template",
	"Issue #1 — design end to end",
];

test("brand-system kickoff — Mira builds Sprint 1, Marcus reviews Files", async () => {
	test.setTimeout(240_000);
	const s = await startSession("102-brand-system-kickoff");
	try {
		// ── Mira: the Sprint-1 brief (Notes) ───────────────────────────────
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1400);
		await notes.locator('[contenteditable="true"]').first().click();
		await notes.keyboard.press("Meta+ArrowUp");
		await notes.waitForTimeout(200);
		await notes.keyboard.type(BRIEF_TITLE, { delay: 12 });
		await notes.waitForTimeout(500);
		const wrote = await notes
			.evaluate(async (paras) => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				for (const p of paras) await dev.appendParagraph(p);
				return true;
			}, BRIEF)
			.catch(() => false);
		await notes.waitForTimeout(500);
		await s.shot(notes, "01-brief");
		const briefTitle =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const briefBody = (await notes.locator('[contenteditable="true"]').first().innerText()) ?? "";
		s.note(`brief title="${briefTitle.trim()}" body-len=${briefBody.length} wrote=${wrote}`);

		// ── Mira: the four Sprint-1 deliverables (Tasks) ───────────────────
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1500);
		for (const name of DELIVERABLES) {
			await tasks
				.locator('[aria-label="New task"]')
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(500);
			const composer = tasks.locator('input:focus, [contenteditable="true"]:focus').first();
			if (await composer.count()) {
				await composer.type(name, { delay: 10 }).catch(() => undefined);
				await tasks
					.locator('button:has-text("Create task")')
					.click()
					.catch(() => undefined);
				await tasks.waitForTimeout(500);
			}
		}
		await s.shot(tasks, "02-deliverables");
		const taskTexts = (await tasks.locator(".task-row__name-label, .task-row__title").allInnerTexts())
			.map((t) => t.trim())
			.filter(Boolean);
		s.note(`tasks now visible: ${JSON.stringify(taskTexts.slice(0, 12))}`);

		// ── Mira: log the kickoff (Journal) ────────────────────────────────
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		const jBody = journal
			.locator(".journal__entry-editor [contenteditable], .journal__entry-editor")
			.first();
		if (await jBody.count()) {
			await jBody.click().catch(() => undefined);
			await journal.keyboard.type(
				"Kicked off Marcus's first sprint — the brand system. Wrote the Sprint 1 brief, set the four deliverables, booked the weekly design review. He's reviewing Files today to see where brand assets will live.",
				{ delay: 8 },
			);
			await journal.waitForTimeout(600);
		}
		await s.shot(journal, "03-journal");
		s.note("Mira logged the kickoff day.");

		// ── Marcus: his first on-the-job design review (Files) ─────────────
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1500);
		await s.shot(files, "04-files-resting");
		// Whatever the Files surface shows at rest — the tree, the empty state,
		// the header — is what Marcus scrutinises. Capture any list/tree labels.
		const fileLabels = (
			await files.locator("[class*='row'], [class*='item'], [class*='tree']").allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 15);
		s.note(`Files surface labels (for Marcus's review): ${JSON.stringify(fileLabels)}`);
		// If there's a creatable affordance, open it so he can judge the create flow.
		const newAffordance = files
			.locator('[aria-label*="New" i], button:has-text("New"), button:has-text("folder")')
			.first();
		if (await newAffordance.count()) {
			await newAffordance.click().catch(() => undefined);
			await files.waitForTimeout(700);
			await s.shot(files, "05-files-create");
		}

		s.note("captured Mira's Sprint-1 artifacts + Marcus's Files review surfaces");
		// Soft signal: the brief should have a real body (the work day produced output).
		expect(briefBody.length, "the Sprint-1 brief has a real body").toBeGreaterThan(200);
	} finally {
		await s.finish();
	}
});
