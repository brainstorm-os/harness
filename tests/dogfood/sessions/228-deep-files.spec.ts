/**
 * Session 228 — DEEP Files walkthrough. Exercise the real Files surface end to
 * end: the FOLDERS tree, the New menu (folder creation), the List/Grid/Gallery
 * view switch, the Sort menu, the STORAGE "All media" inventory, file/folder
 * selection + the inspector (Preview / Properties / Links tabs), inline rename,
 * the inspector LINKS open-in-another-app affordance, in-folder search, the
 * header ⋯ "More actions" menu, sidebar hide/show, deletion (cleanup), and
 * persistence across a navigate-away-and-back.
 *
 * Every action records a `[PASS]/[FAIL]/[?] <action> — <observed>` line judged
 * from observable DOM (folder/file counts, view-mode class, sort label, the
 * inspector's open state, breadcrumb text). Each step is wrapped in try/catch
 * so a single miss never aborts the walk. States + failures are screenshotted.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep files walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-files");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(2600);
		await s.shot(files, "00-files-launched");

		const content = files.locator('[data-testid="content"]');
		const sidebar = files.locator('[data-testid="sidebar"]');
		const contentList = files.locator('[data-testid="content-list"]');
		const treeRows = files.locator(".sidebar__tree-row");
		const fileRows = files.locator('[data-testid="content-row"]');

		const rowCount = () => fileRows.count().catch(() => 0);
		const currentCrumb = () =>
			files
				.locator('.breadcrumb__segment[data-current="true"]')
				.first()
				.innerText()
				.catch(() => "");

		// Helper: close any open popover so the next interaction isn't intercepted.
		const dismiss = async () => {
			await files.keyboard.press("Escape").catch(() => undefined);
			await files.waitForTimeout(250);
		};

		// ── 1. Initial landing — folder tree + breadcrumb ──────────────────────
		try {
			const trees = await treeRows.count();
			const crumb = await currentCrumb();
			const rows = await rowCount();
			s.note(
				`[${trees > 0 ? "PASS" : "FAIL"}] Files lands with FOLDERS tree — ${trees} tree rows, breadcrumb "${crumb}", ${rows} content rows`,
			);
		} catch (e) {
			s.note(`[FAIL] Files initial landing — ${(e as Error).message}`);
		}

		// ── 2. Navigate the FOLDERS tree — open "My first folder" ──────────────
		try {
			const startCrumb = await currentCrumb();
			const startRows = await rowCount();
			const seeded = treeRows.filter({ hasText: "My first folder" }).first();
			const hasSeeded = (await seeded.count()) > 0;
			const target = hasSeeded ? seeded : treeRows.nth(1);
			const targetName =
				(await target
					.locator(".sidebar__name")
					.innerText()
					.catch(() => "")) || "(row)";
			await target.click({ timeout: 5000 });
			await files.waitForTimeout(900);
			const afterCrumb = await currentCrumb();
			const afterRows = await rowCount();
			const selected = await target.getAttribute("aria-selected").catch(() => null);
			const changed = afterCrumb !== startCrumb || afterRows !== startRows || selected === "true";
			s.note(
				`[${changed ? "PASS" : "FAIL"}] Navigate FOLDERS tree → "${targetName}" — breadcrumb "${startCrumb}"→"${afterCrumb}", rows ${startRows}→${afterRows}, aria-selected=${selected}`,
			);
			await s.shot(files, "01-folder-navigated");
		} catch (e) {
			s.note(`[FAIL] Navigate FOLDERS tree — ${(e as Error).message}`);
		}

		// ── 3. New menu → New folder (folder created + rename mode) ────────────
		let createdFolderName = "";
		try {
			const before = await rowCount();
			await files.locator('[data-testid="toolbar-new"]').first().click({ timeout: 5000 });
			await files.waitForTimeout(500);
			const menuVisible = await files
				.locator('[data-testid="new-menu"]')
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`[${menuVisible ? "PASS" : "FAIL"}] New menu opens — visible=${menuVisible}`);
			await s.shot(files, "02-new-menu");
			await files.locator('[data-testid="new-folder"]').first().click({ timeout: 5000 });
			await files.waitForTimeout(900);
			const after = await rowCount();
			// newFolder() creates "Untitled folder", selects it, and enters rename mode.
			const renameVisible = await files
				.locator('[data-testid="rename-input"]')
				.first()
				.isVisible()
				.catch(() => false);
			createdFolderName = `Deep Files 228 ${Date.now()}`;
			if (renameVisible) {
				await files.locator('[data-testid="rename-input"]').first().fill(createdFolderName);
				await files.keyboard.press("Enter");
				await files.waitForTimeout(700);
			}
			const created = after > before;
			s.note(
				`[${created ? "PASS" : "FAIL"}] New folder created — rows ${before}→${after}, rename-input=${renameVisible}, named "${createdFolderName}"`,
			);
			await s.shot(files, "03-folder-created");
		} catch (e) {
			s.note(`[FAIL] New folder — ${(e as Error).message}`);
		}
		await dismiss();

		// ── 4. View-mode switch: List / Grid / Gallery ─────────────────────────
		for (const [mode, testId] of [
			["grid", "view-switch-grid"],
			["gallery", "view-switch-gallery"],
			["list", "view-switch-list"],
		] as const) {
			try {
				await files.locator(`[data-testid="${testId}"]`).first().click({ timeout: 5000 });
				await files.waitForTimeout(600);
				const applied = await contentList.getAttribute("data-view-mode").catch(() => null);
				const active = await files
					.locator(`[data-testid="${testId}"]`)
					.first()
					.getAttribute("data-active")
					.catch(() => null);
				const ok = applied === mode && active === "true";
				s.note(
					`[${ok ? "PASS" : "FAIL"}] View mode → ${mode} — content-list data-view-mode=${applied}, button data-active=${active}`,
				);
				await s.shot(files, `04-view-${mode}`);
			} catch (e) {
				s.note(`[FAIL] View mode → ${mode} — ${(e as Error).message}`);
			}
		}

		// ── 5. Sort menu — change Sort by + assert label/order changed ─────────
		try {
			const sortBtn = files.locator('[data-testid="toolbar-sort"]').first();
			const labelBefore = (await sortBtn.innerText().catch(() => "")).trim();
			await sortBtn.click({ timeout: 5000 });
			await files.waitForTimeout(500);
			const menuVisible = await files
				.locator('[data-testid="sort-menu"]')
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`[${menuVisible ? "PASS" : "FAIL"}] Sort menu opens — visible=${menuVisible}`);
			await s.shot(files, "05-sort-menu");
			// "Sort by: Manual" → switch to Name.
			await files.locator('[data-testid="sort-name"]').first().click({ timeout: 5000 });
			await files.waitForTimeout(600);
			const labelAfter = (await sortBtn.innerText().catch(() => "")).trim();
			const changed = labelAfter !== labelBefore && /name/i.test(labelAfter);
			s.note(`[${changed ? "PASS" : "FAIL"}] Sort changed — label "${labelBefore}"→"${labelAfter}"`);
			await s.shot(files, "05b-sort-by-name");
		} catch (e) {
			s.note(`[FAIL] Sort menu — ${(e as Error).message}`);
		}
		await dismiss();

		// ── 6. STORAGE "All media" inventory (note F-233 selection style) ──────
		try {
			const storageRow = files.locator('[data-testid="sidebar-storage"]').first();
			const exists = (await storageRow.count()) > 0;
			if (exists) {
				// F-233: the sidebar tree rows use aria-selected (accent) while the
				// storage row is a plain button — record the active-style treatment
				// for the inconsistency audit.
				await storageRow.click({ timeout: 5000 });
				await files.waitForTimeout(900);
				const panelVisible = await files
					.locator('[data-testid="storage-panel"]')
					.first()
					.isVisible()
					.catch(() => false);
				const summary = await files
					.locator(".storage-panel__summary")
					.first()
					.innerText()
					.catch(() => "");
				const storageActive = await storageRow.getAttribute("aria-selected").catch(() => null);
				const treeActive = await treeRows
					.first()
					.evaluate((el) => el.getAttribute("aria-selected"))
					.catch(() => null);
				s.note(
					`[${panelVisible ? "PASS" : "FAIL"}] STORAGE "All media" loads — panel visible=${panelVisible}, summary "${summary}"`,
				);
				s.note(
					`[?] F-233 selection style — storage row aria-selected=${storageActive} vs tree row aria-selected=${treeActive} (grey-vs-accent inconsistency check)`,
				);
				await s.shot(files, "06-storage-all-media");
			} else {
				s.note(
					'[?] STORAGE "All media" — sidebar-storage location not present (listStorageInventory unavailable)',
				);
			}
		} catch (e) {
			s.note(`[FAIL] STORAGE All media — ${(e as Error).message}`);
		}
		await dismiss();

		// ── 7. Select a row + open the inspector (Show inspector) ──────────────
		try {
			// Ensure the inspector is shown.
			const inspectorToggle = files.locator('[data-testid="toolbar-inspector"]').first();
			const inspectorOpen = await files
				.locator('[data-testid="inspector"]')
				.first()
				.isVisible()
				.catch(() => false);
			if (!inspectorOpen) {
				await inspectorToggle.click({ timeout: 5000 });
				await files.waitForTimeout(500);
			}
			const rows = await rowCount();
			if (rows > 0) {
				await fileRows.first().click({ timeout: 5000 });
				await files.waitForTimeout(600);
			}
			const visible = await files
				.locator('[data-testid="inspector"]')
				.first()
				.isVisible()
				.catch(() => false);
			const title = await files
				.locator(".inspector__title")
				.first()
				.innerText()
				.catch(() => "");
			s.note(
				`[${visible ? "PASS" : "FAIL"}] Inspector opens for selection — visible=${visible}, title "${title}"`,
			);
			await s.shot(files, "07-inspector-preview");

			// Properties tab — rows render.
			await files
				.locator(".inspector__tab", { hasText: "Properties" })
				.first()
				.click({ timeout: 5000 })
				.catch(() => undefined);
			await files.waitForTimeout(500);
			const propRows = await files
				.locator(".inspector__property")
				.count()
				.catch(() => 0);
			s.note(
				`[${propRows > 0 ? "PASS" : "FAIL"}] Inspector Properties tab — ${propRows} property rows render`,
			);
			await s.shot(files, "07b-inspector-properties");

			// Links tab — render the panel (links or the empty state both count).
			await files
				.locator(".inspector__tab", { hasText: "Links" })
				.first()
				.click({ timeout: 5000 })
				.catch(() => undefined);
			await files.waitForTimeout(500);
			const linkTargets = await files
				.locator(".inspector__links-target")
				.count()
				.catch(() => 0);
			const linksEmpty = await files
				.locator(".inspector__empty")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(
				`[${linkTargets > 0 || linksEmpty ? "PASS" : "FAIL"}] Inspector Links tab — ${linkTargets} link targets, empty-state=${linksEmpty}`,
			);
			await s.shot(files, "07c-inspector-links");

			// ── 8. LINKS (PRIORITY) — open a linked source object in another app ──
			if (linkTargets > 0) {
				const linkBtn = files.locator(".inspector__links-target:not([disabled])").first();
				const linkName = await linkBtn.innerText().catch(() => "");
				await linkBtn.click({ timeout: 5000 }).catch(() => undefined);
				await files.waitForTimeout(1600);
				// openEntity routes to the registered opener app — assert a new app
				// window/page appeared for any non-Files app, or the Files window
				// itself navigated (folder links navigate in-place).
				const appPages = [APP.Notes, APP.Database, APP.Tasks, APP.Calendar, APP.Journal, APP.Bookmarks]
					.map((id) => s.appPagesFor(id).length)
					.reduce((a, b) => a + b, 0);
				const filesCrumb = await currentCrumb();
				const opened = appPages > 0;
				s.note(
					`[${opened ? "PASS" : "?"}] LINKS open-in-app — clicked link "${linkName}", non-Files app pages now ${appPages}, Files breadcrumb "${filesCrumb}" (folder links navigate in-place)`,
				);
				await s.shot(files, "08-link-opened");
			} else {
				s.note("[?] LINKS open-in-app — no outgoing/incoming links on the selected object to follow");
			}
		} catch (e) {
			s.note(`[FAIL] Inspector + Links — ${(e as Error).message}`);
		}

		// ── 9. Open-on-click/double-click — a file row opens its source app ────
		try {
			const rows = await rowCount();
			if (rows > 0) {
				// Prefer a FILE row (folders just navigate). Files have a Size cell.
				const fileRow = fileRows.first();
				const beforePages = [APP.Notes, APP.Database]
					.map((id) => s.appPagesFor(id).length)
					.reduce((a, b) => a + b, 0);
				const beforeCrumb = await currentCrumb();
				await fileRow.dblclick({ timeout: 5000 }).catch(() => undefined);
				await files.waitForTimeout(1600);
				const afterPages = [APP.Notes, APP.Database]
					.map((id) => s.appPagesFor(id).length)
					.reduce((a, b) => a + b, 0);
				const afterCrumb = await currentCrumb();
				const acted = afterPages > beforePages || afterCrumb !== beforeCrumb;
				s.note(
					`[${acted ? "PASS" : "?"}] Double-click row opens/navigates — app pages ${beforePages}→${afterPages}, breadcrumb "${beforeCrumb}"→"${afterCrumb}"`,
				);
				await s.shot(files, "09-row-opened");
			} else {
				s.note("[?] Double-click row — no rows in the active folder to open");
			}
		} catch (e) {
			s.note(`[FAIL] Double-click row open — ${(e as Error).message}`);
		}

		// ── 10. In-folder search ───────────────────────────────────────────────
		try {
			const beforeRows = await rowCount();
			const searchInput = files.locator('[data-testid="toolbar-search-input"]').first();
			await searchInput.click({ timeout: 5000 });
			await searchInput.fill("zzz-no-match-228");
			await files.waitForTimeout(800);
			const afterRows = await rowCount();
			const emptyState = await files
				.locator('[data-testid="content-empty"]')
				.first()
				.isVisible()
				.catch(() => false);
			const filtered = afterRows < beforeRows || emptyState;
			s.note(
				`[${filtered ? "PASS" : "FAIL"}] In-folder search filters — rows ${beforeRows}→${afterRows}, empty-state=${emptyState}`,
			);
			await s.shot(files, "10-search-no-match");
			// Clear search → rows return.
			await searchInput.fill("");
			await files.waitForTimeout(700);
			const restored = await rowCount();
			s.note(
				`[${restored >= beforeRows ? "PASS" : "FAIL"}] Search cleared restores rows — ${afterRows}→${restored} (was ${beforeRows})`,
			);
		} catch (e) {
			s.note(`[FAIL] In-folder search — ${(e as Error).message}`);
		}

		// ── 11. Header ⋯ "More actions" menu ───────────────────────────────────
		try {
			const more = files.locator(".bs-object-menu__more, [aria-label='More actions']").first();
			const exists = (await more.count()) > 0;
			if (exists) {
				await more.click({ timeout: 5000 });
				await files.waitForTimeout(600);
				const menu = files.locator(".fm-menu, [role='menu']").first();
				const menuVisible = await menu.isVisible().catch(() => false);
				const itemCount = await files
					.locator(".fm-menu [role='menuitem'], .fm-menu button")
					.count()
					.catch(() => 0);
				s.note(
					`[${menuVisible ? "PASS" : "FAIL"}] Header ⋯ More-actions menu — visible=${menuVisible}, ${itemCount} items`,
				);
				await s.shot(files, "11-more-actions-menu");
				await dismiss();
			} else {
				s.note("[?] Header ⋯ More-actions menu — trigger not found");
			}
		} catch (e) {
			s.note(`[FAIL] Header ⋯ More-actions — ${(e as Error).message}`);
		}
		await dismiss();

		// ── 12. Sidebar hide / show ────────────────────────────────────────────
		try {
			const toggle = files.locator('[data-testid="toolbar-sidebar"]').first();
			const hiddenBefore = await sidebar.getAttribute("aria-hidden").catch(() => null);
			await toggle.click({ timeout: 5000 });
			await files.waitForTimeout(500);
			const hiddenAfter = await sidebar.getAttribute("aria-hidden").catch(() => null);
			await s.shot(files, "12-sidebar-hidden");
			await toggle.click({ timeout: 5000 });
			await files.waitForTimeout(500);
			const hiddenRestored = await sidebar.getAttribute("aria-hidden").catch(() => null);
			const toggled = hiddenAfter !== hiddenBefore && hiddenRestored === hiddenBefore;
			s.note(
				`[${toggled ? "PASS" : "FAIL"}] Sidebar hide/show — aria-hidden ${hiddenBefore}→${hiddenAfter}→${hiddenRestored}`,
			);
		} catch (e) {
			s.note(`[FAIL] Sidebar hide/show — ${(e as Error).message}`);
		}

		// ── 13. Rename the created folder via the ⋯ row menu ───────────────────
		try {
			const target = fileRows.filter({ hasText: createdFolderName }).first();
			const found = createdFolderName !== "" && (await target.count()) > 0;
			if (found) {
				await target.click({ timeout: 5000 });
				await files.waitForTimeout(300);
				// Rename via keyboard (Enter on the seeded rename chord = F2/Enter).
				await files.keyboard.press("Enter").catch(() => undefined);
				await files.waitForTimeout(400);
				const renameVisible = await files
					.locator('[data-testid="rename-input"]')
					.first()
					.isVisible()
					.catch(() => false);
				const renamed = `${createdFolderName} (renamed)`;
				if (renameVisible) {
					await files.locator('[data-testid="rename-input"]').first().fill(renamed);
					await files.keyboard.press("Enter");
					await files.waitForTimeout(700);
					createdFolderName = renamed;
				}
				const nowFound = (await fileRows.filter({ hasText: renamed }).count()) > 0;
				s.note(
					`[${renameVisible && nowFound ? "PASS" : "FAIL"}] Rename folder — rename-input=${renameVisible}, "${renamed}" present=${nowFound}`,
				);
				await s.shot(files, "13-folder-renamed");
			} else {
				s.note("[?] Rename folder — created folder row not found in current view");
			}
		} catch (e) {
			s.note(`[FAIL] Rename folder — ${(e as Error).message}`);
		}

		// ── 14. Persistence — navigate away (tree) and back ────────────────────
		try {
			const beforeCrumb = await currentCrumb();
			// Click the root/first tree row to navigate away, then back to the
			// folder we were in.
			await treeRows
				.first()
				.click({ timeout: 5000 })
				.catch(() => undefined);
			await files.waitForTimeout(800);
			const awayCrumb = await currentCrumb();
			const seeded = treeRows.filter({ hasText: "My first folder" }).first();
			const back = (await seeded.count()) > 0 ? seeded : treeRows.nth(1);
			await back.click({ timeout: 5000 }).catch(() => undefined);
			await files.waitForTimeout(800);
			const backCrumb = await currentCrumb();
			const folderStillThere =
				createdFolderName === ""
					? true
					: (await fileRows.filter({ hasText: createdFolderName }).count()) > 0;
			s.note(
				`[${awayCrumb !== beforeCrumb ? "PASS" : "FAIL"}] Navigate away — breadcrumb "${beforeCrumb}"→"${awayCrumb}"`,
			);
			s.note(
				`[${folderStillThere ? "PASS" : "FAIL"}] Navigate back persistence — breadcrumb "${backCrumb}", created folder present=${folderStillThere}`,
			);
			await s.shot(files, "14-navigated-back");
		} catch (e) {
			s.note(`[FAIL] Persistence navigate-back — ${(e as Error).message}`);
		}

		// ── 15. Delete the test folder (cleanup + assert removal) ──────────────
		try {
			const target = fileRows.filter({ hasText: createdFolderName }).first();
			const found = createdFolderName !== "" && (await target.count()) > 0;
			if (found) {
				const before = await rowCount();
				await target.click({ timeout: 5000 });
				await files.waitForTimeout(300);
				await files.keyboard.press("Delete").catch(() => undefined);
				await files.waitForTimeout(500);
				// A destructive delete prompts the confirm dialog.
				const confirmVisible = await files
					.locator('[data-testid="confirm-dialog"]')
					.first()
					.isVisible()
					.catch(() => false);
				if (confirmVisible) {
					await files.locator('[data-testid="confirm-ok"]').first().click({ timeout: 5000 });
					await files.waitForTimeout(800);
				}
				const after = await rowCount();
				const gone = (await fileRows.filter({ hasText: createdFolderName }).count()) === 0;
				s.note(
					`[${gone ? "PASS" : "FAIL"}] Delete test folder — confirm=${confirmVisible}, rows ${before}→${after}, "${createdFolderName}" gone=${gone}`,
				);
				await s.shot(files, "15-folder-deleted");
			} else {
				s.note("[?] Delete test folder — created folder not present to delete");
			}
		} catch (e) {
			s.note(`[FAIL] Delete test folder — ${(e as Error).message}`);
		}

		await s.shot(files, "16-files-final");
	} finally {
		await s.finish();
	}
});
