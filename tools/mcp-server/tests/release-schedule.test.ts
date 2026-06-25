import { describe, expect, it } from "vitest";
import { buildBrainstormProjectEntities } from "../src/seed/brainstorm-project.ts";
import type {
	SerializedIterationEntity,
	SerializedStageEntity,
} from "../src/seed/brainstorm-project.ts";
import {
	IterationBucket,
	RELEASE_ID,
	RELEASE_TARGET_DATE,
	RELEASE_VERSION,
	bucketForIteration,
	deriveIterationSchedule,
	deriveReleaseSchedule,
	parseReleaseScope,
} from "../src/seed/release-schedule.ts";

const NOW = Date.UTC(2026, 4, 17);
const DAY = 86_400_000;

function stage(
	stageId: string,
	status: string,
	overrides: Partial<SerializedStageEntity> = {},
): SerializedStageEntity {
	return {
		id: `stage-${stageId}`,
		stageId,
		heading: `Stage ${stageId}`,
		status,
		goal: `Goal ${stageId}`,
		ownerDomain: null,
		iterationCodes: [],
		exitCriteria: [],
		createdAt: NOW - DAY * 30,
		updatedAt: NOW,
		...overrides,
	};
}

function iter(
	code: string,
	stageId: string,
	completedAt: number | null,
	app: string | null = null,
): SerializedIterationEntity {
	return {
		id: `iter-${code}`,
		code,
		stageId,
		app,
		title: code,
		status: completedAt == null ? "pending" : "done",
		summary: "",
		completedAt,
		resolvedOQs: [],
		createdAt: NOW - DAY * 30,
		updatedAt: NOW,
	};
}

describe("RELEASE_TARGET_DATE", () => {
	it("is exactly 2026-09-01 UTC and the only hand-set date", () => {
		expect(new Date(RELEASE_TARGET_DATE).toISOString()).toBe("2026-09-01T00:00:00.000Z");
		expect(RELEASE_VERSION).toBe("0.1.0");
	});
});

describe("deriveReleaseSchedule", () => {
	const stages = [
		stage("0", "done"),
		stage("3", "done"),
		stage("9", "partial"),
		stage("11", "pending"),
		stage("13", "pending"),
	];
	const iterations = [
		iter("0.1", "0", Date.UTC(2026, 1, 10)),
		iter("0.2", "0", Date.UTC(2026, 2, 1)),
		iter("3.1", "3", Date.UTC(2026, 3, 20)),
	];

	it("emits one milestone per stage plus a GA milestone, in plan order", () => {
		const { milestones } = deriveReleaseSchedule(stages, iterations, NOW);
		expect(milestones.map((m) => m.id)).toEqual([
			"milestone-0",
			"milestone-3",
			"milestone-9",
			"milestone-11",
			"milestone-13",
			"milestone-ga",
		]);
		expect(milestones.at(-1)?.stageId).toBeNull();
	});

	it("the GA milestone sits exactly on RELEASE_TARGET_DATE", () => {
		const { milestones, release } = deriveReleaseSchedule(stages, iterations, NOW);
		expect(milestones.at(-1)?.targetDate).toBe(RELEASE_TARGET_DATE);
		expect(release.targetDate).toBe(RELEASE_TARGET_DATE);
		expect(release.id).toBe(RELEASE_ID);
	});

	it("milestone target dates are monotonic non-decreasing in schedule order", () => {
		const { milestones } = deriveReleaseSchedule(stages, iterations, NOW);
		for (let i = 1; i < milestones.length; i++) {
			const prev = milestones[i - 1];
			const cur = milestones[i];
			expect(cur && prev && cur.targetDate >= prev.targetDate).toBe(true);
		}
	});

	it("a done stage's milestone takes the last completion among its iterations", () => {
		const { milestones } = deriveReleaseSchedule(stages, iterations, NOW);
		expect(milestones.find((m) => m.id === "milestone-3")?.targetDate).toBe(Date.UTC(2026, 3, 20));
	});

	it("not-done milestones land strictly between now and the release date", () => {
		const { milestones } = deriveReleaseSchedule(stages, iterations, NOW);
		for (const m of milestones.filter((x) => x.stageId && x.status !== "done")) {
			expect(m.targetDate).toBeGreaterThan(NOW);
			expect(m.targetDate).toBeLessThan(RELEASE_TARGET_DATE);
		}
	});

	it("is deterministic in (stages, iterations, now)", () => {
		const a = deriveReleaseSchedule(stages, iterations, NOW);
		const b = deriveReleaseSchedule(stages, iterations, NOW);
		expect(b).toEqual(a);
	});

	it("marks the release shipped only when every stage is done", () => {
		const inProgress = deriveReleaseSchedule(stages, iterations, NOW);
		expect(inProgress.release.status).toBe("in-progress");
		const allDone = deriveReleaseSchedule([stage("0", "done"), stage("1", "done")], [], NOW);
		expect(allDone.release.status).toBe("shipped");
		expect(allDone.milestones.at(-1)?.status).toBe("done");
	});
});

describe("parseReleaseScope", () => {
	const plan = `# Implementation plan

## What "v1" means

Per the phasing tables, **v1 ships:**

- Sovereign identity, single-user, multi-device (local pairing).
- SQLite + Yjs persistence, FTS5 + vector index, hybrid search.
- App SDK v1, capability ledger, sandboxed per-app renderers, intents.

**v1 explicitly does NOT include:** consumer accounts, hosted relay, organizations, \`freeform\` layouts, **any commercial surface at all** (no plan picker, no billing UI). These are designed for v2.
`;

	it("pulls the v1-ships bullets, markdown-stripped", () => {
		const { includes } = parseReleaseScope(plan);
		expect(includes).toEqual([
			"Sovereign identity, single-user, multi-device (local pairing)",
			"SQLite + Yjs persistence, FTS5 + vector index, hybrid search",
			"App SDK v1, capability ledger, sandboxed per-app renderers, intents",
		]);
	});

	it("pulls the does-NOT-include items, comma-split and paren-stripped", () => {
		const { excludes } = parseReleaseScope(plan);
		expect(excludes).toContain("consumer accounts");
		expect(excludes).toContain("hosted relay");
		expect(excludes).toContain("any commercial surface at all");
		expect(excludes.some((e) => e.includes("designed for v2"))).toBe(false);
	});
});

describe("buildBrainstormProjectEntities — release spine", () => {
	const built = buildBrainstormProjectEntities({
		planSource: `# Implementation plan

## What "v1" means

**v1 ships:**

- Local-first knowledge product.

**v1 explicitly does NOT include:** hosted relay, organizations.

# Infrastructure

## Foundations *(Stage 0)*

- ✅ 0.1 — Scaffold.

# Apps

## Notes *(Stage 9)*

- ⚪ 9.1 — Notes.
`,
		oqSource: "# Open questions\n",
		now: NOW,
	});

	it("attaches exactly one release with the parsed scope and all stage ids", () => {
		expect(built.release.version).toBe("0.1.0");
		expect(built.release.scopeIncludes).toEqual(["Local-first knowledge product"]);
		expect(built.release.scopeExcludes).toEqual(["hosted relay", "organizations"]);
		expect(built.release.stageIds).toEqual(built.stages.map((s) => s.id));
		expect(built.release.milestoneIds).toEqual(built.milestones.map((m) => m.id));
	});

	it("derives milestones covering every stage plus GA", () => {
		expect(built.milestones.map((m) => m.stageId)).toEqual([
			built.stages[0]?.id,
			built.stages[1]?.id,
			null,
		]);
	});
});

describe("deriveIterationSchedule", () => {
	const stages = [
		stage("0", "done", { iterationCodes: ["0.1", "0.2"] }),
		stage("9", "partial", { iterationCodes: ["9.1", "9.2"] }),
		stage("13", "pending", { iterationCodes: ["13.1"] }),
	];
	const iterations = [
		iter("0.1", "0", NOW - DAY),
		iter("0.2", "0", NOW - DAY),
		iter("9.1", "9", NOW - DAY),
		{ ...iter("9.2", "9", null), status: "todo" },
		{ ...iter("13.1", "13", null), status: "todo" },
	];
	const { milestones } = deriveReleaseSchedule(stages, iterations, NOW);
	const logDates = new Map<string, number | null>([["9.1", Date.UTC(2026, 3, 30)]]);
	const sched = deriveIterationSchedule(stages, iterations, milestones, logDates, NOW);

	it("gives every iteration a distinct, ≥1-day span", () => {
		const spans = new Set<string>();
		for (const it of iterations) {
			const s = sched.get(it.code);
			expect(s).toBeDefined();
			if (!s) continue;
			expect(s.end).toBeGreaterThan(s.start);
			spans.add(`${s.start}:${s.end}`);
		}
		expect(spans.size).toBe(iterations.length);
	});

	it("cascades shipped work into the past and the backlog toward GA", () => {
		const done1 = sched.get("0.1");
		const done2 = sched.get("0.2");
		const future = sched.get("13.1");
		expect(done1?.start ?? 0).toBeLessThan(done2?.start ?? Number.POSITIVE_INFINITY);
		expect(done2?.end ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(NOW);
		expect(future?.start).toBeGreaterThanOrEqual(NOW);
		expect(future?.completedAt).toBeNull();
	});

	it("anchors a shipped bar to its real log ship date", () => {
		const s = sched.get("9.1");
		expect(s?.completedAt).toBe(Date.UTC(2026, 3, 30));
		expect(s?.end).toBe(Date.UTC(2026, 3, 30));
	});

	it("is deterministic", () => {
		expect(deriveIterationSchedule(stages, iterations, milestones, logDates, NOW)).toEqual(sched);
	});

	it("never marks a non-done iteration completed even when a log date exists (a build-ready / gate-cleared docs log entry is not a ship date)", () => {
		const pendStages = [stage("9", "partial", { iterationCodes: ["pending-with-log"] })];
		const pendIters = [{ ...iter("pending-with-log", "9", null), status: "pending" }];
		const { milestones: ms } = deriveReleaseSchedule(pendStages, pendIters, NOW);
		const logged = new Map<string, number | null>([["pending-with-log", Date.UTC(2026, 4, 29)]]);
		const s = deriveIterationSchedule(pendStages, pendIters, ms, logged, NOW).get("pending-with-log");
		expect(s?.completedAt).toBeNull();
	});

	it("schedules a pending iteration with a PAST log date in the future, never overdue (a stale build-ready log entry must not pin a still-to-do task to a past due date — it showed as permanently overdue and the reseed never moved it)", () => {
		const pendStages = [stage("9", "partial", { iterationCodes: ["pending-past-log"] })];
		const pendIters = [{ ...iter("pending-past-log", "9", null), status: "pending" }];
		const { milestones: ms } = deriveReleaseSchedule(pendStages, pendIters, NOW);
		// Work was logged a week BEFORE `now`, but the iteration is still pending.
		const logged = new Map<string, number | null>([["pending-past-log", Date.UTC(2026, 4, 10)]]);
		const s = deriveIterationSchedule(pendStages, pendIters, ms, logged, NOW).get("pending-past-log");
		expect(s?.completedAt).toBeNull();
		// A pending task is upcoming — its due date must not be in the past.
		expect(s?.end).toBeGreaterThanOrEqual(NOW);
		expect(s?.start).toBeGreaterThanOrEqual(NOW);
	});
});

describe("SH-38 — Phase-1-aware bucketForIteration", () => {
	const emptyStageMap = new Map<string, SerializedStageEntity>();

	it("classifies any iteration whose own `app` field is set as AppStage", () => {
		const it = iter("B11.1", "9", null, "Notes (text-editor) *(9.6)*");
		expect(bucketForIteration(it, emptyStageMap)).toBe(IterationBucket.AppStage);
	});

	it("classifies iterations without an `app` field as Phase1Spine", () => {
		expect(bucketForIteration(iter("13.8", "13", null, null), emptyStageMap)).toBe(
			IterationBucket.Phase1Spine,
		);
		expect(bucketForIteration(iter("12.1", "12", null, null), emptyStageMap)).toBe(
			IterationBucket.Phase1Spine,
		);
	});

	it("treats an empty-string `app` as Phase1Spine (defensive)", () => {
		expect(bucketForIteration(iter("orphan", "X", null, ""), emptyStageMap)).toBe(
			IterationBucket.Phase1Spine,
		);
	});

	it("handles the doc-61 split-stage case: Stage 9 platform-half stays Phase1, Stage 9 per-app sections route to AppStage", () => {
		// Stage 9 splits across `## Rich text… *(Stage 9 platform half)*`
		// under `# Infrastructure` and `## Notes (text-editor) *(9.6)*`
		// under `# Apps`. Per-iteration `app` is the only field that lets
		// us route correctly (stage rollup picks the first section's
		// domain).
		const platformHalf = iter("9.3.5.7", "9", null, null);
		const appStage = iter("B11.1", "9", null, "Notes (text-editor) *(9.6)*");
		expect(bucketForIteration(platformHalf, emptyStageMap)).toBe(IterationBucket.Phase1Spine);
		expect(bucketForIteration(appStage, emptyStageMap)).toBe(IterationBucket.AppStage);
	});
});

describe("SH-38 — deriveIterationSchedule three-bucket layout", () => {
	const phase1Stage = stage("13", "pending", { ownerDomain: "Shell" });
	const appStage9 = stage("9", "partial", { ownerDomain: "Apps" });
	const stages = [phase1Stage, appStage9];
	const iterations = [
		iter("13.8", "13", null, null), // Phase-1 spine (no app field)
		iter("12.1", "13", null, null), // Phase-1 spine (rides Shell stage in fixture)
		iter("B11.1", "9", null, "Notes (text-editor) *(9.6)*"), // App-stage
		iter("B11.6", "9", null, "Notes (text-editor) *(9.6)*"), // App-stage
	];
	const milestones: never[] = [];
	const logDates = new Map<string, number | null>();
	const sched = deriveIterationSchedule(stages, iterations, milestones, logDates, NOW);

	it("lays Phase-1 spine items in the next-30d window", () => {
		const s1 = sched.get("13.8");
		const s2 = sched.get("12.1");
		expect(s1?.start).toBeGreaterThanOrEqual(NOW);
		expect(s1?.end).toBeLessThanOrEqual(NOW + DAY * 31);
		expect(s2?.end).toBeLessThanOrEqual(NOW + DAY * 31);
	});

	it("pushes app-stage items past the Phase-1 window (start > now+30d)", () => {
		const s1 = sched.get("B11.1");
		const s2 = sched.get("B11.6");
		expect(s1?.start ?? 0).toBeGreaterThan(NOW + DAY * 30);
		expect(s2?.start ?? 0).toBeGreaterThan(NOW + DAY * 30);
	});

	it("ends app-stage items strictly before GA", () => {
		const s1 = sched.get("B11.1");
		const s2 = sched.get("B11.6");
		expect(s1?.end ?? Number.POSITIVE_INFINITY).toBeLessThan(RELEASE_TARGET_DATE);
		expect(s2?.end ?? Number.POSITIVE_INFINITY).toBeLessThan(RELEASE_TARGET_DATE);
	});

	it("preserves plan-order within the app-stage bucket", () => {
		const s1 = sched.get("B11.1");
		const s2 = sched.get("B11.6");
		expect(s1?.start ?? Number.POSITIVE_INFINITY).toBeLessThan(s2?.start ?? 0);
	});

	it("preserves plan-order within the Phase-1 spine bucket", () => {
		const s1 = sched.get("13.8");
		const s2 = sched.get("12.1");
		expect(s1?.start ?? Number.POSITIVE_INFINITY).toBeLessThan(s2?.start ?? 0);
	});

	it("degrades to current behaviour when no iterations are app-stage", () => {
		const onlyPhase1Stages = [phase1Stage];
		const onlyPhase1Iter = [iter("13.8", "13", null), iter("12.1", "13", null)];
		const result = deriveIterationSchedule(
			onlyPhase1Stages,
			onlyPhase1Iter,
			milestones,
			logDates,
			NOW,
		);
		const s = result.get("13.8");
		expect(s?.start ?? 0).toBeGreaterThanOrEqual(NOW);
		expect(s?.end ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(NOW + DAY * 31);
	});
});
