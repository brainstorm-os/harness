/**
 * Session 312 — verify the blank-recovery refactor (2026-06-20) on Notes:
 * its editor mount moved off the same-id key-nonce bump onto the shared
 * `useBlankRecoveryGap` (stable `key={note.id}` + unmount gap). Drives the
 * persistent Northbound vault (real notes with real Y.Doc bodies): open Notes,
 * switch between the first several sidebar notes repeatedly, and record whether
 * each note's editor body renders or goes blank. Factual capture only.
 */

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function editorText(page: Page): Promise<string> {
	return page
		.locator(".notes__contenteditable")
		.first()
		.innerText()
		.catch(() => "(no editor)");
}

test("notes switch — blank editor check (312)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("312-notes-switch-blank");
	try {
		const page = await s.openApp(APP.Notes);
		await page.waitForTimeout(2600);
		s.note("\n### notes — switch blank check (accumulated vault)");

		const rows = page.locator(".notes__sidebar-item");
		const total = await rows.count();
		const n = Math.min(total, 5);
		s.note(`sidebar notes: ${total} (probing first ${n})`);

		// Pass 1: open each of the first N notes, record body length / blank.
		for (let i = 0; i < n; i++) {
			await rows.nth(i).click();
			await page.waitForTimeout(1100);
			await s.shot(page, `open-${i}`);
			const txt = await editorText(page);
			const blank = txt.trim().length === 0;
			s.note(
				`open ${i}: len=${txt.length} blank=${blank} preview="${txt.slice(0, 40).replace(/\n/g, " ")}"`,
			);
		}

		// Pass 2: bounce between the first two notes — the switch path that the
		// key/gapped change governs.
		if (n >= 2) {
			for (let round = 1; round <= 4; round++) {
				for (const i of [0, 1]) {
					await rows.nth(i).click();
					await page.waitForTimeout(900);
					const txt = await editorText(page);
					const blank = txt.trim().length === 0;
					s.note(`round ${round} note ${i}: len=${txt.length} blank=${blank}`);
					if (blank) await s.shot(page, `BLANK-r${round}-n${i}`);
				}
			}
		}
	} finally {
		await s.finish();
	}
});
