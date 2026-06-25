/**
 * `computeAtomicUpdate` — pure atomic transform over the three plan
 * source-of-truth docs (`implementation-plan.md` +
 * `implementation-plan-table.md` + `implementation-log.md`). Tests the
 * commit-only-on-full-success invariant: either every in-memory step
 * lands or NOTHING does (the production wrapper `updatePlanIteration`
 * then commits the in-memory results to disk only on `ok:true`).
 */

import { describe, expect, it } from "vitest";
import {
	OrchestrationFailureReason,
	OrchestrationStep,
	computeAtomicUpdate,
} from "../src/tools/write.ts";
import { IterationStatus } from "../src/types.ts";

const PLAN_FIXTURE = `# Implementation plan

# Infrastructure

## Foundations *(Stage 0)*

- ✅ 0.11 — audit tools.
- 🟡 0.12 — write tools.
`;

const TABLE_FIXTURE = `# Implementation plan — at-a-glance table

| Section | Status | Done | Left |
| ------- | ------ | ---- | ---- |
| Dev-MCP + self-hosting | 🟡 | \`0.11\` audit | \`0.12\` write |
`;

const LOG_FIXTURE = `# Implementation log

## Stage 0 — Self-hosting

### 0.11 — audit tools

✅ DONE (2026-05-20). **Audit tools land.** Coverage + capability diff.
`;

const SOURCES = {
	planSource: PLAN_FIXTURE,
	tableSource: TABLE_FIXTURE,
	logSource: LOG_FIXTURE,
};

describe("computeAtomicUpdate — happy path: plan + table + log all update", () => {
	it("returns ok=true with all three sources reflecting the change", () => {
		const result = computeAtomicUpdate(SOURCES, {
			id: "0.12",
			status: IterationStatus.Done,
			today: "2026-05-25",
			logHeadline: "dev-MCP write tools",
			logBody: "Plan + table + log atomic.",
		});
		expect(result.ok).toBe(true);
		expect(result.planChanged).toBe(true);
		expect(result.tableChanged).toBe(true);
		expect(result.logChanged).toBe(true);
		expect(result.sources.planResult.source).toContain("- ✅ 0.12 — write tools.");
		expect(result.sources.tableResult.source).toContain(
			"| Dev-MCP + self-hosting | ✅ | `0.11` audit | `0.12` write |",
		);
		expect(result.sources.logResult?.source).toContain("### 0.12 — dev-MCP write tools");
	});
});

describe("computeAtomicUpdate — plan-step failure → no other step lands", () => {
	it("unknown id returns ok=false + failedStep=plan and leaves table + log in-memory unchanged", () => {
		const result = computeAtomicUpdate(SOURCES, {
			id: "9.99.99-unknown",
			status: IterationStatus.Done,
			today: "2026-05-25",
			logHeadline: "h",
			logBody: "b.",
		});
		expect(result.ok).toBe(false);
		expect(result.failedStep).toBe(OrchestrationStep.Plan);
		expect(result.reason).toBe(OrchestrationFailureReason.UnknownIterationId);
		expect(result.planChanged).toBe(false);
		expect(result.tableChanged).toBe(false);
		expect(result.logChanged).toBe(false);
		// Critically: the in-memory log source was not modified (the
		// production wrapper would have written this to disk on ok=true).
		expect(result.sources.logResult).toBeNull();
	});
});

describe("computeAtomicUpdate — log-step refusal → plan + table held back", () => {
	it("log-entry-exists returns ok=false + failedStep=log; plan + table NOT marked changed", () => {
		// First land an entry so the second call collides.
		const firstLand = computeAtomicUpdate(SOURCES, {
			id: "0.12",
			status: IterationStatus.Done,
			today: "2026-05-25",
			logHeadline: "h",
			logBody: "b.",
		});
		expect(firstLand.ok).toBe(true);

		const collision = computeAtomicUpdate(
			{
				planSource: firstLand.sources.planResult.source,
				tableSource: firstLand.sources.tableResult.source,
				logSource: firstLand.sources.logResult?.source ?? LOG_FIXTURE,
			},
			{
				id: "0.12",
				status: IterationStatus.Done,
				today: "2026-05-26", // a day later — would collide with prior 0.12 entry
				logHeadline: "h2",
				logBody: "b2.",
			},
		);
		expect(collision.ok).toBe(false);
		expect(collision.failedStep).toBe(OrchestrationStep.Log);
		expect(collision.reason).toBe(OrchestrationFailureReason.LogEntryExists);
		// On refusal, the result reports no changes on disk — even though
		// the pure plan-transform succeeded, the writer must hold it back
		// so the three docs stay consistent.
		expect(collision.planChanged).toBe(false);
		expect(collision.tableChanged).toBe(false);
		expect(collision.logChanged).toBe(false);
	});
});

describe("computeAtomicUpdate — table row missing → best-effort non-fatal", () => {
	it("plan + log still update when the table has no matching row (non-fatal)", () => {
		const tableWithoutRow = "# Table\n\n| Section | Status |\n| ------- | ------ |\n| Other | ✅ |\n";
		const result = computeAtomicUpdate(
			{ planSource: PLAN_FIXTURE, tableSource: tableWithoutRow, logSource: LOG_FIXTURE },
			{
				id: "0.12",
				status: IterationStatus.Done,
				today: "2026-05-25",
				logHeadline: "h",
				logBody: "b.",
			},
		);
		expect(result.ok).toBe(true);
		expect(result.planChanged).toBe(true);
		expect(result.tableChanged).toBe(false); // non-fatal — no row matches
		expect(result.logChanged).toBe(true);
	});
});

describe("computeAtomicUpdate — full no-op replay", () => {
	it("re-running the same call against already-updated sources is a no-op across all three", () => {
		const first = computeAtomicUpdate(SOURCES, {
			id: "0.12",
			status: IterationStatus.Done,
			today: "2026-05-25",
			logHeadline: "h",
			logBody: "b.",
		});
		const second = computeAtomicUpdate(
			{
				planSource: first.sources.planResult.source,
				tableSource: first.sources.tableResult.source,
				logSource: first.sources.logResult?.source ?? LOG_FIXTURE,
			},
			{
				id: "0.12",
				status: IterationStatus.Done,
				today: "2026-05-25",
				logHeadline: "h",
				logBody: "b.",
			},
		);
		expect(second.ok).toBe(true);
		expect(second.planChanged).toBe(false);
		expect(second.tableChanged).toBe(false);
		expect(second.logChanged).toBe(false);
		expect(second.changed).toBe(false);
	});
});

describe("computeAtomicUpdate — backwards-compat without log args", () => {
	it("absent logHeadline/logBody → only plan + table updated; log untouched", () => {
		const result = computeAtomicUpdate(SOURCES, {
			id: "0.12",
			status: IterationStatus.Done,
			today: "2026-05-25",
		});
		expect(result.ok).toBe(true);
		expect(result.planChanged).toBe(true);
		expect(result.tableChanged).toBe(true);
		expect(result.logChanged).toBe(false);
		expect(result.sources.logResult).toBeNull();
	});
});
