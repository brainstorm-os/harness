/**
 * Session 037 — tidy Mira's Notes vault: delete the "Untitled" notes left by
 * the early note-focus exploration sessions, so her sidebar is clean to work
 * in. Keeps titled notes (her research thesis, Welcome, etc.).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("tidy: delete leftover Untitled notes", async () => {
	test.setTimeout(180_000);
	const s = await startSession("037-tidy-untitled-notes");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		const titlesBefore = await notes
			.locator(".notes__sidebar-row")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Notes before: ${titlesBefore.length} rows`);
		const untitledBefore = titlesBefore.filter((t) => /^\s*Untitled/.test(t.trim())).length;
		s.note(`Untitled before: ${untitledBefore}`);

		let deleted = 0;
		while (deleted < 15) {
			const row = notes.locator(".notes__sidebar-row", { hasText: /^Untitled/ }).first();
			if ((await row.count()) === 0) break;
			await row.click();
			await notes.waitForTimeout(500);
			const del = notes.getByRole("button", { name: /Delete note/i }).first();
			if ((await del.count()) === 0) break;
			await del.click();
			await notes.waitForTimeout(700);
			deleted += 1;
		}
		s.note(`Deleted Untitled notes: ${deleted}`);

		const titlesAfter = await notes
			.locator(".notes__sidebar-row")
			.allInnerTexts()
			.catch(() => []);
		const untitledAfter = titlesAfter.filter((t) => /^\s*Untitled/.test(t.trim())).length;
		s.note(`Untitled after: ${untitledAfter}`);
		s.note(
			`Notes remaining: ${JSON.stringify(titlesAfter.map((t) => t.replace(/\s+/g, " ").trim()).filter((t) => !/^(TODAY|YESTERDAY|EARLIER|This|Last)/i.test(t)))}`,
		);
		await s.shot(notes, "01-tidied");

		expect(untitledAfter).toBeLessThan(untitledBefore);
	} finally {
		await s.finish();
	}
});
