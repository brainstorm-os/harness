/**
 * Hand-crafted article-quality Notes for the dogfood vault.
 *
 * Unlike the auto-derived `plan-to-*` mappers (which project plan
 * iterations + design docs into structural Notes), these are *written*
 * articles — real human prose with headings, paragraphs, bullet and
 * numbered lists, quotes, code blocks, tables, horizontal rules, and
 * @-mentions to other seeded entities. Together they exercise every
 * Lexical node type the Notes app renders, so a fresh dev vault is a
 * working showcase of what the editor can do, not a fixture wall of
 * bullet summaries.
 *
 * Stable ids in their own `article-*` namespace so re-seed overwrites
 * in place and they never collide with `doc-*` / `iteration-*` /
 * `journal-*` notes.
 *
 * Pure + deterministic — the only "time" input is the fixed
 * `STABLE_TS` (matches the iterations-to-notes anchor), so re-running
 * the seeder is byte-stable.
 */

import { headingBlock, listBlock, paragraph, ruleBlock, textInline } from "./docs-to-notes.ts";
import type {
	SeedBlock,
	SeedEditorState,
	SeedInline,
	SeedNote,
	SeedTableCell,
	SeedTableRow,
} from "./types.ts";

const STABLE_TS = Date.UTC(2026, 4, 14);

function titleNode(text: string): SeedBlock {
	return {
		type: "title",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		textFormat: 0,
		textStyle: "",
		children: [textInline(text)],
	};
}

function quoteBlock(text: string): SeedBlock {
	return {
		type: "quote",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		children: [textInline(text)],
	};
}

function codeBlock(language: string, lines: string[]): SeedBlock {
	const children: SeedInline[] = [];
	lines.forEach((line, idx) => {
		if (idx > 0) children.push({ type: "linebreak", version: 1 });
		if (line.length > 0) children.push(textInline(line));
	});
	return {
		type: "code",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		language,
		children,
	};
}

function mention(entityId: string, entityType: string, label: string): SeedInline {
	return { type: "mention", version: 1, entityId, entityType, label };
}

function mixedParagraph(parts: SeedInline[]): SeedBlock {
	return {
		type: "paragraph",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		children: parts,
	};
}

function tableCell(text: string, header: boolean): SeedTableCell {
	return {
		type: "tablecell",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		headerState: header ? 1 : 0,
		colSpan: 1,
		rowSpan: 1,
		backgroundColor: null,
		children: [paragraph([textInline(text)])],
	};
}

function tableRow(cells: string[], header: boolean): SeedTableRow {
	return {
		type: "tablerow",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		children: cells.map((c) => tableCell(c, header)),
	};
}

function tableBlock(rows: string[][]): SeedBlock {
	if (rows.length === 0) {
		return {
			type: "table",
			version: 1,
			format: "",
			indent: 0,
			direction: null,
			children: [],
		};
	}
	const [headerRow, ...bodyRows] = rows as [string[], ...string[][]];
	return {
		type: "table",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		children: [tableRow(headerRow, true), ...bodyRows.map((r) => tableRow(r, false))],
	};
}

const ITERATION_TYPE = "io.brainstorm.notes/Note/v1";

function articleEditorState(title: string, blocks: SeedBlock[]): SeedEditorState {
	return {
		root: {
			type: "root",
			version: 1,
			format: "",
			indent: 0,
			direction: null,
			children: [titleNode(title), ...blocks],
		},
	};
}

/** ── Article 1: Welcome to Brainstorm ──────────────────────────────────
 *  Onboarding for a fresh vault. Exercises: H1/H2/H3, paragraph, bullet
 *  list, numbered list, quote, horizontal rule, mention. */
function welcomeArticle(): SeedNote {
	const title = "Welcome to your Brainstorm vault";
	const blocks: SeedBlock[] = [
		headingBlock(1, title),
		paragraph([
			textInline(
				"This vault is yours. It's a desktop knowledge-management product modeled as an operating system — every app is a sandboxed view onto a shared object space backed by Block Protocol, Yjs, and Lexical.",
			),
		]),
		quoteBlock(
			"The first thing you should know: there is no cloud here unless you put one there. Your data lives in a folder on your disk, encrypted at rest, version-controlled by Yjs, and yours to move.",
		),
		headingBlock(2, "What's in this vault"),
		paragraph([
			textInline(
				"A fresh vault ships with a small but real engineering log — every iteration that landed in the implementation plan is mirrored across the apps so you can poke around. The same object shows up everywhere:",
			),
		]),
		listBlock(false, [
			"Tasks app — the iteration's status pill, priority, schedule",
			"Notes app — the iteration's full narrative body, editable",
			"Journal app — one entry per ship day, grouping what shipped",
			"Database app — every type rendered as grid / list / board / kanban / calendar",
			"Graph app — the entities and the links between them, laid out as a network",
		]),
		headingBlock(2, "Where to start"),
		paragraph([
			textInline(
				"If you've never used Brainstorm before, work through these in order — each one teaches a different subsystem:",
			),
		]),
		listBlock(true, [
			"Open the Journal — today's date shows what shipped recently.",
			"Open Notes and find an iteration like `9.13.2` — its body is a real document, not a card.",
			"Open the Database app and switch the All-Tasks list between grid / board / kanban — the same rows, three layouts.",
			"Open the Graph — find an iteration node and follow its edges to the OQs it resolved.",
		]),
		ruleBlock(),
		headingBlock(3, "Two design choices worth knowing"),
		paragraph([
			textInline(
				"Apps live in sandboxed renderers and talk to the shell over a capability-checked IPC broker. Anything an app does to your data — read, write, list — passes through a per-vault capability ledger. No app can silently exceed what its manifest declares.",
			),
		]),
		paragraph([
			textInline(
				"Edits sync through Yjs CRDTs, so two windows on the same document don't fight; they merge. The persistence format is a snapshot file plus a tail of updates with per-update CRC32, compacted at 256 KiB.",
			),
		]),
		ruleBlock(),
		mixedParagraph([
			textInline("Look at "),
			mention("iteration-9-13-2", ITERATION_TYPE, "9.13.2 — Graph/v1 Y.Doc codec"),
			textInline(" for the most recent example of these two ideas meeting in one feature."),
		]),
	];
	return {
		id: "article-welcome",
		title,
		icon: { kind: "emoji", value: "👋" },
		body: articleEditorState(title, blocks),
		values: { "article-topic": "onboarding" },
		createdAt: STABLE_TS,
		updatedAt: STABLE_TS,
	};
}

/** ── Article 2: Why we picked CRDTs ────────────────────────────────────
 *  Design rationale. Exercises: H1/H2/H3, paragraphs, numbered list,
 *  table, code block, quote, mention. */
function whyCrdtsArticle(): SeedNote {
	const title = "Why we picked CRDTs";
	const blocks: SeedBlock[] = [
		headingBlock(1, title),
		paragraph([
			textInline(
				"Every collaborative editor eventually faces the same fork: lock the document and queue writes, or let writers diverge and merge them after the fact. Brainstorm took the second path. Here's why.",
			),
		]),
		headingBlock(2, "The constraint"),
		paragraph([
			textInline(
				"Two windows on the same Note must converge to the same state without a central referee — because the shell is the only authority and the apps live in sandboxes. A locking model would push every keystroke through an IPC round-trip, and that round-trip would be load-bearing.",
			),
		]),
		quoteBlock(
			"If a 16ms input loop is mediated by a 4ms IPC call, the user feels it on every word.",
		),
		headingBlock(2, "What we considered"),
		paragraph([textInline("We evaluated three families before settling on Yjs:")]),
		listBlock(true, [
			"Operational Transform (Google Wave / Etherpad lineage) — proven, but requires a central server for transformation correctness.",
			"State-based CRDTs (Automerge) — local-first, no server required, but historical perf cost on long-edit-history documents.",
			"Op-based CRDTs (Yjs) — local-first, no server required, and the binary update format is small and cheap to merge.",
		]),
		headingBlock(2, "How they compare"),
		tableBlock([
			["Property", "OT", "Automerge", "Yjs"],
			["Needs central server", "Yes", "No", "No"],
			["Offline convergence", "Hard", "Yes", "Yes"],
			["Long-history overhead", "Low", "High (historic)", "Low"],
			["Binary update size", "Text-ish", "Larger", "Compact"],
			["Lexical bridge", "—", "—", "First-party"],
		]),
		headingBlock(3, "A minimal Y.Doc"),
		paragraph([
			textInline(
				"Two clients can construct a doc, edit independently, and merge their updates without coordination:",
			),
		]),
		codeBlock("typescript", [
			"import * as Y from 'yjs';",
			"",
			"const a = new Y.Doc();",
			"const b = new Y.Doc();",
			"",
			"a.getText('body').insert(0, 'hello ');",
			"b.getText('body').insert(0, 'world ');",
			"",
			"Y.applyUpdate(a, Y.encodeStateAsUpdate(b));",
			"Y.applyUpdate(b, Y.encodeStateAsUpdate(a));",
			"",
			"a.getText('body').toString() === b.getText('body').toString();",
		]),
		ruleBlock(),
		headingBlock(2, "The cost"),
		paragraph([
			textInline(
				"CRDTs don't free you from schema discipline. Every shared structure has to be modeled as a Yjs type or you lose the merge guarantees. We pay this cost by keeping the canonical projection — the `entities.db` row — separate from the Yjs body, and reconciling them through a per-app codec.",
			),
		]),
		mixedParagraph([
			textInline("See "),
			mention("iteration-9-13-2", ITERATION_TYPE, "9.13.2 — Graph/v1 Y.Doc codec"),
			textInline(
				" for the Graph app's version of that codec, and the entities-service repository it writes through.",
			),
		]),
	];
	return {
		id: "article-why-crdts",
		title,
		icon: { kind: "emoji", value: "🧩" },
		body: articleEditorState(title, blocks),
		values: { "article-topic": "design-rationale" },
		createdAt: STABLE_TS,
		updatedAt: STABLE_TS,
	};
}

/** ── Article 3: Working with the Journal ───────────────────────────────
 *  Instructional. Exercises: H1/H2, paragraphs, numbered list, bullet
 *  list, code block, mention, horizontal rule, quote. */
function journalGuideArticle(): SeedNote {
	const title = "Working with the Journal";
	const blocks: SeedBlock[] = [
		headingBlock(1, title),
		paragraph([
			textInline(
				"The Journal app is the smallest possible app in Brainstorm — and that's deliberate. It registers no entity type of its own. A journal entry is just a Note whose title is exactly an ISO date.",
			),
		]),
		quoteBlock(
			"This is the pattern we want every app to follow: borrow a primitive, don't grow your own.",
		),
		headingBlock(2, "Creating a new entry"),
		listBlock(true, [
			"Open the Journal app from the dashboard.",
			"Pick a day in the date navigator. If there's no entry yet, you'll see a fresh editor.",
			"Type. The auto-save plugin arms on real user interaction — your first edit is never swallowed.",
			"When you switch days, the entry is persisted to a Note whose title is the canonical YYYY-MM-DD key.",
		]),
		headingBlock(2, "The date-key protocol"),
		paragraph([
			textInline(
				"Journal entries are findable from any app because the title format is a strict regex. A note titled `2026-05-14 — gratitudes` is NOT a journal entry — it's a user-titled note that happens to start with a date.",
			),
		]),
		codeBlock("typescript", [
			"export function parseJournalDateKey(key: string): number | null {",
			"  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(key);",
			"  if (!m) return null;",
			"  // …reject Feb 30 / April 31 etc. via round-trip…",
			"}",
		]),
		headingBlock(2, "What you can do from here"),
		listBlock(false, [
			"Use @-mention to link an entry to a Task, Project, or Person. The Graph app paints the edge automatically.",
			"Drop a quote, code block, or table — every Lexical block the Notes app supports, the Journal supports too.",
			"Look at the date range cards: Today, Previous 7 days, then by month. They reflect the entry's real updatedAt, not the time of the seed run.",
		]),
		ruleBlock(),
		mixedParagraph([
			textInline(
				"If you want to see the back-end story, the iteration that wired Notes-as-Journal is ",
			),
			mention("iteration-9-16-2", ITERATION_TYPE, "9.16.2 — Journal real-Notes wiring"),
			textInline(". The preview-drop pattern is documented there."),
		]),
	];
	return {
		id: "article-journal-guide",
		title,
		icon: { kind: "emoji", value: "📓" },
		body: articleEditorState(title, blocks),
		values: { "article-topic": "guide" },
		createdAt: STABLE_TS,
		updatedAt: STABLE_TS,
	};
}

/** Public surface: a deterministic array of seeded articles. Add new
 *  hand-crafted entries here; each iteration that ships a new feature is
 *  a candidate for an article that demonstrates it. */
export function buildFeatureArticles(): SeedNote[] {
	return [welcomeArticle(), whyCrdtsArticle(), journalGuideArticle()];
}
