/**
 * Session 311 — repro (user report 2026-06-20): "switching rollups in journal
 * in the left menu breaks the editor again" → the periodic-rollup day-body
 * editor goes BLANK. Reported on the accumulated dogfood vault (not a fresh
 * seed), so this drives the persistent Northbound workspace: open Journal,
 * open each left-nav rollup, then bounce between them and record whether the
 * editor body renders or goes blank. Factual capture only — console.log +
 * screenshots; verdict in triage.
 */

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function editorText(page: Page): Promise<string> {
	return page
		.locator(".journal__entry-editor")
		.first()
		.innerText()
		.catch(() => "(no editor)");
}

const LABELS = ["thisWeek", "lastWeek", "thisMonth", "lastMonth"];

test("journal rollup switch — blank editor repro (311)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("311-journal-rollup-blank");
	try {
		const page = await s.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		s.note("\n### journal — rollup switch blank repro (accumulated vault)");

		// Ensure the left nav (with the Rollups strip) is open.
		const navOpen = await page.locator(".journal[data-nav-open='true']").count();
		if (navOpen === 0) {
			await page
				.locator("[aria-controls='journal-nav']")
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(400);
		}

		const rollups = page.locator(".journal__rollup-btn");
		const n = await rollups.count();
		s.note(`rollup buttons: ${n}`);

		// Pass 1: open each rollup fresh, record body length / blank.
		for (let i = 0; i < n; i++) {
			await rollups.nth(i).click();
			await page.waitForTimeout(1600);
			await s.shot(page, `open-${LABELS[i] ?? i}`);
			const txt = await editorText(page);
			const blank = txt.trim().length === 0;
			s.note(
				`open ${LABELS[i] ?? i}: len=${txt.length} blank=${blank} preview="${txt
					.slice(0, 48)
					.replace(/\n/g, " ")}"`,
			);
		}

		// Pass 2: bounce between rollups — the reported "switching breaks it".
		for (let round = 1; round <= 3; round++) {
			for (let i = 0; i < n; i++) {
				await rollups.nth(i).click();
				await page.waitForTimeout(1200);
				const txt = await editorText(page);
				const blank = txt.trim().length === 0;
				s.note(`round ${round} ${LABELS[i] ?? i}: len=${txt.length} blank=${blank}`);
				if (blank) await s.shot(page, `BLANK-r${round}-${LABELS[i] ?? i}`);
			}
		}

		// Pass 3: rollup → day entry → rollup (shared island path).
		await page
			.locator(".journal__overview-btn")
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(1200);
		s.note(`after day-entry: len=${(await editorText(page)).length}`);
		await rollups.nth(0).click();
		await page.waitForTimeout(1400);
		const back = await editorText(page);
		s.note(`back to rollup 0: len=${back.length} blank=${back.trim().length === 0}`);
		await s.shot(page, "back-to-rollup");
	} finally {
		await s.finish();
	}
});
