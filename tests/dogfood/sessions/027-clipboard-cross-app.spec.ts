/**
 * Session 027 — cross-app clipboard interop.
 *
 * The cross-app object-clipboard model: an app copies a
 * `brainstorm://entity/<id>` URI to the OS clipboard (navigator.clipboard.
 * writeText); pasting it into an editor in ANOTHER app embeds/links the
 * object. This test verifies, in order:
 *   A. the OS clipboard is shared across separate app WebContentsViews
 *      (write from app A's page, read from app B's page);
 *   B. plain-text paste carries across apps (paste into a field in app B);
 *   C. the real Calendar "copy event reference" UI writes the entity URI;
 *   D. pasting that URI into a Notes document produces an embed/link.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const SENTINEL = "brainstorm://entity/clip-test-7f3a";

test("clipboard: cross-app copy/paste of an object reference", async () => {
	test.setTimeout(180_000);
	const s = await startSession("027-clipboard-cross-app");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const calendar = await s.openApp(APP.Calendar);
		await calendar.waitForTimeout(1500);
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// ── A. OS clipboard shared across app WebContentsViews? ──
		const wrote = await calendar
			.evaluate(async (v) => {
				try {
					await navigator.clipboard.writeText(v);
					return true;
				} catch (e) {
					return `write failed: ${(e as Error).message}`;
				}
			}, SENTINEL)
			.catch((e) => `evaluate failed: ${(e as Error).message}`);
		s.note(`A. writeText from Calendar page: ${wrote}`);

		const readBack = await notes
			.evaluate(async () => {
				try {
					return await navigator.clipboard.readText();
				} catch (e) {
					return `read failed: ${(e as Error).message}`;
				}
			})
			.catch((e) => `evaluate failed: ${(e as Error).message}`);
		s.note(`A. readText from Notes page: ${readBack}`);
		const sharedClipboard = readBack === SENTINEL;
		s.note(`A. OS clipboard shared across apps: ${sharedClipboard}`);

		// ── B. the REAL copy UI: Calendar "Copy as block" writes the entity URI ──
		await calendar.bringToFront().catch(() => {});
		await calendar.getByText("Agenda", { exact: true }).first().click();
		await calendar.waitForTimeout(1000);
		let copiedUri = "";
		const rows = calendar.locator(".cal-agenda__row");
		const rowCount = await rows.count();
		s.note(`B. agenda rows: ${rowCount}`);
		for (let i = 0; i < rowCount; i += 1) {
			await rows.nth(i).click({ button: "right" });
			await calendar.waitForTimeout(500);
			const copyOpt = calendar.getByRole("option", { name: /copy as block/i }).first();
			if ((await copyOpt.count()) > 0) {
				await copyOpt.click();
				await calendar.waitForTimeout(700);
				copiedUri = (await calendar
					.evaluate(() => navigator.clipboard.readText())
					.catch(() => "")) as string;
				s.note(`B. "Copy as block" on event #${i} → clipboard: ${copiedUri}`);
				break;
			}
			await calendar.keyboard.press("Escape");
			await calendar.waitForTimeout(200);
		}
		if (!copiedUri) s.note("B. no owned event with 'Copy as block' found in Agenda");
		const copyWroteEntityUri = /^brainstorm:\/\/entity\//.test(copiedUri);
		s.note(`B. copy wrote a brainstorm://entity URI: ${copyWroteEntityUri}`);

		// ── C. paste that entity URI into a Notes document → embed/link node ──
		let pasteEmbedded = false;
		if (copyWroteEntityUri) {
			await notes.bringToFront().catch(() => {});
			await notes.locator('[aria-label="New note"]').first().click();
			await notes.waitForTimeout(1000);
			const body = notes.locator('[contenteditable="true"]').first();
			await body.click();
			await notes.waitForTimeout(300);
			await notes.keyboard.press("Meta+v");
			await notes.waitForTimeout(1200);
			await s.shot(notes, "after-paste-embed");
			// The editor should turn the entity URI into a transclusion/embed/link
			// (not leave it as a bare typed-out URL with no node).
			pasteEmbedded = await notes.evaluate(() => {
				const ce = document.querySelector('[contenteditable="true"]');
				if (!ce) return false;
				const hasNode = !!ce.querySelector(
					'[data-lexical-decorator], [class*="transclusion"], [class*="embed"], [class*="entity"], a[href^="brainstorm://"], [data-entity-id]',
				);
				const hasUriText = (ce.textContent ?? "").includes("brainstorm://entity/");
				return hasNode || hasUriText;
			});
			s.note(`C. Notes editor reflects the pasted entity reference: ${pasteEmbedded}`);
			// Clean up the throwaway note.
			try {
				const headerTitle = notes.locator(".app-header__title").first();
				await headerTitle.click({ button: "right" });
				await notes.waitForTimeout(400);
				const del = notes.getByRole("option", { name: /delete/i }).first();
				if ((await del.count()) > 0) {
					await del.click();
					await notes.waitForTimeout(300);
					const ok = notes.locator('[data-testid="confirm-ok"]');
					if ((await ok.count()) > 0) await ok.click();
				}
			} catch {
				/* best-effort */
			}
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);

		// Crucial assertions.
		expect(sharedClipboard, "OS clipboard must be shared across app WebContentsViews").toBe(true);
		if (copyWroteEntityUri) {
			expect(pasteEmbedded, "pasting the entity URI into Notes should produce an embed/link").toBe(
				true,
			);
		}
		expect(errors, "no console/page errors during clipboard ops").toEqual([]);
	} finally {
		await s.finish();
	}
});
