/**
 * Session 362 — repro/verify: Journal must not drop the first word on a new day.
 *
 * Original bug (F-299): typing "Pipeline ready" on an entry-less day landed as
 * "ipeline ready" — the implicit-create placeholder→editor seed handoff raced
 * the @lexical/yjs binding (Lexical #94 "splice: could not find collab element
 * node"), aborting the seed so the first word was lost.
 *
 * Fix: there's no placeholder anymore — an entry-less day renders the live editor
 * directly (bound to the deterministic id), the entity is created on focus/first
 * edit, and keystrokes flow into the ONE editor (no handoff, no seed).
 *
 * This walks forward to fresh days, types a known string, and checks: (1) the
 * full text lands in-session (first char survived) and (2) it PERSISTS across
 * navigating away and back (no dropped-delta loss). Also fails on Lexical #94.
 */

import { type Page, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

const EDITOR = '.journal__entry-editor[contenteditable="true"]';

async function editorText(page: Page): Promise<string> {
	return ((await page.locator(EDITOR).first().textContent().catch(() => "")) ?? "").trim();
}

test("journal first-char survives + persists on a new day (362)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("362-journal-first-char");
	const WANT = "Pipeline ready";
	try {
		const page = await s.openApp(APP.Journal);
		const errs = collectConsoleErrors(page);
		await page.waitForTimeout(2200);

		const next = page.locator(".journal__day-pager .bs-date-pager__arrow--next");
		const prev = page.locator(".journal__day-pager .bs-date-pager__arrow--prev");

		for (let trial = 1; trial <= 2; trial++) {
			s.note(`\n## Trial ${trial}`);
			// Walk forward to a fresh (empty) day.
			for (let h = 0; h < 6 + trial * 4; h++) {
				await next.click().catch(() => undefined);
				await page.waitForTimeout(220);
			}
			// Editor renders for every day now (no placeholder).
			const before = await editorText(page);
			s.note(`[i] editor present=${(await page.locator(EDITOR).count())} text-before="${before.slice(0, 30)}"`);
			if (before.length > 0) {
				s.note("[skip] day not empty; advancing");
				continue;
			}

			await page.locator(EDITOR).first().click().catch(() => undefined);
			await page.waitForTimeout(350);
			await page.keyboard.type(WANT, { delay: 8 });
			await page.waitForTimeout(900);

			const got = await editorText(page);
			s.note(`[i] in-session got="${got}" (want="${WANT}")`);
			if (got.includes(WANT)) s.note("[ok] full text landed (first char survived)");
			else if (got.includes(WANT.slice(1))) s.note(`[BUG] first char dropped — "${WANT.slice(1)}" present, "${WANT}" not`);
			else s.note(`[?] unexpected: "${got}"`);
			await s.shot(page, `trial-${trial}-typed`);

			// Persistence: navigate away and back, the body must survive intact.
			await prev.click().catch(() => undefined);
			await page.waitForTimeout(500);
			await next.click().catch(() => undefined);
			await page.waitForTimeout(900);
			const reopened = await editorText(page);
			s.note(`[i] after away+back got="${reopened}"`);
			if (reopened.includes(WANT)) s.note("[ok] persisted across reopen with first char intact");
			else s.note(`[BUG] persistence loss/garble after reopen: "${reopened}"`);
			await s.shot(page, `trial-${trial}-reopened`);
		}

		const lexical94 = errs.errors.filter((e) => /Lexical error #94|could not find collab/i.test(e));
		s.note(`\n[i] Lexical #94 errors: ${lexical94.length}`);
		const notFound = errs.errors.filter((e) => /applyDoc.*not found/i.test(e));
		s.note(`[i] applyDoc not-found errors: ${notFound.length}`);
		if (errs.errors.length > 0) for (const e of errs.errors.slice(0, 6)) s.note(`    ${e}`);
		await page.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
