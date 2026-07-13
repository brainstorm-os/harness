/**
 * PRES-4 — two-shell live presence dogfood. Two real Electron shells with
 * distinct identities share a note entity over the collab relay, publish
 * presence through the dev bridge, and converge on each other's peer state.
 */

import { expect, test } from "@playwright/test";
import { AccessRole, type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_presence_note";
const ENTITY_TYPE = "brainstorm/Note/v1";
const APP_ID = "io.brainstorm.notes";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function peerNames(
	peers: { clientId: number; state: Record<string, unknown> }[],
): string[] {
	return peers
		.map((p) => (p.state.presence as { name?: string } | undefined)?.name)
		.filter((n): n is string => typeof n === "string");
}

async function awaitPresence(
	shell: CollabTeam["shells"][number],
	entityId: string,
	expectedName: string,
	timeoutMs = 45_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const peers = await shell.presenceRemotePeers(entityId);
		if (peerNames(peers).includes(expectedName)) return;
		await sleep(500);
	}
	throw new Error(`timed out waiting for presence "${expectedName}" on ${shell.persona.key}`);
}

test("two shells publish presence on a shared note and see each other live", async () => {
	test.setTimeout(300_000);
	let team: CollabTeam | undefined;
	try {
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
			],
			{ sessionName: "collab-010-presence-live", freshVaults: true },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");

		await mira.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await mira.installShareReceiver(ENTITY_ID, ENTITY_TYPE);
		await marcus.installShareReceiver(ENTITY_ID, ENTITY_TYPE);

		const invite = await marcus.createInvite(marcus.persona.name);
		await mira.share(ENTITY_ID, ENTITY_TYPE, invite, AccessRole.Editor);

		await mira.publishPresence(ENTITY_ID, APP_ID, {
			presence: { id: "mira", name: "Mira", color: "#e8590c" },
		});
		await marcus.publishPresence(ENTITY_ID, APP_ID, {
			presence: { id: "marcus", name: "Marcus", color: "#2f6df6" },
		});

		await awaitPresence(mira, ENTITY_ID, "Marcus");
		await awaitPresence(marcus, ENTITY_ID, "Mira");

		mira.chat("Marcus's presence landed in my peer set over the live relay.");
		marcus.chat("I can see Mira too — live presence works across two shells.");
		await mira.shot("mira-sees-marcus");
	} finally {
		await team?.finishAll();
	}
});