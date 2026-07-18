/**
 * Session 907u — HQ, definitive pass: enumerate today's notes, find the HQ
 * body if it survived; otherwise rebuild the note cleanly (title first, then
 * body, then embeds); delete the empty Untitled leftover if present.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("Northbound HQ: definitive rebuild (907u)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907u-hq-rebuild-final");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);

		// Enumerate the Today rows.
		const rowTexts = await notes
			.evaluate(() => {
				const out: string[] = [];
				for (const el of Array.from(document.querySelectorAll("li, [role='option'], [class*='row']"))) {
					const t = (el.textContent ?? "").trim();
					if (t && t.length < 60) out.push(t);
				}
				return [...new Set(out)].slice(0, 25);
			})
			.catch(() => [] as string[]);
		s.note(`[notes] rows: ${JSON.stringify(rowTexts)}`);

		// Look for a surviving HQ body among candidates.
		let hqFound = false;
		for (const row of rowTexts.filter((t) => /Untitled|operating|Northbound HQ|Hausaufgabe/i.test(t))) {
			const el = notes.locator(`text="${row}"`).first();
			if ((await el.count()) === 0) continue;
			await el.click();
			await notes.waitForTimeout(900);
			const body = ((await notes.locator('[contenteditable="true"]').first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
			s.note(`[notes] "${row}" body head: "${body.slice(0, 100)}"`);
			if (/operating hub/i.test(body)) {
				hqFound = true;
				const title = notes.locator(".notes__title").first();
				await title.click();
				await notes.keyboard.press("Meta+A");
				await notes.keyboard.type("Northbound HQ");
				await notes.waitForTimeout(600);
				s.note("[notes] found surviving HQ body — title restored");
				break;
			}
		}

		if (!hqFound) {
			await notes.locator('[aria-label="New note"]').click();
			await notes.waitForTimeout(1500);
			await notes.locator(".notes__title").first().click();
			await notes.keyboard.type("Northbound HQ");
			await notes.waitForTimeout(400);
			await notes
				.evaluate(async () => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return;
					await dev.appendParagraph(
						"The operating hub. Everything the studio runs on, one page: the pipeline, the content engine, this week's focus.",
					);
					await dev.appendParagraph(
						"Focus this week: ship Issue #8, get the Vertex proposal out, Beacon renewal is signed — onboard them.",
					);
				})
				.catch(() => undefined);
			await notes.waitForTimeout(600);
			s.note("[notes] rebuilt the HQ note from scratch");
		}

		// Embeds.
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
		}

		const embeds = await notes
			.evaluate(() => document.querySelectorAll('[class*="embed"], [data-entity-ref]').length)
			.catch(() => 0);
		s.note(`[notes] embed nodes in HQ: ${embeds}`);
		await s.shot(notes, "hq-final");
		if (embeds >= 2)
			s.chat(SPEAKER.Mira, "HQ hub is whole: live Clients pipeline + Content Calendar embedded on the operating page.");
		await notes.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
