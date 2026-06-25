/**
 * Session 063 — Mira assembles her investor brief (a real artifact).
 *
 * Not a single-affordance check: she builds a structured document and weaves
 * another app into it. A titled note + narrative prose + her LIVE Clients
 * database embedded as a block (block.embed.entity → BlockEmbedNode). This
 * dogfoods the product's core promise — Block-Protocol cross-app composition
 * (a database view living inside a document) — and the seams between Notes and
 * Database, where the richest friction hides.
 *
 * Body + block insertion go through `window.__brainstormNotesDev` (the only
 * keystroke-safe path into the Lexical/Yjs editor): appendParagraph for prose,
 * runBlockCommand("block.embed.entity") to open the embed picker.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	runBlockCommand: (id: string) => Promise<void>;
};

const TITLE = "Northbound — investor brief";
const PROSE = [
	"Thesis: independent operators drown in tabs and lose the through-line of their own research.",
	"Traction: a working CRM, a weekly synthesis cadence, and a first advisory conversation with Vertex Labs.",
	"The pipeline as it stands today:",
];

test("assemble an investor brief with an embedded Clients database", async () => {
	test.setTimeout(180_000);
	const s = await startSession("063-investor-brief");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// Fresh artifact: new note, titled.
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);
		await notes.keyboard.type(TITLE, { delay: 20 });
		await notes.waitForTimeout(500);

		// Narrative prose via the dev hook (keystroke-safe).
		const wrote = await notes
			.evaluate(async (lines) => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return false;
				for (const line of lines) await dev.appendParagraph(line);
				return true;
			}, PROSE)
			.catch(() => false);
		s.note(`wrote prose: ${wrote}`);
		await s.shot(notes, "01-prose");

		// Place the cursor in the doc, then open the embed picker.
		await notes.locator('[contenteditable="true"]').first().click();
		await notes.waitForTimeout(200);
		await notes.evaluate(async () => {
			const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
			await dev?.runBlockCommand("block.embed.entity");
		});
		await notes.waitForTimeout(500);
		const menu = notes.locator(".notes__embed-menu");
		s.note(`embed picker opened: ${(await menu.count()) > 0}`);
		await s.shot(notes, "02-embed-picker");

		await menu.locator(".notes__embed-menu-input").first().fill("Clients");
		await notes.waitForTimeout(500);
		const option = menu.locator('[role="option"]', { hasText: /Clients/i }).first();
		s.note(`Clients option present: ${(await option.count()) > 0}`);
		await option.click();
		await notes.waitForTimeout(1000);
		await s.shot(notes, "03-embedded");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const body =
			(await notes.locator('.notes__doc, [contenteditable="true"]').first().textContent()) ?? "";
		const embedHosts = await notes.locator(".notes__embed-host").count();
		const embedTitle =
			(await notes
				.locator(".notes__embed-card-title")
				.first()
				.textContent()
				.catch(() => "")) ?? "";
		s.note(`title="${title}"`);
		s.note(`body has thesis prose: ${body.includes("through-line")}`);
		s.note(`embed hosts: ${embedHosts}; embed card title: "${embedTitle}"`);

		expect(title, "the brief is titled").toMatch(/investor brief/i);
		expect(wrote, "narrative prose was written").toBe(true);
		expect(body, "the brief carries its narrative").toContain("through-line");
		expect(
			embedHosts,
			"the Clients database is embedded as a block in the brief",
		).toBeGreaterThanOrEqual(1);
		expect(embedTitle, "the embed renders the Clients database identity").toMatch(/Clients/i);
	} finally {
		await s.finish();
	}
});
