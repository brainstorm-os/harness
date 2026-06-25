/**
 * Mapper from repo design docs → Notes-app `Note/v1` rows (SH-10 per
 * docs/foundations/49-self-hosting.md).
 *
 * Pure-ish: the production wrapper walks `docs/` from disk; the core
 * helpers operate on already-loaded `{ path, body }` records so callers
 * can supply fixtures in tests.
 *
 * Opening Notes against a seeded vault surfaces every design doc as a
 * searchable note: the H1 becomes the title and the *full* markdown body
 * is converted to Lexical blocks (headings, paragraphs, lists, quotes,
 * code, rules, and GFM tables — real `@lexical/table` TableNode trees so
 * they are editable, not frozen monospaced text). Zero renderer changes —
 * every shape mirrors the corresponding `@lexical/*` `exportJSON()` output
 * for v0.21, which is what `parseEditorState` re-hydrates.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { findRepoRoot } from "../repo.ts";
import { parseDocPath } from "./brainstorm-project.ts";
import type { SeedBlock, SeedInline, SeedListItem, SeedTableCell, SeedTableRow } from "./types.ts";
import { NOTE_TYPE as _NOTE_TYPE } from "./types.ts";
import type { SeedNote } from "./types.ts";
import {
	EMPTY_WIKILINK_RESOLVER,
	type WikilinkResolver,
	parseInlineWithMentions,
	stripWikilinkBrackets,
} from "./wikilinks.ts";

/** Markdown line classes the block parser recognises. A raw-string `kind`
 *  is a discriminator → enum per code conventions. */
enum MdLine {
	Heading = "heading",
	Rule = "rule",
	Quote = "quote",
	ListItem = "list-item",
	Table = "table",
	Blank = "blank",
	Text = "text",
}

const STABLE_TS = Date.UTC(2026, 4, 14);
const DAY = 86_400_000;

const DOC_EMOJI: Record<string, string> = {
	foundations: "🧱",
	apps: "🧩",
	shell: "🪟",
	data: "🗄️",
	editing: "✍️",
	security: "🔐",
	platform: "🛠️",
	reference: "📚",
	art: "🎨",
};

export interface RawDoc {
	path: string;
	body: string;
}

export function buildDocsAsNotes(
	docs: RawDoc[],
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
	now: number = STABLE_TS,
): SeedNote[] {
	return docs.map((d, i) => docToNote(d, now - DAY * i, resolver));
}

export function docToNote(
	d: RawDoc,
	ts: number,
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
): SeedNote {
	const title = stripWikilinkBrackets(extractTitle(d.body) || basename(d.path));
	const category = categoryFromPath(d.path);
	const id = `doc-${slugifyPath(d.path)}`;
	const emoji = DOC_EMOJI[category] ?? "📄";
	const blocks = markdownToBlocks(d.body, resolver);
	const titleNode: SeedBlock = {
		type: "title",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		textFormat: 0,
		textStyle: "",
		children: title ? [textInline(title)] : [],
	};
	const stub: SeedBlock = paragraph([textInline(`(stub: ${d.path})`)]);
	// SH-37 cross-link: the doc-note narrates a DesignDoc entity. The
	// DesignDoc entity id is built by `mapDesignDoc` in brainstorm-project
	// as `doc-${slug || \`n${docNumber}\`}` from `parseDocPath` (different
	// slug function from the note's own id-slug above — that one slugifies
	// the full path; the DesignDoc strips the leading docNumber). Mirror
	// the exact same fallback chain so the derived `Note/about` edge
	// resolves to the same DesignDoc entity.
	const parsedForRef = parseDocPath(d.path);
	const aboutEntityId = `doc-${parsedForRef.slug ? parsedForRef.slug : `n${parsedForRef.docNumber}`}`;
	const note: SeedNote = {
		id,
		title,
		icon: { kind: "emoji", value: emoji },
		body: {
			root: {
				type: "root",
				version: 1,
				format: "",
				indent: 0,
				direction: null,
				children: [titleNode, ...(blocks.length > 0 ? blocks : [stub])],
			},
		},
		values: {
			"doc-path": d.path,
			"doc-category": category,
		},
		createdAt: ts,
		updatedAt: ts,
	};
	note.aboutEntityId = aboutEntityId;
	return note;
}

export function textInline(text: string): SeedInline {
	return { type: "text", version: 1, format: 0, mode: "normal", style: "", text, detail: 0 };
}

function lineBreakInline(): SeedInline {
	return { type: "linebreak", version: 1 };
}

export function paragraph(children: SeedInline[]): SeedBlock {
	return { type: "paragraph", version: 1, format: "", indent: 0, direction: null, children };
}

export function headingBlock(
	level: number,
	text: string,
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
): SeedBlock {
	const n = Math.min(Math.max(level, 1), 6);
	return {
		type: "heading",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		tag: `h${n}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
		children: inlineRun(text, resolver),
	};
}

function quoteBlock(children: SeedInline[]): SeedBlock {
	return { type: "quote", version: 1, format: "", indent: 0, direction: null, children };
}

function codeBlock(language: string, lines: string[]): SeedBlock {
	const children: SeedInline[] = [];
	lines.forEach((line, i) => {
		if (i > 0) children.push(lineBreakInline());
		if (line.length > 0) children.push(textInline(line));
	});
	return { type: "code", version: 1, format: "", indent: 0, direction: null, language, children };
}

export function ruleBlock(): SeedBlock {
	return { type: "horizontalrule", version: 1 };
}

export function listBlock(
	ordered: boolean,
	items: string[],
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
): SeedBlock {
	const children: SeedListItem[] = items.map((text, i) => ({
		type: "listitem",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		value: i + 1,
		children: inlineRun(text, resolver),
	}));
	return ordered
		? {
				type: "list",
				version: 1,
				format: "",
				indent: 0,
				direction: null,
				listType: "number",
				start: 1,
				tag: "ol",
				children,
			}
		: {
				type: "list",
				version: 1,
				format: "",
				indent: 0,
				direction: null,
				listType: "bullet",
				start: 1,
				tag: "ul",
				children,
			};
}

/** `@lexical/table` `TableCellHeaderStates` bitmask (v0.21). A numeric
 *  discriminator drawn from a fixed set → const-object per code
 *  conventions. Seeded GFM tables only ever need the first row as a
 *  header (Row) or a plain body cell (None). */
const TableCellHeaderState = { None: 0, Row: 1 } as const;

/** Split one GFM table line into trimmed cell texts. Tolerates the
 *  optional leading/trailing pipe and `\|` escaped pipes inside a cell. */
function splitTableRow(line: string): string[] {
	let s = line.trim();
	if (s.startsWith("|")) s = s.slice(1);
	if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
	return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

function tableCell(text: string, header: boolean, resolver: WikilinkResolver): SeedTableCell {
	return {
		type: "tablecell",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		headerState: header ? TableCellHeaderState.Row : TableCellHeaderState.None,
		colSpan: 1,
		rowSpan: 1,
		backgroundColor: null,
		children: [paragraph(inlineRun(text, resolver))],
	};
}

function tableRow(cells: string[], header: boolean, resolver: WikilinkResolver): SeedTableRow {
	return {
		type: "tablerow",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		children: cells.map((c) => tableCell(c, header, resolver)),
	};
}

/** Build a Lexical `TableNode` tree from parsed GFM rows. The first row
 *  is the header (a GFM table always has one); ragged rows are padded to
 *  a rectangular grid (Lexical requires every row to have the same cell
 *  count). */
function tableBlock(rows: string[][], resolver: WikilinkResolver): SeedBlock {
	const cols = Math.max(...rows.map((r) => r.length));
	const pad = (r: string[]): string[] => {
		const out = r.slice(0, cols);
		while (out.length < cols) out.push("");
		return out;
	};
	const [head = [], ...body] = rows;
	const children: SeedTableRow[] = [tableRow(pad(head), true, resolver)];
	for (const r of body) children.push(tableRow(pad(r), false, resolver));
	return { type: "table", version: 1, format: "", indent: 0, direction: null, children };
}

/** One inline-markdown run, emphasis / code / links stripped. `[[X]]`
 *  wikilinks are routed through the resolver: known slugs become
 *  `MentionNode` chips, the rest collapse to plain label text. Empty
 *  after stripping → no inline node. */
function inlineRun(text: string, resolver: WikilinkResolver): SeedInline[] {
	const stripped = stripMarkdown(text).trim();
	if (stripped.length === 0) return [];
	return parseInlineWithMentions(stripped, resolver);
}

function multilineInlines(lines: string[], resolver: WikilinkResolver): SeedInline[] {
	const out: SeedInline[] = [];
	lines.forEach((line, i) => {
		if (i > 0) out.push(lineBreakInline());
		out.push(...inlineRun(line, resolver));
	});
	return out;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const RULE_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const LIST_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+(.+)$/;
const TABLE_DELIM_RE = /^\|?[\s:|-]+\|?$/;

function isParagraphBreak(raw: string): boolean {
	const t = raw.trim();
	if (t.length === 0) return true;
	if (t.startsWith("```")) return true;
	if (t.startsWith("|")) return true;
	if (t.startsWith(">")) return true;
	if (HEADING_RE.test(t)) return true;
	if (RULE_RE.test(t)) return true;
	if (LIST_RE.test(raw)) return true;
	return false;
}

/**
 * Convert a markdown design doc into Lexical blocks. Best-effort, not a
 * full CommonMark parser: it covers exactly the constructs the `docs/`
 * tree uses — ATX headings, paragraphs, bullet/ordered lists,
 * blockquotes, fenced code, thematic breaks, and GFM tables (emitted as
 * a real `@lexical/table` TableNode tree — first row as the header — so
 * the seeded table is editable, not frozen monospaced text). The leading
 * frontmatter block and
 * the first H1 are dropped — the H1 is the note title (its own
 * TitleNode), so re-emitting it would duplicate the heading.
 */
export function markdownToBlocks(
	md: string,
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
): SeedBlock[] {
	const lines = md.replace(/\r\n?/g, "\n").split("\n");
	const blocks: SeedBlock[] = [];
	let i = 0;

	if (lines[0]?.trim() === "---") {
		i = 1;
		while (i < lines.length && lines[i]?.trim() !== "---") i++;
		i++; // step past the closing fence
	}

	let titleSkipped = false;

	while (i < lines.length) {
		const raw = lines[i] ?? "";
		const t = raw.trim();

		if (t.length === 0) {
			i++;
			continue;
		}

		if (t.startsWith("```")) {
			const language = t.slice(3).trim();
			const body: string[] = [];
			i++;
			while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
				body.push(lines[i] ?? "");
				i++;
			}
			i++; // step past the closing fence
			blocks.push(codeBlock(language, body));
			continue;
		}

		const heading = HEADING_RE.exec(t);
		if (heading) {
			const level = heading[1]?.length ?? 1;
			const text = heading[2] ?? "";
			if (level === 1 && !titleSkipped) {
				titleSkipped = true;
			} else {
				blocks.push(headingBlock(level, text, resolver));
			}
			i++;
			continue;
		}

		if (RULE_RE.test(t)) {
			blocks.push(ruleBlock());
			i++;
			continue;
		}

		if (
			t.startsWith("|") &&
			TABLE_DELIM_RE.test((lines[i + 1] ?? "").trim()) &&
			(lines[i + 1] ?? "").includes("-")
		) {
			const headerCells = splitTableRow(t);
			i += 2; // consume the header row + the |---| delimiter row
			const bodyRows: string[][] = [];
			while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
				bodyRows.push(splitTableRow(lines[i] ?? ""));
				i++;
			}
			if (headerCells.length > 0) {
				blocks.push(tableBlock([headerCells, ...bodyRows], resolver));
			}
			continue;
		}

		if (t.startsWith(">")) {
			const quoteLines: string[] = [];
			while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
				quoteLines.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
				i++;
			}
			blocks.push(quoteBlock(multilineInlines(quoteLines, resolver)));
			continue;
		}

		const firstItem = LIST_RE.exec(raw);
		if (firstItem) {
			const ordered = /^\s*\d/.test(raw);
			const items: string[] = [];
			while (i < lines.length) {
				const m = LIST_RE.exec(lines[i] ?? "");
				if (!m) break;
				items.push(m[2] ?? "");
				i++;
			}
			blocks.push(listBlock(ordered, items, resolver));
			continue;
		}

		const paraLines: string[] = [];
		while (i < lines.length && !isParagraphBreak(lines[i] ?? "")) {
			paraLines.push((lines[i] ?? "").trim());
			i++;
		}
		const inlines = inlineRun(paraLines.join(" "), resolver);
		if (inlines.length > 0) blocks.push(paragraph(inlines));
	}

	return blocks;
}

export function extractTitle(body: string): string {
	for (const line of body.split("\n")) {
		const m = /^#\s+(.+?)\s*$/.exec(line.trim());
		if (m) return m[1] ?? "";
	}
	return "";
}

export function extractExcerpt(body: string): string {
	let inFrontmatter = false;
	let inCodeFence = false;
	const lines = body.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (i === 0 && line.trim() === "---") {
			inFrontmatter = true;
			continue;
		}
		if (inFrontmatter) {
			if (line.trim() === "---") inFrontmatter = false;
			continue;
		}
		if (line.trim().startsWith("```")) {
			inCodeFence = !inCodeFence;
			continue;
		}
		if (inCodeFence) continue;
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		if (trimmed.startsWith("#")) continue;
		if (trimmed.startsWith(">")) continue;
		return stripMarkdown(trimmed).slice(0, 480);
	}
	return "";
}

function stripMarkdown(s: string): string {
	return s
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function categoryFromPath(p: string): string {
	const parts = p.split("/");
	if (parts.length < 3) return "foundations";
	return parts[1] ?? "foundations";
}

function basename(p: string): string {
	const last = p.split("/").pop() ?? "";
	return last.replace(/\.md$/i, "");
}

function slugifyPath(p: string): string {
	return p
		.replace(/\.md$/i, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
}

/**
 * Production wrapper: walks `docs/` recursively (excluding `_review/`
 * audit logs and `art/`) and returns one `RawDoc` per `.md` file.
 */
export function loadRepoDesignDocs(): RawDoc[] {
	const repoRoot = findRepoRoot();
	const docsRoot = join(repoRoot, "docs");
	const docs: RawDoc[] = [];
	walk(docsRoot, repoRoot, docs);
	return docs;
}

function walk(dir: string, repoRoot: string, out: RawDoc[]): void {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return;
	}
	for (const name of entries) {
		if (name.startsWith("_") || name === "art" || name === "node_modules") continue;
		const full = join(dir, name);
		let stats: ReturnType<typeof statSync>;
		try {
			stats = statSync(full);
		} catch {
			continue;
		}
		if (stats.isDirectory()) {
			walk(full, repoRoot, out);
			continue;
		}
		if (extname(full).toLowerCase() !== ".md") continue;
		try {
			const body = readFileSync(full, "utf8");
			out.push({ path: relative(repoRoot, full).replace(/\\/g, "/"), body });
		} catch {
			// skip unreadable files
		}
	}
}
