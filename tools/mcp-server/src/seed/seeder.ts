import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readLogSource, readOQSource, readPlanSource } from "../resources.ts";
import {
	type BrainstormProjectEntities,
	type DesignDocSource,
	buildBrainstormProjectEntities,
} from "./brainstorm-project.ts";
import {
	DATABASE_STORAGE_KEY,
	buildDatabasePlanViews,
	mergeIntoDatabaseState,
} from "./database-views.ts";
import { buildDemoNotes } from "./dataset.ts";
import {
	buildDocsAsNotes,
	extractExcerpt,
	extractTitle,
	loadRepoDesignDocs,
} from "./docs-to-notes.ts";
import { buildFeatureArticles } from "./feature-articles.ts";
import {
	type SeedSectionRow,
	PROJECT_KEY_PREFIX as TASKS_PROJECT_KEY_PREFIX,
	SECTION_KEY_PREFIX as TASKS_SECTION_KEY_PREFIX,
	TASK_KEY_PREFIX as TASKS_TASK_KEY_PREFIX,
	mapPlanToTasksApp,
} from "./iteration-to-task.ts";
import { buildIterationsAsNotes } from "./iterations-to-notes.ts";
import { BOOKMARK_KEY_PREFIX, buildResearchBookmarks } from "./plan-to-bookmarks.ts";
import { EVENT_KEY_PREFIX, mapMilestonesToEvents } from "./plan-to-calendar.ts";
import {
	CODE_FILE_KEY_PREFIX,
	type SerializedCodeFileEntity,
	type SerializedReferenceCodeFolder,
	buildReferenceCodeFiles,
	buildReferenceCodeFolder,
} from "./plan-to-codefiles.ts";
import {
	FOLDER_KEY_PREFIX,
	type SerializedFolderEntity,
	buildDocsFolderTree,
} from "./plan-to-files.ts";
import { GRAPH_STATE_KEY, buildPlanGraphState } from "./plan-to-graph.ts";
import { buildReleaseHubNote } from "./plan-to-hub.ts";
import { buildJournalEntries } from "./plan-to-journal.ts";
import {
	type RoadmapBoard,
	EDGE_KEY_PREFIX as WB_EDGE_KEY_PREFIX,
	WHITEBOARD_KEY_PREFIX,
	buildSeedBoards,
} from "./plan-to-whiteboard.ts";
import type { SeedNote } from "./types.ts";
import { NOTE_KEY_PREFIX } from "./types.ts";
import { buildEntityWikilinkResolver } from "./wikilink-resolver.ts";
import { materializeSeededNote } from "./write-ydoc.ts";

export enum SeedScope {
	Notes = "notes",
	BrainstormProject = "brainstorm-project",
}

export const NOTES_APP_ID = "io.brainstorm.notes";
export const SELF_HOSTING_APP_ID = "io.brainstorm.self-hosting";
export const TASKS_APP_ID = "io.brainstorm.tasks";
export const DATABASE_APP_ID = "io.brainstorm.database";
export const GRAPH_APP_ID = "io.brainstorm.graph";
export const CALENDAR_APP_ID = "io.brainstorm.calendar";
export const WHITEBOARD_APP_ID = "io.brainstorm.whiteboard";
export const BOOKMARKS_APP_ID = "io.brainstorm.bookmarks";

export const ITERATION_KEY_PREFIX = "iteration:";
export const OQ_KEY_PREFIX = "open-question:";
export const STAGE_KEY_PREFIX = "stage:";
export const DESIGN_DOC_KEY_PREFIX = "design-doc:";
export const RELEASE_KEY_PREFIX = "release:";
export const MILESTONE_KEY_PREFIX = "milestone:";

export enum SeedMode {
	Merge = "merge",
	Replace = "replace",
}

export interface SeedRequest {
	vaultPath: string;
	scopes?: SeedScope[];
	mode?: SeedMode;
	dryRun?: boolean;
	/** Override the seeder's clock. Tests pass a fixed value for determinism;
	 *  the CLI passes `Date.now()` so iteration schedules anchor to real time. */
	now?: number;
}

export interface SeedReport {
	dryRun: boolean;
	mode: SeedMode;
	wrote: Record<string, SeedWriteRecord>;
	/** Result of projecting the seeded blobs into `entities.db`. Absent on a
	 *  dry run or when no entity-bearing scope ran. `deferredToSidecar` means
	 *  the vault is encrypted and the shell will apply the snapshot. */
	entities?: import("./write-vault-entities").WriteStats;
}

export interface SeedWriteRecord {
	path: string;
	keysWritten: string[];
	keysPreserved: string[];
	totalKeysAfter: number;
}

/**
 * Generates a demo dataset and writes it to per-app `kv.json` files under
 * the target vault. Idempotent — re-running with the same args yields the
 * same files (stable ids + stable timestamps in the dataset).
 *
 * Scope `notes` is the only one wired today; the `vault-entities-service`
 * reads it on every `vaultEntities.list()` call so the apps see the data
 * without any further wiring.
 */
export async function seedVault(request: SeedRequest): Promise<SeedReport> {
	if (!request.vaultPath) throw new Error("seedVault: vaultPath is required");
	const mode = request.mode ?? SeedMode.Merge;
	const dryRun = request.dryRun ?? false;
	const scopes = request.scopes && request.scopes.length > 0 ? request.scopes : [SeedScope.Notes];
	const wrote: Record<string, SeedWriteRecord> = {};
	// 9.3.5 seeder slice — accumulate per-app in-memory blobs across the
	// scopes; after the legacy kv writes finish, project the blobs into
	// `entities.db` directly so the running shell sees fresh data on
	// the next `vaultEntities.list` call (no kv→entities backfill lag).
	const blobsForEntitiesDb: import("./write-vault-entities").SeederBlobs = {};

	for (const scope of scopes) {
		switch (scope) {
			case SeedScope.Notes:
				wrote[NOTES_APP_ID] = seedNotes(request.vaultPath, mode, dryRun);
				break;
			case SeedScope.BrainstormProject: {
				const result = seedBrainstormProject(request.vaultPath, mode, dryRun, request.now);
				wrote[SELF_HOSTING_APP_ID] = result.selfHosting;
				wrote[TASKS_APP_ID] = result.tasks;
				wrote[DATABASE_APP_ID] = result.database;
				wrote[GRAPH_APP_ID] = result.graph;
				wrote[CALENDAR_APP_ID] = result.calendar;
				wrote[WHITEBOARD_APP_ID] = result.whiteboard;
				wrote[BOOKMARKS_APP_ID] = result.bookmarks;
				wrote[`${NOTES_APP_ID}:design-docs`] = result.notes;
				blobsForEntitiesDb.tasks = result.tasksBlob;
				blobsForEntitiesDb.calendar = result.calendarBlob;
				blobsForEntitiesDb.bookmarks = result.bookmarksBlob;
				blobsForEntitiesDb.whiteboard = result.whiteboardBlob;
				blobsForEntitiesDb.selfHosting = result.selfHostingBlob;
				blobsForEntitiesDb.notes = result.notesBlob;
				break;
			}
		}
	}

	// Write the projected entity snapshot directly into
	// `<vault>/data/entities.db`. Every app reads via
	// `vaultEntities.list` → `entities.db`, so the data is live to running
	// apps on the next `vaultEntities.onChange` without a vault reopen.
	let entities: import("./write-vault-entities").WriteStats | undefined;
	if (!dryRun && Object.keys(blobsForEntitiesDb).length > 0) {
		const { writeVaultEntities } = await import("./write-vault-entities");
		entities = await writeVaultEntities(request.vaultPath, blobsForEntitiesDb);
	}

	return { dryRun, mode, wrote, ...(entities ? { entities } : {}) };
}

function seedBrainstormProject(
	vaultPath: string,
	mode: SeedMode,
	dryRun: boolean,
	now: number | undefined,
): {
	selfHosting: SeedWriteRecord;
	tasks: SeedWriteRecord;
	database: SeedWriteRecord;
	graph: SeedWriteRecord;
	calendar: SeedWriteRecord;
	whiteboard: SeedWriteRecord;
	bookmarks: SeedWriteRecord;
	notes: SeedWriteRecord;
	// 9.3.5 seeder slice — per-app in-memory blobs the caller projects
	// straight into `entities.db` via `kv-blob-projectors`. Same key-
	// prefixed shape the apps used to persist to `kv.json`.
	tasksBlob: Record<string, unknown>;
	calendarBlob: Record<string, unknown>;
	bookmarksBlob: Record<string, unknown>;
	whiteboardBlob: Record<string, unknown>;
	selfHostingBlob: Record<string, unknown>;
	notesBlob: Record<string, unknown>;
} {
	// Real DesignDoc entities (not just doc-as-Note rows): drives the
	// Database docs gallery (SH-17), the Graph `D` subject (SH-18) and the
	// Files docs tree (SH-22). The doc-as-Note rows still get written
	// separately below for rich editing.
	const repoDocs = loadRepoDesignDocs();
	const designDocSources = repoDocs.map((d) => ({
		path: d.path,
		title: extractTitle(d.body) || d.path,
		excerpt: extractExcerpt(d.body),
	}));
	const entities = buildBrainstormProjectEntities({
		planSource: readPlanSource(),
		oqSource: readOQSource(),
		logSource: readLogSource(),
		designDocs: designDocSources,
		...(now === undefined ? {} : { now }),
	});
	const wikilinkResolver = buildEntityWikilinkResolver(entities);

	// 1. Self-hosting app KV — every entity, full fidelity, prefixed by
	//    type. The `docs/` folder tree (SH-22) rides the same projection:
	//    Folder/v1 rows that nest the DesignDoc entities for the Files app.
	const folders = buildDocsFolderTree(entities.designDocs, entities.release.updatedAt);
	const codeFiles = buildReferenceCodeFiles();
	const referenceCodeFolder = buildReferenceCodeFolder(codeFiles);
	const selfHostingPath = join(vaultPath, "data", "apps", SELF_HOSTING_APP_ID, "kv.json");
	const selfHosting = writeSelfHostingKv(
		selfHostingPath,
		entities,
		folders,
		codeFiles,
		referenceCodeFolder,
		mode,
		dryRun,
	);

	// 2. Tasks app KV — plan iterations mapped to Task/v1 rows, stages to
	//    Project/v1 rows. Lets the existing Tasks renderer show the
	//    implementation plan as a project with zero app-code changes.
	const tasksPath = join(vaultPath, "data", "apps", TASKS_APP_ID, "kv.json");
	const {
		tasks: taskRows,
		projects: projectRows,
		sections: sectionRows,
	} = mapPlanToTasksApp(entities.iterations, entities.stages, entities.milestones, entities.release);
	const tasks = writeTasksKv(tasksPath, taskRows, projectRows, sectionRows, mode, dryRun);

	// 3. Database app KV — one List + three Views (board by stage, board by
	//    status, timeline) that surface the same Task/v1 rows in the
	//    Database app's chrome. Persisted into `database:state.userLists` /
	//    `userViews`; user-authored entries unrelated to the plan are
	//    preserved.
	const databasePath = join(vaultPath, "data", "apps", DATABASE_APP_ID, "kv.json");
	const database = writeDatabaseKv(databasePath, mode, dryRun);

	// 3b. Graph app KV — one persisted `graph:state` whose pattern shows
	//     the plan structure (Release ← Stage/Milestone ← Iteration → OQ),
	//     coloured by type. The Graph app already resolves the self-hosting
	//     entities from the vault snapshot (SH-15 projection); this just
	//     seeds the pattern so opening Graph lands on that structure.
	const graphPath = join(vaultPath, "data", "apps", GRAPH_APP_ID, "kv.json");
	const graph = writeGraphKv(graphPath, mode, dryRun);

	// 3c. Calendar app KV — every milestone (incl. GA) becomes an all-day
	//     Event so the release timeline shows on the month grid.
	const calendarPath = join(vaultPath, "data", "apps", CALENDAR_APP_ID, "kv.json");
	const eventRows = mapMilestonesToEvents(entities.milestones, entities.release);
	const calendar = writeCalendarKv(calendarPath, eventRows, mode, dryRun);

	// 3d. Whiteboard app KV — three seeded boards: the v0.1.0 Roadmap
	//     (status-coloured stage frames + scope stickies + today marker),
	//     an Architecture overview (Apps / Shell / Core swim lanes), and
	//     an In-flight focus board (per-partial-stage progress cards).
	const whiteboardPath = join(vaultPath, "data", "apps", WHITEBOARD_APP_ID, "kv.json");
	const seedBoards = buildSeedBoards(
		entities.stages,
		entities.iterations,
		entities.milestones,
		entities.release,
		entities.release.updatedAt,
	);
	const whiteboard = writeWhiteboardKv(whiteboardPath, seedBoards.boards, mode, dryRun);

	// 3e. Bookmarks app KV — curated external research the design anchors
	//     on (Block Protocol / Yjs / Lexical / CRDT / Electron security …).
	const bookmarksPath = join(vaultPath, "data", "apps", BOOKMARKS_APP_ID, "kv.json");
	const bookmarks = writeBookmarksKv(bookmarksPath, buildResearchBookmarks(), mode, dryRun);

	// 4. Notes app KV — every design doc under docs/ becomes a Note with
	//    H1-as-title + first-paragraph-as-excerpt, AND every iteration in
	//    the plan becomes a Note keyed by `iteration-<code>` so a user can
	//    open Notes and edit any iteration's body richly (per the
	//    "everything text-editable opens in Notes" direction). The two row
	//    sets share one `note:*` keyspace; their ids never collide because
	//    docs use `doc-*` and iterations use `iteration-*`.
	const notesPath = join(vaultPath, "data", "apps", NOTES_APP_ID, "kv.json");
	const docNotes = buildDocsAsNotes(repoDocs, wikilinkResolver);
	const iterationNotes = buildIterationsAsNotes(entities.iterations, wikilinkResolver);
	const journalNotes = buildJournalEntries(entities.iterations, wikilinkResolver);
	const articleNotes = buildFeatureArticles();
	const hubNote = buildReleaseHubNote(entities.release, entities.stages, entities.milestones);
	const { record: notes, blob: notesBlob } = writeDocNotesKv(
		vaultPath,
		notesPath,
		[hubNote, ...articleNotes, ...docNotes, ...iterationNotes, ...journalNotes],
		mode,
		dryRun,
	);

	// 9.3.5 seeder slice — build the same key-prefixed blobs the apps used
	// to persist to `kv.json`, so `kv-blob-projectors` produces a byte-
	// identical entity snapshot from in-memory data.
	const tasksBlob: Record<string, unknown> = {};
	for (const row of taskRows) tasksBlob[`task:${row.id}`] = row;
	for (const row of projectRows) tasksBlob[`project:${row.id}`] = row;
	for (const row of sectionRows) tasksBlob[`section:${row.id}`] = row;

	const calendarBlob: Record<string, unknown> = {};
	for (const row of eventRows) calendarBlob[`event:${row.id}`] = row;

	const bookmarksBlob: Record<string, unknown> = {};
	for (const row of buildResearchBookmarks()) bookmarksBlob[`bookmark:${row.id}`] = row;

	const whiteboardBlob: Record<string, unknown> = {};
	for (const board of seedBoards.boards) {
		whiteboardBlob[`whiteboard:${board.whiteboard.id}`] = board.whiteboard;
		for (const edge of board.edges) whiteboardBlob[`whiteboard-edge:${edge.id}`] = edge;
	}

	const selfHostingBlob: Record<string, unknown> = {};
	for (const it of entities.iterations) selfHostingBlob[`iteration:${it.id}`] = it;
	for (const oq of entities.openQuestions) selfHostingBlob[`open-question:${oq.id}`] = oq;
	for (const stage of entities.stages) selfHostingBlob[`stage:${stage.id}`] = stage;
	for (const dd of entities.designDocs) selfHostingBlob[`design-doc:${dd.id}`] = dd;
	selfHostingBlob[`release:${entities.release.id}`] = entities.release;
	for (const ms of entities.milestones) selfHostingBlob[`milestone:${ms.id}`] = ms;
	for (const f of folders) selfHostingBlob[`folder:${f.id}`] = f;
	for (const c of codeFiles) selfHostingBlob[`code-file:${c.id}`] = c;
	selfHostingBlob[`folder:${referenceCodeFolder.id}`] = referenceCodeFolder;

	return {
		selfHosting,
		tasks,
		database,
		graph,
		calendar,
		whiteboard,
		bookmarks,
		notes,
		tasksBlob,
		calendarBlob,
		bookmarksBlob,
		whiteboardBlob,
		selfHostingBlob,
		notesBlob,
	};
}

function writeBookmarksKv(
	targetPath: string,
	rows: Array<{ id: string }>,
	mode: SeedMode,
	dryRun: boolean,
): SeedWriteRecord {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const seedIds = new Set(rows.map((r) => r.id));
	const keysWritten: string[] = [];
	const keysPreserved: string[] = [];

	for (const key of Object.keys(existing)) {
		const isSeedKey =
			key.startsWith(BOOKMARK_KEY_PREFIX) && seedIds.has(key.slice(BOOKMARK_KEY_PREFIX.length));
		if (mode === SeedMode.Merge && !isSeedKey) keysPreserved.push(key);
	}
	for (const r of rows) {
		const key = `${BOOKMARK_KEY_PREFIX}${r.id}`;
		next[key] = r;
		keysWritten.push(key);
	}
	if (!dryRun) writeKv(targetPath, next);
	return {
		path: targetPath,
		keysWritten,
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

function writeWhiteboardKv(
	targetPath: string,
	boards: readonly RoadmapBoard[],
	mode: SeedMode,
	dryRun: boolean,
): SeedWriteRecord {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const seedBoardKeys = new Set(boards.map((b) => `${WHITEBOARD_KEY_PREFIX}${b.whiteboard.id}`));
	const seedEdgeIds = new Set<string>();
	for (const b of boards) for (const e of b.edges) seedEdgeIds.add(e.id);
	const keysWritten: string[] = [];
	const keysPreserved: string[] = [];

	for (const key of Object.keys(existing)) {
		const isSeedKey =
			seedBoardKeys.has(key) ||
			(key.startsWith(WB_EDGE_KEY_PREFIX) && seedEdgeIds.has(key.slice(WB_EDGE_KEY_PREFIX.length)));
		if (mode === SeedMode.Merge && !isSeedKey) keysPreserved.push(key);
	}

	for (const board of boards) {
		const wbKey = `${WHITEBOARD_KEY_PREFIX}${board.whiteboard.id}`;
		next[wbKey] = board.whiteboard;
		keysWritten.push(wbKey);
		for (const e of board.edges) {
			const key = `${WB_EDGE_KEY_PREFIX}${e.id}`;
			next[key] = e;
			keysWritten.push(key);
		}
	}

	if (!dryRun) writeKv(targetPath, next);
	return {
		path: targetPath,
		keysWritten,
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

function writeCalendarKv(
	targetPath: string,
	events: Array<{ id: string }>,
	mode: SeedMode,
	dryRun: boolean,
): SeedWriteRecord {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const seedIds = new Set(events.map((e) => e.id));
	const keysWritten: string[] = [];
	const keysPreserved: string[] = [];

	for (const key of Object.keys(existing)) {
		const isSeedKey =
			key.startsWith(EVENT_KEY_PREFIX) && seedIds.has(key.slice(EVENT_KEY_PREFIX.length));
		if (mode === SeedMode.Merge && !isSeedKey) keysPreserved.push(key);
	}
	for (const e of events) {
		const key = `${EVENT_KEY_PREFIX}${e.id}`;
		next[key] = e;
		keysWritten.push(key);
	}
	if (!dryRun) writeKv(targetPath, next);
	return {
		path: targetPath,
		keysWritten,
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

function writeGraphKv(targetPath: string, mode: SeedMode, dryRun: boolean): SeedWriteRecord {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const keysPreserved: string[] = [];
	for (const key of Object.keys(existing)) {
		if (key !== GRAPH_STATE_KEY && mode === SeedMode.Merge) keysPreserved.push(key);
	}
	next[GRAPH_STATE_KEY] = buildPlanGraphState();
	if (!dryRun) writeKv(targetPath, next);
	return {
		path: targetPath,
		keysWritten: [GRAPH_STATE_KEY],
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

/** Cheap structural test — true when the object has the SeedNote shape
 *  (a body that's a SerializedEditorState root). The `docNotes` parameter
 *  of `writeDocNotesKv` is typed `{ id: string }` for legacy back-compat;
 *  in practice every caller passes SeedNote rows, but the guard keeps
 *  us safe against future code that doesn't. */
function isSeedNote(n: { id: string }): n is SeedNote {
	const b = (n as { body?: unknown }).body;
	if (!b || typeof b !== "object") return false;
	const root = (b as { root?: unknown }).root;
	if (!root || typeof root !== "object") return false;
	return (root as { type?: unknown }).type === "root";
}

function writeDocNotesKv(
	vaultPath: string,
	targetPath: string,
	docNotes: Array<{ id: string }>,
	mode: SeedMode,
	dryRun: boolean,
): { record: SeedWriteRecord; blob: Record<string, unknown> } {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const seedIds = new Set(docNotes.map((n) => n.id));
	const keysWritten: string[] = [];
	const keysPreserved: string[] = [];
	// The `note:<id>` rows this writer produces, projected into
	// `entities.db` by the caller (via `projectNotesFromBlob`). The rich
	// body already lands as an on-disk `.ydoc` (materializeSeededNote); the
	// blob row carries title/icon/snippet/about for the Note/v1 row + edges.
	const blob: Record<string, unknown> = {};

	for (const key of Object.keys(existing)) {
		const isSeedKey =
			key.startsWith(NOTE_KEY_PREFIX) && seedIds.has(key.slice(NOTE_KEY_PREFIX.length));
		if (mode === SeedMode.Merge && !isSeedKey) keysPreserved.push(key);
	}

	// `docNotes` mixes Note-shaped rows (hub / docs / iteration / feature
	// articles — every iteration of this writer passes SeedNote-shaped
	// objects) with the loose `{ id }` typing we accepted for back-
	// compat. The Note-shape branch materialises an on-disk `.ydoc` so
	// the editor reads content without going through the boot-time
	// `runVaultBodyMigration` plant.
	for (const n of docNotes) {
		const key = `${NOTE_KEY_PREFIX}${n.id}`;
		if (dryRun || !isSeedNote(n)) {
			next[key] = n;
		} else {
			const { row } = materializeSeededNote(vaultPath, n);
			next[key] = row;
		}
		blob[key] = next[key];
		keysWritten.push(key);
	}

	if (!dryRun) writeKv(targetPath, next);

	return {
		record: {
			path: targetPath,
			keysWritten,
			keysPreserved,
			totalKeysAfter: Object.keys(next).length,
		},
		blob,
	};
}

function writeDatabaseKv(targetPath: string, mode: SeedMode, dryRun: boolean): SeedWriteRecord {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const seed = buildDatabasePlanViews();
	const merged = mergeIntoDatabaseState(existing[DATABASE_STORAGE_KEY], seed);
	const keysPreserved: string[] = [];

	for (const key of Object.keys(existing)) {
		if (key !== DATABASE_STORAGE_KEY && mode === SeedMode.Merge) keysPreserved.push(key);
	}

	next[DATABASE_STORAGE_KEY] = merged;

	if (!dryRun) writeKv(targetPath, next);

	return {
		path: targetPath,
		keysWritten: [DATABASE_STORAGE_KEY],
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

function writeSelfHostingKv(
	targetPath: string,
	entities: BrainstormProjectEntities,
	folders: SerializedFolderEntity[],
	codeFiles: SerializedCodeFileEntity[],
	referenceCodeFolder: SerializedReferenceCodeFolder,
	mode: SeedMode,
	dryRun: boolean,
): SeedWriteRecord {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const seedKeyPrefixes = [
		ITERATION_KEY_PREFIX,
		OQ_KEY_PREFIX,
		STAGE_KEY_PREFIX,
		DESIGN_DOC_KEY_PREFIX,
		RELEASE_KEY_PREFIX,
		MILESTONE_KEY_PREFIX,
		FOLDER_KEY_PREFIX,
		CODE_FILE_KEY_PREFIX,
	];
	const keysWritten: string[] = [];
	const keysPreserved: string[] = [];

	for (const key of Object.keys(existing)) {
		const isSeedKey = seedKeyPrefixes.some((p) => key.startsWith(p));
		if (mode === SeedMode.Merge && !isSeedKey) keysPreserved.push(key);
	}

	writeEntityKeys(next, entities, keysWritten);
	for (const f of folders) {
		const key = `${FOLDER_KEY_PREFIX}${f.id}`;
		next[key] = f;
		keysWritten.push(key);
	}
	for (const c of codeFiles) {
		const key = `${CODE_FILE_KEY_PREFIX}${c.id}`;
		next[key] = c;
		keysWritten.push(key);
	}
	const referenceCodeFolderKey = `${FOLDER_KEY_PREFIX}${referenceCodeFolder.id}`;
	next[referenceCodeFolderKey] = referenceCodeFolder;
	keysWritten.push(referenceCodeFolderKey);

	if (!dryRun) writeKv(targetPath, next);

	return {
		path: targetPath,
		keysWritten,
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

function writeTasksKv(
	targetPath: string,
	tasks: Array<{ id: string }>,
	projects: Array<{ id: string }>,
	sections: SeedSectionRow[],
	mode: SeedMode,
	dryRun: boolean,
): SeedWriteRecord {
	const existing = readKv(targetPath);
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const seedTaskIds = new Set(tasks.map((t) => t.id));
	const seedProjectIds = new Set(projects.map((p) => p.id));
	const seedSectionIds = new Set(sections.map((s) => s.id));
	const keysWritten: string[] = [];
	const keysPreserved: string[] = [];
	const keysDropped: string[] = [];

	// The seeder is authoritative for any key matching its minting pattern:
	// tasks `task:(task-)?iter-*`, projects `project:proj-*`, sections
	// `section:sec-*`. A key matching one of those but NOT in the current
	// seed set is stale (e.g. the SH-39 restructure dropped the per-stage
	// `proj-9`/`proj-cross-cutting` projects + the pre-SH-37 `task:iter-*`
	// rows) and is removed; user-authored rows use different id shapes and
	// are preserved.
	const isStaleSeed = (key: string): boolean => {
		if (key.startsWith(TASKS_TASK_KEY_PREFIX)) {
			const inner = key.slice(TASKS_TASK_KEY_PREFIX.length);
			return (inner.startsWith("task-iter-") || inner.startsWith("iter-")) && !seedTaskIds.has(inner);
		}
		if (key.startsWith(TASKS_PROJECT_KEY_PREFIX)) {
			const inner = key.slice(TASKS_PROJECT_KEY_PREFIX.length);
			return inner.startsWith("proj-") && !seedProjectIds.has(inner);
		}
		if (key.startsWith(TASKS_SECTION_KEY_PREFIX)) {
			const inner = key.slice(TASKS_SECTION_KEY_PREFIX.length);
			return inner.startsWith("sec-") && !seedSectionIds.has(inner);
		}
		return false;
	};

	for (const key of Object.keys(existing)) {
		const isCurrentSeedKey =
			(key.startsWith(TASKS_TASK_KEY_PREFIX) &&
				seedTaskIds.has(key.slice(TASKS_TASK_KEY_PREFIX.length))) ||
			(key.startsWith(TASKS_PROJECT_KEY_PREFIX) &&
				seedProjectIds.has(key.slice(TASKS_PROJECT_KEY_PREFIX.length))) ||
			(key.startsWith(TASKS_SECTION_KEY_PREFIX) &&
				seedSectionIds.has(key.slice(TASKS_SECTION_KEY_PREFIX.length)));
		if (isCurrentSeedKey) continue;
		if (isStaleSeed(key)) {
			if (mode === SeedMode.Merge) delete next[key];
			keysDropped.push(key);
			continue;
		}
		if (mode === SeedMode.Merge) keysPreserved.push(key);
	}

	for (const t of tasks) {
		const key = `${TASKS_TASK_KEY_PREFIX}${t.id}`;
		next[key] = t;
		keysWritten.push(key);
	}
	for (const p of projects) {
		const key = `${TASKS_PROJECT_KEY_PREFIX}${p.id}`;
		next[key] = p;
		keysWritten.push(key);
	}
	for (const s of sections) {
		const key = `${TASKS_SECTION_KEY_PREFIX}${s.id}`;
		next[key] = s;
		keysWritten.push(key);
	}

	if (!dryRun) writeKv(targetPath, next);

	return {
		path: targetPath,
		keysWritten,
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

function writeEntityKeys(
	target: Record<string, unknown>,
	entities: BrainstormProjectEntities,
	keysWritten: string[],
): void {
	for (const it of entities.iterations) {
		const key = `${ITERATION_KEY_PREFIX}${it.id}`;
		target[key] = it;
		keysWritten.push(key);
	}
	for (const oq of entities.openQuestions) {
		const key = `${OQ_KEY_PREFIX}${oq.id}`;
		target[key] = oq;
		keysWritten.push(key);
	}
	for (const st of entities.stages) {
		const key = `${STAGE_KEY_PREFIX}${st.id}`;
		target[key] = st;
		keysWritten.push(key);
	}
	for (const dd of entities.designDocs) {
		const key = `${DESIGN_DOC_KEY_PREFIX}${dd.id}`;
		target[key] = dd;
		keysWritten.push(key);
	}
	const releaseKey = `${RELEASE_KEY_PREFIX}${entities.release.id}`;
	target[releaseKey] = entities.release;
	keysWritten.push(releaseKey);
	for (const ms of entities.milestones) {
		const key = `${MILESTONE_KEY_PREFIX}${ms.id}`;
		target[key] = ms;
		keysWritten.push(key);
	}
}

// Re-export the pure builder + its helpers for the test suite.
export { type BrainstormProjectEntities, type DesignDocSource, buildBrainstormProjectEntities };

function seedNotes(vaultPath: string, mode: SeedMode, dryRun: boolean): SeedWriteRecord {
	const targetPath = join(vaultPath, "data", "apps", NOTES_APP_ID, "kv.json");
	const existing = readKv(targetPath);
	const notes = buildDemoNotes();
	const next: Record<string, unknown> = mode === SeedMode.Merge ? { ...existing } : {};
	const keysWritten: string[] = [];
	const keysPreserved: string[] = [];
	const noteIds = new Set(notes.map((n) => n.id));

	for (const key of Object.keys(existing)) {
		const isSeedKey =
			key.startsWith(NOTE_KEY_PREFIX) && noteIds.has(key.slice(NOTE_KEY_PREFIX.length));
		if (mode === SeedMode.Merge && !isSeedKey) keysPreserved.push(key);
	}

	for (const note of notes) {
		const key = `${NOTE_KEY_PREFIX}${note.id}`;
		// New shape (post-fix): seeded body lives in a `.ydoc` file the
		// editor reads on open; the kv row carries only a plain-text
		// snippet. Old shape (whole SerializedEditorState in kv `body`)
		// forced a boot-time `runVaultBodyMigration` plant that competed
		// with user input — see the data-loss diagnosis in repro spec
		// `tests/perf/specs/repro-note-loss.spec.ts`.
		if (dryRun) {
			next[key] = note;
		} else {
			const { row } = materializeSeededNote(vaultPath, note);
			next[key] = row;
		}
		keysWritten.push(key);
	}

	if (!dryRun) writeKv(targetPath, next);

	return {
		path: targetPath,
		keysWritten,
		keysPreserved,
		totalKeysAfter: Object.keys(next).length,
	};
}

function readKv(path: string): Record<string, unknown> {
	if (!existsSync(path)) return {};
	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// Fall through — corrupted kv is treated as empty for the merge.
	}
	return {};
}

function writeKv(path: string, value: Record<string, unknown>): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
