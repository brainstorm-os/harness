import { describe, expect, it } from "vitest";
import { buildVaultFileTree } from "../../../apps/files/src/logic/vault-tree.ts";
import type { SerializedDesignDocEntity } from "../src/seed/brainstorm-project.ts";
import { DOCS_ROOT_FOLDER_ID, buildDocsFolderTree } from "../src/seed/plan-to-files.ts";

const NOW = Date.UTC(2026, 4, 17);

function doc(
	id: string,
	category: string,
	docNumber: number,
	slug: string,
): SerializedDesignDocEntity {
	return {
		id,
		path: `docs/${category}/${docNumber}-${slug}.md`,
		slug,
		category,
		docNumber,
		title: `${docNumber} — ${slug}`,
		excerpt: "",
		referencedDocs: [],
		governingIterations: [],
		createdAt: NOW,
		updatedAt: NOW,
	};
}

const docs = [
	doc("doc-architecture", "foundations", 2, "architecture"),
	doc("doc-self-hosting", "foundations", 49, "self-hosting"),
	doc("doc-shell", "shell", 12, "shell-architecture"),
];

describe("buildDocsFolderTree", () => {
	const folders = buildDocsFolderTree(docs, NOW);

	it("emits a docs root folder whose members are the category folders", () => {
		const root = folders.find((f) => f.id === DOCS_ROOT_FOLDER_ID);
		expect(root?.name).toBe("docs");
		expect(root?.members).toEqual([
			`${DOCS_ROOT_FOLDER_ID}-foundations`,
			`${DOCS_ROOT_FOLDER_ID}-shell`,
		]);
	});

	it("a category folder lists its DesignDoc ids sorted by docNumber", () => {
		const found = folders.find((f) => f.id === `${DOCS_ROOT_FOLDER_ID}-foundations`);
		expect(found?.members).toEqual(["doc-architecture", "doc-self-hosting"]);
	});

	it("nests correctly when fed through the real Files vault-tree builder", () => {
		// Simulate the projected snapshot: folders + DesignDoc entities.
		const snapshot = [
			...folders.map((f) => ({
				id: f.id,
				type: "brainstorm/Folder/v1",
				properties: { name: f.name, members: f.members, view: f.view },
				createdAt: NOW,
				updatedAt: NOW,
				deletedAt: null,
			})),
			...docs.map((d) => ({
				id: d.id,
				type: "brainstorm/DesignDoc/v1",
				properties: { name: d.title },
				createdAt: NOW,
				updatedAt: NOW,
				deletedAt: null,
			})),
		];
		const tree = buildVaultFileTree(snapshot, "vault-root");
		const root = tree.find((e) => e.id === "vault-root");
		// The docs root folder floats at the vault root (nothing contains it).
		expect((root?.properties.members as string[] | undefined)?.includes(DOCS_ROOT_FOLDER_ID)).toBe(
			true,
		);
		// No DesignDoc floats at the root — they're all inside category folders.
		expect((root?.properties.members as string[]).some((m) => m.startsWith("doc-"))).toBe(false);
	});

	it("is deterministic", () => {
		expect(buildDocsFolderTree(docs, NOW)).toEqual(folders);
	});
});
