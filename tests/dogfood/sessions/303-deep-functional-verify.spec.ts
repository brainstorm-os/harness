/**
 * Session 303 — deep functional verification, real Electron. Beyond the 302
 * surface sweep (open + capture), this DRIVES real interactions and captures
 * their outcome, to (a) verify recently-shipped fixes in the live shell and
 * (b) exercise reliable CRUD paths. Credential-free only.
 *
 * Drives the interactions that are robust to synthetic clicks (plain-text
 * inputs, button clicks, menu opens); avoids the flaky ones (Yjs/Lexical body
 * typing without a dev hook, property-cell popovers — see continuous-loop.md).
 *
 * Per the loop protocol the spec records only FACTUAL captures (status strings,
 * menu-row labels, counts) — never a verdict. The verdict is decided from the
 * screenshots + notes in triage.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function menuRowLabels(page: Page): Promise<string[]> {
	// One label per row: the fancy-menus runtime row name, or the SDK
	// anchored-menu item. (Matching both `.fm-row` and `.fm-row__name` would
	// double-count every row.)
	return page
		.locator(".fm-menu .fm-row__name, .bs-object-menu__item")
		.allInnerTexts()
		.then((xs) => xs.map((x) => x.trim().split("\n")[0] ?? "").filter(Boolean))
		.catch(() => []);
}

test("deep functional verify (303)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("303-deep-verify");
	try {
		// ── theme-editor: name + Save theme → read status (F-240) ────────────
		try {
			const page = await s.openApp(APP.ThemeEditor);
			await page.waitForTimeout(2200);
			s.note("\n### theme-editor — save flow (F-240)");
			const name = page.locator(".te-toolbar__name");
			await name.fill("Dogfood Verify Theme").catch(() => undefined);
			await s.shot(page, "theme-01-named");
			await page
				.locator(".te-toolbar__save")
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(1800);
			const status = (
				await page
					.locator(".te-toolbar__status")
					.innerText()
					.catch(() => "")
			).trim();
			s.note(`save status after click: ${JSON.stringify(status)}`);
			await s.shot(page, "theme-02-after-save");
			// Reopen the theme selector to see whether the saved theme is listed.
			await page
				.locator(".te-toolbar__select")
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(600);
			s.note(`theme-select rows: ${JSON.stringify(await menuRowLabels(page))}`);
			await s.shot(page, "theme-03-select-open");
			await page.keyboard.press("Escape").catch(() => undefined);
		} catch (err) {
			s.note(`[theme-editor] step failed: ${(err as Error).message}`);
		}

		// ── code-editor: a file row's object menu offers Rename + Delete (F-238) ─
		try {
			const page = await s.openApp(APP.CodeEditor);
			await page.waitForTimeout(2200);
			s.note("\n### code-editor — file ⋯ menu (F-238)");
			const row = page.locator(".editor__file").first();
			const hasRow = await row.isVisible().catch(() => false);
			s.note(`file row present: ${hasRow}`);
			if (hasRow) {
				await row.click({ button: "right" }).catch(() => undefined);
				await page.waitForTimeout(700);
				s.note(`context-menu rows: ${JSON.stringify(await menuRowLabels(page))}`);
				await s.shot(page, "code-01-file-context-menu");
				await page.keyboard.press("Escape").catch(() => undefined);
			}
		} catch (err) {
			s.note(`[code-editor] step failed: ${(err as Error).message}`);
		}

		// ── tasks: New task → type a title → Enter → capture (CRUD create) ───
		try {
			const page = await s.openApp(APP.Tasks);
			await page.waitForTimeout(2200);
			s.note("\n### tasks — create flow (CRUD)");
			const before = await page
				.locator(".task-row, [data-task-id], .tasks-row")
				.count()
				.catch(() => -1);
			s.note(`task rows before: ${before}`);
			await page
				.locator('.app-header button[aria-label*="new" i]')
				.first()
				.click()
				.catch(() => undefined);
			await page.waitForTimeout(700);
			const input = page.locator(".tasks-compose__input");
			await input.fill("Dogfood verify task — 303").catch(() => undefined);
			await s.shot(page, "tasks-01-composer");
			await input.press("Enter").catch(() => undefined);
			await page.waitForTimeout(1200);
			const after = await page
				.locator(".task-row, [data-task-id], .tasks-row")
				.count()
				.catch(() => -1);
			s.note(`task rows after: ${after}`);
			await s.shot(page, "tasks-02-after-create");
		} catch (err) {
			s.note(`[tasks] step failed: ${(err as Error).message}`);
		}
	} finally {
		await s.finish();
	}
});
