/**
 * Session 207 — Marcus's detail design review of the surfaces that shipped
 * since his last pass: the Books reader, the Whiteboard's new tools
 * (templates / connector styles / ink), the Bookmarks property panel, and
 * the code-editor's new visual layers (indent guides, bracket match).
 *
 * His method: tight crops of chrome, panels, and states — the screenshots
 * ARE the review artifact. Header parity (44px baseline, ⋯ last), token
 * discipline, focus states, alignment.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus reviews the new surfaces in detail (207)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("207-marcus-new-surfaces-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Four new surfaces shipped without me looking at them. Correcting that now — headers, panels, focus states, spacing. Praise only where earned.",
		);

		// ---- Books reader chrome ------------------------------------------
		const books = await s.openApp(APP.Books);
		await books.waitForTimeout(2500);
		await s.shot(books, "01-books-full");
		await s.shot(books, "02-books-header", books.locator(".app-header").first());
		// Header geometry: is the 44px baseline held?
		const headerBox = await books
			.locator(".app-header")
			.first()
			.boundingBox()
			.catch(() => null);
		s.note(`books header height: ${headerBox?.height ?? "?"}px (contract: 44)`);
		// Footer / pagination chrome.
		await s.shot(books, "03-books-footer", books.locator(".books__footer").first());
		// Typography panel open — panel chrome, segmented controls, steppers.
		await books
			.locator(".books__type-btn")
			.first()
			.click()
			.catch(() => undefined);
		await books.waitForTimeout(700);
		await s.shot(books, "04-books-type-panel");
		// Keyboard reachability: does Tab move through the panel sanely?
		await books.keyboard.press("Tab");
		await books.keyboard.press("Tab");
		await s.shot(books, "05-books-type-panel-focus");
		await books.keyboard.press("Escape").catch(() => undefined);

		// ---- Whiteboard toolbar + panels ----------------------------------
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(2500);
		await s.shot(wb, "06-whiteboard-full");
		await s.shot(wb, "07-whiteboard-header", wb.locator(".app-header").first());
		const toolbar = wb.locator('[role="toolbar"], [class*="toolbar"]').first();
		if (await toolbar.isVisible().catch(() => false)) {
			await s.shot(wb, "08-whiteboard-toolbar", toolbar);
		}
		// Template menu chrome.
		const templateBtn = wb.locator('[aria-label*="template" i]').first();
		if (await templateBtn.isVisible().catch(() => false)) {
			await templateBtn.click().catch(() => undefined);
			await wb.waitForTimeout(800);
			await s.shot(wb, "09-template-menu-chrome");
			await wb.keyboard.press("Escape").catch(() => undefined);
		}

		// ---- Bookmarks property panel -------------------------------------
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2500);
		const firstCard = bm.locator('[class*="card"]').first();
		await firstCard.click().catch(() => undefined);
		await bm.waitForTimeout(1200);
		const propsToggle = bm
			.locator('[aria-label*="propert" i], [aria-label*="inspector" i], [aria-label*="details" i]')
			.first();
		await propsToggle.click().catch(() => undefined);
		await bm.waitForTimeout(900);
		await s.shot(bm, "10-bookmarks-detail-full");
		const propsPanel = bm.locator(".bs-props, [class*='props-panel'], [class*='properties']").first();
		if (await propsPanel.isVisible().catch(() => false)) {
			await s.shot(bm, "11-bookmarks-props-crop", propsPanel);
		}
		await s.shot(bm, "12-bookmarks-header", bm.locator(".app-header").first());

		// ---- Code editor visual layers -------------------------------------
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(2500);
		await s.shot(ce, "13-code-editor-full");
		await s.shot(ce, "14-code-editor-header", ce.locator(".app-header").first());
		// Open the first file in its tree, if any — indent guides need content.
		const fileRow = ce
			.locator('[class*="tree"] [class*="row"], [class*="file-list"] li, [role="treeitem"]')
			.first();
		if (await fileRow.isVisible().catch(() => false)) {
			await fileRow.click().catch(() => undefined);
			await ce.waitForTimeout(1200);
			await s.shot(ce, "15-code-open-file");
			// Click into the code to position the caret near a bracket.
			const pane = ce
				.locator('[class*="code-pane"], .cm-content, textarea, [class*="editor"]')
				.first();
			await pane.click().catch(() => undefined);
			await ce.waitForTimeout(500);
			await s.shot(ce, "16-code-caret-bracket-state");
		} else {
			s.note("code editor: no file rows visible to open — empty workspace?");
		}

		// Cross-app header parity strip: collected per-app above; final note.
		s.chat(
			SPEAKER.Marcus,
			"Review pass captured. Verdicts after I stare at the crops — the log gets specifics, not vibes.",
		);
	} finally {
		await s.finish();
	}
});
