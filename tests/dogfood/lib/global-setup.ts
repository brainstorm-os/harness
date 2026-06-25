/**
 * Dogfood global setup — builds the first-party app bundles ONCE per
 * `playwright` invocation, before any founder session runs.
 *
 * Why this exists: the founder harness re-seeds the persistent Northbound
 * vault every session so Mira always runs the latest app code. Re-seeding
 * used to vite-build all 11 apps from source *inside* each session, which now
 * costs ~200s (preview's pdf.js bundle pushed it over) — that blew the
 * Playwright per-test budget and every session timed out during setup with an
 * empty notes file. Building here instead:
 *   - moves the build cost out of the per-test timeout (global setup has no
 *     per-test budget), so sessions no longer time out at startup;
 *   - guarantees freshness — the bundles on disk reflect current source, so
 *     `startSession` can install them prebuilt (fast) via `seedPrebuiltApps`.
 *
 * `BRAINSTORM_DOGFOOD_SKIP_BUILD=1` skips the build for a quick re-run when
 * you KNOW the bundles on disk are already current (e.g. iterating on a spec,
 * not on app code).
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

// biome-ignore lint/style/noDefaultExport: Playwright's `globalSetup` config hook resolves the module's default export.
export default function globalSetup(): void {
	if (process.env.BRAINSTORM_DOGFOOD_SKIP_BUILD === "1") {
		console.log("[dogfood:setup] BRAINSTORM_DOGFOOD_SKIP_BUILD=1 — using bundles already on disk");
		return;
	}
	console.log("[dogfood:setup] building first-party app bundles (build:apps)…");
	const started = Date.now();
	const result = spawnSync("bun", ["run", "build:apps"], {
		cwd: REPO_ROOT,
		stdio: "inherit",
	});
	if (result.status !== 0) {
		throw new Error(`[dogfood:setup] build:apps failed (exit ${result.status})`);
	}
	console.log(`[dogfood:setup] app bundles built in ${Math.round((Date.now() - started) / 1000)}s`);
}
