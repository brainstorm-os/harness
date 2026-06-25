import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { parseHumanSize, parseSizeOutput, readSizeBudgets } from "../src/tools/size.ts";

describe("parseHumanSize", () => {
	it("parses KB / MB / B / decimals / case-insensitively", () => {
		expect(parseHumanSize("270 KB")).toBe(270 * 1024);
		expect(parseHumanSize("1.5 MB")).toBe(Math.round(1.5 * 1024 * 1024));
		expect(parseHumanSize("500 B")).toBe(500);
		expect(parseHumanSize("10kb")).toBe(10 * 1024);
		expect(parseHumanSize("42")).toBe(42); // unitless → bytes
	});

	it("returns 0 for unparseable input", () => {
		expect(parseHumanSize("")).toBe(0);
		expect(parseHumanSize("lots")).toBe(0);
		expect(parseHumanSize("12 zb")).toBe(0); // unknown unit
	});
});

describe("readSizeBudgets — against the real .size-limit.json", () => {
	const budgets = readSizeBudgets(readFileSync(repoPath(".size-limit.json"), "utf8"));

	it("reads every declared budget with bytes + gzip flag", () => {
		expect(budgets.length).toBeGreaterThanOrEqual(7);
		const preload = budgets.find((b) => b.name === "shell preload bundle (raw)");
		expect(preload).toEqual({
			name: "shell preload bundle (raw)",
			limitBytes: 10 * 1024,
			gzip: false,
		});
		// The two renderer budgets are gzipped; everything else is raw.
		const gz = budgets.filter((b) => b.gzip).map((b) => b.name);
		expect(gz.some((n) => n.includes("renderer JS"))).toBe(true);
		expect(gz.some((n) => n.includes("renderer CSS"))).toBe(true);
		expect(budgets.find((b) => b.name.includes("main process"))?.gzip).toBe(false);
	});

	it("degrades to [] on garbage / non-array", () => {
		expect(readSizeBudgets("not json")).toEqual([]);
		expect(readSizeBudgets('{"name":"x"}')).toEqual([]);
		expect(readSizeBudgets('[1, {}, {"limit":"1 KB"}]')).toEqual([]); // no `name`
	});
});

describe("parseSizeOutput", () => {
	const budgets = [
		{ name: "renderer JS (gz)", limitBytes: 276480, gzip: true },
		{ name: "main (raw)", limitBytes: 102400, gzip: false },
	];

	it("parses the JSON array and labels gzip from the matching budget", () => {
		const stdout = JSON.stringify([
			{ name: "renderer JS (gz)", size: 250000, sizeLimit: 276480, passed: true },
			{ name: "main (raw)", size: 90000, sizeLimit: 102400, passed: true },
		]);
		const r = parseSizeOutput(stdout, "", budgets);
		expect(r.parsed).toBe(true);
		expect(r.overBudget).toEqual([]);
		expect(r.entries[0]).toEqual({
			name: "renderer JS (gz)",
			size: 250000,
			limit: 276480,
			gzip: true, // from the budget — NOT the old hardcoded false
			overBudget: false,
		});
		expect(r.entries[1]?.gzip).toBe(false);
	});

	it("flags over-budget entries (passed:false)", () => {
		const stdout = JSON.stringify([
			{ name: "renderer JS (gz)", size: 300000, sizeLimit: 276480, passed: false },
		]);
		const r = parseSizeOutput(stdout, "", budgets);
		expect(r.overBudget.map((e) => e.name)).toEqual(["renderer JS (gz)"]);
		expect(r.entries[0]?.overBudget).toBe(true);
	});

	it("prefers an explicit gzip flag from the JSON entry", () => {
		const stdout = JSON.stringify([{ name: "unknown", size: 1, sizeLimit: 2, gzip: true }]);
		expect(parseSizeOutput(stdout, "").entries[0]?.gzip).toBe(true);
	});

	it("defaults gzip to false when neither JSON nor a budget says otherwise", () => {
		const stdout = JSON.stringify([{ name: "unknown", size: 1, sizeLimit: 2 }]);
		expect(parseSizeOutput(stdout, "").entries[0]?.gzip).toBe(false);
	});

	it("signals parsed:false on non-JSON output — NOT a falsely-clean empty report", () => {
		const r = parseSizeOutput("size-limit ERROR: config not found", "boom", budgets);
		expect(r.parsed).toBe(false);
		expect(r.entries).toEqual([]);
		expect(r.overBudget).toEqual([]);
		expect(r.raw).toContain("ERROR");
		expect(r.raw).toContain("boom");
	});

	it("signals parsed:false on empty output", () => {
		expect(parseSizeOutput("", "").parsed).toBe(false);
	});
});
