/**
 * Stage 0.11 — `capability.diff`: per-PR diff of the declared
 * capability surface across two git revisions.
 *
 * Why this exists: every PR that adds, removes, narrows or widens an
 * app's capability declaration changes the *user-visible install-time
 * prompt* and the broker's runtime grant check (per `[docs/security/09]`
 * + `[docs/security/16]`). The review-time question "did this PR
 * silently add a new IPC surface?" needs to be answered structurally —
 * not from a reviewer's memory of `manifest.json`. This is the
 * dev-MCP audit tool that answers it.
 *
 * What we read: `apps/<id>/manifest.json` — the `capabilities` array.
 * The runtime broker grants based on the per-vault `CapabilityLedger`,
 * but the ledger is populated *from* the manifest at install — the
 * manifest is the declared contract. The SDK proxies in
 * `packages/sdk/src/runtime.ts` carry hardcoded per-method caps
 * (`storage.put` → `["storage.kv"]`); those are an inner contract
 * that's already covered by `audit.typecheck` + the existing SDK test
 * suite. The user-facing contract — what does this app ASK FOR — is
 * the manifest.
 *
 * Capability shape per `[main/capabilities/ledger.ts]`
 * (`parseCapability`): `<service>.<verb>[:<scope>]`. The colon-suffix
 * is the SCOPE — `intents.dispatch:open` is strictly narrower than a
 * hypothetical bare `intents.dispatch` (which would be unscoped /
 * wildcard). Per the project memory `[[project_intents_dispatch_cap_scope]]`:
 * SDK service cap hints must carry the scope, else the broker
 * silently denies. So a PR that narrows or widens scope is a real
 * functional change a reviewer needs flagged.
 *
 * Pure helper shape mirrors `coverage.ts`: `(beforeManifests,
 * afterManifests) → CapabilityDiff`. The MCP-tool wrapper spawns
 * `git show <ref>:apps/<id>/manifest.json` for each app to gather the
 * two snapshots.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "../repo.ts";

/** A single capability declaration with its scope split out. */
export type CapSurface = {
	/** `<service>.<verb>`, e.g. `entities.read`. Never carries the
	 *  colon-scope suffix. */
	capability: string;
	/** Scope (the segment after `:`) or `null` for an unscoped
	 *  declaration. `"*"` is the wildcard that the ledger matches
	 *  against any specific scope request. */
	scope: string | null;
	/** Owning app id from the manifest. */
	appId: string;
};

/** Parse `"<cap>[:<scope>]"` into the split shape. Mirrors the runtime
 *  `parseCapability` in `main/capabilities/ledger.ts` exactly — same
 *  splitter, same null-vs-string-rule. Re-implemented here (rather than
 *  imported) to keep the dev-MCP tool free of a shell-package import. */
export function parseCapability(raw: string): { capability: string; scope: string | null } {
	const colon = raw.indexOf(":");
	if (colon < 0) return { capability: raw, scope: null };
	return { capability: raw.slice(0, colon), scope: raw.slice(colon + 1) };
}

/** Render a `(capability, scope)` pair back into the canonical
 *  `"cap[:scope]"` string. Symmetric inverse of `parseCapability`. */
export function formatCapability(c: Pick<CapSurface, "capability" | "scope">): string {
	return c.scope === null ? c.capability : `${c.capability}:${c.scope}`;
}

/** Stable string key for grouping across snapshots. */
function surfaceKey(c: CapSurface): string {
	return `${c.appId}::${formatCapability(c)}`;
}

/** Shape of an entry in either `appId -> manifest` map the caller hands
 *  to `diffCapabilitySurface`. We only read `capabilities` — every
 *  other manifest field is opaque here. */
export type ManifestSnapshot = {
	id: string;
	capabilities?: readonly string[];
};

export type CapabilityDiff = {
	/** Surfaces present in `after` but not in `before` — the
	 *  "this PR added a capability" class. */
	added: CapSurface[];
	/** Surfaces present in `before` but not in `after` — the
	 *  "this PR dropped a capability" class. */
	removed: CapSurface[];
	/** Per-app: same `capability`, scope went from `null` / `"*"` to a
	 *  specific value (the new scope is *narrower*: it does less). */
	narrowed: ScopeChange[];
	/** Per-app: same `capability`, scope went from a specific value to
	 *  `null` / `"*"` (the new scope is *wider*: it does more). This
	 *  is the class a reviewer cares about most. */
	widened: ScopeChange[];
	/** Per-app grouping of all classes for at-a-glance scan. */
	byApp: Record<string, CapabilityAppDiff>;
};

export type ScopeChange = {
	appId: string;
	capability: string;
	beforeScope: string | null;
	afterScope: string | null;
};

export type CapabilityAppDiff = {
	added: CapSurface[];
	removed: CapSurface[];
	narrowed: ScopeChange[];
	widened: ScopeChange[];
};

/** Read manifests into the `CapSurface[]` flat form. Skips apps that
 *  declare no `capabilities` array (an old manifest shape; should
 *  never happen post-Stage 5 but the parser is forgiving). */
export function manifestsToSurfaces(manifests: readonly ManifestSnapshot[]): CapSurface[] {
	const out: CapSurface[] = [];
	for (const m of manifests) {
		for (const raw of m.capabilities ?? []) {
			if (typeof raw !== "string" || raw.length === 0) continue;
			const { capability, scope } = parseCapability(raw);
			out.push({ appId: m.id, capability, scope });
		}
	}
	return out;
}

/** A scope is "wider" than another if it represents a strictly larger
 *  permission set per the ledger's match rules
 *  (`main/capabilities/ledger.ts §has`):
 *
 *    - `null` (no scope at all in the manifest) is the broadest:
 *      every wildcard / specific is narrower.
 *    - `"*"` is the wildcard: every specific is narrower; `null` and
 *      `"*"` are treated as equally broad for diff purposes (the
 *      ledger's match rule treats them identically for matching).
 *    - specific scopes are mutually narrow + non-comparable (a PR
 *      that swaps one specific for another is recorded as `added`
 *      + `removed` of the two surfaces, not as a narrow/widen).
 *
 *  Returns:
 *    -  -1 — `a` is narrower than `b`
 *    -   1 — `a` is wider than `b`
 *    -   0 — same breadth (both null/*, or both a specific equal value)
 *    - null — not comparable (two distinct specifics) */
export function compareScopeBreadth(a: string | null, b: string | null): -1 | 0 | 1 | null {
	const aWild = a === null || a === "*";
	const bWild = b === null || b === "*";
	if (aWild && bWild) return 0;
	if (aWild && !bWild) return 1;
	if (!aWild && bWild) return -1;
	if (a === b) return 0;
	return null;
}

/** Pure diff: `before` vs `after` snapshots → classified changes. */
export function diffCapabilitySurface(
	before: readonly ManifestSnapshot[],
	after: readonly ManifestSnapshot[],
): CapabilityDiff {
	const beforeSurfaces = manifestsToSurfaces(before);
	const afterSurfaces = manifestsToSurfaces(after);

	const beforeByKey = new Map(beforeSurfaces.map((s) => [surfaceKey(s), s]));
	const afterByKey = new Map(afterSurfaces.map((s) => [surfaceKey(s), s]));

	// Group both sides by `(appId, capability)` so scope changes for
	// the SAME (app, capability) collapse into a narrow/widen instead
	// of added+removed.
	type AppCapKey = `${string}::${string}`;
	const groupKey = (appId: string, capability: string): AppCapKey =>
		`${appId}::${capability}` as AppCapKey;

	const beforeByAppCap = new Map<AppCapKey, CapSurface[]>();
	for (const s of beforeSurfaces) {
		const k = groupKey(s.appId, s.capability);
		const list = beforeByAppCap.get(k) ?? [];
		list.push(s);
		beforeByAppCap.set(k, list);
	}
	const afterByAppCap = new Map<AppCapKey, CapSurface[]>();
	for (const s of afterSurfaces) {
		const k = groupKey(s.appId, s.capability);
		const list = afterByAppCap.get(k) ?? [];
		list.push(s);
		afterByAppCap.set(k, list);
	}

	const narrowed: ScopeChange[] = [];
	const widened: ScopeChange[] = [];
	const handledAfterKeys = new Set<string>();
	const handledBeforeKeys = new Set<string>();

	const allAppCapKeys = new Set<AppCapKey>([...beforeByAppCap.keys(), ...afterByAppCap.keys()]);

	for (const k of allAppCapKeys) {
		const beforeList = beforeByAppCap.get(k) ?? [];
		const afterList = afterByAppCap.get(k) ?? [];
		// Single-scope-per-side: classic narrow/widen. Multi-scope on
		// either side is too ambiguous to classify; let it fall through
		// to added/removed (the reviewer sees the raw set difference).
		if (beforeList.length === 1 && afterList.length === 1) {
			const b0 = beforeList[0];
			const a0 = afterList[0];
			if (!b0 || !a0) continue;
			if (b0.scope === a0.scope) {
				handledBeforeKeys.add(surfaceKey(b0));
				handledAfterKeys.add(surfaceKey(a0));
				continue;
			}
			const cmp = compareScopeBreadth(b0.scope, a0.scope);
			if (cmp === 0) {
				// `null` ↔ `*` is the same breadth per the ledger's match
				// rules; not a real diff.
				handledBeforeKeys.add(surfaceKey(b0));
				handledAfterKeys.add(surfaceKey(a0));
				continue;
			}
			if (cmp === 1) {
				// `before` was wider, `after` is narrower.
				narrowed.push({
					appId: b0.appId,
					capability: b0.capability,
					beforeScope: b0.scope,
					afterScope: a0.scope,
				});
				handledBeforeKeys.add(surfaceKey(b0));
				handledAfterKeys.add(surfaceKey(a0));
			} else if (cmp === -1) {
				widened.push({
					appId: b0.appId,
					capability: b0.capability,
					beforeScope: b0.scope,
					afterScope: a0.scope,
				});
				handledBeforeKeys.add(surfaceKey(b0));
				handledAfterKeys.add(surfaceKey(a0));
			}
			// cmp === null (two distinct specifics) falls through to
			// added/removed — that's a substitution, not a scope shift.
		}
	}

	const added: CapSurface[] = [];
	const removed: CapSurface[] = [];
	for (const [k, s] of afterByKey) {
		if (handledAfterKeys.has(k)) continue;
		if (!beforeByKey.has(k)) added.push(s);
	}
	for (const [k, s] of beforeByKey) {
		if (handledBeforeKeys.has(k)) continue;
		if (!afterByKey.has(k)) removed.push(s);
	}

	added.sort(sortSurface);
	removed.sort(sortSurface);
	narrowed.sort(sortScope);
	widened.sort(sortScope);

	const byApp: Record<string, CapabilityAppDiff> = {};
	const appIds = new Set<string>();
	for (const x of added) appIds.add(x.appId);
	for (const x of removed) appIds.add(x.appId);
	for (const x of narrowed) appIds.add(x.appId);
	for (const x of widened) appIds.add(x.appId);
	for (const id of appIds) {
		byApp[id] = {
			added: added.filter((s) => s.appId === id),
			removed: removed.filter((s) => s.appId === id),
			narrowed: narrowed.filter((s) => s.appId === id),
			widened: widened.filter((s) => s.appId === id),
		};
	}

	return { added, removed, narrowed, widened, byApp };
}

function sortSurface(a: CapSurface, b: CapSurface): number {
	if (a.appId !== b.appId) return a.appId < b.appId ? -1 : 1;
	if (a.capability !== b.capability) return a.capability < b.capability ? -1 : 1;
	return (a.scope ?? "") < (b.scope ?? "") ? -1 : 1;
}

function sortScope(a: ScopeChange, b: ScopeChange): number {
	if (a.appId !== b.appId) return a.appId < b.appId ? -1 : 1;
	return a.capability < b.capability ? -1 : 1;
}

// ─── Runtime IO ───────────────────────────────────────────────────────────────

/** Read every app manifest from the local working tree (HEAD-as-edited).
 *  Caller is responsible for `repoRoot` (default: findRepoRoot()). */
export function readLocalAppManifests(repoRoot: string = findRepoRoot()): ManifestSnapshot[] {
	const appsDir = join(repoRoot, "apps");
	if (!existsSync(appsDir)) return [];
	const out: ManifestSnapshot[] = [];
	for (const name of readdirSync(appsDir)) {
		const manifestPath = join(appsDir, name, "manifest.json");
		if (!existsSync(manifestPath)) continue;
		try {
			const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestSnapshot;
			if (typeof parsed.id === "string") out.push(parsed);
		} catch {
			// Skip; surface as an empty entry — the diff tool reports the
			// before/after state, not malformed JSON.
		}
	}
	return out;
}

/** Read every app manifest at a given git revision. Returns `null` if
 *  the revision has no `apps/` tree (a fresh repo). Skips manifests
 *  that error (deleted, malformed) — they show up in the diff as
 *  added/removed. */
export function readAppManifestsAtRef(
	ref: string,
	repoRoot: string = findRepoRoot(),
): ManifestSnapshot[] {
	const list = spawnSync("git", ["ls-tree", "-r", "--name-only", ref, "apps"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	if (list.status !== 0) return [];
	const out: ManifestSnapshot[] = [];
	for (const path of list.stdout.split("\n")) {
		if (!path.endsWith("/manifest.json")) continue;
		const show = spawnSync("git", ["show", `${ref}:${path}`], {
			cwd: repoRoot,
			encoding: "utf8",
		});
		if (show.status !== 0) continue;
		try {
			const parsed = JSON.parse(show.stdout) as ManifestSnapshot;
			if (typeof parsed.id === "string") out.push(parsed);
		} catch {
			// skip
		}
	}
	return out;
}

/** End-to-end: diff capability surface between two git refs (default:
 *  `HEAD` vs `HEAD~1`). */
export function runCapabilityDiff(
	beforeRef = "HEAD~1",
	afterRef = "HEAD",
	repoRoot: string = findRepoRoot(),
): CapabilityDiff {
	const before = readAppManifestsAtRef(beforeRef, repoRoot);
	const after = readAppManifestsAtRef(afterRef, repoRoot);
	return diffCapabilitySurface(before, after);
}
