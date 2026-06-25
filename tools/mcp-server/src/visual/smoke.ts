/**
 * Smoke-test the bun-side client → Node worker → Playwright session
 * pipeline without going through the MCP transport.
 *
 * Boots the shell (lazily on first snapshot), captures dashboard + notes
 * (light), prints the paths, then shuts down the worker.
 *
 * Run with `bun run tools/mcp-server/src/visual/smoke.ts`.
 */

import { join } from "node:path";
import { listSpecsViaWorker, shutdownWorker, snapshot } from "./client.ts";

const REPO_ROOT = (() => {
	const here = new URL(import.meta.url).pathname;
	const idx = here.indexOf("/tools/mcp-server/");
	if (idx < 0) throw new Error("smoke: cannot locate repo root");
	return here.slice(0, idx);
})();

const OUT_DIR = join(REPO_ROOT, ".screenshots", "mcp-smoke");

async function main(): Promise<void> {
	const specs = await listSpecsViaWorker();
	console.log(`[smoke] specs: ${specs.length}`);
	const dashboard = await snapshot({
		app: "dashboard",
		theme: "light",
		outPath: join(OUT_DIR, "dashboard.png"),
	});
	console.log("[smoke] dashboard:", dashboard);
	const notes = await snapshot({
		app: "notes",
		theme: "light",
		outPath: join(OUT_DIR, "notes.png"),
	});
	console.log("[smoke] notes:", notes);
	await shutdownWorker();
	console.log("[smoke] done");
}

main().catch(async (err) => {
	console.error("[smoke] fail:", err);
	await shutdownWorker().catch(() => {});
	process.exit(1);
});
