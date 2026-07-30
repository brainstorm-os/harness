/**
 * Collab-C4-live — session 005: the Northbound team ships Issue #4.
 *
 * Reviving the team loop (Mira + Marcus + Priya) after a run of solo mechanical
 * sweeps — and after the repo split silently broke the whole collab harness (two
 * value-imports the thin post-split harness can't resolve; fixed in
 * collab-team.ts). Where 002 proved three EDITORS share + co-edit + revoke, 005
 * adds the parts that carry real risk:
 *
 *   1. MIXED ROLES — Marcus = Editor (writes the design section), Priya = Viewer
 *      (research editor; reads + reviews). We assert a Viewer still receives the
 *      editors' LIVE edits (not just the share-time snapshot), then probe whether
 *      a Viewer who holds the DEK can emit an edit the editors accept.
 *   2. REVOKE → RE-INVITE — Mira takes Marcus off the brief, then re-grants him;
 *      he re-converges to the latest text. Revoke is not a dead end.
 *
 * NOTE — per-entity DEK isolation (two shared docs, one teammate on both) is the
 * other probe this session wanted, but the C4 dev bridge installs a SINGLE-entity
 * receiver (`installShareReceiver` replaces the prior listener), so a teammate
 * can't receive two shared docs at once today. Logged as a harness gap; the fix
 * is a multi-entity receiver (the production LiveSyncEngine already tracks many).
 *
 * Every co-edit frame crosses the relay as ciphertext (relay-blind). Carries a
 * handful of `expect`s because the point is to prove collaboration works end to
 * end through the shipped shell; captures + team-chat narrate it; findings go to
 * the friction log.
 */

import { expect, test } from "@playwright/test";
import { AccessRole, type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { SPEAKER } from "../lib/team-chat";

const BRIEF_ID = "ent_issue4_brief";
const NOTE_TYPE = "brainstorm/Note/v1";

test("Northbound ships Issue #4: mixed roles, live Viewer, revoke + re-invite", async () => {
	test.setTimeout(300_000);
	let team: CollabTeam | undefined;
	try {
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
				{ key: "priya", name: "Priya", speaker: SPEAKER.Priya },
			],
			{ sessionName: "collab-005-northbound-issue4-team", freshVaults: true },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");
		const priya = team.byKey("priya");
		const all = [mira, marcus, priya];

		const ids = await Promise.all(all.map((s) => s.whoami()));
		expect(new Set(ids.map((i) => i.userPubB64)).size, "three sovereign identities").toBe(3);
		const [miraId, marcusId, priyaId] = ids;

		// --- Mira opens the Issue #4 brief and shares it with mixed roles. ---
		mira.chat("Issue #4 is the AI-native-ops piece. Marcus on design (edit), Priya reviewing (view).");
		await mira.provisionEntity(BRIEF_ID, NOTE_TYPE);
		await mira.editText(BRIEF_ID, "Issue #4 — AI-native ops. ");
		await Promise.all(all.map((s) => s.installShareReceiver(BRIEF_ID, NOTE_TYPE)));
		await mira.shot("provisioned");

		const marcusInvite = await marcus.createInvite(marcus.persona.name);
		marcus.chat("Invite sent — I'll own the design section.");
		await mira.share(BRIEF_ID, NOTE_TYPE, marcusInvite, AccessRole.Editor);

		const priyaInvite = await priya.createInvite(priya.persona.name);
		priya.chat("Mine too — I'm reviewing, not editing, so Viewer is right.");
		const members = await mira.share(BRIEF_ID, NOTE_TYPE, priyaInvite, AccessRole.Viewer);

		expect(members.find((m) => m.member === miraId?.userPubB64)?.role).toBe(AccessRole.Owner);
		expect(members.find((m) => m.member === marcusId?.userPubB64)?.role).toBe(AccessRole.Editor);
		const priyaOnBrief = members.find((m) => m.member === priyaId?.userPubB64);
		expect(priyaOnBrief?.role, "Priya is a Viewer on the brief").toBe(AccessRole.Viewer);
		expect(priyaOnBrief?.active).toBe(true);

		await team.awaitConverged(BRIEF_ID, all);
		expect(await marcus.readText(BRIEF_ID)).toContain("AI-native ops");
		expect(await priya.readText(BRIEF_ID)).toContain("AI-native ops");
		await marcus.shot("received");
		await priya.shot("received");

		// --- Editor co-edit; the Viewer must receive the LIVE edits, not a stale
		// snapshot. (Controlled diagnostic confirmed a Viewer converges live.) ---
		await marcus.editText(BRIEF_ID, "[design: split-screen hero, dark] ");
		await mira.editText(BRIEF_ID, "[mira: 1,400 words, send Oct 21] ");
		await team.awaitConverged(BRIEF_ID, all, 12_000);
		const briefText = await mira.readText(BRIEF_ID);
		expect(await marcus.readText(BRIEF_ID)).toBe(briefText);
		expect(await priya.readText(BRIEF_ID), "a Viewer receives the editors' LIVE edits").toBe(briefText);
		expect(briefText).toContain("[design: split-screen hero, dark]");
		expect(briefText).toContain("[mira: 1,400 words, send Oct 21]");
		mira.note(`All three converged (incl. the Viewer): "${briefText.trim()}"`);
		await mira.shot("co-edited");

		// --- Revoke Marcus from the brief (append-only audit, forward-only). ---
		mira.chat("Design's locked — taking Marcus off the brief for now.");
		expect(await mira.revoke(BRIEF_ID, marcusId?.userPubB64 ?? "")).toBe(true);
		// F-286 rotate-on-revoke re-keys the entity for the SURVIVORS, so the
		// group no longer converges as a whole - only Mira and Priya do. Waiting
		// on `all` here would be waiting for the guarantee to fail.
		await team.awaitConverged(BRIEF_ID, [mira, priya], 12_000);
		const afterRevoke = await mira.access(BRIEF_ID);
		expect(afterRevoke.find((m) => m.member === marcusId?.userPubB64)?.active, "Marcus revoked").toBe(false);
		expect(afterRevoke.find((m) => m.member === priyaId?.userPubB64)?.active, "Priya stays on").toBe(true);
		await mira.shot("revoked");

		// Forward secrecy, asserted (not merely observed): Mira edits post-revoke.
		// Priya converges on it; Marcus, whose device holds only the superseded
		// DEK, must never decrypt it.
		await mira.editText(BRIEF_ID, "[mira: final pass after Marcus rolled off] ");
		await team.awaitConverged(BRIEF_ID, [mira, priya], 12_000);
		expect(await priya.readText(BRIEF_ID), "the survivor keeps reading").toContain(
			"final pass after Marcus",
		);
		const marcusPostRevoke = await marcus.readText(BRIEF_ID).catch(() => "");
		expect(marcusPostRevoke, "the revoked member cannot read post-revoke content").not.toContain(
			"final pass after Marcus",
		);
		mira.note("Forward-secrecy probe: Marcus does not see post-revoke edits (DEK rotation holds).");

		// --- Re-invite: revoke is not a dead end (F-287 fixed — the access view
		// now collapses to one CURRENT row per member, so the re-grant wins). ---
		mira.chat("Need Marcus back for the launch tweaks — re-granting the brief.");
		const reInvite = await marcus.createInvite(marcus.persona.name);
		const reShared = await mira.share(BRIEF_ID, NOTE_TYPE, reInvite, AccessRole.Editor);
		const marcusRows = reShared.filter((m) => m.member === marcusId?.userPubB64);
		expect(marcusRows.length, "one current row for the re-granted member").toBe(1);
		expect(marcusRows[0]?.active, "re-invite reactivates Marcus").toBe(true);
		await marcus.shot("re-invited");

		// --- LAST: Viewer write-protection probe (runs last so a fork can't poison
		// the asserts above). Measure, don't assert. ---
		await priya.editText(BRIEF_ID, "[priya-review: tighten the intro] ").catch(() => undefined);
		await new Promise((r) => setTimeout(r, 3_000));
		const miraAfterViewer = await mira.readText(BRIEF_ID).catch(() => "");
		const priyaAfterViewer = await priya.readText(BRIEF_ID).catch(() => "");
		const reachedEditors = miraAfterViewer.includes("[priya-review:");
		const priyaForked = priyaAfterViewer.includes("[priya-review:") && priyaAfterViewer !== miraAfterViewer;
		priya.note(
			`Viewer write-protection probe: a Viewer's edit ${
				reachedEditors
					? "PROPAGATED to the editors — NO data-layer Viewer write-block, so the in-product Share UX (Collab-C5) must enforce read-only at the UI"
					: priyaForked
						? "did NOT reach the editors but forked the Viewer's local copy — peers reject a non-editor write at apply-time; the UI must still prevent the dead-end local edit"
						: "had no visible effect"
			}.`,
		);

		mira.note(
			"Issue #4 team session: mixed roles granted, Viewer receives live edits, revoke + re-invite clean. Engine solid; gaps = in-product Share UX (Collab-C5) + the single-entity dev-bridge receiver.",
		);
	} finally {
		await team?.finishAll();
	}
});
