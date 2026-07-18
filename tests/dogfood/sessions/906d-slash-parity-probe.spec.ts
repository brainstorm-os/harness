/**
 * Session 906d — pin the F-070 slash-menu parity gap precisely.
 *
 * In Notes, "/" lists PAGES by name alongside block commands (session 114).
 * In Journal, "/Stunde" dismissed the menu (906c). Two control probes:
 * - Notes: "/" + "Stunde" — do page results appear?
 * - Journal: "/" + "emb" — is there an Embed command, and does Enter open the
 *   entity picker?
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("slash parity probe — notes pages vs journal /embed (906d)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("906d-slash-parity-probe");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(1500);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(2500);
		try {
			const editor = notes.locator('[contenteditable="true"]').first();
			await editor.click();
			await notes.keyboard.press("End");
			await notes.keyboard.press("Enter");
			await notes.keyboard.type("/Stunde");
			await notes.waitForTimeout(1100);
			await s.shot(notes, "notes-slash-stunde");
			const menu = await notes.evaluate(() => {
				const els = Array.from(
					document.querySelectorAll('[class*="typeahead"] [role="option"], [class*="slash"] [role="option"], [role="listbox"] [role="option"], [class*="typeahead-item"], [class*="slash-item"]'),
				);
				return els.slice(0, 10).map((e) => (e.textContent ?? "").replace(/\s+/g, " ").slice(0, 60));
			});
			s.note(`[notes] "/Stunde" menu items: ${menu.length > 0 ? JSON.stringify(menu) : "MENU GONE — no page results in Notes either"}`);
			await notes.keyboard.press("Escape").catch(() => undefined);
			for (let i = 0; i < 8; i++) await notes.keyboard.press("Backspace");
		} catch (e) {
			s.note(`[notes] probe broke: ${String(e).slice(0, 200)}`);
		}
		await notes.close().catch(() => undefined);
		await d.waitForTimeout(300);

		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(2500);
		try {
			const editor = journal.locator('[contenteditable="true"]').first();
			await editor.click();
			await journal.keyboard.press("End");
			await journal.keyboard.press("Enter");
			await journal.keyboard.type("/emb");
			await journal.waitForTimeout(1100);
			await s.shot(journal, "journal-slash-emb");
			const items = await journal.evaluate(() => {
				const els = Array.from(
					document.querySelectorAll('[class*="typeahead"] [role="option"], [role="listbox"] [role="option"], [class*="typeahead-item"], [class*="slash-item"]'),
				);
				return els.slice(0, 10).map((e) => (e.textContent ?? "").replace(/\s+/g, " ").slice(0, 60));
			});
			s.note(`[journal] "/emb" menu items: ${items.length > 0 ? JSON.stringify(items) : "no items"}`);
			if (items.some((t) => /embed/i.test(t))) {
				await journal.keyboard.press("Enter");
				await journal.waitForTimeout(1100);
				await s.shot(journal, "journal-embed-picker");
				const picker = await journal.evaluate(() => {
					const el = document.querySelector('[role="dialog"], [class*="picker"], [class*="embed-picker"]');
					return el ? (el.textContent ?? "").replace(/\s+/g, " ").slice(0, 200) : null;
				});
				s.note(picker ? `[journal] /embed opened a picker: "${picker.slice(0, 140)}"` : "[journal] /embed inserted but no picker seen");
				await journal.keyboard.press("Escape").catch(() => undefined);
			}
			// tidy
			await journal.keyboard.press("Escape").catch(() => undefined);
			const residue = await journal.evaluate(() => {
				const sel = window.getSelection();
				return sel?.anchorNode?.textContent ?? "";
			});
			for (let i = 0; i < Math.min(residue.length + 4, 12); i++) await journal.keyboard.press("Backspace");
			await s.shot(journal, "journal-after-tidy");
		} catch (e) {
			s.note(`[journal] probe broke: ${String(e).slice(0, 200)}`);
		}
		await journal.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
