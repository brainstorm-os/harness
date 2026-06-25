/**
 * Stage 0.11 — pinned per-stage baselines for `audit.stage_boundary`.
 *
 * Each baseline records the **floor** for a stage at the date the
 * baseline was first sealed: `expectedStatus`, the `Done`-iteration
 * count, the resolved-OQ count. A later run of the live audit
 * compares against these floors; a drift downward (status regressed,
 * Done count dropped, resolved-OQ count dropped) is a structurally
 * failing assertion, not a vibes-check.
 *
 * Drift *up* is normal — a stage's debt is being burned down as
 * follow-up work lands; the audit doc for the boundary doesn't move
 * backward.
 *
 * Sources for the seed numbers (snapshotted live from this
 * repo on 2026-05-20, the date 0.11 lands):
 *
 *   Stage  status   done/total  resolvedOQ
 *   0      partial   9/11         1
 *   1      done      1/1          0
 *   2      done      2/2          1
 *   3      done      1/1          3
 *   4      done      1/1          0
 *   5      done      1/1          0
 *   5b     partial   3/4          1
 *   6      partial   2/3          0
 *   7a     done      2/2          0
 *   7b     partial   5/6          0
 *
 * Stages 0–7 are the "infrastructure spine" per the plan (Stage 0–4
 * shipped before the 0.x dev-MCP track; 5/5b/6 are the SDK + host
 * services half; 7a/7b are the dashboard + theme bundle). The
 * `Partial` rows (0, 5b, 6, 7b) carry follow-up iterations that
 * will close out before their boundary audit gets re-run; the
 * baseline pins what's *already* done, and a regression there is the
 * failure class the audit is designed to catch.
 */

import { IterationStatus } from "../types.ts";
import type { StageBaseline } from "./stage-boundary-audit.ts";

export const STAGE_BOUNDARY_BASELINES: Readonly<Record<string, StageBaseline>> = Object.freeze({
	"0": {
		stageId: "0",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Partial,
		expectedDoneCount: 9,
		expectedResolvedOQCount: 1,
	},
	"1": {
		stageId: "1",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Done,
		expectedDoneCount: 1,
		expectedResolvedOQCount: 0,
	},
	"2": {
		stageId: "2",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Done,
		expectedDoneCount: 2,
		expectedResolvedOQCount: 1,
	},
	"3": {
		stageId: "3",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Done,
		expectedDoneCount: 1,
		expectedResolvedOQCount: 3,
	},
	"4": {
		stageId: "4",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Done,
		expectedDoneCount: 1,
		expectedResolvedOQCount: 0,
	},
	"5": {
		stageId: "5",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Done,
		expectedDoneCount: 1,
		expectedResolvedOQCount: 0,
	},
	"5b": {
		stageId: "5b",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Partial,
		expectedDoneCount: 3,
		expectedResolvedOQCount: 1,
	},
	"6": {
		stageId: "6",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Partial,
		expectedDoneCount: 2,
		expectedResolvedOQCount: 0,
	},
	"7a": {
		stageId: "7a",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Done,
		expectedDoneCount: 2,
		expectedResolvedOQCount: 0,
	},
	"7b": {
		stageId: "7b",
		recordedAt: "2026-05-20",
		expectedStatus: IterationStatus.Partial,
		expectedDoneCount: 5,
		expectedResolvedOQCount: 0,
	},
});

/** Lookup a baseline by stage id. Returns `null` for stages with no
 *  pinned baseline (post-Stage-7 work, ad-hoc audit runs). */
export function baselineFor(stageId: string): StageBaseline | null {
	return STAGE_BOUNDARY_BASELINES[stageId] ?? null;
}
