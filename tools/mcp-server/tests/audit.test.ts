import { describe, expect, it } from "vitest";
import {
	parseLintOutput,
	parseTypecheckOutput,
	parseVitestJsonReport,
} from "../src/tools/audit.ts";

const ALL_GREEN = JSON.stringify({
	numTotalTestSuites: 3,
	numTotalTests: 12,
	numPassedTests: 12,
	numFailedTests: 0,
	numPendingTests: 0,
	startTime: 1_700_000_000_000,
	testResults: [
		{
			name: "/repo/packages/sdk/src/runtime.test.ts",
			status: "passed",
			startTime: 1_700_000_000_000,
			endTime: 1_700_000_000_050,
			assertionResults: [
				{ fullName: "runtime > dispatches an envelope", status: "passed" },
				{ fullName: "runtime > returns Unavailable when no preload", status: "passed" },
			],
		},
		{
			name: "/repo/apps/tasks/src/logic/date-buckets.test.ts",
			status: "passed",
			startTime: 1_700_000_000_010,
			endTime: 1_700_000_000_120,
			assertionResults: [{ fullName: "groupByScheduledDate buckets ascending", status: "passed" }],
		},
		{
			name: "/repo/apps/notes/src/editor/extract-references.test.ts",
			status: "passed",
			startTime: 1_700_000_000_005,
			endTime: 1_700_000_000_200,
			assertionResults: [],
		},
	],
});

const ONE_FAILURE = JSON.stringify({
	numTotalTestSuites: 2,
	numTotalTests: 5,
	numPassedTests: 3,
	numFailedTests: 2,
	numPendingTests: 0,
	startTime: 1_700_000_000_000,
	testResults: [
		{
			name: "/repo/packages/shell/src/main/storage/sqlite.test.ts",
			status: "passed",
			startTime: 1_700_000_000_000,
			endTime: 1_700_000_000_080,
			assertionResults: [{ fullName: "sqlite > opens a db", status: "passed" }],
		},
		{
			name: "/repo/apps/tasks/src/logic/compile-surface.test.ts",
			status: "failed",
			startTime: 1_700_000_000_005,
			endTime: 1_700_000_000_400,
			assertionResults: [
				{ fullName: "compileSurface > Inbox passes", status: "passed" },
				{
					fullName: "compileSurface > overdue cuts through project",
					status: "failed",
					failureMessages: ["Expected 2 sections, received 1"],
				},
				{
					ancestorTitles: ["compileSurface", "Upcoming"],
					title: "groups by date",
					status: "failed",
					failureMessages: ["AssertionError: arrays not equal", "  at line 42"],
				},
			],
		},
	],
});

const SKIPS_AND_PASS = JSON.stringify({
	numTotalTestSuites: 1,
	numTotalTests: 4,
	numPassedTests: 3,
	numFailedTests: 0,
	numPendingTests: 1,
	startTime: 1_700_000_000_000,
	testResults: [
		{
			name: "/repo/packages/sdk-types/src/recurrence.test.ts",
			status: "passed",
			startTime: 1_700_000_000_000,
			endTime: 1_700_000_000_020,
			assertionResults: [],
		},
	],
});

const NOISY = `[bun] warn: experimental --bun flag\n${ALL_GREEN}\nDone in 1.42s`;

describe("parseVitestJsonReport", () => {
	it("returns ok=true with totals when every file passes", () => {
		const report = parseVitestJsonReport(ALL_GREEN);
		expect(report.ok).toBe(true);
		expect(report.totalFiles).toBe(3);
		expect(report.totalTests).toBe(12);
		expect(report.passed).toBe(12);
		expect(report.failed).toBe(0);
		expect(report.failingFiles).toHaveLength(0);
	});

	it("computes durationMs from latest endTime minus startTime", () => {
		const report = parseVitestJsonReport(ALL_GREEN);
		expect(report.durationMs).toBe(200);
	});

	it("returns ok=false and lists failing files + assertions on failure", () => {
		const report = parseVitestJsonReport(ONE_FAILURE);
		expect(report.ok).toBe(false);
		expect(report.totalTests).toBe(5);
		expect(report.failed).toBe(2);
		expect(report.failingFiles).toHaveLength(1);
		const file = report.failingFiles[0];
		expect(file?.name).toContain("compile-surface.test.ts");
		expect(file?.failingTests).toHaveLength(2);
		expect(file?.failingTests[0]?.fullName).toBe("compileSurface > overdue cuts through project");
		expect(file?.failingTests[0]?.message).toBe("Expected 2 sections, received 1");
	});

	it("falls back to ancestorTitles + title when fullName is absent", () => {
		const report = parseVitestJsonReport(ONE_FAILURE);
		const second = report.failingFiles[0]?.failingTests[1];
		expect(second?.fullName).toBe("compileSurface > Upcoming > groups by date");
		expect(second?.message).toContain("AssertionError");
	});

	it("counts skipped via numPendingTests without flipping ok=false", () => {
		const report = parseVitestJsonReport(SKIPS_AND_PASS);
		expect(report.ok).toBe(true);
		expect(report.skipped).toBe(1);
		expect(report.passed).toBe(3);
	});

	it("survives non-JSON noise around the vitest payload", () => {
		const report = parseVitestJsonReport(NOISY);
		expect(report.ok).toBe(true);
		expect(report.totalFiles).toBe(3);
		expect(report.totalTests).toBe(12);
	});

	it("returns an empty failed report when no JSON is present", () => {
		const report = parseVitestJsonReport("nothing parseable here");
		expect(report.ok).toBe(false);
		expect(report.totalFiles).toBe(0);
		expect(report.totalTests).toBe(0);
		expect(report.failingFiles).toHaveLength(0);
	});

	it("skips unrelated JSON objects in the stream and finds the vitest one", () => {
		const interleaved = `${JSON.stringify({ unrelated: true })}\nbefore\n${ALL_GREEN}`;
		const report = parseVitestJsonReport(interleaved);
		expect(report.ok).toBe(true);
		expect(report.totalTests).toBe(12);
	});

	it("preserves the raw output for debugging", () => {
		const report = parseVitestJsonReport(NOISY);
		expect(report.raw).toBe(NOISY);
	});
});

const TSC_CLEAN = "$ tsc --noEmit\n";

const TSC_TWO_ERRORS = `$ tsc --noEmit
packages/shell/src/main/index.ts(42,10): error TS2304: Cannot find name 'foo'.
apps/tasks/src/logic/compile-surface.ts(118,5): error TS2322: Type 'string' is not assignable to type 'number'.
Found 2 errors in 2 files.
`;

const TSC_WITH_INFO = `$ tsc --noEmit
apps/notes/src/editor/extract-text.ts(7,3): error TS6133: 'unused' is declared but its value is never read.
`;

describe("parseTypecheckOutput", () => {
	it("returns ok=true when no error lines are present", () => {
		const report = parseTypecheckOutput(TSC_CLEAN);
		expect(report.ok).toBe(true);
		expect(report.errorCount).toBe(0);
		expect(report.errors).toHaveLength(0);
	});

	it("extracts file + line + column + code + message for each error", () => {
		const report = parseTypecheckOutput(TSC_TWO_ERRORS);
		expect(report.ok).toBe(false);
		expect(report.errorCount).toBe(2);
		expect(report.errors[0]).toEqual({
			file: "packages/shell/src/main/index.ts",
			line: 42,
			column: 10,
			code: "TS2304",
			message: "Cannot find name 'foo'.",
		});
		expect(report.errors[1]).toEqual({
			file: "apps/tasks/src/logic/compile-surface.ts",
			line: 118,
			column: 5,
			code: "TS2322",
			message: "Type 'string' is not assignable to type 'number'.",
		});
	});

	it("captures a single error correctly", () => {
		const report = parseTypecheckOutput(TSC_WITH_INFO);
		expect(report.errorCount).toBe(1);
		expect(report.errors[0]?.code).toBe("TS6133");
	});

	it("ignores summary lines without a `(line,col)` pattern", () => {
		const report = parseTypecheckOutput(TSC_TWO_ERRORS);
		for (const err of report.errors) {
			expect(err.code).toMatch(/^TS\d+$/);
		}
	});

	it("preserves the raw output", () => {
		const report = parseTypecheckOutput(TSC_TWO_ERRORS);
		expect(report.raw).toBe(TSC_TWO_ERRORS);
	});
});

const BIOME_CLEAN = JSON.stringify({
	diagnostics: [],
	summary: { errors: 0, warnings: 0 },
});

const BIOME_TWO_ERRORS = JSON.stringify({
	diagnostics: [
		{
			category: "lint/suspicious/noShadowRestrictedNames",
			severity: "error",
			description: 'Do not shadow the global "escape" property.',
			location: {
				path: { file: "tools/mcp-server/src/tools/audit.ts" },
				span: [200, 206],
				sourceCode: `${"x\n".repeat(20)}let escape`,
			},
		},
		{
			category: "format",
			severity: "error",
			description: "Formatter would have printed differently.",
			location: {
				path: { file: "tools/mcp-server/tests/audit.test.ts" },
				span: [0, 1],
				sourceCode: "import { x } from 'y';",
			},
		},
	],
	summary: { errors: 2, warnings: 0 },
});

const BIOME_WITH_WARNING = JSON.stringify({
	diagnostics: [
		{
			category: "lint/style/noNonNullAssertion",
			severity: "warning",
			description: "Forbidden non-null assertion.",
			location: {
				path: "apps/tasks/src/app.ts",
				span: [10, 15],
				sourceCode: "x\nx\nlet y = foo!.bar",
			},
		},
	],
	summary: { errors: 0, warnings: 1 },
});

describe("parseLintOutput", () => {
	it("returns ok=true when no diagnostics are present", () => {
		const report = parseLintOutput(BIOME_CLEAN);
		expect(report.ok).toBe(true);
		expect(report.errorCount).toBe(0);
		expect(report.warningCount).toBe(0);
		expect(report.diagnostics).toHaveLength(0);
	});

	it("extracts rule + severity + message for each error", () => {
		const report = parseLintOutput(BIOME_TWO_ERRORS);
		expect(report.ok).toBe(false);
		expect(report.errorCount).toBe(2);
		expect(report.diagnostics[0]?.rule).toBe("lint/suspicious/noShadowRestrictedNames");
		expect(report.diagnostics[0]?.message).toBe('Do not shadow the global "escape" property.');
		expect(report.diagnostics[1]?.rule).toBe("format");
	});

	it("resolves file path from both object and string `path` shapes", () => {
		const report = parseLintOutput(BIOME_WITH_WARNING);
		expect(report.diagnostics[0]?.file).toBe("apps/tasks/src/app.ts");
		const fromObject = parseLintOutput(BIOME_TWO_ERRORS);
		expect(fromObject.diagnostics[0]?.file).toBe("tools/mcp-server/src/tools/audit.ts");
	});

	it("classifies warning severity without flipping ok=false", () => {
		const report = parseLintOutput(BIOME_WITH_WARNING);
		expect(report.ok).toBe(true);
		expect(report.warningCount).toBe(1);
		expect(report.errorCount).toBe(0);
		expect(report.diagnostics[0]?.severity).toBe("warning");
	});

	it("converts byte-offset spans to line/column using sourceCode", () => {
		const report = parseLintOutput(BIOME_WITH_WARNING);
		const diag = report.diagnostics[0];
		expect(diag?.line).toBe(3);
		expect(diag?.column).toBeGreaterThan(0);
	});

	it("returns an empty failed report when no JSON is present", () => {
		const report = parseLintOutput("plain stderr noise");
		expect(report.ok).toBe(true);
		expect(report.diagnostics).toHaveLength(0);
	});

	it("preserves the raw output", () => {
		const report = parseLintOutput(BIOME_TWO_ERRORS);
		expect(report.raw).toBe(BIOME_TWO_ERRORS);
	});
});
