#!/usr/bin/env bun
/**
 * Tiny standalone CLI for the `BrainstormProject` seed scope.
 *
 * Usage:
 *   bun run tools/mcp-server/src/seed/seed-cli.ts --vault <absolute-vault-path>
 *
 * Re-runs the seed against the configured vault in merge mode (preserves
 * any non-seed KV rows). Idempotent: stable ids + frozen timestamps in the
 * dataset mean re-running yields identical files unless the source markdown
 * changed.
 *
 * Intended as the throwaway "auto-seed BrainstormProject on dev shell
 * start" hook (per the dev-tooling note in `seed-demo-apps.ts`). Drop this
 * file when the real vault-entities-service + import pipeline lands.
 */

import { SeedMode, SeedScope, seedVault } from "./seeder.ts";

function parseArgs(argv: readonly string[]): {
	vault: string | null;
	dryRun: boolean;
	deferToSidecar: boolean;
} {
	let vault: string | null = null;
	let dryRun = false;
	let deferToSidecar = false;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--vault" || arg === "-v") {
			vault = argv[i + 1] ?? null;
			i += 1;
		} else if (arg === "--dry-run") {
			dryRun = true;
		} else if (arg === "--defer-sidecar") {
			// A live shell spawns the CLI with this so the projection lands in the
			// seed sidecar (drained in-process by the shell) rather than via a
			// second entities.db connection that contends with the running shell.
			deferToSidecar = true;
		}
	}
	return { vault, dryRun, deferToSidecar };
}

const { vault, dryRun, deferToSidecar } = parseArgs(process.argv.slice(2));

if (!vault) {
	console.error("seed-cli: --vault <absolute-path> is required");
	process.exit(2);
}

try {
	const report = await seedVault({
		vaultPath: vault,
		scopes: [SeedScope.BrainstormProject],
		mode: SeedMode.Merge,
		dryRun,
		now: Date.now(),
		deferToSidecar,
	});

	const lines: string[] = [];
	for (const [appId, w] of Object.entries(report.wrote)) {
		lines.push(`  ${appId}: wrote ${w.keysWritten.length}, preserved ${w.keysPreserved.length}`);
	}
	console.log(`[seed-cli] BrainstormProject → ${vault}${dryRun ? " (dry-run)" : ""}`);
	for (const line of lines) console.log(line);
	if (report.entities) {
		const e = report.entities;
		if (e.deferredToSidecar) {
			console.log(
				`  entities.db: deferred ${e.entitiesProjected} entities + ${e.linksProjected} links to seed sidecar (encrypted vault — the shell applies them on next reseed/boot)`,
			);
		} else {
			console.log(
				`  entities.db: ${e.entitiesCreated} created, ${e.entitiesUpdated} updated, ${e.entitiesRemoved} removed, ${e.linksWritten} links`,
			);
		}
	}
	process.exit(0);
} catch (error) {
	console.error(`[seed-cli] failed: ${(error as Error).message}`);
	process.exit(1);
}
