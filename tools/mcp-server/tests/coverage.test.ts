/**
 * Pure-helper coverage for `tools/mcp-server/src/tools/coverage.ts`.
 *
 * The dev-MCP `coverage.check` tool pins the per-package coverage floors
 * documented in `docs/foundations/35-code-conventions.md §Coverage` (shell
 * core ≥85, SDK packages ≥80, first-party apps ≥70). Until now the
 * table — and the parser that classifies a package as below-floor — had
 * **zero** tests, so a silent drift between the documented bar and the
 * enforced one was undetectable. This file pins both.
 */

import { describe, expect, it } from "vitest";
import {
	DEFAULT_FLOOR,
	FLOORS,
	floorFor,
	parseCoverageText,
	workspaceNameFor,
} from "../src/tools/coverage.ts";

describe("FLOORS — doc-contract (35-code-conventions §Coverage)", () => {
	it("shell core gates at ≥85", () => {
		expect(FLOORS["@brainstorm/shell"]).toBe(85);
	});

	it("SDK packages gate at ≥80", () => {
		// per the doc table: sdk / sdk-types / react-yjs / editor
		expect(FLOORS["@brainstorm/sdk"]).toBe(80);
		expect(FLOORS["@brainstorm/sdk-types"]).toBe(80);
		expect(FLOORS["@brainstorm/react-yjs"]).toBe(80);
		expect(FLOORS["@brainstorm/editor"]).toBe(80);
	});

	it("first-party apps gate at ≥70 via DEFAULT_FLOOR", () => {
		expect(DEFAULT_FLOOR).toBe(70);
		// apps are not enumerated in FLOORS — they ride DEFAULT_FLOOR
		expect(floorFor("notes")).toBe(70);
		expect(floorFor("graph")).toBe(70);
		expect(floorFor("database")).toBe(70);
	});

	it("dev-tooling and tokens have their declared floors", () => {
		expect(FLOORS["@brainstorm/mcp-server"]).toBe(80);
		expect(FLOORS["@brainstorm/tokens"]).toBe(70);
	});

	it("FLOORS is frozen (drift = a deliberate edit, not a silent mutation)", () => {
		expect(Object.isFrozen(FLOORS)).toBe(true);
	});
});

describe("floorFor", () => {
	it("returns the documented floor for a known package", () => {
		expect(floorFor("@brainstorm/shell")).toBe(85);
		expect(floorFor("@brainstorm/sdk")).toBe(80);
	});

	it("falls back to DEFAULT_FLOOR for an unknown package", () => {
		expect(floorFor("totally-new-app")).toBe(70);
		expect(floorFor("")).toBe(70);
	});
});

describe("workspaceNameFor", () => {
	it("packages/* and tools/* carry the @brainstorm/ prefix", () => {
		expect(workspaceNameFor("packages", "sdk")).toBe("@brainstorm/sdk");
		expect(workspaceNameFor("packages", "shell")).toBe("@brainstorm/shell");
		expect(workspaceNameFor("tools", "mcp-server")).toBe("@brainstorm/mcp-server");
	});

	it("apps/* are bare (not workspace-published)", () => {
		expect(workspaceNameFor("apps", "notes")).toBe("notes");
		expect(workspaceNameFor("apps", "graph")).toBe("graph");
	});
});

const REPORT = `
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |   88.10 |    77.50 |   85.30 |   88.40 |
 packages/shell  |   90.20 |    81.10 |   86.50 |   90.10 |
 packages/sdk    |   82.40 |    71.20 |   78.40 |   82.30 |
 apps/notes      |   75.10 |    66.50 |   72.30 |   75.20 |
 apps/graph      |   62.00 |    55.10 |   58.40 |   61.90 |
 tools/mcp-server|   85.00 |    79.10 |   83.20 |   85.10 |
`;

describe("parseCoverageText", () => {
	it("parses the All-files totals into the overall block", () => {
		const r = parseCoverageText(REPORT);
		expect(r.overall).toEqual({
			statements: 88.1,
			branches: 77.5,
			functions: 85.3,
			lines: 88.4,
		});
	});

	it("attaches the documented floor + flags below-floor packages correctly", () => {
		const r = parseCoverageText(REPORT);
		const byName = Object.fromEntries(r.packages.map((p) => [p.name, p]));
		// shell @ 90.1 ≥ 85 → above floor
		expect(byName["@brainstorm/shell"]).toMatchObject({ floor: 85, belowFloor: false });
		// sdk @ 82.3 ≥ 80 → above floor
		expect(byName["@brainstorm/sdk"]).toMatchObject({ floor: 80, belowFloor: false });
		// apps/notes @ 75.2 ≥ 70 → above floor (apps tier)
		expect(byName.notes).toMatchObject({ floor: 70, belowFloor: false });
		// apps/graph @ 61.9 < 70 → below floor
		expect(byName.graph).toMatchObject({ floor: 70, belowFloor: true });
		// belowFloor[] mirrors the flags
		expect(r.belowFloor.map((p) => p.name)).toEqual(["graph"]);
	});

	it("`pkg` filter scopes packages + belowFloor to that one workspace", () => {
		const r = parseCoverageText(REPORT, "graph");
		expect(r.packages.map((p) => p.name)).toEqual(["graph"]);
		expect(r.belowFloor.map((p) => p.name)).toEqual(["graph"]);
	});

	it("an unparseable / empty input returns a structured empty report", () => {
		const r = parseCoverageText("");
		expect(r.overall).toBeNull();
		expect(r.packages).toEqual([]);
		expect(r.belowFloor).toEqual([]);
	});

	it("a totals-only report keeps `overall` but empties `packages`", () => {
		const r = parseCoverageText("All files | 50.00 | 40.00 | 30.00 | 20.00 |\n(no header table)");
		expect(r.overall).toEqual({ statements: 50, branches: 40, functions: 30, lines: 20 });
		expect(r.packages).toEqual([]);
	});
});
