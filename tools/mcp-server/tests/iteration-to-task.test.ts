import { describe, expect, it } from "vitest";
import type {
	SerializedIterationEntity,
	SerializedStageEntity,
} from "../src/seed/brainstorm-project.ts";
import {
	PROJECT_KEY_PREFIX,
	RELEASE_PROJECT_ID,
	SECTION_KEY_PREFIX,
	TASK_KEY_PREFIX,
	mapPlanToTasksApp,
} from "../src/seed/iteration-to-task.ts";

const NOW = Date.UTC(2026, 4, 14);
const DAY = 86_400_000;

function iter(
	overrides: Partial<SerializedIterationEntity> & Pick<SerializedIterationEntity, "id" | "code">,
): SerializedIterationEntity {
	return {
		stageId: "",
		app: null,
		domain: null,
		section: null,
		title: "Untitled",
		status: "pending",
		summary: "",
		completedAt: null,
		scheduledStart: NOW - DAY * 30,
		scheduledEnd: NOW,
		resolvedOQs: [],
		createdAt: NOW - DAY * 30,
		updatedAt: NOW,
		...overrides,
	};
}

function stage(
	overrides: Partial<SerializedStageEntity> & Pick<SerializedStageEntity, "id" | "stageId">,
): SerializedStageEntity {
	return {
		heading: "Stage",
		status: "pending",
		goal: null,
		ownerDomain: null,
		iterationCodes: [],
		exitCriteria: [],
		createdAt: NOW - DAY * 30,
		updatedAt: NOW,
		...overrides,
	};
}

// Domain/app iterations across the three projects the SH-39 model produces:
// Infrastructure (one section, done + pending), Shell (one section), and an
// app (Notes, no sub-section). A trailing log-only synthetic (no domain/app)
// must NOT become a task.
const ITERATIONS: SerializedIterationEntity[] = [
	iter({
		id: "iter-3-1",
		code: "3.1",
		stageId: "3",
		domain: "Infrastructure",
		section: "Local data substrate",
		title: "SQLite substrate.",
		status: "done",
		completedAt: NOW - DAY * 100,
		scheduledStart: NOW - DAY * 110,
		scheduledEnd: NOW - DAY * 100,
	}),
	iter({
		id: "iter-3-2",
		code: "3.2",
		stageId: "3",
		domain: "Infrastructure",
		section: "Local data substrate",
		title: "Yjs persistence pending.",
		status: "pending",
	}),
	iter({
		id: "iter-kbn-s-launcher",
		code: "KBN-S-launcher",
		stageId: "",
		domain: "Shell",
		section: "Keyboard accessibility",
		title: "Launcher composite keyboard.",
		status: "pending",
	}),
	iter({
		id: "iter-9-6",
		code: "9.6",
		domain: "Apps",
		app: "Notes",
		section: null,
		title: "Notes app — heavy progress.",
		status: "partial",
		scheduledStart: NOW + DAY * 10,
		scheduledEnd: NOW + DAY * 20,
	}),
	// log-only synthetic — no domain, no app → not a task
	iter({ id: "iter-orphan", code: "B0.1", title: "Log-only sub-step." }),
];

describe("mapPlanToTasksApp", () => {
	const result = mapPlanToTasksApp(ITERATIONS);

	it("emits one Project per domain + one per app (not per stage)", () => {
		expect(result.projects.map((p) => p.id)).toEqual([
			"proj-domain-infrastructure",
			"proj-domain-shell",
			"proj-app-notes",
		]);
		expect(result.projects.map((p) => p.name)).toEqual(["Infrastructure", "Shell", "Notes"]);
	});

	it("drops log-only synthetic iterations with no domain/app (no catch-all)", () => {
		expect(result.tasks.map((t) => t.id).sort()).toEqual([
			"task-iter-3-1",
			"task-iter-3-2",
			"task-iter-9-6",
			"task-iter-kbn-s-launcher",
		]);
		expect(result.tasks.some((t) => t.projectId === null)).toBe(false);
	});

	it("groups infra/shell iterations under their `##`/`###` section", () => {
		const infraSections = result.sections.filter((s) => s.projectId === "proj-domain-infrastructure");
		expect(infraSections.map((s) => s.name)).toEqual(["Local data substrate"]);
		const t = result.tasks.find((t) => t.id === "task-iter-3-1");
		expect(t?.projectId).toBe("proj-domain-infrastructure");
		expect(t?.sectionId).toBe(infraSections[0]?.id);
		// both infra iterations share the one section
		expect(result.tasks.find((t) => t.id === "task-iter-3-2")?.sectionId).toBe(infraSections[0]?.id);
	});

	it("an app's un-sub-sectioned bullets carry sectionId=null", () => {
		const t = result.tasks.find((t) => t.id === "task-iter-9-6");
		expect(t?.projectId).toBe("proj-app-notes");
		expect(t?.sectionId).toBeNull();
		expect(result.sections.some((s) => s.projectId === "proj-app-notes")).toBe(false);
	});

	it("carries the source Iteration id for the from-iteration edge (SH-37)", () => {
		expect(result.tasks.find((t) => t.id === "task-iter-3-1")?.iterationId).toBe("iter-3-1");
	});

	it("prefixes the task name with the iteration code", () => {
		expect(result.tasks.find((t) => t.id === "task-iter-3-1")?.name.startsWith("3.1 —")).toBe(true);
	});

	it("sets completedAt when the iteration is done", () => {
		expect(result.tasks.find((t) => t.id === "task-iter-3-1")?.completedAt).toBeGreaterThan(0);
		expect(result.tasks.find((t) => t.id === "task-iter-3-2")?.completedAt).toBeNull();
	});

	it("maps iteration status to a Tasks priority", () => {
		expect(result.tasks.find((t) => t.id === "task-iter-9-6")?.priority).toBe("high");
		expect(result.tasks.find((t) => t.id === "task-iter-3-2")?.priority).toBe("medium");
		expect(result.tasks.find((t) => t.id === "task-iter-3-1")?.priority).toBe("none");
	});

	it("preserves the underlying iteration status as statusKey for filters", () => {
		expect(result.tasks.find((t) => t.id === "task-iter-9-6")?.statusKey).toBe("partial");
	});

	it("colors projects by domain identity, not status", () => {
		expect(result.projects.find((p) => p.id === "proj-domain-infrastructure")?.colorHint).toBe(
			"#6366f1",
		);
		expect(result.projects.find((p) => p.id === "proj-domain-shell")?.colorHint).toBe("#0ea5e9");
		expect(result.projects.find((p) => p.id === "proj-app-notes")?.colorHint).toBe("#10b981");
	});

	it("rolls member-iteration statuses up into a project status", () => {
		// infra has a done + a pending → mixed → partial
		expect(result.projects.find((p) => p.id === "proj-domain-infrastructure")?.statusKey).toBe(
			"partial",
		);
		// notes has a single partial → partial
		expect(result.projects.find((p) => p.id === "proj-app-notes")?.statusKey).toBe("partial");
	});

	it("is idempotent — re-mapping the same input produces the same output", () => {
		expect(mapPlanToTasksApp(ITERATIONS)).toEqual(result);
	});

	it("truncates very long iteration titles in the task name", () => {
		const long = "X".repeat(500);
		const r = mapPlanToTasksApp([
			iter({ id: "iter-l", code: "L.1", domain: "Shell", section: "Bin", title: long }),
		]);
		expect(r.tasks[0]?.name.length).toBeLessThanOrEqual(140);
		expect(r.tasks[0]?.name).toContain("L.1 —");
	});

	it("exports the storage prefixes the Tasks app uses", () => {
		expect(TASK_KEY_PREFIX).toBe("task:");
		expect(PROJECT_KEY_PREFIX).toBe("project:");
		expect(SECTION_KEY_PREFIX).toBe("section:");
	});
});

describe("mapPlanToTasksApp — release umbrella (SH-16)", () => {
	const release = {
		id: "release-0-1-0",
		version: "0.1.0",
		name: "Brainstorm 0.1.0",
		targetDate: Date.UTC(2026, 8, 1),
		status: "in-progress",
		scopeIncludes: ["a", "b"],
		scopeExcludes: ["c"],
		stageIds: ["stage-3", "stage-9"],
		milestoneIds: ["milestone-ga"],
		createdAt: NOW,
		updatedAt: NOW,
	};
	const result = mapPlanToTasksApp(ITERATIONS, [], [], release);

	it("adds the release as the pinned first project carrying the GA date", () => {
		const rel = result.projects.find((p) => p.id === RELEASE_PROJECT_ID);
		expect(rel?.name).toBe("Brainstorm 0.1.0");
		expect(rel?.milestoneAt).toBe(Date.UTC(2026, 8, 1));
		expect(result.projects[0]?.id).toBe(RELEASE_PROJECT_ID);
	});

	it("uses each iteration's own scheduled span (distinct, cascading)", () => {
		const a = result.tasks.find((t) => t.id === "task-iter-3-1");
		const b = result.tasks.find((t) => t.id === "task-iter-9-6");
		expect(a?.createdAt).toBe(NOW - DAY * 110);
		expect(a?.scheduledAt).toBe(NOW - DAY * 110);
		expect(a?.dueAt).toBe(NOW - DAY * 100);
		expect(b?.scheduledAt).toBe(NOW + DAY * 10);
		expect(b?.dueAt).toBe(NOW + DAY * 20);
		expect(a?.dueAt).not.toBe(b?.dueAt);
	});

	it("is deterministic", () => {
		expect(mapPlanToTasksApp(ITERATIONS, [], [], release)).toEqual(result);
	});
});

describe("mapPlanToTasksApp — dueAt passthrough (SH-38)", () => {
	it("a Task's dueAt is its iteration's scheduledEnd, unclamped", () => {
		const phase1End = NOW + DAY * 14;
		const appStageEnd = NOW + DAY * 90;
		const iterations = [
			iter({
				id: "iter-13-8",
				code: "13.8",
				domain: "Shell",
				section: "App-lock",
				scheduledStart: NOW + DAY,
				scheduledEnd: phase1End,
			}),
			iter({
				id: "iter-b11-1",
				code: "B11.1",
				domain: "Apps",
				app: "Automations",
				scheduledStart: NOW + DAY * 60,
				scheduledEnd: appStageEnd,
			}),
		];
		const { tasks } = mapPlanToTasksApp(iterations);
		expect(tasks.find((t) => t.id === "task-iter-13-8")?.dueAt).toBe(phase1End);
		expect(tasks.find((t) => t.id === "task-iter-b11-1")?.dueAt).toBe(appStageEnd);
	});
});

describe("task notes — full body, not the 480-char summary clip", () => {
	const longBody = `network-broker core with **bold** emphasis and a [[wikilink]] reference, plus ${"detail ".repeat(90)}and a final clause.`;

	it("uses the full cleaned iteration body, stripping markdown + wikilink brackets, no truncation", () => {
		const { tasks } = mapPlanToTasksApp([
			iter({
				id: "iter-net-1a",
				code: "Net-1a",
				domain: "Infrastructure",
				section: "Network",
				title: "Network broker",
				summary: "short clipped summary",
				body: longBody,
			}),
		]);
		const task = tasks.find((t) => t.name.startsWith("Net-1a "));
		expect(task).toBeDefined();
		// The body is far longer than the old ~480 summary clip and lands whole.
		expect(task?.notes.length ?? 0).toBeGreaterThan(500);
		expect(task?.notes).not.toContain("**"); // markdown stripped
		expect(task?.notes).not.toContain("[["); // wikilink brackets stripped
		expect(task?.notes).toContain("wikilink"); // the link target text survives
		expect(task?.notes.trimEnd().endsWith("…")).toBe(false); // no truncation ellipsis
		expect(task?.notes).not.toBe("short clipped summary");
	});

	it("falls back to the summary when the iteration has no body", () => {
		const { tasks } = mapPlanToTasksApp([
			iter({
				id: "iter-x",
				code: "9.99",
				domain: "Infrastructure",
				section: "Misc",
				summary: "just a summary",
				body: "",
			}),
		]);
		expect(tasks.find((t) => t.name.startsWith("9.99 "))?.notes).toBe("just a summary");
	});
});
