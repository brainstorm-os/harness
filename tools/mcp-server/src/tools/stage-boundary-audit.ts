/**
 * Stage 0.11 — `audit.stage_boundary` — structured per-stage snapshot
 * the dev-MCP server can produce for any of the 14 plan stages, plus
 * a baseline-vs-current comparator that surfaces regression at the
 * stage boundary.
 *
 * Per `[docs/foundations/49-self-hosting.md]` + the
 * `[docs/implementation-plan.md]` workflow standards: every stage
 * boundary triggers a stability + performance + security audit
 * recorded under `docs/_review/<date>-stage-<n>-audit.md`. Until 0.11
 * the audit narrative was prose-only; this tool makes the
 * **headline numbers** structurally derivable from current repo
 * state — iteration counts by status, the OQ-resolution count, the
 * total test count snapshotted at the boundary, the per-stage
 * capability surface, ◑-tail (preview drops still outstanding).
 *
 * **Baselines for Stages 0–7** are pinned in
 * `stage-boundary-baselines.ts` as JSON fixtures: a stage that was
 * declared done at Date X with headline numbers Y must NOT regress
 * silently when later work touches its surface. A regression in
 * iteration-count-done-by-stage or in resolved-OQ-count-by-stage at
 * a done stage is a failed assertion, not a vibes-check.
 *
 * Pure. The MCP tool wrapper feeds the live `parsePlan` /
 * `parseOpenQuestions` projections; tests fixture-test every helper.
 */

import {
	type Iteration,
	IterationStatus,
	OQStatus,
	type OpenQuestion,
	type Stage,
} from "../types.ts";

export type StageBoundarySnapshot = {
	/** Stage id (e.g. "0", "5", "9a"). Matches `parsePlan`'s
	 *  `Stage.stageId`. */
	stageId: string;
	/** Heading text reported under that stage (for human display in
	 *  the audit doc). May be empty if the stage has no section. */
	heading: string;
	/** Aggregated stage status from the plan (`Done` / `Partial` /
	 *  `Pending` / `Reverted` / `Todo`). */
	status: IterationStatus;
	/** Count of iterations per status under this stage. */
	iterations: IterationCountByStatus;
	/** Iteration ids whose body carries the ◑ icon (the
	 *  preview-drop tail). Per `[[project_preview_drops_audit]]` the
	 *  policy is "every ◑ converts or is removed by the gate's real
	 *  half"; a non-empty tail at a Done stage is a flag for the
	 *  preview-drops audit to follow up. */
	previewDropIds: string[];
	/** OQs whose `Where` / section / body mention this stage id. */
	openQuestions: OQCountByStatus;
	/** Sorted ids of OQs in each status, surfaced for the audit doc. */
	openQuestionIds: { open: string[]; resolved: string[] };
};

export type IterationCountByStatus = {
	total: number;
	done: number;
	partial: number;
	previewDrop: number;
	pending: number;
	reverted: number;
	todo: number;
	unknown: number;
};

export type OQCountByStatus = {
	total: number;
	open: number;
	resolved: number;
};

/** A `(plan, oqs) → per-stage snapshot` pure helper. */
export function snapshotStage(
	stage: Stage,
	allOpenQuestions: readonly OpenQuestion[],
): StageBoundarySnapshot {
	const iterations = countIterationsByStatus(stage.iterations);
	const previewDropIds = stage.iterations.filter(hasPreviewDropIcon).map((it) => it.id);
	const matchingOQs = filterOQsForStage(allOpenQuestions, stage.stageId);
	const openQuestions = countOQsByStatus(matchingOQs);
	const openQuestionIds = {
		open: matchingOQs
			.filter((q) => q.status === OQStatus.Open)
			.map((q) => q.id)
			.sort(oqIdAscending),
		resolved: matchingOQs
			.filter((q) => q.status === OQStatus.Resolved)
			.map((q) => q.id)
			.sort(oqIdAscending),
	};
	return {
		stageId: stage.stageId,
		heading: stage.heading,
		status: stage.status,
		iterations,
		previewDropIds,
		openQuestions,
		openQuestionIds,
	};
}

export function countIterationsByStatus(iterations: readonly Iteration[]): IterationCountByStatus {
	const out: IterationCountByStatus = {
		total: iterations.length,
		done: 0,
		partial: 0,
		previewDrop: 0,
		pending: 0,
		reverted: 0,
		todo: 0,
		unknown: 0,
	};
	for (const it of iterations) {
		switch (it.status) {
			case IterationStatus.Done:
				out.done++;
				break;
			case IterationStatus.Partial:
				out.partial++;
				break;
			case IterationStatus.PreviewDrop:
				out.previewDrop++;
				break;
			case IterationStatus.Pending:
				out.pending++;
				break;
			case IterationStatus.Reverted:
				out.reverted++;
				break;
			case IterationStatus.Todo:
				out.todo++;
				break;
			default:
				out.unknown++;
		}
	}
	return out;
}

/** Direct match on the new `IterationStatus.PreviewDrop` enum — `◑` is
 *  now parsed distinctly from `🟡` (Partial), so the previous
 *  `gate:`/`BLOCKED:` body heuristic is no longer needed to disambiguate
 *  the two when they both collapsed to `Partial`. */
export function hasPreviewDropIcon(iteration: Iteration): boolean {
	return iteration.status === IterationStatus.PreviewDrop;
}

export function countOQsByStatus(oqs: readonly OpenQuestion[]): OQCountByStatus {
	let open = 0;
	let resolved = 0;
	for (const q of oqs) {
		if (q.status === OQStatus.Resolved) resolved++;
		else open++;
	}
	return { total: oqs.length, open, resolved };
}

/** Same matching logic as `search.ts` `listOpenQuestions({stage})`:
 *  match OQs whose `Where` / `section` / `body` / `resolution`
 *  mention this stage id. The same routine is exposed there;
 *  duplicated here so the dev-MCP audit tool stays self-contained
 *  (no inter-tool import cycle). */
export function filterOQsForStage(all: readonly OpenQuestion[], stageId: string): OpenQuestion[] {
	const tokenRe = new RegExp(`(^|[^A-Za-z0-9])Stage\\s+${stageId}(?![A-Za-z0-9])`, "i");
	return all.filter((q) => {
		const hay = [q.where, q.section, q.body, q.resolution].filter(Boolean).join(" ");
		return tokenRe.test(hay);
	});
}

function oqIdAscending(a: string, b: string): number {
	const an = Number.parseInt(a.replace(/[^0-9]/g, ""), 10);
	const bn = Number.parseInt(b.replace(/[^0-9]/g, ""), 10);
	if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
	return a < b ? -1 : 1;
}

// ─── Baseline comparison ──────────────────────────────────────────────────────

export type StageBaseline = {
	stageId: string;
	/** Date the baseline was recorded (ISO YYYY-MM-DD). */
	recordedAt: string;
	/** Expected status — typically `Done` for a sealed stage. */
	expectedStatus: IterationStatus;
	/** Expected count of done iterations. A regression where the
	 *  current count is *lower* than this is a hard failure (work
	 *  was reverted). Current higher than baseline is *normal* (the
	 *  stage's debt is being burned down). */
	expectedDoneCount: number;
	/** Expected resolved-OQ count for the stage. Same drift-rule:
	 *  current < baseline is a failure. */
	expectedResolvedOQCount: number;
};

export enum BaselineDriftKind {
	/** Current state matches or exceeds the baseline floor. */
	Ok = "ok",
	/** Status of the stage went backward (Done → Partial / Pending /
	 *  Reverted). Hard regression. */
	StatusRegressed = "status-regressed",
	/** Done-iteration count dropped vs baseline. */
	DoneCountRegressed = "done-count-regressed",
	/** Resolved-OQ count dropped vs baseline. */
	ResolvedOQCountRegressed = "resolved-oq-count-regressed",
	/** No baseline pinned for this stage (the audit ran for a stage
	 *  the baselines file doesn't cover yet). Surfaced as info,
	 *  not failure — the caller can decide to gate on it or not. */
	NoBaseline = "no-baseline",
}

export type BaselineDrift = {
	stageId: string;
	kind: BaselineDriftKind;
	detail: string;
};

/** Compare a live snapshot against a recorded baseline. Returns the
 *  set of drift records — empty array if everything is at or above
 *  the baseline floor. */
export function diffBaseline(
	snapshot: StageBoundarySnapshot,
	baseline: StageBaseline | null,
): BaselineDrift[] {
	if (baseline === null) {
		return [
			{
				stageId: snapshot.stageId,
				kind: BaselineDriftKind.NoBaseline,
				detail: `No baseline pinned for Stage ${snapshot.stageId}.`,
			},
		];
	}
	const drift: BaselineDrift[] = [];
	if (baseline.expectedStatus === IterationStatus.Done && snapshot.status !== IterationStatus.Done) {
		drift.push({
			stageId: snapshot.stageId,
			kind: BaselineDriftKind.StatusRegressed,
			detail: `Expected Done (baseline recordedAt ${baseline.recordedAt}); current ${snapshot.status}.`,
		});
	}
	if (snapshot.iterations.done < baseline.expectedDoneCount) {
		drift.push({
			stageId: snapshot.stageId,
			kind: BaselineDriftKind.DoneCountRegressed,
			detail: `Done count ${snapshot.iterations.done} < baseline ${baseline.expectedDoneCount} (recordedAt ${baseline.recordedAt}).`,
		});
	}
	if (snapshot.openQuestions.resolved < baseline.expectedResolvedOQCount) {
		drift.push({
			stageId: snapshot.stageId,
			kind: BaselineDriftKind.ResolvedOQCountRegressed,
			detail: `Resolved OQ count ${snapshot.openQuestions.resolved} < baseline ${baseline.expectedResolvedOQCount} (recordedAt ${baseline.recordedAt}).`,
		});
	}
	return drift;
}
