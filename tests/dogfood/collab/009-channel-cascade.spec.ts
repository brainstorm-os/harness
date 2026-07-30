/**
 * Collab-C5 collection-sharing (design 71) — the M1 keystone on real shells.
 *
 * Where 001–008 share a SINGLE doc, this proves the cascade: Mira shares a chat
 * **Channel** (a collection) with Marcus via `shareCollection`, and the grant +
 * per-entity DEK cascade onto EVERY message in the channel — so Marcus receives
 * the whole conversation, not just the channel shell. Two real Electron shells,
 * two sovereign identities, over the live relay; the relay stays blind.
 *
 * Owner-side: every message's signed access record names Marcus (the cascade
 * ran). Cross-vault: Marcus's shell auto-receives each cascaded child through
 * the production `LiveSyncEngine` inbox path (the child wraps land on his inbox
 * → speculative pre-register → DEK install → state converges) — no per-message
 * receiver call, exactly as a real teammate would.
 *
 * ⚠️ KNOWN FAILURE, 2026-07-31 - this spec fails on `ent_msg_followup` and the
 * failure is real, deterministic, and correctly located here.
 *
 * The F-288 bootstrap deadlock that used to break this at the very first entity
 * is fixed (see `main/collab/share-bootstrap-authz.test.ts`); the channel and
 * one of the two messages now converge. What remains is the **initial-state
 * gap** on the cross-user inbox path: the owner emits a child's full state
 * immediately after that child's `WrapBootstrap`, but the receiver only
 * subscribes the child's own channel once the wrap has resolved, so a
 * forward-only relay drops whatever falls in between. The relay audit shows it
 * exactly - `ent_msg_followup` is forwarded its wrap and never an update, on
 * every run.
 *
 * The mechanism design 71 §flow-1 nominates to close it is the durable node's
 * snapshot+tail backfill on subscribe (`SYNC-0..5`). That cannot be used yet:
 * the production node **ignores the Collab-C5 `route` inbox override** the
 * shell's own relay server honours, so pointing this spec at the node is
 * strictly worse - no wrap reaches the receiver at all and even the channel
 * stops converging (measured). Closing this is one of:
 *   (a) teach `../brainstorm-sync` to fan by `route ?? entityId` (already filed
 *       on the `10.11` bullet as a small own PR), then run this against the
 *       node like session 003; or
 *   (b) give the receiver a state request after it subscribes, so the owner
 *       need not guess when the subscription landed.
 * Both are rungs of their own. Leaving this spec asserting the full guarantee
 * is deliberate: it is the M1 keystone, and it should stay red until a team's
 * whole channel really does arrive.
 */

import { expect, test } from "@playwright/test";
import { AccessRole, type CollabTeam, startCollabTeam } from "../lib/collab-team";
import { SPEAKER } from "../lib/team-chat";

const CHANNEL = "ent_chan_general";
const CHANNEL_TYPE = "io.brainstorm.chat/Channel/v1";
const MESSAGE_TYPE = "brainstorm/Message/v1";
const MSG_1 = "ent_msg_kickoff";
const MSG_2 = "ent_msg_followup";

test("Mira shares the #general channel; the cascade carries every message to Marcus", async () => {
	test.setTimeout(300_000);
	let team: CollabTeam | undefined;
	try {
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Marcus", speaker: SPEAKER.Marcus },
			],
			{ sessionName: "collab-009-channel-cascade", freshVaults: true },
		);
		const mira = team.byKey("mira");
		const marcus = team.byKey("marcus");

		const ids = await Promise.all([mira.whoami(), marcus.whoami()]);
		expect(new Set(ids.map((i) => i.userPubB64)).size, "two distinct identities").toBe(2);
		const marcusPub = ids[1]?.userPubB64 ?? "";

		// Mira builds a channel with two messages BEFORE sharing.
		mira.chat("Spinning up #general with a couple of messages, then sharing the whole channel.");
		await mira.provisionEntity(CHANNEL, CHANNEL_TYPE, { name: "general" });
		await mira.provisionEntity(MSG_1, MESSAGE_TYPE, { conversation: CHANNEL, body: "Kickoff at 10." });
		await mira.provisionEntity(MSG_2, MESSAGE_TYPE, { conversation: CHANNEL, body: "Agenda in the doc." });
		// Mira tracks the channel + its messages so her edits emit (the receiver
		// is the live-sync subscription; Marcus needs no per-message receiver).
		for (const [id, type] of [
			[CHANNEL, CHANNEL_TYPE],
			[MSG_1, MESSAGE_TYPE],
			[MSG_2, MESSAGE_TYPE],
		] as const) {
			await mira.installShareReceiver(id, type);
		}
		await mira.shot("channel-built");

		// Share the COLLECTION — one action, cascades to both messages.
		const invite = await marcus.createInvite("Marcus");
		marcus.chat("Got the invite — joining #general.");
		await mira.shareCollection(CHANNEL, CHANNEL_TYPE, invite, AccessRole.Editor);
		await mira.shot("channel-shared");

		// Owner-side: the cascade granted Marcus on the channel AND every message.
		for (const id of [CHANNEL, MSG_1, MSG_2]) {
			const members = await mira.access(id);
			const m = members.find((x) => x.member === marcusPub);
			expect(m?.active, `Marcus active on ${id} (cascade)`).toBe(true);
			expect(m?.role).toBe(AccessRole.Editor);
		}

		// Cross-vault: Marcus's shell auto-received the channel + both messages via
		// the production inbox path — his persisted access record names him on each.
		await team.awaitConverged(CHANNEL, [mira, marcus]);
		await team.awaitConverged(MSG_1, [mira, marcus]);
		await team.awaitConverged(MSG_2, [mira, marcus]);
		for (const id of [CHANNEL, MSG_1, MSG_2]) {
			const members = await marcus.access(id);
			expect(members.some((x) => x.member === marcusPub && x.active), `Marcus received ${id}`).toBe(
				true,
			);
		}
		marcus.chat("All of #general synced — channel + both messages. The cascade works.");
		await marcus.shot("channel-received");
	} finally {
		await team?.finishAll();
	}
});
