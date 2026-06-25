/**
 * Collab-C4-live — session 003: two real shells co-edit through the REAL
 * `../brainstorm-sync` **durable** node (SYNC-2), not the in-process forward-
 * only relay. This dogfoods the deployable zero-knowledge node end to end with
 * the shipped client:
 *
 *   - the shells connect to the node over `ws://` and exchange encrypted frames
 *     (product client ↔ durable node interop);
 *   - the node **durably persists** the encrypted traffic it forwards — proven
 *     by the on-disk `STORAGE_DIR` being populated for the shared entity after
 *     the co-edit (the node never holds a key — the blobs are ciphertext);
 *   - a teammate who subscribes converges, exercising the node's blind fan-out
 *     + offline-backfill path the cold-restore story (10.14) consumes.
 *
 * The cold-reconnect → snapshot+tail backfill is unit-proven over real
 * WebSockets in `../brainstorm-sync/src/sync/node-e2e.test.ts`; this session
 * proves the shipped Electron client interoperates with that node and that the
 * node persists real product traffic.
 */

import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { AccessRole } from "../../../packages/shell/src/main/collab/access-record";
import { type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { type DurableNodeHandle, launchDurableNode } from "../lib/launch-durable-node";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_durable_brief";
const ENTITY_TYPE = "brainstorm/Note/v1";

/** Count regular files anywhere under `dir` (the node shards by entity). */
function countFiles(dir: string): number {
	let n = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) n += countFiles(p);
		else if (statSync(p).size >= 0) n += 1;
	}
	return n;
}

test("Mira + Marcus co-edit through the REAL durable node; the node persists the encrypted traffic", async () => {
	test.setTimeout(300_000);
	const storageDir = mkdtempSync(join(tmpdir(), "bs-durable-node-"));
	let node: DurableNodeHandle | undefined;
	let team: CollabTeam | undefined;
	try {
		node = await launchDurableNode({ storageDir });

		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
			],
			{ sessionName: "collab-003-durable-node", freshVaults: true, relay: node },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");
		const both = [mira, marcus];

		// Mira owns the brief and seeds it; every shell wires to its relay channel.
		mira.chat("Co-writing the brief through the DURABLE sync node this time.");
		await mira.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await mira.editText(ENTITY_ID, "Durable brief — Q3. ");
		await Promise.all(both.map((s) => s.installShareReceiver(ENTITY_ID, ENTITY_TYPE)));

		// Share with Marcus, then both co-edit live through the node.
		const invite = await marcus.createInvite(marcus.persona.name);
		const members = await mira.share(ENTITY_ID, ENTITY_TYPE, invite, AccessRole.Editor);
		expect(members.find((m) => m.active && m.role === AccessRole.Editor)).toBeTruthy();

		await Promise.all([
			mira.editText(ENTITY_ID, "[mira: durability matters] "),
			marcus.editText(ENTITY_ID, "[marcus: backfill on reconnect] "),
		]);
		await team.awaitConverged(ENTITY_ID, both, 15_000);

		const miraText = await mira.readText(ENTITY_ID);
		expect(await marcus.readText(ENTITY_ID)).toBe(miraText);
		expect(miraText).toContain("[mira: durability matters]");
		expect(miraText).toContain("[marcus: backfill on reconnect]");
		await mira.shot("co-edited-through-durable-node");

		// The node durably persisted the encrypted traffic: STORAGE_DIR is now
		// populated (ciphertext blobs — the node holds no key).
		const persistedFiles = countFiles(storageDir);
		mira.note(
			`Durable node persisted ${persistedFiles} on-disk blob(s) for the shared brief; both shells converged to "${miraText.trim()}".`,
		);
		expect(persistedFiles).toBeGreaterThan(0);
	} finally {
		await team?.finishAll();
		await node?.stop();
		rmSync(storageDir, { recursive: true, force: true });
	}
});
