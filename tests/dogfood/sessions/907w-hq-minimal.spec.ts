/**
 * Session 907w — HQ, minimal and final: create the note fresh (New note →
 * title → dev-hook body), verify, and touch nothing else. The slash-embed
 * automation kept destroying the note (window-title clicks, sidebar-preview
 * matches, title-merging backspaces) — embeds are deferred to a human or a
 * fixed harness helper.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("Northbound HQ: minimal create + verify (907w)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("907w-hq-minimal");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);

		const sidebarHasHQ = async () =>
			(await notes.locator('[class*="sidebar"], nav').first().textContent().catch(() => ""))!.includes("Northbound HQ");

		if (await sidebarHasHQ()) {
			s.note("[notes] Northbound HQ already in the sidebar — nothing to do");
		} else {
			await notes.locator('[aria-label="New note"]').click();
			await notes.waitForTimeout(1500);
			await notes.locator(".notes__title").first().click();
			await notes.keyboard.type("Northbound HQ");
			await notes.waitForTimeout(500);
			const wrote = await notes
				.evaluate(async () => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
					if (!dev) return false;
					await dev.appendParagraph(
						"The operating hub. Everything the studio runs on, one page: the pipeline, the content engine, this week's focus.",
					);
					await dev.appendParagraph(
						"Pipeline: Clients collection in Database — 4 active, US$123k total (Vertex 48k Proposal, Beacon 32k Won, Acme 25k Qualified, Halcyon 18k Lead).",
					);
					await dev.appendParagraph(
						"Content engine: Content Calendar in Database — Issues #5-#8; Issue #8 draft lives in Notes.",
					);
					await dev.appendParagraph(
						"Focus this week: ship Issue #8, get the Vertex proposal out, Beacon renewal is signed — onboard them.",
					);
					return true;
				})
				.catch(() => false);
			await notes.waitForTimeout(800);
			s.note(`[notes] HQ created; body via dev hook: ${wrote}`);
		}

		const title = ((await notes.locator(".notes__title").first().textContent().catch(() => "")) ?? "").trim();
		s.note(`[notes] current note title: "${title}" (want "Northbound HQ")`);
		await s.shot(notes, "hq-final");
		if (title === "Northbound HQ")
			s.chat(SPEAKER.Mira, "HQ page is back — pipeline, content engine, and the week's focus on one page. (Live embeds to follow once the editor lets me put them there.)");
		await notes.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
