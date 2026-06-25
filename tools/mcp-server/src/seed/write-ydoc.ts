/**
 * write-ydoc — emit a per-entity `.ydoc` snapshot file from a seed body.
 *
 * Without this helper, the seeder writes the note body as a Lexical
 * `SerializedEditorState` into the per-app `kv.json`. The renderer's
 * codec routes that object to `bodyLegacy`, then `runVaultBodyMigration`
 * has to plant it into the Y.Doc on first open — that boot-time plant is
 * exactly the path that competed for the renderer's main thread and made
 * Notes feel "clunky" (the original "app is overall slow" report).
 *
 * Instead: the seeder synthesises the Y.Doc right here, encodes its full
 * state via `Y.encodeStateAsUpdate`, and writes it to disk in the same
 * file format the shell's `YDocStore` reads on load (`<vault>/data/docs/
 * <prefix>/<id>.ydoc`, magic `YDOC` + version uint32 LE + snap_len uint32
 * LE + snapshot bytes). Fresh-seeded vaults open straight from the
 * on-disk Y.Doc, no migration runs, no main-thread plant.
 *
 * The plant uses the shared `plantSerializedStateIntoDoc` helper from
 * `@brainstorm/editor` so the seed-time Lexical-to-Yjs translation
 * matches what the running editor would produce on the first edit — no
 * structural drift, no second source of truth.
 *
 * The file format mirrors `packages/shell/src/main/storage/ydoc-store.ts`
 * `encodeFile` exactly (an empty tail; one snapshot section that contains
 * the whole doc). Keeping the format duplicated here rather than
 * importing `YDocStore` directly: the shell package pulls in better-
 * sqlite3 + Electron, neither of which we want as deps of the Bun-only
 * seed-cli.
 */

import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BASELINE_NODES, plantSerializedStateIntoDoc } from "@brainstorm/editor";
import type { Klass, LexicalNode, SerializedEditorState } from "lexical";
import * as Y from "yjs";
import { SEEDER_EXTRA_NODES } from "./seed-nodes.ts";
import { seedBodyToSnippet } from "./seed-snippet.ts";
import type { SeedNote } from "./types.ts";

const YDOC_MAGIC = Buffer.from("YDOC", "ascii");
const YDOC_FORMAT_VERSION = 1;
const YDOC_HEADER_BYTES = 4 /* magic */ + 4 /* version */ + 4 /* snap_len */;

export type WriteYDocOptions = {
	/** Vault root path; `data/docs/<prefix>/<id>.ydoc` is computed from it. */
	vaultPath: string;
	/** Entity id this Y.Doc backs. Sharded by the first 3 chars of the id
	 *  to match `YDocStore.pathFor` (`<prefix>/<id>.ydoc`). */
	entityId: string;
	/** Lexical state to plant. Goes through the shared `plantSerialized
	 *  StateIntoDoc` so the on-disk format matches what the editor would
	 *  write on first edit. */
	body: SerializedEditorState;
	/** Extra Lexical nodes (e.g. Notes' Title, Mention, PropertyBlock,
	 *  etc.) the body references. Appended to `BASELINE_NODES`; omit for
	 *  bodies that only use the baseline set. */
	additionalNodes?: ReadonlyArray<Klass<LexicalNode>>;
	/** Namespace tag for the headless editor used during plant. Default
	 *  is fine for seeded content; the namespace only matters when two
	 *  plants share a single doc concurrently, which seed-cli never does. */
	namespace?: string;
};

/** Build the doc, plant the state, encode + write the `.ydoc` file. */
export function writeSeededYDoc(opts: WriteYDocOptions): { path: string; bytes: number } {
	const doc = new Y.Doc();
	const nodes = opts.additionalNodes
		? [...BASELINE_NODES, ...opts.additionalNodes]
		: [...BASELINE_NODES];
	const plantOpts: { nodes: ReadonlyArray<Klass<LexicalNode>>; namespace?: string } = { nodes };
	if (opts.namespace !== undefined) plantOpts.namespace = opts.namespace;
	plantSerializedStateIntoDoc(doc, opts.body, plantOpts);
	const snapshot = Y.encodeStateAsUpdate(doc);
	doc.destroy();

	const file = encodeYDocFile(snapshot);
	const path = ydocPath(opts.vaultPath, opts.entityId);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, file);
	return { path, bytes: file.length };
}

/** SeedNote → kv-row + on-disk Y.Doc.
 *
 * Materialises one seeded note for the new on-disk shape: plants the
 * `SerializedEditorState` body into a `.ydoc` file (so the editor reads
 * content immediately on open, no migration) and rewrites the kv row's
 * `body` field as a plain-text snippet (so the sidebar / cold-cache
 * search has a real preview without needing to hydrate the Y.Doc).
 *
 * The kv row's `body` was previously the whole `SerializedEditorState`;
 * the renderer's codec routed that to `bodyLegacy` and queued a
 * boot-time plant via `runVaultBodyMigration`. With the snippet shape,
 * the codec keeps `body` as a string and `bodyLegacy` stays undefined —
 * no migration, no main-thread plant on boot. */
export function materializeSeededNote(
	vaultPath: string,
	note: SeedNote,
): { row: Record<string, unknown>; ydocPath: string; ydocBytes: number } {
	const written = writeSeededYDoc({
		vaultPath,
		entityId: note.id,
		body: note.body as unknown as SerializedEditorState,
		additionalNodes: SEEDER_EXTRA_NODES,
		namespace: `seed-${note.id}`,
	});
	const snippet = seedBodyToSnippet(note.body as unknown as SerializedEditorState);
	const { body: _body, ...rest } = note;
	const row: Record<string, unknown> = { ...rest, body: snippet };
	return { row, ydocPath: written.path, ydocBytes: written.bytes };
}

/** Sharded on-disk path. Mirrors `YDocStore.pathFor` exactly so the shell
 *  reads the file we wrote. */
export function ydocPath(vaultPath: string, entityId: string): string {
	const prefix = entityId.slice(0, 3) || "_";
	return join(vaultPath, "data", "docs", prefix, `${entityId}.ydoc`);
}

function encodeYDocFile(snapshot: Uint8Array): Buffer {
	const header = Buffer.alloc(YDOC_HEADER_BYTES);
	YDOC_MAGIC.copy(header, 0);
	header.writeUInt32LE(YDOC_FORMAT_VERSION, 4);
	header.writeUInt32LE(snapshot.length, 8);
	return Buffer.concat([header, Buffer.from(snapshot)]);
}
