import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SEED_SIDECAR_FILENAME } from "../../../packages/shell/src/main/entities/seed-snapshot.ts";
import { writeVaultEntities } from "../src/seed/write-vault-entities.ts";

// Regression: once a dev vault is encrypted at rest, the Bun seed-cli can no
// longer open `entities.db` (bun:sqlite has no SQLCipher). Before the sidecar
// fix `writeVaultEntities` swallowed that as a silent 0-write — the seed-cli
// reported success while nothing reached the canonical store, so every app
// (Journal included) came up empty. The seeder must instead hand the projected
// snapshot to the shell via a sidecar it can drain in-process.

const vaults: string[] = [];

function makeEncryptedVault(): string {
	const vault = mkdtempSync(join(tmpdir(), "bs-seed-sidecar-"));
	const dataDir = join(vault, "data");
	mkdirSync(dataDir, { recursive: true });
	// Non-SQLite bytes stand in for the SQLCipher-encrypted file: a plain open
	// rejects it with "file is not a database", exactly like a real encrypted
	// entities.db under Bun.
	writeFileSync(join(dataDir, "entities.db"), Buffer.from([0xbe, 0xee, 0xe9, 0x82, 0x1a, 0xcd]));
	vaults.push(vault);
	return vault;
}

afterEach(() => {
	for (const v of vaults.splice(0)) {
		try {
			require("node:fs").rmSync(v, { recursive: true, force: true });
		} catch {
			/* best effort */
		}
	}
});

describe("writeVaultEntities — encrypted vault", () => {
	it("defers a journal entry to the seed sidecar instead of dropping it", async () => {
		const vault = makeEncryptedVault();
		const stats = await writeVaultEntities(vault, {
			notes: {
				"note:journal-2026-06-01": {
					id: "journal-2026-06-01",
					title: "2026-06-01",
					body: null,
				},
			},
		});

		expect(stats.deferredToSidecar).toBe(true);

		const sidecar = join(vault, "data", SEED_SIDECAR_FILENAME);
		expect(existsSync(sidecar)).toBe(true);

		const snapshot = JSON.parse(readFileSync(sidecar, "utf8")) as {
			entities: Array<{ id: string; type: string; ownerAppId: string }>;
		};
		const entry = snapshot.entities.find((e) => e.id === "journal-2026-06-01");
		expect(entry).toBeDefined();
		// Journal entries re-type off the shared Note projection.
		expect(entry?.type).toBe("io.brainstorm.journal/Entry/v1");
		expect(entry?.ownerAppId).toBe("io.brainstorm.journal");
	});

	it("writes no sidecar when there is nothing to seed", async () => {
		const vault = makeEncryptedVault();
		const stats = await writeVaultEntities(vault, { notes: {} });
		expect(stats.deferredToSidecar).toBe(false);
		expect(existsSync(join(vault, "data", SEED_SIDECAR_FILENAME))).toBe(false);
	});
});

// F-278: when a live shell drives the reseed it passes `deferToSidecar`. The
// Bun CLI must then NOT open a second writer connection to entities.db (that
// contends cross-process with the running shell → "database is locked"); it
// parks the snapshot in the sidecar for the shell to drain in-process.
describe("writeVaultEntities — deferToSidecar (live shell)", () => {
	function makeFreshVault(): string {
		const vault = mkdtempSync(join(tmpdir(), "bs-seed-defer-"));
		mkdirSync(join(vault, "data"), { recursive: true });
		vaults.push(vault);
		return vault;
	}

	const seed = {
		notes: {
			"note:hub": { id: "hub", title: "Hub", body: null },
		},
	};

	it("parks to the sidecar without opening entities.db on an unencrypted vault", async () => {
		const vault = makeFreshVault();
		const stats = await writeVaultEntities(vault, seed, { deferToSidecar: true });

		expect(stats.deferredToSidecar).toBe(true);
		expect(existsSync(join(vault, "data", SEED_SIDECAR_FILENAME))).toBe(true);
		// The smoking-gun assertion: no second connection was opened, so the CLI
		// never created/touched entities.db.
		expect(existsSync(join(vault, "data", "entities.db"))).toBe(false);
	});

	it("opens entities.db directly when not deferring (standalone CLI path)", async () => {
		const vault = makeFreshVault();
		const stats = await writeVaultEntities(vault, seed, { deferToSidecar: false });

		expect(stats.deferredToSidecar).toBe(false);
		// Standalone reseed writes the real store (no live shell to contend with).
		expect(existsSync(join(vault, "data", "entities.db"))).toBe(true);
		expect(existsSync(join(vault, "data", SEED_SIDECAR_FILENAME))).toBe(false);
	});
});
