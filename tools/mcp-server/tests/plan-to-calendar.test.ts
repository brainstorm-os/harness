import { describe, expect, it } from "vitest";
import { parseStoredEvent } from "../../../apps/calendar/src/storage/codec.ts";
import { mapMilestonesToEvents } from "../src/seed/plan-to-calendar.ts";
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
	scopeIncludes: [],
	scopeExcludes: [],
	stageIds: [],
	milestoneIds: [],
	createdAt: NOW,
	updatedAt: NOW,
};

const milestones: SerializedMilestoneEntity[] = [
	{
		id: "milestone-9",
		releaseId: "release-0-1-0",
		stageId: "stage-9",
		name: "Stage 9 — gate",
		targetDate: Date.UTC(2026, 6, 1, 13, 30),
		status: "partial",
		summary: "Apps land",
		createdAt: NOW,
		updatedAt: NOW,
	},
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

describe("mapMilestonesToEvents", () => {
	const events = mapMilestonesToEvents(milestones, release);

	it("emits one all-day event per milestone, pinned to UTC midnight", () => {
		expect(events).toHaveLength(2);
		expect(events[0]?.allDay).toBe(true);
		expect(events[0]?.start).toBe(Date.UTC(2026, 6, 1));
		expect(events[1]?.start).toBe(Date.UTC(2026, 8, 1));
	});

	it("marks the GA milestone as the marquee release event", () => {
		const ga = events.find((e) => e.id === "event-milestone-ga");
		expect(ga?.title).toContain("Brainstorm 0.1.0 — GA");
		expect(ga?.colorHint).toBe("#6366f1");
	});

	it("prefixes the Event id with `event-` so it doesn't collide with the source Milestone entity id (SH-36)", () => {
		expect(events.map((e) => e.id).sort()).toEqual(["event-milestone-9", "event-milestone-ga"]);
	});

	it("carries `milestoneId` (= source Milestone id) + `stageId` so the graph paints Event/from-milestone edges (SH-36)", () => {
		const stageNine = events.find((e) => e.id === "event-milestone-9");
		expect(stageNine?.milestoneId).toBe("milestone-9");
		expect(stageNine?.stageId).toBe("stage-9");

		const ga = events.find((e) => e.id === "event-milestone-ga");
		expect(ga?.milestoneId).toBe("milestone-ga");
		expect(ga?.stageId).toBeNull();
	});

	it("every seeded row round-trips through the real Calendar codec", () => {
		for (const e of events) {
			const parsed = parseStoredEvent(e);
			expect(parsed).not.toBeNull();
			expect(parsed?.id).toBe(e.id);
			expect(parsed?.allDay).toBe(true);
		}
	});

	it("is deterministic", () => {
		expect(mapMilestonesToEvents(milestones, release)).toEqual(events);
	});
});
