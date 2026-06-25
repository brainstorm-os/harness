/**
 * Session 238 — Marcus builds Northbound's brand & design system (product turn).
 *
 * Marcus owns the brand surface, and he's exacting about it. Instead of only
 * reviewing, this turn he PRODUCES the brand artifact and then encodes it where
 * it actually lives:
 *   1. a "Northbound — Brand & Design System" spec note (voice, palette,
 *      typography, usage rules) that transcludes the HQ hub, so the brand doc
 *      threads into the operating system the others built;
 *   2. the brand itself, crafted in the Theme Editor — set the ground + accent
 *      tokens to Northbound's values and SAVE it as a named theme ("Northbound"),
 *      exercising an app none of the other three turns touched.
 *
 * Notes input via keyboard.insertText / the dev hook (never per-char type into a
 * fresh editor — F-248). Verdicts are read from screenshots, not flags.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const NOTE_TYPE = "io.brainstorm.notes/Note/v1";
const GROUND_HEX = "#0b1020"; // deep ink — Northbound's ground
const ACCENT_HEX = "#5b8cff"; // a single confident signal blue

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

async function openByTitle(notes: Page, title: string): Promise<string | null> {
	const row = notes.locator(".notes__sidebar-item", { hasText: title }).first();
	if ((await row.count()) === 0) return null;
	await row.click();
	await notes.waitForTimeout(900);
	return devId(notes);
}

test("Marcus builds the Northbound brand and crafts its theme", async () => {
	test.setTimeout(300_000);
	const s = await startSession("238-marcus-brand-system");
	s.chat(
		SPEAKER.Marcus,
		"If we're scaling output, the brand has to hold or it'll fragment across three people's taste. So I'm setting it down properly: one spec for voice, palette and type, and then I'm encoding it as an actual theme so 'on-brand' is a setting, not a vibe. I'm fussy about this on purpose.",
	);
	try {
		// ── 1. Brand spec note ────────────────────────────────────────────
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const hubId = await openByTitle(notes, "Northbound HQ");
		s.note(`hubId=${hubId}`);

		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1600);
		await notes.keyboard.insertText("Northbound — Brand & Design System");
		await notes.waitForTimeout(500);

		const composed = await notes
			.evaluate(
				async ({ hubId, noteType, ground, accent }) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					await dev.appendParagraph(
						"One brand, held across the team. This is the source of truth for how Northbound looks and sounds.",
					);
					await dev.appendParagraph("Voice & tone");
					await dev.appendParagraph(
						"Plainspoken authority. We write like the sharpest operator in the room who respects your time: a claim, the reason, the implication. No hype, no hedging, no filler adjectives.",
					);
					await dev.appendParagraph("Palette");
					await dev.appendParagraph(
						`Ground is deep ink (${ground}) — calm, serious, easy on the eyes for long reading. Exactly one accent, a confident signal blue (${accent}), used only for action and emphasis. No decorative colour; colour means something or it isn't there.`,
					);
					await dev.appendParagraph("Typography");
					await dev.appendParagraph(
						"One workhorse text face at a generous measure. Restrained weights — regular for body, medium for emphasis. Buttons are never bold. Hierarchy comes from size and space, not from shouting.",
					);
					await dev.appendParagraph("Usage");
					await dev.appendParagraph(
						"Do: lots of whitespace, left-aligned text, the accent reserved for one primary action per view. Don't: gradients-for-decoration, more than one accent, centre-justified paragraphs, drop shadows standing in for hierarchy.",
					);
					await dev.appendParagraph("The living theme");
					await dev.appendParagraph(
						"This spec is encoded as the 'Northbound' theme in the Theme Editor — so on-brand is a setting every surface inherits, not a thing each of us re-decides. The whole operation runs on it:",
					);
					if (hubId) await dev.insertTransclusion(hubId, noteType, "Northbound HQ");
					return true;
				},
				{ hubId, noteType: NOTE_TYPE, ground: GROUND_HEX, accent: ACCENT_HEX },
			)
			.catch(() => false);
		const brandTitle =
			(await notes.locator(".notes__title, .notes__header-title").first().textContent()) ?? "";
		s.note(`brand spec composed=${composed} title="${brandTitle}"`);
		await s.shot(notes, "01-brand-spec");

		// ── 2. Craft + save the Northbound theme (Theme Editor) ───────────
		try {
			const te = await s.openApp(APP.ThemeEditor);
			await te.waitForTimeout(1800);
			await s.shot(te, "02-theme-editor");

			// Make sure we're on the Token set pane.
			await te
				.locator("[role='tab']", { hasText: "Token set" })
				.first()
				.click()
				.catch(() => undefined);
			await te.waitForTimeout(400);

			const editToken = async (name: string, hex: string): Promise<string> => {
				const input = te.locator(`.te-row__value[aria-label="${name}"]`).first();
				if ((await input.count()) === 0) return `not-found`;
				await input.click().catch(() => undefined);
				await input.fill("").catch(() => undefined);
				await input.fill(hex).catch(() => undefined);
				await te.keyboard.press("Tab").catch(() => undefined); // commit + blur
				await te.waitForTimeout(400);
				return (await input.inputValue().catch(() => "")) || "";
			};

			const groundNow = await editToken("--color-background-primary", GROUND_HEX);
			const accentNow = await editToken("--color-accent-default", ACCENT_HEX);
			s.note(`token edits — ground="${groundNow}" accent="${accentNow}"`);
			await s.shot(te, "03-tokens-edited");

			// Name + save the theme.
			let savedStatus = "";
			try {
				const nameInput = te.locator(".te-toolbar__name").first();
				await nameInput.click().catch(() => undefined);
				await nameInput.fill("Northbound").catch(() => undefined);
				await te
					.locator(".te-toolbar__save")
					.first()
					.click()
					.catch(() => undefined);
				await te.waitForTimeout(900);
				savedStatus =
					(await te
						.locator(".te-toolbar__status")
						.first()
						.textContent()
						.catch(() => "")) ?? "";
			} catch {
				/* save surface undriveable — observed via screenshot */
			}
			s.note(`theme save status="${savedStatus}"`);
			await s.shot(te, "04-theme-saved");
		} catch (e) {
			s.note(`theme-editor step skipped: ${(e as Error).message}`);
		}

		s.chat(
			SPEAKER.Marcus,
			"Brand's set down and it's real now: deep ink ground, one signal-blue accent, type that earns hierarchy through space. It's a spec AND a theme, so the next person doesn't get to reinvent it. I'll hold the line on the no-second-accent rule.",
		);

		expect(brandTitle, "the brand spec is titled").toMatch(/Brand/i);
	} finally {
		await s.finish();
	}
});
