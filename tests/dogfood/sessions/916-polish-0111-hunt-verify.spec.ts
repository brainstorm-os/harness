/**
 * Session 916 — verification for the polish-0.11.1-hunt fix batch.
 *
 * Captures the four surfaces the hunt patched, for before/after reading:
 *   1. Dashboard — the Recent Notes widget header glyph (was initials "RN"
 *      when the icon request raced the seeder reinstall window).
 *   2. Notes (light) — a code block's Shiki tokens (was github-dark-on-light:
 *      the plugin read <html>'s computed `color-scheme`, constant "light dark").
 *   3. Code editor (dark) — syntax palette (was github-light-on-dark: the app
 *      read the OS `prefers-color-scheme`, not the shell appearance).
 *   4. Calendar week view (light) — block-chip meta lines (was mid-glyph
 *      clipping: guests/tz meta never density-gated).
 * Ends back on Light appearance so the shared vault is left as found.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("polish 0.11.1 hunt — verify fix surfaces", async () => {
	test.setTimeout(420_000);
	const s = await startSession("916-polish-0111-hunt-verify");
	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(1500);
		await dash.keyboard.press("Escape");
		await s.shot(dash, "dashboard-widget-icon");

		// Notes: open the deep-228 note (has a code block) in LIGHT.
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1200);
		const search = notes.locator('input[placeholder*="Search"]').first();
		if ((await search.count()) > 0) {
			await search.fill("Deep Notes 228");
			await notes.waitForTimeout(900);
		}
		const row = notes.locator(".notes__sidebar-item", { hasText: "Deep Notes 228" }).first();
		if ((await row.count()) > 0) {
			await row.click();
			await notes.waitForTimeout(1200);
		}
		// Append a ts code block at top level (the fence converts outside lists)
		// so the Shiki palette is visible in the shot.
		const editor = notes.locator('.notes__body [contenteditable="true"]').first();
		if ((await editor.count()) > 0) {
			// Park the caret in the LAST top-level block (clicking the editor's
			// center lands mid-list and the fence would type as list text).
			await editor.locator("> *:last-child").click().catch(() => undefined);
			await notes.keyboard.press("End").catch(() => undefined);
			await notes.keyboard.press("Enter");
			await notes.keyboard.type("```ts ", { delay: 40 }).catch(() => undefined);
			await notes.keyboard
				.type('const label: string = "hello tokens" // comment', { delay: 15 })
				.catch(() => undefined);
			await notes.waitForTimeout(1500);
		}
		await s.shot(notes, "notes-code-block-light");

		// Calendar week view in light.
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1200);
		await cal.getByRole("tab", { name: "Week" }).first().click();
		await cal.waitForTimeout(900);
		await s.shot(cal, "calendar-week-light");

		// Flip to Dark, capture the code editor's syntax palette.
		const toDark = dash.locator('[aria-label="Switch to Dark appearance"]').first();
		if ((await toDark.count()) > 0) {
			await toDark.click();
			await dash.waitForTimeout(1000);
		}
		const code = await s.openApp(APP.CodeEditor);
		await code.waitForTimeout(1500);
		await s.shot(code, "code-editor-dark");
		// Live-flip check: the open pane must re-tokenise without a reload.
		const toLight = dash.locator('[aria-label="Switch to Light appearance"]').first();
		if ((await toLight.count()) > 0) {
			await toLight.click();
			await dash.waitForTimeout(1200);
		}
		await s.shot(code, "code-editor-back-to-light");
	} finally {
		await s.finish();
	}
});
