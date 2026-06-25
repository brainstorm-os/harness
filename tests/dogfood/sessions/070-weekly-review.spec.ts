/**
 * Session 070 — Mira writes her weekly operating review.
 *
 * A recurring knowledge-base doc (distinct from the one-time hub) where she
 * looks at the whole business once a week: prose on the week's focus, plus the
 * two live data surfaces she actually steers by embedded inline — the
 * **Content Calendar** (the editorial pipeline she built + filled in 065–067)
 * and the **Clients** CRM. First time the Content Calendar pipeline is woven
 * into the knowledge base, closing the loop: data surfaces → review doc.
 *
 * Prose via window.__brainstormNotesDev (keystroke-safe); each live surface
 * embedded through the in-editor embed picker (block.embed.entity → search →
 * pick). Embeds render as v1 entity cards (the live inline render lights up the
 * same node when its provider app ships — composing now pre-stages that).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	runBlockCommand: (id: string) => Promise<void>;
	currentNoteId: () => string | null;
};

const SURFACES = ["Content Calendar", "Clients"];

async function embedSurface(notes: import("@playwright/test").Page, name: string): Promise<void> {
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

test("write the weekly operating review with both live surfaces embedded", async () => {
	test.setTimeout(180_000);
	const s = await startSession("070-weekly-review");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);
		await notes.keyboard.type("Northbound — weekly operating review", { delay: 18 });
		await notes.waitForTimeout(500);

		const built = await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Week of 8 June — what's shipping, what's stuck, who's in the pipeline.",
				);
				await dev.appendParagraph("Editorial pipeline");
				await dev.appendParagraph("Three issues queued; #1 publishes Monday. Status + dates below.");
				return true;
			})
			.catch(() => false);
		s.note(`prose composed: ${built}`);
		await s.shot(notes, "01-prose");

		// Embed the live Content Calendar pipeline.
		await embedSurface(notes, "Content Calendar");

		// A line, then the Clients pipeline.
		await notes.evaluate(async () => {
			const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
			await dev?.appendParagraph("Clients");
		});
		await embedSurface(notes, "Clients");
		await s.shot(notes, "02-review");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const embeds = await notes.locator(".notes__embed-host").count();
		const embedTitles = (await notes.locator(".notes__embed-card-title").allInnerTexts()).map((t) =>
			t.trim(),
		);
		s.note(`title="${title}" embeds=${embeds} embedTitles=${JSON.stringify(embedTitles)}`);

		expect(title, "the review is titled").toMatch(/weekly operating review/i);
		expect(built, "the review prose composed").toBe(true);
		expect(embeds, "both live surfaces are embedded").toBeGreaterThanOrEqual(2);
		expect(
			embedTitles.some((t) => /content calendar/i.test(t)),
			"the Content Calendar pipeline is embedded",
		).toBe(true);
		expect(
			embedTitles.some((t) => /clients/i.test(t)),
			"the Clients CRM is embedded",
		).toBe(true);
	} finally {
		await s.finish();
	}
});
