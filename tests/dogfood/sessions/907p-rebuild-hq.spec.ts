/**
 * Session 907p — rebuilding Northbound, part 4: the HQ hub + knowledge notes.
 * "Northbound HQ" (with live /embed of the Clients pipeline + Content
 * Calendar), the thesis note, and the Issue #8 draft. Idempotent by title.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("rebuild Northbound — HQ + thesis + issue draft (907p)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("907p-rebuild-hq");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);

		const sidebarText = async () =>
			(((await notes.locator('[aria-label*="sidebar" i], nav').first().textContent().catch(() => "")) ?? "") +
				((await notes.locator("body").textContent().catch(() => "")) ?? "")).replace(/\s+/g, " ");

		const newNote = async (title: string, paragraphs: string[]) => {
			if ((await sidebarText()).includes(title)) {
				s.note(`[notes] "${title}" already exists — skipped`);
				return false;
			}
			await notes.locator('[aria-label="New note"]').click();
			await notes.waitForTimeout(1500);
			const titleEl = notes.locator("h1.notes__title, .notes__title").first();
			await titleEl.click().catch(() => undefined);
			await notes.keyboard.type(title);
			await notes.waitForTimeout(400);
			const wrote = await notes
				.evaluate(async (paras) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					for (const p of paras) await dev.appendParagraph(p);
					return true;
				}, paragraphs)
				.catch(() => false);
			s.note(`[notes] created "${title}" (body via dev hook: ${wrote})`);
			await notes.waitForTimeout(600);
			return true;
		};

		// ---- Northbound HQ with live embeds ---------------------------------
		const made = await newNote("Northbound HQ", [
			"The operating hub. Everything the studio runs on, one page: the pipeline, the content engine, this week's focus.",
			"Focus this week: ship Issue #8, get the Vertex proposal out, Beacon renewal is signed — onboard them.",
		]);
		if (made) {
			// Embed the Clients pipeline + Content Calendar via the slash menu.
			const editor = notes.locator('[contenteditable="true"]').first();
			await editor.click();
			await notes.keyboard.press("Meta+ArrowDown"); // end of doc
			await notes.keyboard.press("Enter");
			for (const target of ["Clients", "Content Calendar"]) {
				await notes.keyboard.type("/");
				await notes.waitForTimeout(700);
				await notes.keyboard.type(target);
				await notes.waitForTimeout(900);
				await s.shot(notes, `hq-slash-${target.toLowerCase().replace(/\s+/g, "-")}`);
				await notes.keyboard.press("Enter");
				await notes.waitForTimeout(1200);
				await notes.keyboard.press("Meta+ArrowDown");
				await notes.keyboard.press("Enter");
			}
			const embeds = await notes
				.evaluate(() => document.querySelectorAll('[class*="embed"], [data-entity-ref]').length)
				.catch(() => 0);
			s.note(`[notes] HQ embed nodes in the doc: ${embeds} (want ≥2)`);
			await s.shot(notes, "hq-done");
		}

		// ---- Thesis + Issue #8 ----------------------------------------------
		await newNote("Northbound thesis", [
			"Independent operators don't lack information; they lack a through-line. Northbound sells the through-line: research that tells you what to ignore.",
			"Two revenue lines: the paid newsletter (recurring) and advisory engagements (project fees). The newsletter builds the audience the advisory work sells into.",
		]);
		await newNote("Issue #8 — Through-lines", [
			"Draft. This issue: why teams drown in dashboards they built themselves, and the three-question filter we use in advisory work.",
			"Open with the Vertex anecdote (anonymized). Close with the renewal-cohort chart once Dana pulls the numbers.",
		]);
		await s.shot(notes, "notes-final");
		s.chat(SPEAKER.Mira, "HQ is back: hub note embedding the live pipeline + calendar, the thesis, and the Issue #8 draft. Northbound has an operating layer again.");
		await notes.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
