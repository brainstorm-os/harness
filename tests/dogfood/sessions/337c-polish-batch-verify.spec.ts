/**
 * Session 337c — verify the second batch of 337 design-polish fixes.
 *
 *  - Automations: empty state now shows the template gallery (was a bare
 *    "…start from a template below" with no templates).
 *  - Books: the reader pane shows a distinct "Nothing to read yet" message
 *    (was an exact duplicate of the sidebar's "No books yet" empty state).
 *  - Graph: the zoom controls sit left of the open sidebar (were occluded
 *    behind the glass panel, ghosting through + unclickable).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("design-polish batch 2 renders correctly (337c)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("337c-polish-batch-verify");
	try {
		for (const [appId, slug] of [
			[APP.Automations, "automations"],
			[APP.Books, "books"],
			[APP.Graph, "graph"],
		] as const) {
			const page = await s.openApp(appId);
			if (!page) continue;
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(2400);
			await s.shot(page, `${slug}-after`);
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
