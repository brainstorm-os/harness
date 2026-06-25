/**
 * Seeder-local kv-blob → entity-snapshot projectors.
 *
 * The dev seeder builds per-app kv-shaped blobs in memory (the same shapes
 * the first-party apps used to persist to `kv.json`) and needs to turn them
 * into `{ entities, links }` for `writeVaultEntities` to upsert into
 * `entities.db`. These are pure transforms — no disk, no DB — one function
 * per app.
 *
 * Previously these lived in the shell's `kv-entities-scan` bridge (which
 * also read the on-disk `kv.json` files for the live-shell backfill). That
 * bridge is gone; the only remaining consumer of the projection shapes is
 * this seeder, so the pure transforms moved here. The shell read path is
 * now Y.Doc-first (`entities-service` projects the canonical Y.Doc into the
 * row) and no longer scans `kv.json` at all.
 *
 * The `linkType` discriminators are imported from the shell's `link-types`
 * module so the seeder, the live read path, and the Graph renderer all
 * stamp identical edge strings.
 */

import {
	ITERATION_IN_STAGE_LINK_TYPE,
	ITERATION_RESOLVES_OQ_LINK_TYPE,
	MILESTONE_IN_RELEASE_LINK_TYPE,
	STAGE_GATED_BY_MILESTONE_LINK_TYPE,
	STAGE_IN_RELEASE_LINK_TYPE,
	TASK_IN_PROJECT_LINK_TYPE,
} from "../../../../packages/shell/src/main/entities/link-types";
import {
	NOTE_KEY_PREFIX,
	noteToProjection,
} from "../../../../packages/shell/src/main/entities/note-entities-codec";
import type { VaultEntitiesSnapshot } from "../../../../packages/shell/src/main/entities/vault-entities-service";

/**
 * Project the seeder's notes blob (the same `note:<id>` → row map written
 * to `kv.json`, whose `body` is a plain-text snippet — the rich body lives
 * in the on-disk `.ydoc`) into Note/v1 entity rows + their mention/link
 * edges, delegating to the shared pure `noteToProjection` keystone so the
 * row + edge shape is identical to what the live read path produces.
 *
 * Notes were the last app reaching entities.db only via the shell's
 * one-shot kv backfill scanning notes/kv.json. With this, the seeder writes
 * Note rows straight into entities.db like every other app, so the backfill
 * scan is no longer load-bearing for any seeded content.
 */
const JOURNAL_APP_ID = "io.brainstorm.journal";
const JOURNAL_ENTRY_TYPE = "io.brainstorm.journal/Entry/v1";
/** Journal entries share the `note:` keyspace + body shape but are their
 *  own object type, so the Notes app's `{ type: Note/v1 }` query never
 *  surfaces them. They are identifiable by their stable `journal-<date>`
 *  id (mirrors the Journal app's `journalNoteIdFor`). */
const JOURNAL_ENTRY_ID = /^journal-\d{4}-\d{2}-\d{2}$/;

export function projectNotesFromBlob(
	parsed: Record<string, unknown>,
	out: VaultEntitiesSnapshot,
): void {
	for (const [key, value] of Object.entries(parsed)) {
		if (!key.startsWith(NOTE_KEY_PREFIX)) continue;
		if (!value || typeof value !== "object") continue;
		const { entity, links } = noteToProjection(
			value as Record<string, unknown>,
			key.slice(NOTE_KEY_PREFIX.length),
		);
		// Re-type journal entries off the shared Note projection — body and
		// mention/link edges are unchanged (so the graph stays connected),
		// only the object type + owner switch to Journal.
		if (JOURNAL_ENTRY_ID.test(entity.id)) {
			entity.type = JOURNAL_ENTRY_TYPE;
			entity.ownerAppId = JOURNAL_APP_ID;
		}
		out.entities.push(entity);
		for (const link of links) out.links.push(link);
	}
}

const TASKS_APP_ID = "io.brainstorm.tasks";
const TASK_TYPE = "brainstorm/Task/v1";
const PROJECT_TYPE = "brainstorm/Project/v1";
const SECTION_TYPE = "brainstorm/Section/v1";
const TASK_KEY_PREFIX = "task:";
const PROJECT_KEY_PREFIX = "project:";
const SECTION_KEY_PREFIX = "section:";

const BOOKMARKS_APP_ID = "io.brainstorm.bookmarks";
const BOOKMARK_TYPE = "brainstorm/Bookmark/v1";
const BOOKMARK_KEY_PREFIX = "bookmark:";

const CALENDAR_APP_ID = "io.brainstorm.calendar";
const EVENT_TYPE = "brainstorm/Event/v1";
const EVENT_KEY_PREFIX = "event:";

const WHITEBOARD_APP_ID = "io.brainstorm.whiteboard";
const WHITEBOARD_TYPE = "brainstorm/Whiteboard/v1";
const WHITEBOARD_EDGE_TYPE = "brainstorm/WhiteboardEdge/v1";
const WHITEBOARD_KEY_PREFIX = "whiteboard:";
// Edge prefix `whiteboard-edge:` shares the `whiteboard:` head — when
// dispatching by prefix the edge form MUST be tested first or every edge
// row would mis-route to the board branch.
const WHITEBOARD_EDGE_KEY_PREFIX = "whiteboard-edge:";

const SELF_HOSTING_APP_ID = "io.brainstorm.self-hosting";
const ITERATION_TYPE = "brainstorm/Iteration/v1";
const STAGE_TYPE = "brainstorm/Stage/v1";
const OPEN_QUESTION_TYPE = "brainstorm/OpenQuestion/v1";
const DESIGN_DOC_TYPE = "brainstorm/DesignDoc/v1";
const RELEASE_TYPE = "brainstorm/Release/v1";
const MILESTONE_TYPE = "brainstorm/Milestone/v1";
const FOLDER_TYPE = "brainstorm/Folder/v1";
const FOLDER_KEY_PREFIX = "folder:";
const CODE_FILE_TYPE = "brainstorm/CodeFile/v1";
const CODE_FILE_KEY_PREFIX = "code-file:";
const ITERATION_KEY_PREFIX = "iteration:";
const STAGE_KEY_PREFIX = "stage:";
const OPEN_QUESTION_KEY_PREFIX = "open-question:";
const DESIGN_DOC_KEY_PREFIX = "design-doc:";
const RELEASE_KEY_PREFIX = "release:";
const MILESTONE_KEY_PREFIX = "milestone:";

export function projectTasksFromBlob(
	parsed: Record<string, unknown>,
	out: VaultEntitiesSnapshot,
): void {
	for (const [key, value] of Object.entries(parsed)) {
		if (!value || typeof value !== "object") continue;
		const row = value as Record<string, unknown>;
		if (key.startsWith(TASK_KEY_PREFIX)) {
			const id = typeof row.id === "string" ? row.id : key.slice(TASK_KEY_PREFIX.length);
			const name = typeof row.name === "string" ? row.name : "";
			const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
			const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
			const projectId = typeof row.projectId === "string" ? row.projectId : null;
			// `createdAt`/`updatedAt` are duplicated into properties as well
			// as the entity-level columns: the Tasks codec (parseStoredTask)
			// reads them from the property bag and rejects rows without
			// them, so leaving them at the entity level alone made every
			// bridged task silently unreadable until the app-side merge
			// filled the gap.
			out.entities.push({
				id,
				type: TASK_TYPE,
				properties: {
					name,
					title: name,
					notes: typeof row.notes === "string" ? row.notes : "",
					statusKey: typeof row.statusKey === "string" ? row.statusKey : null,
					priority: typeof row.priority === "string" ? row.priority : "none",
					projectId,
					sectionId: typeof row.sectionId === "string" ? row.sectionId : null,
					// SH-37: seeded tasks point back at the source iteration
					// entity so the graph paints a `Task/from-iteration` edge.
					// User-authored tasks leave this unset; null guards a non-
					// string field from emitting a junk edge.
					iterationId: typeof row.iterationId === "string" ? row.iterationId : null,
					completedAt: typeof row.completedAt === "number" ? row.completedAt : null,
					scheduledAt: typeof row.scheduledAt === "number" ? row.scheduledAt : null,
					dueAt: typeof row.dueAt === "number" ? row.dueAt : null,
					createdAt,
					updatedAt,
				},
				createdAt,
				updatedAt,
				deletedAt: null,
				ownerAppId: TASKS_APP_ID,
			});
			if (projectId) {
				out.links.push({
					id: `lnk_${id}_in-project_${projectId}`,
					sourceEntityId: id,
					destEntityId: projectId,
					linkType: TASK_IN_PROJECT_LINK_TYPE,
					createdAt: updatedAt,
					deletedAt: null,
				});
			}
		} else if (key.startsWith(PROJECT_KEY_PREFIX)) {
			const id = typeof row.id === "string" ? row.id : key.slice(PROJECT_KEY_PREFIX.length);
			const name = typeof row.name === "string" ? row.name : "";
			const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
			const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
			out.entities.push({
				id,
				type: PROJECT_TYPE,
				properties: {
					name,
					title: name,
					description: typeof row.description === "string" ? row.description : "",
					statusKey: typeof row.statusKey === "string" ? row.statusKey : null,
					milestoneAt: typeof row.milestoneAt === "number" ? row.milestoneAt : null,
					archivedAt: typeof row.archivedAt === "number" ? row.archivedAt : null,
					colorHint: typeof row.colorHint === "string" ? row.colorHint : null,
					createdAt,
					updatedAt,
				},
				createdAt,
				updatedAt,
				deletedAt: null,
				ownerAppId: TASKS_APP_ID,
			});
		} else if (key.startsWith(SECTION_KEY_PREFIX)) {
			const id = typeof row.id === "string" ? row.id : key.slice(SECTION_KEY_PREFIX.length);
			const name = typeof row.name === "string" ? row.name : "";
			const projectId = typeof row.projectId === "string" ? row.projectId : null;
			if (!projectId) continue; // a section is meaningless without its project
			const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
			const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
			out.entities.push({
				id,
				type: SECTION_TYPE,
				properties: {
					name,
					title: name,
					projectId,
					sortIndex: typeof row.sortIndex === "number" ? row.sortIndex : 0,
					collapsed: typeof row.collapsed === "boolean" ? row.collapsed : false,
					createdAt,
					updatedAt,
				},
				createdAt,
				updatedAt,
				deletedAt: null,
				ownerAppId: TASKS_APP_ID,
			});
		}
	}
}

export function projectBookmarksFromBlob(
	parsed: Record<string, unknown>,
	out: VaultEntitiesSnapshot,
): void {
	for (const [key, value] of Object.entries(parsed)) {
		if (!key.startsWith(BOOKMARK_KEY_PREFIX)) continue;
		if (!value || typeof value !== "object") continue;
		const row = value as Record<string, unknown>;

		const id = typeof row.id === "string" ? row.id : key.slice(BOOKMARK_KEY_PREFIX.length);
		const url = typeof row.url === "string" ? row.url : "";
		const title = typeof row.title === "string" ? row.title : "";
		const savedAt = typeof row.savedAt === "number" ? row.savedAt : Date.now();
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : savedAt;
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const tags = Array.isArray(row.tags)
			? (row.tags.filter((t) => typeof t === "string") as string[])
			: [];

		out.entities.push({
			id,
			type: BOOKMARK_TYPE,
			properties: {
				// Display name surfaced by Graph / Database / the universal
				// object picker; falls back to the URL when title is blank.
				name: title || url,
				title,
				url,
				description: typeof row.description === "string" ? row.description : "",
				notes: typeof row.notes === "string" ? row.notes : "",
				faviconUrl: typeof row.faviconUrl === "string" ? row.faviconUrl : null,
				coverImageUrl: typeof row.coverImageUrl === "string" ? row.coverImageUrl : null,
				colorHint: typeof row.colorHint === "string" ? row.colorHint : null,
				tags,
				savedAt,
				readAt: typeof row.readAt === "number" ? row.readAt : null,
				archivedAt: typeof row.archivedAt === "number" ? row.archivedAt : null,
				createdAt,
				updatedAt,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: BOOKMARKS_APP_ID,
		});
	}
}

export function projectCalendarFromBlob(
	parsed: Record<string, unknown>,
	out: VaultEntitiesSnapshot,
): void {
	for (const [key, value] of Object.entries(parsed)) {
		if (!key.startsWith(EVENT_KEY_PREFIX)) continue;
		if (!value || typeof value !== "object") continue;
		const row = value as Record<string, unknown>;

		const id = typeof row.id === "string" ? row.id : key.slice(EVENT_KEY_PREFIX.length);
		const title = typeof row.title === "string" ? row.title : "";
		const start = typeof row.start === "number" ? row.start : Date.now();
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : start;
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const end = typeof row.end === "number" ? row.end : null;
		// Drop a structurally invalid span (end before start) at projection
		// time so the codec doesn't see a row it would reject anyway.
		if (end !== null && end < start) continue;

		out.entities.push({
			id,
			type: EVENT_TYPE,
			properties: {
				name: title,
				title,
				description: typeof row.description === "string" ? row.description : "",
				start,
				end,
				allDay: row.allDay === true,
				location: typeof row.location === "string" ? row.location : null,
				recurrence: row.recurrence ?? null,
				statusKey: typeof row.statusKey === "string" ? row.statusKey : null,
				colorHint: typeof row.colorHint === "string" ? row.colorHint : null,
				// SH-36: seeded events carry the source-milestone id (and
				// stageId for non-GA) so the derived-link pass paints an
				// Event/from-milestone edge. User-authored events leave both
				// fields unset; the rule only emits an edge when milestoneId
				// is a non-empty string.
				milestoneId: typeof row.milestoneId === "string" ? row.milestoneId : null,
				stageId: typeof row.stageId === "string" ? row.stageId : null,
				createdAt,
				updatedAt,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: CALENDAR_APP_ID,
		});
	}
}

export function projectWhiteboardFromBlob(
	parsed: Record<string, unknown>,
	out: VaultEntitiesSnapshot,
): void {
	for (const [key, value] of Object.entries(parsed)) {
		if (!value || typeof value !== "object") continue;
		const row = value as Record<string, unknown>;
		// `whiteboard-edge:` must be tested first — it shares the
		// `whiteboard:` head and the looser branch would catch every edge.
		if (key.startsWith(WHITEBOARD_EDGE_KEY_PREFIX)) {
			const id = typeof row.id === "string" ? row.id : key.slice(WHITEBOARD_EDGE_KEY_PREFIX.length);
			const whiteboardId = typeof row.whiteboardId === "string" ? row.whiteboardId : "";
			if (whiteboardId === "") continue;
			const sourceNodeId = typeof row.sourceNodeId === "string" ? row.sourceNodeId : "";
			const destNodeId = typeof row.destNodeId === "string" ? row.destNodeId : "";
			if (sourceNodeId === "" || destNodeId === "") continue;
			const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
			const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
			const label = typeof row.label === "string" ? row.label : null;
			out.entities.push({
				id,
				type: WHITEBOARD_EDGE_TYPE,
				properties: {
					// Edges don't carry a user-authored name; surface the
					// label when present, else a stable fallback so Graph
					// and the universal picker always have something to
					// render.
					name: label ?? "edge",
					title: label ?? "",
					whiteboardId,
					sourceNodeId,
					sourceHandle: typeof row.sourceHandle === "string" ? row.sourceHandle : null,
					destNodeId,
					destHandle: typeof row.destHandle === "string" ? row.destHandle : null,
					pathKind: typeof row.pathKind === "string" ? row.pathKind : null,
					arrowHead: typeof row.arrowHead === "string" ? row.arrowHead : null,
					label,
					colorHint: typeof row.colorHint === "string" ? row.colorHint : null,
					createdAt,
					updatedAt,
				},
				createdAt,
				updatedAt,
				deletedAt: null,
				ownerAppId: WHITEBOARD_APP_ID,
			});
			continue;
		}
		if (!key.startsWith(WHITEBOARD_KEY_PREFIX)) continue;

		const id = typeof row.id === "string" ? row.id : key.slice(WHITEBOARD_KEY_PREFIX.length);
		const name = typeof row.name === "string" ? row.name : "";
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		// `nodes` is large and validated by the app's codec on read;
		// projection just passes the array through as-stored (codec drops
		// malformed entries) — pre-filtering here would duplicate logic
		// and risks the projection diverging from the codec on every
		// node-shape change.
		const nodes = Array.isArray(row.nodes) ? row.nodes : [];

		out.entities.push({
			id,
			type: WHITEBOARD_TYPE,
			properties: {
				name,
				title: name,
				description: typeof row.description === "string" ? row.description : "",
				nodes,
				createdAt,
				updatedAt,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: WHITEBOARD_APP_ID,
		});
	}
}

export function projectSelfHostingFromBlob(
	parsed: Record<string, unknown>,
	out: VaultEntitiesSnapshot,
): void {
	const stageIdByRaw = new Map<string, string>();
	const oqIdByCode = new Map<string, string>();

	const stagePending: Array<{ key: string; row: Record<string, unknown> }> = [];
	const iterationPending: Array<{ key: string; row: Record<string, unknown> }> = [];
	const oqPending: Array<{ key: string; row: Record<string, unknown> }> = [];
	const docPending: Array<{ key: string; row: Record<string, unknown> }> = [];
	const releasePending: Array<{ key: string; row: Record<string, unknown> }> = [];
	const milestonePending: Array<{ key: string; row: Record<string, unknown> }> = [];
	const folderPending: Array<{ key: string; row: Record<string, unknown> }> = [];
	const codeFilePending: Array<{ key: string; row: Record<string, unknown> }> = [];

	for (const [key, value] of Object.entries(parsed)) {
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;
		const row = value as Record<string, unknown>;
		if (key.startsWith(STAGE_KEY_PREFIX)) stagePending.push({ key, row });
		else if (key.startsWith(ITERATION_KEY_PREFIX)) iterationPending.push({ key, row });
		else if (key.startsWith(OPEN_QUESTION_KEY_PREFIX)) oqPending.push({ key, row });
		else if (key.startsWith(MILESTONE_KEY_PREFIX)) milestonePending.push({ key, row });
		else if (key.startsWith(RELEASE_KEY_PREFIX)) releasePending.push({ key, row });
		else if (key.startsWith(FOLDER_KEY_PREFIX)) folderPending.push({ key, row });
		else if (key.startsWith(CODE_FILE_KEY_PREFIX)) codeFilePending.push({ key, row });
		else if (key.startsWith(DESIGN_DOC_KEY_PREFIX)) docPending.push({ key, row });
	}

	for (const { key, row } of stagePending) {
		const id = typeof row.id === "string" ? row.id : key.slice(STAGE_KEY_PREFIX.length);
		const stageId = typeof row.stageId === "string" ? row.stageId : "";
		const heading = typeof row.heading === "string" ? row.heading : "";
		const status = typeof row.status === "string" ? row.status : "unknown";
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const iterationCodes = Array.isArray(row.iterationCodes)
			? (row.iterationCodes.filter((c) => typeof c === "string") as string[])
			: [];
		const exitCriteria = Array.isArray(row.exitCriteria)
			? (row.exitCriteria.filter((c) => typeof c === "string") as string[])
			: [];
		const name = stageId ? `${stageId} — ${heading}` : heading;
		out.entities.push({
			id,
			type: STAGE_TYPE,
			properties: {
				name,
				title: heading,
				stageId,
				status,
				goal: typeof row.goal === "string" ? row.goal : null,
				ownerDomain: typeof row.ownerDomain === "string" ? row.ownerDomain : null,
				iterationCodes,
				exitCriteria,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});
		if (stageId) stageIdByRaw.set(stageId, id);
	}

	for (const { key, row } of oqPending) {
		const id = typeof row.id === "string" ? row.id : key.slice(OPEN_QUESTION_KEY_PREFIX.length);
		const code = typeof row.code === "string" ? row.code : "";
		const title = typeof row.title === "string" ? row.title : "";
		const status = typeof row.status === "string" ? row.status : "open";
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const name = code ? `${code} — ${title}` : title;
		out.entities.push({
			id,
			type: OPEN_QUESTION_TYPE,
			properties: {
				name,
				title,
				code,
				number: typeof row.number === "number" ? row.number : null,
				section: typeof row.section === "string" ? row.section : "",
				status,
				where: typeof row.where === "string" ? row.where : null,
				question: typeof row.question === "string" ? row.question : null,
				resolution: typeof row.resolution === "string" ? row.resolution : null,
				resolutionRef: typeof row.resolutionRef === "string" ? row.resolutionRef : null,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});
		if (code) oqIdByCode.set(code, id);
	}

	for (const { key, row } of iterationPending) {
		const id = typeof row.id === "string" ? row.id : key.slice(ITERATION_KEY_PREFIX.length);
		const code = typeof row.code === "string" ? row.code : "";
		const stageRaw = typeof row.stageId === "string" ? row.stageId : "";
		const title = typeof row.title === "string" ? row.title : "";
		const status = typeof row.status === "string" ? row.status : "pending";
		const summary = typeof row.summary === "string" ? row.summary : "";
		const completedAt = typeof row.completedAt === "number" ? row.completedAt : null;
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const resolvedOQs = Array.isArray(row.resolvedOQs)
			? (row.resolvedOQs.filter((c) => typeof c === "string") as string[])
			: [];
		const name = code ? `${code} — ${title}` : title;
		out.entities.push({
			id,
			type: ITERATION_TYPE,
			properties: {
				name,
				title,
				code,
				stageId: stageRaw,
				status,
				summary,
				completedAt,
				resolvedOQs,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});

		const stageEntityId = stageIdByRaw.get(stageRaw);
		if (stageEntityId) {
			out.links.push({
				id: `lnk_${id}_in-stage_${stageEntityId}`,
				sourceEntityId: id,
				destEntityId: stageEntityId,
				linkType: ITERATION_IN_STAGE_LINK_TYPE,
				createdAt: updatedAt,
				deletedAt: null,
			});
		}
		for (const oqCode of resolvedOQs) {
			const oqEntityId = oqIdByCode.get(oqCode);
			if (!oqEntityId) continue;
			out.links.push({
				id: `lnk_${id}_resolves-oq_${oqEntityId}`,
				sourceEntityId: id,
				destEntityId: oqEntityId,
				linkType: ITERATION_RESOLVES_OQ_LINK_TYPE,
				createdAt: updatedAt,
				deletedAt: null,
			});
		}
	}

	for (const { key, row } of docPending) {
		const id = typeof row.id === "string" ? row.id : key.slice(DESIGN_DOC_KEY_PREFIX.length);
		const path = typeof row.path === "string" ? row.path : "";
		const title = typeof row.title === "string" ? row.title : "";
		const slug = typeof row.slug === "string" ? row.slug : "";
		const category = typeof row.category === "string" ? row.category : "";
		const docNumber = typeof row.docNumber === "number" ? row.docNumber : null;
		const excerpt = typeof row.excerpt === "string" ? row.excerpt : "";
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const name = docNumber !== null ? `${docNumber}. ${title}` : title;
		out.entities.push({
			id,
			type: DESIGN_DOC_TYPE,
			properties: {
				name,
				title,
				path,
				slug,
				category,
				docNumber,
				excerpt,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});
	}

	let releaseEntityId: string | null = null;
	for (const { key, row } of releasePending) {
		const id = typeof row.id === "string" ? row.id : key.slice(RELEASE_KEY_PREFIX.length);
		const version = typeof row.version === "string" ? row.version : "";
		const name = typeof row.name === "string" ? row.name : `Brainstorm ${version}`;
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		releaseEntityId = id;
		out.entities.push({
			id,
			type: RELEASE_TYPE,
			properties: {
				name,
				title: name,
				version,
				targetDate: typeof row.targetDate === "number" ? row.targetDate : null,
				status: typeof row.status === "string" ? row.status : "in-progress",
				scopeIncludes: Array.isArray(row.scopeIncludes)
					? (row.scopeIncludes.filter((c) => typeof c === "string") as string[])
					: [],
				scopeExcludes: Array.isArray(row.scopeExcludes)
					? (row.scopeExcludes.filter((c) => typeof c === "string") as string[])
					: [],
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});
	}

	if (releaseEntityId) {
		for (const stageEntityId of stageIdByRaw.values()) {
			out.links.push({
				id: `lnk_${stageEntityId}_in-release_${releaseEntityId}`,
				sourceEntityId: stageEntityId,
				destEntityId: releaseEntityId,
				linkType: STAGE_IN_RELEASE_LINK_TYPE,
				createdAt: 0,
				deletedAt: null,
			});
		}
	}

	for (const { key, row } of milestonePending) {
		const id = typeof row.id === "string" ? row.id : key.slice(MILESTONE_KEY_PREFIX.length);
		const name = typeof row.name === "string" ? row.name : "";
		const stageEntityId = typeof row.stageId === "string" ? row.stageId : null;
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const targetDate = typeof row.targetDate === "number" ? row.targetDate : null;
		out.entities.push({
			id,
			type: MILESTONE_TYPE,
			properties: {
				name,
				title: name,
				stageId: stageEntityId,
				targetDate,
				status: typeof row.status === "string" ? row.status : "pending",
				summary: typeof row.summary === "string" ? row.summary : "",
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});
		if (releaseEntityId) {
			out.links.push({
				id: `lnk_${id}_in-release_${releaseEntityId}`,
				sourceEntityId: id,
				destEntityId: releaseEntityId,
				linkType: MILESTONE_IN_RELEASE_LINK_TYPE,
				createdAt: updatedAt,
				deletedAt: null,
			});
		}
		if (stageEntityId) {
			out.links.push({
				id: `lnk_${stageEntityId}_gated-by_${id}`,
				sourceEntityId: stageEntityId,
				destEntityId: id,
				linkType: STAGE_GATED_BY_MILESTONE_LINK_TYPE,
				createdAt: updatedAt,
				deletedAt: null,
			});
		}
	}

	for (const { key, row } of folderPending) {
		const id = typeof row.id === "string" ? row.id : key.slice(FOLDER_KEY_PREFIX.length);
		const name = typeof row.name === "string" ? row.name : "";
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		const members = Array.isArray(row.members)
			? (row.members.filter((m) => typeof m === "string") as string[])
			: [];
		out.entities.push({
			id,
			type: FOLDER_TYPE,
			properties: {
				name,
				title: name,
				members,
				view: typeof row.view === "string" ? row.view : "list",
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});
	}

	for (const { key, row } of codeFilePending) {
		const id = typeof row.id === "string" ? row.id : key.slice(CODE_FILE_KEY_PREFIX.length);
		const path = typeof row.path === "string" ? row.path : id;
		const content = typeof row.content === "string" ? row.content : "";
		const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
		const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
		out.entities.push({
			id,
			type: CODE_FILE_TYPE,
			properties: {
				name: path,
				title: path,
				path,
				language: typeof row.language === "string" ? row.language : "plaintext",
				content,
			},
			createdAt,
			updatedAt,
			deletedAt: null,
			ownerAppId: SELF_HOSTING_APP_ID,
		});
	}
}
