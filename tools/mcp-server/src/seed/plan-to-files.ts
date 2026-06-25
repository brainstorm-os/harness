/**
 * Mapper from seeded DesignDoc entities → Files-app `Folder/v1` rows
 * (SH-22 per docs/foundations/49-self-hosting.md).
 *
 * The Files app builds its tree from the vault snapshot: a `Folder/v1`'s
 * `members` define its children (folders nest), and any entity in no
 * folder floats at the vault root (`apps/files/src/logic/vault-tree.ts`).
 * The DesignDoc entities are already projected into the snapshot; this
 * mapper just adds the folders that organise them into a browsable
 * `docs/` tree mirroring the repo's category subdirs.
 *
 * Folder rows are written into the self-hosting blob under a `folder:`
 * prefix and projected as `brainstorm/Folder/v1` by `kv-blob-projectors`,
 * so the same single projection pipeline owns them.
 *
 * Pure + deterministic (sorted by category / docNumber).
 */

import type { SerializedDesignDocEntity } from "./brainstorm-project.ts";

export const FOLDER_KEY_PREFIX = "folder:";
export const DOCS_ROOT_FOLDER_ID = "folder-docs";

export interface SerializedFolderEntity {
	id: string;
	name: string;
	members: string[];
	view: "list" | "grid" | "tree";
	createdAt: number;
	updatedAt: number;
}

export function buildDocsFolderTree(
	designDocs: readonly SerializedDesignDocEntity[],
	now: number,
): SerializedFolderEntity[] {
	const byCategory = new Map<string, SerializedDesignDocEntity[]>();
	for (const d of designDocs) {
		const bucket = byCategory.get(d.category);
		if (bucket) bucket.push(d);
		else byCategory.set(d.category, [d]);
	}

	const categories = [...byCategory.keys()].sort();
	const folders: SerializedFolderEntity[] = [];

	for (const category of categories) {
		const docs = (byCategory.get(category) ?? [])
			.slice()
			.sort((a, b) => a.docNumber - b.docNumber || (a.slug < b.slug ? -1 : 1));
		folders.push({
			id: `${DOCS_ROOT_FOLDER_ID}-${category}`,
			name: category,
			members: docs.map((d) => d.id),
			view: "list",
			createdAt: now,
			updatedAt: now,
		});
	}

	folders.unshift({
		id: DOCS_ROOT_FOLDER_ID,
		name: "docs",
		members: categories.map((c) => `${DOCS_ROOT_FOLDER_ID}-${c}`),
		view: "tree",
		createdAt: now,
		updatedAt: now,
	});

	return folders;
}
