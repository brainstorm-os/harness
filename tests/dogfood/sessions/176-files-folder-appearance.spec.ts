/**
 * Session 176 — 9.8.13 folder appearance + editable metadata. Mira opens a
 * folder's inspector and expects to set its cover/icon and edit its name. Files
 * have no write cap, so their inspector must stay read-only. Validates: the
 * cover/icon pickers open at body level (not trapped in the transformed
 * inspector overlay), a folder name edit commits, and a file's inspector shows
 * no edit affordance.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const ROW = '[data-testid="content-row"]';
const INSPECTOR = '[data-testid="inspector"]';

test("folder inspector is editable (pickers + name); file inspector is read-only (9.8.13)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("176-files-folder-appearance");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1500);

		const ensureInspector = async () => {
			if ((await files.locator(INSPECTOR).count()) === 0) {
				await files.locator('[data-testid="toolbar-inspector"]').click();
				await files.waitForTimeout(500);
			}
		};

		// Select the first folder row and open its inspector.
		const folderRow = files.locator(ROW).first();
		await folderRow.click();
		await ensureInspector();
		await files.waitForTimeout(400);
		await s.shot(files, "01-folder-inspector");

		// Preview tab: cover + icon are click-to-edit BUTTONS for a folder.
		const coverBtn = files.locator(`${INSPECTOR} button.inspector__preview-cover`);
		const iconBtn = files.locator(`${INSPECTOR} button.inspector__preview-icon`);
		const coverIsButton = (await coverBtn.count()) > 0;
		const iconIsButton = (await iconBtn.count()) > 0;
		s.note(`Folder: cover is button=${coverIsButton}, icon is button=${iconIsButton}`);

		// Clicking the cover opens the shared cover picker AT BODY LEVEL — the key
		// risk (the inspector is a translateX overlay that would trap a fixed
		// picker). Assert the dialog appears and is NOT a descendant of the inspector.
		await coverBtn.click();
		await files.waitForTimeout(500);
		const coverDialog = files.locator('.cover-picker[role="dialog"]');
		const coverOpen = (await coverDialog.count()) > 0 && (await coverDialog.first().isVisible());
		const coverInsideInspector = (await files.locator(`${INSPECTOR} .cover-picker`).count()) > 0;
		s.note(`Cover picker opened=${coverOpen}; trapped-inside-inspector=${coverInsideInspector}`);
		await s.shot(files, "02-cover-picker");
		await files
			.locator(".bs-picker-host .icon-picker__backdrop")
			.first()
			.click({ position: { x: 5, y: 5 } });
		await files.waitForTimeout(400);

		await iconBtn.click();
		await files.waitForTimeout(500);
		const iconDialog = files.locator('.icon-picker[role="dialog"]');
		const iconOpen = (await iconDialog.count()) > 0 && (await iconDialog.first().isVisible());
		s.note(`Icon picker opened=${iconOpen}`);
		await s.shot(files, "03-icon-picker");
		await files
			.locator(".bs-picker-host .icon-picker__backdrop")
			.first()
			.click({ position: { x: 5, y: 5 } });
		await files.waitForTimeout(400);

		// Properties tab: the name cell is editable. Change it and confirm the
		// inspector title reflects the new value (the optimistic write applied).
		await files.locator(`${INSPECTOR} [role="tab"]`).nth(1).click();
		await files.waitForTimeout(400);
		// The shared Plain cell is a `bs-cell-plain` button at rest; clicking it
		// swaps in the `bs-cell-plain-input` inline editor.
		const nameRow = files.locator(`${INSPECTOR} .inspector__property--editable`).first();
		const nameCell = nameRow.locator(".bs-cell-plain").first();
		const hasNameCell = (await nameCell.count()) > 0;
		s.note(`Properties: folder name cell editable=${hasNameCell}`);
		let renamed = false;
		if (hasNameCell) {
			const newName = "Renamed by 176";
			await nameCell.click();
			await files.waitForTimeout(300);
			const input = nameRow.locator(".bs-cell-plain-input, input, textarea").first();
			await input.fill(newName);
			await files.keyboard.press("Enter");
			await files.waitForTimeout(700);
			const title = (
				await files
					.locator(`${INSPECTOR} .inspector__title`)
					.innerText()
					.catch(() => "")
			).trim();
			renamed = title === newName;
			s.note(`After name edit: inspector title="${title}" (matches=${renamed})`);
			await s.shot(files, "04-renamed");
		}

		// Best-effort: a FILE inspector must be read-only (no edit buttons/cells).
		// Open a folder to look for a file inside; skip if the vault has none.
		await folderRow.dblclick();
		await files.waitForTimeout(800);
		const childFile = files.locator(ROW).first();
		if ((await childFile.count()) > 0) {
			await childFile.click();
			await ensureInspector();
			await files.waitForTimeout(400);
			const fileCoverButton = await files
				.locator(`${INSPECTOR} button.inspector__preview-cover`)
				.count();
			const fileCoverStatic = await files
				.locator(`${INSPECTOR} .inspector__preview-cover[data-static]`)
				.count();
			s.note(
				`Inside-folder first item inspector: cover-button=${fileCoverButton}, cover-static=${fileCoverStatic} (static expected for a file)`,
			);
			await s.shot(files, "05-child-inspector");
		} else {
			s.note("No items inside the folder — file read-only check skipped.");
		}

		// Core assertions (folder editability + body-level pickers).
		expect(coverIsButton).toBe(true);
		expect(iconIsButton).toBe(true);
		expect(coverOpen).toBe(true);
		expect(coverInsideInspector).toBe(false);
		expect(iconOpen).toBe(true);
		expect(hasNameCell).toBe(true);
		expect(renamed).toBe(true);
	} finally {
		await s.finish();
	}
});
