import { describe, expect, it } from "vitest";
import {
	parseStoredEdge,
	parseStoredWhiteboard,
} from "../../../apps/whiteboard/src/storage/codec.ts";
import type {
	SerializedIterationEntity,
	SerializedStageEntity,
} from "../src/seed/brainstorm-project.ts";
import {
	ARCHITECTURE_ID,
	IN_FLIGHT_ID,
	ROADMAP_ID,
	buildRoadmapWhiteboard,
	buildSeedBoards,
} from "../src/seed/plan-to-whiteboard.ts";
import type {
	SerializedMilestoneEntity,
	SerializedReleaseEntity,
} from "../src/seed/release-schedule.ts";

function must<T>(v: T | null | undefined, m: string): T {
	if (v == null) throw new Error(m);
	return v;
}

const NOW = Date.UTC(2026, 4, 17);

function stage(
	stageId: string,
	heading: string,
	status: "done" | "partial" | "pending" = "pending",
	goal: string | null = null,
): SerializedStageEntity {
	return {
		id: `stage-${stageId}`,
		stageId,
		heading,
		status,
		goal,
		ownerDomain: null,
		iterationCodes: [],
		exitCriteria: [],
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function iter(
	code: string,
	stageId: string,
	status: "done" | "partial" | "pending",
	title = `Iteration ${code}`,
	completedAt: number | null = null,
): SerializedIterationEntity {
	return {
		id: `iteration-${code}`,
		code,
		stageId,
		title,
		status,
		summary: "",
		body: "",
		completedAt,
		scheduledStart: NOW,
		scheduledEnd: NOW + 86_400_000,
		resolvedOQs: [],
		createdAt: NOW,
		updatedAt: NOW,
	};
}

const stages = [
	stage("0", "Foundations", "done"),
	stage("9", "Apps", "partial", "Rich text, Block Protocol, host services"),
	stage("10", "Sync", "partial", "Sync, multi-device & E2E encryption"),
	stage("13", "Hardening", "pending"),
];
const iterations: SerializedIterationEntity[] = [
	iter("0.1", "0", "done", "Bootstrap", NOW - 5 * 86_400_000),
	iter("0.2", "0", "done", "Workers", NOW - 4 * 86_400_000),
	iter("9.1", "9", "done", "react-yjs", NOW - 3 * 86_400_000),
	iter("9.2", "9", "partial", "editor"),
	iter("9.3", "9", "pending", "entities"),
	iter("10.1", "10", "done", "relay scaffold", NOW - 2 * 86_400_000),
	iter("10.9", "10", "partial", "soak harness"),
	iter("13.1", "13", "pending", "hardening"),
];
const milestones: SerializedMilestoneEntity[] = stages.map((s, i) => ({
	id: `milestone-${s.stageId}`,
	releaseId: "release-0-1-0",
	stageId: s.id,
	name: `${s.heading} — gate`,
	targetDate: NOW + i * 1000,
	status: "pending",
	summary: "",
	createdAt: NOW,
	updatedAt: NOW,
}));
const release: SerializedReleaseEntity = {
	id: "release-0-1-0",
	version: "0.1.0",
	name: "Brainstorm 0.1.0",
	targetDate: Date.UTC(2026, 8, 1),
	status: "in-progress",
	scopeIncludes: ["Local-first", "Sandboxed apps"],
	scopeExcludes: ["Hosted relay"],
	stageIds: stages.map((s) => s.id),
	milestoneIds: milestones.map((m) => m.id),
	createdAt: NOW - 1000,
	updatedAt: NOW,
};

describe("buildSeedBoards", () => {
	const seed = buildSeedBoards(stages, iterations, milestones, release, NOW);

	it("emits three boards in display order", () => {
		expect(seed.boards.map((b) => b.whiteboard.id)).toEqual([
			ROADMAP_ID,
			ARCHITECTURE_ID,
			IN_FLIGHT_ID,
		]);
	});

	it("every board round-trips the real whiteboard codec", () => {
		for (const board of seed.boards) {
			const parsed = parseStoredWhiteboard(board.whiteboard);
			expect(parsed).not.toBeNull();
			expect(parsed?.id).toBe(board.whiteboard.id);
		}
	});

	it("every edge across every board round-trips", () => {
		for (const board of seed.boards) {
			for (const e of board.edges) expect(parseStoredEdge(e)).not.toBeNull();
		}
	});

	it("is deterministic", () => {
		expect(buildSeedBoards(stages, iterations, milestones, release, NOW)).toEqual(seed);
	});
});

describe("roadmap board", () => {
	const seed = buildSeedBoards(stages, iterations, milestones, release, NOW);
	const board = must(
		seed.boards.find((b) => b.whiteboard.id === ROADMAP_ID),
		"roadmap board",
	);
	const parsed = must(parseStoredWhiteboard(board.whiteboard), "parsed roadmap");

	it("uses no embedded nodes (those render as raw URIs until 9.17.4)", () => {
		expect(parsed.nodes.some((n) => n.kind === "embedded")).toBe(false);
	});

	it("has one frame per stage with a status-coloured header", () => {
		const frames = parsed.nodes.filter((n) => n.kind === "frame");
		// stages + the GA frame
		expect(frames.length).toBe(stages.length + 1);
		for (const f of frames) {
			if ("colorHint" in f) expect(typeof f.colorHint).toBe("string");
		}
	});

	it("includes a release title heading and a status summary", () => {
		const titleText = parsed.nodes.find((n) => n.id === "n-title");
		expect(titleText).toBeDefined();
		const summary = parsed.nodes.find((n) => n.id === "n-summary");
		expect(summary).toBeDefined();
		expect("text" in (summary ?? {}) && (summary as { text: string }).text).toContain("1 done");
		expect("text" in (summary ?? {}) && (summary as { text: string }).text).toContain("2 in flight");
	});

	it("plants a TODAY pin pointing at the first in-flight stage", () => {
		const pin = parsed.nodes.find((n) => n.id === "n-today-pin");
		expect(pin).toBeDefined();
		const edge = board.edges.find((e) => e.id === "e-today");
		expect(edge).toBeDefined();
		expect(edge?.destNodeId).toBe("n-frame-9");
	});

	it("scope sticky notes carry the release scope", () => {
		const stickies = parsed.nodes.filter((n) => n.kind === "sticky");
		const text = stickies.map((s) => ("text" in s ? s.text : "")).join("\n");
		expect(text).toContain("Local-first");
		expect(text).toContain("Hosted relay");
	});

	it("ends the sequence at the GA release frame", () => {
		expect(board.edges.at(-2)?.destNodeId ?? board.edges.at(-1)?.destNodeId).toBe("n-release");
	});
});

describe("architecture board", () => {
	const seed = buildSeedBoards(stages, iterations, milestones, release, NOW);
	const board = must(
		seed.boards.find((b) => b.whiteboard.id === ARCHITECTURE_ID),
		"architecture board",
	);
	const parsed = must(parseStoredWhiteboard(board.whiteboard), "parsed architecture");

	it("has three lane frames (Apps / Shell / Core)", () => {
		const lanes = parsed.nodes.filter((n) => n.kind === "frame");
		expect(lanes.length).toBe(3);
	});

	it("uses zero embedded nodes (pure visual board)", () => {
		expect(parsed.nodes.some((n) => n.kind === "embedded")).toBe(false);
	});

	it("connects the lanes with envelope/worker edges", () => {
		expect(board.edges.length).toBe(2);
		const labels = board.edges.map((e) => e.label);
		expect(labels).toContain("IPC envelope");
		expect(labels).toContain("WorkerBridge");
	});

	it("includes design-rule sticky notes", () => {
		const stickyTexts = parsed.nodes
			.filter((n) => n.kind === "sticky")
			.map((n) => ("text" in n ? n.text : ""));
		const joined = stickyTexts.join("\n");
		expect(joined).toContain("Fail-closed");
		expect(joined).toContain("backpressure");
	});
});

describe("in-flight board", () => {
	const seed = buildSeedBoards(stages, iterations, milestones, release, NOW);
	const board = must(
		seed.boards.find((b) => b.whiteboard.id === IN_FLIGHT_ID),
		"in-flight board",
	);
	const parsed = must(parseStoredWhiteboard(board.whiteboard), "parsed in-flight");

	it("has one frame per partial stage", () => {
		const frames = parsed.nodes.filter((n) => n.kind === "frame");
		expect(frames.length).toBe(2); // stages 9 and 10
	});

	it("shows three status chips per stage (shipped/active/queued)", () => {
		expect(parsed.nodes.find((n) => n.id === "n-if-chip-done-9")).toBeDefined();
		expect(parsed.nodes.find((n) => n.id === "n-if-chip-partial-9")).toBeDefined();
		expect(parsed.nodes.find((n) => n.id === "n-if-chip-pending-9")).toBeDefined();
	});

	it("surfaces recently shipped iterations as stickies", () => {
		const recent = parsed.nodes.filter((n) => n.id.startsWith("n-if-recent-") && n.kind === "sticky");
		expect(recent.length).toBeGreaterThan(0);
	});

	it("falls back to a hint sticky when no stages are in flight", () => {
		const calmStages = stages.map((s) => ({ ...s, status: "done" as const }));
		const calmBoard = must(
			buildSeedBoards(calmStages, iterations, milestones, release, NOW).boards.find(
				(b) => b.whiteboard.id === IN_FLIGHT_ID,
			),
			"calm in-flight board",
		);
		const empty = must(parseStoredWhiteboard(calmBoard.whiteboard), "parsed calm in-flight");
		expect(empty.nodes.find((n) => n.id === "n-if-empty")).toBeDefined();
	});
});

describe("buildRoadmapWhiteboard (back-compat shim)", () => {
	it("returns the roadmap board only", () => {
		const board = buildRoadmapWhiteboard(stages, iterations, milestones, release, NOW);
		expect(board.whiteboard.id).toBe(ROADMAP_ID);
	});
});
