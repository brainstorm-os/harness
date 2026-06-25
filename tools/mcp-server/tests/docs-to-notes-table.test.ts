// @vitest-environment jsdom
//
// The seeder hand-builds Lexical JSON for GFM tables (it cannot import
// `lexical` — it runs in the MCP server). This test is the contract that
// the hand-built shape is exactly what `@lexical/table`'s `parseEditorState`
// re-hydrates: a real, editable TableNode tree — not the old frozen code
// block. If `@lexical/table` v0.21 changes its serialized shape, this fails
// here rather than silently in a seeded vault.
import { createHeadlessEditor } from "@lexical/headless";
import { $isTableNode, TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $getRoot, type LexicalEditor } from "lexical";
import { describe, expect, it } from "vitest";
import { markdownToBlocks } from "../src/seed/docs-to-notes.ts";

function editorFromBlocks(md: string): LexicalEditor {
	const editor = createHeadlessEditor({
		namespace: "seed-table",
		nodes: [TableNode, TableRowNode, TableCellNode],
		onError: (e) => {
			throw e;
		},
	});
	const state = {
		root: {
			type: "root",
			version: 1,
			format: "",
			indent: 0,
			direction: null,
			children: markdownToBlocks(md),
		},
	};
	// Round-trip through JSON exactly as the seeded vault file does.
	editor.setEditorState(editor.parseEditorState(JSON.parse(JSON.stringify(state))));
	return editor;
}

describe("seeded GFM table re-hydrates as a real @lexical/table tree", () => {
	it("parseEditorState yields an editable TableNode with correct dims + text", () => {
		const editor = editorFromBlocks(
			"# T\n\n| Name | Role |\n| - | - |\n| Ada | Eng |\n| Bo | PM |\n",
		);

		editor.getEditorState().read(() => {
			const table = $getRoot().getFirstChild();
			expect(table && $isTableNode(table)).toBe(true);
			if (!table || !$isTableNode(table)) throw new Error("first child is not a TableNode");

			expect(table.getChildrenSize()).toBe(3); // header + 2 body rows
			const firstRow = table.getFirstChild<TableRowNode>();
			expect(firstRow?.getChildrenSize()).toBe(2);

			// Header cells report a header state; body cells do not — the
			// editor's header styling/affordances depend on this.
			const headerCell = firstRow?.getFirstChild<TableCellNode>();
			expect(headerCell?.hasHeader()).toBe(true);

			const bodyCell = table.getChildAtIndex<TableRowNode>(1)?.getFirstChild<TableCellNode>();
			expect(bodyCell?.hasHeader()).toBe(false);

			// Cell text survives the round-trip.
			expect(table.getTextContent().replace(/\s+/g, " ").trim()).toBe("Name Role Ada Eng Bo PM");
		});
	});

	it("survives a second JSON round-trip (exportJSON ≡ seeded shape)", () => {
		const editor = editorFromBlocks("# T\n\n| A | B |\n| - | - |\n| 1 | 2 |\n");
		const exported = JSON.stringify(editor.getEditorState().toJSON());

		const restored = createHeadlessEditor({
			namespace: "seed-table-2",
			nodes: [TableNode, TableRowNode, TableCellNode],
			onError: (e) => {
				throw e;
			},
		});
		restored.setEditorState(restored.parseEditorState(JSON.parse(exported)));
		restored.getEditorState().read(() => {
			const table = $getRoot().getFirstChild();
			if (!table || !$isTableNode(table)) throw new Error("not a TableNode");
			expect(table.getChildrenSize()).toBe(2);
			expect(table.getFirstChild<TableRowNode>()?.getChildrenSize()).toBe(2);
		});
	});
});
