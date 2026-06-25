/**
 * Session 156 — Marcus re-checks F-070 rung (a): the shared catalogue now
 * carries descriptions, so the Journal/Tasks slash menu should read like Notes'
 * (label + one-line caption per block), not bare labels.
 *
 * He opens the block (`/`) menu in Journal and Tasks, captures it, and counts
 * the `.fm-row__caption` description elements — if they're present and match
 * the canonical strings, the presentation half of F-070 is closed. Light
 * single-"/" probe per app; verdict from the captures + the caption counts.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type FounderSession, SPEAKER, startSession } from "../lib/founder";

async function openSlashAndReadCaptions(
	page: Page,
	s: FounderSession,
	shotLabel: string,
): Promise<{ captions: number; sample: string[] }> {
	await page.keyboard.press("Meta+ArrowDown").catch(() => undefined);
	await page.keyboard.press("End").catch(() => undefined);
	await page.keyboard.type("x", { delay: 20 }).catch(() => undefined); // force caret
	await page.keyboard.press("Enter").catch(() => undefined);
	await page.keyboard.type("/", { delay: 20 }).catch(() => undefined);
	await page.waitForTimeout(700);
	const captions = await page
		.locator(".bs-editor__slash-menu .fm-row__caption, [class*='slash'] [class*='caption']")
		.count()
		.catch(() => 0);
	const sample = await page
		.locator(".bs-editor__slash-menu .fm-row__caption, [class*='slash'] [class*='caption']")
		.allInnerTexts()
		.then((xs) =>
			xs
				.map((t) => t.replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 6),
		)
		.catch(() => [] as string[]);
	await s.shot(page, shotLabel);
	await page.keyboard.press("Backspace").catch(() => undefined); // "/"
	await page.keyboard.press("Backspace").catch(() => undefined); // "x"
	await page.keyboard.press("Backspace").catch(() => undefined); // empty line
	return { captions, sample };
}

test("Marcus verifies F-070 descriptions rung in Journal + Tasks (156)", async () => {
	test.setTimeout(240_000);
	const s: FounderSession = await startSession("156-marcus-verify-f070-descriptions");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Kai says the shared block menu got its descriptions back. Checking the Journal and Tasks slash menus read like Notes' now — label plus a caption per block, not bare labels.",
		);

		// --- Journal ---
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1800);
		await journal
			.locator(".journal__entry-editor")
			.first()
			.click()
			.catch(() => undefined);
		const j = await openSlashAndReadCaptions(journal, s, "01-journal-slash");
		s.note(`Journal slash captions: count=${j.captions} sample=${JSON.stringify(j.sample)}`);

		// --- Tasks (open first task on its detail route) ---
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await tasks
			.locator("[data-task-id] .task-row__name")
			.first()
			.click()
			.catch(() => undefined);
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.click()
			.catch(() => undefined);
		const tk = await openSlashAndReadCaptions(tasks, s, "02-tasks-slash");
		s.note(`Tasks slash captions: count=${tk.captions} sample=${JSON.stringify(tk.sample)}`);

		s.chat(
			SPEAKER.Marcus,
			"Pulled the block menus in both — reading the captures to confirm the captions are there and read right.",
		);
		s.note(
			"Marcus verified F-070 rung (a) descriptions in Journal/Tasks slash menus; verdict from captures + caption counts.",
		);
	} finally {
		await s.finish();
	}
});
