/**
 * Mapper from the seeded plan → Database-app `List/v1` + `ListView/v1`
 * rows (SH-8 per docs/foundations/49-self-hosting.md).
 *
 * Pure. The Database app already renders any List with a `byType` source
 * across all six view kinds; this mapper just emits the matching List +
 * four Views (board-by-stage, board-by-status, calendar, timeline) so the
 * implementation plan appears in Database the same way it does in Tasks
 * (SH-7) — driven by the same `Task/v1` rows the Tasks seed writes.
 *
 * The Database app persists user-added lists under `database:state.userLists`
 * + `userViews` (a single `storage.kv` key — see `apps/database/src/app.ts`
 * `PersistedState`). This module emits exactly what slots into those two
 * arrays.
 *
 * 9.3.5.1b — the loose `Seed*Row` duplicates were deleted; this now imports
 * the canonical `List` / `ListView` / `ListSource` shapes from
 * `@brainstorm/sdk-types` (one source of truth). That promotion also
 * surfaced a latent drift: the old `SeedListViewRow.filters` carried a
 * `{ combinator, nodes }` object the canonical `ListView.filters`
 * (`FilterNode | null`) never had — the Database app's hydrator + the
 * `vault-lists` builders both use `filters: null` for "no filter". The
 * seed now writes the canonical `null`.
 */

import {
	CalendarRange,
	CalendarWeekStart,
	EmptyPlacement,
	IconKind,
	type List,
	type ListSourceByType,
	ListSourceKind,
	type ListView,
	ListViewKind,
	SortDirection,
	TimelineDensity,
} from "@brainstorm/sdk-types";

const STABLE_TS = Date.UTC(2026, 4, 14, 0, 0, 0);

export const PLAN_LIST_ID = "list-brainstorm-plan";
export const PLAN_VIEW_BY_STAGE_ID = "view-plan-by-stage";
export const PLAN_VIEW_BY_STATUS_ID = "view-plan-by-status";
export const PLAN_VIEW_CALENDAR_ID = "view-plan-calendar";
export const PLAN_VIEW_TIMELINE_ID = "view-plan-timeline";

export const OQ_LIST_ID = "list-brainstorm-oq";
export const OQ_VIEW_BY_STATUS_ID = "view-oq-by-status";
export const OQ_VIEW_GRID_ID = "view-oq-grid";

export const DOCS_LIST_ID = "list-brainstorm-docs";
export const DOCS_VIEW_GALLERY_ID = "view-docs-gallery";

/** The seed only ever emits `byType` Lists targeting `Task/v1`; narrowing
 *  the result keeps `.source.types` reachable without a discriminant
 *  switch at the call sites / tests. */
export type DatabaseSeedResult = {
	lists: Array<Omit<List, "source"> & { source: ListSourceByType }>;
	views: ListView[];
};

/**
 * Produces the four-view Database surface for the implementation plan
 * (two kanban boards + calendar + timeline, all over `brainstorm/Task/v1`).
 * Stable ids: re-running the seeder overwrites in place rather than
 * appending duplicates.
 */
export function buildDatabasePlanViews(now: number = STABLE_TS): DatabaseSeedResult {
	const list: Omit<List, "source"> & { source: ListSourceByType } = {
		id: PLAN_LIST_ID,
		name: "Implementation Plan",
		icon: { kind: IconKind.Emoji, value: "🛠️" },
		description:
			"Every iteration in docs/implementation-plan.md, seeded from the markdown source-of-truth.",
		source: {
			kind: ListSourceKind.ByType,
			types: ["brainstorm/Task/v1"],
		},
		members: { include: [], exclude: [] },
		views: [
			PLAN_VIEW_BY_STAGE_ID,
			PLAN_VIEW_BY_STATUS_ID,
			PLAN_VIEW_CALENDAR_ID,
			PLAN_VIEW_TIMELINE_ID,
		],
		defaultViewId: PLAN_VIEW_BY_STAGE_ID,
		createdAt: now,
		updatedAt: now,
	};

	const byStage: ListView = {
		id: PLAN_VIEW_BY_STAGE_ID,
		listId: PLAN_LIST_ID,
		name: "By stage",
		icon: { kind: IconKind.Emoji, value: "📚" },
		kind: ListViewKind.Board,
		filters: null,
		sorts: [{ propertyId: "name", direction: SortDirection.Asc, emptyPlacement: EmptyPlacement.End }],
		groupBy: { propertyId: "projectId" },
		coverProperty: null,
		cardSubtitleProperty: "statusKey",
		columns: [
			{ propertyId: "name", visible: true },
			{ propertyId: "statusKey", visible: true },
			{ propertyId: "priority", visible: true },
		],
		defaultTypeUrl: null,
		defaultTemplate: null,
		pageSize: 100,
		layoutOptions: {
			columnWidth: 320,
			collapseEmptyColumns: false,
			cardPreview: "rich",
		},
	};

	const byStatus: ListView = {
		id: PLAN_VIEW_BY_STATUS_ID,
		listId: PLAN_LIST_ID,
		name: "By status",
		icon: { kind: IconKind.Emoji, value: "🎯" },
		kind: ListViewKind.Board,
		filters: null,
		sorts: [{ propertyId: "name", direction: SortDirection.Asc, emptyPlacement: EmptyPlacement.End }],
		groupBy: { propertyId: "statusKey" },
		coverProperty: null,
		cardSubtitleProperty: "projectId",
		columns: [
			{ propertyId: "name", visible: true },
			{ propertyId: "projectId", visible: true },
			{ propertyId: "priority", visible: true },
		],
		defaultTypeUrl: null,
		defaultTemplate: null,
		pageSize: 100,
		layoutOptions: {
			columnWidth: 320,
			collapseEmptyColumns: false,
			cardPreview: "rich",
		},
	};

	const timeline: ListView = {
		id: PLAN_VIEW_TIMELINE_ID,
		listId: PLAN_LIST_ID,
		name: "Timeline",
		icon: { kind: IconKind.Emoji, value: "📈" },
		kind: ListViewKind.Timeline,
		filters: null,
		sorts: [
			{
				propertyId: "scheduledAt",
				direction: SortDirection.Asc,
				emptyPlacement: EmptyPlacement.End,
			},
		],
		groupBy: { propertyId: "statusKey" },
		coverProperty: null,
		cardSubtitleProperty: null,
		columns: [
			{ propertyId: "name", visible: true },
			{ propertyId: "statusKey", visible: true },
		],
		defaultTypeUrl: null,
		defaultTemplate: null,
		pageSize: 200,
		layoutOptions: {
			// Classic Gantt: one row per iteration (`swimlaneBy: null` →
			// the renderer gives each task its own lane). Span is
			// `scheduledAt → dueAt` — `createdAt` is NOT a projected task
			// *property* (only a top-level entity field), and the Timeline
			// resolves dates via `readPropertyPath` over `properties`, so
			// it would otherwise render empty. `deriveIterationSchedule`
			// already gives every iteration a distinct cascading span.
			primaryDateProperty: "scheduledAt",
			endDateProperty: "dueAt",
			swimlaneBy: null,
			pxPerDay: 16,
			showNow: true,
			showWeekends: true,
			dependencyLinkTypes: [],
			showDependencies: false,
			density: TimelineDensity.Comfortable,
			colorBy: "statusKey",
			labelProperty: "name",
		},
	};

	const calendar: ListView = {
		id: PLAN_VIEW_CALENDAR_ID,
		listId: PLAN_LIST_ID,
		name: "Calendar",
		icon: { kind: IconKind.Emoji, value: "🗓️" },
		kind: ListViewKind.Calendar,
		filters: null,
		sorts: [
			{
				propertyId: "completedAt",
				direction: SortDirection.Asc,
				emptyPlacement: EmptyPlacement.End,
			},
		],
		// groupBy is unused for date placement (that's primaryDateProperty);
		// kept as the colour fallback when colorBy resolves nothing.
		groupBy: { propertyId: "statusKey" },
		coverProperty: null,
		cardSubtitleProperty: "statusKey",
		columns: [
			{ propertyId: "name", visible: true },
			{ propertyId: "statusKey", visible: true },
		],
		defaultTypeUrl: null,
		defaultTemplate: null,
		pageSize: 100,
		layoutOptions: {
			range: CalendarRange.Month,
			startWeekOn: CalendarWeekStart.Monday,
			// Each iteration lands on its ship date; undated (pending)
			// iterations simply don't appear on the calendar.
			primaryDateProperty: "completedAt",
			colorBy: "statusKey",
		},
	};

	const oqList: Omit<List, "source"> & { source: ListSourceByType } = {
		id: OQ_LIST_ID,
		name: "Open Questions",
		icon: { kind: IconKind.Emoji, value: "❓" },
		description:
			"Every open question in docs/reference/11-open-questions.md, seeded from the markdown ledger.",
		source: { kind: ListSourceKind.ByType, types: ["brainstorm/OpenQuestion/v1"] },
		members: { include: [], exclude: [] },
		views: [OQ_VIEW_BY_STATUS_ID, OQ_VIEW_GRID_ID],
		defaultViewId: OQ_VIEW_BY_STATUS_ID,
		createdAt: now,
		updatedAt: now,
	};

	const oqByStatus: ListView = {
		id: OQ_VIEW_BY_STATUS_ID,
		listId: OQ_LIST_ID,
		name: "By status",
		icon: { kind: IconKind.Emoji, value: "🚦" },
		kind: ListViewKind.Board,
		filters: null,
		sorts: [{ propertyId: "code", direction: SortDirection.Asc, emptyPlacement: EmptyPlacement.End }],
		groupBy: { propertyId: "status" },
		coverProperty: null,
		cardSubtitleProperty: "section",
		columns: [
			{ propertyId: "name", visible: true },
			{ propertyId: "status", visible: true },
			{ propertyId: "section", visible: true },
		],
		defaultTypeUrl: null,
		defaultTemplate: null,
		pageSize: 200,
		layoutOptions: { columnWidth: 340, collapseEmptyColumns: false, cardPreview: "rich" },
	};

	const oqGrid: ListView = {
		id: OQ_VIEW_GRID_ID,
		listId: OQ_LIST_ID,
		name: "All questions",
		icon: { kind: IconKind.Emoji, value: "🗂️" },
		kind: ListViewKind.Grid,
		filters: null,
		sorts: [
			{ propertyId: "number", direction: SortDirection.Asc, emptyPlacement: EmptyPlacement.End },
		],
		groupBy: null,
		coverProperty: null,
		cardSubtitleProperty: null,
		columns: [
			{ propertyId: "code", visible: true },
			{ propertyId: "name", visible: true },
			{ propertyId: "status", visible: true },
			{ propertyId: "section", visible: true },
		],
		defaultTypeUrl: null,
		defaultTemplate: null,
		pageSize: 500,
		layoutOptions: { rowHeight: "compact", showRowNumbers: true, pinFirstColumn: true },
	};

	const docsList: Omit<List, "source"> & { source: ListSourceByType } = {
		id: DOCS_LIST_ID,
		name: "Design Docs",
		icon: { kind: IconKind.Emoji, value: "📘" },
		description: "Every design doc under docs/, seeded as browsable DesignDoc entities.",
		source: { kind: ListSourceKind.ByType, types: ["brainstorm/DesignDoc/v1"] },
		members: { include: [], exclude: [] },
		views: [DOCS_VIEW_GALLERY_ID],
		defaultViewId: DOCS_VIEW_GALLERY_ID,
		createdAt: now,
		updatedAt: now,
	};

	const docsGallery: ListView = {
		id: DOCS_VIEW_GALLERY_ID,
		listId: DOCS_LIST_ID,
		name: "Gallery",
		icon: { kind: IconKind.Emoji, value: "🖼️" },
		kind: ListViewKind.Gallery,
		filters: null,
		sorts: [
			{ propertyId: "docNumber", direction: SortDirection.Asc, emptyPlacement: EmptyPlacement.End },
		],
		groupBy: { propertyId: "category" },
		coverProperty: null,
		cardSubtitleProperty: "category",
		columns: [
			{ propertyId: "name", visible: true },
			{ propertyId: "category", visible: true },
		],
		defaultTypeUrl: null,
		defaultTemplate: null,
		pageSize: 300,
		layoutOptions: {
			thumbnailSize: "medium",
			cardAspectRatio: "square",
			showFilename: true,
		},
	};

	return {
		lists: [list, oqList, docsList],
		views: [byStage, byStatus, calendar, timeline, oqByStatus, oqGrid, docsGallery],
	};
}

export const DATABASE_STORAGE_KEY = "database:state";

/**
 * Pure helper for the seeder: merges the plan lists + views into a
 * persisted `database:state` payload. Drops the previous plan entries
 * (same ids) and appends the fresh ones; preserves any unrelated
 * user-authored lists / views.
 */
export function mergeIntoDatabaseState(
	existing: unknown,
	seed: DatabaseSeedResult,
): {
	version: 2;
	active: unknown;
	chrome: unknown;
	userLists: DatabaseSeedResult["lists"];
	userViews: ListView[];
} {
	const seedListIds = new Set(seed.lists.map((l) => l.id));
	const seedViewIds = new Set(seed.views.map((v) => v.id));
	const prior = (existing && typeof existing === "object" ? existing : {}) as Record<
		string,
		unknown
	>;
	const priorLists = Array.isArray(prior.userLists)
		? (prior.userLists as Array<{ id?: string }>).filter((l) => !seedListIds.has(l.id ?? ""))
		: [];
	const priorViews = Array.isArray(prior.userViews)
		? (prior.userViews as Array<{ id?: string }>).filter((v) => !seedViewIds.has(v.id ?? ""))
		: [];

	return {
		version: 2,
		active:
			prior.active && typeof prior.active === "object"
				? prior.active
				: { listId: seed.lists[0]?.id ?? null, viewId: seed.views[0]?.id ?? null },
		chrome:
			prior.chrome && typeof prior.chrome === "object"
				? prior.chrome
				: { sidebarOpen: true, inspectorOpen: false },
		userLists: [...(priorLists as unknown as DatabaseSeedResult["lists"]), ...seed.lists],
		userViews: [...(priorViews as unknown as ListView[]), ...seed.views],
	};
}
