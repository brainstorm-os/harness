import { defineConfig } from "@playwright/test";

// Dogfooding harness — the "Mira Anand / Northbound" founder loop.
//
// Separate from the perf (`playwright.config.ts`), soak, and e2e harnesses.
// These specs are NOT measurements and NOT pass/fail assertions about the
// product — they are *driven founder sessions*. Each spec encodes what Mira
// sets out to do; the harness captures what actually happened (screenshots,
// renderer console, audit log) into `tests/dogfood/.sessions/<name>/`, which
// is then distilled into `docs/dogfood/friction-log.md`.
//
// Runs against the production build (`bun run dogfood:build`) so Mira sees
// exactly what a user would. The vault is PERSISTENT (`tests/dogfood/.data`,
// gitignored) — her workspace accumulates across sessions.
export default defineConfig({
	testDir: "./tests/dogfood/sessions",
	testMatch: /.*\.spec\.ts$/,
	// Build the app bundles once before any session (outside the per-test
	// budget) so per-session re-seeding installs them prebuilt and fast —
	// rebuilding all 11 apps from source inside each session timed sessions
	// out at setup. Set BRAINSTORM_DOGFOOD_SKIP_BUILD=1 to reuse disk bundles.
	globalSetup: "./tests/dogfood/lib/global-setup.ts",
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 600_000,
	reporter: [["list"]],
});
