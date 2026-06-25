/**
 * Session 155 — Priya does real knowledge work in the Journal now that it
 * shares the full editor.
 *
 * The unification enabled @-mentions + transclusion in Journal/Tasks (was a
 * "light" journal editor). Priya — knowledge-layer lens — writes a cited daily
 * research log, then tries the two things her work depends on: (1) @-mention a
 * source/entity inline so it resolves to a real object, and (2) reach for an
 * embed/transclusion via the slash menu to pull the live pipeline into her log.
 * F-070 found the Journal block palette is a subset (no embed/image/etc.) — so
 * this is the knowledge-work angle on that: can she actually reference and
 * embed in a journal entry, or does the curated subset block real cross-surface
 * knowledge work?
 *
 * Body writing uses the reliable journal dev hook (`appendParagraph`). The
 * mention + slash probes are light synthetic keyboard (the documented
 * single-token mention technique; a single "/" for the palette read). Spec is
 * intent + neutral progress only; the friction verdict is decided from the
 * captures + the extracted slash-menu labels afterward.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type JournalDev = {
	appendParagraph: (text: string) => Promise<void>;
	currentEntryId: () => string | null;
};

test("Priya does cited knowledge work in the shared-editor Journal (155)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("155-priya-journal-knowledge");
	try {
		s.chat(
			SPEAKER.Priya,
			"Journal's on the full editor now — going to write today's research log and actually try to cite a source inline and pull the live pipeline in. If I can't reference or embed in my own log, that's the gap.",
		);

		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await s.shot(journal, "01-journal-open");

		// Today's entry exists from session 151; if it's a placeholder, a seed
		// keystroke mints + swaps in the live editor (per 151's handoff note).
		await journal
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await journal.keyboard.type("Research log", { delay: 20 }).catch(() => undefined);
		await journal
			.locator(".journal__entry-editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await journal.waitForTimeout(800);

		const entryId = await journal
			.evaluate(() => {
				const dev = (window as unknown as { __brainstormJournalDev?: JournalDev })
					.__brainstormJournalDev;
				return dev?.currentEntryId() ?? null;
			})
			.catch(() => null);
		s.note(entryId ? `journal entry id: ${entryId}` : "FRICTION? no journal dev hook / entry id");

		// Real cited research-log content via the reliable dev hook.
		const wrote = await journal
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormJournalDev?: JournalDev })
					.__brainstormJournalDev;
				if (!dev) return false;
				await dev.appendParagraph(
					"Source pass — re-read the distribution-moats literature against Issue #3's owned-channel claim; two of four sources actually support the wedge, the other two are about retention not acquisition.",
				);
				await dev.appendParagraph(
					"Want to anchor this log to the live evidence: the Clients pipeline (which advisory accounts the wedge came from) and the source I'm leaning on hardest.",
				);
				return true;
			})
			.catch(() => false);
		s.note(wrote ? "journal research log written via dev hook" : "FRICTION? appendParagraph failed");
		await journal.waitForTimeout(400);
		await s.shot(journal, "02-log-written");

		// --- Probe 1: inline @-mention of a source/entity. Documented technique:
		// type only the pre-space token, then pick the row. A single-word query
		// inserts cleanly; a multi-word title closes the dropdown at the space.
		await journal
			.locator(".journal__entry-editor")
			.first()
			.click()
			.catch(() => undefined);
		await journal.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.keyboard.type("@Clients", { delay: 40 }).catch(() => undefined);
		await journal.waitForTimeout(800);
		const mentionMenuVisible = await journal
			.locator('[class*="mention"], [class*="typeahead"], [role="listbox"]')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`@-mention typeahead opened in journal: ${mentionMenuVisible}`);
		await s.shot(journal, "03-mention-typeahead");
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.waitForTimeout(500);
		await s.shot(journal, "04-mention-picked");
		const mentionEls = await journal
			.locator('[class*="mention"], [data-mention], a[href*="entity"]')
			.count()
			.catch(() => 0);
		s.note(`mention-like elements in body after pick: ${mentionEls}`);

		// --- Probe 2: is an embed / transclusion reachable from the journal
		// slash palette? Read back the labels so we can see exactly what blocks
		// the journal offers (F-070 said it's a subset missing embed).
		await journal
			.locator(".journal__entry-editor")
			.first()
			.click()
			.catch(() => undefined);
		await journal.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.keyboard.type("/", { delay: 20 }).catch(() => undefined);
		await journal.waitForTimeout(700);
		const slashLabels = await journal
			.locator('[class*="slash"], [class*="typeahead"], [class*="block-menu"], [role="listbox"]')
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
		s.note(`journal slash palette labels: ${JSON.stringify(slashLabels)}`);
		const hasEmbed = slashLabels.some((l) => /embed|transclu|reference|sync|mention/i.test(l));
		s.note(`journal palette exposes an embed/reference block: ${hasEmbed}`);
		await s.shot(journal, "05-slash-palette");
		// Clean up the stray "/".
		await journal.keyboard.press("Backspace").catch(() => undefined);

		s.chat(
			SPEAKER.Priya,
			"Logged the day and tried to cite + embed in it — pulling my read on whether referencing and embedding actually work in a journal entry from the captures.",
		);
		s.note(
			"Priya did cited knowledge work in the shared-editor journal (mention + embed probes); verdict from captures + labels.",
		);
	} finally {
		await s.finish();
	}
});
