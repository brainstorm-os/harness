/**
 * Stage 0.11 — unit + snapshot tests for `audit.stage_boundary`.
 *
 *  - Pure-helper unit tests over synthetic stages / OQs cover the
 *    counting / filtering / preview-drop-detection behaviour.
 *  - A baseline snapshot test pins the pre-recorded Stage 0–7
 *    floors against the live `parsePlan` / `parseOpenQuestions`
 *    projections — a stage's `Done`-count or resolved-OQ-count
 *    dropping below baseline fails this test, not a release.
 *  - A "no silent rewrite" check: the baselines map keys are
 *    fixture-locked. Tampering (renaming Stage 3 to Stage 3b in
 *    the baseline) fails the structural pin.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOpenQuestions } from "../src/parse-oqs.ts";
import { parsePlan } from "../src/parse-plan.ts";
import { repoPath } from "../src/repo.ts";
import {
	BaselineDriftKind,
	type IterationCountByStatus,
	type StageBoundarySnapshot,
	countIterationsByStatus,
	countOQsByStatus,
	diffBaseline,
	filterOQsForStage,
	hasPreviewDropIcon,
	snapshotStage,
} from "../src/tools/stage-boundary-audit.ts";
import { STAGE_BOUNDARY_BASELINES, baselineFor } from "../src/tools/stage-boundary-baselines.ts";
import {
	type Iteration,
	IterationStatus,
	OQStatus,
	type OpenQuestion,
	type Stage,
} from "../src/types.ts";

const it_ = (over: Partial<Iteration> & Pick<Iteration, "id" | "status">): Iteration => ({
	stageId: "X",
	body: "",
	app: null,
	...over,
});

const oq_ = (over: Partial<OpenQuestion> & Pick<OpenQuestion, "id" | "status">): OpenQuestion => ({
	number: Number.parseInt(over.id.replace(/[^0-9]/g, ""), 10),
	section: "",
	title: "",
	resolutionRef: null,
	where: null,
	question: null,
	options: null,
	leaning: null,
	blocking: null,
	resolution: null,
	body: "",
	...over,
});

const stage_ = (
	stageId: string,
	iterations: readonly Iteration[],
	over: Partial<Stage> = {},
): Stage => ({
	stageId,
	heading: `Stage ${stageId}`,
	status: IterationStatus.Pending,
	goal: null,
	ownerDomain: null,
	iterations: [...iterations],
	exitCriteria: [],
	body: "",
	...over,
});

describe("countIterationsByStatus", () => {
	it("rolls iteration statuses into the labelled counter", () => {
		const counts: IterationCountByStatus = countIterationsByStatus([
			it_({ id: "a", status: IterationStatus.Done }),
			it_({ id: "b", status: IterationStatus.Done }),
			it_({ id: "c", status: IterationStatus.Partial }),
			it_({ id: "d", status: IterationStatus.Pending }),
			it_({ id: "e", status: IterationStatus.Reverted }),
			it_({ id: "f", status: IterationStatus.Todo }),
			it_({ id: "g", status: IterationStatus.Unknown }),
			it_({ id: "h", status: IterationStatus.PreviewDrop }),
		]);
		expect(counts).toEqual({
			total: 8,
			done: 2,
			partial: 1,
			previewDrop: 1,
			pending: 1,
			reverted: 1,
			todo: 1,
			unknown: 1,
		});
	});

	it("returns the all-zero counter on an empty list", () => {
		expect(countIterationsByStatus([])).toEqual({
			total: 0,
			done: 0,
			partial: 0,
			previewDrop: 0,
			pending: 0,
			reverted: 0,
			todo: 0,
			unknown: 0,
		});
	});
});

describe("countOQsByStatus", () => {
	it("counts open + resolved", () => {
		expect(
			countOQsByStatus([
				oq_({ id: "OQ-1", status: OQStatus.Open }),
				oq_({ id: "OQ-2", status: OQStatus.Resolved }),
				oq_({ id: "OQ-3", status: OQStatus.Resolved }),
			]),
		).toEqual({ total: 3, open: 1, resolved: 2 });
	});
});

describe("hasPreviewDropIcon", () => {
	it("matches an iteration whose status is PreviewDrop", () => {
		expect(
			hasPreviewDropIcon(
				it_({ id: "9.13.1.5", status: IterationStatus.PreviewDrop, body: "preview — gate: 9.13.5" }),
			),
		).toBe(true);
	});

	it("matches a PreviewDrop iteration regardless of body content", () => {
		expect(
			hasPreviewDropIcon(
				it_({ id: "9.5.2", status: IterationStatus.PreviewDrop, body: "thing — BLOCKED: 9.5.1" }),
			),
		).toBe(true);
	});

	it("does NOT match a Done iteration", () => {
		expect(
			hasPreviewDropIcon(it_({ id: "9.1", status: IterationStatus.Done, body: "gate: 9.2" })),
		).toBe(false);
	});

	it("does NOT match a generic 🟡 Partial (post-0.12 ◑ is its own status)", () => {
		expect(
			hasPreviewDropIcon(
				it_({ id: "x", status: IterationStatus.Partial, body: "in flight, no gate yet." }),
			),
		).toBe(false);
	});
});

describe("filterOQsForStage", () => {
	it("matches OQs whose `where` mentions the stage", () => {
		const out = filterOQsForStage(
			[
				oq_({ id: "OQ-1", status: OQStatus.Open, where: "Blocks Stage 3 boundary." }),
				oq_({ id: "OQ-2", status: OQStatus.Open, where: "Stage 9 only." }),
			],
			"3",
		);
		expect(out.map((q) => q.id)).toEqual(["OQ-1"]);
	});

	it("rejects substring false positives (Stage 3 vs Stage 30)", () => {
		const out = filterOQsForStage(
			[
				oq_({ id: "OQ-1", status: OQStatus.Open, where: "Stage 30." }),
				oq_({ id: "OQ-2", status: OQStatus.Open, where: "Stage 3." }),
			],
			"3",
		);
		expect(out.map((q) => q.id)).toEqual(["OQ-2"]);
	});

	it("matches the trailing-letter style (Stage 5b)", () => {
		const out = filterOQsForStage(
			[
				oq_({ id: "OQ-9", status: OQStatus.Open, where: "Stage 5b boundary." }),
				oq_({ id: "OQ-10", status: OQStatus.Open, where: "Stage 5 only." }),
			],
			"5b",
		);
		expect(out.map((q) => q.id)).toEqual(["OQ-9"]);
	});
});

describe("snapshotStage", () => {
	it("rolls iteration counts + OQ counts + preview-drop ids into a single snapshot", () => {
		const stage = stage_(
			"9",
			[
				it_({ id: "9.1", status: IterationStatus.Done }),
				it_({ id: "9.2", status: IterationStatus.PreviewDrop, body: "preview — gate: 9.3" }),
				it_({ id: "9.3", status: IterationStatus.Pending }),
			],
			{ status: IterationStatus.Partial, heading: "Stage 9 — Apps" },
		);
		const oqs = [
			oq_({ id: "OQ-1", status: OQStatus.Resolved, where: "Stage 9 only." }),
			oq_({ id: "OQ-2", status: OQStatus.Open, where: "Stage 9 only." }),
			oq_({ id: "OQ-3", status: OQStatus.Open, where: "Stage 10." }),
		];

		const snap: StageBoundarySnapshot = snapshotStage(stage, oqs);
		expect(snap.stageId).toBe("9");
		expect(snap.heading).toBe("Stage 9 — Apps");
		expect(snap.status).toBe(IterationStatus.Partial);
		expect(snap.iterations.done).toBe(1);
		expect(snap.iterations.previewDrop).toBe(1);
		expect(snap.iterations.pending).toBe(1);
		expect(snap.previewDropIds).toEqual(["9.2"]);
		expect(snap.openQuestions).toEqual({ total: 2, open: 1, resolved: 1 });
		expect(snap.openQuestionIds.open).toEqual(["OQ-2"]);
		expect(snap.openQuestionIds.resolved).toEqual(["OQ-1"]);
	});
});

describe("diffBaseline", () => {
	const snap = (over: Partial<StageBoundarySnapshot>): StageBoundarySnapshot => ({
		stageId: "3",
		heading: "Stage 3",
		status: IterationStatus.Done,
		iterations: {
			total: 1,
			done: 1,
			partial: 0,
			previewDrop: 0,
			pending: 0,
			reverted: 0,
			todo: 0,
			unknown: 0,
		},
		previewDropIds: [],
		openQuestions: { total: 3, open: 0, resolved: 3 },
		openQuestionIds: { open: [], resolved: ["OQ-1", "OQ-2", "OQ-3"] },
		...over,
	});

	it("returns [] when snapshot matches the baseline floor", () => {
		expect(
			diffBaseline(snap({}), {
				stageId: "3",
				recordedAt: "2026-05-20",
				expectedStatus: IterationStatus.Done,
				expectedDoneCount: 1,
				expectedResolvedOQCount: 3,
			}),
		).toEqual([]);
	});

	it("returns [] when snapshot exceeds the baseline (debt being burned down)", () => {
		const ahead = snap({
			iterations: { ...snap({}).iterations, done: 5, total: 5 },
			openQuestions: { total: 4, open: 0, resolved: 4 },
			openQuestionIds: { open: [], resolved: ["OQ-1", "OQ-2", "OQ-3", "OQ-4"] },
		});
		expect(
			diffBaseline(ahead, {
				stageId: "3",
				recordedAt: "2026-05-20",
				expectedStatus: IterationStatus.Done,
				expectedDoneCount: 1,
				expectedResolvedOQCount: 3,
			}),
		).toEqual([]);
	});

	it("reports StatusRegressed when a Done baseline is now Partial", () => {
		const drift = diffBaseline(snap({ status: IterationStatus.Partial }), {
			stageId: "3",
			recordedAt: "2026-05-20",
			expectedStatus: IterationStatus.Done,
			expectedDoneCount: 1,
			expectedResolvedOQCount: 3,
		});
		expect(drift.some((d) => d.kind === BaselineDriftKind.StatusRegressed)).toBe(true);
	});

	it("reports DoneCountRegressed when done count drops below baseline", () => {
		const drift = diffBaseline(
			snap({
				iterations: { ...snap({}).iterations, done: 0, total: 1, pending: 1 },
			}),
			{
				stageId: "3",
				recordedAt: "2026-05-20",
				expectedStatus: IterationStatus.Done,
				expectedDoneCount: 1,
				expectedResolvedOQCount: 3,
			},
		);
		expect(drift.some((d) => d.kind === BaselineDriftKind.DoneCountRegressed)).toBe(true);
	});

	it("reports ResolvedOQCountRegressed when resolved OQ count drops", () => {
		const drift = diffBaseline(
			snap({
				openQuestions: { total: 3, open: 1, resolved: 2 },
			}),
			{
				stageId: "3",
				recordedAt: "2026-05-20",
				expectedStatus: IterationStatus.Done,
				expectedDoneCount: 1,
				expectedResolvedOQCount: 3,
			},
		);
		expect(drift.some((d) => d.kind === BaselineDriftKind.ResolvedOQCountRegressed)).toBe(true);
	});

	it("reports NoBaseline when no baseline is pinned", () => {
		const drift = diffBaseline(snap({ stageId: "11c" }), null);
		expect(drift).toHaveLength(1);
		expect(drift[0]?.kind).toBe(BaselineDriftKind.NoBaseline);
	});
});

describe("baselineFor", () => {
	it("returns the pinned baseline for Stages 0–7", () => {
		for (const id of ["0", "1", "2", "3", "4", "5", "5b", "6", "7a", "7b"]) {
			const b = baselineFor(id);
			expect(b, `Baseline for Stage ${id}`).not.toBeNull();
			expect(b?.stageId).toBe(id);
		}
	});

	it("returns null for stages with no pinned baseline", () => {
		expect(baselineFor("11c")).toBeNull();
		expect(baselineFor("99")).toBeNull();
	});
});

describe("STAGE_BOUNDARY_BASELINES is fixture-locked", () => {
	it("pins exactly the Stages 0–7 set (no silent rewrite)", () => {
		// Snapshot of expected keys — any drift here is intentional
		// and must update this assertion in the same PR.
		expect(Object.keys(STAGE_BOUNDARY_BASELINES).sort()).toEqual([
			"0",
			"1",
			"2",
			"3",
			"4",
			"5",
			"5b",
			"6",
			"7a",
			"7b",
		]);
	});

	it("baseline objects are frozen", () => {
		// Object.freeze + an inner attempt-to-mutate should throw in
		// strict mode (which vitest runs in). The outer record is
		// frozen via `Object.freeze`; nested entries are object literals,
		// frozen-shallow is enough for the silent-rewrite gate.
		expect(Object.isFrozen(STAGE_BOUNDARY_BASELINES)).toBe(true);
	});
});

// ─── Live-repo snapshot pinning (the real audit) ──────────────────────────────

describe("live audit — Stages 0–7 baselines hold against current repo", () => {
	const plan = parsePlan(readFileSync(repoPath("docs/implementation-plan.md"), "utf8"));
	const oqs = parseOpenQuestions(
		readFileSync(repoPath("docs/reference/11-open-questions.md"), "utf8"),
	);

	for (const stageId of ["0", "1", "2", "3", "4", "5", "5b", "6", "7a", "7b"]) {
		it(`Stage ${stageId} — no baseline drift`, () => {
			const stage = plan.stages.find((s) => s.stageId === stageId);
			expect(
				stage,
				`Stage ${stageId} must exist in the parsed plan for the baseline to apply`,
			).toBeDefined();
			if (!stage) return;
			const snap = snapshotStage(stage, oqs.questions);
			const baseline = baselineFor(stageId);
			const drift = diffBaseline(snap, baseline);
			expect(
				drift,
				`Stage ${stageId} regressed against the 2026-05-20 baseline:\n${drift
					.map((d) => `  - ${d.kind}: ${d.detail}`)
					.join("\n")}`,
			).toEqual([]);
		});
	}
});
