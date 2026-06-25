/**
 * Session 337b — verify the empty-state CTA polish.
 *
 * The 337 sweep found Chat's "New channel" and Code Editor's "New file"
 * empty-state CTAs rendering off-system (Chat used the phantom
 * `.bs-btn--primary` class → bare text; Code Editor used an app-local ghost
 * class). Both now use the canonical glossy primary (`.bs-btn` +
 * `data-bs-primary`). This opens each app and captures the empty state so the
 * glossy face can be eyeballed against Contacts/Books/Mailbox.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("empty-state CTAs render the glossy primary (337b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("337b-empty-cta-verify");
	try {
		for (const [appId, slug] of [
			[APP.Chat, "chat"],
			[APP.CodeEditor, "code-editor"],
		] as const) {
			const page = await s.openApp(appId);
			if (!page) continue;
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(2000);
			await s.shot(page, `${slug}-empty`);
			if (errs.errors.length > 0) {
				s.note(`[?] ${slug} console errors (${errs.errors.length}):`);
				for (const e of errs.errors.slice(0, 6)) s.note(`    ${e}`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300).catch(() => undefined);
		}
	} finally {
		await s.finish();
	}
});
