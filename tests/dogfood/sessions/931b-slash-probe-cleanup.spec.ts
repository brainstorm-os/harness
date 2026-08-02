/**
 * Probe 931b — tidy after probe 931. The slash-sections probe runs left a
 * handful of junk notes in the Northbound vault (a "/"-titled note from a
 * title-focus race, two stray Untitleds, a truncated "sections probe").
 * Delete exactly those via right-click → "Delete note" (Bin-recoverable).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const JUNK_TITLES = ["/", "sections probe", "Slash sections probe", "Sections verified."] as const;
const JUNK_UNTITLED = /^Untitled · 19:1\d$/;

test("931b — delete the probe-run junk notes", async () => {
	test.setTimeout(240_000);
	const s = await startSession("931b-slash-probe-cleanup");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await s.shot(notes, "01-before");

		let deleted = 0;
		let guard = 0;
		while (guard++ < 12) {
			const rows = notes.locator(".notes__sidebar [role='option'], .notes__sidebar li, aside li");
			const count = await rows.count();
			let target = null as import("@playwright/test").Locator | null;
			for (let i = 0; i < count; i++) {
				const row = rows.nth(i);
				const text = ((await row.textContent()) ?? "").trim();
				if (
					(JUNK_TITLES as readonly string[]).includes(text) ||
					JUNK_UNTITLED.test(text)
				) {
					target = row;
					break;
				}
			}
			if (!target) break;
			const label = ((await target.textContent()) ?? "").trim();
			await target.click({ button: "right", force: true });
			await notes.waitForTimeout(450);
			const del = notes.locator('[role="menu"] .fm-row', { hasText: "Delete note" }).first();
			if ((await del.count()) === 0) {
				s.note(`no Delete row for "${label}" — stopping`);
				await notes.keyboard.press("Escape").catch(() => undefined);
				break;
			}
			await del.click();
			await notes.waitForTimeout(800);
			// A confirm dialog, if any, commits on Enter.
			await notes.keyboard.press("Enter").catch(() => undefined);
			await notes.waitForTimeout(600);
			deleted += 1;
			s.note(`deleted "${label}"`);
		}
		s.note(`deleted ${deleted} junk notes`);
		await s.shot(notes, "02-after");
	} finally {
		await s.finish();
	}
});
