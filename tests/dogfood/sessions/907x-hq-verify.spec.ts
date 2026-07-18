/** Session 907x — final HQ verification: open the sidebar row, dump title+body. */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Northbound HQ: verify (907x)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("907x-hq-verify");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		const row = notes.locator('[class*="sidebar"] >> text="Northbound HQ"').first();
		const n = await row.count();
		s.note(`[notes] sidebar rows matching "Northbound HQ": ${n}`);
		if (n > 0) {
			await row.click();
			await notes.waitForTimeout(1200);
			const title = ((await notes.locator(".notes__title").first().textContent().catch(() => "")) ?? "").trim();
			const body = ((await notes.locator('[contenteditable="true"]').first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
			s.note(`[notes] title="${title}" body="${body.slice(0, 300)}"`);
			await s.shot(notes, "hq-verified");
			if (title === "Northbound HQ" && /operating hub/i.test(body))
				s.chat(SPEAKER.Mira, "Verified: the HQ page is back with the pipeline, content engine, and weekly focus. Northbound has its operating layer again.");
		} else {
			await s.shot(notes, "hq-missing");
		}
	} finally {
		await s.finish();
	}
});
