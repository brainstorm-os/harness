import { describe, expect, it } from "vitest";
import { parseCoverageText } from "../src/tools/coverage.ts";
import { findBareStrings } from "../src/tools/i18n.ts";
import { parseSizeOutput } from "../src/tools/size.ts";

describe("parseCoverageText", () => {
	const sample = `
File                     | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------------|---------|----------|---------|---------|------------------
All files                |   88.21 |    78.45 |   91.66 |   88.21 |
 packages/shell          |   92.00 |    85.00 |   95.00 |   92.00 |
 packages/sdk            |   75.00 |    70.00 |   80.00 |   75.00 |
 tools/mcp-server        |   85.00 |    80.00 |   90.00 |   85.00 |
`;

	it("parses overall totals", () => {
		const report = parseCoverageText(sample);
		expect(report.overall?.lines).toBe(88.21);
		expect(report.overall?.statements).toBe(88.21);
	});

	it("flags packages below their per-package floor", () => {
		const report = parseCoverageText(sample);
		expect(report.belowFloor.map((p) => p.name)).toEqual(["@brainstorm/sdk"]);
	});

	it("applies the shell floor of 85 / sdk floor of 80 / default 70", () => {
		const report = parseCoverageText(sample);
		expect(report.packages.find((p) => p.name === "@brainstorm/shell")?.floor).toBe(85);
		expect(report.packages.find((p) => p.name === "@brainstorm/sdk")?.floor).toBe(80);
		expect(report.packages.find((p) => p.name === "@brainstorm/mcp-server")?.floor).toBe(80);
	});

	it("filters to a single package when scoped", () => {
		const report = parseCoverageText(sample, "@brainstorm/sdk");
		expect(report.packages).toHaveLength(1);
		expect(report.packages[0]?.name).toBe("@brainstorm/sdk");
	});

	it("handles empty input gracefully", () => {
		const report = parseCoverageText("");
		expect(report.overall).toBeNull();
		expect(report.packages).toHaveLength(0);
	});
});

describe("parseSizeOutput", () => {
	it("parses size-limit JSON", () => {
		const stdout = JSON.stringify([
			{ name: "renderer js", size: 102400, sizeLimit: 153600, passed: true },
			{ name: "renderer css", size: 25000, sizeLimit: 20480, passed: false },
		]);
		const report = parseSizeOutput(stdout, "");
		expect(report.entries).toHaveLength(2);
		expect(report.overBudget).toHaveLength(1);
		expect(report.overBudget[0]?.name).toBe("renderer css");
	});

	it("returns an empty report when no JSON is present", () => {
		const report = parseSizeOutput("plain text", "");
		expect(report.entries).toHaveLength(0);
	});
});

describe("findBareStrings", () => {
	it("flags bare JSX text as well-formed hints (not gates)", () => {
		// Contract, not a pinned string: this grep tool is a coarse hint
		// ("false positives expected"); 12.2's AST `findHardcodedJsxText`
		// is the precise CI gate. Pinning a specific repo string was the
		// anti-pattern — 12.2 legitimately wraps such strings in t(),
		// which re-breaks any pin. Assert it surfaces *some* well-formed
		// human-text hits instead.
		const findings = findBareStrings("packages/shell/src/renderer/ui");
		expect(findings.length).toBeGreaterThan(0);
		for (const f of findings) {
			expect(f.text.length).toBeGreaterThanOrEqual(2);
			expect(/[A-Za-z]/.test(f.text)).toBe(true);
			expect(f.file.endsWith(".tsx")).toBe(true);
		}
	});

	it("ignores empty / short / numeric-only text", () => {
		const findings = findBareStrings("packages/shell/src/renderer/ui");
		for (const f of findings) {
			expect(f.text.length).toBeGreaterThanOrEqual(2);
			expect(/^\d+$/.test(f.text)).toBe(false);
		}
	});
});
