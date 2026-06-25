/**
 * Session 068 — Mira organizes Northbound's files.
 *
 * Her knowledge base is growing (briefs, the investor deck, brand assets,
 * client deliverables), so she sets up a top-level folder structure in Files:
 * Research / Drafts / Brand / Clients. First dogfood of the Files app's
 * create + inline-rename path: toolbar New menu → "New folder" → the new
 * "Untitled folder" lands selected with an inline rename input → type the
 * name → Enter.
 *
 * (File *content* is uploaded through a native OS dialog — not driveable
 * headlessly — so this builds the folder skeleton those files will live in,
 * which is the organizing act here.) Idempotent: a folder that already exists
 * is left alone, so reruns don't pile up duplicate "Untitled folder" rows.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const FOLDERS = ["Research", "Drafts", "Brand", "Clients"];

test("set up Northbound's top-level file folders", async () => {
	test.setTimeout(180_000);
	const s = await startSession("068-files-structure");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1500);
		await s.shot(files, "01-landing");

		const folderExists = async (name: string): Promise<boolean> => {
			const names = (await files.locator(".content-row__name").allInnerTexts()).map((t) => t.trim());
			return names.some((n) => n === name);
		};

		for (const name of FOLDERS) {
			if (await folderExists(name)) {
				s.note(`folder "${name}" already exists — skipping`);
				continue;
			}
			await files.locator('[data-testid="toolbar-new"]').first().click();
			await files.waitForTimeout(300);
			await files.locator('[data-testid="new-folder"]').first().click();
			await files.waitForTimeout(500);
			const rename = files.locator('[data-testid="rename-input"]').first();
			await expect(rename, `inline rename opened for "${name}"`).toBeVisible();
			await rename.fill(name);
			await files.keyboard.press("Enter");
			await files.waitForTimeout(700);
			s.note(`created folder "${name}"`);
		}
		await s.shot(files, "02-folders");

		const names = (await files.locator(".content-row__name").allInnerTexts()).map((t) => t.trim());
		s.note(`folders now: ${JSON.stringify(names)}`);

		for (const name of FOLDERS) {
			expect(names.includes(name), `the ${name} folder is present`).toBe(true);
		}
		// And nothing was left half-named.
		expect(
			names.some((n) => /^Untitled folder/.test(n)),
			"no stray Untitled folder left behind",
		).toBe(false);
	} finally {
		await s.finish();
	}
});
