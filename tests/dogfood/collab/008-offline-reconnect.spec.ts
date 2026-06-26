/**
 * Collab-C4-live — session 008: a teammate goes offline, misses live edits, and
 * catches up on reconnect via the durable node.
 *
 * 004 proves a COLD device (wiped vault) restores from the node. This proves the
 * WARM, everyday case: Marcus is online, steps away (closes his shell), Mira
 * keeps editing while he's gone, and when Marcus reconnects he catches up on the
 * edits he missed — the durable node held them (the bridge is online-only;
 * missed-while-offline backfill is SYNC-2's job). His vault is NOT wiped, so he
 * still holds the entity DEK and re-subscribing replays snapshot+tail from the
 * node.
 *
 * Bridge frames are ciphertext (relay-blind). Captures + team-chat narrate it;
 * findings go to the friction log.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
	AccessRole,
	type CollabShell,
	type CollabTeam,
	launchCollabShell,
	startCollabTeam,
} from "../lib/collab-team";
import { type DurableNodeHandle, launchDurableNode } from "../lib/launch-durable-node";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_offline_brief";
const ENTITY_TYPE = "brainstorm/Note/v1";
const SESSION = "collab-008-offline-reconnect";

test("Marcus goes offline, misses live edits, and catches up via the durable node", async () => {
	test.setTimeout(300_000);
	const storageDir = mkdtempSync(join(tmpdir(), "bs-offline-node-"));
	let node: DurableNodeHandle | undefined;
	let team: CollabTeam | undefined;
	let marcusReborn: CollabShell | undefined;
	try {
		node = await launchDurableNode({ storageDir });
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
			],
			{ sessionName: SESSION, freshVaults: true, relay: node },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");

		// 1. Share + converge through the node while both are online.
		mira.chat("Sharing the brief with Marcus through the durable node.");
		await mira.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await mira.editText(ENTITY_ID, "Brief v1. ");
		await Promise.all([mira, marcus].map((s) => s.installShareReceiver(ENTITY_ID, ENTITY_TYPE)));
		await mira.share(ENTITY_ID, ENTITY_TYPE, await marcus.createInvite(marcus.persona.name), AccessRole.Editor);
		await team.awaitConverged(ENTITY_ID, [mira, marcus], 15_000);
		expect(await marcus.readText(ENTITY_ID)).toContain("Brief v1");
		marcus.chat("Got the brief — stepping away for a bit.");
		await marcus.shot("before-offline");

		// 2. Marcus goes offline (his shell closes).
		await marcus.finish();

		// 3. Mira edits while Marcus is away. These ride to the node and must be
		// held for him — there's no live subscriber on the far side right now.
		mira.chat("Marcus is away — I'll keep going; the node should hold these for him.");
		await mira.editText(ENTITY_ID, "[mira: section 2 while away] ");
		await mira.editText(ENTITY_ID, "[mira: section 3 while away] ");
		// Let the frames settle onto the node before Marcus returns.
		await new Promise((r) => setTimeout(r, 1_500));
		mira.note("Made 2 edits while Marcus was offline; expecting the node to backfill them on his return.");

		// 4. Marcus reconnects — vault intact (freshVault=false), so he still has
		// the entity DEK. Re-subscribing replays snapshot+tail from the node.
		marcusReborn = await launchCollabShell(marcus.persona, node.url, SESSION, false);
		await marcusReborn.installShareReceiver(ENTITY_ID, ENTITY_TYPE);

		// 5. He catches up on BOTH missed edits.
		await team.awaitConverged(ENTITY_ID, [mira, marcusReborn], 15_000);
		const caught = await marcusReborn.readText(ENTITY_ID);
		expect(caught, "Marcus caught up on missed-while-offline edits").toContain("[mira: section 2 while away]");
		expect(caught).toContain("[mira: section 3 while away]");
		expect(caught).toBe(await mira.readText(ENTITY_ID));
		marcusReborn.chat("Back — caught up on sections 2 and 3. The node held them for me.");
		mira.note(
			"Offline-reconnect: Marcus missed 2 live edits while away, reconnected (vault intact), and the durable node backfilled both. Missed-while-offline works through the bridge + node.",
		);
		await marcusReborn.shot("caught-up");
	} finally {
		await marcusReborn?.finish();
		await team?.finishAll();
		await node?.stop();
		rmSync(storageDir, { recursive: true, force: true });
	}
});
