/**
 * Promo vault prep — clone the newest Northbound backup tarball into
 * `tests/dogfood/.promo-data` so the capture rig films Mira's REAL content
 * without ever touching the live vault (`tests/dogfood/.data` is permanent —
 * dogfood README §The vault is permanent; marketing captures use their own
 * data dirs).
 *
 * The backup's `registry.json` records the vault's ABSOLUTE path inside the
 * live data dir — left as-is, the clone would open (and write to!) the real
 * vault. This script rewrites every vault path into the clone and drops the
 * copied Electron singleton-lock trio.
 *
 * Idempotent: a `.promo-source` marker records which tarball was extracted;
 * matching marker → no-op (pass --force to re-extract).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HARNESS = resolve(import.meta.dirname, "..", "..");
const DOGFOOD = join(HARNESS, "tests", "dogfood");
const LIVE_DATA = join(DOGFOOD, ".data");
const BACKUPS = join(DOGFOOD, ".data-backups");
const PROMO_DATA = join(DOGFOOD, ".promo-data");
const MARKER = join(PROMO_DATA, ".promo-source");

if (PROMO_DATA === LIVE_DATA) throw new Error("refusing to operate on the live vault dir");

const tarballs = existsSync(BACKUPS)
	? readdirSync(BACKUPS)
			.filter((f) => f.startsWith("northbound-") && f.endsWith(".tar.gz"))
			.map((f) => ({ f, mtime: statSync(join(BACKUPS, f)).mtimeMs }))
			.sort((a, b) => b.mtime - a.mtime)
	: [];
const newest = tarballs[0]?.f;
if (!newest) {
	console.error("no northbound-*.tar.gz under tests/dogfood/.data-backups — run `bun run dogfood:backup` first");
	process.exit(1);
}

const force = process.argv.includes("--force");
if (!force && existsSync(MARKER) && readFileSync(MARKER, "utf8").trim() === newest) {
	console.log(`promo vault already prepared from ${newest} (use --force to re-extract)`);
	process.exit(0);
}

console.log(`extracting ${newest} → ${PROMO_DATA} …`);
rmSync(PROMO_DATA, { recursive: true, force: true });
// The tarball's top-level entry is `.data/` — extract into a staging dir,
// then rename, so a mid-extract failure never leaves a half-built clone.
const staging = join(DOGFOOD, ".promo-data-staging");
rmSync(staging, { recursive: true, force: true });
execFileSync("mkdir", ["-p", staging]);
execFileSync("tar", ["-xzf", join(BACKUPS, newest), "-C", staging]);
execFileSync("mv", [join(staging, ".data"), PROMO_DATA]);
rmSync(staging, { recursive: true, force: true });

for (const lock of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
	rmSync(join(PROMO_DATA, lock), { force: true });
}

const registryPath = join(PROMO_DATA, "registry.json");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
for (const vault of registry.vaults ?? []) {
	const before = vault.path;
	vault.path = String(vault.path).replace(LIVE_DATA, PROMO_DATA);
	if (vault.path === before && String(vault.path).includes("/.data/")) {
		throw new Error(`vault path not rewritten: ${before}`);
	}
}
writeFileSync(registryPath, `${JSON.stringify(registry, null, 1)}\n`);
writeFileSync(MARKER, `${newest}\n`);
console.log(`promo vault ready — ${registry.vaults?.length ?? 0} vault path(s) re-pointed into .promo-data`);
