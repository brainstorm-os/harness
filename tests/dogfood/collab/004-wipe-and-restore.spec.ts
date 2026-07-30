/**
 * Stage 10.14 — **restore-from-zero (cold device, keystore-intact)** — the named
 * real-shell gate for 10.14. Until now the `RestoreEngine` was unit-tested only;
 * this dogfoods the full product loop against the REAL `../brainstorm-sync`
 * durable node (SYNC-2):
 *
 *   1. Mira owns a Note and shares it with Marcus; both co-edit through the node,
 *      which durably persists the encrypted snapshot+tail + Marcus's WrapBootstrap.
 *   2. Marcus's local vault is WIPED — `vault/data/entities.db` + the `docs/`
 *      Y.Doc store are deleted — while his **keystore stays intact** (his X25519 /
 *      master key, in `<userData>`, untouched). This is the keystore-intact cold
 *      device: it still holds its identity but has lost all entity data.
 *   3. Marcus relaunches → the shell offers restore (`entities.db` empty + a
 *      reachable durable node) → `syncStatus.restore()` drives
 *      catalog → `wraps ++ snapshot ++ tail` backfill → DEK re-sealed under the
 *      master key → row materialised + index rebuilt.
 *   4. The Note's text re-materialises byte-identically to the pre-wipe content.
 *
 * The recipient (Marcus), not the owner (Mira), is the restoring device on
 * purpose: `shareEntityWithInvite` seals the DEK to the **recipient's** X25519
 * and the node retains that wrap, so a wiped recipient recovers the DEK from
 * backfill with its own key — exactly the implemented path. (The owner emitting a
 * self-wrap for solo-vault backup is a noted 10.14 follow-on.)
 *
 * **Stage 10.13 rider:** Marcus's selective-sync policy is set to `Pinned` before
 * the wipe and re-read after relaunch — proving the device-local policy
 * (`<userData>/selective-sync.json`, outside the wiped `vault/data`) survives a
 * full vault wipe + relaunch. Restore itself is policy-independent
 * (`trackForRestore` is ungated), so the two assertions don't interfere.
 */

import { rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { RestoreSummary } from "../../../packages/shell/src/preload/index";
import {
	SelectiveSyncMode,
	type SelectiveSyncPolicy,
} from "../../../packages/protocol/src/selective-sync-types";
import {
	AccessRole,
	COLLAB_DATA_ROOT,
	type CollabShell,
	type CollabTeam,
	launchCollabShell,
	startCollabTeam,
} from "../lib/collab-team";
import { type DurableNodeHandle, launchDurableNode } from "../lib/launch-durable-node";
import { SPEAKER } from "../lib/team-chat";

const ENTITY_ID = "ent_restore_brief";
const ENTITY_TYPE = "brainstorm/Note/v1";
const SESSION = "collab-004-wipe-and-restore";

/** Where a persona's `entities.db` + `docs/` Y.Doc store live (the wipe target).
 *  The keystore (`selective-sync.json`, credentials) sits one level up in the
 *  user-data dir and is deliberately NOT under here. */
function vaultDataDir(personaKey: string): string {
	return join(COLLAB_DATA_ROOT, personaKey, "vault", "data");
}

/** Drive a `window.brainstorm.syncStatus.*` call from a shell's dashboard. */
function syncStatus<T>(shell: CollabShell, fn: string, arg?: unknown): Promise<T> {
	return shell.dashboard.evaluate(
		({ f, a }) => {
			const api = (
				window as unknown as {
					brainstorm: { syncStatus: Record<string, (x?: unknown) => Promise<unknown>> };
				}
			).brainstorm.syncStatus;
			return a === undefined ? api[f]?.() : api[f]?.(a);
		},
		{ f: fn, a: arg },
	) as Promise<T>;
}

test("Marcus wipes his vault (keystore intact) and restores from the durable node", async () => {
	test.setTimeout(300_000);
	const storageDir = mkdtempSync(join(tmpdir(), "bs-restore-node-"));
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
		let marcus = team.byKey("marcus");

		// 1. Mira seeds + shares the brief; both co-edit through the durable node.
		mira.chat("Sharing the Q3 brief with Marcus — then he'll wipe his vault and restore it.");
		await mira.provisionEntity(ENTITY_ID, ENTITY_TYPE);
		await mira.editText(ENTITY_ID, "Restore brief — Q3. ");
		await Promise.all([mira, marcus].map((s) => s.installShareReceiver(ENTITY_ID, ENTITY_TYPE)));

		const invite = await marcus.createInvite(marcus.persona.name);
		const members = await mira.share(ENTITY_ID, ENTITY_TYPE, invite, AccessRole.Editor);
		expect(members.find((m) => m.active && m.role === AccessRole.Editor)).toBeTruthy();

		await Promise.all([
			mira.editText(ENTITY_ID, "[mira: keep this] "),
			marcus.editText(ENTITY_ID, "[marcus: and this] "),
		]);
		await team.awaitConverged(ENTITY_ID, [mira, marcus], 15_000);

		const originalText = await marcus.readText(ENTITY_ID);
		expect(originalText).toBe(await mira.readText(ENTITY_ID));
		expect(originalText).toContain("[mira: keep this]");
		expect(originalText).toContain("[marcus: and this]");
		await marcus.shot("before-wipe");

		// 10.13 rider — set Marcus's device-local selective-sync policy to Pinned.
		// It persists to `<userData>/selective-sync.json`, OUTSIDE vault/data, so
		// it must survive the wipe + relaunch below.
		const pinnedPolicy: SelectiveSyncPolicy = {
			mode: SelectiveSyncMode.Pinned,
			recentDays: 30,
		};
		const setBack = await syncStatus<SelectiveSyncPolicy | null>(marcus, "setPolicy", pinnedPolicy);
		expect(setBack?.mode).toBe(SelectiveSyncMode.Pinned);

		// 2. Close Marcus's shell, then WIPE his entities.db + docs/ — keystore
		//    (selective-sync.json, credentials, vault.json) left intact.
		marcus.chat("Wiping my entities.db + doc store — keeping my keys. Cold-restore time.");
		await marcus.finish();
		const dataDir = vaultDataDir("marcus");
		for (const f of ["entities.db", "entities.db-wal", "entities.db-shm"]) {
			rmSync(join(dataDir, f), { force: true });
		}
		rmSync(join(dataDir, "docs"), { recursive: true, force: true });

		// 3. Relaunch Marcus against the SAME user-data dir (keystore intact).
		marcusReborn = await launchCollabShell(marcus.persona, node.url, SESSION, false);
		marcus = marcusReborn;

		// 10.13 — the device-local policy survived the wipe + relaunch.
		const afterRelaunch = await syncStatus<SelectiveSyncPolicy | null>(marcus, "getPolicy");
		expect(afterRelaunch?.mode).toBe(SelectiveSyncMode.Pinned);
		expect(afterRelaunch?.recentDays).toBe(30);

		// 4. The shell offers restore: entities.db is empty + the node is reachable.
		const available = await syncStatus<boolean>(marcus, "restoreAvailable");
		expect(available).toBe(true);
		await marcus.shot("restore-available");

		// 5. Drive the cold restore: catalog → wraps ++ snapshot ++ tail → row + reindex.
		const summary = await syncStatus<RestoreSummary>(marcus, "restore");
		expect(summary.requested).toBeGreaterThan(0);
		expect(summary.entityIds).toContain(ENTITY_ID);
		expect(summary.restored).toBeGreaterThan(0);
		expect(summary.complete).toBe(true);

		// 6. The brief came back from the node — DEK recovered, doc re-materialised.
		const restoredText = await marcus.readText(ENTITY_ID);
		expect(restoredText).toBe(originalText);
		await marcus.shot("after-restore");
		marcus.note(
			`Cold-restored ${summary.restored}/${summary.requested} entit${
				summary.requested === 1 ? "y" : "ies"
			}; the brief re-materialised to "${restoredText.trim()}". Selective-sync policy survived the wipe (mode=${afterRelaunch?.mode}).`,
		);
		marcus.chat(`Restored from zero — the brief reads "${restoredText.trim()}" again.`);

		// 7. Restore is no longer offered once the vault is repopulated.
		const stillAvailable = await syncStatus<boolean>(marcus, "restoreAvailable");
		expect(stillAvailable).toBe(false);
	} finally {
		await marcusReborn?.finish();
		await team?.finishAll();
		await node?.stop();
		rmSync(storageDir, { recursive: true, force: true });
	}
});
