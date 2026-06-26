/**
 * Collab-C4-live — session 001: Mira shares the operating-hub brief with Marcus.
 *
 * The live, two-shell dogfood of multi-user collaboration. Two real shells with
 * distinct sovereign identities, a shared relay, and the C1/C2 share flow over
 * the `dev:collab:*` bridge:
 *
 *   1. Mira provisions a Note + bootstraps her Owner grant.
 *   2. Marcus mints a self-signed invite; Mira grants + wraps + emits.
 *   3. Marcus receives the wrap + encrypted doc state and reads the brief.
 *   4. Both co-edit concurrently → their persisted docs converge.
 *   5. Marcus rolls off; Mira revokes (append-only audit, forward-only access).
 *
 * Like every dogfood session this is a driven scenario, not a product
 * assertion — but it carries a handful of `expect`s because the *whole point*
 * is to prove collaboration actually works end to end through the shipped
 * shell. Captures + team-chat narrate it; findings go to the friction log.
 */

import { expect, test } from "@playwright/test";
import { AccessRole, type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_hub_brief";
const ENTITY_TYPE = "brainstorm/Note/v1";

test("Mira shares the operating-hub brief with Marcus; both co-edit; Mira revokes", async () => {
	test.setTimeout(300_000);
	let team: CollabTeam | undefined;
	try {
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
			],
			{ sessionName: "collab-001-mira-marcus-share", freshVaults: true },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");

		// Distinct people — the premise of multi-user collaboration.
		const miraId = await mira.whoami();
		const marcusId = await marcus.whoami();
		expect(miraId.userPubB64).not.toBe(marcusId.userPubB64);

		mira.chat(
			"Starting the Q3 operating-hub brief — I'll share it with Marcus for the design section.",
		);
		await mira.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await mira.editText(ENTITY_ID, "Operating hub — Q3 brief. ");
		await mira.installShareReceiver(ENTITY_ID, ENTITY_TYPE);
		await marcus.installShareReceiver(ENTITY_ID, ENTITY_TYPE);
		await mira.shot("provisioned");

		const invite = await marcus.createInvite(marcus.persona.name);
		marcus.chat("Sending my invite so you can grant me edit access.");
		const members = await mira.share(ENTITY_ID, ENTITY_TYPE, invite, AccessRole.Editor);
		expect(members.find((m) => m.member === miraId.userPubB64)?.role).toBe(AccessRole.Owner);
		expect(members.find((m) => m.member === marcusId.userPubB64)?.active).toBe(true);

		// Marcus receives the wrap + encrypted doc state and reads the brief.
		await team.awaitConverged(ENTITY_ID, [mira, marcus]);
		expect(await marcus.readText(ENTITY_ID)).toContain("Q3 brief");
		const marcusAccess = await marcus.access(ENTITY_ID);
		expect(marcusAccess.find((m) => m.member === marcusId.userPubB64)?.active).toBe(true);
		marcus.chat("Got it — brief's open. Adding the design section.");
		await marcus.shot("received");

		// Concurrent bidirectional editing → convergence.
		await marcus.editText(ENTITY_ID, "[design: 3 hero layouts] ");
		await mira.editText(ENTITY_ID, "[mira: ship date Oct 14] ");
		await team.awaitConverged(ENTITY_ID, [mira, marcus]);
		const miraText = await mira.readText(ENTITY_ID);
		expect(await marcus.readText(ENTITY_ID)).toBe(miraText);
		expect(miraText).toContain("[design: 3 hero layouts]");
		expect(miraText).toContain("[mira: ship date Oct 14]");
		await mira.shot("co-edited");

		// Marcus rolls off — Mira revokes; append-only audit, forward-only access.
		mira.chat("Marcus is wrapping up — revoking his access to the brief.");
		expect(await mira.revoke(ENTITY_ID, marcusId.userPubB64)).toBe(true);
		await team.awaitConverged(ENTITY_ID, [mira, marcus]);
		const afterRevoke = await marcus.access(ENTITY_ID);
		const revoked = afterRevoke.find((m) => m.member === marcusId.userPubB64);
		expect(revoked?.active).toBe(false);
		mira.note(
			"Shared the brief, co-edited to convergence, and revoked cleanly. Collaboration works end to end.",
		);
	} finally {
		await team?.finishAll();
	}
});
