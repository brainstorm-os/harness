import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOpenQuestions } from "../src/parse-oqs.ts";
import { repoPath } from "../src/repo.ts";
import { OQStatus } from "../src/types.ts";

const oqSource = readFileSync(repoPath("docs/reference/11-open-questions.md"), "utf8");

describe("parseOpenQuestions", () => {
	const projection = parseOpenQuestions(oqSource);

	it("finds every OQ entry", () => {
		expect(projection.questions.length).toBeGreaterThan(100);
	});

	it("marks resolved OQs as resolved", () => {
		const oq1 = projection.questions.find((q) => q.id === "OQ-1");
		expect(oq1?.status).toBe(OQStatus.Resolved);
		expect(oq1?.resolutionRef).toBe("16");
	});

	it("treats open OQs as open", () => {
		// Read against the LIVE doc, so don't pin a specific id (they get
		// resolved over time — OQ-6 did). Assert the parser produces open
		// statuses at all; OQ-1's resolved case is covered above.
		expect(projection.questions.some((q) => q.status === OQStatus.Open)).toBe(true);
	});

	it("extracts the Where / Question / Resolution bullets", () => {
		const oq1 = projection.questions.find((q) => q.id === "OQ-1");
		expect(oq1?.where).toContain("01-vision.md");
		expect(oq1?.resolution).toContain("sovereign");
	});

	it("captures section names", () => {
		expect(projection.sections).toContain("Vision");
		expect(projection.sections).toContain("App model");
	});

	it("is deterministic", () => {
		const a = JSON.stringify(parseOpenQuestions(oqSource));
		const b = JSON.stringify(parseOpenQuestions(oqSource));
		expect(a).toBe(b);
	});
});

describe("parseOpenQuestions property: random insertions don't drop OQs", () => {
	it("recovers all OQ ids after sprinkling blank lines / comments", () => {
		const baseline = parseOpenQuestions(oqSource).questions.map((q) => q.id);
		const rng = mulberry32(0xabcdef);
		for (let i = 0; i < 50; i++) {
			const mutated = sprinkleNoise(oqSource, rng);
			const got = parseOpenQuestions(mutated).questions.map((q) => q.id);
			expect(got).toEqual(baseline);
		}
	});
});

function mulberry32(seed: number) {
	let state = seed >>> 0;
	return () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function sprinkleNoise(src: string, rng: () => number): string {
	const lines = src.split("\n");
	const out: string[] = [];
	for (const line of lines) {
		if (rng() < 0.03) out.push("");
		if (rng() < 0.01) out.push("<!-- noise -->");
		out.push(line);
	}
	return out.join("\n");
}
