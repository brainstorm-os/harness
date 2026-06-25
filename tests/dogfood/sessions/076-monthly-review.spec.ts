/**
 * Session 076 — Mira's monthly operating review & next-30-days plan.
 *
 * The capstone of the core operating area: one doc that pulls the whole
 * workspace together the way a founder reviews the month. It transcludes the
 * live weekly review (070) inline, embeds the two data surfaces she steers by
 * (the Content Calendar pipeline + the Clients CRM), and lays out the next-30
 * plan in prose that points at the publishing schedule + deliverables. The
 * widest cross-app composition in the loop so far — transclusion + two embeds +
 * narrative in a single artifact.
 *
 * Prose via window.__brainstormNotesDev; the weekly-review note id is captured
 * live via currentNoteId() (open it first); the data surfaces go in through the
 * embed picker.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const NOTE_TYPE = "io.brainstorm.notes/Note/v1";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	insertTransclusion: (entityId: string, entityType: string, label: string) => Promise<void>;
	runBlockCommand: (id: string) => Promise<void>;
	currentNoteId: () => string | null;
};

async function openAndGetId(
	notes: import("@playwright/test").Page,
	title: string,
): Promise<string | null> {
	const row = notes.locator(`text=${title}`).first();
	if ((await row.count()) === 0) return null;
	await row.click();
	await notes.waitForTimeout(900);
	return notes.evaluate(() => {
		const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
		return dev?.currentNoteId() ?? null;
	});
}

async function embed(notes: import("@playwright/test").Page, name: string): Promise<void> {
	await notes.locator('[contenteditable="true"]').first().click();
	await notes.waitForTimeout(150);
	await notes.evaluate(async () => {
		const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
		await dev?.runBlockCommand("block.embed.entity");
	});
	await notes.waitForTimeout(500);
	const menu = notes.locator(".notes__embed-menu");
	if ((await menu.count()) === 0) return;
	await menu.locator(".notes__embed-menu-input").first().fill(name);
	await notes.waitForTimeout(500);
	await menu
		.locator('[role="option"]', { hasText: new RegExp(name, "i") })
		.first()
		.click();
	await notes.waitForTimeout(900);
}

test("compose the monthly operating review weaving the whole workspace", async () => {
	test.setTimeout(180_000);
	const s = await startSession("076-monthly-review");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const weeklyId = await openAndGetId(notes, "Northbound — weekly operating review");
		s.note(`weeklyReviewId=${weeklyId}`);

		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);
		await notes.keyboard.type("Northbound — June review & next 30 days", { delay: 16 });
		await notes.waitForTimeout(500);

		const built = await notes
			.evaluate(
				async ({ weeklyId, noteType }) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					await dev.appendParagraph(
						"The month at a glance — where Northbound is, and the next 30 days.",
					);
					await dev.appendParagraph("This week, in full");
					if (weeklyId) await dev.insertTransclusion(weeklyId, noteType, "Weekly operating review");
					await dev.appendParagraph("Pipeline & clients");
					await dev.appendParagraph("Next 30 days");
					await dev.appendParagraph(
						"Ship Issues #1–3 on the 9th / 16th / 23rd (drafts already on Tasks). Convert one Clients lead to a paid advisory retainer. Hold the weekly review every Friday.",
					);
					await dev.appendParagraph("");
					return true;
				},
				{ weeklyId, noteType: NOTE_TYPE },
			)
			.catch(() => false);
		s.note(`composed prose + transclusion: ${built}`);
		await s.shot(notes, "01-prose");

		// Embed the two live data surfaces.
		await embed(notes, "Content Calendar");
		await embed(notes, "Clients");
		await s.shot(notes, "02-review");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const transclusions = await notes.locator(".notes__transclusion").count();
		const embeds = await notes.locator(".notes__embed-host").count();
		const embedTitles = (await notes.locator(".notes__embed-card-title").allInnerTexts()).map((t) =>
			t.trim(),
		);
		s.note(
			`title="${title}" transclusions=${transclusions} embeds=${embeds} embedTitles=${JSON.stringify(embedTitles)}`,
		);

		expect(title, "the review is titled").toMatch(/June review/i);
		expect(built, "the review composed").toBe(true);
		expect(transclusions, "it transcludes the live weekly review").toBeGreaterThanOrEqual(1);
		expect(embeds, "it embeds the pipeline + the CRM").toBeGreaterThanOrEqual(2);
		expect(
			embedTitles.some((t) => /content calendar/i.test(t)) &&
				embedTitles.some((t) => /clients/i.test(t)),
			"both data surfaces are embedded",
		).toBe(true);
	} finally {
		await s.finish();
	}
});
