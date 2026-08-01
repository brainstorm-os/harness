/**
 * P2P-1 — session 012: two of the user's own devices sync over the local
 * network with no server in the path.
 *
 * This is the hero claim of `0.12.0`, and it is the one the `P2P-0` spike found
 * was not achievable through the product: the Settings toggle controlled only
 * the HOST half, and the dial half read `syncRelay.lan` out of `vault.json`
 * where nothing outside tests ever wrote it. So a device could listen and no
 * device would ever call.
 *
 * The spec is deliberately structured so "no relay was involved" is a fact
 * rather than an assertion about intent:
 *
 *   1. Pair the two devices over a relay. Pairing needs a transport both ends
 *      already share, and the LAN transport's channel-bound admission refuses a
 *      device that is not yet on the roster — which a device being paired is
 *      not, by definition. So this phase legitimately uses a relay.
 *   2. **Stop the relay process and clear it from both vaults.** From here the
 *      relay is not merely unpreferred, it is not running and its address is
 *      not written anywhere. Anything that syncs after this point cannot have
 *      gone through it.
 *   3. Turn on LAN hosting on one device and LAN dialling on the other,
 *      through the same IPC the Settings panel calls.
 *   4. Assert both shells report `transportKind: "lan"` against a private
 *      address, and that an edit made on one appears on the other.
 *
 * Driven through the production surfaces (`pairing:*`, `sync-status:*`), not a
 * test-only bridge, so a green run is evidence about the shipped product.
 *
 * ---
 *
 * **STATUS: red at the CONVERGENCE step (phase 4), on a real product gap.
 * Read this before touching it — the transport half now passes.**
 *
 * Re-run 2026-08-01. Phases 1 to 3 pass, and so do every transport assertion in
 * phase 4: the shells pair, the relay process stops and is cleared from both
 * vaults, the desktop binds a real private address (`ws://192.168.2.50:56435`,
 * not loopback), the laptop's dial coordinator selects it, the host self-joins
 * its own listener in-process (`[lan-dial] target … (self-host)` →
 * `[lan-host] connection accepted (2 live)`), and both shells report
 * `transportKind: "lan"`. **"Two devices are on a server-less LAN link" is now
 * a fact this spec establishes.**
 *
 * It then fails moving data:
 *
 *     [dev:collab] receive failed: envelope-pipeline: no DEK for entity ent_lan_brief
 *
 * That is NOT a LAN problem and NOT a harness problem. **Nothing in production
 * ever hands a paired device an entity DEK.** Every production
 * `wrapDekForRecipient` call site addresses either *this* device
 * (`session.deviceX25519.publicKey`) or a *cross-user* member/invite key
 * resolved by user identity — under which two devices of one identity are the
 * same recipient. Pairing transfers the identity secret and writes roster
 * records, but no keys, and each device mints its own X25519 pair, so a wrap
 * sealed to device 1 cannot be opened by device 2. Stage `10.3b` shipped the
 * entire receive half (envelope kind, seq tracker, and an authorization branch
 * that explicitly admits a wrap from this same identity) and was marked done on
 * an E2E test that hand-builds the wrap production never builds. The missing
 * producer is plan rung **`10.3c`**; this spec is its acceptance test and
 * should go green when it lands, with no change here.
 *
 * **Two earlier diagnoses in this header were wrong and are recorded as such so
 * they are not re-derived.** (1) The two-vault / roster-never-converges theory:
 * fixed by shell #385 — pairing now records both devices and the roster is
 * re-read after it, so the channel-bound handshake admits. A two-DEVICE harness
 * primitive is NOT needed. (2) The host-never-joins theory: fixed by shell #394
 * — the host joins through `LanRelayHost.webSocketCtor()`, the in-process seam,
 * rather than dialling its own address over a socket (which was accepted and
 * then stalled between accepted and authenticated, and bought nothing when both
 * ends are one process).
 *
 * The one thing the first run caught as a product bug is fixed: the joining
 * device adopted the durable node's `127.0.0.1` address from the pairing payload
 * as a LAN peer, because the payload's single URL slot holds the relay's address
 * whenever a relay is configured. `parseLanPeerAddress(url, {allowLoopback:
 * false})` on the pairing path now refuses it, with a regression test in
 * `lan-dial-coordinator.test.ts`.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
	type CollabShell,
	type CollabTeam,
	launchCollabShell,
	startCollabTeam,
} from "../lib/collab-team";
import { type DurableNodeHandle, launchDurableNode } from "../lib/launch-durable-node";
import {
	LanDialMode,
	LanHostMode,
	awaitLanTransport,
	clearRelay,
	lanPeering,
	pairDevices,
	setDialMode,
	setHostMode,
	setPeerAddress,
	transportKind,
} from "../lib/lan-devices";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_lan_brief";
const ENTITY_TYPE = "brainstorm/Note/v1";
const SESSION = "collab-012-lan-two-devices";

test("two own devices sync over the local network with the relay stopped", async () => {
	test.setTimeout(420_000);
	const storageDir = mkdtempSync(join(tmpdir(), "bs-lan-node-"));
	let node: DurableNodeHandle | undefined;
	let team: CollabTeam | undefined;
	let desktop: CollabShell | undefined;
	let laptop: CollabShell | undefined;
	try {
		// --- Phase 1: pair the two devices. A relay carries this, and only this.
		node = await launchDurableNode({ storageDir });
		team = await startCollabTeam(
			[
				{ key: "mira", name: "Mira desktop", speaker: SPEAKER.Mira },
				{ key: "marcus", name: "Mira laptop", speaker: SPEAKER.Marcus },
			],
			{ sessionName: SESSION, freshVaults: true, relay: node },
		);
		desktop = team.byKey("mira");
		laptop = team.byKey("marcus");

		desktop.chat("Adding my laptop as a second device.");
		await pairDevices(desktop, laptop);
		laptop.note("Paired. Both machines are now devices of one identity.");

		// --- Phase 2: take the server away, entirely.
		await Promise.all([clearRelay(desktop), clearRelay(laptop)]);
		await node.stop();
		node = undefined;
		desktop.note("Relay stopped and cleared from both vaults. Nothing but the LAN is left.");

		// --- Phase 3: turn LAN sync on through the Settings IPC.
		await setHostMode(desktop, LanHostMode.WhenVaultOpen);
		const hostPeering = await lanPeering(desktop);
		expect(hostPeering?.listenerUrl, "the desktop is listening on a private address").toMatch(
			/^ws:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/,
		);
		desktop.chat(`Accepting connections on ${hostPeering?.listenerUrl}.`);
		await desktop.shot("lan-host-on");

		// Automatic discovery first — this is the path a user actually takes.
		await setDialMode(laptop, LanDialMode.Auto);
		let dialed = await awaitLanTransport(laptop, 30_000).catch(() => null);
		if (!dialed) {
			// Multicast is filtered on plenty of networks, and CI runners are one
			// of them, so the manual path is a first-class fallback rather than a
			// workaround. Both go through the same dial coordinator.
			laptop.note("No mDNS record inside 30 s — falling back to the typed address.");
			await setDialMode(laptop, LanDialMode.Manual);
			await setPeerAddress(laptop, hostPeering?.listenerUrl ?? "");
			dialed = await awaitLanTransport(laptop, 30_000);
		}

		// --- Phase 4: the claim, checked.
		expect(await transportKind(laptop), "laptop is on the LAN transport").toBe("lan");
		const peering = await lanPeering(laptop);
		expect(peering?.activeUrl, "and it is dialling the desktop's private address").toBe(
			hostPeering?.listenerUrl,
		);
		await laptop.shot("lan-dialled");

		await desktop.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await Promise.all(
			[desktop, laptop].map((s) => s.installShareReceiver(ENTITY_ID, ENTITY_TYPE)),
		);
		await desktop.editText(ENTITY_ID, "Written on the desktop, over the LAN. ");
		await team.awaitConverged(ENTITY_ID, [desktop, laptop], 30_000);
		expect(await laptop.readText(ENTITY_ID)).toContain("Written on the desktop, over the LAN");

		await laptop.editText(ENTITY_ID, "[laptop: and back again] ");
		await team.awaitConverged(ENTITY_ID, [desktop, laptop], 30_000);
		expect(await desktop.readText(ENTITY_ID)).toContain("[laptop: and back again]");

		// The evidence that the relay was not used, restated as a fact: the
		// process is stopped, both vaults have no `syncRelay`, and the live
		// transport on each side names the other's private address.
		expect(await transportKind(desktop)).toBe("lan");
		laptop.note(
			"Converged in both directions with the relay process stopped and no syncRelay in either vault. Local network only.",
		);
		await laptop.shot("lan-converged");
	} finally {
		await laptop?.finish();
		await desktop?.finish();
		await team?.finishAll();
		await node?.stop();
		rmSync(storageDir, { recursive: true, force: true });
	}
});
