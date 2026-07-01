import { describe, expect, it } from "vitest";
import {
	type LogEntryLike,
	UntestedReason,
	auditUntestedIterations,
	findUntestedIterations,
} from "../src/tools/untested-iterations.ts";
import { type Iteration, IterationStatus } from "../src/types.ts";

function iter(partial: Partial<Iteration> & { id: string; status: IterationStatus }): Iteration {
	return {
		stageId: "9",
		body: "",
		app: null,
		domain: null,
		section: null,
		...partial,
	};
}

function log(body: string): LogEntryLike {
	return { title: null, summary: null, body };
}

describe("findUntestedIterations", () => {
	it("passes a Done iteration whose log narrative mentions tests", () => {
		const stages = [
			{ stageId: "9", iterations: [iter({ id: "9.1", status: IterationStatus.Done })] },
		];
		const logs = new Map([["9.1", log("Shipped the grid; added a vitest round-trip suite.")]]);
		const report = findUntestedIterations(stages, logs);
		expect(report.ok).toBe(true);
		expect(report.withTestSignal).toBe(1);
		expect(report.flagged).toEqual([]);
	});

	it("flags a Done code iteration whose log entry mentions no test", () => {
		const stages = [
			{ stageId: "9", iterations: [iter({ id: "9.2", status: IterationStatus.Done })] },
		];
		const logs = new Map([["9.2", log("Refined `apps/notes/src/header.tsx` chrome and spacing.")]]);
		const report = findUntestedIterations(stages, logs);
		expect(report.ok).toBe(false);
		expect(report.flagged).toHaveLength(1);
		expect(report.flagged[0]?.reason).toBe(UntestedReason.LogEntryNoTestMention);
		expect(report.flagged[0]?.hasLogEntry).toBe(true);
	});

	it("flags a Done code iteration with no log entry and a test-less plan body", () => {
		const stages = [
			{
				stageId: "9",
				iterations: [
					iter({ id: "9.3", status: IterationStatus.Done, body: "tweak packages/tokens/src/themes.ts" }),
				],
			},
		];
		const report = findUntestedIterations(stages, new Map());
		expect(report.flagged[0]?.reason).toBe(UntestedReason.NoLogEntry);
		expect(report.flagged[0]?.hasLogEntry).toBe(false);
	});

	it("skips a Done iteration with no test AND no code signal (docs/OQ work)", () => {
		const stages = [
			{
				stageId: "9",
				iterations: [
					iter({ id: "9.3b", status: IterationStatus.Done, body: "resolve OQ-34; reconcile the plan" }),
				],
			},
		];
		const report = findUntestedIterations(stages, new Map());
		expect(report.flagged).toEqual([]);
		expect(report.skippedNoCodeSignal).toBe(1);
		expect(report.considered).toBe(1);
	});

	it("finds the test token in the plan bullet body even with no log entry", () => {
		const stages = [
			{
				stageId: "9",
				iterations: [
					iter({ id: "9.4", status: IterationStatus.Done, body: "add a Playwright assertion" }),
				],
			},
		];
		const report = findUntestedIterations(stages, new Map());
		expect(report.ok).toBe(true);
		expect(report.flagged).toEqual([]);
	});

	it("ignores non-Done iterations by default, honours an explicit status set", () => {
		const stages = [
			{
				stageId: "9",
				iterations: [
					iter({ id: "9.5", status: IterationStatus.Pending, body: "scaffold apps/x/src/index.ts" }),
				],
			},
		];
		expect(findUntestedIterations(stages, new Map()).considered).toBe(0);
		const widened = findUntestedIterations(stages, new Map(), {
			statuses: [IterationStatus.Pending],
		});
		expect(widened.considered).toBe(1);
		expect(widened.flagged).toHaveLength(1);
	});

	it("does not false-positive on 'latest' / 'fastest' substrings", () => {
		const stages = [
			{ stageId: "9", iterations: [iter({ id: "9.6", status: IterationStatus.Done })] },
		];
		const logs = new Map([
			["9.6", log("Bumped `packages/shell` to the latest deps for the fastest startup.")],
		]);
		expect(findUntestedIterations(stages, logs).flagged).toHaveLength(1);
	});
});

describe("auditUntestedIterations (live docs smoke)", () => {
	it("runs against the real plan + log and returns a coherent report", () => {
		const report = auditUntestedIterations();
		expect(report.considered).toBeGreaterThan(0);
		expect(report.withTestSignal + report.skippedNoCodeSignal + report.flagged.length).toBe(
			report.considered,
		);
		for (const f of report.flagged) {
			expect(f.id).toBeTruthy();
			expect([UntestedReason.LogEntryNoTestMention, UntestedReason.NoLogEntry]).toContain(f.reason);
		}
	});
});
