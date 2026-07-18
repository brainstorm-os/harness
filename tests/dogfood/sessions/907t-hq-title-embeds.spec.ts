/**
 * Session 907t — restore the HQ title (907q's line-cleanup backspaced it
 * away, leaving "Untitled"), then embed the pipeline + calendar.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Northbound HQ: restore title + embeds (907t)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907t-hq-title-embeds");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		await notes.locator("text=/^Untitled/").first().click();
		await notes.waitForTimeout(1200);
		const body0 = ((await notes.locator('[contenteditable="true"]').first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		s.note(`[notes] untitled note body head: "${body0.slice(0, 160)}"`);
		if (!/operating hub/i.test(body0)) {
			s.note("[notes] this untitled note is NOT the HQ — stopping");
			await s.shot(notes, "wrong-note");
			return;
		}
		const title = notes.locator(".notes__title").first();
		await title.click();
		await notes.keyboard.press("Meta+A");
		await notes.keyboard.type("Northbound HQ");
		await notes.waitForTimeout(600);
		s.note(`[notes] title restored: "${(await title.textContent().catch(() => ""))?.trim()}"`);

		const anchor = notes.locator("text=/onboard them/").first();
		if ((await anchor.count()) > 0) {
			await anchor.click();
			await notes.keyboard.press("End");
			for (const target of ["Clients", "Content Calendar"]) {
				await notes.keyboard.press("Enter");
				await notes.waitForTimeout(400);
				await notes.keyboard.type("/", { delay: 80 });
				await notes.waitForTimeout(900);
				const menuOpen = await notes
					.evaluate(() => document.querySelector('[class*="typeahead"], [role="listbox"]') !== null)
					.catch(() => false);
				if (!menuOpen) {
					s.note(`[notes] slash menu did NOT open for "${target}"`);
					await s.shot(notes, `no-menu-${target.toLowerCase().replace(/\s+/g, "-")}`);
					await notes.keyboard.press("Backspace");
					continue;
				}
				await notes.keyboard.type(target, { delay: 40 });
				await notes.waitForTimeout(900);
				await s.shot(notes, `menu-${target.toLowerCase().replace(/\s+/g, "-")}`);
				await notes.keyboard.press("Enter");
				await notes.waitForTimeout(1500);
				await notes.keyboard.press("Meta+ArrowDown");
			}
		} else s.note("[notes] no anchor paragraph for embeds");

		const embeds = await notes
			.evaluate(() => document.querySelectorAll('[class*="embed"], [data-entity-ref]').length)
			.catch(() => 0);
		s.note(`[notes] embed nodes in HQ: ${embeds}`);
		await s.shot(notes, "hq-final");
		if (embeds >= 2)
			s.chat(SPEAKER.Mira, "HQ hub is whole again: title restored, live Clients pipeline + Content Calendar embedded.");
		await notes.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
