import { describe, expect, it } from "vitest";
import { extractNoteReferences } from "../../../packages/shell/src/main/entities/extract-note-references.ts";
import type { SerializedStageEntity } from "../src/seed/brainstorm-project.ts";
import { RELEASE_HUB_NOTE_ID, buildReleaseHubNote } from "../src/seed/plan-to-hub.ts";
import type {
	SerializedMilestoneEntity,
	SerializedReleaseEntity,
} from "../src/seed/release-schedule.ts";

const NOW = Date.UTC(2026, 4, 17);

const release: SerializedReleaseEntity = {
	id: "release-0-1-0",
	version: "0.1.0",
	name: "Brainstorm 0.1.0",
	targetDate: Date.UTC(2026, 8, 1),
	status: "in-progress",
	scopeIncludes: ["a", "b"],
	scopeExcludes: ["c"],
	stageIds: ["stage-0", "stage-9"],
	milestoneIds: ["milestone-0", "milestone-ga"],
	createdAt: NOW,
	updatedAt: NOW,
};
const stages: SerializedStageEntity[] = [
	{
		id: "stage-9",
		stageId: "9",
		heading: "Apps",
		status: "partial",
		goal: null,
		ownerDomain: null,
		iterationCodes: [],
		exitCriteria: [],
		createdAt: NOW,
		updatedAt: NOW,
	},
];
const milestones: SerializedMilestoneEntity[] = [
	{
		id: "milestone-ga",
		releaseId: "release-0-1-0",
		stageId: null,
		name: "Brainstorm 0.1.0 — GA",
		targetDate: Date.UTC(2026, 8, 1),
		status: "pending",
		summary: "GA",
		createdAt: NOW,
		updatedAt: NOW,
	},
];

describe("buildReleaseHubNote", () => {
	const note = buildReleaseHubNote(release, stages, milestones);

	it("is a single top-level note with the release-hub id + ISO target value", () => {
		expect(note.id).toBe(RELEASE_HUB_NOTE_ID);
		expect(note.title).toBe("Brainstorm 0.1.0 — Release Plan");
		expect(note.values["release-target"]).toBe("2026-09-01");
	});

	it("its mentions resolve through the real shell note-reference walker", () => {
		const refs = extractNoteReferences(note.body);
		const ids = refs.map((r) => r.entityId);
		expect(ids).toContain("release-0-1-0");
		expect(ids).toContain("stage-9");
		expect(ids).toContain("milestone-ga");
		const rel = refs.find((r) => r.entityId === "release-0-1-0");
		expect(rel?.entityType).toBe("brainstorm/Release/v1");
	});

	it("is deterministic", () => {
		expect(buildReleaseHubNote(release, stages, milestones)).toEqual(note);
	});
});
