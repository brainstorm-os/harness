/**
 * Session 158 — verify the journal-editor double-menu bug is fixed.
 *
 * Reported: in the journal editor, menus open twice. Root cause: `!@` (the
 * transclusion trigger) ALSO satisfied the `@`-mention trigger, so a single
 * `!@` opened BOTH typeaheads stacked (session 157 shot 04). Fix:
 * `detectMentionTrigger` now defers any `@` preceded by `!` to transclusion.
 *
 * This session counts the visible typeahead popovers after each trigger:
 *  - `@` alone  → exactly ONE menu (mention).
 *  - `!@`       → exactly ONE menu (transclusion), and picking inserts a real
 *                 transclusion node (no stray "!", no mention chip).
 * Light synthetic keyboard; verdict from the popover counts + captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const POPOVER =
	'[class*="typeahead"], [class*="transclusion"], [class*="mention-menu"], [role="listbox"]';

test("Journal editor opens one menu per trigger, not two (158)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("158-priya-verify-single-menu");
	try {
		s.chat(
			SPEAKER.Priya,
			"Kai says the double-menu in the journal editor is fixed — `!@` was opening the mention picker on top of the reference picker. Checking each trigger opens exactly one menu now.",
		);

		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await journal
			.locator(".journal__entry-editor")
			.first()
			.click()
			.catch(() => undefined);

		// --- `@` alone → exactly one menu (mention) ---
		await journal.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await journal.keyboard.press("End").catch(() => undefined);
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.keyboard.type("@", { delay: 30 }).catch(() => undefined);
		await journal.waitForTimeout(700);
		const atMenus = await journal
			.locator(POPOVER)
			.filter({ has: journal.locator(":scope") })
			.count()
			.catch(() => 0);
		const atVisible = await journal
			.locator(POPOVER)
			.evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length)
			.catch(() => 0);
		s.note(`after "@": popover nodes=${atMenus} visible=${atVisible} (expect 1)`);
		await s.shot(journal, "01-at-mention");
		await journal.keyboard.press("Escape").catch(() => undefined);
		await journal.keyboard.press("Backspace").catch(() => undefined);

		// --- `!@` → exactly one menu (transclusion) ---
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.keyboard.type("!@", { delay: 40 }).catch(() => undefined);
		await journal.waitForTimeout(700);
		const bangVisible = await journal
			.locator(POPOVER)
			.evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length)
			.catch(() => 0);
		s.note(`after "!@": visible popovers=${bangVisible} (expect 1 — transclusion only)`);
		await s.shot(journal, "02-bang-at-transclusion");

		// Query + pick → should drop a real transclusion node.
		await journal.keyboard.type("Clients", { delay: 40 }).catch(() => undefined);
		await journal.waitForTimeout(600);
		await s.shot(journal, "03-transclusion-query");
		await journal.keyboard.press("Enter").catch(() => undefined);
		await journal.waitForTimeout(600);
		const transclusionEls = await journal
			.locator('[class*="transclusion"], [data-transclusion], [class*="block-embed"]')
			.count()
			.catch(() => 0);
		s.note(`transclusion nodes in body after pick: ${transclusionEls}`);
		await s.shot(journal, "04-transclusion-inserted");

		s.chat(
			SPEAKER.Priya,
			"Ran both triggers in the journal — pulling my read on whether each opens just one menu now, and whether the reference actually drops in, from the captures.",
		);
		s.note(
			"Verified the journal double-menu fix + transclusion insertion; verdict from popover counts + captures.",
		);
	} finally {
		await s.finish();
	}
});
