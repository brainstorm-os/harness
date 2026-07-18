/**
 * Session 907v — HQ embeds with EDITOR-SCOPED locators (the `text=` matches
 * were hitting the sidebar previews — that's why every "/" landed at the top
 * of the doc as plain text). Cleanup uses a single Backspace per line so it
 * can never merge into the title again.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Northbound HQ: scoped embeds (907v)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907v-hq-embeds-scoped");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		await notes.locator('text="Northbound HQ"').first().click();
		await notes.waitForTimeout(1200);
		const editor = notes.locator('[contenteditable="true"]').first();

		// Clean the literal slash lines (single backspace after selecting text).
		for (const junk of ["/Clients", "/Content Calendar"]) {
			const line = editor.locator(`text="${junk}"`).first();
			if ((await line.count()) > 0) {
				await line.click();
				await notes.keyboard.press("End");
				await notes.keyboard.press("Shift+Home");
				await notes.keyboard.press("Backspace");
				await notes.waitForTimeout(300);
				s.note(`[notes] cleared "${junk}" (block left empty on purpose)`);
			}
		}

		// Embed from the end of the focus paragraph — scoped to the editor.
		const anchor = editor.locator("text=/onboard them/").first();
		if ((await anchor.count()) === 0) {
			s.note("[notes] focus paragraph not found INSIDE the editor");
			await s.shot(notes, "no-anchor");
			return;
		}
		await anchor.click();
		await notes.keyboard.press("End");
		for (const target of ["Clients", "Content Calendar"]) {
			await notes.keyboard.press("Enter");
			await notes.waitForTimeout(400);
			await notes.keyboard.type("/", { delay: 80 });
			await notes.waitForTimeout(1000);
			const options = await notes
				.evaluate(() => {
					const menu = Array.from(document.querySelectorAll('[class*="typeahead"], [role="listbox"]')).find(
						(el) => (el as HTMLElement).offsetParent !== null && (el.textContent ?? "").length > 0,
					);
					return menu ? (menu.textContent ?? "").slice(0, 80) : null;
				})
				.catch(() => null);
			if (!options) {
				s.note(`[notes] no visible slash menu for "${target}" — backing out`);
				await s.shot(notes, `no-menu-${target.toLowerCase().replace(/\s+/g, "-")}`);
				await notes.keyboard.press("Backspace");
				continue;
			}
			await notes.keyboard.type(target, { delay: 40 });
			await notes.waitForTimeout(1000);
			await s.shot(notes, `menu-${target.toLowerCase().replace(/\s+/g, "-")}`);
			await notes.keyboard.press("Enter");
			await notes.waitForTimeout(1500);
		}

		const embeds = await notes
			.evaluate(
				() => document.querySelectorAll('[class*="embed"], [data-entity-ref], [class*="mention"]').length,
			)
			.catch(() => 0);
		const bodyHead = ((await editor.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").slice(0, 260);
		s.note(`[notes] embed/mention nodes: ${embeds}; body: "${bodyHead}"`);
		await s.shot(notes, "hq-final");
		if (embeds >= 2)
			s.chat(SPEAKER.Mira, "HQ hub is whole: live Clients pipeline + Content Calendar embedded on the operating page.");
		await notes.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
