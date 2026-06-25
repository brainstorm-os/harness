import { describe, expect, it } from "vitest";
import {
	type IterationListing,
	filterIterations,
	filterOpenQuestions,
} from "../src/tools/search.ts";
import { type Iteration, IterationStatus, OQStatus, type OpenQuestion } from "../src/types.ts";

function iter(
	id: string,
	stageId: string,
	status: IterationStatus,
	body = "summary line",
): Iteration {
	return { id, stageId, status, body };
}

const STAGE_9_ITERATIONS: Iteration[] = [
	iter("9.6", "9", IterationStatus.Partial, "Notes app — heavy progress."),
	iter("9.12.1.5", "9", IterationStatus.Done, "Database preview drop landed."),
	iter("9.13.1", "9", IterationStatus.Done, "Graph scaffold."),
	iter("9.14.1", "9", IterationStatus.Done, "Tasks scaffold."),
	iter("9.7", "9", IterationStatus.Pending, "code-editor app — pending."),
];

const STAGES = [
	{
		stageId: "0",
		iterations: [
			iter("0.10", "0", IterationStatus.Done, "MCP server scaffolded."),
			iter("0.11", "0", IterationStatus.Pending, "audit / capability / keyboard tools."),
			iter("0.12", "0", IterationStatus.Pending, "write tools."),
		],
	},
	{
		stageId: "9",
		iterations: STAGE_9_ITERATIONS,
	},
	{
		stageId: "9a",
		iterations: [iter("9a.1", "9a", IterationStatus.Done, "Sub-stage iteration.")],
	},
	{
		stageId: "10",
		iterations: [iter("10.1", "10", IterationStatus.Pending, "Sync transport.")],
	},
];

describe("filterIterations", () => {
	it("returns every iteration flat when no filter is set", () => {
		const result = filterIterations(STAGES);
		expect(result).toHaveLength(10);
	});

	it("filters by status only", () => {
		const result = filterIterations(STAGES, { status: IterationStatus.Pending });
		expect(result.map((r) => r.id)).toEqual(["0.11", "0.12", "9.7", "10.1"]);
	});

	it("filters by exact stage id (also matches sub-stages like 9a)", () => {
		const result = filterIterations(STAGES, { stage: "9" });
		expect(result).toHaveLength(6);
		for (const r of result) expect(r.stageId.startsWith("9")).toBe(true);
	});

	it("does NOT match 10 when stage filter is 1", () => {
		const result = filterIterations(STAGES, { stage: "1" });
		expect(result).toHaveLength(0);
	});

	it("matches the leading-digit prefix so stage 9 matches 9a too", () => {
		const result = filterIterations(STAGES, { stage: "9" });
		const ids = result.map((r) => r.id);
		expect(ids).toContain("9a.1");
	});

	it("composes stage + status filters with AND semantics", () => {
		const result = filterIterations(STAGES, {
			stage: "9",
			status: IterationStatus.Done,
		});
		expect(result.map((r) => r.id).sort()).toEqual(["9.12.1.5", "9.13.1", "9.14.1", "9a.1"]);
	});

	it("treats status='any' as no status filter", () => {
		const result = filterIterations(STAGES, { status: "any" });
		expect(result).toHaveLength(10);
	});

	it("returns summary as the first non-empty line of the iteration body", () => {
		const result: IterationListing[] = filterIterations(STAGES, { stage: "9" });
		const notes = result.find((r) => r.id === "9.6");
		expect(notes?.summary).toBe("Notes app — heavy progress.");
	});

	it("handles empty stages array", () => {
		expect(filterIterations([])).toEqual([]);
	});
});

function oq(
	id: string,
	number: number,
	status: OQStatus,
	where: string | null,
	section = "General",
): OpenQuestion {
	return {
		id,
		number,
		section,
		title: `Title for ${id}`,
		status,
		resolutionRef: status === OQStatus.Resolved ? "implementation-plan Stage 9" : null,
		where,
		question: null,
		options: null,
		leaning: null,
		blocking: null,
		resolution: null,
		body: "",
	};
}

const OQS: OpenQuestion[] = [
	oq("OQ-1", 1, OQStatus.Resolved, "Stage 1"),
	oq("OQ-34", 34, OQStatus.Resolved, "Stages 2 and 3"),
	oq("OQ-72", 72, OQStatus.Open, "Stage 13"),
	oq("OQ-GR-1", 100, OQStatus.Open, "Stage 9"),
	oq("OQ-BK-1", 200, OQStatus.Open, null, "Books"),
];

describe("filterOpenQuestions", () => {
	it("returns every OQ when no filter is set", () => {
		expect(filterOpenQuestions(OQS)).toHaveLength(5);
	});

	it("filters by resolved status", () => {
		const result = filterOpenQuestions(OQS, { status: OQStatus.Resolved });
		expect(result.map((r) => r.id)).toEqual(["OQ-1", "OQ-34"]);
	});

	it("filters by open status", () => {
		const result = filterOpenQuestions(OQS, { status: OQStatus.Open });
		expect(result.map((r) => r.id)).toEqual(["OQ-72", "OQ-GR-1", "OQ-BK-1"]);
	});

	it("filters by stage mention in `where`", () => {
		const result = filterOpenQuestions(OQS, { stage: "9" });
		expect(result.map((r) => r.id)).toEqual(["OQ-GR-1"]);
	});

	it("matches multi-stage `where` strings", () => {
		const result = filterOpenQuestions(OQS, { stage: "2" });
		expect(result.map((r) => r.id)).toEqual(["OQ-34"]);
	});

	it("composes stage + status filters with AND semantics", () => {
		const result = filterOpenQuestions(OQS, { stage: "13", status: OQStatus.Open });
		expect(result.map((r) => r.id)).toEqual(["OQ-72"]);
	});

	it("returns empty when stage filter has no matches", () => {
		expect(filterOpenQuestions(OQS, { stage: "99" })).toHaveLength(0);
	});

	it("propagates resolutionRef for resolved OQs", () => {
		const result = filterOpenQuestions(OQS, { status: OQStatus.Resolved });
		for (const r of result) expect(r.resolutionRef).not.toBeNull();
	});
});
