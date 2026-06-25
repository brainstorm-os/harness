/**
 * Build a `WikilinkResolver` from the seeded entity set.
 *
 * The implementation log peppers prose with `[[X]]` references where `X` is
 * usually a memory-file slug (no vault entity) but sometimes a real
 * cross-reference: an iteration code (`9.14.1`, `SH-7`), an OQ code
 * (`OQ-228`), a design-doc slug (`self-hosting`). When the wikilink parser
 * sees one of those, the resolver returns the right entity id + type +
 * label so the seeded note carries a real `MentionNode` chip instead of
 * literal bracketed text.
 *
 * For an iteration / design-doc / journal entity, the resolver prefers the
 * **Notes-app** id (`iteration-<code-with-dashes>` / `doc-<slug>` /
 * `journal-<date>`) — those rows are the rich-editable surface, and
 * clicking a mention chip opens that surface. OQs / stages / milestones /
 * the release live only in the self-hosting projection, so the resolver
 * returns their self-hosting ids and `brainstorm/*` types — matching what
 * `plan-to-hub.ts` already does for hand-wired mentions.
 *
 * Pure: given the same entity set, the resolver returns the same target
 * for every slug.
 */

import type {
	SerializedDesignDocEntity,
	SerializedIterationEntity,
	SerializedOpenQuestionEntity,
	SerializedStageEntity,
} from "./brainstorm-project.ts";
import type { SerializedMilestoneEntity, SerializedReleaseEntity } from "./release-schedule.ts";
import type { WikilinkResolver, WikilinkTarget } from "./wikilinks.ts";

const NOTES_NOTE_TYPE = "io.brainstorm.notes/Note/v1";
const OQ_TYPE = "brainstorm/OpenQuestion/v1";
const STAGE_TYPE = "brainstorm/Stage/v1";
const MILESTONE_TYPE = "brainstorm/Milestone/v1";
const RELEASE_TYPE = "brainstorm/Release/v1";

export interface ResolverEntities {
	iterations: readonly SerializedIterationEntity[];
	openQuestions: readonly SerializedOpenQuestionEntity[];
	stages: readonly SerializedStageEntity[];
	designDocs: readonly SerializedDesignDocEntity[];
	release: SerializedReleaseEntity;
	milestones: readonly SerializedMilestoneEntity[];
}

/** Iteration-note id (mirrors `iterations-to-notes.ts` `iterationNoteId`)
 *  without depending on it — keeps this module free of cyclic imports. */
function iterationNoteIdOf(code: string): string {
	return `iteration-${code.replace(/\./g, "-")}`;
}

function key(s: string): string {
	return s.trim().toLowerCase();
}

/** Build a resolver from the project-entity set. The same slug pointing to
 *  the same entity registers under multiple aliases (code, id, lowercased
 *  variants) so any plausible wikilink shape we see in the log resolves. */
export function buildEntityWikilinkResolver(entities: ResolverEntities): WikilinkResolver {
	const map = new Map<string, WikilinkTarget>();
	const register = (alias: string, target: WikilinkTarget) => {
		const k = key(alias);
		if (k.length === 0) return;
		if (!map.has(k)) map.set(k, target);
	};

	for (const it of entities.iterations) {
		const noteId = iterationNoteIdOf(it.code);
		const target: WikilinkTarget = {
			entityId: noteId,
			entityType: NOTES_NOTE_TYPE,
			label: `${it.code} — ${it.title}`,
		};
		register(it.code, target);
		register(it.id, target);
		register(noteId, target);
	}

	for (const oq of entities.openQuestions) {
		const target: WikilinkTarget = {
			entityId: oq.id,
			entityType: OQ_TYPE,
			label: `${oq.code} — ${oq.title}`,
		};
		register(oq.code, target);
		register(oq.id, target);
	}

	for (const dd of entities.designDocs) {
		const target: WikilinkTarget = {
			entityId: dd.id,
			entityType: NOTES_NOTE_TYPE,
			label: dd.title,
		};
		register(dd.id, target);
		register(dd.slug, target);
	}

	for (const st of entities.stages) {
		const target: WikilinkTarget = {
			entityId: st.id,
			entityType: STAGE_TYPE,
			label: st.heading,
		};
		register(st.id, target);
		register(st.stageId, target);
		register(`stage-${st.stageId}`, target);
	}

	for (const ms of entities.milestones) {
		const target: WikilinkTarget = {
			entityId: ms.id,
			entityType: MILESTONE_TYPE,
			label: ms.name,
		};
		register(ms.id, target);
	}

	const releaseTarget: WikilinkTarget = {
		entityId: entities.release.id,
		entityType: RELEASE_TYPE,
		label: entities.release.name,
	};
	register(entities.release.id, releaseTarget);
	register(entities.release.version, releaseTarget);

	return (slug: string): WikilinkTarget | null => map.get(key(slug)) ?? null;
}
