import { describe, expect, it } from "vitest";
import type {
	SerializedDesignDocEntity,
	SerializedIterationEntity,
	SerializedOpenQuestionEntity,
	SerializedStageEntity,
} from "../src/seed/brainstorm-project.ts";
import type {
	SerializedMilestoneEntity,
	SerializedReleaseEntity,
} from "../src/seed/release-schedule.ts";
import { buildEntityWikilinkResolver } from "../src/seed/wikilink-resolver.ts";

const NOW = Date.UTC(2026, 4, 17);

function iter(code: string, title = `Thing ${code}`): SerializedIterationEntity {
	return {
		id: `iter-${code.replace(/\./g, "-").toLowerCase()}`,
		code,
		stageId: "9",
		title,
		status: "done",
		summary: "",
		body: "",
		completedAt: NOW,
		scheduledStart: NOW - 1,
		scheduledEnd: NOW,
		resolvedOQs: [],
		createdAt: NOW - 1,
		updatedAt: NOW,
	};
}

function oq(code: string): SerializedOpenQuestionEntity {
	return {
		id: `oq-${code.toLowerCase()}`,
		code,
		number: 1,
		section: "Sync",
		title: `${code} title`,
		status: "open",
		where: null,
		question: null,
		resolution: null,
		resolutionRef: null,
		createdAt: NOW,
		updatedAt: NOW,
	};
}

const release: SerializedReleaseEntity = {
	id: "release-0-1-0",
	version: "0.1.0",
	name: "Brainstorm 0.1.0",
	targetDate: NOW,
	status: "active",
	scopeIncludes: [],
	scopeExcludes: [],
	stageIds: [],
	milestoneIds: [],
	createdAt: NOW,
	updatedAt: NOW,
};

const stage: SerializedStageEntity = {
	id: "stage-9",
	stageId: "9",
	heading: "Stage 9 — Apps",
	status: "in-flight",
	goal: null,
	ownerDomain: null,
	iterationCodes: [],
	exitCriteria: [],
	createdAt: NOW,
	updatedAt: NOW,
};

const milestone: SerializedMilestoneEntity = {
	id: "milestone-stage-9-exit",
	releaseId: release.id,
	stageId: stage.stageId,
	name: "Stage 9 exit",
	targetDate: NOW,
	status: "pending",
	summary: "",
	createdAt: NOW,
	updatedAt: NOW,
};

const designDoc: SerializedDesignDocEntity = {
	id: "doc-foundations-49-self-hosting",
	path: "docs/foundations/49-self-hosting.md",
	slug: "self-hosting",
	category: "foundations",
	docNumber: 49,
	title: "Self-hosting Brainstorm",
	excerpt: "",
	referencedDocs: [],
	governingIterations: [],
	createdAt: NOW,
	updatedAt: NOW,
};

describe("buildEntityWikilinkResolver", () => {
	const entities = {
		iterations: [iter("9.14.1"), iter("SH-7", "Self-host seed quality")],
		openQuestions: [oq("OQ-228")],
		stages: [stage],
		designDocs: [designDoc],
		release,
		milestones: [milestone],
	};
	const resolve = buildEntityWikilinkResolver(entities);

	it("resolves an iteration by code → Notes-app id", () => {
		const t = resolve("9.14.1");
		expect(t).not.toBeNull();
		expect(t).toMatchObject({
			entityId: "iteration-9-14-1",
			entityType: "io.brainstorm.notes/Note/v1",
		});
	});

	it("resolves an iteration code case-insensitively", () => {
		expect(resolve("sh-7")?.entityId).toBe("iteration-SH-7".replace(".", "-"));
		expect(resolve("SH-7")?.entityId).toBe("iteration-SH-7");
	});

	it("resolves an iteration by its self-hosting id", () => {
		expect(resolve("iter-9-14-1")?.entityId).toBe("iteration-9-14-1");
	});

	it("resolves an OQ by code", () => {
		expect(resolve("OQ-228")).toMatchObject({
			entityId: "oq-oq-228",
			entityType: "brainstorm/OpenQuestion/v1",
			label: "OQ-228 — OQ-228 title",
		});
	});

	it("resolves a design doc by slug", () => {
		expect(resolve("self-hosting")?.entityId).toBe("doc-foundations-49-self-hosting");
	});

	it("resolves a stage by stage id and by stage prefix", () => {
		expect(resolve("9")?.entityId).toBe("stage-9");
		expect(resolve("stage-9")?.entityId).toBe("stage-9");
	});

	it("resolves a milestone by id", () => {
		expect(resolve("milestone-stage-9-exit")?.entityId).toBe("milestone-stage-9-exit");
	});

	it("resolves the release by id and by version", () => {
		expect(resolve("release-0-1-0")?.entityType).toBe("brainstorm/Release/v1");
		expect(resolve("0.1.0")?.entityType).toBe("brainstorm/Release/v1");
	});

	it("returns null for memory-style slugs that don't match any entity", () => {
		expect(resolve("feedback_serial_shell_then_apps")).toBeNull();
		expect(resolve("app-scaffold-pattern")).toBeNull();
		expect(resolve("")).toBeNull();
	});
});
