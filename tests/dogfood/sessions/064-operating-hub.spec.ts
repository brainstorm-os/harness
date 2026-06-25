/**
 * Session 064 — Mira builds Northbound's operating hub (core startup area).
 *
 * A "Northbound HQ" home doc that ties the business together: narrative + an
 * embedded LIVE Clients pipeline + transclusion links to her key docs (the
 * investor brief and the investment thesis). This is the "operating system
 * inside Brainstorm" the README's core-area phase calls for — one page where
 * the whole company is one click away — and it stresses the cross-app /
 * cross-entity composition seams (embed + transclusion in one document).
 *
 * All editor input via window.__brainstormNotesDev (keystroke-safe). Note ids
 * are captured live via currentNoteId() by opening each source note first.
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

test("build the Northbound HQ operating hub (embed + transclusions)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("064-operating-hub");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const briefId = await openAndGetId(notes, "Northbound — investor brief");
		const thesisId = await openAndGetId(notes, "Northbound — investment thesis");
		s.note(`briefId=${briefId} thesisId=${thesisId}`);

		// Fresh hub doc.
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);
		await notes.keyboard.type("Northbound HQ", { delay: 20 });
		await notes.waitForTimeout(500);

		const built = await notes
			.evaluate(
				async ({ briefId, thesisId, noteType }) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					await dev.appendParagraph("The operating home for Northbound — everything one click away.");
					await dev.appendParagraph("Key docs");
					if (briefId) await dev.insertTransclusion(briefId, noteType, "Investor brief");
					if (thesisId) await dev.insertTransclusion(thesisId, noteType, "Investment thesis");
					await dev.appendParagraph("Clients pipeline");
					await dev.appendParagraph("");
					return true;
				},
				{ briefId, thesisId, noteType: NOTE_TYPE },
			)
			.catch(() => false);
		s.note(`composed prose + transclusions: ${built}`);
		await s.shot(notes, "01-links");

		// Embed the live Clients pipeline at the cursor.
		await notes.locator('[contenteditable="true"]').first().click();
		await notes.waitForTimeout(200);
		await notes.evaluate(async () => {
			const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
			await dev?.runBlockCommand("block.embed.entity");
		});
		await notes.waitForTimeout(500);
		const menu = notes.locator(".notes__embed-menu");
		if ((await menu.count()) > 0) {
			await menu.locator(".notes__embed-menu-input").first().fill("Clients");
			await notes.waitForTimeout(500);
			await menu
				.locator('[role="option"]', { hasText: /Clients/i })
				.first()
				.click();
			await notes.waitForTimeout(900);
		}
		await s.shot(notes, "02-hub");

		const title =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		const transclusions = await notes.locator(".notes__transclusion").count();
		const embeds = await notes.locator(".notes__embed-host").count();
		const embedTitle =
			(await notes
				.locator(".notes__embed-card-title")
				.first()
				.textContent()
				.catch(() => "")) ?? "";
		s.note(
			`title="${title}" transclusions=${transclusions} embeds=${embeds} embedTitle="${embedTitle}"`,
		);

		expect(title, "the hub is titled").toMatch(/Northbound HQ/i);
		expect(built, "the hub body composed").toBe(true);
		expect(transclusions, "the hub transcludes the brief + thesis").toBeGreaterThanOrEqual(2);
		expect(embeds, "the hub embeds the live Clients pipeline").toBeGreaterThanOrEqual(1);
		expect(embedTitle, "the embed is the Clients database").toMatch(/Clients/i);
	} finally {
		await s.finish();
	}
});
