/**
 * Session 206 — Priya stress-tests the new reading surfaces: the Books
 * reader (9.21.1.5 preview drop + 9.21.3 typography + 9.21.4 highlights)
 * and the Bookmarks typed metadata (9.18.6 author/publishedAt/notes +
 * 9.18.7 editable Site).
 *
 * Her lens: is the knowledge trustworthy and durable? A highlight that
 * vanishes, a property that doesn't persist, a field she can't fill — all
 * friction.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya reads, highlights, and catalogs her sources (206)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("206-priya-reading-room");
	try {
		s.chat(
			SPEAKER.Priya,
			"Two things to verify today: the new Books reader (can I highlight and keep my reading comfortable) and whether Bookmarks finally records author/date/notes like a real citation store.",
		);

		// ---- Books -------------------------------------------------------
		const books = await s.openApp(APP.Books);
		await books.waitForTimeout(2500);
		await s.shot(books, "01-books-open");

		// Page through a couple of pages.
		const next = books.locator(".books__nav-btn").last();
		for (let i = 0; i < 2; i++) {
			await next.click().catch(() => undefined);
			await books.waitForTimeout(500);
		}
		await s.shot(books, "02-paged-forward");

		// Typography panel: open, switch family + theme, bump size.
		const typeBtn = books.locator(".books__type-btn").first();
		if (await typeBtn.isVisible().catch(() => false)) {
			await typeBtn.click().catch(() => undefined);
			await books.waitForTimeout(800);
			await s.shot(books, "03-typography-panel");
			const segs = books.locator(".books__type-seg");
			const segCount = await segs.count().catch(() => 0);
			s.note(`typography segmented options: ${segCount}`);
			if (segCount > 1)
				await segs
					.nth(1)
					.click()
					.catch(() => undefined);
			const stepperUp = books.locator(".books__type-stepper button").last();
			await stepperUp.click().catch(() => undefined);
			await stepperUp.click().catch(() => undefined);
			await books.waitForTimeout(600);
			await s.shot(books, "04-typography-changed");
			await books.keyboard.press("Escape").catch(() => undefined);
			await books.waitForTimeout(400);
			await s.shot(books, "05-reading-with-new-type");
			s.chat(
				SPEAKER.Priya,
				"Serif + larger size — the reader respects my eyes. Checking highlights next.",
			);
		} else {
			s.note("typography (Aa) button not found");
		}

		// Select a paragraph and try to highlight it.
		const para = books.locator(".books__paragraph").first();
		if (await para.isVisible().catch(() => false)) {
			await para.click({ clickCount: 3 }).catch(() => undefined);
			await books.waitForTimeout(800);
			await s.shot(books, "06-selection-made");
			// Whatever affordance appears for "create highlight" — dialog or button.
			const createBtn = books.locator('[role="dialog"] button, [aria-label*="highlight" i]').first();
			if (await createBtn.isVisible().catch(() => false)) {
				await createBtn.click().catch(() => undefined);
				await books.waitForTimeout(800);
				await s.shot(books, "07-highlight-created");
			} else {
				s.note("no highlight affordance appeared after selecting a paragraph");
			}
		}

		// Open the highlights panel.
		const hlBtn = books.locator('[aria-haspopup="dialog"]').last();
		await hlBtn.click().catch(() => undefined);
		await books.waitForTimeout(800);
		await s.shot(books, "08-highlights-panel");
		await books.keyboard.press("Escape").catch(() => undefined);

		// ---- Bookmarks: typed metadata ------------------------------------
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2500);
		await s.shot(bm, "09-bookmarks-open");

		// Open the first bookmark's detail.
		const card = bm
			.locator('[class*="card"], [class*="row"], a, article')
			.filter({ hasText: /example|stratechery|benedict|newsletter|domain/i })
			.first();
		const anyCard = (await card.isVisible().catch(() => false))
			? card
			: bm.locator('[class*="card"]').first();
		await anyCard.click().catch(() => undefined);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "10-bookmark-detail");

		// Toggle the properties panel (detail-route pattern: header icon).
		const propsToggle = bm
			.locator('[aria-label*="propert" i], [aria-label*="inspector" i], [aria-label*="details" i]')
			.first();
		if (await propsToggle.isVisible().catch(() => false)) {
			await propsToggle.click().catch(() => undefined);
			await bm.waitForTimeout(1000);
		}
		await s.shot(bm, "11-properties-panel");

		// Inventory the property labels Priya can see.
		const labels = await bm
			.locator(".bs-props, [class*='props'], [class*='propert']")
			.first()
			.textContent()
			.catch(() => null);
		s.note(`properties panel text: ${labels?.slice(0, 400) ?? "(none)"}`);

		// Fill author + notes + publishedAt if the fields are editable.
		const fillField = async (labelPattern: RegExp, value: string, shotName: string) => {
			const row = bm.locator("[class*='prop']").filter({ hasText: labelPattern }).first();
			if (!(await row.isVisible().catch(() => false))) {
				s.note(`property row ${labelPattern} not found`);
				return;
			}
			await row.click().catch(() => undefined);
			await bm.waitForTimeout(400);
			const input = bm.locator("input:focus, textarea:focus, [contenteditable='true']:focus").first();
			if ((await input.count().catch(() => 0)) > 0) {
				await bm.keyboard.type(value, { delay: 12 });
				await bm.keyboard.press("Enter").catch(() => undefined);
				await bm.waitForTimeout(500);
				await s.shot(bm, shotName);
			} else {
				s.note(`clicking ${labelPattern} row focused no editor`);
				await s.shot(bm, `${shotName}-noeditor`);
			}
		};
		await fillField(/author/i, "Jan Leike", "12-author-filled");
		await fillField(/published/i, "2026-05-21", "13-published-filled");
		await fillField(/note/i, "Methodology solid; cite in Issue #5.", "14-notes-filled");
		await fillField(/site/i, "Example Press", "15-site-renamed");

		// Persistence check: leave the detail and come back.
		await bm.keyboard.press("Escape").catch(() => undefined);
		const back = bm.locator('[aria-label*="back" i]').first();
		await back.click().catch(() => undefined);
		await bm.waitForTimeout(1000);
		await anyCard.click().catch(() => undefined);
		await bm.waitForTimeout(1200);
		await s.shot(bm, "16-detail-after-roundtrip");

		s.chat(
			SPEAKER.Priya,
			"Reading room session done — highlights and citation metadata both probed; whatever didn't hold goes in the log.",
		);
	} finally {
		await s.finish();
	}
});
