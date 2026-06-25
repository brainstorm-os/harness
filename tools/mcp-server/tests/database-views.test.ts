import { describe, expect, it } from "vitest";
import {
	DATABASE_STORAGE_KEY,
	DOCS_LIST_ID,
	DOCS_VIEW_GALLERY_ID,
	OQ_LIST_ID,
	OQ_VIEW_BY_STATUS_ID,
	OQ_VIEW_GRID_ID,
	PLAN_LIST_ID,
	PLAN_VIEW_BY_STAGE_ID,
	PLAN_VIEW_BY_STATUS_ID,
	PLAN_VIEW_CALENDAR_ID,
	PLAN_VIEW_TIMELINE_ID,
	buildDatabasePlanViews,
	mergeIntoDatabaseState,
} from "../src/seed/database-views.ts";

describe("buildDatabasePlanViews", () => {
	const result = buildDatabasePlanViews();

	it("emits the plan + OQ + docs Lists, plan first (default surface)", () => {
		expect(result.lists).toHaveLength(3);
		expect(result.lists.map((l) => l.id)).toEqual([PLAN_LIST_ID, OQ_LIST_ID, DOCS_LIST_ID]);
	});

	it("each List targets its entity type via a byType source", () => {
		expect(result.lists[0]?.source.types).toEqual(["brainstorm/Task/v1"]);
		expect(result.lists[1]?.source.types).toEqual(["brainstorm/OpenQuestion/v1"]);
		expect(result.lists[2]?.source.types).toEqual(["brainstorm/DesignDoc/v1"]);
	});

	it("emits the four plan views plus the OQ board/grid + docs gallery", () => {
		const ids = result.views.map((v) => v.id);
		expect(ids).toEqual([
			PLAN_VIEW_BY_STAGE_ID,
			PLAN_VIEW_BY_STATUS_ID,
			PLAN_VIEW_CALENDAR_ID,
			PLAN_VIEW_TIMELINE_ID,
			OQ_VIEW_BY_STATUS_ID,
			OQ_VIEW_GRID_ID,
			DOCS_VIEW_GALLERY_ID,
		]);
		const kinds = result.views.map((v) => v.kind);
		expect(kinds).toEqual(["board", "board", "calendar", "timeline", "board", "grid", "gallery"]);
	});

	it("OQ list defaults to the by-status board grouped by status", () => {
		const oq = result.lists.find((l) => l.id === OQ_LIST_ID);
		expect(oq?.defaultViewId).toBe(OQ_VIEW_BY_STATUS_ID);
		const v = result.views.find((x) => x.id === OQ_VIEW_BY_STATUS_ID);
		expect(v?.groupBy?.propertyId).toBe("status");
	});

	it("docs list is a gallery grouped by category", () => {
		const v = result.views.find((x) => x.id === DOCS_VIEW_GALLERY_ID);
		expect(v?.kind).toBe("gallery");
		expect(v?.groupBy?.propertyId).toBe("category");
	});

	it("declares the default view on the List", () => {
		expect(result.lists[0]?.defaultViewId).toBe(PLAN_VIEW_BY_STAGE_ID);
		expect(result.lists[0]?.views).toEqual([
			PLAN_VIEW_BY_STAGE_ID,
			PLAN_VIEW_BY_STATUS_ID,
			PLAN_VIEW_CALENDAR_ID,
			PLAN_VIEW_TIMELINE_ID,
		]);
	});

	it("calendar view places cards on completedAt + colours by statusKey", () => {
		const v = result.views.find((x) => x.id === PLAN_VIEW_CALENDAR_ID);
		expect(v?.kind).toBe("calendar");
		const opts = v?.layoutOptions as {
			primaryDateProperty?: string;
			colorBy?: string | null;
			range?: string;
		};
		expect(opts?.primaryDateProperty).toBe("completedAt");
		expect(opts?.colorBy).toBe("statusKey");
		expect(opts?.range).toBe("month");
	});

	it("groups the by-stage board by projectId", () => {
		const v = result.views.find((v) => v.id === PLAN_VIEW_BY_STAGE_ID);
		expect(v?.groupBy?.propertyId).toBe("projectId");
	});

	it("groups the by-status board by statusKey", () => {
		const v = result.views.find((v) => v.id === PLAN_VIEW_BY_STATUS_ID);
		expect(v?.groupBy?.propertyId).toBe("statusKey");
	});

	it("timeline view's layoutOptions carry pxPerDay + primaryDate/endDate properties", () => {
		const v = result.views.find((v) => v.id === PLAN_VIEW_TIMELINE_ID);
		const opts = v?.layoutOptions as {
			pxPerDay?: number;
			primaryDateProperty?: string;
			endDateProperty?: string | null;
			swimlaneBy?: string | null;
		};
		expect(opts?.pxPerDay).toBe(16);
		// `createdAt` is a top-level entity field, NOT a projected task
		// property — the Timeline resolves dates via property path, so the
		// span must be the projected `scheduledAt → dueAt`.
		expect(opts?.primaryDateProperty).toBe("scheduledAt");
		expect(opts?.endDateProperty).toBe("dueAt");
		// Classic Gantt — one row per task, not grouped by status.
		expect(opts?.swimlaneBy).toBeNull();
	});

	it("every view writes all required ListView fields (matches apps/database/src/types/list-view.ts)", () => {
		for (const v of result.views) {
			expect(v.coverProperty).toBeDefined();
			expect(v.cardSubtitleProperty).toBeDefined();
			expect(v.defaultTypeUrl).toBeDefined();
			expect(v.defaultTemplate).toBeDefined();
			expect(typeof v.pageSize).toBe("number");
			expect(v.layoutOptions).toBeDefined();
			expect(v).not.toHaveProperty("options");
		}
	});

	it("board views carry BoardLayoutOptions shape (columnWidth/collapseEmptyColumns/cardPreview)", () => {
		for (const id of [PLAN_VIEW_BY_STAGE_ID, PLAN_VIEW_BY_STATUS_ID]) {
			const v = result.views.find((x) => x.id === id);
			const opts = v?.layoutOptions as {
				columnWidth?: number;
				collapseEmptyColumns?: boolean;
				cardPreview?: string;
			};
			expect(opts?.columnWidth).toBe(320);
			expect(opts?.collapseEmptyColumns).toBe(false);
			expect(opts?.cardPreview).toBe("rich");
		}
	});

	it("is idempotent — same `now` produces same output", () => {
		const a = buildDatabasePlanViews(123);
		const b = buildDatabasePlanViews(123);
		expect(b).toEqual(a);
	});
});

describe("mergeIntoDatabaseState", () => {
	const seed = buildDatabasePlanViews();

	it("creates a fresh v2 state when existing is undefined / null / wrong shape", () => {
		for (const e of [undefined, null, 42, "noop", []]) {
			const merged = mergeIntoDatabaseState(e, seed);
			expect(merged.version).toBe(2);
			expect(merged.userLists).toHaveLength(3);
			expect(merged.userViews).toHaveLength(7);
		}
	});

	it("preserves user-authored lists / views that don't collide with seed ids", () => {
		const prior = {
			version: 2,
			active: { listId: "user-list-1", viewId: "user-view-1" },
			chrome: { sidebarOpen: false, inspectorOpen: true },
			userLists: [{ id: "user-list-1", name: "User list", source: { kind: "byType", types: [] } }],
			userViews: [{ id: "user-view-1", listId: "user-list-1", name: "User view", kind: "grid" }],
		};
		const merged = mergeIntoDatabaseState(prior, seed);
		const listIds = merged.userLists.map((l) => l.id);
		expect(listIds).toContain("user-list-1");
		expect(listIds).toContain(PLAN_LIST_ID);
	});

	it("replaces a prior seed-id list rather than duplicating", () => {
		const prior = {
			version: 2,
			active: null,
			chrome: null,
			userLists: [{ id: PLAN_LIST_ID, name: "STALE", source: { kind: "byType", types: [] } }],
			userViews: [],
		};
		const merged = mergeIntoDatabaseState(prior, seed);
		const planLists = merged.userLists.filter((l) => l.id === PLAN_LIST_ID);
		expect(planLists).toHaveLength(1);
		expect(planLists[0]?.name).toBe("Implementation Plan");
	});

	it("preserves the user's active selection when set", () => {
		const prior = {
			active: { listId: "user-list-1", viewId: "user-view-1" },
			chrome: { sidebarOpen: false, inspectorOpen: true },
			userLists: [],
			userViews: [],
		};
		const merged = mergeIntoDatabaseState(prior, seed);
		expect(merged.active).toEqual({ listId: "user-list-1", viewId: "user-view-1" });
	});

	it("defaults active selection to the seed list when prior is empty", () => {
		const merged = mergeIntoDatabaseState({}, seed);
		expect(merged.active).toEqual({ listId: PLAN_LIST_ID, viewId: PLAN_VIEW_BY_STAGE_ID });
	});

	it("is idempotent — merging twice produces structurally identical state", () => {
		const once = mergeIntoDatabaseState({}, seed);
		const twice = mergeIntoDatabaseState({ [DATABASE_STORAGE_KEY]: once }, seed);
		// Compare only the userLists/userViews + version, not active (which
		// changes depending on `prior`).
		expect(twice.userLists.map((l) => l.id)).toEqual(once.userLists.map((l) => l.id));
		expect(twice.userViews.map((v) => v.id)).toEqual(once.userViews.map((v) => v.id));
		expect(twice.version).toBe(once.version);
	});
});
