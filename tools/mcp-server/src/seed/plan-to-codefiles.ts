/**
 * Vault-resident architectural reference snippets (SH-24 per
 * docs/foundations/49-self-hosting.md).
 *
 * A few read-only `CodeFile/v1` touchstones a contributor can open in the
 * Code-editor app to see the shapes the design keeps pointing at — the
 * IPC envelope, the fail-closed capability check, the release anchor.
 * These are illustrative reference text, NOT a bridge to the source tree
 * (SH-11/12 stays rejected). Written under the self-hosting `code-file:`
 * keyspace and projected as `brainstorm/CodeFile/v1` so the same single
 * projection owns them.
 *
 * Pure + deterministic (frozen timestamps + stable ids).
 */

const STABLE_TS = Date.UTC(2026, 4, 14);

export const CODE_FILE_KEY_PREFIX = "code-file:";
export const REFERENCE_CODE_FOLDER_ID = "folder-reference-code";

export interface SerializedCodeFileEntity {
	id: string;
	path: string;
	language: string;
	content: string;
	createdAt: number;
	updatedAt: number;
}

const SNIPPETS: Array<{ id: string; path: string; language: string; content: string }> = [
	{
		id: "ipc-envelope",
		path: "reference/ipc-envelope.ts",
		language: "typescript",
		content: `// Every host-service call is this structured envelope.
// The Broker validates structure → verifies the preload-stamped \`app\`
// → checks \`caps\` against the per-vault CapabilityLedger → forwards.
export type IpcEnvelope = {
  v: 1;
  msg: string;       // correlation id
  app: string;       // preload-stamped, not caller-supplied
  service: string;   // "entities" | "vaultEntities" | ...
  method: string;
  args: unknown[];
  caps: string[];    // capability hints, scope-qualified
};
`,
	},
	{
		id: "capability-check",
		path: "reference/capability-check.ts",
		language: "typescript",
		content: `// Fail-closed: ANY throw from the capability check returns
// Unavailable — never an approval. This invariant is load-bearing.
export function checkCapability(ledger: Ledger, app: string, cap: string) {
  try {
    return ledger.allows(app, cap) ? "ok" : "denied";
  } catch {
    return "unavailable"; // never "ok"
  }
}
`,
	},
	{
		id: "release-anchor",
		path: "reference/release-anchor.ts",
		language: "typescript",
		content: `// The single hand-set date in the whole self-hosting model.
// Every milestone date is DERIVED from this so the roadmap stays
// honest as the plan moves (see deriveReleaseSchedule).
export const RELEASE_VERSION = "0.1.0";
export const RELEASE_TARGET_DATE = Date.UTC(2026, 8, 1); // 2026-09-01
`,
	},
];

export function buildReferenceCodeFiles(): SerializedCodeFileEntity[] {
	return SNIPPETS.map((s) => ({
		id: s.id,
		path: s.path,
		language: s.language,
		content: s.content,
		createdAt: STABLE_TS,
		updatedAt: STABLE_TS,
	}));
}

/** Synthetic Folder containing the seeded CodeFiles so they aren't
 *  graph orphans (SH-36). Sibling to the docs tree under the self-
 *  hosting app's kv. */
export interface SerializedReferenceCodeFolder {
	id: string;
	name: string;
	members: string[];
	view: "list" | "grid" | "tree";
	createdAt: number;
	updatedAt: number;
}

export function buildReferenceCodeFolder(
	codeFiles: ReadonlyArray<SerializedCodeFileEntity>,
): SerializedReferenceCodeFolder {
	return {
		id: REFERENCE_CODE_FOLDER_ID,
		name: "Reference code",
		members: codeFiles.map((c) => c.id),
		view: "list",
		createdAt: STABLE_TS,
		updatedAt: STABLE_TS,
	};
}
