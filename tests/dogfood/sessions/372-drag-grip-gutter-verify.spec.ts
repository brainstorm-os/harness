/**
 * Session 372 — drag-grip gutter (DND-grip-1).
 *
 * Reported: the reorder drag-handle grip "sticks to the content" in every
 * list/table interface — the hover-revealed grip is absolutely positioned over
 * the first cell with NO reserved gutter, so its 16px box overlaps the row's
 * leading content (status glyph / title). Affects the two overlay-grip
 * surfaces: Database grid rows (.dbv-grid__drag-grip) + Files content rows
 * (.content-row__drag-grip).
 *
 * This measures the grip box vs the first cell's leading content so the
 * overlap (grip.right - content.left) can be read directly, and screenshots
 * the hovered row. A clean fix lands the grip fully LEFT of the content with a
 * positive gap (grip.right <= content.left).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("drag grip clears row content in Database + Files (372)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("372-drag-grip-gutter-verify");
	try {
		// ── Database grid ──
		const db = await s.openApp(APP.Database);
		const dbErrs = collectConsoleErrors(db);
		await db.waitForTimeout(1500);
		await db
			.locator(".db-sidebar__list-item", { hasText: /Content Calendar/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		await db.locator(".db-tab", { hasText: /Grid/i }).first().click().catch(() => undefined);
		await db.waitForTimeout(800);

		const dbRow = db.locator(".dbv-grid__row").nth(1); // first data row (0 = header)
		await dbRow.hover().catch(() => undefined);
		await db.waitForTimeout(300);
		const dbm = await db
			.evaluate(() => {
				const row = document.querySelectorAll(".dbv-grid__row")[1];
				if (!row) return null;
				const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
				const round = (x: number) => Math.round(x);
				const grip = r(row.querySelector(".dbv-grid__drag-grip"));
				const cell = row.querySelector(".dbv-grid__cell:not(.dbv-grid__cell--num)") as HTMLElement | null;
				const cellRect = r(cell);
				// Content start = first cell's left edge + its inline-start padding.
				const pad = cell ? Number.parseFloat(getComputedStyle(cell).paddingInlineStart) : 0;
				const contentLeft = cellRect ? cellRect.left + pad : null;
				if (!grip || contentLeft == null) return null;
				return {
					gripLeft: round(grip.left),
					gripRight: round(grip.right),
					contentLeft: round(contentLeft),
					gap: round(contentLeft - grip.right),
				};
			})
			.catch(() => null);
		s.note(
			`[database] grip ${dbm?.gripLeft}–${dbm?.gripRight}px · content.left=${dbm?.contentLeft}px · gap(content.left−grip.right)=${dbm?.gap}px (want > 0)`,
		);
		// Force every grip visible (the on-hover opacity won't survive a
		// screenshot) so the gutter placement is unambiguous in the capture.
		await db.addStyleTag({ content: ".bs-drag-grip{opacity:1 !important}" }).catch(() => undefined);
		await db.waitForTimeout(150);
		await s.shot(db, "database-row-hover", dbRow);
		await s.shot(db, "database-full");
		if (dbErrs.errors.length > 0) for (const e of dbErrs.errors.slice(0, 4)) s.note(`    db: ${e}`);

		// ── Files content list ──
		const files = await s.openApp(APP.Files);
		const fErrs = collectConsoleErrors(files);
		await files.waitForTimeout(2000);
		const fRow = files.locator(".content-row").first();
		await fRow.hover().catch(() => undefined);
		await files.waitForTimeout(300);
		const fm = await files
			.evaluate(() => {
				const row = document.querySelector(".content-row");
				if (!row) return null;
				const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
				const round = (x: number) => Math.round(x);
				const grip = r(row.querySelector(".content-row__drag-grip"));
				// First VISIBLE in-flow child after the grip (skip the grips and the
				// icon glyph host, which collapses to a 0-rect when the file has no
				// own icon — that would read as content.left=0).
				const kids = Array.from(row.children).filter(
					(el) =>
						!el.classList.contains("content-row__drag-grip") &&
						!el.classList.contains("content-row__export-grip") &&
						(el as HTMLElement).getBoundingClientRect().width > 0,
				);
				const firstRect = kids[0] ? (kids[0] as HTMLElement).getBoundingClientRect() : null;
				if (!grip || !firstRect) return null;
				return {
					gripLeft: round(grip.left),
					gripRight: round(grip.right),
					contentLeft: round(firstRect.left),
					gap: round(firstRect.left - grip.right),
				};
			})
			.catch(() => null);
		s.note(
			`[files] grip ${fm?.gripLeft}–${fm?.gripRight}px · content.left=${fm?.contentLeft}px · gap(content.left−grip.right)=${fm?.gap}px (want > 0)`,
		);
		await files.addStyleTag({ content: ".bs-drag-grip{opacity:1 !important}" }).catch(() => undefined);
		await files.waitForTimeout(150);
		await s.shot(files, "files-row-hover", fRow);
		await s.shot(files, "files-full");
		if (fErrs.errors.length > 0) for (const e of fErrs.errors.slice(0, 4)) s.note(`    files: ${e}`);
	} finally {
		await s.finish();
	}
});
