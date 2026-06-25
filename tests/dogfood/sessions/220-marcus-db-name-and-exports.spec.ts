/**
 * Session 220 — Marcus verifies two batches of fixes:
 *   1. Database: a freshly-created row opens its name editor inline in the
 *      grid, and the inspector heading is a rename field for every type.
 *   2. Export popover rollout: Whiteboard and Graph open the shared
 *      `openExportPopover` (format radiogroup + copy/save destination).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus verifies DB inline rename + the export popovers (220)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("220-marcus-db-name-and-exports");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Two things to check: renaming rows in the Database and the new export popovers.",
		);

		// ── Database: new row → inline name editor, inspector rename ──────────
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2800);
		// The seeded vault lands on a non-grid view; the tabs named "Grid 3/2"
		// are timelines — the real grid is the tab labelled exactly "Grid".
		await db
			.locator(".db-tab", { hasText: /^Grid$/ })
			.first()
			.click()
			.catch((e) => s.note(`grid tab: ${(e as Error).message.slice(0, 50)}`));
		await db.waitForTimeout(900);
		s.note(
			`grid present: ${await db
				.locator(".dbv-grid")
				.count()
				.catch(() => 0)}`,
		);
		s.note(
			`rows before: ${await db
				.locator(".dbv-grid__row")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(db, "db-open");
		await db
			.locator("#toolbar-new")
			.click()
			.catch((e) => s.note(`+New click: ${(e as Error).message.slice(0, 60)}`));
		await db.waitForTimeout(900);
		const titleInput = db.locator(".dbv-grid__title-input");
		s.note(`inline title editor open after create: ${await titleInput.count().catch(() => 0)}`);
		await s.shot(db, "db-new-row-name-editor");
		await titleInput
			.first()
			.fill("Acme Corp")
			.catch((e) => s.note(`fill: ${(e as Error).message.slice(0, 50)}`));
		await db.keyboard.press("Enter").catch(() => {});
		await db.waitForTimeout(500);
		s.note(
			`row labelled 'Acme Corp': ${await db
				.locator(".dbv-grid__title-label:has-text('Acme Corp')")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(db, "db-row-renamed");
		// Open the inspector via the row's trailing open-arrow.
		await db
			.locator(".dbv-grid__open")
			.first()
			.click()
			.catch((e) => s.note(`open-record: ${(e as Error).message.slice(0, 50)}`));
		await db.waitForTimeout(700);
		const heading = db.locator("#inspector-title[contenteditable='plaintext-only']");
		s.note(`inspector heading editable: ${await heading.count().catch(() => 0)}`);
		await s.shot(db, "db-inspector-name");

		// ── Whiteboard export popover (icon button, aria-label='Export') ──────
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(2800);
		await wb
			.locator("button[aria-haspopup='dialog'][aria-label='Export']")
			.first()
			.click()
			.catch((e) => s.note(`wb export click: ${(e as Error).message.slice(0, 60)}`));
		await wb.waitForTimeout(700);
		s.note(
			`whiteboard export popover: ${await wb
				.locator(".bs-export-popover")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(wb, "whiteboard-export-popover");

		// ── Graph export popover (text button.pattern-reset) ──────────────────
		const g = await s.openApp(APP.Graph);
		await g.waitForTimeout(3200);
		await g
			.locator(".app-header__right button[aria-label='Export']")
			.first()
			.click()
			.catch((e) => s.note(`graph export click: ${(e as Error).message.slice(0, 60)}`));
		await g.waitForTimeout(700);
		s.note(
			`graph export popover: ${await g
				.locator(".bs-export-popover")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(g, "graph-export-popover");

		s.chat(
			SPEAKER.Marcus,
			"Captures in — checking the rename flow and that both exports use the shared popover chrome.",
		);
	} finally {
		await s.finish();
	}
});
