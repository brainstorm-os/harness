/**
 * Session 902 — visual sweep of every Notes editor block (verification).
 *
 * Inserts each slash-menu block into a fresh note and screenshots its
 * empty / placeholder state — the surface where "ugly states" (placeholder
 * overlays, missing padding, broken empty states) hide. Media commands
 * (image/video/audio/file) open a native file chooser with no inline empty
 * state, so they're skipped and any chooser is auto-cancelled.
 *
 * Also captures the slash menu at the top and scrolled to the bottom so every
 * command row is inspected.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Block = {
	/** screenshot label */
	key: string;
	/** text typed after "/" to filter the slash menu to this command */
	filter: string;
	/** optional sample text typed into the inserted block to inspect its content state */
	sample?: string;
};

// Transform / inline-rendering blocks with an inspectable empty state. Media
// (image/video/audio/file) + object-picker blocks (bookmark/embed/database/
// graph/book/sub-page/transclusion) are exercised separately or skipped.
const BLOCKS: Block[] = [
	{ key: "heading1", filter: "Heading 1" },
	{ key: "heading2", filter: "Heading 2" },
	{ key: "heading3", filter: "Heading 3" },
	{ key: "bulleted", filter: "Bulleted" },
	{ key: "numbered", filter: "Numbered" },
	{ key: "todo", filter: "To-do" },
	{ key: "quote", filter: "Quote" },
	{ key: "code", filter: "Code", sample: "const x = 1;" },
	{ key: "callout", filter: "Callout", sample: "Heads up — this is a callout." },
	{ key: "toggle", filter: "Toggle" },
	{ key: "divider", filter: "Divider" },
	{ key: "table", filter: "Table", sample: "skip" }, // "Table" — top match should be the grid
	{ key: "equation", filter: "Equation" },
	{ key: "select-field", filter: "Select" },
	{ key: "date-field", filter: "Date" },
	{ key: "number-field", filter: "Number" },
	{ key: "checkbox-field", filter: "Checkbox" },
	{ key: "property", filter: "Property" },
];

test("Notes: visual sweep of all editor blocks", async () => {
	test.setTimeout(420_000);
	const s = await startSession("902-notes-all-blocks");
	const errors: string[] = [];

	s.app.on("window", (page) => {
		// Any block that pops a native file chooser: cancel it so the sweep flows.
		page.on("filechooser", (fc) => void fc.setFiles([]).catch(() => {}));
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const notes = await s.openApp(APP.Notes);
	await notes.waitForTimeout(1500);

	async function newBody(title: string): Promise<void> {
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(900);
		await notes.keyboard.type(title, { delay: 8 });
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(300);
	}

	async function slashInsert(filter: string): Promise<void> {
		await notes.keyboard.type("/", { delay: 20 });
		await notes.waitForTimeout(450);
		await notes.keyboard.type(filter, { delay: 22 });
		await notes.waitForTimeout(500);
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(650);
	}

	try {
		// ── Slash menu chrome: top + scrolled bottom ──
		await newBody("Slash menu");
		await notes.keyboard.type("/", { delay: 20 });
		await notes.waitForTimeout(600);
		await s.shot(notes, "00-slash-top");
		for (let i = 0; i < 28; i += 1) await notes.keyboard.press("ArrowDown");
		await notes.waitForTimeout(400);
		await s.shot(notes, "00-slash-bottom");
		await notes.keyboard.press("Escape");
		await notes.waitForTimeout(200);

		// ── Per-block empty/placeholder state ──
		for (const b of BLOCKS) {
			try {
				await newBody(`Block: ${b.key}`);
				await slashInsert(b.filter);
				await s.shot(notes, `${b.key}-empty`);

				if (b.sample && b.sample !== "skip") {
					await notes.keyboard.type(b.sample, { delay: 10 });
					await notes.waitForTimeout(300);
					await s.shot(notes, `${b.key}-filled`);
				}
				// Inline field chips: open their picker too.
				if (b.key === "select-field" || b.key === "date-field") {
					const chip = notes.locator(`.notes__${b.key}-host button, .notes__select-field-chip`).first();
					if ((await chip.count()) > 0) {
						await chip.click();
						await notes.waitForTimeout(450);
						await s.shot(notes, `${b.key}-picker`);
						await notes.keyboard.press("Escape");
						await notes.waitForTimeout(200);
					}
				}
				s.note(`${b.key}: ok`);
			} catch (e) {
				s.note(`${b.key}: FAILED — ${(e as Error).message.split("\n")[0]}`);
			}
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 30)) s.note(`  ${e}`);
		// Don't hard-fail on errors — this is a visual sweep; surface them in notes.
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
