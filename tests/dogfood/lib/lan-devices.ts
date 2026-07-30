/**
 * P2P-1 — the LAN half of the two-shell harness.
 *
 * Everything here drives the PRODUCTION IPC the Settings panel calls
 * (`sync-status:*`) and the production pairing surface (`pairing:*`). There is
 * deliberately no test-only bridge for LAN: the finding this rung exists to fix
 * is that the feature was unreachable through the product, so a harness that
 * reached past the product would prove nothing.
 */

import type { Page } from "@playwright/test";
import type { CollabShell } from "./collab-team";

/** Mirrors `@brainstorm-os/protocol` — the harness must not import from the
 *  shell's source tree, so the two string tables are kept side by side and the
 *  spec fails loudly if they ever drift. */
export enum LanHostMode {
	Off = "off",
	WhenVaultOpen = "when-vault-open",
}

export enum LanDialMode {
	Off = "off",
	Auto = "auto",
	Manual = "manual",
}

export type LanPeeringSnapshot = {
	dialMode: string;
	manualUrl: string | null;
	activeUrl: string | null;
	listenerUrl: string | null;
	peers: { instance: string; urls: string[] }[];
};

type SyncStatusBridge = {
	snapshot: () => Promise<{ transportKind?: string } | null>;
	getLanHostMode: () => Promise<string | null>;
	setLanHostMode: (mode: string) => Promise<string | null>;
	getLanPeering: () => Promise<LanPeeringSnapshot | null>;
	setLanDialMode: (mode: string) => Promise<LanPeeringSnapshot | null>;
	setLanPeerAddress: (raw: string | null) => Promise<LanPeeringSnapshot | null>;
};

type PairingBridge = {
	startAddDevice: (args: { mode: "qr" }) => Promise<{ payload: string; requestId: string }>;
	scanPayload: (args: { payload: string }) => Promise<{ requestId: string }>;
	confirmSas: (args: { requestId: string }) => Promise<unknown>;
};

type LanWindow = {
	brainstorm: {
		syncStatus: SyncStatusBridge;
		pairing: PairingBridge;
		dev: { setSyncRelay: (url: string | null) => Promise<{ changed: boolean }> };
	};
};

const page = (shell: CollabShell): Page => shell.dashboard;

export async function setHostMode(shell: CollabShell, mode: LanHostMode): Promise<string | null> {
	return page(shell).evaluate(
		(m) => (window as unknown as LanWindow).brainstorm.syncStatus.setLanHostMode(m),
		mode as string,
	);
}

export async function setDialMode(
	shell: CollabShell,
	mode: LanDialMode,
): Promise<LanPeeringSnapshot | null> {
	return page(shell).evaluate(
		(m) => (window as unknown as LanWindow).brainstorm.syncStatus.setLanDialMode(m),
		mode as string,
	);
}

/** Resolves `null` when the address does not validate — a refusal to store, not
 *  a failed write. The spec treats that as a hard failure. */
export async function setPeerAddress(
	shell: CollabShell,
	address: string,
): Promise<LanPeeringSnapshot> {
	const saved = await page(shell).evaluate(
		(a) => (window as unknown as LanWindow).brainstorm.syncStatus.setLanPeerAddress(a),
		address,
	);
	if (!saved) throw new Error(`lan-devices: refused peer address ${address}`);
	return saved;
}

export async function lanPeering(shell: CollabShell): Promise<LanPeeringSnapshot | null> {
	return page(shell).evaluate(() =>
		(window as unknown as LanWindow).brainstorm.syncStatus.getLanPeering(),
	);
}

export async function transportKind(shell: CollabShell): Promise<string | null> {
	const snap = await page(shell).evaluate(() =>
		(window as unknown as LanWindow).brainstorm.syncStatus.snapshot(),
	);
	return snap?.transportKind ?? null;
}

/** Remove the relay from `vault.json` so nothing can fall back to it. */
export async function clearRelay(shell: CollabShell): Promise<void> {
	await page(shell).evaluate(() =>
		(window as unknown as LanWindow).brainstorm.dev.setSyncRelay(null),
	);
}

/**
 * Wait until the live transport is the LAN one.
 *
 * Polled rather than pushed because a dial is genuinely asynchronous: an mDNS
 * record arrives when it arrives, the connect has a 3 s deadline, and the
 * channel-bound handshake runs after that. Throws on timeout so a spec fails
 * with "never reached the LAN transport" rather than a confusing downstream
 * convergence timeout.
 */
export async function awaitLanTransport(shell: CollabShell, timeoutMs: number): Promise<string> {
	const deadline = Date.now() + timeoutMs;
	let last: string | null = null;
	while (Date.now() < deadline) {
		last = await transportKind(shell);
		if (last === "lan") {
			const peering = await lanPeering(shell);
			if (peering?.activeUrl) return peering.activeUrl;
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`lan-devices: transport never became 'lan' within ${timeoutMs}ms (last=${last})`);
}

/**
 * Run the QR pairing flow from `source` to `target` over whatever transport
 * both currently share.
 *
 * `confirmSas` is target-side only — the source's state machine reaches Paired
 * on its own once it has sent the sealed identity; calling it on the source
 * rejects with "is not a target-side pairing".
 */
export async function pairDevices(source: CollabShell, target: CollabShell): Promise<void> {
	const started = await page(source).evaluate(() =>
		(window as unknown as LanWindow).brainstorm.pairing.startAddDevice({ mode: "qr" }),
	);
	// The source's `relay.subscribe(channelId)` is a control message the relay
	// must process before it can route the target's JoinRequest back. There is
	// no subscribe-ack, so a small settle is the only race-tight option.
	await new Promise((r) => setTimeout(r, 500));
	const scanned = await page(target).evaluate(
		(payload) => (window as unknown as LanWindow).brainstorm.pairing.scanPayload({ payload }),
		started.payload,
	);
	await page(target).evaluate(
		(requestId) => (window as unknown as LanWindow).brainstorm.pairing.confirmSas({ requestId }),
		scanned.requestId,
	);
}
