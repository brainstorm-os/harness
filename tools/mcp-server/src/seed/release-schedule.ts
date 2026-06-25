/**
 * Release anchor + schedule derivation (SH-15 per
 * docs/foundations/49-self-hosting.md).
 *
 * Pure. Turns the parsed stage list into the one `Release/v1` and the
 * `Milestone/v1` checkpoints that anchor every Arm C app. The release
 * target date is the ONLY hand-set date in the self-hosting model; every
 * milestone date is derived here so the roadmap stays honest as the plan
 * moves. Deterministic in `(stages, iterations, now)` so the seed
 * round-trips byte-for-byte.
 */

import type { SerializedIterationEntity, SerializedStageEntity } from "./brainstorm-project.ts";

/** Brainstorm release this vault tracks. */
export const RELEASE_VERSION = "0.1.0";

/** The single hand-set date: Brainstorm v0.1.0 GA — 2026-09-01 UTC. */
export const RELEASE_TARGET_DATE = Date.UTC(2026, 8, 1, 0, 0, 0);

export const RELEASE_ID = "release-0-1-0";

const DAY = 86_400_000;

export interface SerializedReleaseEntity {
	id: string;
	version: string;
	name: string;
	targetDate: number;
	status: string;
	scopeIncludes: string[];
	scopeExcludes: string[];
	stageIds: string[];
	milestoneIds: string[];
	createdAt: number;
	updatedAt: number;
}

export interface SerializedMilestoneEntity {
	id: string;
	releaseId: string;
	stageId: string | null;
	name: string;
	targetDate: number;
	status: string;
	summary: string;
	createdAt: number;
	updatedAt: number;
}

export interface ReleaseSchedule {
	release: SerializedReleaseEntity;
	milestones: SerializedMilestoneEntity[];
}

function lastCompletionFor(
	stage: SerializedStageEntity,
	iterations: readonly SerializedIterationEntity[],
): number | null {
	let max: number | null = null;
	for (const it of iterations) {
		if (it.stageId !== stage.stageId || it.completedAt == null) continue;
		if (max == null || it.completedAt > max) max = it.completedAt;
	}
	return max;
}

/**
 * Derive the release + its milestones from the parsed stages.
 *
 * - A `done` stage's milestone takes a past `targetDate` from the last
 *   completion among its iterations (fallback `now - 1d`).
 * - The remaining stages are spread evenly across `(now, RELEASE_TARGET_DATE)`
 *   using `(j+1)/(k+1)` so none lands exactly on GA.
 * - A final GA milestone (`stageId: null`) sits exactly on
 *   `RELEASE_TARGET_DATE`.
 * - Dates are clamped non-decreasing in schedule order, so the roadmap is
 *   always monotonic regardless of out-of-order completion dates.
 */
export function deriveReleaseSchedule(
	stages: readonly SerializedStageEntity[],
	iterations: readonly SerializedIterationEntity[],
	now: number,
): ReleaseSchedule {
	const notDone = stages.filter((s) => s.status !== "done");
	const span = RELEASE_TARGET_DATE - now;
	const k = notDone.length;
	let notDoneSeen = 0;
	let prev = Number.NEGATIVE_INFINITY;

	const milestones: SerializedMilestoneEntity[] = [];
	for (const stage of stages) {
		let target: number;
		if (stage.status === "done") {
			target = lastCompletionFor(stage, iterations) ?? now - DAY;
		} else {
			notDoneSeen += 1;
			target = Math.round(now + (span * notDoneSeen) / (k + 1));
		}
		if (target < prev) target = prev;
		prev = target;
		milestones.push({
			id: `milestone-${stage.stageId}`,
			releaseId: RELEASE_ID,
			stageId: stage.id,
			name: `${stage.heading} — gate`,
			targetDate: target,
			status: stage.status,
			summary: stage.goal ?? "",
			createdAt: stage.createdAt,
			updatedAt: stage.updatedAt,
		});
	}

	const allDone = stages.length > 0 && stages.every((s) => s.status === "done");
	const gaUpdatedAt = stages.reduce((m, s) => Math.max(m, s.updatedAt), now);
	milestones.push({
		id: "milestone-ga",
		releaseId: RELEASE_ID,
		stageId: null,
		name: `Brainstorm ${RELEASE_VERSION} — GA`,
		targetDate: RELEASE_TARGET_DATE,
		status: allDone ? "done" : "pending",
		summary: `General availability of Brainstorm ${RELEASE_VERSION}.`,
		createdAt: now - DAY * 30,
		updatedAt: gaUpdatedAt,
	});

	const release: SerializedReleaseEntity = {
		id: RELEASE_ID,
		version: RELEASE_VERSION,
		name: `Brainstorm ${RELEASE_VERSION}`,
		targetDate: RELEASE_TARGET_DATE,
		status: allDone ? "shipped" : "in-progress",
		scopeIncludes: [],
		scopeExcludes: [],
		stageIds: stages.map((s) => s.id),
		milestoneIds: milestones.map((m) => m.id),
		createdAt: now - DAY * 30,
		updatedAt: gaUpdatedAt,
	};

	return { release, milestones };
}

/**
 * Pull the "v1 ships" bullet list + "v1 explicitly does NOT include"
 * sentence out of the plan source. Pure string parsing — no markdown
 * rendering, just the two scope lists the Release entity exposes.
 */
export function parseReleaseScope(planSource: string): {
	includes: string[];
	excludes: string[];
} {
	const lines = planSource.split("\n");
	const includes: string[] = [];
	let inShips = false;
	for (const raw of lines) {
		const line = raw.trim();
		if (/\*\*v1 ships:\*\*/i.test(line)) {
			inShips = true;
			continue;
		}
		if (inShips) {
			if (/does NOT include/i.test(line)) break;
			const m = /^-\s+(.+)$/.exec(line);
			if (m?.[1]) includes.push(clip(stripMd(m[1])));
		}
	}

	let excludes: string[] = [];
	const excludeLine = lines.find((l) => /v1 explicitly does NOT include/i.test(l));
	if (excludeLine) {
		const after = excludeLine.replace(/^.*does NOT include:\*\*/i, "");
		const sentence = (after.split(/\.\s/)[0] ?? after).replace(/\([^)]*\)/g, "");
		excludes = sentence
			.split(",")
			.map((s) => clip(stripMd(s)))
			.filter((s) => s.length > 0)
			.slice(0, 16);
	}

	return { includes, excludes };
}

function stripMd(s: string): string {
	return s
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.trim();
}

function clip(s: string): string {
	const t = s.trim().replace(/[.;]$/, "");
	return t.length <= 160 ? t : `${t.slice(0, 157).trimEnd()}…`;
}

export interface IterationSchedule {
	/** Bar start (ms). */
	start: number;
	/** Bar end / planned ship (ms). */
	end: number;
	/** Real ship date for done iterations, else `null`. */
	completedAt: number | null;
}

/** SH-38 bucket: `Phase1Spine` items land in the next-30d window;
 *  `AppStage` items land between Phase-1 clear (`now + DAY * 30`) and GA
 *  (`RELEASE_TARGET_DATE - DAY`); `PostV1` items land past GA. The serial
 *  policy in [[feedback_serial_shell_then_apps]] says no app slot opens
 *  until Phase-1 (Shell + Infra) clears, so app-stage `⚪ pending` items
 *  must not claim "Due Today" while Phase-1 is still open. */
export enum IterationBucket {
	Phase1Spine = "phase1-spine",
	AppStage = "app-stage",
	PostV1 = "post-v1",
}

/** Classify an iteration into a scheduling bucket. Uses the iteration's
 *  own `app` field (parser-tracked: the `current.title` of its section
 *  when that section sits under `# Apps`). Using `stage.ownerDomain`
 *  rolled up across sections is wrong because a stage like Stage 9
 *  splits across the platform half (`# Infrastructure`) AND per-app
 *  sections (`# Apps`); `aggregateStages` keeps the FIRST section's
 *  domain, so app iterations under that stage would be mis-bucketed as
 *  Phase-1 spine. The `stageById` param is kept for the future PostV1
 *  refinement (🟢 icon parsing / explicit post-v1 id list) which may
 *  need stage-level lookups. */
export function bucketForIteration(
	iteration: SerializedIterationEntity,
	_stageById: ReadonlyMap<string, SerializedStageEntity>,
): IterationBucket {
	if (iteration.app !== null && iteration.app !== "") return IterationBucket.AppStage;
	return IterationBucket.Phase1Spine;
}

/**
 * Derive a *distinct* date span per iteration so the Timeline/Calendar
 * isn't a degenerate smear (every iteration of a stage previously shared
 * one created→milestone span). Deterministic in
 * `(stages, iterations, milestones, logDates, now)`.
 *
 * Iterations are ranked **globally in plan order** (not per stage —
 * stage-level "done" detection is unreliable since old stage headings
 * carry no ✅). Shipped iterations cascade across the real past
 * `[projectEpoch … yesterday]`; the remaining backlog cascades across the
 * road to GA `[now … last milestone]`. A known log ship date anchors a
 * shipped bar to its true date; every bar is ≥ 1 day wide.
 */
export function deriveIterationSchedule(
	stages: readonly SerializedStageEntity[],
	iterations: readonly SerializedIterationEntity[],
	milestones: readonly SerializedMilestoneEntity[],
	logDates: ReadonlyMap<string, number | null>,
	now: number,
): Map<string, IterationSchedule> {
	const byCode = new Map(iterations.map((it) => [it.code, it]));
	// Plan order: stages in order, each stage's iterationCodes in order.
	const ordered: SerializedIterationEntity[] = [];
	const seen = new Set<string>();
	for (const stage of stages) {
		for (const code of stage.iterationCodes) {
			const it = byCode.get(code);
			if (it && !seen.has(code)) {
				ordered.push(it);
				seen.add(code);
			}
		}
	}
	for (const it of iterations) if (!seen.has(it.code)) ordered.push(it);

	const isDone = (it: SerializedIterationEntity): boolean => it.status === "done";
	const isInFlight = (it: SerializedIterationEntity): boolean => it.status === "partial";
	const done = ordered.filter(isDone);
	// In-flight iterations all land on "today" so the Tasks app paints them
	// in the Today bucket, not somewhere in the upcoming smear.
	const inFlight = ordered.filter(isInFlight);
	// Pending iterations cascade across the next 30 days in plan order.
	// Using the milestone-anchored upper bound (e.g. 2026-09-01 beta) would
	// stretch ~115 pending items across ~100 days, leaving the next 7 days
	// almost empty and making "Upcoming" useless. 30 days gives ~6 h per slot
	// and ~28 visible items in a typical 7-day Upcoming view.
	const future = ordered.filter((it) => !isDone(it) && !isInFlight(it));

	// SH-38: split `future` by bucket so app-stage `⚪` items don't claim
	// "Due Today" while Phase-1 is still open (per
	// [[feedback_serial_shell_then_apps]]). Phase-1 spine lands in the
	// next-30d window; app-stage lands between Phase-1-clear and GA;
	// post-v1 lands past GA. Order within each bucket is plan-order.
	// Iteration.stageId carries the raw stage number ("9", "13"); stage.id
	// is the prefixed form ("stage-9"). Key the lookup by stage.stageId.
	const stageById = new Map(stages.map((s) => [s.stageId, s]));
	const phase1Spine: SerializedIterationEntity[] = [];
	const appStage: SerializedIterationEntity[] = [];
	const postV1: SerializedIterationEntity[] = [];
	for (const it of future) {
		const bucket = bucketForIteration(it, stageById);
		if (bucket === IterationBucket.AppStage) appStage.push(it);
		else if (bucket === IterationBucket.PostV1) postV1.push(it);
		else phase1Spine.push(it);
	}

	// Past window: a fixed ~5-month epoch, *not* the earliest log date
	// (only recent iterations carry a machine date — that would bias the
	// window late and collapse 84 shipped iterations onto a few days).
	let earliestReal: number | null = null;
	for (const v of logDates.values()) {
		if (v != null && (earliestReal == null || v < earliestReal)) earliestReal = v;
	}
	const pastEnd = now - DAY;
	const pastStart = Math.min(earliestReal ?? pastEnd, pastEnd - DAY * 150);
	const futureStart = now + DAY; // pending items land "tomorrow onward"; today is reserved for in-flight
	const futureEnd = futureStart + DAY * 30;

	const out = new Map<string, IterationSchedule>();

	const lay = (
		seq: readonly SerializedIterationEntity[],
		windowStart: number,
		windowEnd: number,
	): void => {
		const total = Math.max(seq.length, 1);
		const stride = (windowEnd - windowStart) / total;
		seq.forEach((it, i) => {
			const segStart = Math.round(windowStart + stride * i);
			const segEnd = Math.round(windowStart + stride * (i + 1));
			const real = logDates.get(it.code) ?? null;
			let start: number;
			let end: number;
			let completedAt: number | null;
			if (isDone(it)) {
				// A done iteration's log date IS its ship date — position the bar
				// there so the past window reflects when work actually landed.
				// Without a log date, fall back to the even spread.
				if (real != null) {
					end = real;
					start = Math.min(segStart, real - DAY);
					completedAt = real;
				} else {
					start = segStart;
					end = segEnd;
					completedAt = segEnd;
				}
			} else {
				// Not done (pending; in-flight is handled separately). ALWAYS use
				// the window position — these windows are in the future, so the
				// task is upcoming, not overdue. A log entry on a still-pending
				// iteration is a build-ready / gate-cleared signal, NOT a ship
				// date: pinning the due date to a past log date made the task
				// permanently overdue (it never advanced on a reseed, so "Today"
				// showed the same stale May items forever).
				start = segStart;
				end = segEnd;
				completedAt = null;
			}
			if (start >= end) start = end - DAY;
			out.set(it.code, { start, end, completedAt });
		});
	};

	lay(done, pastStart, pastEnd);
	// In-flight items: every bar is "today" (≥ 1 day wide via the lay-floor).
	const todayStart = now;
	const todayEnd = now + DAY;
	for (const it of inFlight) {
		out.set(it.code, { start: todayStart, end: todayEnd, completedAt: null });
	}
	// SH-38: three buckets, three windows.
	// Phase-1 spine: the next-30d window the seeder always laid into.
	lay(phase1Spine, futureStart, futureEnd);
	// App-stage: pushed past the Phase-1 window, ending the day before GA.
	// If GA is too close to fit the slice (`appStageStart >= appStageEnd`),
	// clamp to a 1-day window so the lay-floor still produces ≥1 day bars.
	const appStageStart = futureEnd + DAY;
	const appStageEnd = Math.max(RELEASE_TARGET_DATE - DAY, appStageStart + DAY);
	lay(appStage, appStageStart, appStageEnd);
	// Post-v1: past GA. Reserved bucket; empty in the v1 SH-38 classifier
	// but the window is wired so a future refinement (🟢 icon parsing or
	// explicit post-v1 id list) is one bucket-assignment line away.
	const postV1Start = RELEASE_TARGET_DATE + DAY;
	const postV1End = postV1Start + DAY * 90;
	lay(postV1, postV1Start, postV1End);
	return out;
}
