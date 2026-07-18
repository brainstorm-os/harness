/** Session 906e — wipe the 906* probe residue from today's Journal entry. */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("journal probe-residue cleanup (906e)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("906e-journal-cleanup");
	try {
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(2500);
		const editor = journal.locator('[contenteditable="true"]').first();
		await editor.click();
		await journal.keyboard.press("Meta+A");
		await journal.keyboard.press("Backspace");
		await journal.waitForTimeout(600);
		let left = await editor.evaluate((el) => (el.textContent ?? "").trim());
		s.note(`[cleanup] after Meta+A+Backspace: "${left}" — ${left ? "select-all did NOT clear the entry (falling back to char deletes)" : "clean"}`);
		if (left) {
			await editor.click();
			await journal.keyboard.press("End");
			for (let i = 0; i < left.length + 6; i++) await journal.keyboard.press("Backspace");
			await journal.waitForTimeout(400);
		}
		const text = await editor.evaluate((el) => (el.textContent ?? "").trim());
		s.note(`[cleanup] today's entry body after wipe: "${text}" (want empty)`);
		await s.shot(journal, "journal-clean");
		await journal.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
