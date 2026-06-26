/**
 * Session 011 — verify the Files app is a UNIVERSAL object browser again.
 *
 * The Files renderer had regressed to a File/Folder-only filter
 * (`vault-tree.ts`), hiding every other object. The fix shows any object an
 * app can open (registry-resolved via `intents.suggest`): Notes, Tasks,
 * Bookmarks, Journal entries, etc. now appear in the content pane with a
 * real "Kind" label, and double-click routes to the owner app.
 *
 * This drives the REAL built shell against the Northbound vault (Mira's
 * workspace, which is full of notes/tasks) and asserts the content pane
 * surfaces non-File/Folder kinds — the honest proof the filter is gone.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";
import { APP } from "../lib/founder";

/** Humanised type nouns the universal browser shows for non-File/Folder
 *  objects (Kind cell = `humanizeType`). A folder's Kind cell is an item
 *  count and a file's is its extension, so any of these proves a non-file
 *  object rendered. */
const NON_FILE_KINDS = new Set([
	"Note",
	"Task",
	"Project",
	"Bookmark",
	"Entry",
	"Person",
	"Company",
	"Event",
	"Email",
	"Channel",
	"Message",
	"Highlight",
	"Book",
	"Conversation",
	"Whiteboard",
	"Invoice",
	"CodeFile",
	"List",
]);

test("Files surfaces non-File/Folder objects (universal browser)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("011-files-universal-browser-check");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(2000);

		// Rows render at all.
		const rows = files.locator('[data-testid="content-row"]');
		await expect(rows.first()).toBeVisible({ timeout: 15_000 });
		const rowCount = await rows.count();
		s.note(`Files root shows ${rowCount} rows`);
		await s.shot(files, "files-root");

		// Collect each row's name + Kind cell. The Kind column is on by default.
		const rowsData = await files.evaluate(() => {
			const out: Array<{ name: string; kind: string }> = [];
			for (const row of Array.from(document.querySelectorAll('[data-testid="content-row"]'))) {
				const name = row.querySelector(".content-row__name")?.textContent?.trim() ?? "";
				const kind = row.querySelector(".content-row__type")?.textContent?.trim() ?? "";
				out.push({ name, kind });
			}
			return out;
		});
		const kinds = [...new Set(rowsData.map((r) => r.kind).filter(Boolean))];
		s.note(`distinct Kinds at root: ${kinds.join(", ")}`);
		for (const r of rowsData.slice(0, 20)) s.note(`  • ${r.kind.padEnd(10)} ${r.name}`);

		const nonFileRows = rowsData.filter((r) => NON_FILE_KINDS.has(r.kind));
		s.note(`non-File/Folder objects visible: ${nonFileRows.length}`);

		expect(rowCount, "Files should render content rows").toBeGreaterThan(0);
		expect(
			nonFileRows.length,
			`expected at least one non-File/Folder object; kinds seen: ${kinds.join(", ")}`,
		).toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
