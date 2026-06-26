/**
 * Session 014 — deep dogfood of Notes core flows.
 *
 * Create a note → title + body capture typing → bold formatting → the note
 * persists (sidebar count grows, content reads back) → clean up by deleting
 * it. Console/page errors are collected throughout and asserted empty.
 *
 * Mutates the Northbound vault transiently; the created note is deleted at
 * the end so the vault is left as found.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const TITLE = "Dogfood 014 — deep note";
const BODY = "This paragraph was typed by the deep-dogfood pass.";

test("Notes: create, type title+body, bold, persist, delete", async () => {
	test.setTimeout(180_000);
	const s = await startSession("014-notes-deep");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const countBefore = await notes.locator(".notes__sidebar-item").count();
		s.note(`sidebar notes before: ${countBefore}`);

		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1200);

		// Title captures immediate typing (InitialFocusPlugin focuses it on mount).
		await notes.keyboard.type(TITLE, { delay: 15 });
		await notes.waitForTimeout(300);
		// Move to the body and type a paragraph.
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(200);
		await notes.keyboard.type(BODY, { delay: 12 });
		await notes.waitForTimeout(500);
		await s.shot(notes, "typed");

		const titleText = (await notes.locator(".notes__title").first().textContent()) ?? "";
		const bodyText = (await notes.locator('[contenteditable="true"]').first().textContent()) ?? "";
		s.note(`title="${titleText}"`);
		s.note(`body contains paragraph: ${bodyText.includes(BODY)}`);

		// Bold the body line: select it and Cmd+B, expect a <strong>.
		await notes.keyboard.press("Meta+a");
		await notes.waitForTimeout(150);
		await notes.keyboard.press("Meta+b");
		await notes.waitForTimeout(400);
		const strongCount = await notes
			.locator('[contenteditable="true"] strong, [contenteditable="true"] b')
			.count();
		s.note(`bold runs after Cmd+B: ${strongCount}`);
		await s.shot(notes, "after-bold");

		const countAfter = await notes.locator(".notes__sidebar-item").count();
		s.note(`sidebar notes after: ${countAfter}`);

		expect(titleText, "typed title should appear").toContain(TITLE);
		expect(bodyText, "typed body should appear").toContain(BODY);
		expect(countAfter, "a new note should appear in the sidebar").toBeGreaterThan(countBefore);
		expect(strongCount, "Cmd+B should bold the selection").toBeGreaterThan(0);

		// ── Cleanup (best-effort): delete via the open note's header-title menu
		// (always in-viewport, unlike a sidebar item below the fold). Loops while
		// the currently-open note is a "Dogfood 014" one, mopping up leftovers
		// that re-open after each delete. Never fails the test. ──
		try {
			for (let i = 0; i < 8; i += 1) {
				const headerTitle = (await notes.locator(".app-header__title").first().textContent()) ?? "";
				if (!headerTitle.includes("Dogfood 014")) break;
				await notes.locator(".app-header__title").first().click({ button: "right" });
				await notes.waitForTimeout(450);
				const del = notes.getByRole("option", { name: /delete/i }).first();
				if ((await del.count()) === 0) break;
				await del.click();
				await notes.waitForTimeout(400);
				const confirmOk = notes.locator('[data-testid="confirm-ok"]');
				if ((await confirmOk.count()) > 0) await confirmOk.click();
				await notes.waitForTimeout(900);
			}
		} catch (e) {
			s.note(`cleanup skipped: ${(e as Error).message.split("\n")[0]}`);
		}
		s.note(`sidebar notes after cleanup: ${await notes.locator(".notes__sidebar-item").count()}`);
		await s.shot(notes, "after-cleanup");

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors during Notes flows").toEqual([]);
	} finally {
		await s.finish();
	}
});
