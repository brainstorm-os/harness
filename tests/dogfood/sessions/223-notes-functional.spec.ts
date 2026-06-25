/**
 * Session 223 — Notes functional test. Exercise the real editing surface: a new
 * note, markdown-shortcut blocks (heading / list / todo / quote / divider /
 * code), the slash menu (screenshot for the "/ menu polish" TODO), inline
 * formatting, inline property embeds via the dev hook, and PERSISTENCE on
 * reopen. Captures each step + records console errors.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Notes: blocks, slash menu, formatting, persistence (223)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("223-notes-functional");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(2600);

		// New note.
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1500);

		const editor = notes.locator('.notes__body [contenteditable="true"]').first();
		await editor.click().catch(() => undefined);
		await notes.waitForTimeout(400);
		// Title then body. The first line is the title node.
		await notes.keyboard.type("Functional test note", { delay: 12 });
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(300);

		// Markdown-shortcut blocks — the reliable path (no slash-menu fuzzy race).
		const lines: string[] = [
			"# Heading one",
			"## Heading two",
			"- First bullet",
			"- Second bullet",
			"",
			"[] A todo to verify",
			"> A block quote",
			"",
			"---",
			"Some body text with bold and italic words.",
		];
		for (const line of lines) {
			if (line) await notes.keyboard.type(line, { delay: 8 });
			await notes.keyboard.press("Enter");
			await notes.waitForTimeout(150);
		}
		await notes.waitForTimeout(600);
		await s.shot(notes, "01-blocks-rendered");

		// Divider probe — element transformers fire on a trailing SPACE (Lexical
		// requires it). "*** " is untouched by typing shortcuts; "--- " becomes
		// "—- " via the em-dash shortcut (covered by the HR regExp).
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("*** ", { delay: 30 });
		await notes.waitForTimeout(500);
		const hrStar = await editor
			.locator("hr")
			.count()
			.catch(() => 0);
		s.note(`HR nodes after typing "*** ": ${hrStar}`);
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("--- ", { delay: 30 });
		await notes.waitForTimeout(500);
		const hrDash = await editor
			.locator("hr")
			.count()
			.catch(() => 0);
		s.note(`HR nodes after also typing "--- ": ${hrDash}`);
		await s.shot(notes, "01c-divider-probe");

		// Block design inventory — what node types actually rendered.
		const blocks = await editor.evaluate((root) => {
			const out: Record<string, number> = {};
			for (const el of Array.from(root.children)) {
				const tag = el.tagName.toLowerCase();
				const cls = (el.getAttribute("class") ?? "").split(" ")[0] ?? "";
				const key = cls || tag;
				out[key] = (out[key] ?? 0) + 1;
			}
			return out;
		});
		s.note(`Top-level block nodes: ${JSON.stringify(blocks)}`);

		// Slash menu — open it and capture (the "/ menu polish" TODO).
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("/", { delay: 20 });
		await notes.waitForTimeout(700);
		const slashVisible = await notes
			.locator(".fm-menu, [role='listbox'], [role='menu']")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`Slash menu visible after "/": ${slashVisible}`);
		await s.shot(notes, "02-slash-menu");
		await notes.keyboard.press("Escape");
		await notes.waitForTimeout(300);

		// Inline formatting — bold "bold", italic "italic" via double-click select.
		const boldWord = editor.locator("text=bold").first();
		await boldWord.dblclick().catch(() => undefined);
		await notes.keyboard.press("Meta+b").catch(() => undefined);
		await notes.waitForTimeout(300);
		await s.shot(notes, "03-after-bold");
		const hasStrong = await editor
			.locator("strong, b, [style*='bold'], .notes__bold")
			.count()
			.catch(() => 0);
		s.note(`Strong/bold marks present: ${hasStrong}`);

		// Inline property embeds via the dev hook (the real slash-command path).
		for (const id of ["block.embed.checkbox", "block.embed.date", "block.embed.number"]) {
			const ok = await notes
				.evaluate(
					(cmd) =>
						(
							window as unknown as {
								__brainstormNotesDev?: { runBlockCommand: (i: string) => Promise<void> };
							}
						).__brainstormNotesDev
							?.runBlockCommand(cmd)
							.then(() => true)
							.catch((e: Error) => e.message),
					id,
				)
				.catch((e) => (e as Error).message);
			s.note(`runBlockCommand ${id}: ${JSON.stringify(ok)}`);
			await notes.waitForTimeout(500);
		}
		await s.shot(notes, "04-property-embeds");

		// Persistence — switch to another note then back; the title must survive.
		const noteId = await notes
			.evaluate(
				() =>
					(
						window as unknown as { __brainstormNotesDev?: { currentNoteId: () => string | null } }
					).__brainstormNotesDev?.currentNoteId() ?? null,
			)
			.catch(() => null);
		s.note(`Created note id: ${noteId}`);
		const otherItems = notes.locator(".notes__sidebar-item");
		const count = await otherItems.count();
		if (count > 1) {
			await otherItems
				.nth(1)
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1000);
			await otherItems
				.nth(0)
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1200);
		}
		const reopenedText = await notes
			.locator(".notes__body")
			.innerText()
			.catch(() => "");
		s.note(`After reopen, body contains "Heading one": ${reopenedText.includes("Heading one")}`);
		s.note(
			`After reopen, body contains "todo to verify": ${reopenedText.includes("todo to verify")}`,
		);
		await s.shot(notes, "05-after-reopen");
	} finally {
		await s.finish();
	}
});
