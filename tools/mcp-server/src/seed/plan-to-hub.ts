/**
 * The "Brainstorm 0.1.0 — Release Plan" hub Note (SH-25 per
 * docs/foundations/49-self-hosting.md).
 *
 * One top-level Note whose body `@`-mentions the seeded Release / Stage /
 * Milestone entities. The MentionNode persisted shape (`type:"mention"`,
 * `entityId`, `entityType`, `label`) is the on-disk protocol both the
 * Notes-side and shell-side walkers agree on, so these mentions resolve
 * to the same entity ids the Tasks / Database / Graph / Files apps use —
 * the narrative hub that ties the whole release together. Written into
 * the Notes app's `note:` keyspace alongside the doc + iteration +
 * journal notes (distinct `release-hub` id).
 *
 * Pure + deterministic.
 */

import type { SerializedStageEntity } from "./brainstorm-project.ts";
import type { SerializedMilestoneEntity, SerializedReleaseEntity } from "./release-schedule.ts";
import {
	MENTION_NODE_TYPE,
	MENTION_NODE_VERSION,
	type SeedBlock,
	type SeedInline,
	type SeedNote,
} from "./types.ts";

export const RELEASE_HUB_NOTE_ID = "release-hub";

const RELEASE_TYPE = "brainstorm/Release/v1";
const STAGE_TYPE = "brainstorm/Stage/v1";
const MILESTONE_TYPE = "brainstorm/Milestone/v1";

function text(value: string): SeedInline {
	return { type: "text", version: 1, format: 0, mode: "normal", style: "", text: value, detail: 0 };
}

function mention(entityId: string, entityType: string, label: string): SeedInline {
	return { type: MENTION_NODE_TYPE, version: MENTION_NODE_VERSION, entityId, entityType, label };
}

function para(children: SeedInline[]): SeedBlock {
	return { type: "paragraph", version: 1, format: "", indent: 0, direction: null, children };
}

function heading(value: string): SeedBlock {
	return {
		type: "heading",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		tag: "h2",
		children: [text(value)],
	};
}

export function buildReleaseHubNote(
	release: SerializedReleaseEntity,
	stages: readonly SerializedStageEntity[],
	milestones: readonly SerializedMilestoneEntity[],
): SeedNote {
	const title = `${release.name} — Release Plan`;
	const targetIso = new Date(release.targetDate).toISOString().slice(0, 10);

	const children: SeedBlock[] = [
		{
			type: "title",
			version: 1,
			format: "",
			indent: 0,
			direction: null,
			textFormat: 0,
			textStyle: "",
			children: [text(title)],
		},
		para([
			text("This vault dogfoods Brainstorm's own product management. The release — "),
			mention(release.id, RELEASE_TYPE, release.name),
			text(
				` — targets ${targetIso}, with ${release.scopeIncludes.length} items in scope and ${release.scopeExcludes.length} explicitly out.`,
			),
		]),
		heading("Stages"),
	];

	for (const s of stages) {
		children.push(para([mention(s.id, STAGE_TYPE, s.heading), text(` — ${s.status}.`)]));
	}

	children.push(heading("Milestones"));
	for (const m of milestones) {
		const iso = new Date(m.targetDate).toISOString().slice(0, 10);
		children.push(para([mention(m.id, MILESTONE_TYPE, m.name), text(` — ${iso} (${m.status}).`)]));
	}

	return {
		id: RELEASE_HUB_NOTE_ID,
		title,
		icon: { kind: "emoji", value: "🚀" },
		body: { root: { type: "root", version: 1, format: "", indent: 0, direction: null, children } },
		values: { "release-version": release.version, "release-target": targetIso },
		createdAt: release.createdAt,
		updatedAt: release.updatedAt,
	};
}
