/**
 * Mapper from the release schedule → Calendar-app `Event/v1` rows
 * (SH-19 per docs/foundations/49-self-hosting.md).
 *
 * Pure. Every milestone (one per stage-gate + the GA milestone) becomes
 * an all-day `Event/v1` on its derived `targetDate`, written under the
 * Calendar app's `event:<id>` keyspace (same on-disk protocol as
 * `apps/calendar/src/storage/codec.ts`). The GA milestone is the marquee
 * release event on RELEASE_TARGET_DATE. Task `dueAt`s surface on the same
 * grid automatically via the shell's cross-app date surface, so this
 * mapper only owns the milestone markers.
 *
 * The Calendar app keeps its own view-kind UI state (Month/Week/Day/
 * Agenda) outside kv, so — like the Graph seed — there is no fabricated
 * `CalendarView/v1`; seeding Events is what makes the app render the
 * release timeline.
 */

import type { SerializedMilestoneEntity, SerializedReleaseEntity } from "./release-schedule.ts";

export const EVENT_KEY_PREFIX = "event:";

export interface SeedEventRow {
	id: string;
	title: string;
	description: string;
	icon: null;
	start: number;
	end: number | null;
	allDay: boolean;
	location: string | null;
	recurrence: null;
	statusKey: string | null;
	colorHint: string | null;
	createdAt: number;
	updatedAt: number;
	/** Id of the source Milestone entity. Lets the graph paint
	 *  `Event/from-milestone` derived edges so seeded calendar markers
	 *  aren't orphans (SH-36). Untouched by users — purely metadata. */
	milestoneId: string;
	/** stageId of the source milestone (null for the GA milestone). */
	stageId: string | null;
}

const STATUS_COLOR: Record<string, string> = {
	done: "#16a34a",
	"in-flight": "#3b82f6",
	partial: "#f59e0b",
	pending: "#94a3b8",
	reverted: "#dc2626",
};

const GA_COLOR = "#6366f1";

/** Pin an epoch to UTC midnight so an all-day marker lands on one day
 *  cell regardless of the source timestamp's clock time. */
function toUtcMidnight(ms: number): number {
	const d = new Date(ms);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function mapMilestonesToEvents(
	milestones: readonly SerializedMilestoneEntity[],
	release: SerializedReleaseEntity,
): SeedEventRow[] {
	return milestones.map((m) => {
		const isGa = m.stageId === null;
		const dayStart = toUtcMidnight(m.targetDate);
		return {
			// Prefix with `event-` so the Event entity id doesn't collide
			// with the source Milestone's id in entities.db (where `id` is
			// a single PRIMARY KEY across all types). Before SH-36 they
			// were identical and the backfill race silently dropped one.
			id: `event-${m.id}`,
			title: isGa ? `🚀 ${release.name} — GA` : m.name,
			description: m.summary,
			icon: null,
			start: dayStart,
			end: null,
			allDay: true,
			location: null,
			recurrence: null,
			statusKey: m.status,
			colorHint: isGa ? GA_COLOR : (STATUS_COLOR[m.status] ?? STATUS_COLOR.pending ?? "#94a3b8"),
			createdAt: m.createdAt,
			updatedAt: m.updatedAt,
			milestoneId: m.id,
			stageId: m.stageId,
		};
	});
}
