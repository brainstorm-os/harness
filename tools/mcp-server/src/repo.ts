import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the brainstorm repository root from this file's location.
 * `tools/mcp-server/src/repo.ts` → up three levels.
 */
export function findRepoRoot(): string {
	const here = fileURLToPath(import.meta.url);
	return resolve(dirname(here), "..", "..", "..");
}

export function repoPath(...segments: string[]): string {
	return resolve(findRepoRoot(), ...segments);
}
