/**
 * Collab-C4-live — session 002: a THREE-way live collaboration through the sync
 * service.
 *
 * Where 001 proved the two-user share + co-edit + revoke path, this proves the
 * relay genuinely FANS OUT to multiple subscribers: three real shells, three
 * distinct sovereign identities (Mira / Marcus / Priya), each its own vault and
 * theme, all pointed at one standalone relay process (the sync service). Mira
 * owns a shared brief and grants both teammates Editor; all three edit
 * concurrently; their persisted Y.Docs converge to a single text that carries
 * every contribution; then Mira revokes one collaborator (append-only audit,
 * forward-only access).
 *
 * Every co-edit frame crosses the relay as ciphertext — the relay never holds a
 * key (relay-blind), so this is real multi-user collaboration transiting the
 * sync service end to end, captured + asserted through the shipped shell.
 *
 * NOTE on the path: the live, always-on auto-sync of *app-UI* edits (typing in
 * the Notes editor → relay) is a later stage — the ydoc-store persist path does
 * not yet auto-emit; only the C4 collab bridge / pairing / soak emit explicitly.
 * This session drives that real C4 subsystem (the same `grantAccess` +
 * encrypted-relay path the shipped code uses), which is the working real-time
 * collaboration mechanism today.
 */

import { expect, test } from "@playwright/test";
import { AccessRole, type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_north_star";
const ENTITY_TYPE = "brainstorm/Note/v1";

test("Mira shares the north-star brief with Marcus + Priya; all three co-edit live; Mira revokes Marcus", async () => {
	test.setTimeout(300_000);
	let team: CollabTeam | undefined;
	try {
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
				{ key: "priya", name: "Priya", speaker: SPEAKER.Priya },
			],
			{ sessionName: "collab-002-three-way-live", freshVaults: true },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");
		const priya = team.byKey("priya");
		const everyone = [mira, marcus, priya];

		// Three distinct people — the premise of multi-user collaboration.
		const ids = await Promise.all(everyone.map((s) => s.whoami()));
		const pubkeys = new Set(ids.map((i) => i.userPubB64));
		expect(pubkeys.size, "three distinct sovereign identities").toBe(3);
		const miraId = ids[0];
		const marcusId = ids[1];
		const priyaId = ids[2];

		// Mira owns the brief and wires every shell to the entity's relay channel.
		mira.chat("Kicking off the north-star brief — sharing it with Marcus and Priya to co-write.");
		await mira.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await mira.editText(ENTITY_ID, "North star — Q3. ");
		await Promise.all(everyone.map((s) => s.installShareReceiver(ENTITY_ID, ENTITY_TYPE)));
		await mira.shot("provisioned");

		// Grant Marcus, then Priya — each invite is self-signed; Mira wraps the DEK.
		const marcusInvite = await marcus.createInvite(marcus.persona.name);
		marcus.chat("Invite sent — ready to take the design section.");
		await mira.share(ENTITY_ID, ENTITY_TYPE, marcusInvite, AccessRole.Editor);

		const priyaInvite = await priya.createInvite(priya.persona.name);
		priya.chat("Mine too — I'll edit the research framing.");
		const members = await mira.share(ENTITY_ID, ENTITY_TYPE, priyaInvite, AccessRole.Editor);

		// All three are now on the access list: Mira owner, the other two active editors.
		expect(members.find((m) => m.member === miraId?.userPubB64)?.role).toBe(AccessRole.Owner);
		expect(members.find((m) => m.member === marcusId?.userPubB64)?.active).toBe(true);
		expect(members.find((m) => m.member === priyaId?.userPubB64)?.active).toBe(true);

		// Marcus + Priya receive the wrap + encrypted doc state and read the brief.
		await team.awaitConverged(ENTITY_ID, everyone);
		expect(await marcus.readText(ENTITY_ID)).toContain("North star");
		expect(await priya.readText(ENTITY_ID)).toContain("North star");
		marcus.chat("Got it — adding the design section.");
		priya.chat("Reading now — appending the research framing.");
		await marcus.shot("received");
		await priya.shot("received");

		// Concurrent edits from ALL THREE → the relay fans each frame out to the
		// other two; the CRDT merges them; every persisted doc converges.
		await Promise.all([
			mira.editText(ENTITY_ID, "[mira: ship Oct 14] "),
			marcus.editText(ENTITY_ID, "[marcus: 3 hero layouts] "),
			priya.editText(ENTITY_ID, "[priya: framing = jobs-to-be-done] "),
		]);
		await team.awaitConverged(ENTITY_ID, everyone, 12_000);

		const miraText = await mira.readText(ENTITY_ID);
		expect(await marcus.readText(ENTITY_ID)).toBe(miraText);
		expect(await priya.readText(ENTITY_ID)).toBe(miraText);
		expect(miraText).toContain("[mira: ship Oct 14]");
		expect(miraText).toContain("[marcus: 3 hero layouts]");
		expect(miraText).toContain("[priya: framing = jobs-to-be-done]");
		mira.note(
			`Three-way converged. Final shared text: "${miraText.trim()}" — identical across all three shells.`,
		);
		await mira.shot("co-edited");
		await marcus.shot("co-edited");
		await priya.shot("co-edited");

		// Mira revokes Marcus — append-only audit, forward-only access. Priya keeps editing.
		mira.chat("Marcus is rolling off the brief — revoking his access; Priya stays on.");
		expect(await mira.revoke(ENTITY_ID, marcusId?.userPubB64 ?? "")).toBe(true);

		// F-286 rotate-on-revoke: the revoke mints DEK' and re-wraps it for the
		// SURVIVORS only, so from here the three shells must NOT converge as a
		// group - that is the guarantee, not a failure. Mira and Priya keep
		// converging; Marcus is cryptographically cut off from everything new.
		await team.awaitConverged(ENTITY_ID, [mira, priya], 12_000);

		const afterRevoke = await priya.access(ENTITY_ID);
		expect(afterRevoke.find((m) => m.member === marcusId?.userPubB64)?.active).toBe(false);
		expect(afterRevoke.find((m) => m.member === priyaId?.userPubB64)?.active).toBe(true);
		// The forward-secrecy assertion, from the survivor's side: an edit made
		// AFTER the revoke reaches Priya and never reaches Marcus.
		await mira.editText(ENTITY_ID, "[mira: post-revoke - launch copy locked] ");
		await team.awaitConverged(ENTITY_ID, [mira, priya], 12_000);
		const postRevoke = await mira.readText(ENTITY_ID);
		expect(await priya.readText(ENTITY_ID), "the survivor keeps reading").toBe(postRevoke);
		expect(
			await marcus.readText(ENTITY_ID),
			"the revoked member cannot read post-revoke content",
		).not.toContain("post-revoke - launch copy locked");

		mira.note(
			"Shared a brief with two teammates, all three co-edited to convergence through the relay, then revoked one. The survivor keeps converging; the revoked member is cut off from every later edit (F-286 rotate-on-revoke, proven on real shells).",
		);
		await mira.shot("after-revoke");
	} finally {
		await team?.finishAll();
	}
});
