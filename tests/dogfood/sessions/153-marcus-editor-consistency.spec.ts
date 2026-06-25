/**
 * Session 153 — Marcus reviews shared-editor CHROME CONSISTENCY across apps.
 *
 * The whole point of the editor unification (Notes/Journal/Tasks all mount
 * `@brainstorm/editor`'s `FullEditorPlugins`) is that the writing surface feels
 * identical everywhere. Marcus — consistency lens — opens the editor in all
 * three apps, triggers the slash/block menu in each, captures it, and reads
 * back the block-type labels so the three lists can be compared item-for-item.
 * If the menus diverge (different items, order, or labels) between apps, that's
 * exactly the inconsistency he'd file. Light single-"/" probe per app; verdict
 * from the captures + the extracted label lists.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type FounderSession, SPEAKER } from "../lib/founder";
import { startSession } from "../lib/founder";

/** Trigger the slash menu in the editor and read back the visible block-type
 *  labels (the menu items), screenshotting the menu WHILE OPEN. A throwaway
 *  marker char is typed first to guarantee the caret/focus is in the
 *  contenteditable (an empty body — e.g. a fresh task — otherwise swallows the
 *  keystrokes); the marker + the "/" are cleaned up after so Mira's persistent
 *  vault isn't polluted. Returns [] if nothing opened. */
async function probeSlashMenu(page: Page, s: FounderSession, shotLabel: string): Promise<string[]> {
	// The slash menu only triggers when "/" is the first char of a block. Type a
	// marker char to force focus/caret into the contenteditable, THEN a newline,
	// THEN "/" so it lands at the start of a fresh empty block.
	await page.keyboard.press("Meta+ArrowDown").catch(() => undefined);
	await page.keyboard.press("End").catch(() => undefined);
	await page.keyboard.type("x", { delay: 20 }).catch(() => undefined); // force caret
	await page.keyboard.press("Enter").catch(() => undefined);
	await page.keyboard.type("/", { delay: 20 }).catch(() => undefined);
	await page.waitForTimeout(700);
	const labels = await page
		.locator('[class*="typeahead"], [class*="slash"], [class*="block-menu"], [role="listbox"]')
		.first()
		.allInnerTexts()
		.then((xs) =>
			xs
				.join("\n")
				.split("\n")
				.map((t) => t.replace(/\s+/g, " ").trim())
				.filter(Boolean),
		)
		.catch(() => [] as string[]);
	await s.shot(page, shotLabel); // capture the menu while it's open
	// Clean up: remove "/", the marker "x", and the line we added. No Escape —
	// in the Tasks detail it can pop the whole detail route back to the list.
	await page.keyboard.press("Backspace").catch(() => undefined); // "/"
	await page.keyboard.press("Backspace").catch(() => undefined); // "x"
	await page.keyboard.press("Backspace").catch(() => undefined); // empty line
	return labels;
}

test("Marcus reviews shared-editor consistency across apps (153)", async () => {
	test.setTimeout(240_000);
	const s: FounderSession = await startSession("153-marcus-editor-consistency");
	try {
		s.chat(
			SPEAKER.Marcus,
			"The editor's shared across Notes, Journal and Tasks now — so the block menu had better be identical in all three. Comparing them item for item.",
		);

		// --- Notes ---
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1800);
		await notes
			.locator(".notes__sidebar-title, [class*='sidebar'] [class*='title']")
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1000);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		const notesMenu = await probeSlashMenu(notes, s, "01-notes-slash");
		s.note(`Notes block menu: ${JSON.stringify(notesMenu)}`);

		// --- Journal (today's entry exists from session 151) ---
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await journal
			.locator(".journal__entry-editor")
			.first()
			.click()
			.catch(() => undefined);
		await journal.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		const journalMenu = await probeSlashMenu(journal, s, "02-journal-slash");
		s.note(`Journal block menu: ${JSON.stringify(journalMenu)}`);

		// --- Tasks (open first task on its detail route) ---
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		// The task name button is the detail-open target (single activation
		// selects → opens the detail route). Clicking the row root is flakier.
		await tasks
			.locator("[data-task-id] .task-row__name")
			.first()
			.click()
			.catch(() => undefined);
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		const tasksEditorMounted = await tasks
			.locator(".tasks-detail__editor")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`tasks detail editor mounted for probe: ${tasksEditorMounted}`);
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		const tasksMenu = await probeSlashMenu(tasks, s, "03-tasks-slash");
		s.note(`Tasks block menu: ${JSON.stringify(tasksMenu)}`);

		// Compare: are the three lists identical?
		const norm = (xs: string[]) => xs.join(" | ");
		const allMatch =
			notesMenu.length > 0 &&
			norm(notesMenu) === norm(journalMenu) &&
			norm(journalMenu) === norm(tasksMenu);
		s.note(`block menus identical across Notes/Journal/Tasks: ${allMatch}`);

		s.chat(
			SPEAKER.Marcus,
			allMatch
				? "Checked the block menu in all three — identical list, same order, same labels. That's what consistency looks like; the shared editor's earning its keep."
				: "The block menus aren't identical across the three apps — pulling the exact divergence from the captures to file it.",
		);
		s.note(
			"Marcus compared shared-editor chrome across Notes/Journal/Tasks; verdict from captures + label lists.",
		);
	} finally {
		await s.finish();
	}
});
