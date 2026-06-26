/**
 * Collab-C4-live — session 007: a 4-person planning sprint under heavy
 * concurrent contention.
 *
 * Everything so far co-edited gently (a couple of edits each). A real planning
 * call is four people typing into the same doc at once. This stresses two things
 * the earlier sessions don't: relay FAN-OUT to four subscribers, and CRDT MERGE
 * under sustained concurrent contention.
 *
 * Mira owns a Q3 plan and shares it with Marcus, Priya, and Dana (all Editors).
 * Then all four run rounds of simultaneous appends (`Promise.all` across the
 * team each round). The persisted Y.Docs must converge to a single text that
 * carries every one of the 4 × ROUNDS contributions, identical on every shell.
 *
 * Bridge frames are ciphertext (relay-blind). Captures + team-chat narrate it;
 * findings go to the friction log.
 */

import { expect, test } from "@playwright/test";
import { AccessRole, type CollabShell, type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { SPEAKER } from "../lib/team-chat";

const PLAN_ID = "ent_q3_plan";
const NOTE_TYPE = "brainstorm/Note/v1";
const ROUNDS = 5;

test("Four teammates co-edit the Q3 plan under heavy concurrent contention", async () => {
	test.setTimeout(300_000);
	let team: CollabTeam | undefined;
	try {
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
				{ key: "priya", name: "Priya", speaker: SPEAKER.Priya },
				{ key: "dana", name: "Dana", speaker: SPEAKER.Dana },
			],
			{ sessionName: "collab-007-team-contention", freshVaults: true },
		);
		const mira = team.byKey("mira");
		const editors: CollabShell[] = ["marcus", "priya", "dana"].map((k) => team!.byKey(k));
		const all = [mira, ...editors];

		const ids = await Promise.all(all.map((s) => s.whoami()));
		expect(new Set(ids.map((i) => i.userPubB64)).size, "four sovereign identities").toBe(4);

		// Mira opens the plan and shares it with all three teammates as Editors.
		mira.chat("Q3 planning call — everyone in the same doc. Sharing the plan with all of you.");
		await mira.provisionEntity(PLAN_ID, NOTE_TYPE);
		await mira.editText(PLAN_ID, "Q3 plan. ");
		await Promise.all(all.map((s) => s.installShareReceiver(PLAN_ID, NOTE_TYPE)));
		for (const e of editors) {
			await mira.share(PLAN_ID, NOTE_TYPE, await e.createInvite(e.persona.name), AccessRole.Editor);
		}
		await team.awaitConverged(PLAN_ID, all, 12_000);
		for (const e of editors) expect(await e.readText(PLAN_ID)).toContain("Q3 plan");
		await mira.shot("shared-four-way");

		// Contention: every round, all four append simultaneously. Each marker is
		// unique (persona key + round) so we can prove not one was lost in the merge.
		mira.chat("Go — everyone add your lines.");
		for (let round = 1; round <= ROUNDS; round++) {
			await Promise.all(all.map((s) => s.editText(PLAN_ID, `[${s.persona.key}-${round}] `)));
		}
		await team.awaitConverged(PLAN_ID, all, 25_000);

		// Every shell converged to the SAME text, and it carries all 4 x ROUNDS markers.
		const canonical = await mira.readText(PLAN_ID);
		for (const s of all) expect(await s.readText(PLAN_ID), `${s.persona.key} converged`).toBe(canonical);
		let present = 0;
		for (const s of all) {
			for (let round = 1; round <= ROUNDS; round++) {
				if (canonical.includes(`[${s.persona.key}-${round}]`)) present += 1;
			}
		}
		const expectedMarkers = all.length * ROUNDS;
		expect(present, "every concurrent contribution survived the merge").toBe(expectedMarkers);
		mira.note(
			`Four-way contention: ${expectedMarkers} concurrent edits across ${ROUNDS} rounds all merged; every shell byte-identical. Final length ${canonical.length} chars.`,
		);
		await mira.shot("converged");
	} finally {
		await team?.finishAll();
	}
});
