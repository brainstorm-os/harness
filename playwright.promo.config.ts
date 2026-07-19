import { defineConfig } from "@playwright/test";

/** Promo capture rig — one worker, one long test, real screen recording. */
export default defineConfig({
	testDir: "./tests/dogfood/promo",
	timeout: 1_200_000,
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"]],
	globalSetup: "./tests/dogfood/lib/global-setup.ts",
});
