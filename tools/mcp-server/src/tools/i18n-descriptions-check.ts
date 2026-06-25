/**
 * Stage 12.3 — every shell translation string carries a required, non-empty
 * translator `description`.
 *
 * Per docs/platform/21-localization.md §Required translation context: "a
 * string with no translation context is broken." 12.1 shipped the flat
 * source-language message catalog (`en.json`, `{id: message}`); 12.3 adds a
 * sibling en-only metadata catalog (`en.descriptions.json`, `{id:
 * description}`) and this gate, which fails when a catalog key has no
 * description.
 *
 * Coverage is reached incrementally via the SH-31/.32 double-fence mechanic:
 * the 792 strings 12.1 carried over are grandfathered in a `KNOWN_MISSING`
 * snapshot (`en.descriptions.known-missing.json`). A NEW catalog key with no
 * description fails the gate immediately; a grandfathered key that has since
 * gained a description (or been removed) is flagged STALE so the snapshot
 * shrinks as the backlog burns down — it can never silently re-grow.
 *
 * Pure: `(catalog, descriptions, knownMissing) → coverage`. The
 * `en.descriptions.json` file is dev/CI metadata only — `t.ts` never imports
 * it, so it adds nothing to the renderer bundle.
 */

import { readFileSync } from "node:fs";
import { repoPath } from "../repo.ts";

export type DescriptionCoverage = {
	/** Catalog keys with no non-empty description that are NOT grandfathered — new regressions. */
	missing: string[];
	/** KNOWN_MISSING entries that no longer apply (key gone, or now described) — prune them. */
	staleGrandfathered: string[];
	/** Description entries with no matching catalog key — orphaned metadata. */
	orphanDescriptions: string[];
};

function isNonEmptyString(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

export function findDescriptionCoverage(
	catalog: Record<string, unknown>,
	descriptions: Record<string, unknown>,
	knownMissing: readonly string[],
): DescriptionCoverage {
	const catalogKeys = new Set(Object.keys(catalog));
	const described = new Set(
		Object.keys(descriptions).filter((k) => isNonEmptyString(descriptions[k])),
	);
	const grandfathered = new Set(knownMissing);

	const missing: string[] = [];
	for (const key of catalogKeys) {
		if (!described.has(key) && !grandfathered.has(key)) missing.push(key);
	}

	const staleGrandfathered: string[] = [];
	for (const key of knownMissing) {
		if (!catalogKeys.has(key) || described.has(key)) staleGrandfathered.push(key);
	}

	const orphanDescriptions: string[] = [];
	for (const key of described) {
		if (!catalogKeys.has(key)) orphanDescriptions.push(key);
	}

	return {
		missing: missing.sort(),
		staleGrandfathered: staleGrandfathered.sort(),
		orphanDescriptions: orphanDescriptions.sort(),
	};
}

const I18N_DIR = ["packages", "shell", "src", "renderer", "i18n"] as const;

function readJson(...segments: string[]): Record<string, unknown> {
	return JSON.parse(readFileSync(repoPath(...segments), "utf8"));
}

/** Reads the live shell catalog + descriptions + grandfather snapshot from disk. */
export function readShellDescriptionCoverage(): DescriptionCoverage {
	const catalog = readJson(...I18N_DIR, "en.json");
	const descriptions = readJson(...I18N_DIR, "en.descriptions.json");
	const knownMissing = JSON.parse(
		readFileSync(repoPath(...I18N_DIR, "en.descriptions.known-missing.json"), "utf8"),
	) as string[];
	return findDescriptionCoverage(catalog, descriptions, knownMissing);
}
