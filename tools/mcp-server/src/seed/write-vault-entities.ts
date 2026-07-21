/**
 * Seeder write path: in-memory kv blobs → `entities.db` direct via the
 * canonical `EntitiesRepository` SQL surface. Replaces the per-app
 * `writeXxxKv` chain for entity-bearing data (9.3.5 seeder slice).
 *
 * The seeder writes directly to `entities.db` (the same surface the apps
 * read from via `services.vaultEntities.list`). A reseed lands in the
 * canonical store immediately; running apps see fresh data on the next
 * `vaultEntities.onChange`.
 *
 * All seeded apps — including Notes — project here. Notes' rich bodies
 * already land as on-disk `.ydoc` files (via `materializeSeededNote`); the
 * `notes` blob carries the `note:<id>` rows (title/icon/snippet/about) that
 * become Note/v1 entity rows + mention/link edges. `entities.db` is the
 * sole route seeded content reaches the apps.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
	applySeederSnapshot,
	writeSeedSidecar,
} from "../../../../packages/shell/src/main/entities/seed-snapshot";
import type { VaultEntitiesSnapshot } from "../../../../packages/shell/src/main/entities/vault-entities-service";
import { EntitiesRepository } from "../../../../packages/shell/src/main/storage/entities-repo";
import { ENTITIES_MIGRATIONS } from "../../../../packages/shell/src/main/storage/entities-schema";
import { applyMigrations } from "../../../../packages/shell/src/main/storage/migrations";
import { open as openSqlite } from "../../../../packages/sqlite/src/sqlite";
import {
	projectBookmarksFromBlob,
	projectCalendarFromBlob,
	projectNotesFromBlob,
	projectSelfHostingFromBlob,
	projectTasksFromBlob,
	projectWhiteboardFromBlob,
} from "./kv-blob-projectors";

export interface SeederBlobs {
	tasks?: Record<string, unknown>;
	calendar?: Record<string, unknown>;
	bookmarks?: Record<string, unknown>;
	whiteboard?: Record<string, unknown>;
	selfHosting?: Record<string, unknown>;
	notes?: Record<string, unknown>;
}

export interface WriteStats {
	entitiesCreated: number;
	entitiesUpdated: number;
	linksWritten: number;
	/** Previously-seeded entities removed because they dropped out of this
	 *  reseed's snapshot — see `applySeederSnapshot`. Zero on the
	 *  sidecar-deferred path (the shell does the reconcile when it drains). */
	entitiesRemoved: number;
	/** True when the snapshot was handed to the shell via the seed sidecar
	 *  instead of being written here — the vault's `entities.db` is encrypted
	 *  and this (Bun) process has no SQLCipher driver. The shell drains the
	 *  sidecar in-process on the next reseed / boot. */
	deferredToSidecar: boolean;
	/** Total entities + links projected, regardless of write path. Lets the
	 *  CLI report what was seeded even when the write deferred to the shell. */
	entitiesProjected: number;
	linksProjected: number;
}

/**
 * Project the per-app blobs into a single entity snapshot via the
 * `kv-blob-projectors`, then upsert into `<vault>/entities.db`.
 * Idempotent: re-running with the same blobs is a no-op modulo the
 * `updated_at` bump.
 *
 * Encrypted vaults — every dev vault once the SQLCipher driver builds — can't
 * be opened from this Bun process (no SQLCipher). For those the projected
 * snapshot is written to the seed sidecar (`writeSeedSidecar`) and the shell
 * applies it in-process with the master key. Plaintext / legacy vaults are
 * written directly here.
 */
export async function writeVaultEntities(
	vaultPath: string,
	blobs: SeederBlobs,
	opts: { deferToSidecar?: boolean } = {},
): Promise<WriteStats> {
	const snapshot: VaultEntitiesSnapshot = { entities: [], links: [] };
	if (blobs.tasks) projectTasksFromBlob(blobs.tasks, snapshot);
	if (blobs.calendar) projectCalendarFromBlob(blobs.calendar, snapshot);
	if (blobs.bookmarks) projectBookmarksFromBlob(blobs.bookmarks, snapshot);
	if (blobs.whiteboard) projectWhiteboardFromBlob(blobs.whiteboard, snapshot);
	if (blobs.selfHosting) projectSelfHostingFromBlob(blobs.selfHosting, snapshot);
	if (blobs.notes) projectNotesFromBlob(blobs.notes, snapshot);

	const entitiesProjected = snapshot.entities.length;
	const linksProjected = snapshot.links.length;
	if (entitiesProjected === 0 && linksProjected === 0) {
		return {
			entitiesCreated: 0,
			entitiesUpdated: 0,
			linksWritten: 0,
			entitiesRemoved: 0,
			deferredToSidecar: false,
			entitiesProjected,
			linksProjected,
		};
	}

	// When a live shell is driving the reseed it passes `deferToSidecar`: opening
	// a SECOND writer connection to entities.db from this Bun subprocess while
	// the shell holds the file open is cross-process WAL contention — a bulk
	// seed transaction or a close-time checkpoint outlasts the 5s busy_timeout
	// and both sides throw "database is locked" (F-278). Park the snapshot in the
	// sidecar instead; the shell drains it in-process on its own single
	// connection. A standalone CLI reseed (no live shell) skips this and writes
	// directly, which is contention-free.
	if (opts.deferToSidecar) {
		await writeSeedSidecar(vaultPath, snapshot);
		return {
			entitiesCreated: 0,
			entitiesUpdated: 0,
			linksWritten: 0,
			entitiesRemoved: 0,
			deferredToSidecar: true,
			entitiesProjected,
			linksProjected,
		};
	}

	const dataDir = join(vaultPath, "data");
	await mkdir(dataDir, { recursive: true });
	const dbPath = join(dataDir, "entities.db");
	let db: Awaited<ReturnType<typeof openSqlite>>;
	try {
		db = await openSqlite(dbPath, { tunePragmas: true });
	} catch (err) {
		// Encrypted vaults (SQLCipher) reject plain-SQLite opens with "file is
		// not a database". This Bun process has no SQLCipher driver and the
		// master key never leaves the shell, so it can't write entities.db
		// here. Hand the projected snapshot to the shell via the sidecar; the
		// shell drains it in-process (master key + SQLCipher) on reseed / boot.
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("not a database") || message.includes("file is encrypted")) {
			await writeSeedSidecar(vaultPath, snapshot);
			return {
				entitiesCreated: 0,
				entitiesUpdated: 0,
				linksWritten: 0,
				entitiesRemoved: 0,
				deferredToSidecar: true,
				entitiesProjected,
				linksProjected,
			};
		}
		throw err;
	}
	try {
		await applyMigrations(db, ENTITIES_MIGRATIONS);
		const repo = new EntitiesRepository(db);
		const stats = applySeederSnapshot(repo, snapshot, Date.now());
		return { ...stats, deferredToSidecar: false, entitiesProjected, linksProjected };
	} finally {
		db.close();
	}
}
