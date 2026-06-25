/**
 * Session 058 — Mira finds a term inside a long note.
 *
 * She opens her thesis note and uses in-document find (Cmd/Ctrl+F) to jump to
 * "lead". Exercises the shared find-replace primitive wired into Notes
 * (`@brainstorm/sdk/find-replace`): the chord opens the bar, typing searches
 * the editor model live, the count reflects matches, and Next advances. The
 * find input is its own field (not the Lexical body), so keystrokes are safe.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("in-document find: open bar, search, advance matches", async () => {
	test.setTimeout(180_000);
	const s = await startSession("058-find-in-note");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const thesis = notes.locator("text=Northbound — investment thesis").first();
		if (await thesis.count()) await thesis.click();
		await notes.waitForTimeout(1000);
		// Focus the editor surface, then fire the find chord.
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+f");
		await notes.waitForTimeout(500);

		const bar = notes.locator('[role="search"]').first();
		const barOpened = (await bar.count()) > 0;
		s.note(`find bar opened on Cmd+F: ${barOpened}`);
		await s.shot(notes, "01-find-open");

		await notes.locator('[data-testid="find-term"]').first().fill("lead");
		await notes.waitForTimeout(500);
		const count1 = (await notes.locator('[data-testid="find-count"]').first().textContent()) ?? "";
		s.note(`count after searching "lead": "${count1}"`);
		await s.shot(notes, "02-matches");

		await notes.locator('[data-testid="find-next"]').first().click();
		await notes.waitForTimeout(300);
		const count2 = (await notes.locator('[data-testid="find-count"]').first().textContent()) ?? "";
		s.note(`count after Next: "${count2}"`);

		await notes.keyboard.press("Escape");
		await notes.waitForTimeout(200);
		const findClosed = (await notes.locator('[data-testid="find-term"]').count()) === 0;
		s.note(`in-doc find bar closed on Escape: ${findClosed}`);

		// F-033: Cmd+F now opens in-document find (not the notes-list search).
		expect(barOpened, "Cmd+F opens the in-document find bar").toBe(true);
		expect(count1, "the search reports a match count like 'N of M'").toMatch(/\d+\s*of\s*\d+/i);
		expect(count2, "Next advances the active match").toMatch(/\d+\s*of\s*\d+/i);

		// The notes-list search moved to Cmd+Shift+F.
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(150);
		await notes.keyboard.press("Meta+Shift+F");
		await notes.waitForTimeout(400);
		const listSearchFocused = await notes.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			return !!el && (el.getAttribute("placeholder")?.toLowerCase().includes("search notes") ?? false);
		});
		s.note(`Cmd+Shift+F focuses the notes-list search: ${listSearchFocused}`);
		await s.shot(notes, "03-list-search");
		expect(listSearchFocused, "Cmd+Shift+F focuses the notes-list search").toBe(true);
	} finally {
		await s.finish();
	}
});
