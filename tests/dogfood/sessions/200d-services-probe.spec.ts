/** Session 200d — dev probe: which services does the Notes renderer see?
 *  (Why is the comments adapter null in the real shell — missing `entities`?) */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("notes service surface probe (200d)", async () => {
	test.setTimeout(120_000);
	const s = await startSession("200d-services-probe");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const keys = await notes.evaluate(() => {
			const bs = (window as unknown as { brainstorm?: { services?: Record<string, unknown> } })
				.brainstorm;
			return bs?.services ? Object.keys(bs.services) : null;
		});
		s.note(`notes services: ${JSON.stringify(keys)}`);
	} finally {
		await s.finish();
	}
});
