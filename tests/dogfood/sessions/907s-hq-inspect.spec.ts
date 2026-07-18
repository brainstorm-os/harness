/** Session 907s — inspect the damaged HQ note: sidebar titles + body dump. */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("inspect HQ state (907s)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("907s-hq-inspect");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		const rows = await notes
			.evaluate(() =>
				Array.from(document.querySelectorAll('[class*="sidebar"] [class*="row"], nav li, [class*="notes__list"] *'))
					.map((el) => (el.textContent ?? "").trim())
					.filter((t) => t.length > 0 && t.length < 60)
					.slice(0, 20),
			)
			.catch(() => [] as string[]);
		s.note(`[notes] sidebar rows: ${JSON.stringify([...new Set(rows)].slice(0, 12))}`);
		await s.shot(notes, "sidebar");
		const north = notes.locator("text=/Northbound/").first();
		if ((await north.count()) > 0) {
			await north.click();
			await notes.waitForTimeout(1000);
			const title = await notes.locator(".notes__title").first().textContent().catch(() => "");
			const body = ((await notes.locator('[contenteditable="true"]').first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
			s.note(`[notes] first Northbound note: title="${title}" body="${body.slice(0, 300)}"`);
			await s.shot(notes, "north-note");
		} else s.note("[notes] no note containing 'Northbound' found at all");
	} finally {
		await s.finish();
	}
});
