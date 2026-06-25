import { spawnSync } from "node:child_process";
import { findRepoRoot } from "../repo.ts";

export interface CoverageReport {
	overall: { lines: number; statements: number; functions: number; branches: number } | null;
	packages: PackageCoverage[];
	floor: number;
	belowFloor: PackageCoverage[];
	raw: string;
}

export interface PackageCoverage {
	name: string;
	lines: number;
	statements: number;
	functions: number;
	branches: number;
	floor: number;
	belowFloor: boolean;
}

/**
 * Per-package coverage floors per docs/foundations/35-code-conventions.md
 * §Coverage: shell core ≥85, SDK packages ≥80, first-party apps ≥70.
 * Any name not listed falls back to `DEFAULT_FLOOR` (the apps tier). The
 * literal numbers are pinned by `coverage.test.ts` against the doc so a
 * silent drift between the table here and the documented bar fails the
 * test, not a release.
 */
export const FLOORS: Readonly<Record<string, number>> = Object.freeze({
	"@brainstorm/shell": 85,
	"@brainstorm/sdk": 80,
	"@brainstorm/sdk-types": 80,
	"@brainstorm/react-yjs": 80,
	"@brainstorm/editor": 80,
	"@brainstorm/tokens": 70,
	"@brainstorm/mcp-server": 80,
});
export const DEFAULT_FLOOR = 70;

/**
 * Runs `bun --bun vitest run --coverage --reporter=basic` and parses the
 * v8 text report into structured numbers. Caller can scope to a single
 * package by passing `pkg` (matches the package name from package.json).
 */
export function checkCoverage(pkg?: string): CoverageReport {
	const result = spawnSync(
		"bun",
		["--bun", "vitest", "run", "--coverage", "--reporter=basic", "--silent"],
		{
			cwd: findRepoRoot(),
			encoding: "utf8",
			env: { ...process.env, FORCE_COLOR: "0" },
		},
	);
	const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	return parseCoverageText(raw, pkg);
}

const COVERAGE_HEADER_RE = /^File\s+\|/m;
const TOTALS_RE = /^All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/m;

export function parseCoverageText(raw: string, pkg?: string): CoverageReport {
	const overallMatch = TOTALS_RE.exec(raw);
	const overall = overallMatch
		? {
				statements: Number.parseFloat(overallMatch[1] ?? "0"),
				branches: Number.parseFloat(overallMatch[2] ?? "0"),
				functions: Number.parseFloat(overallMatch[3] ?? "0"),
				lines: Number.parseFloat(overallMatch[4] ?? "0"),
			}
		: null;

	const packages: PackageCoverage[] = [];
	const headerIdx = raw.search(COVERAGE_HEADER_RE);
	if (headerIdx === -1) {
		return { overall, packages, floor: DEFAULT_FLOOR, belowFloor: [], raw };
	}
	const tableSection = raw.slice(headerIdx);
	const lines = tableSection.split("\n");
	let currentPackage: string | null = null;
	for (const line of lines) {
		const dirRow =
			/^\s*(packages|apps|tools)\/([\w-]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/.exec(
				line,
			);
		if (dirRow) {
			const folder = dirRow[1];
			const subdir = dirRow[2];
			currentPackage = workspaceNameFor(folder, subdir);
			const statements = Number.parseFloat(dirRow[3] ?? "0");
			const branches = Number.parseFloat(dirRow[4] ?? "0");
			const functions = Number.parseFloat(dirRow[5] ?? "0");
			const lineCov = Number.parseFloat(dirRow[6] ?? "0");
			const floor = floorFor(currentPackage);
			packages.push({
				name: currentPackage,
				lines: lineCov,
				statements,
				branches,
				functions,
				floor,
				belowFloor: lineCov < floor,
			});
		}
	}
	const filtered = pkg ? packages.filter((p) => p.name === pkg) : packages;
	const belowFloor = filtered.filter((p) => p.belowFloor);
	return { overall, packages: filtered, floor: DEFAULT_FLOOR, belowFloor, raw };
}

/** Map a `(folder, subdir)` from the v8 text report (`packages/sdk`,
 *  `apps/notes`, `tools/mcp-server`) to the workspace package name used
 *  in `FLOORS`. Apps don't carry the `@brainstorm/` prefix (they aren't
 *  workspace-published); packages + tools do. */
export function workspaceNameFor(folder: string, subdir: string): string {
	if (folder === "tools") return `@brainstorm/${subdir}`;
	if (folder === "apps") return subdir;
	return `@brainstorm/${subdir}`;
}

/** The documented floor for a package name; the apps tier (70) when not
 *  in `FLOORS`. */
export function floorFor(name: string): number {
	return FLOORS[name] ?? DEFAULT_FLOOR;
}
