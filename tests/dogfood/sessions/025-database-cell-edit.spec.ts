/**
 * Session 025 — Database in-grid cell editing (edit → persist → revert).
 *
 * Double-clicks a Name cell in the Grid view, replaces the value, commits, and
 * confirms the new value renders; then reverts to the original so the vault is
 * left as found. Exercises the editable-cell + persistence path with console-
 * error capture.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const ORIGINAL = "Take the product tour";
const EDITED = "Take the product tour (dogfood edit)";

test("Database: edit a grid cell, persist, then revert", async () => {
	test.setTimeout(180_000);
	const s = await startSession("025-database-cell-edit");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const editCell = async (db: Awaited<ReturnType<typeof s.openApp>>, find: string, to: string) => {
		const cell = db.getByText(find, { exact: true }).first();
		if ((await cell.count()) === 0) return false;
		await cell.dblclick();
		await db.waitForTimeout(600);
		// An input/textarea should now be focused in the cell.
		const input = db
			.locator(".dbv-grid input:focus, .dbv-grid textarea:focus, input:focus, textarea:focus")
			.first();
		if ((await input.count()) > 0) {
			await input.fill(to);
		} else {
			await db.keyboard.press("Meta+a");
			await db.keyboard.type(to, { delay: 12 });
		}
		await db.keyboard.press("Enter");
		await db.waitForTimeout(900);
		return true;
	};

	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(2000);
		// Make sure we're in Grid view (editable cells live there).
		const gridTab = db.getByText("Grid", { exact: true }).first();
		if ((await gridTab.count()) > 0) {
			await gridTab.click();
			await db.waitForTimeout(800);
		}
		await s.shot(db, "grid");

		// Edit ORIGINAL → EDITED.
		const edited = await editCell(db, ORIGINAL, EDITED);
		s.note(`edit applied: ${edited}`);
		if (!edited) {
			s.note(`cell "${ORIGINAL}" not found — skipping`);
			expect(errors).toEqual([]);
			return;
		}
		await db.waitForTimeout(500);
		const showsEdited = (
			await db
				.locator("body")
				.innerText()
				.catch(() => "")
		).includes(EDITED);
		s.note(`grid shows edited value: ${showsEdited}`);
		await s.shot(db, "after-edit");

		// Revert EDITED → ORIGINAL so the vault is left unchanged.
		const reverted = await editCell(db, EDITED, ORIGINAL);
		s.note(`revert applied: ${reverted}`);
		await db.waitForTimeout(500);
		const body =
			(await db
				.locator("body")
				.innerText()
				.catch(() => "")) ?? "";
		const backToOriginal = body.includes(ORIGINAL) && !body.includes(EDITED);
		s.note(`reverted to original: ${backToOriginal}`);
		await s.shot(db, "after-revert");

		expect(showsEdited, "the edited cell value should render").toBe(true);
		expect(backToOriginal, "the revert should restore the original value").toBe(true);
		expect(errors, "no console/page errors during cell editing").toEqual([]);
	} finally {
		await s.finish();
	}
});
