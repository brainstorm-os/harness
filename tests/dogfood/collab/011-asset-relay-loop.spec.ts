/**
 * Asset-B4 — session 011: the encrypted-attachment relay loop, live, through
 * the REAL durable node. The one transport the collab harness had never
 * exercised across two real shells: attachment BYTES (the Y.Doc plane moves
 * only docs). This is the lazy-fetch claim, proven end to end:
 *
 *   1. Mira binds an image to the brief — the real `AssetStore` mints a
 *      per-asset DEK + sealed blob; the entities service's implicit-bind
 *      reconciler derives the `asset_refs` row; the post-commit hook pushes
 *      the encrypted chunks to the durable node and installs the chunk
 *      manifest on the entity Y.Doc (the upload-done marker we await).
 *   2. The node's STORAGE_DIR grows — ciphertext chunks, persisted, before
 *      Marcus exists in the story (upload happened on BIND, not on access).
 *   3. Mira shares the brief; the full encrypted doc state (manifest +
 *      re-homed asset-DEK wrap included) converges to Marcus.
 *   4. Marcus has NO local bytes (`readAssetLocal` → null) — nothing was
 *      eagerly fetched.
 *   5. Marcus MATERIALISES ON ACCESS: reconstruct the metadata from the synced
 *      manifest + wrap, fetch + verify + reassemble the chunks off the node —
 *      `source: relay-fetch`, and the bytes equal Mira's original, byte for
 *      byte.
 *   6. The materialise restored the blob locally: `readAssetLocal` now
 *      round-trips, and a second access serves `source: local-blob`.
 */

import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
	AccessRole,
	CollabAssetSource,
	type CollabTeam,
	startCollabTeam,
} from "../lib/collab-team";
import { type DurableNodeHandle, launchDurableNode } from "../lib/launch-durable-node";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_asset_brief";
const ENTITY_TYPE = "brainstorm/Note/v1";
const ASSET_MIME = "image/png";
const ASSET_PROPERTY = "attachment";

/** ~96 KiB of deterministic pseudo-random bytes — big enough to be a real
 *  attachment, small enough to ride the dev IPC comfortably (one 4 MiB chunk;
 *  multi-chunk split is unit-covered in the shell). */
const ASSET_BYTES = ((): Uint8Array => {
	const bytes = new Uint8Array(96 * 1024);
	let x = 0xc0ffee42;
	for (let i = 0; i < bytes.length; i++) {
		// xorshift32 — deterministic, no Node crypto needed.
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		bytes[i] = x & 0xff;
	}
	return bytes;
})();

/** Count regular files anywhere under `dir` (the node shards its stores). */
function countFiles(dir: string): number {
	let n = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) n += countFiles(p);
		else if (statSync(p).size >= 0) n += 1;
	}
	return n;
}

test("Mira binds an attachment → chunks upload to the durable node → Marcus materialises it lazily on access, byte-identical", async () => {
	test.setTimeout(300_000);
	const storageDir = mkdtempSync(join(tmpdir(), "bs-asset-relay-"));
	let node: DurableNodeHandle | undefined;
	let team: CollabTeam | undefined;
	try {
		node = await launchDurableNode({ storageDir });

		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
			],
			{ sessionName: "collab-011-asset-relay-loop", freshVaults: true, relay: node },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");
		const both = [mira, marcus];

		// 1. Mira drafts the brief and attaches the image through the REAL
		// asset pipeline (encrypted store → implicit bind → upload-on-bind).
		mira.chat("Attaching the launch mock to the brief — first run of attachment sync.");
		await mira.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await mira.editText(ENTITY_ID, "Asset brief — launch mock attached. ");
		const filesBeforeBind = countFiles(storageDir);
		const { assetId, url } = await mira.bindAsset(
			ENTITY_ID,
			ASSET_BYTES,
			ASSET_MIME,
			ASSET_PROPERTY,
		);
		expect(url).toBe(`brainstorm://asset/${assetId}`);

		// The upload-done marker: the chunk manifest lands on the entity doc
		// only after every encrypted chunk is confirmed on the node.
		await mira.awaitAssetUploaded(ENTITY_ID, assetId);
		const miraStatus = await mira.assetStatus(ENTITY_ID, assetId);
		expect(miraStatus).toEqual({ hasRow: true, hasLocalBytes: true, manifestPresent: true });

		// 2. The durable node persisted NEW ciphertext for the blob plane —
		// at bind time, before the share, before Marcus ever touches it.
		const filesAfterBind = countFiles(storageDir);
		expect(filesAfterBind).toBeGreaterThan(filesBeforeBind);
		await mira.shot("bound-and-uploaded");
		mira.note(
			`Bound ${ASSET_BYTES.length} bytes as ${assetId}; node grew ${filesBeforeBind}→${filesAfterBind} files on bind.`,
		);

		// 3. Share the brief; the full encrypted state (manifest + asset-DEK
		// wrap included) converges to Marcus over the node.
		await Promise.all(both.map((s) => s.installShareReceiver(ENTITY_ID, ENTITY_TYPE)));
		const invite = await marcus.createInvite(marcus.persona.name);
		const members = await mira.share(ENTITY_ID, ENTITY_TYPE, invite, AccessRole.Editor);
		expect(members.find((m) => m.active && m.role === AccessRole.Editor)).toBeTruthy();
		await team.awaitConverged(ENTITY_ID, both, 15_000);
		expect(await marcus.readText(ENTITY_ID)).toContain("launch mock attached");

		// 4. LAZY: Marcus's device holds no asset bytes before the first access.
		expect(await marcus.readAssetLocal(assetId)).toBeNull();
		const cold = await marcus.assetStatus(ENTITY_ID, assetId);
		expect(cold.hasRow).toBe(false);
		expect(cold.hasLocalBytes).toBe(false);
		marcus.chat("Opening the brief — the attachment isn't on my machine yet.");

		// 5. Materialise ON ACCESS: reconstruct from the synced metadata, fetch
		// the chunks off the node — and the bytes are Mira's, byte for byte.
		const first = await marcus.materializeAsset(ENTITY_ID, assetId);
		expect(first).not.toBeNull();
		if (!first) throw new Error("unreachable");
		expect(first.source).toBe(CollabAssetSource.RelayFetch);
		expect(first.mime).toBe(ASSET_MIME);
		expect(Buffer.compare(first.bytes, Buffer.from(ASSET_BYTES))).toBe(0);
		await marcus.shot("materialized-on-access");

		// 6. The lazy fetch restored the blob locally: reads now round-trip
		// without the wire, and a second access serves the local blob.
		const local = await marcus.readAssetLocal(assetId);
		expect(local).not.toBeNull();
		if (!local) throw new Error("unreachable");
		expect(Buffer.compare(local.bytes, Buffer.from(ASSET_BYTES))).toBe(0);
		const second = await marcus.materializeAsset(ENTITY_ID, assetId);
		expect(second?.source).toBe(CollabAssetSource.LocalBlob);
		marcus.chat("Got it — the mock came down on first open and it's cached now.");
		marcus.note(
			`Materialised ${assetId} lazily on access (${first.bytes.length} bytes, source=${first.source}); second access source=${second?.source}.`,
		);
	} finally {
		await team?.finishAll();
		await node?.stop();
		rmSync(storageDir, { recursive: true, force: true });
	}
});
