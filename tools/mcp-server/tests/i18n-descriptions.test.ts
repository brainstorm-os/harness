import { describe, expect, it } from "vitest";
import {
	findDescriptionCoverage,
	readShellDescriptionCoverage,
} from "../src/tools/i18n-descriptions-check.ts";

describe("findDescriptionCoverage", () => {
	it("passes when every catalog key is described or grandfathered", () => {
		const r = findDescriptionCoverage({ "a.b": "A", "c.d": "C" }, { "a.b": "describes A" }, ["c.d"]);
		expect(r).toEqual({ missing: [], staleGrandfathered: [], orphanDescriptions: [] });
	});

	it("flags a new key that is neither described nor grandfathered", () => {
		const r = findDescriptionCoverage({ "a.b": "A", "new.key": "New" }, { "a.b": "x" }, []);
		expect(r.missing).toEqual(["new.key"]);
	});

	it("treats an empty / whitespace description as missing", () => {
		const r = findDescriptionCoverage({ "a.b": "A" }, { "a.b": "   " }, []);
		expect(r.missing).toEqual(["a.b"]);
	});

	it("flags a grandfathered key that has since gained a description (stale)", () => {
		const r = findDescriptionCoverage({ "a.b": "A" }, { "a.b": "now described" }, ["a.b"]);
		expect(r.missing).toEqual([]);
		expect(r.staleGrandfathered).toEqual(["a.b"]);
	});

	it("flags a grandfathered key that no longer exists in the catalog (stale)", () => {
		const r = findDescriptionCoverage({ "a.b": "A" }, { "a.b": "x" }, ["removed.key"]);
		expect(r.staleGrandfathered).toEqual(["removed.key"]);
	});

	it("flags a description with no matching catalog key (orphan)", () => {
		const r = findDescriptionCoverage({ "a.b": "A" }, { "a.b": "x", "gone.key": "y" }, []);
		expect(r.orphanDescriptions).toEqual(["gone.key"]);
	});
});

describe("shell i18n description coverage gate", () => {
	const coverage = readShellDescriptionCoverage();

	it("has no undescribed, non-grandfathered catalog keys (new strings need a description)", () => {
		expect(coverage.missing).toEqual([]);
	});

	it("has no stale grandfather entries (prune en.descriptions.known-missing.json as you describe keys)", () => {
		expect(coverage.staleGrandfathered).toEqual([]);
	});

	it("has no orphan descriptions (every en.descriptions.json key exists in en.json)", () => {
		expect(coverage.orphanDescriptions).toEqual([]);
	});
});
