/**
 * Session 157 — Priya verifies F-070 rung (c): she can now embed a live page
 * reference in a journal entry.
 *
 * Rung (c) added a shared "Reference" slash command (id `block.transclusion`)
 * to `FullEditorPlugins` whenever transclusion is enabled — picking it inserts
 * the `!@` trigger so the transclusion typeahead opens for choosing the page.
 * This is exactly what Priya couldn't do in session 155 ("anchor this log to
 * the live Clients pipeline"). She opens the slash menu in today's journal
 * entry, confirms "Reference" is there, picks it, and checks the page-picker
 * typeahead opens (then tries an entity query). Light synthetic keyboard; the
 * verdict is decided from the captures + the extracted labels afterward.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya references a live page in the shared-editor Journal (157)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("157-priya-journal-reference");
	try {
		s.chat(
			SPEAKER.Priya,
			"Kai wired up a Reference block. Going back to my log to finally embed the live pipeline page in it — the thing I couldn't do last time.",
		);

		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await journal
			.locator(".journal__entry-editor")
			.first()
			.click()
			.catch(() => undefined);
		await journal.waitForTimeout(400);
		await s.shot(journal, "01-journal-open");

		// Open the slash menu on a fresh line and read the palette — "Reference"
		// (block.transclusion) should now be present with its caption.
		await journal.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await journal.keyboard.press("End").catch(() => undefined);
		await journal.keyboard.type("x", { delay: 20 }).catch(() => undefined); // force caret
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.keyboard.type("/", { delay: 20 }).catch(() => undefined);
		await journal.waitForTimeout(700);
		const labels = await journal
			.locator(".bs-editor__slash-menu, [class*='slash'], [role='listbox']")
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
		s.note(`journal slash palette labels: ${JSON.stringify(labels)}`);
		const hasReference = labels.some((l) => /reference/i.test(l));
		s.note(`"Reference" command present in journal palette: ${hasReference}`);
		await s.shot(journal, "02-slash-with-reference");

		// Narrow to it and pick it — should insert `!@` and open the page picker.
		await journal.keyboard.type("ref", { delay: 30 }).catch(() => undefined);
		await journal.waitForTimeout(400);
		await s.shot(journal, "03-slash-ref-filtered");
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.waitForTimeout(700);
		const pickerOpen = await journal
			.locator('[class*="transclusion"], [class*="typeahead"], [role="listbox"]')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`transclusion page-picker opened after picking Reference: ${pickerOpen}`);
		await s.shot(journal, "04-reference-picker-open");

		// Try an entity query (Clients resolved as a mention in 155).
		await journal.keyboard.type("Clients", { delay: 40 }).catch(() => undefined);
		await journal.waitForTimeout(700);
		await s.shot(journal, "05-reference-query");
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.waitForTimeout(600);
		const transclusionEls = await journal
			.locator('[class*="transclusion"], [data-transclusion], [class*="block-embed"]')
			.count()
			.catch(() => 0);
		s.note(`transclusion/embed nodes in body after pick: ${transclusionEls}`);
		await s.shot(journal, "06-reference-inserted");

		s.chat(
			SPEAKER.Priya,
			"Tried the Reference block in my log — pulling my read on whether it opened the page picker and dropped a live reference from the captures.",
		);
		s.note(
			"Priya verified F-070 rung (c) — the Reference/transclusion slash command in the Journal; verdict from captures + labels.",
		);
	} finally {
		await s.finish();
	}
});
