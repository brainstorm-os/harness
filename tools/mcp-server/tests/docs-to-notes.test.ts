import { describe, expect, it } from "vitest";
import {
	buildDocsAsNotes,
	docToNote,
	extractExcerpt,
	extractTitle,
	markdownToBlocks,
} from "../src/seed/docs-to-notes.ts";

const NOW = Date.UTC(2026, 4, 14);

const DOC_SELF_HOSTING = `# 49 — Self-hosting

Brainstorm is the IDE for building Brainstorm. The dev MCP server is the data plane.

## Why self-host

1. Forcing function for quality.
`;

const DOC_WITH_FRONTMATTER = `---
title: With frontmatter
date: 2026-05-14
---

# Frontmatter doc

This first paragraph appears after the closing fence.
`;

const DOC_CODE_FENCE_FIRST = `# Snippet doc

\`\`\`ts
const x = 1;
\`\`\`

This paragraph comes after the fenced block.
`;

const DOC_BLOCKQUOTE_FIRST = `# Quoted doc

> A blockquote should NOT be the excerpt.

Real paragraph follows the quote.
`;

const DOC_EMPTY_BODY = `# Empty body

`;

describe("extractTitle", () => {
	it("returns the first H1", () => {
		expect(extractTitle(DOC_SELF_HOSTING)).toBe("49 — Self-hosting");
	});

	it("returns empty string when no H1 is present", () => {
		expect(extractTitle("paragraph only")).toBe("");
	});

	it("ignores deeper headings", () => {
		expect(extractTitle("## Sub\n# Real")).toBe("Real");
	});
});

describe("extractExcerpt", () => {
	it("returns the first prose paragraph", () => {
		expect(extractExcerpt(DOC_SELF_HOSTING)).toContain(
			"Brainstorm is the IDE for building Brainstorm.",
		);
	});

	it("skips a leading YAML frontmatter block", () => {
		expect(extractExcerpt(DOC_WITH_FRONTMATTER)).toBe(
			"This first paragraph appears after the closing fence.",
		);
	});

	it("skips fenced code blocks", () => {
		expect(extractExcerpt(DOC_CODE_FENCE_FIRST)).toBe("This paragraph comes after the fenced block.");
	});

	it("skips blockquote lines", () => {
		expect(extractExcerpt(DOC_BLOCKQUOTE_FIRST)).toBe("Real paragraph follows the quote.");
	});

	it("returns empty string when nothing prose-like is present", () => {
		expect(extractExcerpt(DOC_EMPTY_BODY)).toBe("");
	});

	it("strips inline markdown emphasis + links + code", () => {
		const raw = "# Title\n\n**Bold** with `code` and a [link](url).";
		expect(extractExcerpt(raw)).toBe("Bold with code and a link.");
	});
});

describe("docToNote", () => {
	const note = docToNote(
		{ path: "docs/foundations/49-self-hosting.md", body: DOC_SELF_HOSTING },
		NOW,
	);

	it("derives the note id from the doc path", () => {
		expect(note.id).toBe("doc-docs-foundations-49-self-hosting");
	});

	it("uses the H1 as the title", () => {
		expect(note.title).toBe("49 — Self-hosting");
	});

	it("uses the category-specific emoji as the icon", () => {
		expect(note.icon).toEqual({ kind: "emoji", value: "🧱" });
	});

	it("emits a Lexical root that starts with the TitleNode followed by the full body", () => {
		expect(note.body.root.children.length).toBeGreaterThan(2);
		expect(note.body.root.children[0]?.type).toBe("title");
		expect(note.body.root.children[1]?.type).toBe("paragraph");
		expect(note.body.root.children.some((c) => c.type === "heading")).toBe(true);
		expect(note.body.root.children.some((c) => c.type === "list")).toBe(true);
	});

	it("the TitleNode carries the same text as note.title", () => {
		const titleNode = note.body.root.children[0];
		const first = titleNode && "children" in titleNode ? titleNode.children[0] : undefined;
		expect(first && "text" in first ? first.text : undefined).toBe(note.title);
	});

	it("body does NOT duplicate the title as an in-body heading (TitleNode covers that)", () => {
		const headingTexts = note.body.root.children
			.filter((c) => c.type === "heading")
			.map((h) =>
				"children" in h && h.children[0] && "text" in h.children[0] ? h.children[0].text : "",
			);
		expect(headingTexts).not.toContain(note.title);
	});

	it("every node carries a non-empty string type (parseable by Lexical)", () => {
		const typed = (n: unknown): boolean => {
			if (!n || typeof n !== "object") return false;
			const rec = n as { type?: unknown; children?: unknown };
			if (typeof rec.type !== "string" || rec.type.length === 0) return false;
			return Array.isArray(rec.children) ? rec.children.every(typed) : true;
		};
		expect(note.body.root.children.every(typed)).toBe(true);
	});

	it("carries the doc path + category in the values map for filterability", () => {
		expect(note.values["doc-path"]).toBe("docs/foundations/49-self-hosting.md");
		expect(note.values["doc-category"]).toBe("foundations");
	});

	it("falls back to a stub paragraph (after TitleNode) when the body has no prose", () => {
		const stub = docToNote({ path: "docs/empty.md", body: "# Just a heading" }, NOW);
		expect(stub.body.root.children[0]?.type).toBe("title");
		expect(stub.body.root.children[1]?.type).toBe("paragraph");
	});

	it("picks the right emoji per category", () => {
		const apps = docToNote({ path: "docs/apps/14-app-store.md", body: "# AS" }, NOW);
		expect(apps.icon).toEqual({ kind: "emoji", value: "🧩" });
		const security = docToNote({ path: "docs/security/09.md", body: "# S" }, NOW);
		expect(security.icon).toEqual({ kind: "emoji", value: "🔐" });
	});

	it("falls back to 📄 for unknown categories", () => {
		const odd = docToNote({ path: "docs/wild/0-thing.md", body: "# Wild" }, NOW);
		expect(odd.icon).toEqual({ kind: "emoji", value: "📄" });
	});
});

describe("markdownToBlocks", () => {
	it("drops frontmatter and the first H1, keeps the rest", () => {
		const blocks = markdownToBlocks(DOC_WITH_FRONTMATTER);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.type).toBe("paragraph");
	});

	it("emits in-body headings (level → tag) but never the title H1", () => {
		const blocks = markdownToBlocks("# Title\n\n## Sub one\n\n### Sub two\n");
		expect(blocks.map((b) => b.type)).toEqual(["heading", "heading"]);
		expect(blocks[0] && "tag" in blocks[0] ? blocks[0].tag : undefined).toBe("h2");
		expect(blocks[1] && "tag" in blocks[1] ? blocks[1].tag : undefined).toBe("h3");
	});

	it("converts bullet and ordered lists into ListNodes", () => {
		const bullets = markdownToBlocks("# T\n\n- one\n- two\n");
		expect(bullets[0]?.type).toBe("list");
		expect(bullets[0] && "listType" in bullets[0] ? bullets[0].listType : undefined).toBe("bullet");
		expect(bullets[0] && "children" in bullets[0] ? bullets[0].children.length : 0).toBe(2);

		const ordered = markdownToBlocks("# T\n\n1. first\n2. second\n");
		expect(ordered[0] && "listType" in ordered[0] ? ordered[0].listType : undefined).toBe("number");
	});

	it("keeps fenced code as a CodeNode with its language", () => {
		const blocks = markdownToBlocks("# T\n\n```ts\nconst x = 1;\n```\n");
		expect(blocks[0]?.type).toBe("code");
		expect(blocks[0] && "language" in blocks[0] ? blocks[0].language : undefined).toBe("ts");
	});

	it("treats a thematic break as a horizontalrule", () => {
		const blocks = markdownToBlocks("# T\n\nbefore\n\n---\n\nafter\n");
		expect(blocks.map((b) => b.type)).toEqual(["paragraph", "horizontalrule", "paragraph"]);
	});

	it("renders a blockquote as a QuoteNode", () => {
		const blocks = markdownToBlocks("# T\n\n> quoted line\n");
		expect(blocks[0]?.type).toBe("quote");
	});

	it("renders a GFM table as an editable TableNode tree (first row = header)", () => {
		const md = "# T\n\n| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\n";
		const blocks = markdownToBlocks(md);
		const table = blocks[0];
		expect(table?.type).toBe("table");
		if (!table || table.type !== "table") throw new Error("expected a table block");

		// 3 rows (1 header + 2 body), 2 cells each.
		expect(table.children).toHaveLength(3);
		expect(table.children.every((r) => r.type === "tablerow")).toBe(true);
		expect(table.children.map((r) => r.children.length)).toEqual([2, 2, 2]);

		// Header row carries TableCellHeaderStates.ROW (1); body rows NO_STATUS (0).
		const headerStates = table.children.map((r) => r.children.map((c) => c.headerState));
		expect(headerStates).toEqual([
			[1, 1],
			[0, 0],
			[0, 0],
		]);

		// Cell text lives in a paragraph child (block-level, like
		// $createTableNodeWithDimensions), and reads back as the GFM cell.
		const cellText = (cell: (typeof table.children)[number]["children"][number]): string => {
			const para = cell.children[0];
			if (!para || !("children" in para)) return "";
			return para.children
				.filter((n): n is Extract<typeof n, { text: string }> => "text" in n)
				.map((n) => n.text)
				.join("");
		};
		const grid = table.children.map((r) => r.children.map(cellText));
		expect(grid).toEqual([
			["A", "B"],
			["1", "2"],
			["3", "4"],
		]);
	});

	it("pads ragged rows and tolerates escaped pipes / missing trailing pipe", () => {
		const md = "# T\n\n| A | B | C |\n| - | - | - |\n| 1 | 2\n| x \\| y | | z |\n";
		const blocks = markdownToBlocks(md);
		const table = blocks[0];
		expect(table?.type).toBe("table");
		if (!table || table.type !== "table") throw new Error("expected a table block");
		// Every row padded to the 3-column width.
		expect(table.children.map((r) => r.children.length)).toEqual([3, 3, 3]);
		const para = table.children[2]?.children[0]?.children[0];
		const escaped =
			para && "children" in para
				? para.children
						.filter((n): n is Extract<typeof n, { text: string }> => "text" in n)
						.map((n) => n.text)
						.join("")
				: "";
		expect(escaped).toBe("x | y");
	});

	it("a heavily-tabular doc still produces a non-empty body of tables", () => {
		const md =
			"# Implementation plan — at-a-glance table\n\nLead paragraph.\n\n| Domain | Done |\n| ------ | ---- |\n| Shell | yes |\n";
		const blocks = markdownToBlocks(md);
		expect(blocks.length).toBeGreaterThan(0);
		expect(blocks.some((b) => b.type === "table")).toBe(true);
		expect(blocks.some((b) => b.type === "code")).toBe(false);
	});
});

describe("buildDocsAsNotes", () => {
	const docs = [
		{ path: "docs/foundations/49-self-hosting.md", body: DOC_SELF_HOSTING },
		{ path: "docs/apps/03-app-model.md", body: "# App model\n\nWhat an app is." },
		{ path: "docs/reference/11-open-questions.md", body: "# 11 — Open questions\n\nList." },
	];

	it("emits one note per supplied doc", () => {
		const notes = buildDocsAsNotes(docs, NOW);
		expect(notes).toHaveLength(3);
	});

	it("uses stable ids derived from path so re-runs overwrite", () => {
		const a = buildDocsAsNotes(docs, NOW);
		const b = buildDocsAsNotes(docs, NOW);
		expect(b.map((n) => n.id)).toEqual(a.map((n) => n.id));
	});

	it("spreads the timestamps so older docs sort before newer ones", () => {
		const notes = buildDocsAsNotes(docs, NOW);
		expect(notes[0]?.createdAt).toBeGreaterThan(notes[2]?.createdAt ?? 0);
	});

	it("preserves the category emoji on each note", () => {
		const notes = buildDocsAsNotes(docs, NOW);
		expect(notes[0]?.icon?.value).toBe("🧱"); // foundations
		expect(notes[1]?.icon?.value).toBe("🧩"); // apps
		expect(notes[2]?.icon?.value).toBe("📚"); // reference
	});
});

describe("markdownToBlocks — always makes progress (the seed-hang regression)", () => {
	it("does not hang on a prose line that merely starts with a pipe", () => {
		// Real content from `apps/website-publish.md`: a wrapped TypeScript union
		// continuation. It is not a table (no delimiter row follows), so the table
		// branch declines it — and `isParagraphBreak` used to call it a break
		// before the paragraph loop could take it, leaving `i` unmoved and
		// spinning the block loop forever. That hung the ENTIRE vault seed with
		// no error and no timer (the loop blocks the event loop synchronously).
		const md = [
			"# Title",
			"",
			"Some prose that wraps onto the next line and happens to break before a",
			"| null, allowDataImages?: boolean }`. Rewrite `link`/`autolink` hrefs",
			"",
			"Trailing paragraph.",
		].join("\n");
		const blocks = markdownToBlocks(md, () => null);
		expect(blocks.length).toBeGreaterThan(0);
		// The pipe line is content, not structure — it must survive.
		expect(JSON.stringify(blocks)).toContain("allowDataImages");
	});

	it("still parses a real table (a delimiter row follows the header)", () => {
		const md = ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n");
		const blocks = markdownToBlocks(md, () => null);
		expect(JSON.stringify(blocks)).toContain("table");
	});

	it("terminates on a lone pipe line at end of input", () => {
		const blocks = markdownToBlocks("| dangling", () => null);
		expect(Array.isArray(blocks)).toBe(true);
	});
});
