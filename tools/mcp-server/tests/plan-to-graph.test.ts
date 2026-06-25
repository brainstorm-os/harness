import { describe, expect, it } from "vitest";
import { SubjectKind } from "../../../apps/graph/src/types/pattern.ts";
import { buildPlanGraphState } from "../src/seed/plan-to-graph.ts";

describe("buildPlanGraphState", () => {
	const state = buildPlanGraphState();

	it("seeds a v7 graph:state with ONE linear Plan subject (no cartesian join)", () => {
		expect(state.version).toBe(7);
		// Exactly one subject — the matcher is O(entities^subjects); the
		// prior six-subject join over a real vault was the cost-cap
		// explosion that painted nothing.
		expect(Object.keys(state.pattern.subjects)).toEqual(["P"]);
		expect(state.pattern.primarySubject).toBe("P");
		expect(state.pattern.edges).toEqual([]);
	});

	it("scopes the Plan subject to all six self-hosting types", () => {
		expect(state.pattern.subjects.P?.types).toEqual([
			"brainstorm/Release/v1",
			"brainstorm/Milestone/v1",
			"brainstorm/Stage/v1",
			"brainstorm/Iteration/v1",
			"brainstorm/OpenQuestion/v1",
			"brainstorm/DesignDoc/v1",
		]);
	});

	it("uses the EXACT apps/graph wire enum value for subject kind (drift guard)", () => {
		expect(state.pattern.subjects.P?.kind).toBe(SubjectKind.Entity);
	});

	it("shows unmatched nodes so an unlinked plan item still renders", () => {
		expect(state.settings).toEqual({
			showUnmatched: true,
			showLabels: true,
			showArrows: true,
			showIcons: true,
			reveal: "eased",
		});
	});

	it("is deterministic", () => {
		expect(buildPlanGraphState()).toEqual(state);
	});
});
