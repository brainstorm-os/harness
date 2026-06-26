/**
 * Collab-C4-live — session 006: per-entity DEK isolation across two shared docs.
 *
 * Unblocked by the multi-entity dev-bridge receiver (F-289): a teammate can now
 * hold live subscriptions to several shared docs at once. This dogfoods the
 * per-entity-DEK promise from 16-identity-orgs-encryption.md end to end —
 * revoking a teammate from ONE entity must not touch their access to ANOTHER.
 *
 *   1. Mira shares TWO docs with Marcus (the Issue #4 brief + a CRM-strategy
 *      note), both Editor; both converge and take live edits (proves the
 *      multi-entity receiver works through the shell).
 *   2. Mira revokes Marcus from the BRIEF only.
 *   3. ISOLATION: the CRM note is untouched — Marcus stays active on it and a
 *      fresh CRM edit still reaches him; the revoke rotated/affected only the
 *      brief's per-entity DEK.
 *
 * Bridge frames are ciphertext (relay-blind). Captures + team-chat narrate it;
 * findings go to the friction log.
 */

import { expect, test } from "@playwright/test";
import { AccessRole, type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { SPEAKER } from "../lib/team-chat";

const BRIEF_ID = "ent_iso_brief";
const CRM_ID = "ent_iso_crm";
const NOTE_TYPE = "brainstorm/Note/v1";

test("Per-entity DEK isolation: revoking one shared doc leaves the other intact", async () => {
	test.setTimeout(240_000);
	let team: CollabTeam | undefined;
	try {
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
			],
			{ sessionName: "collab-006-per-entity-isolation", freshVaults: true },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");
		const both = [mira, marcus];

		const ids = await Promise.all(both.map((s) => s.whoami()));
		expect(new Set(ids.map((i) => i.userPubB64)).size, "two sovereign identities").toBe(2);
		const [miraId, marcusId] = ids;

		// --- Mira shares two separate docs with Marcus (both Editor). ---
		mira.chat("Bringing Marcus onto two things at once — the Issue #4 brief and the CRM plan.");
		await mira.provisionEntity(BRIEF_ID, NOTE_TYPE);
		await mira.editText(BRIEF_ID, "Issue #4 brief. ");
		await mira.provisionEntity(CRM_ID, NOTE_TYPE);
		await mira.editText(CRM_ID, "CRM strategy. ");
		// Multi-entity receiver: installing CRM must NOT drop the brief (F-289 fix).
		await Promise.all(both.map((s) => s.installShareReceiver(BRIEF_ID, NOTE_TYPE)));
		await Promise.all(both.map((s) => s.installShareReceiver(CRM_ID, NOTE_TYPE)));

		await mira.share(BRIEF_ID, NOTE_TYPE, await marcus.createInvite(marcus.persona.name), AccessRole.Editor);
		await mira.share(CRM_ID, NOTE_TYPE, await marcus.createInvite(marcus.persona.name), AccessRole.Editor);

		// Both docs converge — Marcus holds two live subscriptions at once.
		await team.awaitConverged(BRIEF_ID, both);
		await team.awaitConverged(CRM_ID, both);
		expect(await marcus.readText(BRIEF_ID)).toContain("Issue #4 brief");
		expect(await marcus.readText(CRM_ID)).toContain("CRM strategy");
		await mira.shot("two-docs-shared");

		// Live edits to BOTH after sharing — both still converge for Marcus.
		await mira.editText(BRIEF_ID, "[brief: design locked] ");
		await mira.editText(CRM_ID, "[crm: 12 leads queued] ");
		await team.awaitConverged(BRIEF_ID, both);
		await team.awaitConverged(CRM_ID, both);
		expect(await marcus.readText(BRIEF_ID)).toContain("[brief: design locked]");
		expect(await marcus.readText(CRM_ID)).toContain("[crm: 12 leads queued]");
		mira.note("Multi-entity receiver works: Marcus holds the brief AND the CRM note live at once.");

		// --- Revoke Marcus from the BRIEF only. ---
		mira.chat("Design's done — taking Marcus off the brief, but he keeps the CRM plan.");
		expect(await mira.revoke(BRIEF_ID, marcusId?.userPubB64 ?? "")).toBe(true);

		// --- ISOLATION ASSERTS: the CRM note is wholly unaffected. ---
		const briefAccess = await mira.access(BRIEF_ID);
		const crmAccess = await mira.access(CRM_ID);
		expect(briefAccess.find((m) => m.member === marcusId?.userPubB64)?.active, "Marcus off the brief").toBe(false);
		expect(
			crmAccess.find((m) => m.member === marcusId?.userPubB64)?.active,
			"ISOLATION: Marcus stays active on the CRM note after the brief revoke",
		).toBe(true);

		// A fresh CRM edit still reaches Marcus (the CRM DEK + subscription survived).
		await mira.editText(CRM_ID, "[crm: send sequence Thu] ");
		await team.awaitConverged(CRM_ID, both, 12_000);
		expect(await marcus.readText(CRM_ID), "CRM collaboration continues after the brief revoke").toContain(
			"[crm: send sequence Thu]",
		);
		mira.note(
			"Per-entity DEK isolation holds: revoking the brief left the CRM note fully live for Marcus (separate DEK, separate access record).",
		);
		await mira.shot("isolation-verified");
	} finally {
		await team?.finishAll();
	}
});
