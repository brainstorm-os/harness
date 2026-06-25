/**
 * 12th structural CI gate — blind-relay import fence (10.3a slice 1).
 *
 * The Stage-10 blind-relay invariant — "the production relay code path
 * must never import the project's crypto modules" — was first asserted
 * inline inside `envelope-pipeline.test.ts`. This audit lifts that
 * fence to the project level so any future relay implementation (Stage
 * 10.4's `y-websocket` transport adapter, the third-party deployable
 * relay binary, etc.) inherits the same structural ban automatically.
 *
 * Pure function `(files) → violations`. The dev-MCP `sync.*` family
 * exposes it via `sync.relay_noble_import_check`; the workspace vitest
 * gate (`tools/mcp-server/tests/relay-noble-import-check.test.ts`) runs
 * it against the live tree on every commit, mirroring the existing 11
 * structural gates.
 *
 * Scope: every TS/JS file whose path matches `**\/sync/**\/*relay*.ts`
 * (or `.tsx` / `.js` / `.mjs`). The relay-module convention is
 * **filename contains `relay`** so any module any human reader would
 * call "the relay" is automatically in-scope (`relay-port.ts`,
 * `loopback-relay.ts`, future `y-websocket-relay.ts`, etc.). Test
 * files are excluded (`*.test.ts`) since they legitimately import the
 * envelope-seal module to construct fixtures.
 *
 * Forbidden:
 *   - `import … from "@noble/<anything>"` (and `require("@noble/...")`).
 *   - `import … from "./envelope-seal"` / `./envelope-crypto` / any
 *     other `*envelope-seal*` / `*envelope-crypto*` sibling —
 *     pattern-matched so a rename can't bypass.
 *   - Side-effect imports that fetch one of the above (`import
 *     "@noble/ciphers/chacha.js"`).
 *
 * Allowed: comments mentioning the rule (the relay file's own header
 * explains it). The audit strips block + line comments before scanning,
 * so the contract is "no real imports", not "the word `@noble` doesn't
 * appear in the file's prose".
 */

export type RelayImportViolation = {
	path: string;
	line: number;
	excerpt: string;
	kind: "noble-import" | "crypto-import";
};

export type RelayImportFileInput = {
	path: string;
	source: string;
};

/** Is this file in-scope for the fence?
 *
 * **Scope (10.4 extension).** Two structural shapes are in scope:
 *   1. `**\/sync/**\/*relay*.ts` — original shell-side scope. Any file
 *      under a `sync/` directory whose basename contains `relay` is the
 *      shell-half relay module (`relay-port.ts`, future `*-relay.ts`).
 *   2. `**\/packages/relay-server/src/**\/*.ts` — the standalone
 *      relay-server package. Every source file is in scope; the package
 *      exists to be the blind relay, so every line of it inherits the
 *      no-crypto fence.
 *
 * Test files (`*.test.[tj]sx?`) are excluded from BOTH shapes — they
 * legitimately construct fixtures using crypto primitives (the shell-half
 * tests import `sealUpdate`; the relay-server tests build wire frames by
 * hand).
 */
export function isRelayModulePath(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	if (/\.test\.[tj]sx?$/.test(normalized)) return false;
	// Shape 1: `**/sync/**/*relay*.{ts,tsx,js,mjs}` (shell relay modules).
	if (/\/sync\//.test(normalized) && /\/[^/]*relay[^/]*\.(ts|tsx|js|mjs)$/.test(normalized)) {
		return true;
	}
	// Shape 2: every source file under `packages/relay-server/src/` —
	// the relay-server package is the relay, so every file inherits the
	// fence (10.4 extension; the relay-server is the highest-stakes blind
	// module).
	if (
		/(^|\/)packages\/relay-server\/src\//.test(normalized) &&
		/\.(ts|tsx|js|mjs)$/.test(normalized)
	) {
		return true;
	}
	return false;
}

/** Strip block comments + line comments so the scan ignores the file's
 *  own documentation of the rule. Tolerant of strings that look like
 *  comments — at this layer false-positives are preferable to a sneaky
 *  bypass via "string-shaped" code. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Forbidden import / require patterns. */
const PATTERNS: ReadonlyArray<{ kind: RelayImportViolation["kind"]; re: RegExp }> = [
	{ kind: "noble-import", re: /import[^;]*from\s+["']@noble\/[^"']+["']/g },
	{ kind: "noble-import", re: /require\(\s*["']@noble\/[^"']+["']\s*\)/g },
	{ kind: "noble-import", re: /import\s+["']@noble\/[^"']+["']/g },
	{
		kind: "crypto-import",
		re: /import[^;]*from\s+["'](?:\.{1,2}\/)+[^"']*envelope-(?:crypto|seal)[^"']*["']/g,
	},
	{
		kind: "crypto-import",
		re: /require\(\s*["'](?:\.{1,2}\/)+[^"']*envelope-(?:crypto|seal)[^"']*["']\s*\)/g,
	},
];

/** Pure audit. Returns one violation per offending import (zero on a
 *  clean tree). Path + 1-based line + the offending line excerpt are
 *  the same shape the other 11 audits emit, so the dev-MCP `audit.*`
 *  output format stays uniform. */
export function findRelayImportViolations(
	files: readonly RelayImportFileInput[],
): RelayImportViolation[] {
	const out: RelayImportViolation[] = [];
	for (const file of files) {
		if (!isRelayModulePath(file.path)) continue;
		const stripped = stripComments(file.source);
		const lines = file.source.split("\n");
		for (const { kind, re } of PATTERNS) {
			// Reset each pattern's lastIndex per file (the regexes are `g`).
			re.lastIndex = 0;
			for (const m of stripped.matchAll(re)) {
				const offset = m.index ?? 0;
				// Recompute the line number from the ORIGINAL source so the
				// excerpt + the line number line up — stripComments shifts
				// line indices.
				const line = lineNumberAtOffset(
					file.source,
					mapStrippedOffsetToOriginal(file.source, stripped, offset),
				);
				out.push({
					path: file.path,
					line,
					excerpt: (lines[line - 1] ?? "").trim(),
					kind,
				});
			}
		}
	}
	return out;
}

function lineNumberAtOffset(source: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source.charCodeAt(i) === 10) line += 1;
	}
	return line;
}

/** Strip-comments shifts character offsets. Map an offset in the
 *  stripped text back into the original by walking both in lockstep —
 *  cheap (linear in `offset`) and accurate. */
function mapStrippedOffsetToOriginal(
	original: string,
	stripped: string,
	strippedOffset: number,
): number {
	if (strippedOffset === 0) return 0;
	if (original === stripped) return strippedOffset;
	let oi = 0;
	let si = 0;
	while (si < strippedOffset && oi < original.length) {
		// Skip block comment
		if (original[oi] === "/" && original[oi + 1] === "*") {
			const end = original.indexOf("*/", oi + 2);
			if (end < 0) break;
			oi = end + 2;
			continue;
		}
		// Skip line comment (but only when at start-of-line OR preceded
		// by something other than `:` — mirrors `stripComments`'
		// alternation guard).
		if (original[oi] === "/" && original[oi + 1] === "/" && (oi === 0 || original[oi - 1] !== ":")) {
			const eol = original.indexOf("\n", oi + 2);
			if (eol < 0) {
				oi = original.length;
				break;
			}
			oi = eol;
			continue;
		}
		if (original[oi] === stripped[si]) {
			oi += 1;
			si += 1;
		} else {
			// Defensive — shouldn't happen, but advance the original
			// pointer to avoid an infinite loop on any mismatch.
			oi += 1;
		}
	}
	return oi;
}
