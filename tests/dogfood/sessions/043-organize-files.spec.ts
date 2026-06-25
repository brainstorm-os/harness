/**
 * Session 043 — Mira organizes her vault: creates a folder in Files and renames
 * it to "Northbound". Dogfoods the Files create-folder flow + rename.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("create and name a folder in Files", async () => {
	test.setTimeout(180_000);
	const s = await startSession("043-organize-files");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1500);
		await s.shot(files, "01-files-open");

		// New → New folder.
		await files.locator('[data-testid="toolbar-new"]').click();
		await files.waitForTimeout(400);
		const newFolder = files.locator('[data-testid="new-folder"]');
		s.note(`New-folder option present: ${(await newFolder.count()) > 0}`);
		await newFolder.click();
		await files.waitForTimeout(900);
		await s.shot(files, "02-folder-created");

		// Creating a folder auto-opens inline rename with the name selected — type
		// the real name straight in (nice: no extra rename step).
		const renameInput = files.locator('[data-testid="content"] input').first();
		const renameOpen = (await renameInput.count()) > 0;
		s.note(`Folder created + inline rename auto-opened: ${renameOpen}`);
		if (renameOpen) {
			await renameInput.fill("Northbound");
			await files.keyboard.press("Enter");
			await files.waitForTimeout(700);
		}
		await s.shot(files, "03-after-rename");

		const content =
			(await files
				.locator('[data-testid="content"]')
				.innerText()
				.catch(() => "")) ?? "";
		const sidebar =
			(await files
				.locator('[data-testid="sidebar"]')
				.innerText()
				.catch(() => "")) ?? "";
		const named = /Northbound/.test(content) || /Northbound/.test(sidebar);
		s.note(`Folder named "Northbound" (content/sidebar): ${named}`);

		expect(renameOpen).toBe(true);
		expect(named).toBe(true);
	} finally {
		await s.finish();
	}
});
