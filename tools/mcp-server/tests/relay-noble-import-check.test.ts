/**
 * Workspace gate for the 12th structural CI fence. Runs the pure
 * `findRelayImportViolations` audit against the live tree on every test
 * pass; a real-finding violation fails the suite, not a future review.
 *
 * Also pins:
 *   - `isRelayModulePath` matches `sync/*relay*.ts` but NOT test files
 *   - synthetic-fixture units cover both forbidden import shapes + the
 *     comment-stripping behaviour (a doc-comment mentioning the rule
 *     must NOT fire the audit)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import {
	type RelayImportFileInput,
	findRelayImportViolations,
	isRelayModulePath,
} from "../src/tools/relay-noble-import-check.ts";

function walkSyncDir(root: string): RelayImportFileInput[] {
	const out: RelayImportFileInput[] = [];
	const walk = (dir: string): void => {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}
		for (const name of entries) {
			const p = join(dir, name);
			let stat: ReturnType<typeof statSync>;
			try {
				stat = statSync(p);
			} catch {
				continue;
			}
			if (stat.isDirectory()) {
				if (name === "node_modules" || name === "dist" || name === ".git") continue;
				walk(p);
			} else if (/\.(ts|tsx|js|mjs)$/.test(p) && !p.endsWith(".d.ts")) {
				out.push({ path: p, source: readFileSync(p, "utf8") });
			}
		}
	};
	walk(root);
	return out;
}

function makeFile(path: string, source: string): RelayImportFileInput {
	return { path, source };
}

// `process.cwd()` at test time is the repo root, so `repoPath` is a
// stable absolute path for the live-tree gate.
const SYNC_ROOT = repoPath("packages", "shell", "src", "main", "sync");

describe("isRelayModulePath", () => {
	it("matches sync/*relay*.ts files", () => {
		expect(isRelayModulePath("packages/shell/src/main/sync/relay-port.ts")).toBe(true);
		expect(isRelayModulePath("packages/shell/src/main/sync/websocket-relay.ts")).toBe(true);
		expect(isRelayModulePath("packages/shell/src/main/sync/foo/bar/y-relay.ts")).toBe(true);
	});

	it("excludes .test.ts files (tests need the crypto for fixtures)", () => {
		expect(isRelayModulePath("packages/shell/src/main/sync/relay-port.test.ts")).toBe(false);
	});

	it("ignores non-sync paths even when the basename contains 'relay'", () => {
		expect(isRelayModulePath("packages/shell/src/main/whatever/relay-of-other-thing.ts")).toBe(false);
	});

	it("normalises Windows path separators", () => {
		expect(isRelayModulePath("packages\\shell\\src\\main\\sync\\relay-port.ts")).toBe(true);
	});

	it("(10.4) matches every source file under packages/relay-server/src/", () => {
		expect(isRelayModulePath("packages/relay-server/src/server.ts")).toBe(true);
		expect(isRelayModulePath("packages/relay-server/src/router.ts")).toBe(true);
		expect(isRelayModulePath("packages/relay-server/src/wire.ts")).toBe(true);
		expect(isRelayModulePath("packages/relay-server/src/deep/nested.ts")).toBe(true);
	});

	it("(10.4) excludes .test.ts files under packages/relay-server/src/", () => {
		expect(isRelayModulePath("packages/relay-server/src/router.test.ts")).toBe(false);
		expect(isRelayModulePath("packages/relay-server/src/server.test.ts")).toBe(false);
	});

	it("(10.4) ignores the bin entry (not under src/)", () => {
		// `bin/relay.ts` is the CLI entry — it's allowed to call into the
		// fenced `src/*` modules but is itself not a fenced module (a CLI
		// might legitimately read a key for a TLS cert in v2). 10.4 keeps
		// the scope tight to `src/`.
		expect(isRelayModulePath("packages/relay-server/bin/relay.ts")).toBe(false);
	});

	it("(10.4) normalises Windows path separators for relay-server", () => {
		expect(isRelayModulePath("packages\\relay-server\\src\\server.ts")).toBe(true);
	});
});

describe("findRelayImportViolations — synthetic fixtures", () => {
	it("clean relay (no crypto imports) produces no violations", () => {
		const ok = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			[
				'import { decodeFrame } from "./wire";',
				"export function relay() { return decodeFrame(new Uint8Array()); }",
			].join("\n"),
		);
		expect(findRelayImportViolations([ok])).toEqual([]);
	});

	it("flags an @noble import", () => {
		const bad = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			[
				'import { ed25519 } from "@noble/curves/ed25519.js";',
				"export function relay() { return ed25519; }",
			].join("\n"),
		);
		const violations = findRelayImportViolations([bad]);
		expect(violations).toHaveLength(1);
		expect(violations[0]?.kind).toBe("noble-import");
		expect(violations[0]?.line).toBe(1);
	});

	it("flags a side-effect-only @noble import", () => {
		const bad = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			'import "@noble/hashes/sha2.js";\n',
		);
		const violations = findRelayImportViolations([bad]);
		expect(violations).toHaveLength(1);
		expect(violations[0]?.kind).toBe("noble-import");
	});

	it("flags an envelope-crypto import (relative path)", () => {
		const bad = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			'import { sealUpdate } from "./envelope-crypto";\nexport const x = sealUpdate;\n',
		);
		const violations = findRelayImportViolations([bad]);
		expect(violations).toHaveLength(1);
		expect(violations[0]?.kind).toBe("crypto-import");
	});

	it("flags an envelope-seal import (the parallel-agent variant of the seal module)", () => {
		const bad = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			'import { sealUpdateEnvelope } from "./envelope-seal";\nexport const x = sealUpdateEnvelope;\n',
		);
		const violations = findRelayImportViolations([bad]);
		expect(violations).toHaveLength(1);
		expect(violations[0]?.kind).toBe("crypto-import");
	});

	it("flags a require('@noble/...') form", () => {
		const bad = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			'const { ed25519 } = require("@noble/curves/ed25519.js");\n',
		);
		expect(findRelayImportViolations([bad])).toHaveLength(1);
	});

	it("does NOT flag a doc-comment that explains the rule", () => {
		const safe = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			[
				"/**",
				" * Loopback relay. MUST NOT import @noble/* or ./envelope-crypto",
				" * — the structural blind-relay fence depends on this.",
				" */",
				"export const noop = () => undefined;",
			].join("\n"),
		);
		expect(findRelayImportViolations([safe])).toEqual([]);
	});

	it("does NOT flag a line-comment that mentions the rule", () => {
		const safe = makeFile(
			"packages/shell/src/main/sync/relay-port.ts",
			[
				"// No @noble/curves import here — the relay is blind by construction.",
				"export const noop = () => undefined;",
			].join("\n"),
		);
		expect(findRelayImportViolations([safe])).toEqual([]);
	});

	it("ignores files outside the relay-module pattern even when they look like imports", () => {
		const innocent = makeFile(
			"packages/shell/src/main/credentials/hpke.ts",
			'import { x25519 } from "@noble/curves/ed25519.js";\n',
		);
		expect(findRelayImportViolations([innocent])).toEqual([]);
	});

	it("(10.4) flags an @noble import inside the relay-server source tree", () => {
		const bad = makeFile(
			"packages/relay-server/src/router.ts",
			'import { ed25519 } from "@noble/curves/ed25519.js";\nexport const x = ed25519;\n',
		);
		const violations = findRelayImportViolations([bad]);
		expect(violations).toHaveLength(1);
		expect(violations[0]?.kind).toBe("noble-import");
	});
});

describe("findRelayImportViolations — live tree gate", () => {
	it("the live `relay-port.ts` passes the fence", () => {
		const path = repoPath("packages", "shell", "src", "main", "sync", "relay-port.ts");
		const source = readFileSync(path, "utf8");
		const violations = findRelayImportViolations([{ path, source }]);
		expect(violations).toEqual([]);
	});

	it("audits every live relay-module file in one pass — must be zero", () => {
		const files = walkSyncDir(SYNC_ROOT);
		const inScope = files.filter((f) => isRelayModulePath(f.path));
		expect(inScope.length).toBeGreaterThan(0); // at least one relay in scope
		const violations = findRelayImportViolations(inScope);
		expect(violations).toEqual([]);
	});

	it("(10.4) audits the relay-server package in one pass — must be zero", () => {
		const RELAY_SERVER_SRC = repoPath("packages", "relay-server", "src");
		const files = walkSyncDir(RELAY_SERVER_SRC);
		const inScope = files.filter((f) => isRelayModulePath(f.path));
		expect(inScope.length).toBeGreaterThan(0);
		const violations = findRelayImportViolations(inScope);
		expect(violations).toEqual([]);
	});
});
