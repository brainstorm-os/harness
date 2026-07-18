/**
 * Session 907r — HQ final fixup: dump the body, repair any text the cleanup
 * damaged, then do the embeds from a verified caret position.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("Northbound HQ: fixup + embeds (907r)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("907r-hq-fixup");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		await notes.locator('text="Northbound HQ"').first().click();
		await notes.waitForTimeout(1200);

		const bodyText = async () =>
			((await notes.locator('[contenteditable="true"]').first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
		const before = await bodyText();
		s.note(`[notes] HQ body before fixup: "${before.slice(0, 300)}"`);
		await s.shot(notes, "hq-before-fixup");

		// If the focus-week paragraph got damaged, re-append a clean version.
		if (!/onboard them/.test(before)) {
			await notes.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (dev) await dev.appendParagraph("Focus this week: ship Issue #8, get the Vertex proposal out, Beacon renewal is signed — onboard them.");
			}).catch(() => undefined);
			await notes.waitForTimeout(600);
			s.note("[notes] re-appended the focus-week paragraph");
		}

		// Embeds from the end of the last paragraph.
		const anchor = notes.locator("text=/onboard them/").first();
		if ((await anchor.count()) === 0) {
			s.note("[notes] still no anchor paragraph — see shot; stopping");
			return;
		}
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

		const embeds = await notes
			.evaluate(() => document.querySelectorAll('[class*="embed"], [data-entity-ref]').length)
			.catch(() => 0);
		s.note(`[notes] embed nodes in HQ now: ${embeds}; body: "${(await bodyText()).slice(0, 300)}"`);
		await s.shot(notes, "hq-final");
		if (embeds >= 2)
			s.chat(SPEAKER.Mira, "HQ hub now embeds the live Clients pipeline and the Content Calendar — one page, whole business.");
		await notes.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
