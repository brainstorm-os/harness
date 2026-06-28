/**
 * Session 355 — highlight swatches read on a light theme. The block action
 * menu's Highlight section used a single dark-only tint set, so on a light
 * theme (the dogfood default, Rose) the swatches rendered as muddy dark blocks
 * — the reported bug. Highlights now resolve via light-dark(): a pale wash in
 * light themes, the deep tint preserved for dark. This captures the light case
 * (dark values are unchanged). The "A" glyph must read on every swatch.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };
const EDITOR = '[contenteditable="true"]';

test("highlight swatches read on a light theme (355)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("355-highlight-palette");
	try {
		s.chat(SPEAKER.Mira, "The highlight colours looked muddy on a light theme — checking they read now.");

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1400);
		await notes.locator(EDITOR).first().click();
		await notes.waitForTimeout(300);
		await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (dev) await dev.appendParagraph("Highlight me");
			})
			.catch(() => undefined);
		await notes.waitForTimeout(500);

		// Right-click the line → block action menu; Highlight is the last section,
		// so scroll the (virtualized) menu to the bottom to render its swatches.
		const line = notes.locator(`${EDITOR} p`, { hasText: /Highlight me/ }).first();
		await line.click({ button: "right" }).catch(() => undefined);
		await notes.waitForTimeout(600);
		const menuBox = await notes.locator(".fm-menu").first().boundingBox();
		if (menuBox) {
			await notes.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + menuBox.height / 2);
			for (let i = 0; i < 8; i++) {
				await notes.mouse.wheel(0, 500);
				await notes.waitForTimeout(150);
			}
		}
		await s.shot(notes, "highlight-menu-light");
	} finally {
		await s.finish();
	}
});
