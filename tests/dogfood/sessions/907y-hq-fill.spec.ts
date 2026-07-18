/** Session 907y — fill the empty HQ note (title + body) in place. */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

test("Northbound HQ: fill in place (907y)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("907y-hq-fill");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		await notes.locator('[class*="sidebar"] >> text="Northbound HQ"').first().click();
		await notes.waitForTimeout(1200);

		const titleEl = notes.locator(".notes__title").first();
		const title0 = ((await titleEl.textContent().catch(() => "")) ?? "").trim();
		if (title0 === "") {
			await titleEl.click();
			await notes.keyboard.type("Northbound HQ");
			await notes.waitForTimeout(500);
		}
		const body0 = ((await notes.locator('[contenteditable="true"]').last().textContent().catch(() => "")) ?? "").trim();
		if (!/operating hub/i.test(body0)) {
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
			s.note(`[notes] body appended: ${wrote}`);
			await notes.waitForTimeout(800);
		}
		const title = ((await titleEl.textContent().catch(() => "")) ?? "").trim();
		const body = ((await notes.locator('[contenteditable="true"]').last().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
		s.note(`[notes] final title="${title}" body-head="${body.slice(0, 160)}"`);
		await s.shot(notes, "hq-filled");
		if (title === "Northbound HQ" && /operating hub/i.test(body))
			s.chat(SPEAKER.Mira, "HQ page restored for real this time — pipeline, content engine, weekly focus, one page.");
	} finally {
		await s.finish();
	}
});
