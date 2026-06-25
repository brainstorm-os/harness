/**
 * Session 180 — Mira colours a block (B11.7 bulk colour). She right-clicks a
 * line to open the block action menu, confirms the new Text color / Highlight
 * sections, picks Red, and the line's text takes the colour. The applied inline
 * style on the rendered text is the real proof (independent of menu chrome).
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

const EDITOR = '[contenteditable="true"]';

test("Mira colours a block from the action menu (180)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("180-mira-bulk-color");
	try {
		s.chat(
			SPEAKER.Mira,
			"Want to colour a line red from the block menu — checking the new Text color section actually paints the text.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1400);
		await notes.locator(EDITOR).first().click();
		await notes.waitForTimeout(300);
		await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (dev) await dev.appendParagraph("Colour me red");
			})
			.catch(() => undefined);
		await notes.waitForTimeout(500);
		await s.shot(notes, "01-line");

		// Right-click the line → block action menu. The colour rows sit at the
		// bottom and fancy-menus virtualizes off-screen rows, so scroll the menu
		// to render the Text color section (a real user does the same).
		const line = notes.locator(`${EDITOR} p`, { hasText: /Colour me red/ }).first();
		await line.click({ button: "right" }).catch(() => undefined);
		await notes.waitForTimeout(600);
		const menuBox = await notes.locator(".fm-menu").first().boundingBox();
		if (menuBox) {
			await notes.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + menuBox.height / 2);
			for (let i = 0; i < 4; i++) {
				await notes.mouse.wheel(0, 400);
				await notes.waitForTimeout(200);
			}
		}
		const menuItems = await notes
			.locator('.fm-menu [role="menuitem"], .fm-menu [role="option"]')
			.allInnerTexts()
			.then((t) => t.map((x) => x.trim()).filter(Boolean))
			.catch(() => [] as string[]);
		s.note(`block menu items after scroll: ${JSON.stringify(menuItems)}`);
		// Each colour row reads "A\nRed" (the swatch dot is an "A"), so match the
		// trailing label, not the whole row text.
		const hasColorRow = menuItems.some((t) => t.split("\n").pop()?.trim() === "Red");
		s.note(`a colour row (Red) present in block menu=${hasColorRow}`);
		await s.shot(notes, "02-block-menu");

		// Pick the first "Red" row (Text color section comes before Highlight).
		await notes
			.locator('.fm-menu [role="menuitem"], .fm-menu [role="option"]', { hasText: /Red/ })
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(600);
		await s.shot(notes, "03-after-color");

		// Proof: the line's text now carries an inline `color` style with the red
		// swatch var.
		const colored = await notes
			.locator(`${EDITOR} p`, { hasText: /Colour me red/ })
			.first()
			.evaluate((p) => {
				const span = p.querySelector("span[style]") as HTMLElement | null;
				return span?.getAttribute("style") ?? p.getAttribute("style") ?? "";
			})
			.catch(() => "");
		s.note(`line text inline style after colouring: "${colored}"`);
		const textWentRed = /color\s*:/.test(colored) && /red/i.test(colored);
		s.note(`text took the red colour=${textWentRed}`);

		expect(hasColorRow).toBe(true);
		expect(textWentRed).toBe(true);
	} finally {
		await s.finish();
	}
});
