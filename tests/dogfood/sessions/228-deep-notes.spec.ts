/**
 * Session 228 — DEEP Notes walkthrough. A founder-session that pushes the
 * Notes app across its whole surface to surface broken features, judging each
 * action from OBSERVABLE DOM state (a count / text / class / url change, a menu
 * becoming visible) rather than from whether a click threw. Every step records
 * a `[PASS] / [FAIL] / [?]` line via `s.note()`, wrapped in its own try/catch so
 * one broken affordance never aborts the rest of the walkthrough.
 *
 * Coverage (per the 228 brief):
 *   - new note + title focus (F-001: type without clicking lands in the TITLE)
 *   - markdown blocks (# ## - [] > --- ```), each asserted as a rendered node
 *   - slash menu opens + inserting a block works
 *   - inline formatting (bold / italic / code) applies marks
 *   - LINKS (priority): create a link/mention to another note, then CLICK it
 *     and assert it NAVIGATES (the active note changes)
 *   - transclusion / embed via the dev hook renders an entity card
 *   - properties panel: add / edit a property, assert it saves
 *   - cover add / remove
 *   - note icon change
 *   - lock (read-only) toggle disables editing
 *   - sidebar: switch / rename / delete a note (assert it leaves the list)
 *   - search notes
 *   - header ⋯ "Note actions" menu — open + click each item, record outcome
 *   - persistence: switch away + back, assert the body survives
 *
 * NOTE: this is an observation harness, not a pass/fail gate — Playwright never
 * `expect()`s here. The signal is the `notes.md` capture, distilled into the
 * friction log afterwards.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const EDITOR = '.notes__body [contenteditable="true"]';
const SIDEBAR_ITEM = ".notes__sidebar-item";
const MENU = ".bs-object-menu, .fm-menu, [role='menu'], [role='listbox']";

type NotesDev = {
	runBlockCommand: (id: string) => Promise<void>;
	appendParagraph: (text: string) => Promise<void>;
	insertTransclusion: (entityId: string, entityType: string, label: string) => Promise<void>;
	insertEmbed: (
		entityId: string,
		entityType: string,
		label: string,
		blockId: string,
	) => Promise<void>;
	currentNoteId: () => string | null;
};

test("deep notes walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-notes");

	// ── tiny local helpers ──────────────────────────────────────────────────
	const pass = (action: string, observed: string) => s.note(`[PASS] ${action} — ${observed}`);
	const fail = (action: string, observed: string) => s.note(`[FAIL] ${action} — ${observed}`);
	const unsure = (action: string, observed: string) => s.note(`[?] ${action} — ${observed}`);

	/** Judge: record PASS/FAIL from a boolean condition + observed string. */
	const judge = (action: string, ok: boolean, observed: string) =>
		ok ? pass(action, observed) : fail(action, observed);

	/** Read the dev hook's current note id (null if no editor yet). */
	const currentNoteId = (page: Page): Promise<string | null> =>
		page
			.evaluate(
				() =>
					(
						window as unknown as { __brainstormNotesDev?: NotesDev }
					).__brainstormNotesDev?.currentNoteId() ?? null,
			)
			.catch(() => null);

	/** Invoke a `__brainstormNotesDev` method by name with args (mirrors the
	 *  proven 223 pattern — read the global INSIDE evaluate, never serialize a
	 *  closure across the contextBridge). Returns `true` or the error message. */
	const runDev = (
		page: Page,
		call:
			| { method: "runBlockCommand"; args: [string] }
			| { method: "appendParagraph"; args: [string] }
			| { method: "insertTransclusion"; args: [string, string, string] }
			| { method: "insertEmbed"; args: [string, string, string, string] },
	): Promise<true | string> =>
		page
			.evaluate(async (c) => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev }).__brainstormNotesDev;
				if (!dev) return "no __brainstormNotesDev hook";
				try {
					// biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch over the typed dev surface
					await (dev[c.method] as (...a: unknown[]) => Promise<void>)(...(c.args as any));
					return true;
				} catch (e) {
					return (e as Error).message;
				}
			}, call)
			.catch((e) => (e as Error).message);

	/** Click the header "New note" button; return the new note id (or null). */
	const newNote = async (page: Page): Promise<string | null> => {
		await page
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(1400);
		return currentNoteId(page);
	};

	/** Focus the body editor and place the caret. */
	const focusEditor = async (page: Page) => {
		await page
			.locator(EDITOR)
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(300);
	};

	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(2800);
		await s.shot(notes, "00-notes-open");

		// ── 1. NEW NOTE + TITLE FOCUS (F-001) ────────────────────────────────
		// The brief: type WITHOUT clicking and confirm the text lands in the
		// TITLE node, not the body. After "New note" the title should be focused.
		try {
			const id = await newNote(notes);
			judge("create new note", id !== null, id ? `note id ${id}` : "currentNoteId() returned null");

			// Type immediately — do NOT click first. Whatever has focus receives it.
			const titleText = "Deep Notes 228";
			await notes.keyboard.type(titleText, { delay: 14 }).catch(() => undefined);
			await notes.waitForTimeout(600);

			// The title is the first top-level block of the editor. Read where the
			// typed text landed: title vs. the rest of the body.
			const placement = await notes
				.locator(EDITOR)
				.first()
				.evaluate((root, typed) => {
					const first = root.children[0];
					const firstText = (first?.textContent ?? "").trim();
					const total = (root.textContent ?? "").trim();
					return {
						inFirstBlock: firstText.includes(typed),
						firstText,
						total,
						childCount: root.children.length,
					};
				}, titleText)
				.catch(() => null);

			if (!placement) {
				unsure("title focus on new note (F-001)", "could not read editor DOM");
			} else {
				judge(
					"title focus on new note (F-001): typed text lands in TITLE",
					placement.inFirstBlock,
					`first block="${placement.firstText}" (childCount=${placement.childCount})`,
				);
			}
			await s.shot(notes, "01-title-typed");
		} catch (e) {
			fail("create new note + title focus", (e as Error).message);
		}

		// ── 2. MARKDOWN BLOCKS ────────────────────────────────────────────────
		// Each markdown shortcut fires on a trailing space (Lexical element
		// transformers). Type each on its own fresh line, then inventory the
		// rendered node types. We assert by node tag/class, not by whether a key
		// throw occurred.
		try {
			await focusEditor(notes);
			await notes.keyboard.press("Enter"); // leave the title line, into body
			await notes.waitForTimeout(200);

			const mdLines = [
				"# Heading one",
				"## Heading two",
				"### Heading three",
				"- A bullet item",
				"1. A numbered item",
				"[] A todo checkbox",
				"> A block quote",
				"```",
				"const code = 1;",
			];
			for (const line of mdLines) {
				await notes.keyboard.type(line, { delay: 8 }).catch(() => undefined);
				await notes.keyboard.press("Enter");
				await notes.waitForTimeout(140);
			}
			// Divider: "--- " (Notes' em-dash shortcut eats "--", so the HR regexp
			// covers the "—- " result). Type it on its own line.
			await notes.keyboard.type("--- ", { delay: 30 }).catch(() => undefined);
			await notes.waitForTimeout(500);
			await s.shot(notes, "02-markdown-blocks");

			const inv = await notes
				.locator(EDITOR)
				.first()
				.evaluate((root) => {
					const q = (sel: string) => root.querySelectorAll(sel).length;
					return {
						h1: q("h1"),
						h2: q("h2"),
						h3: q("h3"),
						ul: q("ul"),
						ol: q("ol"),
						li: q("li"),
						checkbox:
							q('li[role="checkbox"]') +
							q("li[aria-checked]") +
							q('input[type="checkbox"]') +
							q(".PlaygroundEditorTheme__listItemChecked, [class*='checklist'], [class*='Checklist']"),
						blockquote: q("blockquote"),
						code: q("code, pre, [class*='code']"),
						hr: q("hr"),
					};
				})
				.catch(() => null);

			if (!inv) {
				unsure("markdown blocks rendered", "could not inventory editor DOM");
			} else {
				s.note(`Markdown node inventory: ${JSON.stringify(inv)}`);
				judge("markdown '#' → H1", inv.h1 >= 1, `h1=${inv.h1}`);
				judge("markdown '##' → H2", inv.h2 >= 1, `h2=${inv.h2}`);
				judge("markdown '###' → H3", inv.h3 >= 1, `h3=${inv.h3}`);
				judge("markdown '- ' → bullet list", inv.ul >= 1, `ul=${inv.ul}`);
				judge("markdown '1. ' → numbered list", inv.ol >= 1, `ol=${inv.ol}`);
				judge("markdown '[] ' → checklist", inv.checkbox >= 1, `checkbox-ish=${inv.checkbox}`);
				judge("markdown '> ' → blockquote", inv.blockquote >= 1, `blockquote=${inv.blockquote}`);
				judge("markdown ``` → code block", inv.code >= 1, `code=${inv.code}`);
				judge("markdown '--- ' → divider (hr)", inv.hr >= 1, `hr=${inv.hr}`);
			}
		} catch (e) {
			fail("markdown blocks", (e as Error).message);
		}

		// ── 3. SLASH MENU OPENS + INSERTS A BLOCK ────────────────────────────
		// Open the menu by typing "/", assert it becomes visible. Then drive the
		// real insertion through the dev hook (synthetic keystrokes against the
		// fuzzy match race + Yjs-bound editor are flaky) and assert a callout
		// block rendered.
		try {
			await focusEditor(notes);
			await notes.keyboard.press("Enter");
			await notes.keyboard.type("/", { delay: 30 }).catch(() => undefined);
			await notes.waitForTimeout(700);
			const slashVisible = await notes
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			judge("slash menu opens on '/'", slashVisible, `menu visible=${slashVisible}`);
			await s.shot(notes, "03-slash-menu");
			await notes.keyboard.press("Escape").catch(() => undefined);
			await notes.waitForTimeout(300);

			// Insert a callout via the registry — observable as a new block.
			const before = await notes
				.locator(EDITOR)
				.first()
				.evaluate((r) => r.querySelectorAll("[class*='callout'], [class*='Callout']").length)
				.catch(() => 0);
			const ranCallout = await runDev(notes, {
				method: "runBlockCommand",
				args: ["block.callout"],
			});
			await notes.waitForTimeout(600);
			const after = await notes
				.locator(EDITOR)
				.first()
				.evaluate((r) => r.querySelectorAll("[class*='callout'], [class*='Callout']").length)
				.catch(() => 0);
			judge(
				"slash command inserts a block (callout)",
				ranCallout === true && after > before,
				`runBlockCommand=${JSON.stringify(ranCallout)}, callout nodes ${before}→${after}`,
			);
			await s.shot(notes, "04-callout-inserted");
		} catch (e) {
			fail("slash menu / insert block", (e as Error).message);
		}

		// ── 4. INLINE FORMATTING (bold / italic / code) ──────────────────────
		// Seed a deterministic word via the dev hook, select it, apply the mark,
		// assert the corresponding element appears.
		try {
			await runDev(notes, {
				method: "appendParagraph",
				args: ["formatme bolditalic codeword"],
			});
			await notes.waitForTimeout(400);
			await focusEditor(notes);

			const applyAndCount = async (
				word: string,
				chord: string,
				selector: string,
			): Promise<{ before: number; after: number }> => {
				const target = notes.locator(EDITOR).getByText(word, { exact: false }).first();
				const before = await notes
					.locator(EDITOR)
					.first()
					.evaluate((r, sel) => r.querySelectorAll(sel).length, selector)
					.catch(() => 0);
				await target.dblclick().catch(() => undefined);
				await notes.waitForTimeout(200);
				await notes.keyboard.press(chord).catch(() => undefined);
				await notes.waitForTimeout(300);
				const after = await notes
					.locator(EDITOR)
					.first()
					.evaluate((r, sel) => r.querySelectorAll(sel).length, selector)
					.catch(() => 0);
				return { before, after };
			};

			const bold = await applyAndCount(
				"formatme",
				"Meta+b",
				"strong, b, [class*='bold'], [class*='Bold']",
			);
			judge(
				"inline bold (Meta+b)",
				bold.after > bold.before,
				`strong-ish ${bold.before}→${bold.after}`,
			);

			const italic = await applyAndCount(
				"bolditalic",
				"Meta+i",
				"em, i, [class*='italic'], [class*='Italic']",
			);
			judge(
				"inline italic (Meta+i)",
				italic.after > italic.before,
				`em-ish ${italic.before}→${italic.after}`,
			);

			const code = await applyAndCount(
				"codeword",
				"Meta+e",
				"code, [class*='inlineCode'], [class*='textCode']",
			);
			judge("inline code (Meta+e)", code.after > code.before, `code-ish ${code.before}→${code.after}`);
			await s.shot(notes, "05-inline-formatting");
		} catch (e) {
			fail("inline formatting", (e as Error).message);
		}

		// ── 5. LINKS (PRIORITY): create a link to another note, then CLICK it
		//        and ASSERT navigation (active note changes) ───────────────────
		// We need a SECOND note to link to. Make it, capture its id + title, then
		// return to the first note and create a link. We try the Mod+K link-markup
		// picker first (most reliable cross-note link path). On click the editor's
		// capture-phase interceptor dispatches `open` → the active note id should
		// flip to the target.
		try {
			// Create target note.
			const targetId = await newNote(notes);
			await notes.keyboard.type("Link Target Note", { delay: 14 }).catch(() => undefined);
			await notes.waitForTimeout(700);
			judge("create link-target note", targetId !== null, `target id ${targetId}`);

			// Back to the source note (most-recent list has both). Pick the row
			// whose title is "Deep Notes 228".
			const sourceRow = notes.locator(SIDEBAR_ITEM).filter({ hasText: "Deep Notes 228" }).first();
			await sourceRow.click().catch(() => undefined);
			await notes.waitForTimeout(1000);
			const sourceId = await currentNoteId(notes);
			s.note(`Source note id (for link test): ${sourceId}`);

			// Seed a word to wrap as a link, select it, open Mod+K, pick the target.
			await runDev(notes, {
				method: "appendParagraph",
				args: ["Jump to the linktarget here"],
			});
			await notes.waitForTimeout(400);
			await focusEditor(notes);
			await notes
				.locator(EDITOR)
				.getByText("linktarget", { exact: false })
				.first()
				.dblclick()
				.catch(() => undefined);
			await notes.waitForTimeout(250);
			await notes.keyboard.press("Meta+k").catch(() => undefined);
			await notes.waitForTimeout(600);
			const linkPickerVisible = await notes
				.locator(".notes__link-markup-menu, [role='dialog']")
				.first()
				.isVisible()
				.catch(() => false);
			judge("Mod+K opens link picker", linkPickerVisible, `picker visible=${linkPickerVisible}`);
			await s.shot(notes, "06-link-picker");

			let linkCreated = false;
			if (linkPickerVisible) {
				// Type to filter to the target, pick the first result.
				await notes.keyboard.type("Link Target", { delay: 18 }).catch(() => undefined);
				await notes.waitForTimeout(500);
				const firstResult = notes.locator(".notes__link-markup-menu .fm-row, [role='option']").first();
				const haveResult = await firstResult.isVisible().catch(() => false);
				if (haveResult) {
					await firstResult.click().catch(() => undefined);
				} else {
					// Fall back to Enter (commit highlighted).
					await notes.keyboard.press("Enter").catch(() => undefined);
				}
				await notes.waitForTimeout(700);
				linkCreated = await notes
					.locator(EDITOR)
					.first()
					.evaluate(
						(r) =>
							r.querySelector("a[href^='brainstorm://entity/'], [data-entity-id], a[href*='entity']") !==
							null,
					)
					.catch(() => false);
			}
			judge("link/mention node created in body", linkCreated, `anchor present=${linkCreated}`);
			await s.shot(notes, "07-link-created");

			// CLICK the link and assert navigation: the active note id flips to the
			// target. Note opens in-place via the interceptor's `open` dispatch.
			if (linkCreated && targetId) {
				const beforeNav = await currentNoteId(notes);
				await notes
					.locator(`${EDITOR} a[href*='entity'], ${EDITOR} [data-entity-id]`)
					.first()
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(1500);
				const afterNav = await currentNoteId(notes);
				const navigated = afterNav !== beforeNav && afterNav === targetId;
				judge(
					"CLICK link → navigates to target note (active note changes)",
					navigated,
					`active note ${beforeNav} → ${afterNav} (expected ${targetId})`,
				);
				await s.shot(notes, "08-after-link-nav");
			} else {
				unsure("CLICK link → navigates", "no link to click (creation failed)");
			}
		} catch (e) {
			fail("links create + navigate", (e as Error).message);
		}

		// ── 6. TRANSCLUSION / EMBED via dev hook → entity card renders ───────
		try {
			// Return to the source note so the embeds land in a known doc.
			await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "Deep Notes 228" })
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(900);
			const hostId = await currentNoteId(notes);

			// Transclude the link-target note. Use its id if we can find it from the
			// list; else transclude something. We re-derive the target id via the
			// most-recent list isn't reliable, so transclude by re-opening: just
			// transclude the host's sibling using a stable type.
			const targetRow = notes.locator(SIDEBAR_ITEM).filter({ hasText: "Link Target Note" }).first();
			// Capture target id by opening it, reading id, returning.
			await targetRow.click().catch(() => undefined);
			await notes.waitForTimeout(800);
			const tId = await currentNoteId(notes);
			await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "Deep Notes 228" })
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(900);

			const NOTE_TYPE = "io.brainstorm.notes/Note/v1";
			const ranTrans =
				tId !== null
					? await runDev(notes, {
							method: "insertTransclusion",
							args: [tId, NOTE_TYPE, "Link Target Note"],
						})
					: "no target id";
			await notes.waitForTimeout(1200);
			const transCard = await notes
				.locator(EDITOR)
				.first()
				.evaluate(
					(r) =>
						r.querySelectorAll(
							"[class*='transclusion'], [class*='Transclusion'], [data-transclusion], [class*='entity-card'], [class*='EntityCard']",
						).length,
				)
				.catch(() => 0);
			judge(
				"transclusion renders an entity card",
				ranTrans === true && transCard > 0,
				`insert=${JSON.stringify(ranTrans)}, transclusion nodes=${transCard}`,
			);
			await s.shot(notes, "09-transclusion");

			// Embed (block-embed) — a BP block card. Use a synthetic blockId.
			const ranEmbed =
				tId !== null
					? await runDev(notes, {
							method: "insertEmbed",
							args: [tId, NOTE_TYPE, "Link Target Note", "block-card"],
						})
					: "no target id";
			await notes.waitForTimeout(1200);
			const embedCard = await notes
				.locator(EDITOR)
				.first()
				.evaluate(
					(r) =>
						r.querySelectorAll(
							"[class*='embed'], [class*='Embed'], iframe, [data-block-id], [class*='entity-card']",
						).length,
				)
				.catch(() => 0);
			judge(
				"block-embed renders a card/iframe",
				ranEmbed === true && embedCard > 0,
				`insert=${JSON.stringify(ranEmbed)}, embed nodes=${embedCard}`,
			);
			await s.shot(notes, "10-embed");
			void hostId;
		} catch (e) {
			fail("transclusion / embed", (e as Error).message);
		}

		// ── 7. PROPERTIES PANEL: add + edit a property, assert it saves ──────
		try {
			// Open the properties panel (right toggle). It's the panel-toggle with
			// controls="notes-props".
			await notes
				.locator('[aria-controls="notes-props"], button[aria-label*="properties" i]')
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(700);
			const panelVisible = await notes
				.locator("#notes-props .bs-props__inner, [aria-label='Note properties']")
				.first()
				.isVisible()
				.catch(() => false);
			judge("properties panel opens", panelVisible, `panel visible=${panelVisible}`);
			await s.shot(notes, "11-properties-open");

			// Add a property via the "+ Add property" button → add-property menu.
			const rowsBefore = await notes
				.locator("#notes-props .bs-props__row")
				.count()
				.catch(() => 0);
			await notes
				.locator("#notes-props .bs-props__add, button:has-text('Add property')")
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(700);
			const addMenuVisible = await notes
				.locator(`${MENU}, [aria-label='Add property']`)
				.first()
				.isVisible()
				.catch(() => false);
			judge("add-property menu opens", addMenuVisible, `add menu visible=${addMenuVisible}`);
			await s.shot(notes, "12-add-property-menu");

			// Pick the first available property suggestion (the vault seeds some).
			let propertyAdded = false;
			if (addMenuVisible) {
				const firstProp = notes
					.locator(
						"[aria-label='Add property'] .fm-row, [aria-label='Property suggestions'] [role='option'], .fm-menu .fm-row",
					)
					.first();
				if (await firstProp.isVisible().catch(() => false)) {
					await firstProp.click().catch(() => undefined);
					await notes.waitForTimeout(900);
					const rowsAfter = await notes
						.locator("#notes-props .bs-props__row")
						.count()
						.catch(() => 0);
					propertyAdded = rowsAfter > rowsBefore;
					s.note(`Property rows ${rowsBefore} → ${rowsAfter}`);
				} else {
					unsure("pick a property suggestion", "no suggestion row visible");
					await notes.keyboard.press("Escape").catch(() => undefined);
				}
			}
			judge("add a property to the note", propertyAdded, `added=${propertyAdded}`);
			await s.shot(notes, "13-property-added");

			// Edit the property value: click the first row's value cell and type.
			let valueSaved = false;
			if (propertyAdded) {
				const firstRow = notes.locator("#notes-props .bs-props__row").first();
				const propKey = await firstRow.getAttribute("data-property-key").catch(() => null);
				await firstRow
					.locator(".bs-props__row-value")
					.first()
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(400);
				await notes.keyboard.type("228-value", { delay: 16 }).catch(() => undefined);
				await notes.keyboard.press("Enter").catch(() => undefined);
				await notes.waitForTimeout(700);
				const rowText = await firstRow.innerText().catch(() => "");
				valueSaved = rowText.includes("228-value");
				s.note(`Edited property "${propKey}" — row text now: "${rowText.replace(/\n/g, " ")}"`);
			}
			judge("edit + save property value", valueSaved, `value persisted in cell=${valueSaved}`);
			await s.shot(notes, "14-property-value");
		} catch (e) {
			fail("properties panel", (e as Error).message);
		}

		// ── 8. COVER add / remove ────────────────────────────────────────────
		try {
			// "Add cover" affordance (coverless note).
			await notes
				.locator(".notes__doc-add-cover, [aria-label='Add cover']")
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(700);
			const coverPickerVisible = await notes
				.locator("[aria-label='Pick note cover'], .cover-picker")
				.first()
				.isVisible()
				.catch(() => false);
			judge("cover picker opens", coverPickerVisible, `picker visible=${coverPickerVisible}`);
			await s.shot(notes, "15-cover-picker");

			let coverApplied = false;
			if (coverPickerVisible) {
				// Color/Gallery tab → pick a gradient swatch, then "Use cover".
				await notes
					.locator("button:has-text('Color'), [aria-label*='gallery' i], [aria-label*='Color' i]")
					.first()
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(400);
				await notes
					.locator(
						"[aria-label='Gradient and colour covers'] button, .cover-picker__preview, [class*='gallery'] button",
					)
					.first()
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(300);
				await notes
					.locator("button:has-text('Use cover')")
					.first()
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(800);
				coverApplied = await notes
					.locator(".notes__doc-cover")
					.first()
					.isVisible()
					.catch(() => false);
			}
			judge("cover applied to note", coverApplied, `cover band present=${coverApplied}`);
			await s.shot(notes, "16-cover-applied");

			// Remove cover: open the cover (now present) → Remove cover.
			let coverRemoved = false;
			if (coverApplied) {
				await notes
					.locator(".notes__doc-cover")
					.first()
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(600);
				await notes
					.locator("button:has-text('Remove cover'), [aria-label='Remove cover']")
					.first()
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(800);
				coverRemoved = await notes
					.locator(".notes__doc-add-cover")
					.first()
					.isVisible()
					.catch(() => false);
			}
			judge("cover removed", coverRemoved, `add-cover affordance back=${coverRemoved}`);
			await s.shot(notes, "17-cover-removed");
		} catch (e) {
			fail("cover add/remove", (e as Error).message);
		}

		// ── 9. NOTE ICON change ──────────────────────────────────────────────
		try {
			// Header icon button (aria-label "Change note icon").
			await notes
				.locator('[aria-label="Change note icon"]')
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(700);
			const iconPickerVisible = await notes
				.locator("[aria-label='Pick note icon']")
				.first()
				.isVisible()
				.catch(() => false);
			judge("icon picker opens", iconPickerVisible, `picker visible=${iconPickerVisible}`);
			await s.shot(notes, "18-icon-picker");

			let iconSet = false;
			if (iconPickerVisible) {
				// Pick the first emoji/icon glyph button in the picker grid.
				await notes
					.locator(
						"[aria-label='Pick note icon'] button[role='option'], [aria-label='Pick note icon'] .icon-grid button, [aria-label='Pick note icon'] button",
					)
					.nth(3)
					.click()
					.catch(() => undefined);
				await notes.waitForTimeout(800);
				// After choosing, the doc icon affordance (.notes__doc-icon) appears.
				iconSet =
					(await notes
						.locator(".notes__doc-icon")
						.first()
						.isVisible()
						.catch(() => false)) ||
					(await notes
						.locator(".bs-icon-pick")
						.first()
						.evaluate((el) => (el.textContent ?? "").trim().length > 0)
						.catch(() => false));
			}
			judge("note icon set", iconSet, `doc icon present=${iconSet}`);
			await s.shot(notes, "19-icon-set");
		} catch (e) {
			fail("note icon change", (e as Error).message);
		}

		// ── 10. LOCK (read-only) toggle disables editing ─────────────────────
		try {
			const editorEl = notes.locator(EDITOR).first();
			const editableBefore = await editorEl
				.evaluate((el) => el.getAttribute("contenteditable"))
				.catch(() => null);

			await notes
				.locator('[aria-label="Lock page (read-only)"]')
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(800);

			const pressed = await notes
				.locator('[aria-pressed="true"][aria-label*="nlock"], [aria-label="Unlock page"]')
				.first()
				.isVisible()
				.catch(() => false);
			const editableAfter = await editorEl
				.evaluate((el) => el.getAttribute("contenteditable"))
				.catch(() => null);

			// Try to type — content should NOT change while locked.
			const lenBefore = await editorEl.evaluate((r) => (r.textContent ?? "").length).catch(() => 0);
			await editorEl.click().catch(() => undefined);
			await notes.keyboard.type("SHOULD-NOT-APPEAR", { delay: 12 }).catch(() => undefined);
			await notes.waitForTimeout(400);
			const lenAfter = await editorEl.evaluate((r) => (r.textContent ?? "").length).catch(() => 0);
			const typingBlocked = !(await editorEl
				.evaluate((r) => (r.textContent ?? "").includes("SHOULD-NOT-APPEAR"))
				.catch(() => false));

			judge(
				"lock toggles read-only (contenteditable false / typing blocked)",
				editableAfter === "false" || (typingBlocked && lenAfter === lenBefore),
				`contenteditable ${editableBefore}→${editableAfter}, lockBtn=${pressed}, len ${lenBefore}→${lenAfter}, typingBlocked=${typingBlocked}`,
			);
			await s.shot(notes, "20-locked");

			// Unlock for the rest of the run.
			await notes
				.locator('[aria-label="Unlock page"]')
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(500);
		} catch (e) {
			fail("lock read-only toggle", (e as Error).message);
		}

		// ── 11. SEARCH NOTES ─────────────────────────────────────────────────
		try {
			const searchInput = notes.locator(".notes__search input").first();
			await searchInput.click().catch(() => undefined);
			await searchInput.fill("Link Target").catch(() => undefined);
			await notes.waitForTimeout(900);
			const rows = notes.locator(SIDEBAR_ITEM);
			const count = await rows.count().catch(() => 0);
			const firstText =
				count > 0
					? await rows
							.first()
							.innerText()
							.catch(() => "")
					: "";
			const matched = firstText.includes("Link Target");
			judge(
				"search filters the notes list",
				count >= 1 && matched,
				`results=${count}, first row="${firstText.replace(/\n/g, " ")}"`,
			);
			await s.shot(notes, "21-search");
			// Clear search.
			await notes
				.locator(".notes__search [aria-label='Clear search'], .notes__search button")
				.first()
				.click()
				.catch(() => undefined);
			await searchInput.fill("").catch(() => undefined);
			await notes.waitForTimeout(500);
		} catch (e) {
			fail("search notes", (e as Error).message);
		}

		// ── 12. HEADER ⋯ "Note actions" MENU — open + click each item ────────
		try {
			// The ⋯ overflow is the last element in the header right group
			// (bs-object-menu__more). The title also carries a right-click menu;
			// we drive the explicit ⋯ button.
			await notes
				.locator(".notes__header-right .bs-object-menu__more, header .bs-object-menu__more")
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(700);
			const menuVisible = await notes
				.locator(MENU)
				.first()
				.isVisible()
				.catch(() => false);
			judge("header ⋯ Note actions menu opens", menuVisible, `menu visible=${menuVisible}`);
			await s.shot(notes, "22-object-menu");

			if (menuVisible) {
				// Enumerate menu items and record each label (don't click destructive
				// Delete here — that's exercised in §13 on a throwaway note).
				const items = notes.locator(`${MENU} [role='menuitem'], ${MENU} .fm-row, ${MENU} button`);
				const n = await items.count().catch(() => 0);
				s.note(`Note actions menu has ${n} item(s).`);
				for (let i = 0; i < n; i++) {
					const label = (
						await items
							.nth(i)
							.innerText()
							.catch(() => "")
					)
						.replace(/\n/g, " ")
						.trim();
					if (label) s.note(`  menu item ${i}: "${label}"`);
				}
				// Click a NON-destructive item to verify it acts: prefer "Pin to
				// dashboard" / "Add to collection" / "Open"; skip Delete.
				const safe = notes
					.locator(`${MENU} [role='menuitem'], ${MENU} .fm-row, ${MENU} button`)
					.filter({ hasText: /Pin|Open|collection|Export/i })
					.first();
				if (await safe.isVisible().catch(() => false)) {
					const clickedLabel = (await safe.innerText().catch(() => "")).replace(/\n/g, " ").trim();
					await safe.click().catch(() => undefined);
					await notes.waitForTimeout(800);
					const menuStillOpen = await notes
						.locator(MENU)
						.first()
						.isVisible()
						.catch(() => false);
					judge(
						`header menu item "${clickedLabel}" acts`,
						!menuStillOpen,
						`menu closed after click=${!menuStillOpen}`,
					);
				} else {
					unsure("click a non-destructive menu item", "no safe item matched");
					await notes.keyboard.press("Escape").catch(() => undefined);
				}
			}
			await notes.keyboard.press("Escape").catch(() => undefined);
			await notes.waitForTimeout(300);
			await s.shot(notes, "23-after-menu");
		} catch (e) {
			fail("header object menu", (e as Error).message);
		}

		// ── 13. SIDEBAR: switch / rename / delete ────────────────────────────
		try {
			// SWITCH: open the link-target note from the list, assert the active id
			// changes (active row class moves).
			const before = await currentNoteId(notes);
			await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "Link Target Note" })
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1000);
			const afterSwitch = await currentNoteId(notes);
			judge("sidebar switch note", afterSwitch !== before, `active ${before} → ${afterSwitch}`);
			await s.shot(notes, "24-switched");

			// RENAME: editing the title IS the rename. Focus title, append text,
			// assert the sidebar row label updates.
			await focusEditor(notes);
			await notes.keyboard.press("Meta+ArrowUp").catch(() => undefined); // jump to doc top (title)
			await notes.keyboard.press("End").catch(() => undefined);
			await notes.keyboard.type(" (renamed)", { delay: 16 }).catch(() => undefined);
			await notes.waitForTimeout(1200);
			const renamed = await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "renamed" })
				.first()
				.isVisible()
				.catch(() => false);
			judge(
				"rename note via title (sidebar row updates)",
				renamed,
				`row shows '(renamed)'=${renamed}`,
			);
			await s.shot(notes, "25-renamed");

			// DELETE: make a throwaway note, then delete it via the header ⋯ →
			// "Delete note" and assert it leaves the list.
			const throwawayId = await newNote(notes);
			await notes.keyboard.type("Throwaway 228 delete me", { delay: 14 }).catch(() => undefined);
			await notes.waitForTimeout(900);
			const listBefore = await notes
				.locator(SIDEBAR_ITEM)
				.count()
				.catch(() => 0);

			await notes
				.locator(".notes__header-right .bs-object-menu__more, header .bs-object-menu__more")
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(600);
			await notes
				.locator(`${MENU} [role='menuitem'], ${MENU} .fm-row, ${MENU} button`)
				.filter({ hasText: /Delete/i })
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1000);
			// Some flows confirm — accept any confirm dialog.
			await notes
				.locator("button:has-text('Delete'), [role='dialog'] button:has-text('Delete')")
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1200);

			const stillListed = await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "Throwaway 228 delete me" })
				.first()
				.isVisible()
				.catch(() => false);
			const listAfter = await notes
				.locator(SIDEBAR_ITEM)
				.count()
				.catch(() => 0);
			judge(
				"delete note leaves the list",
				!stillListed,
				`throwaway still listed=${stillListed}, list count ${listBefore}→${listAfter} (id ${throwawayId})`,
			);
			await s.shot(notes, "26-after-delete");
		} catch (e) {
			fail("sidebar switch/rename/delete", (e as Error).message);
		}

		// ── 14. PERSISTENCE: switch away + back, body survives ───────────────
		try {
			// Open the source note, capture its body text, switch to the target,
			// switch back, assert the markdown content is still there.
			await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "Deep Notes 228" })
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1100);
			const bodyBefore = await notes
				.locator(".notes__body")
				.innerText()
				.catch(() => "");
			const hadHeading = bodyBefore.includes("Heading one");

			// Switch away.
			await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "Link Target Note" })
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(900);
			// Switch back.
			await notes
				.locator(SIDEBAR_ITEM)
				.filter({ hasText: "Deep Notes 228" })
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1300);
			const bodyAfter = await notes
				.locator(".notes__body")
				.innerText()
				.catch(() => "");
			const survived = bodyAfter.includes("Heading one") && bodyAfter.includes("Heading two");
			judge(
				"body survives switch-away-and-back",
				survived,
				`hadHeading(before)=${hadHeading}, 'Heading one'(after)=${bodyAfter.includes("Heading one")}, 'Heading two'(after)=${bodyAfter.includes("Heading two")}`,
			);
			await s.shot(notes, "27-persistence");
		} catch (e) {
			fail("persistence", (e as Error).message);
		}

		s.note("— deep notes walkthrough (228) complete —");
	} finally {
		await s.finish();
	}
});
