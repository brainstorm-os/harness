/**
 * Session 003 — verify F-003 fix in the real shell.
 *
 * The seeded journal entry's body contains an inline @-mention. Before the
 * fix the journal registered `mention` as a TextNode (the seeder plants it as
 * a DecoratorNode), so @lexical/yjs threw #83 and the body rolled back blank.
 * This opens Journal in the production build and asserts the seeded body text
 * now reaches the DOM. The harness's console capture is checked for #83
 * separately.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("journal body renders the seeded mention (F-003)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("003-journal-fix-check");
	try {
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(2500);
		await s.shot(journal, "journal-today");

		const bodyText = await journal
			.locator(".journal__entry-editor")
			.first()
			.textContent()
			.catch(() => null);
		s.note(`Journal body text: ${JSON.stringify(bodyText)}`);

		// The seeded welcome journal entry body (welcome-content.ts):
		// "Your first journal entry…" + "A good first step: <mention> Take the product tour."
		expect(
			bodyText ?? "",
			"seeded journal body must now render (was blank before the fix)",
		).toContain("Take the product tour");
	} finally {
		await s.finish();
	}
});
