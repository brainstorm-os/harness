/**
 * Session 348 — Mira drafts a structured doc, then reopens it (Mira turn).
 *
 * Back to Mira after Priya's 347 knowledge audit. This turn stresses the two
 * things a real operator does that the breadth sweep didn't: (1) build a doc
 * out of VARIED block types (heading / list / quote / code / callout / toggle /
 * divider) the way a slash-menu user would, and (2) the persistence path that
 * has bitten before — reload the renderer and confirm the body re-hydrates
 * from the vault instead of coming back blank (the F-class "switch/reopen →
 * blank body" bug, sessions 311/312). Block types are driven through the
 * notes dev hook (`runBlockCommand`) to avoid the Lexical/Yjs keystroke race;
 * each is best-effort (try/catch) so an unknown id can't blind the persistence
 * check. Per the loop protocol the spec records intent + neutral counts only;
 * the verdict is decided from the captures afterward.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

type NotesDev = {
	appendParagraph: (text: string) => Promise<void>;
	runBlockCommand: (id: string) => Promise<void>;
};

const TITLE = "348 — Mira: structured doc + reopen";
const BLOCKS = [
	"block.heading2",
	"block.numberedList",
	"block.quote",
	"block.code",
	"block.callout",
	"block.toggle",
	"block.divider",
];

test("Mira drafts a structured doc and reopens it — persistence stress (348)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("348-mira-structured-doc-reopen");
	s.chat(
		SPEAKER.Mira,
		"Writing a proper structured doc today — headings, a list, a quote, a code block, a callout, a toggle — then reloading to make sure it all comes back. If a reopen ever shows me a blank page I lose trust fast.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1300);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowUp").catch(() => undefined);
		await notes.waitForTimeout(200);
		await notes.keyboard.type(TITLE, { delay: 10 });
		await notes.waitForTimeout(300);

		// Body intro + varied blocks via the dev hook.
		await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev })
					.__brainstormNotesDev;
				if (!dev) return;
				await dev.appendParagraph(
					"Operating cadence — the weekly doc I actually keep: status, blockers, decisions, and a snippet I keep pasting.",
				);
			})
			.catch(() => undefined);

		const applied: string[] = [];
		for (const id of BLOCKS) {
			const ok = await notes
				.evaluate(async (blockId) => {
					const dev = (window as unknown as { __brainstormNotesDev?: NotesDev })
						.__brainstormNotesDev;
					if (!dev) return "no-dev-hook";
					try {
						await dev.runBlockCommand(blockId);
						return "ok";
					} catch (e) {
						return `ERR: ${(e as Error).message.split("\n")[0]}`;
					}
				}, id)
				.catch((e) => `ERR(eval): ${(e as Error).message.split("\n")[0]}`);
			applied.push(`${id} → ${ok}`);
			await notes.waitForTimeout(150);
		}
		s.note("block commands run:");
		for (const a of applied) s.note(`  ${a}`);
		await notes.waitForTimeout(400);
		await s.shot(notes, "01-structured-doc");

		// Measure the doc BEFORE reload — block count + body text length.
		const before = await measureDoc(notes);
		s.note(
			`\nbefore reload — blocks: ${before.blocks}, body chars: ${before.chars}`,
		);

		// ── Persistence stress: reload the renderer, re-hydrate from the vault ──
		await notes.reload();
		await notes.waitForTimeout(2500);
		await s.shot(notes, "02-after-reload");

		// The reopened app may land on its list; re-select the note by title.
		await notes
			.locator(`text=${TITLE}`)
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1500);
		await s.shot(notes, "03-note-reselected");

		const after = await measureDoc(notes);
		s.note(
			`after reload  — blocks: ${after.blocks}, body chars: ${after.chars}`,
		);
		s.note(
			`body retained ${after.chars}/${before.chars} chars across reload (the persistence signal — verdict from captures)`,
		);

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(
			errors,
			"no console/page errors drafting + reopening the doc",
		).toEqual([]);
	} finally {
		await s.finish();
	}
});

async function measureDoc(
	page: import("@playwright/test").Page,
): Promise<{ blocks: number; chars: number }> {
	const blocks = await page
		.locator('[contenteditable="true"] > *')
		.count()
		.catch(() => 0);
	const chars = (
		await page
			.locator('[contenteditable="true"]')
			.first()
			.innerText()
			.catch(() => "")
	).trim().length;
	return { blocks, chars };
}
