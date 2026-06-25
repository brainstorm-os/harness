/**
 * Session 221 — verify the right-panel inspector cover is consistent across
 * apps after the consistency fix. The three inspector cover hosts
 * (`.db-inspector__cover`, `.books__cover`, `.inspector__preview-cover`) should
 * now share aspect 16/6 + `--radius-md` + flex-shrink:0. Measures the computed
 * aspect-ratio + border-radius of each and crops the cover for eyeballing.
 */

import { type Page, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function measure(page: Page, selector: string): Promise<unknown> {
	return page.evaluate((sel) => {
		const host = document.querySelector(sel) as HTMLElement | null;
		if (!host) return { selector: sel, found: false };
		const cs = getComputedStyle(host);
		const inner = host.querySelector("img, div, span") as HTMLElement | null;
		const innerCs = inner ? getComputedStyle(inner) : null;
		const rect = host.getBoundingClientRect();
		return {
			selector: sel,
			found: true,
			borderRadius: cs.borderRadius,
			flexShrink: cs.flexShrink,
			overflow: cs.overflow,
			hostAspect: cs.aspectRatio,
			innerAspect: innerCs?.aspectRatio ?? null,
			innerRadius: innerCs?.borderRadius ?? null,
			renderedWH: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
			ratio: rect.height ? Math.round((rect.width / rect.height) * 100) / 100 : null,
		};
	}, selector);
}

test("inspector covers are consistent across Database / Books / Files (221)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("221-cover-consistency");
	try {
		// ── Database inspector ──────────────────────────────────────────────
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2500);
		await db
			.locator("#list-nav .db-sidebar__list-name")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);
		await db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head)")
			.first()
			.dblclick()
			.catch(() => undefined);
		await db.waitForTimeout(1200);
		const dbCover = db.locator(".db-inspector__cover").first();
		s.note(`Database cover: ${JSON.stringify(await measure(db, ".db-inspector__cover"))}`);
		if (await dbCover.count()) await s.shot(db, "01-db-inspector-cover", dbCover);
		await s.shot(db, "01b-db-full");

		// ── Books inspector ─────────────────────────────────────────────────
		const books = await s.openApp(APP.Books);
		await books.waitForTimeout(2500);
		await books
			.locator(".books__shelf-item, .books__list-row, [data-entity-id]")
			.first()
			.click()
			.catch(() => undefined);
		await books.waitForTimeout(1400);
		const booksCover = books.locator(".books__cover").first();
		s.note(`Books cover: ${JSON.stringify(await measure(books, ".books__cover"))}`);
		if (await booksCover.count()) await s.shot(books, "02-books-inspector-cover", booksCover);
		await s.shot(books, "02b-books-full");

		// ── Files inspector ─────────────────────────────────────────────────
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(2500);
		await files
			.locator(".files__row, .files__item, [data-entity-id]")
			.first()
			.click()
			.catch(() => undefined);
		await files.waitForTimeout(1400);
		const filesCover = files.locator(".inspector__preview-cover").first();
		s.note(`Files cover: ${JSON.stringify(await measure(files, ".inspector__preview-cover"))}`);
		if (await filesCover.count()) await s.shot(files, "03-files-inspector-cover", filesCover);
		await s.shot(files, "03b-files-full");
	} finally {
		await s.finish();
	}
});
