/**
 * Session 098 — verify F-044: the sticky placeholder is now legible.
 *
 * Marcus flagged (097) the empty sticky's "New note" placeholder as near-
 * invisible — the global `--text-faint` light grey on a yellow sticky. The fix
 * inks the placeholder as a muted dark grey on stickies. This re-captures the
 * board's empty stickies so the placeholder legibility can be confirmed.
 *
 * Runs against a whiteboard bundle rebuilt with the fix (SKIP_BUILD install).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("sticky placeholder is legible (F-044)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("098-f044-sticky-placeholder");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(1500);
		const stickies = await wb.locator(".whiteboard__node--sticky").count();
		s.note(`stickies on board: ${stickies}`);
		await s.shot(wb, "01-sticky-placeholder");
		s.note("captured for F-044 legibility check (placeholder now muted dark ink on yellow)");
	} finally {
		await s.finish();
	}
});
